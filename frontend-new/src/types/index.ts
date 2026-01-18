// Game types
export interface Game {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url?: string;
  video_preview_url?: string;
  gif_preview_url?: string;
  preview_type: 'video' | 'gif' | 'image';
  game_file_id?: string;
  has_game_file: boolean;
  is_visible: boolean;
  play_count: number;
  created_at: string;
}

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  saved_games: string[];
  high_scores: Record<string, number>;
  created_at: string;
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

// Settings types
export interface AppSettings {
  logo_url?: string;
  site_name?: string;
}

// Analytics types
export interface PlaySession {
  game_id: string;
  duration_seconds: number;
  score?: number;
}

// API Response types
export interface ApiError {
  detail: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// Feed item can be a game or an ad placeholder
export interface FeedItem {
  type: 'game' | 'ad';
  data?: Game;
  adType?: 'video' | 'banner';
}
