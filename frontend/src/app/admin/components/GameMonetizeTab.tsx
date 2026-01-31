"use client";

import { motion } from "framer-motion";
import { Globe, Loader2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Game } from "./types";

export interface GMZGame {
  gmz_game_id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string;
  play_url: string;
  instructions?: string;
  width?: number;
  height?: number;
}

interface GameMonetizeTabProps {
  gmzGames: GMZGame[];
  gmzLoading: boolean;
  gmzCategory: string;
  gmzCategories: { id: string; name: string; icon: string }[];
  gmzHasMore: boolean;
  gmzPage: number;
  selectedGmzGames: Set<string>;
  games: Game[];
  importing: boolean;
  onCategoryChange: (category: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onToggleSelection: (id: string) => void;
  onImportSelected: () => void;
}

export function GameMonetizeTab({
  gmzGames,
  gmzLoading,
  gmzCategory,
  gmzCategories,
  gmzHasMore,
  selectedGmzGames,
  games,
  importing,
  onCategoryChange,
  onRefresh,
  onLoadMore,
  onToggleSelection,
  onImportSelected,
}: GameMonetizeTabProps) {
  const isGmzGameImported = (id: string) => {
    return games.some(g => g.gd_game_id === `gmz-${id}`);
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">GameMonetize Network</h3>
            <p className="text-sm text-muted-foreground">
              Browse and import games from GameMonetize. Games will use the GameMonetize SDK for ads.
            </p>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Category Select */}
        <select
          value={gmzCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-10 px-4 rounded-lg bg-card border border-border text-foreground flex-1"
          data-testid="gmz-category-select"
        >
          {gmzCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
        
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={gmzLoading}
        >
          {gmzLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {selectedGmzGames.size > 0 && (
        <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
          <span className="text-sm text-foreground">
            <span className="font-bold text-purple-400">{selectedGmzGames.size}</span> games selected
          </span>
          <Button
            onClick={onImportSelected}
            disabled={importing}
            size="sm"
            className="bg-purple-500 text-white hover:bg-purple-600"
            data-testid="import-gmz-selected-button"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Import Selected
          </Button>
        </div>
      )}

      {gmzLoading && gmzGames.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      ) : gmzGames.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No games found</p>
          <p className="text-sm text-muted-foreground/70">
            Try a different category
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {gmzGames.map((game) => {
              const imported = isGmzGameImported(game.gmz_game_id);
              const selected = selectedGmzGames.has(game.gmz_game_id);
              
              return (
                <motion.div
                  key={game.gmz_game_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`relative bg-card border rounded-xl overflow-hidden cursor-pointer transition-all ${
                    imported
                      ? "border-purple-500/50 opacity-60"
                      : selected
                      ? "border-purple-500 ring-2 ring-purple-500/30"
                      : "border-border hover:border-purple-500/50"
                  }`}
                  onClick={() => !imported && onToggleSelection(game.gmz_game_id)}
                  data-testid={`gmz-game-${game.gmz_game_id}`}
                >
                  <div className="aspect-video relative">
                    <img
                      src={game.thumbnail_url || "https://via.placeholder.com/200?text=Game"}
                      alt={game.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=200&q=80";
                      }}
                    />
                    {imported && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                          Already Added
                        </div>
                      </div>
                    )}
                    {selected && !imported && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {/* Network Badge */}
                    <div className="absolute bottom-2 left-2 bg-purple-500/90 text-white px-2 py-0.5 rounded text-xs font-medium">
                      GMZ
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm text-foreground truncate">
                      {game.title}
                    </h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {game.category}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {gmzHasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={gmzLoading}
              >
                {gmzLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Load More Games
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
