"use client";

import { motion } from "framer-motion";
import { Gamepad2, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import type { Game } from "./types";

interface GamesTabProps {
  games: Game[];
  loading: boolean;
  onToggleVisibility: (gameId: string, currentVisibility: boolean) => void;
  onDeleteGame: (gameId: string) => void;
}

export function GamesTab({ games, loading, onToggleVisibility, onDeleteGame }: GamesTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-lime animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-xl border border-border">
        <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No games yet</p>
        <p className="text-sm text-muted-foreground/70">
          Upload your first game in the Upload tab
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {games.map((game) => (
        <motion.div
          key={game.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 bg-card border border-border rounded-xl p-4"
          data-testid={`admin-game-${game.id}`}
        >
          <img
            src={
              game.thumbnail_url ||
              "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=100&q=80"
            }
            alt={game.title}
            className="w-16 h-16 rounded-lg object-cover"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground truncate">
                {game.title}
              </h3>
              {!game.is_visible && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  Hidden
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {game.category} •{" "}
              {game.play_count?.toLocaleString() || 0} plays
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleVisibility(game.id, game.is_visible)}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-lime/20 transition-colors"
              title={game.is_visible ? "Hide game" : "Show game"}
            >
              {game.is_visible ? (
                <Eye className="w-5 h-5 text-foreground" />
              ) : (
                <EyeOff className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={() => onDeleteGame(game.id)}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-red-500/20 transition-colors"
              title="Delete game"
            >
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
