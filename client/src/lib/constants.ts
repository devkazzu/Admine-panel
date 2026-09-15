/**
 * Navigation structure, status metadata and shared option lists.
 * Sidebar entries are permission-filtered at render time.
 */
import {
  LayoutDashboard, Home, User, FolderGit2, Youtube, Share2, Mail,
  Gamepad2, Users, CalendarClock, Flag, Trophy, Medal, Newspaper, Images,
  UserPlus, ClipboardList, FolderOpen, Settings, ShieldCheck, ScrollText,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  perm: string;
  end?: boolean;
  badge?: 'messages' | 'applications';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_MAIN: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, perm: 'dashboard:read', end: true },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'RJNX Website',
    items: [
      { label: 'Home', to: '/website/home', icon: Home, perm: 'website_content:read' },
      { label: 'About', to: '/website/about', icon: User, perm: 'website_content:read' },
      { label: 'Projects', to: '/website/projects', icon: FolderGit2, perm: 'projects:read' },
      { label: 'YouTube', to: '/website/youtube', icon: Youtube, perm: 'videos:read' },
      { label: 'Social Links', to: '/website/socials', icon: Share2, perm: 'socials:read' },
      { label: 'Contact Messages', to: '/website/messages', icon: Mail, perm: 'messages:read', badge: 'messages' },
    ],
  },
  {
    label: 'RJNX Esports',
    items: [
      { label: 'Teams', to: '/esports/teams', icon: Gamepad2, perm: 'teams:read' },
      { label: 'Players', to: '/esports/players', icon: Users, perm: 'players:read' },
      { label: 'Matches', to: '/esports/matches', icon: CalendarClock, perm: 'matches:read' },
      { label: 'Results', to: '/esports/results', icon: Flag, perm: 'matches:read' },
      { label: 'Tournaments', to: '/esports/tournaments', icon: Trophy, perm: 'tournaments:read' },
      { label: 'Achievements', to: '/esports/achievements', icon: Medal, perm: 'achievements:read' },
      { label: 'News', to: '/esports/news', icon: Newspaper, perm: 'news:read' },
      { label: 'Media', to: '/esports/media', icon: Images, perm: 'media_albums:read' },
      { label: 'Recruitment', to: '/esports/recruitment', icon: UserPlus, perm: 'recruitment:read' },
      { label: 'Applications', to: '/esports/applications', icon: ClipboardList, perm: 'applications:read', badge: 'applications' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Media Library', to: '/system/media', icon: FolderOpen, perm: 'media:read' },
      { label: 'Site Settings', to: '/system/settings', icon: Settings, perm: 'settings:read' },
      { label: 'Admin Users', to: '/system/users', icon: ShieldCheck, perm: 'admin_users:read' },
      { label: 'Activity Logs', to: '/system/logs', icon: ScrollText, perm: 'activity_logs:read' },
    ],
  },
];

// ── Status metadata (labels + colors) ────────────────────────────────────────
export type BadgeTone = 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'zinc' | 'fuchsia';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

export const PROJECT_STATUS: Record<string, StatusMeta> = {
  draft: { label: 'Draft', tone: 'zinc' },
  published: { label: 'Published', tone: 'emerald' },
};

export const TEAM_STATUS: Record<string, StatusMeta> = {
  active: { label: 'Active', tone: 'emerald' },
  inactive: { label: 'Inactive', tone: 'zinc' },
  recruiting: { label: 'Recruiting', tone: 'amber' },
};

export const PLAYER_STATUS: Record<string, StatusMeta> = {
  active: { label: 'Active', tone: 'emerald' },
  inactive: { label: 'Inactive', tone: 'zinc' },
};

export const MATCH_STATUS: Record<string, StatusMeta> = {
  upcoming: { label: 'Upcoming', tone: 'sky' },
  live: { label: 'Live', tone: 'rose' },
  completed: { label: 'Completed', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'zinc' },
};

