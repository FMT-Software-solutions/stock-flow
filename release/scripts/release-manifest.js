#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
  step: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`),
};

function getManifestPath() {
  return path.join(process.cwd(), 'release', 'release-manifest.json');
}

function loadManifest() {
  const manifestPath = getManifestPath();
  
  if (!fs.existsSync(manifestPath)) {
    return { releases: [] };
  }
  
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse manifest: ${error.message}`);
  }
}

function saveManifest(manifest) {
  const manifestPath = getManifestPath();
  const manifestDir = path.dirname(manifestPath);
  
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function showStatus() {
  try {
    log.header('📋 Release Manifest Status');
    
    const manifest = loadManifest();
    
    if (!manifest.releases || manifest.releases.length === 0) {
      log.info('No releases found in manifest');
      return;
    }
    
    log.info(`Total releases: ${manifest.releases.length}`);
    log.info('');
    
    manifest.releases.forEach((release, index) => {
      const isLatest = index === 0;
      const status = release.status || 'unknown';
      const statusColor = status === 'published' ? colors.green : 
                         status === 'draft' ? colors.yellow : colors.red;
      
      console.log(`${isLatest ? '→' : ' '} ${colors.bright}v${release.version}${colors.reset}`);
      console.log(`   Platform: ${release.platform} (${release.architecture})`);
      console.log(`   Status: ${statusColor}${status}${colors.reset}`);
      console.log(`   Size: ${formatFileSize(release.file_size)}`);
      console.log(`   Created: ${new Date(release.created_at).toLocaleString()}`);
      if (release.download_url) {
        console.log(`   URL: ${release.download_url}`);
      }
      console.log('');
    });
    
  } catch (error) {
    log.error(`Failed to show status: ${error.message}`);
    process.exit(1);
  }
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

function initializeManifest() {
  try {
    log.header('🚀 Initializing Release Manifest');
    
    const manifestPath = getManifestPath();
    
    if (fs.existsSync(manifestPath)) {
      log.warning('Manifest already exists');
      return;
    }
    
    const initialManifest = {
      releases: [],
      metadata: {
        created: new Date().toISOString(),
        project: 'stock-flow',
      description: 'Release manifest for stock-flow application',
      },
    };
    
    saveManifest(initialManifest);
    log.success('Release manifest initialized');
    
  } catch (error) {
    log.error(`Failed to initialize manifest: ${error.message}`);
    process.exit(1);
  }
}

function addRelease(version, platform, architecture, downloadUrl, fileSize, releaseNotes) {
  try {
    log.header('➕ Adding Release to Manifest');
    
    const manifest = loadManifest();
    
    // Check if release already exists
    const existingRelease = manifest.releases.find(r => 
      r.version === version && 
      r.platform === platform && 
      r.architecture === architecture
    );
    
    if (existingRelease) {
      log.warning(`Release ${version} for ${platform}-${architecture} already exists`);
      return;
    }
    
    const newRelease = {
      version,
      platform,
      architecture,
      download_url: downloadUrl,
      file_size: parseInt(fileSize),
      release_notes: releaseNotes,
      status: 'draft',
      created_at: new Date().toISOString(),
    };
    
    manifest.releases.unshift(newRelease);
    saveManifest(manifest);
    
    log.success(`Added release ${version} for ${platform}-${architecture}`);
    
  } catch (error) {
    log.error(`Failed to add release: ${error.message}`);
    process.exit(1);
  }
}

function updateReleaseStatus(version, platform, architecture, status) {
  try {
    log.header('📝 Updating Release Status');
    
    const manifest = loadManifest();
    
    const release = manifest.releases.find(r => 
      r.version === version && 
      r.platform === platform && 
      r.architecture === architecture
    );
    
    if (!release) {
      throw new Error(`Release ${version} for ${platform}-${architecture} not found`);
    }
    
    release.status = status;
    release.updated_at = new Date().toISOString();
    
    if (status === 'published') {
      release.published_at = new Date().toISOString();
    }
    
    saveManifest(manifest);
    
    log.success(`Updated release ${version} status to ${status}`);
    
  } catch (error) {
    log.error(`Failed to update release status: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'status':
      showStatus();
      break;
      
    case 'init':
      initializeManifest();
      break;
      
    case 'add':
      if (args.length < 7) {
        log.error('Usage: add <version> <platform> <architecture> <downloadUrl> <fileSize> <releaseNotes>');
        process.exit(1);
      }
      addRelease(args[1], args[2], args[3], args[4], args[5], args[6]);
      break;
      
    case 'update-status':
      if (args.length < 5) {
        log.error('Usage: update-status <version> <platform> <architecture> <status>');
        process.exit(1);
      }
      updateReleaseStatus(args[1], args[2], args[3], args[4]);
      break;
      
    default:
      log.info('Available commands:');
      log.info('  status                                    - Show manifest status');
      log.info('  init                                      - Initialize manifest');
      log.info('  add <version> <platform> <arch> <url> <size> <notes> - Add release');
      log.info('  update-status <version> <platform> <arch> <status>   - Update status');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadManifest,
  saveManifest,
  showStatus,
  initializeManifest,
  addRelease,
  updateReleaseStatus,
};