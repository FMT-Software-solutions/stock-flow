#!/usr/bin/env node

/**
 * Release Configuration
 * This file contains all the information needed for a release.
 * Update this file before running the release script.
 */

module.exports = {
  // Version information
  version: "1.1.7",

  // Release notes in markdown format
  releaseNotes: `### What's New
- **Add a product on one screen** — name, price, photo, stock for each branch, and options like size or colour with their own prices and stock. Create categories and options right there without leaving the form.
- **Products without stock** — restaurants and service businesses can sell items without managing inventory. Choose the default in Settings › Organization.
- **Stock on the product page** — see stock for every variant in every branch, receive deliveries, count stock, or record damaged items with a reason.
- **Stock history** — every stock change is recorded with its reason, the sale it came from, and who made it.
- **New discounts** — automatic or code discounts on items or the whole sale (percentage, amount off or fixed price), for all products, categories or chosen products, with schedules, usage and per-customer limits, minimum spend, and rules for combining. Cashiers with permission can give a manual discount. Discounts show on receipts and sale details.
- **Redesigned reports** — reports grouped into Sales, Stock, Expenses and People with one filter bar. New Product Sales, Stock Activity and Discounts reports; Stock on hand brings products and inventory together.

### Improvements
- The sale item picker lists products with their variants and the stock in your branch
- Sales are saved in one step and can't sell more stock than you have
- Stock value uses variant prices, and sales reports show discounts

### Bug Fixes
- The dashboard's All Time option now shows all your data
- Products that don't track stock no longer show as out of stock
- Dark theme colours for notices, badges and payment statuses
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
    commitMessage: "Release v{version}"
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