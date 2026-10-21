#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { findInstallerFiles, validateDownloadUrls } = require('./lib/installers');
const { createOctokit, getGitHubToken } = require('./lib/github');

// Load environment variables
const envLocalPath = path.join(__dirname, '../../.env.local');
const envPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath, quiet: true });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, quiet: true });
} else {
  console.warn('Warning: No .env.local or .env file found');
}

// Colors for console output
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
  step: (msg) => console.log(`\n${colors.cyan}${colors.bright}▶${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.magenta}${colors.bright}═══ ${msg} ═══${colors.reset}\n`),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mb = (bytes) => (bytes / 1048576).toFixed(1);

// Streams the installer straight from disk to GitHub's upload endpoint.
//
// Octokit's upload goes through fetch, which needs the whole file in memory
// and runs under undici's 300s headers timeout — a 116 MB installer on a slow
// connection takes longer than that, and the upload dies near the end. A plain
// https request has no such timeout, keeps memory flat, and lets us print
// progress so a slow upload is visibly slow rather than apparently hung.
function streamUpload({ uploadUrl, filePath, name, size }) {
  const url = new URL(uploadUrl.replace(/\{.*\}$/, ''));
  url.searchParams.set('name', name);

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getGitHubToken()}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/octet-stream',
          'Content-Length': size,
          'User-Agent': 'stock-flow-release-script',
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            const error = new Error(`GitHub answered ${response.statusCode}: ${body.slice(0, 300)}`);
            error.status = response.statusCode;
            reject(error);
          }
        });
      }
    );
    request.on('error', reject);

    const started = Date.now();
    let sent = 0;
    let lastReport = 0;
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => {
      sent += chunk.length;
      const now = Date.now();
      if (now - lastReport > 5000 || sent === size) {
        lastReport = now;
        const rate = sent / Math.max(1, (now - started) / 1000);
        const left = Math.round((size - sent) / Math.max(rate, 1));
        process.stdout.write(
          `\r  ${mb(sent)} / ${mb(size)} MB  ${(rate / 1048576).toFixed(2)} MB/s  ~${left}s left   `
        );
      }
    });
    stream.on('end', () => process.stdout.write('\n'));
    stream.on('error', (error) => {
      request.destroy(error);
      reject(error);
    });
    stream.pipe(request);
  });
}

// Uploads one asset, resuming cleanly after an earlier attempt:
//   - an already-complete asset of the same name is left alone
//   - a partial/broken one is deleted first (re-upload would 422 otherwise)
//   - failures retry with backoff
async function uploadAssetWithRetry(octokit, { owner, repo, release, name, filePath }, maxRetries = 4) {
  const size = fs.statSync(filePath).size;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: assets } = await octokit.rest.repos.listReleaseAssets({
        owner,
        repo,
        release_id: release.id,
        per_page: 100,
      });
      const existing = assets.find((a) => a.name === name);
      if (existing && existing.state === 'uploaded' && existing.size === size) {
        log.success(`${name} is already uploaded (${mb(size)} MB) — skipping.`);
        return;
      }
      if (existing) {
        log.info(`Removing incomplete asset ${name} before re-upload...`);
        await octokit.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: existing.id });
      }
    } catch (cleanupError) {
      log.warning(`Could not check existing assets: ${cleanupError.message}`);
    }

    try {
      log.info(`Uploading ${name} (${mb(size)} MB), attempt ${attempt}/${maxRetries}`);
      await streamUpload({ uploadUrl: release.upload_url, filePath, name, size });
      return;
    } catch (uploadError) {
      // Auth and permission errors won't fix themselves on a retry.
      if (uploadError.status === 401 || uploadError.status === 403 || attempt === maxRetries) {
        throw uploadError;
      }
      const waitMs = attempt * 5000;
      log.warning(`Upload attempt ${attempt} failed: ${uploadError.message}. Retrying in ${waitMs / 1000}s...`);
      await sleep(waitMs);
    }
  }
}

// Creates the GitHub release for config.version, or reuses it if a previous
// attempt already created it, then makes sure every installer is attached in
// full. Safe to run repeatedly. The source tag is never deleted on failure:
// it marks what was built, and `npm run release:finish` resumes against it.
async function createGitHubRelease(config, installerFiles) {
  if (!config.github.enabled || !config.github.createRelease) {
    log.info('GitHub release creation is disabled');
    return null;
  }

  log.step('Publishing GitHub release...');

  if (!getGitHubToken()) {
    throw new Error('GH_TOKEN environment variable is required for GitHub releases');
  }

  const octokit = createOctokit();
  const { owner, repo } = config.github;
  const tagName = `v${config.version}`;

  let release;
  try {
    release = (await octokit.rest.repos.getReleaseByTag({ owner, repo, tag: tagName })).data;
    log.warning(`GitHub release ${tagName} already exists — reusing it.`);
  } catch (lookupError) {
    if (lookupError.status !== 404) throw lookupError;
    release = (
      await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: tagName,
        name: `Release ${tagName}`,
        body: config.releaseNotes,
        draft: config.github.draft || false,
        prerelease: config.github.prerelease || false,
      })
    ).data;
    log.success(`GitHub release created: ${release.html_url}`);
  }

  if (config.github.uploadAssets) {
    if (Object.keys(installerFiles).length === 0) {
      throw new Error(`No installer for ${config.version} to upload. Run "npm run release" (or "npm run package") first.`);
    }
    const urlProblems = validateDownloadUrls(config, installerFiles);
    if (urlProblems.length > 0) {
      urlProblems.forEach((problem) => log.error(problem));
      throw new Error('Asset name does not match the published download URL');
    }

    for (const [platform, filePath] of Object.entries(installerFiles)) {
      const name = path.basename(filePath);
      await uploadAssetWithRetry(octokit, { owner, repo, release, name, filePath });
      log.success(`Uploaded ${name} for ${platform}`);
    }
  }

  return release;
}

async function main() {
  try {
    log.header('GitHub Release Publisher');
    const config = require('../release-config');

    if (!config.github.enabled) {
      log.info('GitHub publishing is disabled in configuration');
      return;
    }

    const installerFiles = findInstallerFiles(config, { log });
    Object.entries(installerFiles).forEach(([platform, file]) => log.info(`  ${platform}: ${file}`));

    const release = await createGitHubRelease(config, installerFiles);
    if (release) {
      log.success(`Release URL: ${release.html_url}`);
    }
  } catch (error) {
    log.error(`GitHub publishing failed: ${error.message}`);
    log.info('Resume with: npm run release:finish');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createGitHubRelease };
