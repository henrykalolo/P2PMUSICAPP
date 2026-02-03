'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'mention' | 'repost' | 'system';
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isConnected: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLLING_INTERVAL = 30000; // 30 seconds
const SSE_RECONNECT_INTERVAL = 5000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/notifications', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const headers = getAuthHeaders();
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ notificationId })
      });

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [getAuthHeaders]);

  const markAllAsRead = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ markAllRead: true })
      });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [getAuthHeaders]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const headers = getAuthHeaders();
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
        headers
      });

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [getAuthHeaders, notifications]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Setup SSE for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const connectSSE = () => {
      try {
        const eventSource = new EventSource(`/api/notifications/sse?token=${token}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'notification') {
              const newNotification = data.notification as Notification;
              setNotifications(prev => [newNotification, ...prev]);
              setUnreadCount(prev => prev + 1);
            }
          } catch (error) {
            console.error('Failed to parse SSE message:', error);
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource.close();
          // Fall back to polling
          pollingTimeoutRef.current = setTimeout(connectSSE, SSE_RECONNECT_INTERVAL);
        };
      } catch (error) {
        console.error('Failed to connect to SSE:', error);
        // Fall back to polling
        pollingTimeoutRef.current = setTimeout(fetchNotifications, POLLING_INTERVAL);
      }
    };

    connectSSE();

    // Initial fetch
    fetchNotifications();

    // Fallback polling
    const startPolling = () => {
      pollingTimeoutRef.current = setInterval(fetchNotifications, POLLING_INTERVAL);
    };

    startPolling();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        clearInterval(pollingTimeoutRef.current);
      }
    };
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        isConnected,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
