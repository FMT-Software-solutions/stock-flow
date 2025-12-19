import { config } from 'dotenv';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import { generateUpdateFileName, getPlatformInfo, getVisibleInstallerArgsWithRestart } from './platformUtils';
import updateConfigManager from './updateConfigManager';

// Disable sandbox for AppImage to avoid SUID errors
app.commandLine.appendSwitch('no-sandbox');

// Check if running in development
const isDev = !app.isPackaged;

let supabaseConfig: {
  SUPABASE_URL?: string,
  SUPABASE_ANON_KEY?: string
} = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};

// 1. Load from .env in dev
if (process.env.NODE_ENV === "development" || isDev) {
  // Load .env first, then .env.local (which takes precedence)
  // In development, __dirname points to electron-app/, so we need to go up one more level
  const projectRoot = path.join(__dirname, '../..');
  const envPath = path.join(projectRoot, '.env');
  const envLocalPath = path.join(projectRoot, '.env.local');
  
  config({ path: envPath }); // loads .env
  config({ path: envLocalPath }); // loads .env.local (overrides .env)
  
  supabaseConfig = {
    SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  };
  
  // Log environment status for development monitoring
  console.log('📦 Environment loaded:', {
    SUPABASE_URL: supabaseConfig.SUPABASE_URL ? '✅' : '❌',
    SUPABASE_ANON_KEY: supabaseConfig.SUPABASE_ANON_KEY ? '✅' : '❌'
  });
} else {
  // 2. Load from config.json in packaged app
  const configPath = path.join((process as any).resourcesPath, "config.json");
  supabaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │
// ├─┬ electron-app/dist
// │ ├── main.js
// │ └── preload.js
// │
const DIST_PATH = app.isPackaged 
  ? path.join(__dirname, '../dist')
  : path.join(__dirname, '../../dist')
const PUBLIC_PATH = app.isPackaged 
  ? path.join((process as any).resourcesPath , 'app', 'public')
  : path.join(__dirname, '../../public')

// Set environment variables
process.env.DIST = DIST_PATH
process.env.PUBLIC = PUBLIC_PATH

// Pass environment variables to renderer process
process.env.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || ''
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

let win: any = null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// Auto-update state
let currentDownload: any = null
let downloadProgress: any = null





// Helper function to get temporary download directory
function getTempDownloadPath(): string {
  const tempDir = app.isPackaged 
    ? path.join(os.tmpdir(), 'stock-flow-updates')
    : path.join(__dirname, '../../temp-updates')
  
  // Ensure directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  
  return tempDir
}





// Helper function to clean up specific file and its directory if empty
function cleanupFileAndDirectory(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      const directory = path.dirname(filePath);
      fs.unlinkSync(filePath);
      console.log('Cleaned up file:', filePath);
      
      // Try to remove directory if it's empty
      try {
        const files = fs.readdirSync(directory);
        if (files.length === 0) {
          fs.rmdirSync(directory);
          console.log('Cleaned up empty directory:', directory);
        }
      } catch (dirError) {
        // Directory not empty or other error, ignore
      }
    }
  } catch (error) {
    console.log('Error cleaning up file and directory:', error);
  }
}

// Helper function to download file with progress tracking
function downloadFileWithProgress(url: string, filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath)
    let lastProgressUpdate = 0
    const PROGRESS_THROTTLE_MS = 100 // Throttle progress updates to every 100ms
    
    const request = https.get(url, (response: any) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          file.destroy()
          fs.unlinkSync(filePath)
          downloadFileWithProgress(redirectUrl, filePath).then(resolve).catch(reject)
          return
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }
      
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      let receivedBytes = 0
      const startTime = Date.now()
      
      downloadProgress = {
        percent: 0,
        bytesReceived: 0,
        totalBytes,
        speed: 0
      }
      
      response.on('data', (chunk: any) => {
        receivedBytes += chunk.length
        const now = Date.now()
        const elapsed = (now - startTime) / 1000
        const speed = elapsed > 0 ? receivedBytes / elapsed : 0
        
        // Throttle progress updates to prevent UI freezing
        if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS || receivedBytes === totalBytes) {
          downloadProgress = {
            percent: totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0,
            bytesReceived: receivedBytes,
            totalBytes,
            speed
          }
          
          // Send progress to renderer if window exists
          if (win && !win.isDestroyed()) {
            win.webContents.send('download-progress', downloadProgress)
          }
          
          lastProgressUpdate = now
        }
      })
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        downloadProgress = null
        resolve({ success: true, downloadPath: filePath })
      })
      
      file.on('error', (err: any) => {
        fs.unlink(filePath, () => {}) // Delete partial file
        downloadProgress = null
        reject(err)
      })
    })
    
    request.on('error', (err: any) => {
      downloadProgress = null
      reject(err)
    })
    
    currentDownload = request
  })
}

