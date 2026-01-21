"use client";

import { useState } from "react";
import { Users, Activity, TrendingUp, Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminUser, UserStats } from "./types";

interface UsersTabProps {
  users: AdminUser[];
  userStats: UserStats | null;
  loading: boolean;
  search: string;
  filter: "all" | "admins" | "banned";
  page: number;
  totalPages: number;
  currentUserId?: string;
  onSearch: (search: string) => void;
  onFilterChange: (filter: "all" | "admins" | "banned") => void;
  onPageChange: (page: number) => void;
  onBanUser: (userId: string, reason?: string) => Promise<void>;
  onUnbanUser: (userId: string) => Promise<void>;
  onMakeAdmin: (userId: string) => Promise<void>;
  onRemoveAdmin: (userId: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export function UsersTab({
  users,
  userStats,
  loading,
  search,
  filter,
  page,
  totalPages,
  currentUserId,
  onSearch,
  onFilterChange,
  onPageChange,
  onBanUser,
  onUnbanUser,
  onMakeAdmin,
  onRemoveAdmin,
  onDeleteUser,
}: UsersTabProps) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true);
    await action();
    setActionLoading(false);
    setShowUserModal(false);
  };

  return (
    <div className="space-y-6" data-testid="users-tab">
      {/* User Stats Cards */}
      {userStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="user-stats-cards">
          <div className="bg-card border border-border rounded-xl p-4" data-testid="stat-total-users">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">Total Users</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{userStats.total_users}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4" data-testid="stat-active-24h">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-xs">Active (24h)</span>
            </div>
            <p className="text-2xl font-bold text-lime">{userStats.active_24h}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4" data-testid="stat-new-today">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">New Today</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{userStats.new_today}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4" data-testid="stat-banned">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs">Banned</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{userStats.banned_count}</p>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Input
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onPageChange(1)}
            className="pr-10"
            data-testid="user-search-input"
          />
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-1 top-1"
            onClick={() => onPageChange(1)}
            data-testid="user-search-button"
          >
            Search
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange("all")}
            data-testid="filter-all-button"
          >
            All
          </Button>
          <Button
            variant={filter === "admins" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange("admins")}
            data-testid="filter-admins-button"
          >
            Admins
          </Button>
          <Button
            variant={filter === "banned" ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange("banned")}
            className={filter === "banned" ? "bg-red-500 hover:bg-red-600" : ""}
            data-testid="filter-banned-button"
          >
            Banned
          </Button>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-lime animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-border" data-testid="users-list">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                data-testid={`user-row-${u.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{u.username}</span>
                        {u.is_admin && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-lime text-black rounded-full" data-testid="admin-badge">ADMIN</span>
                        )}
                        {u.is_banned && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full" data-testid="banned-badge">BANNED</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{u.total_games_played} games played</p>
                    <p>Joined {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-border" data-testid="users-pagination">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              data-testid="pagination-prev"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              data-testid="pagination-next"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Users className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{selectedUser.username}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-1">
                    {selectedUser.is_admin && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-lime text-black rounded-full">ADMIN</span>
                    )}
                    {selectedUser.is_banned && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">BANNED</span>
                    )}
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Games Played</span>
                  <span className="text-sm font-medium text-foreground">{selectedUser.total_games_played}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Play Time</span>
                  <span className="text-sm font-medium text-foreground">{Math.round(selectedUser.total_play_time / 60)} mins</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Joined</span>
                  <span className="text-sm font-medium text-foreground">{new Date(selectedUser.created_at).toLocaleDateString()}</span>
                </div>
                {selectedUser.last_active_at && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Last Active</span>
                    <span className="text-sm font-medium text-foreground">{new Date(selectedUser.last_active_at).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedUser.ban_reason && (
                  <div className="py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Ban Reason</span>
                    <p className="text-sm text-red-500 mt-1">{selectedUser.ban_reason}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {selectedUser.id !== currentUserId && (
                  <>
                    {!selectedUser.is_banned ? (
                      <Button
                        variant="outline"
                        className="w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                        onClick={() => handleAction(() => onBanUser(selectedUser.id, "Banned by admin"))}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Ban User
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                        onClick={() => handleAction(() => onUnbanUser(selectedUser.id))}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Unban User
                      </Button>
                    )}

                    {!selectedUser.is_admin ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleAction(() => onMakeAdmin(selectedUser.id))}
                        disabled={actionLoading || selectedUser.is_banned}
                      >
                        Make Admin
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleAction(() => onRemoveAdmin(selectedUser.id))}
                        disabled={actionLoading}
                      >
                        Remove Admin
                      </Button>
                    )}

                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleAction(() => onDeleteUser(selectedUser.id))}
                      disabled={actionLoading || selectedUser.is_admin}
                    >
                      Delete User
                    </Button>
                  </>
                )}

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowUserModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
