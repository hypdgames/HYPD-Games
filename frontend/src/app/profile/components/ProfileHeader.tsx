"use client";

import { motion } from "framer-motion";
import {
  LogOut,
  Heart,
  Trophy,
  Flame,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User, AppSettings } from "@/types";

interface ProfileHeaderProps {
  user: User;
  settings?: AppSettings | null;
  friendsCount: number;
  onLogout: () => void;
}

export function ProfileHeader({
  user,
  friendsCount,
  onLogout,
}: ProfileHeaderProps) {
  return (
    <>
      {/* Header Bar */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground lowercase tracking-tight">profile</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onLogout}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
            data-testid="logout-button"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div className="px-5 pt-4">
        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime/30 to-violet/30 flex items-center justify-center mx-auto mb-4">
            <span className="font-bold text-3xl text-foreground">
              {user.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="font-bold text-2xl text-foreground mb-1 lowercase">
            {user.username}
          </h2>
          <p className="text-muted-foreground text-[14px]">{user.email}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-card card-elevated rounded-[20px] p-3 text-center">
            <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">
              {user.login_streak || 0}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">Streak</p>
          </div>
          <div className="bg-card card-elevated rounded-[20px] p-3 text-center">
            <Heart className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">
              {user.saved_games?.length || 0}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">Saved</p>
          </div>
          <div className="bg-card card-elevated rounded-[20px] p-3 text-center">
            <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">
              {Object.keys(user.high_scores || {}).length}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">Scores</p>
          </div>
          <div className="bg-card card-elevated rounded-[20px] p-3 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">
              {friendsCount}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">Friends</p>
          </div>
        </div>
      </div>
    </>
  );
}
