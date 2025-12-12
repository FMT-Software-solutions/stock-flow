import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type {
  AutoUpdateResult,
  DownloadProgress,
  PlatformInfo,
  UpdateCheckResult,
  VersionInfo,
} from '@/types/electron';
import { AlertCircle, CheckCircle, Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { useUpdateStore } from './stores/updateStore';
import { openExternalUrl } from '@/utils/external-url';

interface UpdateSettingsProps {
  className?: string;
}

export function UpdateSettings({ className }: UpdateSettingsProps) {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [lastCheckResult, setLastCheckResult] = useState<
    'success' | 'error' | 'no-update' | null
  >(null);
  // Use update store for coordination
  const {
    isCheckingForUpdates: storeIsChecking,
    setIsCheckingForUpdates: setStoreIsChecking,
    setUpdateInfo: setStoreUpdateInfo,
    setHasUpdate: setStoreHasUpdate,
    setLastChecked: setStoreLastChecked,
    isDownloading,
    downloadProgress,
    isInstalling,
    isDownloadComplete,
    setIsDownloading,
    setDownloadProgress,
    setIsInstalling,
    setIsDownloadComplete,
  } = useUpdateStore();

  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    // Get current app version
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((version: string) => {
        setCurrentVersion(version);
      });
    }

    // Load update configuration on mount
    loadUpdateConfig();

    // Auto-check for updates on component mount if enabled
    if (autoCheckEnabled) {
      checkForUpdates(true); // Silent check
    }

    // Set up periodic auto-check (every 4 hours)
    const interval = setInterval(() => {
      if (autoCheckEnabled) {
        checkForUpdates(true); // Silent check
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    return () => clearInterval(interval);
  }, [autoCheckEnabled]);

  // Load update configuration from persistent storage
  const loadUpdateConfig = useCallback(async () => {
    try {
      if (
        window.electron?.getUpdateConfig &&
        window.electron?.getPlatformInfo
      ) {
        const [config, platform] = await Promise.all([
          window.electron.getUpdateConfig(),
          window.electron.getPlatformInfo(),
        ]);

        setPlatformInfo(platform);

        // Set last checked time
        if (config.lastChecked) {
          setLastChecked(new Date(config.lastChecked));
        }

        // Set available update info
        if (config.availableUpdate.version) {
          setUpdateInfo({
            version: config.availableUpdate.version,
            download_url: config.availableUpdate.downloadUrl || '',
            file_size: config.availableUpdate.fileSize || 0,
            release_notes: config.availableUpdate.releaseNotes || '',
            created_at: new Date().toISOString(),
            platform: platform.platform,
            architecture: platform.architecture,
            status: 'published' as const,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load update config:', err);
    }
  }, []);

  // Listen for automatic download events
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
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

      window.electron.ipcRenderer.on(
        'download-progress',
        handleDownloadProgress
      );
      window.electron.ipcRenderer.on(
        'download-complete',
        handleDownloadComplete
      );

      return () => {
        window.electron?.ipcRenderer?.off(
          'download-progress',
          handleDownloadProgress
        );
        window.electron?.ipcRenderer?.off(
          'download-complete',
          handleDownloadComplete
        );
      };
    }
  }, []);

  const checkForUpdates = async (silent = false) => {
    if (!window.electron?.checkForUpdates) {
      if (!silent) {
        toast.error('Update checking is not available in this environment.');
      }
      return;
    }

    // Prevent redundant checks when download is in progress
    if (isDownloading || downloadProgress !== null) {
      if (!silent) {
        toast.info('Update check skipped - download already in progress.');
      }
      return;
    }

    setIsChecking(true);
    setStoreIsChecking(true);
    try {
      const result: UpdateCheckResult = await window.electron.checkForUpdates();
      setLastChecked(new Date());

      if (result.success && result.hasUpdate && result.latestVersion) {
        setUpdateInfo(result.latestVersion);
        setStoreUpdateInfo(result.latestVersion);
        setStoreHasUpdate(true);
        setLastCheckResult('success');

        if (!silent) {
          toast.success(
            `Version ${result.latestVersion.version} is now available for download.`
          );
        }
        // Note: Automatic download is now handled by useAutoUpdateCheck hook
      } else if (result.error) {
        setLastCheckResult('error');
        setStoreHasUpdate(false);
        if (!silent) {
          toast.error(`Failed to check for updates: ${result.error}`);
        }
      } else {
        setUpdateInfo(null);
        setStoreUpdateInfo(null);
        setStoreHasUpdate(false);
        setLastCheckResult('no-update');
        if (!silent) {
          toast.success(
            `You're running the latest version (${result.currentVersion}).`
          );
        }
      }
    } catch (error) {
      if (!silent) {
        toast.error('Failed to check for updates. Please try again later.');
      }
    } finally {
      setIsChecking(false);
      setStoreIsChecking(false);
      setStoreLastChecked(new Date());
    }
  };

  const installUpdate = async (versionInfo: VersionInfo) => {
    if (!window.electron?.installAndRestart) {
      toast.error('Update functionality is not available in this environment.');
      return;
    }

    setIsInstalling(true);

    try {
      // If download is already complete, proceed directly with installation
      if (isDownloadComplete) {
        toast.info('Installing update and restarting app...');

        const installResult = await window.electron.installAndRestart();
        if (installResult.success) {
          toast.success('Installing update and restarting...');
          // App will quit automatically
        } else {
          toast.error(
            `Installation failed: ${installResult.error || 'Unknown error'}`
          );
          setIsInstalling(false);
        }
        return;
      }

      // If download is not complete, start download first
      if (!window.electron?.downloadUpdateToTemp) {
        toast.error('Download functionality is not available.');
        setIsInstalling(false);
        return;
      }

      setIsDownloading(true);
      setDownloadProgress(null);

      // Set up progress listener for manual download
      const handleDownloadProgress = (progress: DownloadProgress) => {
        setDownloadProgress(progress);
      };

      // Set up completion listener for manual download
      const handleDownloadComplete = async (result: AutoUpdateResult) => {
        // Clean up listeners
        window.electron?.ipcRenderer?.off(
          'download-progress',
          handleDownloadProgress
        );
        window.electron?.ipcRenderer?.off(
          'download-complete',
          handleDownloadComplete
        );

        setIsDownloading(false);
        setDownloadProgress(null);

        if (result.success && result.downloadPath) {
          toast.success(
            'Download complete! Installing update and restarting app...'
          );

          // Immediately proceed with installation
          try {
            const installResult = await window.electron!.installAndRestart(
              result.downloadPath
            );
            if (installResult.success) {
              toast.success('Installing update and restarting...');
              // App will quit automatically
            } else {
              toast.error(
                `Installation failed: ${installResult.error || 'Unknown error'}`
              );
              setIsInstalling(false);
            }
          } catch (installError) {
            console.error('Install error:', installError);
            toast.error('An error occurred while installing the update.');
            setIsInstalling(false);
          }
        } else {
          toast.error(`Download failed: ${result.error || 'Unknown error'}`);
          setIsInstalling(false);
        }
      };

      window.electron.ipcRenderer.on(
        'download-progress',
        handleDownloadProgress
      );
      window.electron.ipcRenderer.on(
        'download-complete',
        handleDownloadComplete
      );

      // Extract filename from URL or use version info
      const url = new URL(versionInfo.download_url);
      const fileName =
        url.pathname.split('/').pop() ||
        `stock-flow-${versionInfo.version}-Setup.exe`;

      toast.info('Starting update download...');

      const result: AutoUpdateResult = await window.electron.downloadUpdateToTemp(
        versionInfo.download_url,
        fileName
      );

      // Check if download started successfully
      if (!result.success) {
        // Clean up listeners if download failed to start
        window.electron.ipcRenderer.off(
          'download-progress',
          handleDownloadProgress
        );
        window.electron.ipcRenderer.off(
          'download-complete',
          handleDownloadComplete
        );
        setIsDownloading(false);
        setDownloadProgress(null);
        setIsInstalling(false);
        toast.error(
          `Failed to start download: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Update error:', error);
      setIsDownloading(false);
      setDownloadProgress(null);
      setIsInstalling(false);
      toast.error('An error occurred while starting the update.');
    }
  };

  const cancelDownload = async () => {
    if (!window.electron?.cancelDownload) {
      return;
    }

    try {
      await window.electron.cancelDownload();
      setIsDownloading(false);
      setDownloadProgress(null);

      toast.info('Download cancelled.');
    } catch (error) {
      console.error('Cancel download error:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatLastChecked = () => {
    if (!lastChecked) return 'Never';
    return lastChecked.toLocaleString();
  };

  const formatReleaseDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card className={cn('border-none shadow-none p-0', className)}>
      <CardContent className="space-y-6">
        {/* Update Available Alert */}
        {updateInfo && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    Version {updateInfo.version} is available
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {formatFileSize(updateInfo.file_size)}
                  </Badge>
                </div>

                {updateInfo.release_notes && (
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-2">What's new:</p>
                    <ScrollArea className="h-32 w-full rounded border bg-white dark:bg-gray-950 p-3">
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-headings:font-semibold prose-h3:text-sm prose-h3:mb-1 prose-h3:mt-3 prose-h3:first:mt-0 prose-ul:my-1 prose-li:my-0.5 prose-p:my-1">
                        <ReactMarkdown
                          components={{
                            h3: ({ children }) => (
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 mt-3 first:mt-0">
                                {children}
                              </h3>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside space-y-0.5 my-1">
                                {children}
                              </ul>
                            ),
                            li: ({ children }) => (
                              <li className="text-xs leading-relaxed">
                                {children}
                              </li>
                            ),
                          }}
                        >
                          {updateInfo.release_notes}
                        </ReactMarkdown>
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Download Progress */}
                {downloadProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Downloading update...</span>
                      <span>{Math.round(downloadProgress.percent)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress.percent}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {formatFileSize(downloadProgress.bytesReceived)} /{' '}
                        {formatFileSize(downloadProgress.totalBytes)}
                      </span>
                      <span>{formatFileSize(downloadProgress.speed)}/s</span>
                    </div>
                  </div>
                )}

                {/* Install Section */}
                <div className="flex items-center space-x-2">
                  {/* Show different buttons based on Linux installation type */}
                  {platformInfo?.platform === 'linux' &&
                  platformInfo.installType === 'package' ? (
                    <Button
                      onClick={() => {
                        const downloadUrl = import.meta.env.VITE_DOWNLOADS_PAGE_URL || '';
                        if (downloadUrl) {
                          openExternalUrl(downloadUrl);
                        }
                      }}
                      className={cn(
                        'h-9 px-3',
                        'bg-blue-600 text-primary-foreground hover:bg-blue-700'
                      )}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download from Website
                    </Button>
                  ) : (
                    <Button
                      onClick={() => installUpdate(updateInfo)}
                      disabled={
                        isDownloading ||
                        downloadProgress !== null ||
                        isInstalling
                      }
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isInstalling ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Installing...
                        </>
                      ) : isDownloading || downloadProgress ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          {downloadProgress
                            ? 'Downloading...'
                            : 'Starting Download...'}
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          {isDownloadComplete
                            ? 'Install Updates'
                            : 'Download & Install Updates'}
                        </>
                      )}
                    </Button>
                  )}

                  {(isDownloading || downloadProgress) &&
                    platformInfo?.installType !== 'package' && (
                      <Button
                        onClick={cancelDownload}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Version</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {currentVersion || '1.0.0'}
              </span>
              {!updateInfo && (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600"
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Up to date
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Checked</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {formatLastChecked()}
              </span>
              {lastCheckResult && (
                <div className="flex items-center">
                  {lastCheckResult === 'success' && (
                    <Badge
                      variant="outline"
                      className="text-blue-600 border-blue-600"
                    >
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Update Available
                    </Badge>
                  )}
                  {lastCheckResult === 'no-update' && (
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600"
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Up to Date
                    </Badge>
                  )}
                  {lastCheckResult === 'error' && (
                    <Badge
                      variant="outline"
                      className="text-red-600 border-red-600"
                    >
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Check Failed
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {updateInfo && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Latest Version</span>
              <span className="text-sm text-muted-foreground">
                {updateInfo.version} ({formatReleaseDate(updateInfo.created_at)}
                )
              </span>
            </div>
          )}
        </div>

        {/* Auto-check Setting */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-check" className="text-sm font-medium">
              Automatic Updates
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically check for updates
            </p>
          </div>
          <Switch
            id="auto-check"
            checked={autoCheckEnabled}
            onCheckedChange={setAutoCheckEnabled}
          />
        </div>

        {/* Manual Check Button */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => checkForUpdates(false)}
            disabled={
              isChecking ||
              storeIsChecking ||
              isDownloading ||
              downloadProgress !== null
            }
            variant="outline"
            size="sm"
          >
            {isChecking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check for Updates
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-500">
          {autoCheckEnabled
            ? 'Updates are automatically checked when the app is running.'
            : 'Automatic update checking is disabled. Use the button above to check manually.'}
        </div>
      </CardContent>
    </Card>
  );
}
