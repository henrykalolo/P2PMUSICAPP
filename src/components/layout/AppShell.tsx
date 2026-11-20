'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Compass,
  Heart,
  Home,
  PlusSquare,
  X,
} from 'lucide-react';
import Navbar from '@/components/ui/Navbar';
import { GlobalAudioPlayer } from '@/components/player/GlobalAudioPlayer';
import NavigationSidebar from '@/components/layout/NavigationSidebar';
import {
  LeftSidebarExtras,
  RightSidebarExtras,
} from '@/components/layout/SidebarExtras';
import { useAuthStore } from '@/store/useAuthStore';

function SidebarSection({ side }: { side: 'left' | 'right' }) {
  return (
    <div className="space-y-6 p-5">
      {side === 'left' ? (
        <>
          <NavigationSidebar />
          <LeftSidebarExtras />
        </>
      ) : (
        <RightSidebarExtras />
      )}
    </div>
  );
}

function MobileDrawer({
  side,
  open,
  onClose,
}: {
  side: 'left' | 'right';
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] xl:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close sidebar"
      />
      <aside
        className={`absolute inset-y-0 flex w-[min(88vw,22rem)] flex-col border-border bg-background shadow-2xl ${
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="font-semibold">
            {side === 'left' ? 'Navigation' : 'Trends'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarSection side={side} />
        </div>
      </aside>
    </div>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const items = [
    { href: '/feed', label: 'Feed', icon: Home },
    { href: '/discover', label: 'Discover', icon: Compass },
    { href: '/upload', label: 'Upload', icon: PlusSquare, authOnly: true },
    { href: '/notifications', label: 'Alerts', icon: Bell, authOnly: true },
    { href: user ? '/profile' : '/login', label: user ? 'Profile' : 'Sign in', icon: user ? Heart : Home },
  ].filter((item) => !item.authOnly || isAuthenticated);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[60] flex h-16 items-stretch justify-around border-t border-border bg-background/95 px-2 backdrop-blur md:hidden"
      aria-label="Mobile navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.ok ? await response.json() : null;
        if (!active) return;
        if (data?.user) {
          setUser(data.user);
          setAuthenticated(true);
        } else {
          localStorage.removeItem('token');
          setUser(null);
          setAuthenticated(false);
        }
      } catch {
        if (!active) return;
        setUser(null);
        setAuthenticated(false);
      } finally {
        if (active) setLoading(false);
      }
    };

    hydrate();
    return () => {
      active = false;
    };
  }, [setAuthenticated, setLoading, setUser]);

  useEffect(() => {
    setPrimaryOpen(false);
    setSecondaryOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPrimaryOpen(false);
        setSecondaryOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen h-dvh flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Navbar
        onTogglePrimarySidebar={() => {
          setSecondaryOpen(false);
          setPrimaryOpen((open) => !open);
        }}
        onToggleSecondarySidebar={() => {
          setPrimaryOpen(false);
          setSecondaryOpen((open) => !open);
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="hidden w-64 shrink-0 overflow-y-auto border-r border-border/60 bg-background lg:block app-scrollbar"
          aria-label="Primary sidebar"
        >
          <SidebarSection side="left" />
        </aside>

        <main
          id="main-content"
          tabIndex={-1}
          className="app-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-16 outline-none md:pb-0"
        >
          {children}
        </main>

        <aside
          className="hidden w-80 shrink-0 overflow-y-auto border-l border-border/60 bg-background xl:block app-scrollbar"
          aria-label="Trends sidebar"
        >
          <SidebarSection side="right" />
        </aside>
      </div>

      <MobileDrawer side="left" open={primaryOpen} onClose={() => setPrimaryOpen(false)} />
      <MobileDrawer side="right" open={secondaryOpen} onClose={() => setSecondaryOpen(false)} />
      <MobileBottomNav />
      <GlobalAudioPlayer />
    </div>
  );
}
