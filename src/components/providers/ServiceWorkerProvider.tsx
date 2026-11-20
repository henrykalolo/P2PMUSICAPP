'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NotificationProvider } from '@/context/NotificationContext';

interface ServiceWorkerContextType {
  isSupported: boolean;
  isRegistered: boolean;
  registration: ServiceWorkerRegistration | null;
  cacheTrack: (trackId: string, url: string) => Promise<void>;
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
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    setIsSupported(true);

    let cancelled = false;
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (cancelled) return;
        setRegistration(reg);
        setIsRegistered(true);
      })
      .catch((error: unknown) => {
        console.error('[SW] Service Worker registration failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sendMessage = useCallback(
    async <T,>(type: string, data?: unknown): Promise<T> => {
      if (!registration?.active) throw new Error('Service Worker not active');

      return new Promise<T>((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = window.setTimeout(() => {
          channel.port1.close();
          reject(new Error('Service Worker did not respond'));
        }, 10_000);

        channel.port1.onmessage = (event: MessageEvent<T & { success?: boolean; error?: string }>) => {
          window.clearTimeout(timeout);
          channel.port1.close();
          if (event.data && event.data.success === false) {
            reject(new Error(event.data.error || 'Service Worker request failed'));
            return;
          }
          resolve(event.data as T);
        };

        registration.active!.postMessage({ type, data }, [channel.port2]);
      });
    },
    [registration]
  );

  const cacheTrack = useCallback(
    async (trackId: string, url: string) => {
      await sendMessage('CACHE_TRACK', { trackId, url });
    },
    [sendMessage]
  );

  const clearCache = useCallback(async () => {
    await sendMessage('CLEAR_CACHE');
  }, [sendMessage]);

  return (
    <ServiceWorkerContext.Provider
      value={{ isSupported, isRegistered, registration, cacheTrack, clearCache }}
    >
      <NotificationProvider>{children}</NotificationProvider>
    </ServiceWorkerContext.Provider>
  );
};

export default ServiceWorkerProvider;
