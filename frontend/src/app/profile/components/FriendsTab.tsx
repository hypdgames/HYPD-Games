"use client";

import { motion } from "framer-motion";
import {
  Loader2,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Friend, FriendRequest, SearchUser } from "../types";

interface FriendsTabProps {
  friends: Friend[];
  friendRequests: FriendRequest[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchUser[];
  searchLoading: boolean;
  friendsLoading: boolean;
  onSendFriendRequest: (userId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  onRemoveFriend: (friendId: string) => void;
}

function formatPlayTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function FriendsTab({
  friends,
  friendRequests,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchLoading,
  friendsLoading,
  onSendFriendRequest,
  onAcceptRequest,
  onDeclineRequest,
  onRemoveFriend,
}: FriendsTabProps) {
  return (
    <>
      {/* Search Users */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="pl-10"
            data-testid="friend-search-input"
          />
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="mt-3 space-y-2">
            {searchLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-lime animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                No users found
              </p>
            ) : (
              searchResults.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
                  data-testid={`search-result-${u.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="font-bold text-foreground">
                      {u.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">
                      {u.username}
                    </p>
                  </div>
                  {u.friendship_status === "none" && (
                    <Button
                      size="sm"
                      onClick={() => onSendFriendRequest(u.id)}
                      className="bg-lime text-black hover:bg-lime/90"
                      data-testid={`add-friend-${u.id}`}
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  )}
                  {u.friendship_status === "friends" && (
                    <span className="text-xs text-lime flex items-center gap-1">
                      <UserCheck className="w-4 h-4" />
                      Friends
                    </span>
                  )}
                  {u.friendship_status === "pending_sent" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Pending
                    </span>
                  )}
                  {u.friendship_status === "pending_received" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const req = friendRequests.find(
                          (r) => r.user.id === u.id
                        );
                        if (req) onAcceptRequest(req.request_id);
                      }}
                    >
                      Accept
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Friend Requests ({friendRequests.length})
          </h3>
          <div className="space-y-2">
            {friendRequests.map((req) => (
              <motion.div
                key={req.request_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-lime/10 border border-lime/30 rounded-xl p-3"
                data-testid={`friend-request-${req.request_id}`}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="font-bold text-foreground">
                    {req.user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">
                    {req.user.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Wants to be your friend
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onAcceptRequest(req.request_id)}
                    className="bg-lime text-black hover:bg-lime/90"
                    data-testid={`accept-request-${req.request_id}`}
                  >
                    <UserCheck className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDeclineRequest(req.request_id)}
                    data-testid={`decline-request-${req.request_id}`}
                  >
                    <UserX className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Friends ({friends.length})
        </h3>
        {friendsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-lime animate-spin" />
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 bg-card rounded-xl border border-border">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No friends yet</p>
            <p className="text-xs text-muted-foreground/70">
              Search for users above to add friends
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
                data-testid={`friend-${friend.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 flex items-center justify-center">
                  <span className="font-bold text-foreground">
                    {friend.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">
                    {friend.username}
                  </p>
                  {friend.total_games_played !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {friend.total_games_played} games{" "}
                      {formatPlayTime(friend.total_play_time || 0)} played
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemoveFriend(friend.id)}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <UserX className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
