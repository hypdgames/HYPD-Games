"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, Eye, EyeOff, Trash2, Loader2, CheckSquare, Square, XSquare, Tv, TvMinimalPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Game } from "./types";

interface GamesTabProps {
  games: Game[];
  loading: boolean;
  loadingMore?: boolean;
  totalGames?: number;
  hasMore?: boolean;
  onToggleVisibility: (gameId: string, currentVisibility: boolean) => void;
  onToggleFeedVisibility: (gameId: string, currentShowInFeed: boolean) => void;
  onDeleteGame: (gameId: string) => void;
  onBulkDelete?: (gameIds: string[]) => Promise<void>;
  onLoadMore?: () => void;
}

export function GamesTab({
  games,
  loading,
  loadingMore = false,
  totalGames,
  hasMore = false,
  onToggleVisibility,
  onToggleFeedVisibility,
  onDeleteGame,
  onBulkDelete,
  onLoadMore,
}: GamesTabProps) {
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelection = (gameId: string) => {
    setSelectedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) newSet.delete(gameId);
      else newSet.add(gameId);
      return newSet;
    });
  };

  const selectAll = () => setSelectedGames(new Set(games.map(g => g.id)));
  const clearSelection = () => setSelectedGames(new Set());

  const handleBulkDelete = async () => {
    if (selectedGames.size === 0) return;
    if (!confirm(`Delete ${selectedGames.size} game${selectedGames.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    if (onBulkDelete) {
      await onBulkDelete(Array.from(selectedGames));
    } else {
      for (const gameId of Array.from(selectedGames)) onDeleteGame(gameId);
    }
    setSelectedGames(new Set());
    setBulkDeleting(false);
  };

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
        <p className="text-sm text-muted-foreground/70">Upload your first game in the Upload tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3" data-testid="bulk-actions-bar">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={selectAll} className="text-xs" data-testid="select-all-btn">
            <CheckSquare className="w-4 h-4 mr-1" />
            Select Visible ({games.length})
          </Button>
          {selectedGames.size > 0 && (
            <Button variant="outline" size="sm" onClick={clearSelection} className="text-xs" data-testid="clear-selection-btn">
              <XSquare className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          {selectedGames.size > 0 && (
            <span className="text-sm text-muted-foreground">{selectedGames.size} selected</span>
          )}
          {typeof totalGames === "number" && (
            <span className="text-sm text-muted-foreground">
              Showing {games.length} of {totalGames.toLocaleString()} games
            </span>
          )}
        </div>
        {selectedGames.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting} className="text-xs" data-testid="bulk-delete-btn">
            {bulkDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
            Delete {selectedGames.size} Game{selectedGames.size > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Games List */}
      {games.map((game) => {
        const showInFeed = game.show_in_feed !== false;
        return (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-4 bg-card border rounded-xl p-4 transition-colors ${
              selectedGames.has(game.id) ? 'border-lime bg-lime/5' : 'border-border'
            }`}
            data-testid={`admin-game-${game.id}`}
          >
            {/* Checkbox */}
            <button onClick={() => toggleSelection(game.id)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center" data-testid={`game-checkbox-${game.id}`}>
              {selectedGames.has(game.id)
                ? <CheckSquare className="w-5 h-5 text-lime" />
                : <Square className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
              }
            </button>

            <div
              className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted cursor-pointer flex-shrink-0"
              onClick={() => toggleSelection(game.id)}
            >
              {game.icon_url || game.thumbnail_url ? (
                <Image
                  src={game.icon_url || game.thumbnail_url || ""}
                  alt={game.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : null}
            </div>

            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSelection(game.id)}>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-foreground truncate">{game.title}</h3>
                {game.source === "gamemonetize" && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-medium">GMZ</span>
                )}
                {game.source === "custom" && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-medium">Custom</span>
                )}
                {!game.is_visible && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Hidden</span>
                )}
                {!showInFeed && (
                  <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium">Explore only</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {game.category} • {game.play_count?.toLocaleString() || 0} plays
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Feed Visibility Toggle */}
              <button
                onClick={() => onToggleFeedVisibility(game.id, showInFeed)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  showInFeed
                    ? 'bg-lime/20 hover:bg-lime/30'
                    : 'bg-muted hover:bg-orange-500/20'
                }`}
                title={showInFeed ? "Remove from Feed (keep in Explore)" : "Add to Feed"}
                data-testid={`feed-toggle-${game.id}`}
              >
                {showInFeed
                  ? <TvMinimalPlay className="w-5 h-5 text-lime" />
                  : <Tv className="w-5 h-5 text-orange-400" />
                }
              </button>

              {/* Global Visibility Toggle */}
              <button
                onClick={() => onToggleVisibility(game.id, game.is_visible)}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-lime/20 transition-colors"
                title={game.is_visible ? "Hide game entirely" : "Show game"}
                data-testid={`visibility-toggle-${game.id}`}
              >
                {game.is_visible
                  ? <Eye className="w-5 h-5 text-foreground" />
                  : <EyeOff className="w-5 h-5 text-muted-foreground" />
                }
              </button>

              <button
                onClick={() => onDeleteGame(game.id)}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-red-500/20 transition-colors"
                title="Delete game"
                data-testid={`delete-game-${game.id}`}
              >
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            </div>
          </motion.div>
        );
      })}

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Load More Games
          </Button>
        </div>
      )}
    </div>
  );
}
