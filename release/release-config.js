#!/usr/bin/env node

/**
 * Release Configuration
 * This file contains all the information needed for a release.
 * Update this file before running the release script.
 */

module.exports = {
  // Version information
  version: "1.0.0",
  
  // Release notes in markdown format
  releaseNotes: `### Added
- Initial release of Stock Flow

### Improved / Changed

### Bug Fixes
`,


  // Platform-specific configurations
  platforms: {
    win32: {
      architecture: "x64",
      installerPath: "release/build", // Directory containing the installer
      installerPattern: "*setup*.exe", // Pattern to match installer file
      downloadUrlTemplate: "https://github.com/FMT-Software-solutions/stock-flow/releases/download/v{version}/stock-flow-setup-{version}.exe",
      fileSize: 85000000,
      status: "published", // 'draft' or 'published'
      isCritical: false, // Whether this is a critical update for this platform
      minimumVersion: "1.0.0", // Minimum version required before this update for this platform
    },
    darwin: {
      architecture: "x64",
      installerPath: "release/build", // Directory containing the installer
      installerPattern: "*.dmg", // Pattern to match installer file
      downloadUrlTemplate: "https://github.com/FMT-Software-solutions/stock-flow/releases/download/v{version}/stock-flow-{version}.dmg",
      fileSize: 90000000,
      status: "draft", // 'draft' or 'published'
      isCritical: false, // Whether this is a critical update for this platform
      minimumVersion: "1.0.0", // Minimum version required before this update for this platform
    },
    linux: {
      architecture: "x64",
      installerPath: "release/build", // Directory containing the installer
      installerPattern: "*.AppImage", // Pattern to match installer file
      downloadUrlTemplate: "https://github.com/FMT-Software-solutions/stock-flow/releases/download/v{version}/stock-flow-{version}.AppImage",
      fileSize: 80000000,
      status: "draft", // 'draft' or 'published'
      isCritical: false, // Whether this is a critical update for this platform
      minimumVersion: "1.0.0", // Minimum version required before this update for this platform
    }
  },

  // GitHub release configuration
  github: {
    enabled: true,
    createRelease: true,
    uploadAssets: true,
    token: process.env.GH_TOKEN,
    owner: 'FMT-Software-solutions',
    repo: 'stock-flow'
  },

  // Supabase publishing configuration
  supabase: {
    enabled: true,
    publish: true,
    edgeFunction: 'publish-release',
    url: process.env.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },

  // Build configuration
  build: {
    enabled: true, // Enabled for building and packaging
    skipBuild: false, // Run electron:build and build:electron commands
    skipPackage: false, // Enable packaging to use updated version
    cleanBefore: true // Clean build directory before building
  },

  // Git configuration
  git: {
    enabled: true,
    createCommit: true,
    createTag: true,
    pushChanges: true, // Set to true to automatically push
    commitMessage: "Release v1.0.0"
  },

  // Validation rules
  validation: {
    requireReleaseNotes: true,
    requireInstallerFiles: true,
    validateVersionFormat: true,
    checkVersionIncrement: true
  },

  // Additional metadata
  metadata: {
    appName: "stock-flow",
    description: "Inventory management system for businesses",
    author: "Shadrack Ankomahene",
    homepage: "https://fmtsoftware.com",
    supportEmail: "support@fmtsoftware.com"
  }
};