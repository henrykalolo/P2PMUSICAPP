'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  ListMusic,
  LogOut,
  Menu,
  Music,
  PlusSquare,
  Moon,
  Search,
  Settings,
  Sun,
  TrendingUp,
  User,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useNotifications } from '@/context/NotificationContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';

interface NavbarProps {
  onTogglePrimarySidebar: () => void;
  onToggleSecondarySidebar: () => void;
}

const navItems = [
  { href: '/feed', label: 'Feed', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/upload', label: 'Upload', icon: PlusSquare },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
];

export default function Navbar({ onTogglePrimarySidebar, onToggleSecondarySidebar }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, setAuthenticated } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { isConnected: isNotificationConnected } = useNotifications();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsSearchOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAuthenticated(false);
    router.push('/');
    router.refresh();
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    setIsSearchOpen(false);
    router.push(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <header className="sticky top-0 z-50 h-16 w-full shrink-0 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-full max-w-[1800px] items-center gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={onTogglePrimarySidebar}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
          <span className="rounded-lg bg-primary p-1.5 text-primary-foreground">
            <Music className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">P2P Music</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 xl:flex" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div
            className={`hidden items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium sm:flex ${
              isOnline && isNotificationConnected
                ? 'bg-green-500/10 text-green-500'
                : 'bg-amber-500/10 text-amber-500'
            }`}
            title={isOnline && isNotificationConnected ? 'Connected' : 'Reconnecting'}
          >
            {isOnline && isNotificationConnected ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden lg:inline">
              {isOnline && isNotificationConnected ? 'Online' : 'Offline'}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen((open) => !open)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            aria-label={isSearchOpen ? 'Close search' : 'Search'}
            aria-expanded={isSearchOpen}
          >
            {isSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>

          {user && <NotificationBell />}

          <button
            type="button"
            onClick={onToggleSecondarySidebar}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground xl:hidden"
            aria-label="Open trends"
          >
            <TrendingUp className="h-5 w-5" />
          </button>

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent/10"
                aria-label="Open user menu"
                aria-expanded={isUserMenuOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/25 to-accent/25">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </span>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  <div className="border-b border-border p-4">
                    <p className="truncate font-medium">{user.username}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-sm text-primary">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Trust: {user.trustScore ?? 0}
                    </div>
                  </div>
                  <div className="p-2">
                    <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/10" href="/profile" onClick={() => setIsUserMenuOpen(false)}>
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/10" href="/liked" onClick={() => setIsUserMenuOpen(false)}>
                      <Heart className="h-4 w-4" /> Liked
                    </Link>
                    <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/10" href="/playlists" onClick={() => setIsUserMenuOpen(false)}>
                      <ListMusic className="h-4 w-4" /> Playlists
                    </Link>
                    <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/10" href="/analytics" onClick={() => setIsUserMenuOpen(false)}>
                      <BarChart3 className="h-4 w-4" /> Analytics
                    </Link>
                    <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/10" href="/notifications" onClick={() => setIsUserMenuOpen(false)}>
                      <Bell className="h-4 w-4" /> Notifications
                    </Link>
                    <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/10" href="/profile/settings" onClick={() => setIsUserMenuOpen(false)}>
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    {isAdmin && (
                      <Link className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent/10" href="/admin" onClick={() => setIsUserMenuOpen(false)}>
                        <LayoutDashboard className="h-4 w-4" /> Admin
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-border p-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {isSearchOpen && (
        <form
          onSubmit={handleSearch}
          className="absolute inset-x-0 top-full border-b border-border bg-background p-3 shadow-lg sm:p-4"
        >
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tracks, artists, users..."
              aria-label="Search tracks, artists, users"
              className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>
      )}
    </header>
  );
}