export const MATCH_RESULT: Record<string, StatusMeta> = {
  win: { label: 'Win', tone: 'emerald' },
  loss: { label: 'Loss', tone: 'rose' },
  draw: { label: 'Draw', tone: 'amber' },
  pending: { label: '—', tone: 'zinc' },
};

export const TOURNAMENT_STATUS: Record<string, StatusMeta> = {
  upcoming: { label: 'Upcoming', tone: 'sky' },
  ongoing: { label: 'Ongoing', tone: 'amber' },
  completed: { label: 'Completed', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'zinc' },
};

export const NEWS_STATUS: Record<string, StatusMeta> = {
  draft: { label: 'Draft', tone: 'zinc' },
  published: { label: 'Published', tone: 'emerald' },
  archived: { label: 'Archived', tone: 'amber' },
};

export const ALBUM_STATUS: Record<string, StatusMeta> = {
  draft: { label: 'Draft', tone: 'zinc' },
  published: { label: 'Published', tone: 'emerald' },
};

export const OPENING_STATUS: Record<string, StatusMeta> = {
  open: { label: 'Open', tone: 'emerald' },
  closed: { label: 'Closed', tone: 'zinc' },
};

export const APPLICATION_STATUS: Record<string, StatusMeta> = {
  new: { label: 'New', tone: 'sky' },
  reviewing: { label: 'Reviewing', tone: 'amber' },
  shortlisted: { label: 'Shortlisted', tone: 'violet' },
  rejected: { label: 'Rejected', tone: 'rose' },
  accepted: { label: 'Accepted', tone: 'emerald' },
};

export const MESSAGE_STATUS: Record<string, StatusMeta> = {
  unread: { label: 'Unread', tone: 'sky' },
  read: { label: 'Read', tone: 'zinc' },
  replied: { label: 'Replied', tone: 'emerald' },
  archived: { label: 'Archived', tone: 'amber' },
};

export const PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'github', label: 'GitHub' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'discord', label: 'Discord' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'facebook', label: 'Facebook' },
] as const;

export const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  login_failed: 'Failed login',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  publish: 'Publish',
  unpublish: 'Unpublish',
  status_change: 'Status change',
  settings_update: 'Settings update',
  password_change: 'Password changed',
  password_reset: 'Password reset',
  password_reset_requested: 'Reset requested',
  media_upload: 'Media upload',
  media_delete: 'Media deleted',
  account_created: 'Account created',
  account_deactivated: 'Account deactivated',
  account_activated: 'Account activated',
  role_changed: 'Role changed',
};

export const ACTION_TONES: Record<string, BadgeTone> = {
  login: 'emerald',
  logout: 'zinc',
  login_failed: 'rose',
  create: 'sky',
  update: 'violet',
  delete: 'rose',
  publish: 'emerald',
  unpublish: 'amber',
  status_change: 'amber',
  settings_update: 'violet',
  password_change: 'fuchsia',
  password_reset: 'fuchsia',
  password_reset_requested: 'amber',
  media_upload: 'sky',
  media_delete: 'rose',
  account_created: 'sky',
  account_deactivated: 'rose',
  account_activated: 'emerald',
  role_changed: 'violet',
};

/** Breadcrumb labels keyed by path segment. */
export const ROUTE_LABELS: Record<string, string> = {
  website: 'RJNX Website',
  esports: 'RJNX Esports',
  system: 'System',
  home: 'Home',
  about: 'About',
  projects: 'Projects',
  youtube: 'YouTube',
  socials: 'Social Links',
  messages: 'Contact Messages',
  teams: 'Teams',
  players: 'Players',
  matches: 'Matches',
  results: 'Results',
  tournaments: 'Tournaments',
  achievements: 'Achievements',
  news: 'News',
  media: 'Media',
  recruitment: 'Recruitment',
  applications: 'Applications',
  settings: 'Site Settings',
  users: 'Admin Users',
  logs: 'Activity Logs',
  profile: 'Profile',
  edit: 'Edit',
};
