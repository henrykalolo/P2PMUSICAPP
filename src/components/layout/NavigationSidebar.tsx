'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BookOpen,
  Compass,
  Disc3,
  Heart,
  Home,
  LayoutDashboard,
  ListMusic,
  MessageCircle,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  TrendingUp,
  Upload,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  authOnly?: boolean;
  adminOnly?: boolean;
}

const primaryLinks: NavLink[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/feed', label: 'Feed', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/upload', label: 'Upload', icon: Upload, authOnly: true },
  { href: '/albums', label: 'Releases', icon: Disc3, authOnly: true },
  { href: '/playlists', label: 'Playlists', icon: ListMusic },
  { href: '/liked', label: 'Liked', icon: Heart, authOnly: true },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, authOnly: true },
];

const accountLinks: NavLink[] = [
  { href: '/messages', label: 'Messages', icon: MessageCircle, authOnly: true },
  { href: '/notifications', label: 'Notifications', icon: Bell, authOnly: true },
  { href: '/profile', label: 'Profile', icon: User, authOnly: true },
  { href: '/profile/settings', label: 'Settings', icon: Settings, authOnly: true },
  { href: '/admin', label: 'Admin', icon: LayoutDashboard, adminOnly: true },
];

const resourceLinks: NavLink[] = [
  { href: '/docs', label: 'Documentation', icon: BookOpen },
  { href: '/docs/security', label: 'Security', icon: ShieldCheck },
  { href: '/privacy', label: 'Privacy', icon: Shield },
  { href: '/dmca', label: 'DMCA', icon: Scale },
];

function NavGroup({ title, links }: { title: string; links: NavLink[] }) {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();

  const visibleLinks = links.filter((link) => {
    if (link.adminOnly) {
      return isAuthenticated && (user?.role === 'admin' || user?.role === 'superadmin');
    }
    if (link.authOnly) return isAuthenticated;
    return true;
  });

  if (visibleLinks.length === 0) return null;

  return (
    <div>
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <nav className="space-y-1" aria-label={title}>
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const active = link.href === '/'
            ? pathname === '/'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function NavigationSidebar() {
  return (
    <div className="space-y-6">
      <NavGroup title="Explore" links={primaryLinks} />
      <NavGroup title="Your account" links={accountLinks} />
      <NavGroup title="Resources" links={resourceLinks} />
    </div>
  );
}

export default NavigationSidebar;
