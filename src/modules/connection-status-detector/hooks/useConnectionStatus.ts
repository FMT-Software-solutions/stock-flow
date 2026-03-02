import { useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';

// Helper to check if window is available (client-side)
const isBrowser = typeof window !== 'undefined';

export function useConnectionStatus() {
  const { isConnected, setConnectionStatus } = useConnectionStore();

  // Active ping check function - this is more reliable than navigator.onLine
  const checkServerConnection = async () => {
    if (!isBrowser) return true;

    try {
      // Try to fetch a small resource from a reliable CDN with a cache-busting parameter
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const timestamp = new Date().getTime();
      // Use Google favicon as a reliable, small, and fast endpoint for connection checking
      await fetch(`https://www.google.com/favicon.ico?_=${timestamp}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      setConnectionStatus(true);
      return true;
    } catch {
      setConnectionStatus(false);
      return false;
    }
  };

  useEffect(() => {
    if (!isBrowser) return;

    // Initial connection check
    checkServerConnection();

    // Set up interval to check connection status every 10 seconds
    const pingInterval = setInterval(() => {
      checkServerConnection();
    }, 10000);

    // Handle online/offline events
    const handleOnline = () => checkServerConnection();
    const handleOffline = () => setConnectionStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setConnectionStatus]);

  return isConnected;
} 