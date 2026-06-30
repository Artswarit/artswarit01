import {
  LayoutDashboard,
  Palette,
  Briefcase,
  MessageSquare,
  Crown,
  Settings,
  ShoppingBag,
  FileText,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for top-level dashboard tabs.
 * Consumed by both the desktop TabsList (ArtistDashboard / ClientDashboard)
 * and the mobile bottom nav (DashboardMobileNav).
 *
 * When adding/removing a top-level tab, edit ONLY this file — desktop and
 * mobile stay in sync automatically.
 */
export interface DashboardTab {
  value: string;
  /** Full label used by the desktop tab bar. */
  label: string;
  /** Short label used by narrow desktop breakpoints. */
  shortLabel: string;
  /** Ultra-short label used by the mobile bottom nav (≤6 chars ideal). */
  mobileLabel: string;
  icon: LucideIcon;
}

export const artistDashboardTabs: readonly DashboardTab[] = [
  { value: 'overview',   label: 'Overview',   shortLabel: 'Home',  mobileLabel: 'Home',     icon: LayoutDashboard },
  { value: 'portfolio',  label: 'My Works',   shortLabel: 'Works', mobileLabel: 'Works',    icon: Palette },
  { value: 'projects',   label: 'Projects',   shortLabel: 'Proj',  mobileLabel: 'Projects', icon: Briefcase },
  { value: 'messages',   label: 'Messages',   shortLabel: 'Msg',   mobileLabel: 'Messages', icon: MessageSquare },
  { value: 'membership', label: 'Membership', shortLabel: 'Pro',   mobileLabel: 'Pro',      icon: Crown },
  { value: 'account',    label: 'Account',    shortLabel: 'Acc',   mobileLabel: 'Account',  icon: Settings },
] as const;

export const clientDashboardTabs: readonly DashboardTab[] = [
  { value: 'overview',   label: 'Overview', shortLabel: 'Home',  mobileLabel: 'Home',     icon: LayoutDashboard },
  { value: 'collection', label: 'My Works', shortLabel: 'Works', mobileLabel: 'Works',    icon: ShoppingBag },
  { value: 'projects',   label: 'Projects', shortLabel: 'Proj',  mobileLabel: 'Projects', icon: FileText },
  { value: 'messages',   label: 'Messages', shortLabel: 'Msg',   mobileLabel: 'Messages', icon: MessageSquare },
  { value: 'artists',    label: 'Artists',  shortLabel: 'Art',   mobileLabel: 'Artists',  icon: Users },
  { value: 'account',    label: 'Account',  shortLabel: 'Acc',   mobileLabel: 'Account',  icon: Settings },
] as const;

export const getDashboardTabs = (role: 'artist' | 'client'): readonly DashboardTab[] =>
  role === 'artist' ? artistDashboardTabs : clientDashboardTabs;
