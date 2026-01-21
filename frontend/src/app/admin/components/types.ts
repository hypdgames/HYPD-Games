import type { Game } from "@/types";

export interface GPXGame {
  gpx_game_id: string;
  title: string;
  namespace: string;
  description: string;
  category: string;
  thumbnail_url: string;
  icon_url: string;
  play_url: string;
  orientation?: string;
  quality_score?: number;
  date_published?: string;
}

export interface AnalyticsOverview {
  total_users: number;
  total_games: number;
  total_plays: number;
  new_users_today: number;
  plays_today: number;
  active_users_24h: number;
  plays_this_week: number;
}

export interface DailyStats {
  date: string;
  plays: number;
  unique_players: number;
  new_users: number;
}

export interface CategoryStats {
  category: string;
  plays: number;
  [key: string]: string | number;
}

export interface TopGame {
  id: string;
  title: string;
  plays: number;
}

export interface RetentionData {
  day_1: number;
  day_1_pct?: number;
  day_3: number;
  day_3_pct?: number;
  day_7: number;
  day_7_pct?: number;
  total_new_users: number;
}

export interface RegionData {
  region: string;
  events: number;
}

export interface DeviceStats {
  device_types: { name: string; count: number; percentage: number }[];
  browsers: { name: string; count: number }[];
  operating_systems: { name: string; count: number }[];
  screen_sizes: { name: string; count: number }[];
  total_events: number;
  period_days: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  ban_reason?: string;
  total_play_time: number;
  total_games_played: number;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  last_active_at?: string;
}

export interface UserStats {
  total_users: number;
  admin_count: number;
  banned_count: number;
  new_today: number;
  new_this_week: number;
  new_this_month: number;
  active_24h: number;
}

export const CATEGORIES = ["Action", "Puzzle", "Arcade", "Racing", "Sports", "Strategy"];

export const CHART_COLORS = ["#CCFF00", "#8B5CF6", "#EC4899", "#06B6D4", "#F59E0B", "#10B981"];

export type { Game };
