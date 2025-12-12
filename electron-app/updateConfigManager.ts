import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface UpdateConfig {
  lastChecked: string | null;
  currentVersion: string | null;
  availableUpdate: {
    version: string | null;
    downloadUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    checksum: string | null;
    releaseNotes: string | null;
  };
  downloadState: {
    isDownloaded: boolean;
    downloadPath: string | null;
    downloadedAt: string | null;
    verified: boolean;
  };
  installPreferences: {
    installOnClose: boolean;
    installOnNextLaunch: boolean;
    installNow: boolean;
    userDecisionPending: boolean;
  };
  cleanup: {
    needsCleanup: boolean;
    lastCleanup: string | null;
    filesToCleanup: string[];
  };
}

class UpdateConfigManager {
  private configPath: string;
  private config: UpdateConfig;

  constructor() {
    // Use app data directory for persistent config
    const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'stock-flow');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    this.configPath = path.join(appDataDir, 'update-config.json');
    this.config = this.loadConfig();
  }

  private getDefaultConfig(): UpdateConfig {
    return {
      lastChecked: null,
      currentVersion: null,
      availableUpdate: {
        version: null,
        downloadUrl: null,
        fileName: null,
        fileSize: null,
        checksum: null,
        releaseNotes: null
      },
      downloadState: {
        isDownloaded: false,
        downloadPath: null,
        downloadedAt: null,
        verified: false
      },
      installPreferences: {
        installOnClose: false,
        installOnNextLaunch: false,
        installNow: false,
        userDecisionPending: false
      },
      cleanup: {
        needsCleanup: false,
        lastCleanup: null,
        filesToCleanup: []
      }
    };
  }

  private loadConfig(): UpdateConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data);
        // Merge with default config to handle new fields
        return { ...this.getDefaultConfig(), ...config };
      }
    } catch (error) {
      console.error('Error loading update config:', error);
    }
    return this.getDefaultConfig();
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving update config:', error);
    }
  }

  // Update check methods
  setLastChecked(): void {
    this.config.lastChecked = new Date().toISOString();
    this.saveConfig();
  }

  setCurrentVersion(version: string): void {
    this.config.currentVersion = version;
    this.saveConfig();
  }

  setAvailableUpdate(updateInfo: {
    version: string;
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    checksum?: string;
    releaseNotes?: string;
  }): void {
    this.config.availableUpdate = {
      version: updateInfo.version,
      downloadUrl: updateInfo.downloadUrl,
      fileName: updateInfo.fileName,
      fileSize: updateInfo.fileSize,
      checksum: updateInfo.checksum || null,
      releaseNotes: updateInfo.releaseNotes || null
    };
    this.config.installPreferences.userDecisionPending = true;
    this.saveConfig();
  }

  clearAvailableUpdate(): void {
    this.config.availableUpdate = {
      version: null,
      downloadUrl: null,
      fileName: null,
      fileSize: null,
      checksum: null,
      releaseNotes: null
    };
    this.config.installPreferences.userDecisionPending = false;
    this.saveConfig();
  }

  // Download state methods
  setDownloadCompleted(downloadPath: string): void {
    this.config.downloadState = {
      isDownloaded: true,
      downloadPath,
      downloadedAt: new Date().toISOString(),
      verified: false
    };
    this.saveConfig();
  }

  setDownloadVerified(verified: boolean): void {
    this.config.downloadState.verified = verified;
    this.saveConfig();
  }

  clearDownloadState(): void {
    // Add old download path to cleanup list if it exists
    if (this.config.downloadState.downloadPath) {
      this.addToCleanupList(this.config.downloadState.downloadPath);
    }
    
    this.config.downloadState = {
      isDownloaded: false,
      downloadPath: null,
      downloadedAt: null,
      verified: false
    };
    this.saveConfig();
  }



  // Cleanup methods
  addToCleanupList(filePath: string): void {
    if (!this.config.cleanup.filesToCleanup.includes(filePath)) {
      this.config.cleanup.filesToCleanup.push(filePath);
      this.config.cleanup.needsCleanup = true;
      this.saveConfig();
    }
  }

  markCleanupCompleted(): void {
    this.config.cleanup = {
      needsCleanup: false,
      lastCleanup: new Date().toISOString(),
      filesToCleanup: []
    };
    this.saveConfig();
  }

  // Validation methods
  async validateDownloadedFile(): Promise<boolean> {
    if (!this.config.downloadState.isDownloaded || !this.config.downloadState.downloadPath) {
      return false;
    }

    try {
      // Check if file exists
      if (!fs.existsSync(this.config.downloadState.downloadPath)) {
        console.log('Downloaded file no longer exists, clearing download state');
        this.clearDownloadState();
        return false;
      }

      // Verify file size if available
      if (this.config.availableUpdate.fileSize) {
        const stats = fs.statSync(this.config.downloadState.downloadPath);
        if (stats.size !== this.config.availableUpdate.fileSize) {
          console.log('Downloaded file size mismatch, clearing download state');
          this.clearDownloadState();
          return false;
        }
      }

      // Verify checksum if available
      if (this.config.availableUpdate.checksum && !this.config.downloadState.verified) {
        const fileBuffer = fs.readFileSync(this.config.downloadState.downloadPath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        if (hash !== this.config.availableUpdate.checksum) {
          console.log('Downloaded file checksum mismatch, clearing download state');
          this.clearDownloadState();
          return false;
        }
        this.setDownloadVerified(true);
      }

      return true;
    } catch (error) {
      console.error('Error validating downloaded file:', error);
      this.clearDownloadState();
      return false;
    }
  }

  // Getter methods
  getConfig(): UpdateConfig {
    return { ...this.config };
  }

  hasAvailableUpdate(): boolean {
    return !!this.config.availableUpdate.version;
  }

  isUpdateDownloaded(): boolean {
    return this.config.downloadState.isDownloaded;
  }



  needsCleanup(): boolean {
    return this.config.cleanup.needsCleanup;
  }

  getFilesToCleanup(): string[] {
    return [...this.config.cleanup.filesToCleanup];
  }

  // Check if we should skip download for this version
  shouldSkipDownload(version: string): boolean {
    return this.config.availableUpdate.version === version && 
           this.config.downloadState.isDownloaded;
  }
}

export const updateConfigManager = new UpdateConfigManager();
export default updateConfigManager;