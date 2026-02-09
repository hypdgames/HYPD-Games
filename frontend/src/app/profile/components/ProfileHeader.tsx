"use client";

import { motion } from "framer-motion";
import {
  LogOut,
  Heart,
  Trophy,
  Flame,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User, AppSettings } from "@/types";

interface ProfileHeaderProps {
  user: User;
  settings: AppSettings | null;
  friendsCount: number;
  onLogout: () => void;
}

export function ProfileHeader({
  user,
  settings,
  friendsCount,
  onLogout,
}: ProfileHeaderProps) {
  return (
    <>
      {/* Header Bar */}
      <div className="glass p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">
                HYPD
              </h1>
            )}
            <span className="text-muted-foreground">Profile</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="text-muted-foreground hover:text-foreground"
              data-testid="logout-button"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border-2 border-lime flex items-center justify-center mx-auto mb-4">
            <span className="font-heading text-3xl text-lime">
              {user.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="font-heading text-2xl text-foreground mb-1">
            {user.username}
          </h2>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xl font-heading text-foreground">
              {user.login_streak || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Streak</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Heart className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-heading text-foreground">
              {user.saved_games?.length || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Saved</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-xl font-heading text-foreground">
              {Object.keys(user.high_scores || {}).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Scores</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-heading text-foreground">
              {friendsCount}
            </p>
            <p className="text-[10px] text-muted-foreground">Friends</p>
          </div>
        </div>
      </div>
    </>
  );
}
