/**
 * Central TypeScript models for the RJNX ADMIN API.
 */
export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  name: string;
  role_key: 'super_admin' | 'editor' | 'moderator';
  role_name: string;
  is_active: number;
  avatar_url: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  username: string;
  name: string;
  roleKey: string;
  roleName: string;
  permissions: string[];
  avatarUrl: string;
}

export interface Role {
  id: number;
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface WebsiteHome {
  hero_title: string;
  hero_subtitle: string;
  description: string;
  hero_image: string;
  cta_primary_label: string;
  cta_primary_url: string;
  cta_secondary_label: string;
  cta_secondary_url: string;
  updated_at: string;
}

export interface Skill {
  name: string;
  level: number;
}

export interface WebsiteAbout {
  biography: string;
  profile_image: string;
  interests: string[];
  skills: Skill[];
  updated_at: string;
}

export interface YoutubeChannel {
  channel_url: string;
  channel_description: string;
  updated_at: string;
}

export interface FeaturedVideo {
  id: number;
  title: string;
  url: string;
  sort_order: number;
  created_at: string;
}

export type SocialPlatform =
  | 'youtube' | 'github' | 'instagram' | 'discord' | 'x' | 'tiktok' | 'twitch' | 'facebook';

export interface SocialLink {
  id: number;
  platform: SocialPlatform;
  url: string;
  label: string;
  is_active: number;
  sort_order: number;
}

export interface Project {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  github_url: string;
  live_url: string;
  technologies: string[];
  status: 'draft' | 'published';
  featured: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  game: string;
  logo: string;
  description: string;
  status: 'active' | 'inactive' | 'recruiting';
  socials: Partial<Record<SocialPlatform, string>>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerStat {
  label: string;
  value: string;
}

export interface Player {
  id: number;
  gamer_tag: string;
  real_name: string;
  image: string;
  game: string;
  team_id: number | null;
  team_name?: string | null;
  role: string;
  country: string;
  biography: string;
  socials: Partial<Record<SocialPlatform, string>>;
  stats: PlayerStat[];
  status: 'active' | 'inactive';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Tournament {
  id: number;
  name: string;
  game: string;
  organizer: string;
  start_date: string;
  end_date: string | null;
  location: string;
  is_online: number;
  prize_pool: string;
  description: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  result: string;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: number;
  team_id: number | null;
  team_name?: string | null;
  opponent_name: string;
  opponent_logo: string;
  game: string;
  tournament_id: number | null;
  tournament_name?: string | null;
  starts_at: string;
  stream_url: string;
  our_score: number | null;
  opponent_score: number | null;
  result: 'win' | 'loss' | 'draw' | 'pending';
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: number;
  title: string;
  description: string;
  game: string;
  tournament: string;
  date: string;
  position: string;
  image: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  cover_image: string;
  category: string;
  author: string;
  content: string;
  published_at: string | null;
  seo_title: string;
  seo_description: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  id: number;
  filename: string;
  original_name: string;
  path: string;
  thumb_path: string;
  url: string;
  thumb_url: string;
  mime: string;
  format: string;
  size: number;
  width: number | null;
  height: number | null;
  alt_text: string;
  folder: string;
  created_at: string;
}

export interface AlbumImage {
  id: number;
  caption: string;
  sort_order: number;
  url: string;
  thumb_url?: string;
  alt_text?: string;
}

export interface MediaAlbum {
  id: number;
  title: string;
  slug: string;
  description: string;
  event_date: string | null;
  status: 'draft' | 'published';
  image_count?: number;
  images?: AlbumImage[];
  created_at: string;
  updated_at: string;
}

export interface RecruitmentOpening {
  id: number;
  position: string;
  game: string;
  role: string;
  description: string;
  requirements: string;
  status: 'open' | 'closed';
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: number;
  opening_id: number | null;
  opening_position?: string | null;
  opening_game?: string | null;
  name: string;
  gamer_tag: string;
  email: string;
  age: number | null;
  game: string;
  role: string;
  experience: string;
  profile_link: string;
  message: string;
  status: 'new' | 'reviewing' | 'shortlisted' | 'rejected' | 'accepted';
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Settings {
  general: {
    site_name: string;
    site_description: string;
    site_logo: string;
    site_favicon: string;
  };
  seo: {
    seo_title: string;
    seo_description: string;
    seo_og_image: string;
  };
  contact: {
    contact_email: string;
    contact_discord: string;
    contact_other: string;
  };
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: string;
  ip: string;
  created_at: string;
}

export interface DashboardData {
  user: { name: string; role: string };
  stats: {
    website: {
      projects: number; projectsPublished: number; videos: number; messages: number;
      messagesUnread: number; homeConfigured: boolean; aboutConfigured: boolean; socials: number;
    };
    esports: {
      teams: number; teamsActive: number; teamsRecruiting: number; players: number;
      matchesUpcoming: number; matchesLive: number; matchesCompleted: number; tournaments: number;
      achievements: number; news: number; newsPublished: number; media: number; albums: number;
      openingsOpen: number; applications: number; applicationsNew: number;
    };
  };
  charts: {
    matchResults: { win: number; loss: number; draw: number };
    applicationsByStatus: { status: string; count: number }[];
    messagesLast30Days: { date: string; count: number }[];
    newsByStatus: { status: string; count: number }[];
  };
  recent: {
    activity: ActivityLog[];
    matches: Match[];
    messages: ContactMessage[];
    applications: Application[];
  };
}

export interface NotificationsData {
  counts: { messages: number; applications: number };
  items: { id: number; type: string; title: string; subtitle: string; created_at: string; url: string }[];
}

export interface SearchResults {
  groups: { label: string; items: { id: number; title: string; subtitle: string; url: string }[] }[];
}
