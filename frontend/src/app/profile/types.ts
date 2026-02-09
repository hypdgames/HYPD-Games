export interface Friend {
  id: string;
  username: string;
  email?: string;
  total_games_played?: number;
  total_play_time?: number;
}

export interface FriendRequest {
  request_id: string;
  user: Friend;
  created_at: string;
}

export interface SearchUser {
  id: string;
  username: string;
  email?: string;
  friendship_status: "none" | "friends" | "pending_sent" | "pending_received";
}

export interface StreakData {
  current_streak: number;
  best_streak: number;
  total_login_days: number;
  streak_points: number;
  last_login_date: string | null;
  streak_active: boolean;
  next_milestone: number | null;
  days_to_milestone: number | null;
  current_multiplier: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  login_streak: number;
  best_streak: number;
  streak_points: number;
}

export interface CoinPackage {
  package_id: string;
  name: string;
  coins: number;
  bonus_coins: number;
  total_coins: number;
  price_usd: number;
  is_popular: boolean;
}

export interface AdFreeOption {
  option_id: string;
  label: string;
  coins: number;
  hours: number;
}

export interface Transaction {
  id: string;
  transaction_type: string;
  status: string;
  coins: number;
  amount_usd?: number;
  description?: string;
  created_at: string;
}
