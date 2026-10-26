#!/usr/bin/env node
/**
 * Finishes a release that `npm run release` built but didn't manage to publish
 * — the steps that used to be done by hand:
 *
 *   1. check GH_TOKEN actually works (the usual cause of the failure)
 *   2. make sure the v{version} git tag exists and is on origin
 *   3. make sure the GitHub release exists in the releases repo
 *   4. make sure the installer is attached, complete, and downloadable
 *   5. only then publish the version to Supabase, so the app never offers
 *      users a download link that 404s
 *   6. publish it to the fmtsoftware.com marketplace (Sanity)
 *
 * Every step checks before it acts, so it is safe to run as many times as
 * needed — including after a release that fully succeeded.
 *
 *   npm run release:finish                  # all of the above
 *   npm run release:finish -- --skip-supabase
 *   npm run release:finish -- --skip-sanity
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envLocalPath = path.join(__dirname, '../../.env.local');
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath, quiet: true });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, quiet: true });
}

const config = require('../release-config');
const { findInstallerFiles, validateDownloadUrls } = require('./lib/installers');
const { verifyGitHubAccess } = require('./lib/github');
const { createGitHubRelease } = require('./publish-github');
const { publishToSupabase } = require('./publish-supabase');
const { publishToSanity } = require('./publish-sanity');

const colors = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m', bright: '\x1b[1m' };
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.cyan}→${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`),
};

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8', stdio: 'pipe' }).trim();

function ensureGitTag(tagName) {
  let localCommit = null;
  try {
    localCommit = git(`rev-parse ${tagName}^{commit}`);
  } catch {
    // no local tag
  }

  let remoteLine = '';
  try {
    remoteLine = git(`ls-remote --tags origin refs/tags/${tagName}`);
  } catch (error) {
    log.warning(`Could not check origin for ${tagName}: ${error.message.split('\n')[0]}`);
    return;
  }

  if (!localCommit && !remoteLine) {
    // The release commit is what `npm run release` creates; if it never got
    // that far there is no build to finish.
    const head = git('log -1 --format=%s');
    if (head !== config.git.commitMessage.replace('{version}', config.version)) {
      throw new Error(
        `No ${tagName} tag and HEAD is not the release commit ("${head}"). ` +
          'Run "npm run release" first — there is nothing to finish.'
      );
    }
    git(`tag ${tagName}`);
    log.success(`Created missing tag ${tagName} on the release commit`);
    localCommit = git(`rev-parse ${tagName}^{commit}`);
  }

  if (localCommit && !remoteLine) {
    git('push');
    git(`push origin ${tagName}`);
    log.success(`Pushed ${tagName} to origin`);
  } else {
    log.success(`Tag ${tagName} is on origin`);
  }
}

// The link the app hands users. GitHub redirects release downloads to its
// CDN, so follow redirects and look for a 200 — a HEAD is enough.
async function verifyDownload(url) {
  const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Download link returns ${response.status}: ${url}`);
  }
  const size = Number(response.headers.get('content-length') || 0);
  log.success(`Download link works${size ? ` (${(size / 1048576).toFixed(1)} MB)` : ''}: ${url}`);
}

async function main() {
  const skipSupabase = process.argv.includes('--skip-supabase');
  const skipSanity = process.argv.includes('--skip-sanity');
  const tagName = `v${config.version}`;
  log.header(`Finishing release ${tagName}`);

  log.step('Checking GitHub access...');
  const problems = await verifyGitHubAccess(config);
  if (problems.length > 0) {
    problems.forEach((p) => log.error(p));
    throw new Error('Fix GH_TOKEN in .env.local, then rerun npm run release:finish');
  }
  log.success(`GH_TOKEN can publish to ${config.github.owner}/${config.github.repo}`);

  log.step('Locating the installer...');
  const installerFiles = findInstallerFiles(config, { log });
  const published = Object.entries(config.platforms).filter(([, p]) => p.status === 'published');
  const missing = published.filter(([platform]) => !installerFiles[platform]);
  if (missing.length > 0) {
    throw new Error(
      `No installer for ${missing.map(([p]) => p).join(', ')} ${config.version} in release/build. ` +
        'Run "npm run release" (or "npm run package") first.'
    );
  }
  const urlProblems = validateDownloadUrls(config, installerFiles);
  if (urlProblems.length > 0) {
    urlProblems.forEach((p) => log.error(p));
    throw new Error('Installer name does not match the download URL');
  }
  Object.entries(installerFiles).forEach(([platform, file]) => log.info(`  ${platform}: ${file}`));

  log.step('Checking the git tag...');
  ensureGitTag(tagName);

  // Creates the release if missing, reuses it if present, and uploads only
  // what isn't already there in full.
  const release = await createGitHubRelease(config, installerFiles);
  if (!release) {
    throw new Error('GitHub publishing is disabled in release-config.js');
  }
  log.success(`GitHub release: ${release.html_url}`);

  log.step('Verifying download links...');
  for (const [platform] of published) {
    await verifyDownload(config.platforms[platform].downloadUrlTemplate.replaceAll('{version}', config.version));
  }

  if (skipSupabase) {
    log.info('Skipping Supabase (--skip-supabase). Publish later with: npm run publish:supabase');
  } else if (config.supabase?.enabled) {
    await publishToSupabase();
  }

  // Last: the website follows the app. A failure here leaves the app release
  // live; rerun with npm run publish:sanity.
  if (skipSanity) {
    log.info('Skipping the marketplace (--skip-sanity). Publish later with: npm run publish:sanity');
  } else if (config.sanity?.enabled) {
    await publishToSanity();
  }

  log.header(`Release ${tagName} is live`);
}

main().catch((error) => {
  log.error(error.message);
  process.exit(1);
});
