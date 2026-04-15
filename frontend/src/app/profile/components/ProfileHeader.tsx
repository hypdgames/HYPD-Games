"use client";

import { motion } from "framer-motion";
import { LogOut, Heart, Trophy, Coins, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { User, AppSettings } from "@/types";

interface ProfileHeaderProps {
  user: User;
  settings?: AppSettings | null;
  friendsCount: number;
  onLogout: () => void;
}

export function ProfileHeader({ user, friendsCount, onLogout }: ProfileHeaderProps) {
  return (
    <>
      {/* Centered title (Hook style) */}
      <div className="pt-5 pb-2 text-center relative">
        <h1 className="text-2xl font-extrabold text-foreground">Profile</h1>
        <div className="absolute right-5 top-5 flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onLogout}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
            data-testid="logout-button"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <div className="px-5 pt-4">
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet/30 to-lime/20 flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="font-extrabold text-3xl text-foreground">
              {user.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="font-extrabold text-2xl mb-1">{user.username}</h2>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </motion.div>

        {/* Stats — soft cards (Hook's card style) */}
        <div className="grid grid-cols-4 gap-2.5 mb-6">
          {[
            { icon: Heart, color: "text-red-500", val: user.saved_games?.length || 0, label: "Saved" },
            { icon: Trophy, color: "text-yellow-500", val: Object.keys(user.high_scores || {}).length, label: "Scores" },
            { icon: Coins, color: "text-lime", val: user.coin_balance || 0, label: "Coins" },
            { icon: Users, color: "text-blue-500", val: friendsCount, label: "Friends" },
          ].map(({ icon: Icon, color, val, label }) => (
            <div key={label} className="soft-card text-center">
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1.5`} />
              <p className="text-xl font-extrabold">{val}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
