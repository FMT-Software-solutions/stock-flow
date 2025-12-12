# stock-flow Release Process

This directory contains the automated release system for stock-flow Electron application.

## Overview

The release system is configuration-driven and handles:

- Version management and validation
- Release configuration management
- Publishing release information to Supabase
- GitHub release creation
- Automatic update checking within the app

**Note**: Building and packaging are done manually before running the release script to ensure proper testing.

## Quick Start

### Prerequisites

1. **Environment Variables**: Create a `.env.local` or `.env` file in the project root with:

   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. **Dependencies**: Install required packages:
   ```bash
   npm install
   ```

### Creating a Release

1. **Update the release configuration**:

   - Edit `release/release-config.js`
   - Update the `version` field (e.g., "1.0.1")
   - Update the `releaseNotes` with your changes
   - Verify platform configurations and installer paths

2. **Run the release script**:

   npm `npm run release`

   ```bash
   # Windows (Command Prompt)
   release\scripts\release.bat

   # Windows (PowerShell)
   release\scripts\release.ps1

   # Unix/Linux/macOS
   release/scripts/release.sh
   ```

3. **The script will**:
    - Validate the configuration and environment
    - Update package.json version
    - Update CHANGELOG.md
    - Build the application (electron:build and build:electron)
    - Package the Electron application with the updated version
    - Create Git commit and tag
    - Create GitHub release (if enabled)
    - Publish to Supabase (if enabled)

### Managing Releases

Use the release manifest utility to manage releases:

```bash
# View current releases
node release/scripts/release-manifest.js status

# Update a release status
node release/scripts/release-manifest.js update-status 1.0.1 published

# Add a new release manually
node release/scripts/release-manifest.js add 1.0.1 "Bug fixes and improvements"
```

### Publishing Releases

Releases are initially created as drafts in Supabase. To make them available for auto-updates:

1. **Update status to published**:

   ```bash
   node release/scripts/release-manifest.js update-status 1.0.1 published
   ```

2. **Or update directly in Supabase**:
   ```sql
   UPDATE app_versions
   SET status = 'published'
   WHERE version = '1.0.1';
   ```

## File Structure

```
release/
├── README.md                 # This file
├── RELEASE_NOTES.md         # Template for release notes
├── release-manifest.json    # Local release tracking
├── assets/
│   └── icon.svg            # Application icon
└── scripts/
    ├── release.js          # Main release script
    ├── release.bat         # Windows batch script
    ├── release.ps1         # PowerShell script
    ├── release.sh          # Unix shell script
    ├── publish-supabase.js # Supabase publishing
    └── release-manifest.js # Manifest management
```

## Update Checking

The application includes automatic update checking:

- **Automatic**: Checks every 4 hours when enabled
- **Manual**: Users can check via Settings > Software Updates
- **Notifications**: Shows update notifications with download options

### How It Works

1. App queries Supabase for published versions
2. Compares current version with latest available
3. Shows update notification if newer version exists
4. Downloads open in default browser
5. Users manually install and restart

## Configuration

### Release Configuration

The release process is controlled by `release/release-config.js`. Key sections:

- **version**: The version number for the release (e.g., "1.0.1")
- **releaseNotes**: Markdown-formatted release notes
- **platforms**: Platform-specific installer paths and patterns
- **github**: GitHub release settings (enabled/disabled)
- **supabase**: Supabase publishing settings (enabled/disabled)
- **build**: Build configuration (disabled by default for manual builds)
- **git**: Git commit and tag settings
- **validation**: Validation rules for releases

### Electron Builder

Configuration is in `electron-builder.yml`:

- Output directory: `dist-electron`
- Supported platforms: Windows, macOS, Linux
- Package formats: NSIS (Windows), DMG (macOS), AppImage (Linux)

### Version Comparison

Uses semantic versioning (semver) for version comparison:

- Format: `MAJOR.MINOR.PATCH`
- Example: `1.0.0` < `1.0.1` < `1.1.0` < `2.0.0`

## Troubleshooting

### Common Issues

1. **Environment variables not loaded**:

   - Ensure `.env` file exists in project root
   - Check variable names match exactly

2. **Supabase connection failed**:

   - Verify URL and API key are correct
   - Check network connectivity
   - Ensure RLS policies allow access

3. **Build failures**:

   - Build and package manually before running release script
   - Run `npm run build` and `npm run package` to check for errors
   - Ensure all dependencies are installed
   - Check Node.js version compatibility
   - Test the packaged application thoroughly

4. **Version conflicts**:
   - Ensure version doesn't already exist
   - Use semantic versioning format
   - Check Git working directory is clean

### Debug Mode

Run scripts with debug output:

```bash
DEBUG=1 node release/scripts/release.js
```

## Security Notes

- API keys should never be committed to version control
- Use environment variables for sensitive configuration
- RLS policies restrict database access appropriately
- Downloads should be served over HTTPS

## Support

For issues with the release process:

1. Check this README for common solutions
2. Review script output for error messages
3. Verify environment configuration
4. Check Supabase logs for API errors