// Function to register IPC handlers after environment is loaded
function registerIPCHandlers() {
  // Update system IPC handlers
  ipcMain.handle('check-for-updates', async () => {
    try {
      const currentVersion = app.getVersion();
      
      const supabaseKey = (supabaseConfig as any).SUPABASE_ANON_KEY;
      const supabaseUrl = (supabaseConfig as any).SUPABASE_URL;
      
      if (!supabaseKey) {
        console.error('❌ Supabase API key not configured');
        return { success: false, error: 'Supabase API key not configured' };
      }
      
      if (!supabaseUrl) {
        console.error('❌ Supabase URL not configured');
        return { success: false, error: 'Supabase URL not configured' };
      }
      
      console.log('Checking for updates with version:', currentVersion);
      
      // Update current version in config
      updateConfigManager.setCurrentVersion(currentVersion);
      updateConfigManager.setLastChecked();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/check-updates`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: process.platform,
          currentVersion: currentVersion
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as any;
      console.log('Update check result:', result);
      
      // If update is available, store it in config
      if (result.success && result.updateAvailable && result.downloadUrl) {
        updateConfigManager.setAvailableUpdate({
          version: result.version,
          downloadUrl: result.downloadUrl,
          fileName: result.fileName || generateUpdateFileName(result.version),
          fileSize: result.fileSize || 0,
          checksum: result.checksum,
          releaseNotes: result.releaseNotes
        });
        
        // Check if we already have this version downloaded
        const isAlreadyDownloaded = await updateConfigManager.validateDownloadedFile();
        
        return {
          ...result,
          alreadyDownloaded: isAlreadyDownloaded
        };
      } else if (result.success && !result.updateAvailable) {
        // Clear any existing update info if no update is available
        updateConfigManager.clearAvailableUpdate();
      }
      
      return result;
    } catch (error) {
      console.error('Update check failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('download-update', async (_: any, downloadUrl: string) => {
    try {
      await shell.openExternal(downloadUrl);
      return { success: true };
    } catch (error) {
      console.error('Download failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  // Auto-update IPC handlers
  ipcMain.handle('download-update-to-temp', async (_: any, downloadUrl?: string, fileName?: string) => {
    try {
      if (currentDownload) {
        return { success: false, error: 'Download already in progress' };
      }
      
      const config = updateConfigManager.getConfig();
      
      // Use config values if not provided
      const actualDownloadUrl = downloadUrl || config.availableUpdate.downloadUrl;
      const actualFileName = fileName || config.availableUpdate.fileName;
      
      if (!actualDownloadUrl || !actualFileName) {
        return { success: false, error: 'No download information available' };
      }
      
      // Check if we already have this version downloaded and validated
      const isAlreadyDownloaded = await updateConfigManager.validateDownloadedFile();
      if (isAlreadyDownloaded && config.downloadState.downloadPath) {
        console.log('Update already downloaded and validated:', config.downloadState.downloadPath);
        if (win && !win.isDestroyed()) {
          win.webContents.send('download-complete', { 
            success: true, 
            downloadPath: config.downloadState.downloadPath,
            alreadyDownloaded: true 
          });
        }
        return { success: true, message: 'Update already downloaded', alreadyDownloaded: true };
      }
      
      const tempDir = getTempDownloadPath();
      const filePath = path.join(tempDir, actualFileName);
      
      console.log('Starting download to:', filePath);
      
      // Start download asynchronously without blocking
      downloadFileWithProgress(actualDownloadUrl, filePath)
        .then((result) => {
          if (result.success) {
            // Update config with download completion
            updateConfigManager.setDownloadCompleted(filePath);
            console.log('Download completed:', filePath);
            
            // Validate the downloaded file
            updateConfigManager.validateDownloadedFile().then((isValid) => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('download-complete', { 
                  success: true, 
                  downloadPath: filePath,
                  verified: isValid
                });
              }
            });
          } else {
            console.error('Download failed:', result.error);
            if (win && !win.isDestroyed()) {
              win.webContents.send('download-complete', { success: false, error: result.error });
            }
          }
          currentDownload = null;
        })
        .catch((error) => {
          console.error('Auto-update download failed:', error);
          currentDownload = null;
          downloadProgress = null;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          if (win && !win.isDestroyed()) {
            win.webContents.send('download-complete', { success: false, error: errorMessage });
          }
        });
      
      // Return immediately to indicate download started
      return { success: true, message: 'Download started in background' };
    } catch (error) {
      console.error('Failed to start download:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('get-download-progress', async () => {
    return downloadProgress;
  });

  ipcMain.handle('cancel-download', async () => {
    try {
      if (currentDownload) {
        currentDownload.destroy();
        currentDownload = null;
        downloadProgress = null;
        
        // Clear download state in config
        updateConfigManager.clearDownloadState();
      }
      return { success: true };
    } catch (error) {
      console.error('Cancel download failed:', error);
      return { success: false };
    }
  });

  ipcMain.handle('install-and-restart', async (_: any, downloadPath?: string) => {
    try {
      const config = updateConfigManager.getConfig();
      const actualDownloadPath = downloadPath || config.downloadState.downloadPath;
      
      if (!actualDownloadPath || !fs.existsSync(actualDownloadPath)) {
        return { success: false, error: 'Downloaded file not found' };
      }
      
      console.log('Installing update from:', actualDownloadPath);
      
      // Mark for cleanup after installation
      updateConfigManager.addToCleanupList(actualDownloadPath);
      
      // Use visible installation for all platforms
      if (process.platform === 'win32') {
        const { spawn } = require('child_process');
        
        // Use visible installer arguments with restart functionality
        const platformInfo = getPlatformInfo();
        const finalArgs = getVisibleInstallerArgsWithRestart(platformInfo.platform, process.execPath);
        
        // Run the installer with visible UI and restart functionality
        const installer = spawn(actualDownloadPath, finalArgs, {
          detached: true,
          stdio: 'ignore'
        });
        
        installer.unref();
        
        // Clear update state after starting installation
        setTimeout(() => {
          updateConfigManager.clearAvailableUpdate();
          updateConfigManager.clearDownloadState();
        }, 1000);
        
        // Give the installer a moment to start, then quit the app
        setTimeout(() => {
          app.quit();
        }, 1500);
        
        return { success: true };
      } else if (process.platform === "linux") {
        // actualDownloadPath is the downloaded AppImage
        console.log('Launching new AppImage:', actualDownloadPath);

        // Make sure it is executable
        try {
          fs.chmodSync(actualDownloadPath, 0o755);
        } catch (e) {
          console.error('Failed to set executable permission:', e);
        }

        // Launch the new AppImage
        await shell.openPath(actualDownloadPath);

        // Clear update state
        updateConfigManager.clearAvailableUpdate();
        updateConfigManager.clearDownloadState();

        //mark the old image for deletion
        updateConfigManager.addToCleanupList(process.execPath);

        // Quit current app
        app.quit();

        return { success: true };
      } else {
        // For non-Windows platforms, open the installer
        await shell.openPath(actualDownloadPath);
        
        // Clear update state
        updateConfigManager.clearAvailableUpdate();
        updateConfigManager.clearDownloadState();
        
        app.quit();
        return { success: true };
      }
    } catch (error) {
      console.error('Install and restart failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });





  // Get update configuration
  ipcMain.handle('get-update-config', async () => {
    return updateConfigManager.getConfig();
  });

  // Get platform information
  ipcMain.handle('get-platform-info', async () => {
    return getPlatformInfo();
  });

  // Open external URL in browser
  ipcMain.handle('open-external', async (_: any, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Failed to open external URL:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}



function createWindow() {
  // Determine icon path based on platform
  const iconPath = path.join(app.isPackaged ? PUBLIC_PATH : path.join(__dirname, '../../public'), 
    process.platform === 'win32' ? 'favicon.ico' : 'icon.png')

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools:  !app.isPackaged, // Enable devTools only in development
      plugins: true, // Enable plugins for PDF viewer
    },
  })

  // Hide menu bar and disable context menu for main window
  win.setMenuBarVisibility(false)
  win.setMenu(null)

  // Handle new window creation (for print windows, etc.)
  win.webContents.setWindowOpenHandler(() => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        icon: iconPath, // Use the same icon as main window
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          devTools: false, // Always disable devTools for new windows
        },
        autoHideMenuBar: true,
        menuBarVisible: false,
        titleBarStyle: 'default',
      }
    }
  })

  // Handle new window creation event to further customize
  win.webContents.on('did-create-window', (childWindow: BrowserWindow) => {
    // Ensure menu is hidden for all new windows
    childWindow.setMenuBarVisibility(false)
    childWindow.setMenu(null)
    
    // Disable context menu for new windows
    childWindow.webContents.on('context-menu', (event) => {
      event.preventDefault()
    })
  })

  // Open DevTools in detached mode for debugging
  if(!app.isPackaged) {
    win?.webContents.openDevTools({mode: "detach"})
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // Load the index.html when not in development
    try {
      const indexPath = path.join(DIST_PATH, 'index.html')
      console.log('Loading index.html from:', indexPath)
      
      // Check if the file exists before loading
      if (fs.existsSync(indexPath)) {
        console.log('index.html exists, loading file...')
        win.loadFile(indexPath)
      } else {
        console.error('index.html does not exist at path:', indexPath)
        console.log('Directory contents:', fs.readdirSync(DIST_PATH))
        
        // Try to load from a different location as fallback
        const fallbackPath = path.join(__dirname, '../../dist/index.html')
        if (fs.existsSync(fallbackPath)) {
          console.log('Found index.html at fallback path, loading:', fallbackPath)
          win.loadFile(fallbackPath)
        } else {
          console.error('No index.html found at fallback path either')
          win.webContents.loadFile(path.join(__dirname, 'error.html'))
        }
      }
    } catch (error) {
      console.error('Error loading index.html:', error)
    }
  }
}

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up temporary files when app is quitting
app.on('before-quit', async () => {
  console.log('App is quitting, performing cleanup...');
  
  // Perform cleanup if needed
  if (updateConfigManager.needsCleanup()) {
    const filesToCleanup = updateConfigManager.getFilesToCleanup();
    for (const filePath of filesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          cleanupFileAndDirectory(filePath);
        }
      } catch (error) {
        console.error('Failed to cleanup file:', filePath, error);
      }
    }
    updateConfigManager.markCleanupCompleted();
  }
})

app.whenReady().then(async () => {
  // Validate any existing downloads on startup
  if (updateConfigManager.hasAvailableUpdate() && updateConfigManager.isUpdateDownloaded()) {
    console.log('Validating existing download on startup...');
    const isValid = await updateConfigManager.validateDownloadedFile();
    if (!isValid) {
      console.log('Existing download is invalid, will need to redownload');
    }
  }
  
  // Perform cleanup if needed
  if (updateConfigManager.needsCleanup()) {
    console.log('Performing startup cleanup...');
    const filesToCleanup = updateConfigManager.getFilesToCleanup();
    for (const filePath of filesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          cleanupFileAndDirectory(filePath);
        }
      } catch (error) {
        console.error('Failed to cleanup file:', filePath, error);
      }
    }
    updateConfigManager.markCleanupCompleted();
  }
  
  // Register IPC handlers
  registerIPCHandlers()
  createWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})