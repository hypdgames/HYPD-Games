"use client";

import { motion } from "framer-motion";
import { Globe, Loader2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GPXGame, Game } from "./types";

interface GamePixTabProps {
  gpxGames: GPXGame[];
  gpxLoading: boolean;
  gpxCategory: string;
  gpxCategories: { id: string; name: string; icon: string }[];
  gpxHasMore: boolean;
  gpxPage: number;
  gpxOrder: string;
  selectedGpxGames: Set<string>;
  games: Game[];
  importing: boolean;
  onCategoryChange: (category: string) => void;
  onOrderChange: (order: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onToggleSelection: (namespace: string) => void;
  onImportSelected: () => void;
}

export function GamePixTab({
  gpxGames,
  gpxLoading,
  gpxCategory,
  gpxCategories,
  gpxHasMore,
  gpxOrder,
  selectedGpxGames,
  games,
  importing,
  onCategoryChange,
  onOrderChange,
  onRefresh,
  onLoadMore,
  onToggleSelection,
  onImportSelected,
}: GamePixTabProps) {
  const isGpxGameImported = (namespace: string) => {
    return games.some(g => g.gd_game_id === `gpx-${namespace}`);
  };

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Category Select */}
        <select
          value={gpxCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-10 px-4 rounded-lg bg-card border border-border text-foreground flex-1"
          data-testid="gpx-category-select"
        >
          {gpxCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
        
        {/* Sort Select */}
        <select
          value={gpxOrder}
          onChange={(e) => onOrderChange(e.target.value)}
          className="h-10 px-4 rounded-lg bg-card border border-border text-foreground"
          data-testid="gpx-order-select"
        >
          <option value="quality">⭐ Best Quality</option>
          <option value="pubdate">🕐 Newest First</option>
        </select>
        
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={gpxLoading}
        >
          {gpxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {selectedGpxGames.size > 0 && (
        <div className="flex items-center justify-between bg-lime/10 border border-lime/30 rounded-lg p-3">
          <span className="text-sm text-foreground">
            <span className="font-bold text-lime">{selectedGpxGames.size}</span> games selected
          </span>
          <Button
            onClick={onImportSelected}
            disabled={importing}
            size="sm"
            className="bg-lime text-black hover:bg-lime/90"
            data-testid="import-gpx-selected-button"
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

      {gpxLoading && gpxGames.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-lime animate-spin" />
        </div>
      ) : gpxGames.length === 0 ? (
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
            {gpxGames.map((game) => {
              const imported = isGpxGameImported(game.namespace);
              const selected = selectedGpxGames.has(game.namespace);
              
              return (
                <motion.div
                  key={game.namespace}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`relative bg-card border rounded-xl overflow-hidden cursor-pointer transition-all ${
                    imported
                      ? "border-lime/50 opacity-60"
                      : selected
                      ? "border-lime ring-2 ring-lime/30"
                      : "border-border hover:border-lime/50"
                  }`}
                  onClick={() => !imported && onToggleSelection(game.namespace)}
                  data-testid={`gpx-game-${game.namespace}`}
                >
                  <div className="aspect-video relative">
                    <img
                      src={game.thumbnail_url || game.icon_url || "https://via.placeholder.com/200?text=Game"}
                      alt={game.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=200&q=80";
                      }}
                    />
                    {imported && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-lime text-black px-3 py-1 rounded-full text-xs font-bold">
                          Already Added
                        </div>
                      </div>
                    )}
                    {selected && !imported && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-lime rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    )}
                    {game.quality_score && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
                        ⭐ {Math.round(game.quality_score * 100)}%
                      </div>
                    )}
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

          {gpxHasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={gpxLoading}
              >
                {gpxLoading ? (
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
