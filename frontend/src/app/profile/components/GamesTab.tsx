"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, ChevronRight } from "lucide-react";
import type { User, Game } from "@/types";

interface GamesTabProps {
  user: User;
  savedGames: Game[];
}

export function GamesTab({ user, savedGames }: GamesTabProps) {
  const router = useRouter();

  return (
    <>
      {/* Saved Games */}
      {savedGames.length > 0 ? (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            Saved Games
          </h3>
          {savedGames.map((game) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => router.push(`/play/${game.id}`)}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-lime/30 transition-colors"
              data-testid={`saved-game-${game.id}`}
            >
              <img
                src={
                  game.thumbnail_url ||
                  "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=100&q=80"
                }
                alt={game.title}
                className="w-14 h-14 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-foreground truncate text-sm">
                  {game.title}
                </h4>
                <p className="text-xs text-muted-foreground">{game.category}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-card rounded-xl border border-border mb-6">
          <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">No saved games yet</p>
          <p className="text-xs text-muted-foreground/70">
            Tap the heart on any game to save it
          </p>
        </div>
      )}

      {/* High Scores */}
      {Object.keys(user.high_scores || {}).length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
            High Scores
          </h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {Object.entries(user.high_scores).map(
              ([gameId, score], index) => (
                <div
                  key={gameId}
                  className={`flex items-center justify-between p-3 ${
                    index !== Object.entries(user.high_scores).length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <span className="text-sm text-foreground">
                    Game #{gameId.slice(0, 8)}
                  </span>
                  <span className="font-heading text-lime">
                    {score.toLocaleString()}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
