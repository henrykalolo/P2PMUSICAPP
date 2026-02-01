'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface ServiceWorkerContextType {
  isSupported: boolean;
  isRegistered: boolean;
  registration: ServiceWorkerRegistration | null;
  startSeeding: (infoHash: string) => Promise<void>;
  stopSeeding: (infoHash: string) => Promise<void>;
  cacheTrack: (trackId: string, url: string) => Promise<void>;
  getSeedingStatus: () => Promise<{ infoHash: string; active: boolean }[]>;
  clearCache: () => Promise<void>;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | null>(null);

export const useServiceWorker = () => {
  const context = useContext(ServiceWorkerContext);
  if (!context) {
    throw new Error('useServiceWorker must be used within ServiceWorkerProvider');
  }
  return context;
};

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

export const ServiceWorkerProvider: React.FC<ServiceWorkerProviderProps> = ({ children }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if service workers are supported
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[SW] Service workers not supported');
      return;
    }

    setIsSupported(true);

    // Register service worker
    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('[SW] Service Worker registered:', reg);
        setRegistration(reg);
        setIsRegistered(true);

        // Handle updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version available');
                // Could show update notification here
              }
            });
          }
        });
      } catch (error) {
        console.error('[SW] Service Worker registration failed:', error);
      }
    };

    registerSW();

    // Listen for messages from service worker
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'START_SEEDING_REQUEST':
          console.log('[SW] Request to start seeding:', data.infoHash);
          // This would be handled by the WebTorrent integration
          break;
        case 'STOP_SEEDING_REQUEST':
          console.log('[SW] Request to stop seeding:', data.infoHash);
          // This would be handled by the WebTorrent integration
          break;
        default:
          console.log('[SW] Message from SW:', type, data);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  const sendMessage = useCallback(async <T,>(type: string, data?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!registration?.active) {
        reject(new Error('Service Worker not active'));
        return;
      }

      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data as T);
      };

      registration.active.postMessage(
        { type, data },
        [channel.port2]
      );
    });
  }, [registration]);

  const startSeeding = useCallback(async (infoHash: string) => {
    await sendMessage('START_SEEDING', { infoHash });
  }, [sendMessage]);

  const stopSeeding = useCallback(async (infoHash: string) => {
    await sendMessage('STOP_SEEDING', { infoHash });
  }, [sendMessage]);

  const cacheTrack = useCallback(async (trackId: string, url: string) => {
    await sendMessage('CACHE_TRACK', { trackId, url });
  }, [sendMessage]);

  const getSeedingStatus = useCallback(async () => {
    return sendMessage<{ infoHash: string; active: boolean }[]>('GET_SEEDING_STATUS');
  }, [sendMessage]);

  const clearCache = useCallback(async () => {
    await sendMessage('CLEAR_CACHE');
  }, [sendMessage]);

  // Request background sync permission
  const requestBackgroundSync = useCallback(async () => {
    if (!registration || !('sync' in registration)) {
      console.log('[SW] Background Sync not supported');
      return false;
    }

    try {
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('background-seed');
      console.log('[SW] Background sync registered');
      return true;
    } catch (error) {
      console.error('[SW] Background sync registration failed:', error);
      return false;
    }
  }, [registration]);

  const value: ServiceWorkerContextType = {
    isSupported,
    isRegistered,
    registration,
    startSeeding,
    stopSeeding,
    cacheTrack,
    getSeedingStatus,
    clearCache,
  };

  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
    </ServiceWorkerContext.Provider>
  );
};

export default ServiceWorkerProvider;
