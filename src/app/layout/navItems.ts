import {
  Bell,
  Contact,
  House,
  ListChecks,
  Search,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: `nav.${'home' | 'search' | 'reminders' | 'tasks' | 'groups' | 'starred' | 'contacts' | 'settings'}`;
  /** Shown in the mobile bottom tab bar (ui §6.3). */
  mobileTab?: boolean;
  badge?: 'reminders';
}

export const navItems: NavItem[] = [
  { to: '/', icon: House, labelKey: 'nav.home', mobileTab: true },
  { to: '/search', icon: Search, labelKey: 'nav.search', mobileTab: true },
  { to: '/reminders', icon: Bell, labelKey: 'nav.reminders', mobileTab: true, badge: 'reminders' },
  { to: '/tasks', icon: ListChecks, labelKey: 'nav.tasks' },
  { to: '/groups', icon: Users, labelKey: 'nav.groups' },
  { to: '/starred', icon: Star, labelKey: 'nav.starred' },
  { to: '/contacts', icon: Contact, labelKey: 'nav.contacts', mobileTab: true },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];
