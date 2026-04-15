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
