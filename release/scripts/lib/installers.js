/**
 * The one place that locates packaged installers.
 *
 * This used to be copy-pasted into release.js and publish-github.js, and both
 * copies carried the same two bugs that made every release "unable to find the
 * packaged file":
 *
 *  1. The glob pattern was built with path.join(), which uses backslashes on
 *     Windows — and glob v9+ treats a backslash as an ESCAPE character, not a
 *     separator. The pattern matched nothing, every time, on the only platform
 *     this app is actually built on.
 *
 *  2. It took files[0] of an UNSORTED match list. release/build accumulates
 *     one setup exe per past release, so even a working glob could hand the
 *     1.2.0 installer to the 1.2.2 release.
 *
 * Patterns are therefore normalised to forward slashes (glob's own documented
 * fix), and a match MUST name the version being released.
 *
 * That last rule is not fussiness. The published download URL embeds the
 * version (…/v1.2.2/stock-flow-setup-1.2.2.exe), and the asset is uploaded
 * under its own filename — so shipping 1.2.1's exe inside the v1.2.2 release
 * produces a release whose download link 404s for every user the updater sends
 * there. Better to stop the release than to publish a dead link.
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

/** glob understands forward slashes on every platform; backslashes on none. */
function toGlobPath(...segments) {
  return path.join(...segments).split(path.sep).join('/');
}

/**
 * The installer for this platform AND this version, or null.
 *
 * Deliberately refuses to fall back to "the newest exe lying around": that is
 * how a stale build gets uploaded under a new version's name. Newest-first
 * ordering only breaks ties among files that all name the right version.
 */
function findInstallerFile(platformConfig, version, { log } = {}) {
  const searchPath = path.join(process.cwd(), platformConfig.installerPath);
  if (!fs.existsSync(searchPath)) return null;

  const pattern = toGlobPath(searchPath, platformConfig.installerPattern);
  const matches = glob.sync(pattern, { windowsPathsNoEscape: true });
  if (matches.length === 0) return null;

  const forVersion = matches
    .filter((file) => path.basename(file).includes(version))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (forVersion.length === 0) {
    if (log) {
      log.warning(
        `Found ${matches.length} installer(s) in ${platformConfig.installerPath}, but none for version ${version} ` +
          `(${matches.map((f) => path.basename(f)).join(', ')}). Package first.`
      );
    }
    return null;
  }
  return forVersion[0];
}

/**
 * Guards the one mistake that silently ships a broken release: an asset whose
 * filename doesn't match the filename in the download URL users are given.
 * Returns a list of problems, empty when everything lines up.
 */
function validateDownloadUrls(config, installerFiles) {
  const problems = [];
  Object.entries(installerFiles).forEach(([platform, filePath]) => {
    const template = config.platforms[platform]?.downloadUrlTemplate;
    if (!template) return;
    const url = template.replaceAll('{version}', config.version);
    const expected = decodeURIComponent(url.split('/').pop());
    const actual = path.basename(filePath);
    if (expected !== actual) {
      problems.push(
        `${platform}: the release will publish ${url}, but the asset is named "${actual}". ` +
          `Users would get a 404. Expected "${expected}".`
      );
    }
  });
  return problems;
}

/**
 * Installer path per platform for the version in `config`, shaped the way the
 * existing callers expect: { win32: 'C:/...exe', ... }. Platforms with no
 * match are simply absent.
 */
function findInstallerFiles(config, { log } = {}) {
  const installerFiles = {};
  Object.keys(config.platforms).forEach((platform) => {
    const file = findInstallerFile(config.platforms[platform], config.version, {
      log,
    });
    if (file) installerFiles[platform] = file;
  });
  return installerFiles;
}

module.exports = {
  findInstallerFile,
  findInstallerFiles,
  validateDownloadUrls,
  toGlobPath,
};
