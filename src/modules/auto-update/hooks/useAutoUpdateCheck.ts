import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { UpdateCheckResult, AutoUpdateResult, DownloadProgress } from '@/types/electron.d';
import { useUpdateStore } from '../stores/updateStore';

export function useAutoUpdateCheck() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedOnStartup = useRef(false);
  const { 
    setHasUpdate, 
    setUpdateInfo, 
    setIsCheckingForUpdates, 
    setLastChecked,
    setIsDownloading,
    setDownloadProgress,
    setIsDownloadComplete
  } = useUpdateStore();



  const checkForUpdates = async (silent = true): Promise<UpdateCheckResult | null> => {
    if (!silent) {
      setIsCheckingForUpdates(true);
    }

    try {
      if (!window.electron?.checkForUpdates) {
        return null;
      }

      const result = await window.electron.checkForUpdates();
      setLastChecked(new Date());

      if (result.hasUpdate && result.latestVersion) {
        setHasUpdate(true);
        setUpdateInfo(result.latestVersion);
        
        // Check if update is already downloaded
        if (result.latestVersion.alreadyDownloaded) {
          setIsDownloadComplete(true);
          if (!silent) {
            toast.success('Update ready to install!', {
              description: `Version ${result.latestVersion.version} is ready to install.`,
            });
          }
        } else {
          // Automatically start download when update is detected
          if (window.electron?.downloadUpdateToTemp) {
            try {
              setIsDownloading(true);
              setDownloadProgress(null);
              
              // Extract filename from URL or use version info
              const url = new URL(result.latestVersion.download_url);
              const fileName = url.pathname.split('/').pop() || `stock-flow-${result.latestVersion.version}-Setup.exe`;
              
              await window.electron.downloadUpdateToTemp(
                result.latestVersion.download_url,
                fileName
              );
            } catch (error) {
              console.error('Failed to start automatic download:', error);
              setIsDownloading(false);
            }
          }
        }
        
        if (!silent) {
          toast.success('Update available!', {
            description: `Version ${result.latestVersion.version} is being downloaded automatically.`,
          });
        }
      } else {
        setHasUpdate(false);
        setUpdateInfo(null);
        
        if (!silent) {
          toast.info('No updates available', {
            description: 'You are running the latest version.',
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      
      if (!silent) {
        toast.error('Failed to check for updates', {
          description: 'Please try again later.',
        });
      }
      
      return null;
    } finally {
      if (!silent) {
        setIsCheckingForUpdates(false);
      }
    }
  };

  useEffect(() => {
    // Check for updates on app startup (only once)
    if (!hasCheckedOnStartup.current) {
      hasCheckedOnStartup.current = true;
      checkForUpdates(true); // Silent check on startup
    }

    // Set up periodic check every 4 hours
    intervalRef.current = setInterval(() => {
      checkForUpdates(true); // Silent periodic checks
    }, 4 * 60 * 60 * 1000); // 4 hours

    // Set up download event listeners
    const handleDownloadProgress = (progress: DownloadProgress) => {
      setIsDownloading(true);
      setDownloadProgress(progress);
    };

    const handleDownloadComplete = (result: AutoUpdateResult) => {
      setIsDownloading(false);
      setDownloadProgress(null);
      if (result.success) {
        setIsDownloadComplete(true);
        if (!result.alreadyDownloaded) {
          toast.success('Update downloaded successfully!', {
            description: 'Click "Install Updates" to install and restart.',
          });
        }
      } else {
        toast.error(`Download failed: ${result.error || 'Unknown error'}`);
      }
    };

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('download-progress', handleDownloadProgress);
      window.electron.ipcRenderer.on('download-complete', handleDownloadComplete);
    }

    // Cleanup interval and listeners on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.off('download-progress', handleDownloadProgress);
        window.electron.ipcRenderer.off('download-complete', handleDownloadComplete);
      }
    };
  }, []);

  return { checkForUpdates };
}