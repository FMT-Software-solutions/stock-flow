#!/usr/bin/env node
/**
 * Publishes the release to the fmtsoftware.com marketplace (Sanity):
 *   - adds { version, date, notes, download link, size } to the top of the
 *     app's `releases` list (replacing an entry with the same version)
 *   - points the Windows download button at the new installer
 *
 * Runs after the GitHub upload is verified, so the site never links to an
 * installer that isn't there. Safe to rerun.
 *
 *   npm run publish:sanity                 # publish release-config.js's version
 *   npm run publish:sanity -- --check      # only check the token can write
 *
 * Needs SANITY_WRITE_TOKEN (an Editor token for the FMT Sanity project) in
 * .env.local.
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const envLocalPath = path.join(__dirname, '../../.env.local');
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath, quiet: true });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath, quiet: true });
}

const releaseConfig = require('../release-config');
const { findInstallerFiles } = require('./lib/installers');

const colors = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m', bright: '\x1b[1m' };
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`),
};

const API_VERSION = 'v2024-03-13';
const KEEP_RELEASES = 30;

function settings(config = releaseConfig) {
  const sanity = config.sanity || {};
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!sanity.projectId || !sanity.dataset || !sanity.productId) {
    throw new Error('release-config.js sanity needs projectId, dataset and productId');
  }
  if (!token) throw new Error('SANITY_WRITE_TOKEN is not set in .env.local');
  const base = `https://${sanity.projectId}.api.sanity.io/${API_VERSION}/data`;
  return { ...sanity, token, base };
}

async function sanityFetch(s, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body?.error?.description || body?.message || response.statusText;
    throw new Error(`Sanity ${response.status}: ${reason}`);
  }
  return body;
}

const mutate = (s, mutations, { dryRun = false } = {}) =>
  sanityFetch(s, `${s.base}/mutate/${s.dataset}?returnIds=true${dryRun ? '&dryRun=true' : ''}`, {
    method: 'POST',
    body: JSON.stringify({ mutations }),
  });

async function getDocs(s) {
  const query = encodeURIComponent('*[_id in $ids]{ _id, title, releases }');
  const ids = encodeURIComponent(JSON.stringify([s.productId, `drafts.${s.productId}`]));
  const { result } = await sanityFetch(s, `${s.base}/query/${s.dataset}?query=${query}&$ids=${ids}&perspective=raw`);
  return result || [];
}

/** Fails fast (before a long build) when the token can't write to the product. */
async function verifySanityAccess(config = releaseConfig) {
  const s = settings(config);
  const docs = await getDocs(s);
  if (!docs.some((d) => d._id === s.productId)) {
    throw new Error(`Sanity product ${s.productId} not found (is it published?)`);
  }
  await mutate(s, [{ patch: { id: s.productId, setIfMissing: { releases: [] } } }], { dryRun: true });
  return docs.find((d) => d._id === s.productId).title;
}

async function publishToSanity(version) {
  const config = releaseConfig;
  const targetVersion = version || config.version;
  const s = settings(config);
  log.header('📤 Publishing to the marketplace (Sanity)');

  const windows = config.platforms.win32;
  const downloadUrl = windows.downloadUrlTemplate.replaceAll('{version}', targetVersion);
  const installers = findInstallerFiles({ ...config, version: targetVersion });
  const fileSize = installers.win32 ? fs.statSync(installers.win32).size : windows.fileSize || null;

  const entry = {
    _key: randomUUID().replace(/-/g, '').slice(0, 12),
    _type: 'appRelease',
    version: targetVersion,
    releaseDate: new Date().toISOString(),
    notes: (config.releaseNotes || '').trim(),
    downloadUrl,
    fileSize,
  };

  // Patch the published document, and the Studio draft too if one is open,
  // so publishing that draft later doesn't roll the release back.
  const docs = await getDocs(s);
  if (!docs.some((d) => d._id === s.productId)) throw new Error(`Sanity product ${s.productId} not found`);

  const mutations = docs.map((doc) => {
    const existing = (doc.releases || []).find((r) => r.version === targetVersion);
    const rest = (doc.releases || []).filter((r) => r.version !== targetVersion);
    // Keep the original date (and key) when republishing the same version.
    const release = existing ? { ...entry, _key: existing._key, releaseDate: existing.releaseDate || entry.releaseDate } : entry;
    return {
      patch: {
        id: doc._id,
        set: {
          releases: [release, ...rest].slice(0, KEEP_RELEASES),
          'platforms.desktop.windows.available': true,
          'platforms.desktop.windows.downloadUrl': downloadUrl,
        },
      },
    };
  });

  await mutate(s, mutations);
  const title = docs.find((d) => d._id === s.productId)?.title ?? s.productId;
  log.success(`${title} v${targetVersion} is on the marketplace${docs.length > 1 ? ' (draft updated too)' : ''}`);
  log.info(`  Download: ${downloadUrl}${fileSize ? ` (${(fileSize / 1048576).toFixed(1)} MB)` : ''}`);
}

async function main() {
  try {
    if (process.argv.includes('--check')) {
      const title = await verifySanityAccess();
      log.success(`SANITY_WRITE_TOKEN can update ${title}`);
      return;
    }
    await publishToSanity();
  } catch (error) {
    log.error(`Sanity publishing failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { publishToSanity, verifySanityAccess };
