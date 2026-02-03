'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Check, Trash2, User, Heart, MessageCircle, Repeat, AtSign, Info, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/NotificationContext';

const notificationIcons = {
  follow: User,
  like: Heart,
  comment: MessageCircle,
  mention: AtSign,
  repost: Repeat,
  system: Info
};

type FilterType = 'all' | 'unread' | 'follow' | 'like' | 'comment';

export default function NotificationsPage() {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll 
  } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const getNotificationLink = (notification: any) => {
    const { data } = notification;
    if (data.postId) return `/post/${data.postId}`;
    if (data.userId) return `/user/${data.userId}`;
    return '#';
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="font-semibold">Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {(['all', 'unread', 'follow', 'like', 'comment'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === f 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'unread' && unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Notification List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No notifications</h2>
              <p className="text-muted-foreground">
                {filter === 'unread' 
                  ? 'You have no unread notifications' 
                  : 'You will see notifications here when you get them'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Bell;
                return (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      !notification.read 
                        ? 'bg-primary/5 border-primary/20' 
                        : 'bg-card border-border hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`p-3 rounded-full ${
                        notification.type === 'follow' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' :
                        notification.type === 'like' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' :
                        notification.type === 'comment' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' :
                        notification.type === 'mention' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300' :
                        notification.type === 'repost' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{notification.title}</p>
                            <p className="text-muted-foreground mt-1">{notification.message}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                              {formatTime(notification.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="p-2 hover:bg-red/10 rounded-lg transition-colors text-muted-foreground hover:text-red"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
