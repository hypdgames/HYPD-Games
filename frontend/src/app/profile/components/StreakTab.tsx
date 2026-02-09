"use client";

import { motion } from "framer-motion";
import {
  Loader2,
  Trophy,
  Check,
  Zap,
  Star,
  Flame,
  Target,
  Award,
  Calendar,
} from "lucide-react";
import type { User } from "@/types";
import type { StreakData, LeaderboardEntry } from "../types";

interface StreakTabProps {
  user: User;
  streakData: StreakData | null;
  streakLeaderboard: LeaderboardEntry[];
  streakLoading: boolean;
}

export function StreakTab({
  user,
  streakData,
  streakLeaderboard,
  streakLoading,
}: StreakTabProps) {
  if (streakLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-lime animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Streak Hero Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-orange-500/20 via-red-500/10 to-yellow-500/20 border-2 border-orange-500/50 rounded-2xl p-6"
        data-testid="streak-hero-card"
      >
        <div className="absolute top-2 right-2">
          {streakData?.streak_active ? (
            <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Active
            </span>
          ) : (
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full">
              Inactive
            </span>
          )}
        </div>

        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-full opacity-20 animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-orange-500/30 to-red-500/30 border-4 border-orange-500 flex items-center justify-center">
              <Flame className="w-10 h-10 text-orange-500" />
            </div>
          </div>

          <p
            className="text-6xl font-heading text-foreground mb-1"
            data-testid="current-streak-value"
          >
            {streakData?.current_streak || user.login_streak || 0}
          </p>
          <p className="text-muted-foreground text-sm mb-4">Day Streak</p>

          {/* Progress to next milestone */}
          {streakData?.next_milestone && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>Progress to {streakData.next_milestone} days</span>
                <span>{streakData.days_to_milestone} days to go</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(streakData.current_streak / streakData.next_milestone) * 100}%`,
                  }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Streak Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Best Streak</span>
          </div>
          <p
            className="text-2xl font-heading text-foreground"
            data-testid="best-streak-value"
          >
            {streakData?.best_streak || user.best_login_streak || 0}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-lime" />
            <span className="text-xs text-muted-foreground">
              Streak Points
            </span>
          </div>
          <p
            className="text-2xl font-heading text-lime"
            data-testid="streak-points-value"
          >
            {(
              streakData?.streak_points ||
              user.streak_points ||
              0
            ).toLocaleString()}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Total Days</span>
          </div>
          <p className="text-2xl font-heading text-foreground">
            {streakData?.total_login_days || user.total_login_days || 0}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Multiplier</span>
          </div>
          <p className="text-2xl font-heading text-purple-500">
            {streakData?.current_multiplier || 1}x
          </p>
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Milestones
        </h3>
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30, 60, 90, 180, 365].map((milestone) => {
            const currentStreak =
              streakData?.current_streak || user.login_streak || 0;
            const achieved = currentStreak >= milestone;
            return (
              <div
                key={milestone}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  achieved
                    ? "bg-lime/20 text-lime border border-lime/50"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {achieved && <Check className="w-3 h-3 inline mr-1" />}
                {milestone} days
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      {streakLeaderboard.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Top Streakers
          </h3>
          <div className="space-y-2">
            {streakLeaderboard.slice(0, 5).map((entry, index) => (
              <div
                key={entry.username}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  entry.username === user.username
                    ? "bg-lime/10 border border-lime/30"
                    : "bg-muted/50"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0
                      ? "bg-yellow-500 text-black"
                      : index === 1
                        ? "bg-gray-400 text-black"
                        : index === 2
                          ? "bg-amber-700 text-white"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {entry.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {entry.username}
                    {entry.username === user.username && (
                      <span className="text-lime ml-1">(You)</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-orange-500">
                  <Flame className="w-4 h-4" />
                  <span className="font-heading">{entry.login_streak}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-muted/50 rounded-xl p-4">
        <h3 className="text-sm font-bold text-foreground mb-2">
          How Streaks Work
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>Login every day to maintain your streak</li>
          <li>Earn bonus points based on streak length</li>
          <li>Missing a day resets your streak to 1</li>
          <li>Higher streaks = higher point multipliers!</li>
        </ul>
      </div>
    </div>
  );
}
