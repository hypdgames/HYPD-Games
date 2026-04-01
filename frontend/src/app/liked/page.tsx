"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import BottomNav from "@/components/bottom-nav";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function LikedPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.saved_games?.length) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/games?feed_only=false`)
      .then(res => res.ok ? res.json() : [])
      .then((allGames: Game[]) => {
        const savedSet = new Set(user.saved_games);
        setGames(allGames.filter(g => savedSet.has(g.id)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const playGame = (id: string) => router.push(`/play/${id}`);

  return (
    <div className="min-h-screen hook-gradient-bg pb-28" data-testid="liked-page">
      <div className="pt-5 pb-4 text-center relative">
        <h1 className="text-2xl font-extrabold text-foreground">Liked</h1>
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
      </div>

      <div className="px-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet animate-spin" />
          </div>
        ) : !user ? (
          <div className="text-center py-20">
            <Heart className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-foreground font-bold text-lg mb-2">Sign in to see your likes</p>
            <p className="text-muted-foreground text-sm mb-6">Save games from the feed and find them here</p>
            <button
              onClick={() => router.push("/profile")}
              className="px-6 py-3 bg-violet text-white font-bold rounded-pill active:scale-95 transition-transform"
              data-testid="signin-btn"
            >
              Sign In
            </button>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-foreground font-bold text-lg mb-2">No liked games yet</p>
            <p className="text-muted-foreground text-sm">Tap the heart on games in the feed to save them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3" data-testid="liked-grid">
            {games.map((game, i) => {
              const imgSrc = game.icon_url || game.thumbnail_url || "";
              return (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => playGame(game.id)}
                  className="squircle-sm relative cursor-pointer"
                  style={{ aspectRatio: "1" }}
                  data-testid={`liked-tile-${game.id}`}
                >
                  {imgSrc ? (
                    <Image src={imgSrc} alt={game.title} fill className="object-cover" sizes="(max-width: 540px) 33vw, 160px" />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white font-bold text-[11px] leading-tight line-clamp-2">{game.title}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
