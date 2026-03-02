#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
const envLocalPath = path.join(__dirname, '../../.env.local');
const envPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('Warning: No .env.local or .env file found');
}
// Load release configuration
const releaseConfig = require('../release-config');

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

function validateEnvironment() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL environment variable is required');
  }
  
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for publishing');
  }

  return { supabaseUrl, supabaseServiceKey };
}

function validateReleaseData(config) {
  const errors = [];
  
  if (!config.version) {
    errors.push('Version is required');
  }
  
  if (!config.releaseNotes) {
    errors.push('Release notes are required');
  }
  
  if (!config.supabase.enabled) {
    errors.push('Supabase publishing is not enabled in configuration');
  }
  
  if (!config.supabase.edgeFunction) {
    errors.push('Edge function name is required');
  }
  
  return errors;
}

async function callEdgeFunction(config, releaseData) {
  const { supabaseUrl, supabaseServiceKey } = validateEnvironment();
  
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/${config.supabase.edgeFunction}`;
  
  log.step(`Calling Edge Function: ${config.supabase.edgeFunction}`);
  
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'x-client-info': 'food-track-pro-release-script'
    },
    body: JSON.stringify(releaseData)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edge Function call failed (${response.status}): ${errorText}`);
  }
  
  const result = await response.json();
  return result;
}

async function publishToSupabase(version, releaseNotes) {
  try {
    log.header('📤 Publishing to Supabase via Edge Function');
    
    // Use provided parameters or fall back to config
    const config = releaseConfig;
    const targetVersion = version || config.version;
    const targetReleaseNotes = releaseNotes || config.releaseNotes;
    
    // Validate configuration
    const validationErrors = validateReleaseData(config);
    if (validationErrors.length > 0) {
      log.error('Configuration validation failed:');
      validationErrors.forEach(error => log.error(`  - ${error}`));
      throw new Error('Invalid configuration');
    }
    
    log.info(`Publishing version ${targetVersion}...`);
    
    // Prepare platforms array for Edge Function
    const platforms = [];
    Object.entries(config.platforms).forEach(([platformName, platformConfig]) => {
      platforms.push({
        platform: platformName,
        architecture: platformConfig.architecture,
        download_url: platformConfig.downloadUrlTemplate.replaceAll('{version}', targetVersion),
        file_size: platformConfig.fileSize || 0,
        status: platformConfig.status || 'published',
        is_critical: platformConfig.isCritical || false,
        minimum_version: platformConfig.minimumVersion || null
      });
      log.info(`  - ${platformName} (${platformConfig.architecture}) [${platformConfig.status || 'published'}]`);
    });
    
    // Prepare release data for Edge Function
    const releaseData = {
      version: targetVersion,
      release_notes: targetReleaseNotes,
      platforms: platforms 
    };
    
    // Call the Edge Function
    const result = await callEdgeFunction(config, releaseData);
    
    if (result.success) {
      log.success(`Version ${targetVersion} published successfully`);
      
      if (result.data) {
        if (result.data.created) {
          log.info(`Created new release record with ID: ${result.data.id}`);
        } else {
          log.info(`Updated existing release record with ID: ${result.data.id}`);
        }
        
        if (result.data.status) {
          log.info(`Release status: ${result.data.status}`);
        }
      }
      
      if (result.message) {
        log.info(result.message);
      }
    } else {
      throw new Error(result.error || 'Unknown error from Edge Function');
    }
    
    log.success('Release published to Supabase successfully');
    
  } catch (error) {
    log.error(`Failed to publish to Supabase: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    // When run as standalone script, use config from release-config.js
    await publishToSupabase();
    log.success('Publishing completed successfully');
  } catch (error) {
    log.error(`Publishing failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  publishToSupabase,
  validateEnvironment,
  validateReleaseData,
  callEdgeFunction
};