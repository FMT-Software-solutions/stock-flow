#!/usr/bin/env node
/**
 * Stock Flow release: preflight → compile → version bump → package → commit
 * and tag → publish (GitHub release + installer, download check, Supabase).
 *
 *   npm run release:check    # preflight only, changes nothing (~10s)
 *   npm run release          # the whole thing
 *   npm run release:finish   # resume publishing after a failure
 *
 * Everything that can fail cheaply (token, config, git state, tag) is checked
 * BEFORE the build, so a mistake costs seconds, not a full build. Every step
 * after the build is resumable: rerunning `npm run release` or
 * `npm run release:finish` picks up where the last attempt stopped.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { findInstallerFiles, validateDownloadUrls } = require('./lib/installers');
const { verifyGitHubAccess } = require('./lib/github');

const envLocalPath = path.join(__dirname, '../../.env.local');
const envPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath, quiet: true });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, quiet: true });
} else {
  console.warn('Warning: No .env.local or .env file found');
}

const config = require('../release-config');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}→${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`),
};

const CHECK_ONLY = process.argv.includes('--check');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

const git = (args) => execCommand(`git ${args}`, { silent: true }).trim();

// Phase timings, printed at the end so slow steps are visible release to release.
const timings = [];
async function timed(label, fn) {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    timings.push([label, Date.now() - started]);
  }
}
function printTimings() {
  if (timings.length === 0) return;
  const fmt = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`);
  log.header('Timings');
  timings.forEach(([label, ms]) => console.log(`  ${label.padEnd(22)} ${fmt(ms)}`));
  console.log(`  ${'Total'.padEnd(22)} ${fmt(timings.reduce((sum, [, ms]) => sum + ms, 0))}`);
}

// --- Version helpers ---

const isSemver = (v) => /^\d+\.\d+\.\d+$/.test(v);

function isHigherVersion(next, current) {
  const [a, b] = [next, current].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
}

function updatePackageVersion(version) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = readPackageJson();
  packageJson.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

// Returns false when a resumed run already wrote this version's entry.
function updateChangelog() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  let changelog = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';

  if (changelog.includes(`## [${config.version}]`)) {
    return false;
  }

  const date = new Date().toISOString().split('T')[0];
  const entry = `## [${config.version}] - ${date}\n\n${config.releaseNotes.trim()}\n\n`;
  const lines = changelog.split('\n');
  const insertAt = lines.findIndex((line) => line.startsWith('## ['));
  lines.splice(insertAt !== -1 ? insertAt : 4, 0, ...entry.split('\n'));
  fs.writeFileSync(changelogPath, lines.join('\n'));
  return true;
}

// --- Preflight ---

function checkConfig(problems) {
  if (!isSemver(config.version || '')) {
    problems.push(`release-config.js version "${config.version}" is not x.y.z`);
  }
  if (!config.releaseNotes || !config.releaseNotes.trim()) {
    problems.push('release-config.js has no release notes');
  }
  if (!config.git.commitMessage?.includes('{version}')) {
    problems.push('git.commitMessage must contain {version} (e.g. "Release v{version}")');
  }
  if (config.supabase?.enabled) {
    if (!process.env.VITE_SUPABASE_URL) problems.push('VITE_SUPABASE_URL is not set in .env.local');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) problems.push('SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  }

  const current = readPackageJson().version;
  log.info(`Current version: ${current} → target: ${config.version}`);
  if (config.version === current) {
    // An earlier run bumps package.json before it fails; the same version
    // means resume, not "not higher".
    log.warning('package.json already carries the target version — resuming a previous attempt.');
  } else if (isSemver(current) && !isHigherVersion(config.version, current)) {
    problems.push(`Version ${config.version} is not higher than package.json's ${current}`);
  }
}

// A push rejected because origin moved, or a tag that already exists, used to
// surface only after the build. Both are checked here instead.
function checkGit(problems) {
  try {
    git('rev-parse --git-dir');
  } catch {
    problems.push('Not inside a git repository');
    return;
  }

  const branch = git('rev-parse --abbrev-ref HEAD');
  if (branch === 'HEAD') {
    problems.push('HEAD is detached — check out a branch before releasing');
    return;
  }

  try {
    git('fetch --quiet origin');
    const upstream = git(`rev-parse --abbrev-ref ${branch}@{upstream}`);
    const [behind] = git(`rev-list --left-right --count ${upstream}...HEAD`).split(/\s+/).map(Number);
    if (behind > 0) {
      problems.push(`${branch} is ${behind} commit(s) behind ${upstream} — pull first, or the push will be rejected after the build`);
    }
  } catch (error) {
    log.warning(`Could not compare ${branch} with origin: ${error.message.split('\n')[0]}`);
  }

  const tagName = `v${config.version}`;
  let tagCommit = null;
  try {
    tagCommit = git(`rev-parse ${tagName}^{commit}`);
  } catch {
    // no local tag
  }
  if (tagCommit && tagCommit !== git('rev-parse HEAD')) {
    problems.push(
      `Tag ${tagName} already exists on another commit. If that release was abandoned: ` +
        `git tag -d ${tagName} && git push origin :refs/tags/${tagName}`
    );
  }
  if (!tagCommit) {
    try {
      if (git(`ls-remote --tags origin refs/tags/${tagName}`)) {
        problems.push(`Tag ${tagName} exists on origin but not locally — run "git fetch --tags" and check it`);
      }
    } catch {
      // origin unreachable; the push step will report it
    }
  }

  // Not via git(): trimming would eat the first line's status column.
  const dirty = execCommand('git status --porcelain', { silent: true })
    .split('\n')
    .filter(Boolean)
    .filter((line) => !/(package\.json|CHANGELOG\.md|release\/release-config\.js)$/.test(line));
  if (dirty.length > 0) {
    log.warning(`${dirty.length} other uncommitted change(s) — they will NOT be part of the release commit:`);
    dirty.slice(0, 5).forEach((line) => log.warning(`    ${line.trim()}`));
  }
}

async function preflight() {
  log.step('Preflight checks...');
  const problems = [];
  checkConfig(problems);
  checkGit(problems);

  if (config.github.enabled && config.github.createRelease) {
    const githubProblems = await verifyGitHubAccess(config);
    problems.push(...githubProblems);
    if (githubProblems.length === 0) {
      log.success(`GH_TOKEN can publish to ${config.github.owner}/${config.github.repo}`);
    }
  }

  if (problems.length > 0) {
    problems.forEach((problem) => log.error(`  - ${problem}`));
    throw new Error('Preflight failed — nothing was built or changed');
  }
  log.success('Preflight passed');
}

// --- Build & package ---

// Removes unpacked output and installers from earlier versions. electron-builder
// renames win-unpacked.tmp → win-unpacked and fails with EPERM if the target
// exists, and old installers must never be picked up for a new version.
function cleanBuildOutput() {
  const buildDir = path.join(process.cwd(), 'release', 'build');
  if (!fs.existsSync(buildDir)) return;

  ['win-unpacked', 'win-unpacked.tmp', 'mac', 'linux-unpacked'].forEach((dir) => {
    const target = path.join(buildDir, dir);
    try {
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    } catch (error) {
      log.warning(`Could not remove ${dir}: ${error.message}. Close any running Stock Flow and retry.`);
    }
  });

  fs.readdirSync(buildDir)
    .filter((name) => /\.(exe|blockmap|dmg|AppImage)$/i.test(name) && !name.includes(config.version))
    .forEach((name) => {
      try {
        fs.rmSync(path.join(buildDir, name), { force: true });
        log.info(`Removed old installer: ${name}`);
      } catch (error) {
        log.warning(`Could not remove ${name}: ${error.message}`);
      }
    });
}

// Windows intermittently throws EPERM/EBUSY while an antivirus scans the
// freshly extracted Electron binaries; clean and retry instead of failing.
async function packageElectron(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (config.build.cleanBefore) cleanBuildOutput();
    try {
      execCommand('npm run package');
      return;
    } catch (error) {
      const leftoverTmp = fs.existsSync(path.join(process.cwd(), 'release', 'build', 'win-unpacked.tmp'));
      const transient = leftoverTmp || /EPERM|EBUSY|resource busy|operation not permitted/i.test(error.message);
      if (attempt === maxRetries || !transient) throw error;
      log.warning(`Packaging failed (attempt ${attempt}/${maxRetries}) — likely a file lock. Retrying in 8s...`);
      await sleep(8000);
    }
  }
}

// --- Git ---

function commitAndTag() {
  const tagName = `v${config.version}`;
  const commitMessage = config.git.commitMessage.replace('{version}', config.version);

  if (config.git.createCommit) {
    execCommand('git add package.json CHANGELOG.md release/release-config.js', { silent: true });
    if (git('diff --cached --name-only')) {
      execCommand(`git commit -m "${commitMessage}"`, { silent: true });
      log.success(`Committed: ${commitMessage}`);
    } else {
      log.info('Release files already committed');
    }
  }

  if (config.git.createTag) {
    let tagCommit = null;
    try {
      tagCommit = git(`rev-parse ${tagName}^{commit}`);
    } catch {
      // not tagged yet
    }
    if (!tagCommit) {
      git(`tag ${tagName}`);
      log.success(`Tagged ${tagName}`);
    } else if (tagCommit !== git('rev-parse HEAD')) {
      throw new Error(`Tag ${tagName} points at another commit`);
    }
  }

  if (config.git.pushChanges) {
    execCommand('git push --quiet', { silent: true });
    if (config.git.createTag) execCommand(`git push --quiet origin ${tagName}`, { silent: true });
    log.success('Pushed commit and tag');
  }
}

async function main() {
  log.header(CHECK_ONLY ? 'Stock Flow release — preflight' : `Stock Flow release v${config.version}`);

  await timed('Preflight', preflight);

  if (CHECK_ONLY) {
    Object.entries(config.platforms)
      .filter(([, p]) => p.status === 'published')
      .forEach(([platform, p]) => log.info(`  ${platform} → ${p.downloadUrlTemplate.replaceAll('{version}', config.version)}`));
    log.success('Ready. Run "npm run release" to publish.');
    return;
  }

  if (config.build.enabled && !config.build.skipBuild) {
    log.step('Compiling (electron main + renderer)...');
    // Only one electron-builder run per release: the old flow also packaged a
    // --dir build here, under the OLD version, then packaged everything again.
    await timed('Compile', () => execCommand('npm run electron:build'));
  }

  updatePackageVersion(config.version);
  log.success(updateChangelog() ? 'Updated package.json and CHANGELOG.md' : 'Updated package.json (CHANGELOG already has this version)');

  if (config.build.enabled && !config.build.skipPackage) {
    log.step('Packaging installer...');
    await timed('Package', () => packageElectron());
  }

  const installerFiles = findInstallerFiles(config, { log });
  const published = Object.entries(config.platforms).filter(([, p]) => p.status === 'published');
  const missing = published.filter(([platform]) => !installerFiles[platform]);
  if (missing.length > 0) {
    throw new Error(`No ${config.version} installer for ${missing.map(([p]) => p).join(', ')} in release/build`);
  }
  const urlProblems = validateDownloadUrls(config, installerFiles);
  if (urlProblems.length > 0) {
    urlProblems.forEach((problem) => log.error(`  - ${problem}`));
    throw new Error('Refusing to publish a release whose download link would not work');
  }
  Object.entries(installerFiles).forEach(([platform, file]) =>
    log.info(`  ${platform}: ${path.basename(file)} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`)
  );

  log.step('Committing and tagging...');
  await timed('Git', () => commitAndTag());

  // Same code path as recovering a failed run: GitHub release + installer,
  // download link check, and only then Supabase — the app must never be told
  // about an update whose download 404s.
  try {
    await timed('Publish', () => execCommand('node release/scripts/finish-release.js'));
  } catch {
    throw new Error('Publishing did not complete. The build, commit and tag are kept — fix the error above, then run: npm run release:finish');
  }

  log.header(`v${config.version} released`);
}

main()
  .catch((error) => {
    log.error(error.message);
    process.exitCode = 1;
  })
  .finally(printTimings);
