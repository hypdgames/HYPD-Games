"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Globe, Loader2, Plus, Check, Search, X, Video, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export interface GMZGame {
  gmz_game_id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string;
  icon_url?: string;
  thumbnail_large_url?: string;
  play_url: string;
  instructions?: string;
  tags?: string;
  width?: number;
  height?: number;
}

interface GameMonetizeTabProps {
  gmzGames: GMZGame[];
  gmzLoading: boolean;
  gmzCategory: string;
  gmzCategories: { id: string; name: string; icon: string }[];
  gmzSort: string;
  gmzHasMore: boolean;
  gmzTotal: number;
  gmzPage: number;
  selectedGmzGames: Set<string>;
  importedGmzIds: Set<string>;
  importing: boolean;
  gmzVideoAdsEnabled: boolean;
  syncing: boolean;
  onGmzVideoAdsToggle: (enabled: boolean) => void;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: string) => void;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onToggleSelection: (id: string) => void;
  onImportSelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSyncNew: () => void;
}

const SORT_OPTIONS = [
  { id: "newest", name: "Newest First", icon: "New" },
  { id: "oldest", name: "Oldest First", icon: "Old" },
  { id: "title_asc", name: "Title A-Z", icon: "A-Z" },
  { id: "title_desc", name: "Title Z-A", icon: "Z-A" },
];

export function GameMonetizeTab({
  gmzGames,
  gmzLoading,
  gmzCategory,
  gmzCategories,
  gmzSort,
  gmzHasMore,
  gmzTotal,
  selectedGmzGames,
  importedGmzIds,
  importing,
  gmzVideoAdsEnabled,
  syncing,
  onGmzVideoAdsToggle,
  onCategoryChange,
  onSortChange,
  onSearch,
  onRefresh,
  onLoadMore,
  onToggleSelection,
  onImportSelected,
  onSelectAll,
  onClearSelection,
  onSyncNew,
}: GameMonetizeTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const isGmzGameImported = (id: string) => importedGmzIds.has(`gmz-${id}`);

  // Debounced search — fires 500ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(searchQuery);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    onSearch("");
  };

  const visibleGmzGames = gmzGames.filter(g => !isGmzGameImported(g.gmz_game_id));
  const selectableGames = visibleGmzGames;
  const newCount = visibleGmzGames.length;

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">GameMonetize Network</h3>
              <p className="text-sm text-muted-foreground">
                Browse and import games from GameMonetize.
                {gmzTotal > 0 && (
                  <span className="font-semibold text-purple-400"> {gmzTotal.toLocaleString()} games available.</span>
                )}
                {newCount > 0 && (
                  <span className="ml-1 text-green-400 font-semibold">{newCount} new on this page.</span>
                )}
              </p>
            </div>
          </div>
          <Button
            onClick={onSyncNew}
            disabled={syncing || gmzLoading}
            size="sm"
            className="bg-purple-500 text-white hover:bg-purple-600 flex-shrink-0 whitespace-nowrap"
            data-testid="sync-new-games-btn"
            title="Import all games from the full GameMonetize catalog that are not yet in your database"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
            {syncing ? "Syncing..." : "Sync New Games"}
          </Button>
        </div>
      </div>

      {/* Walkthrough Video Ads Setting */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              {gmzVideoAdsEnabled
                ? <DollarSign className="w-5 h-5 text-green-500" />
                : <Video className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-foreground">Walkthrough Video Ads</h3>
              <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                {gmzVideoAdsEnabled
                  ? "Ads are shown in walkthrough videos (1 pre-roll + 1 banner). You earn revenue tracked by your domain."
                  : "Ads are hidden in walkthrough videos. No revenue generated from walkthroughs."}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                GameMonetize walkthroughs play on the game page when a user taps &quot;Watch Walkthrough&quot;.
              </p>
            </div>
          </div>
          <Switch
            checked={gmzVideoAdsEnabled}
            onCheckedChange={onGmzVideoAdsToggle}
            data-testid="gmz-video-ads-toggle"
            className="flex-shrink-0"
          />
        </div>
        {gmzVideoAdsEnabled && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-green-500/80">
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Earnings are automatically tracked through your domain — no publisher ID needed.</span>
          </div>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all games by title or tags..."
            className="w-full h-10 pl-10 pr-10 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground"
            data-testid="gmz-search-input"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Category Select */}
        <select
          value={gmzCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-10 px-4 rounded-lg bg-card border border-border text-foreground min-w-[140px]"
          data-testid="gmz-category-select"
        >
          {gmzCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>

        {/* Sort Select */}
        <select
          value={gmzSort}
          onChange={(e) => onSortChange(e.target.value)}
          className="h-10 px-4 rounded-lg bg-card border border-border text-foreground min-w-[140px]"
          data-testid="gmz-sort-select"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.icon} {opt.name}
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

      {/* Selection Actions Bar — only for unimported selectable games */}
      {selectableGames.length > 0 && (
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Showing <span className="font-bold text-foreground">{selectableGames.length}</span>
              {gmzTotal > 0 && (
                <> of <span className="font-bold text-purple-400">{gmzTotal.toLocaleString()}</span></>
              )}
              {" "}games to import
              {searchQuery && (
                <span className="ml-1 text-purple-400">
                  matching &quot;{searchQuery}&quot;
                </span>
              )}
              {selectedGmzGames.size > 0 && (
                <span className="ml-2">
                  | <span className="font-bold text-purple-400">{selectedGmzGames.size}</span> selected
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedGmzGames.size > 0 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                >
                  Clear
                </Button>
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
                  Import {selectedGmzGames.size}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAll}
                disabled={selectableGames.length === 0}
              >
                Select All ({selectableGames.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {gmzLoading && visibleGmzGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading games from GameMonetize catalog...</p>
        </div>
      ) : visibleGmzGames.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-foreground">No games to import</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {searchQuery
              ? `No unimported games match "${searchQuery}" — try a different search term`
              : "Everything in this current result set is already on your site, or the catalogue is still loading."}
          </p>
          <button
            onClick={() => onRefresh()}
            className="mt-4 px-5 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Refresh catalogue
          </button>
          {gmzHasMore && (
            <button
              onClick={onLoadMore}
              className="mt-3 ml-3 px-5 py-2 rounded-full border border-border text-sm font-semibold hover:bg-muted transition-colors"
            >
              Load more results
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleGmzGames.map((game) => {
              const selected = selectedGmzGames.has(game.gmz_game_id);
              return (
                <motion.div
                  key={game.gmz_game_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`relative bg-card border rounded-xl overflow-hidden transition-all ${
                    selected
                      ? "border-purple-500 ring-2 ring-purple-500/30 cursor-pointer"
                      : "border-border hover:border-purple-500/50 cursor-pointer"
                  }`}
                  onClick={() => onToggleSelection(game.gmz_game_id)}
                  data-testid={`gmz-game-${game.gmz_game_id}`}
                >
                  <div className="aspect-video relative">
                    {game.thumbnail_url ? (
                      <Image
                        src={game.thumbnail_url}
                        alt={game.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                    {selected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-purple-500/90 text-white px-2 py-0.5 rounded text-xs font-medium">
                      GMZ
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
                      {game.category}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm text-foreground truncate" title={game.title}>
                      {game.title}
                    </h3>
                    {game.tags && (
                      <p className="text-xs text-muted-foreground truncate mt-1" title={game.tags}>
                        {game.tags.split(",").slice(0, 3).join(", ")}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {(gmzHasMore || gmzLoading) && (
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
