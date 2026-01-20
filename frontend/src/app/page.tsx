"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDrag } from "@use-gesture/react";
import { Play, Heart, Share2, Loader2, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { precacheGame } from "@/components/service-worker";
import { toast } from "sonner";
import type { Game, FeedItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Insert ad every N games
const AD_FREQUENCY = 6;
const PULL_THRESHOLD = 80; // pixels to pull before refresh triggers

export default function GameFeed() {
  const router = useRouter();
  const { user, token, settings } = useAuthStore();
  
  const [games, setGames] = useState<Game[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedGames, setSavedGames] = useState<Set<string>>(new Set());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const precachedRef = useRef<Set<string>>(new Set());

  // Fetch games function (reusable for refresh)
  const fetchGames = useCallback(async (showToast = false) => {
    try {
      const res = await fetch(`${API_URL}/api/games`, {
        cache: "no-store", // Force fresh data on refresh
      });
      if (res.ok) {
        const data = await res.json();
        setGames(data);
        
        // Create feed items with ad placeholders
        const items: FeedItem[] = [];
        data.forEach((game: Game, index: number) => {
          items.push({ type: "game", data: game });
          // Insert ad placeholder every AD_FREQUENCY games
          if ((index + 1) % AD_FREQUENCY === 0 && index < data.length - 1) {
            items.push({ type: "ad", adType: "video" });
          }
        });
        setFeedItems(items);
        
        if (showToast) {
          toast.success("Feed refreshed!");
        }
      }
    } catch (e) {
      console.error("Error fetching games:", e);
      if (showToast) {
        toast.error("Failed to refresh");
      }
    }
  }, []);

  // Initial fetch - only on mount
  useEffect(() => {
    const init = async () => {
      await fetchGames();
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync saved games from user
  useEffect(() => {
    if (user?.saved_games) {
      setSavedGames(new Set(user.saved_games));
    }
  }, [user]);

  // Pre-cache next games when index changes
  useEffect(() => {
    // Pre-cache next 2 games for smooth transitions
    for (let i = 1; i <= 2; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < feedItems.length) {
        const item = feedItems[nextIndex];
        if (item.type === "game" && item.data && !precachedRef.current.has(item.data.id)) {
          precacheGame(item.data.id);
          precachedRef.current.add(item.data.id);
        }
      }
    }
  }, [currentIndex, feedItems]);

  // Virtual list for performance
  const virtualizer = useVirtualizer({
    count: feedItems.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => window.innerHeight,
    overscan: 1,
  });

  // Handle scroll with snap behavior
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    // Fast debounce for responsive feel
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const itemHeight = window.innerHeight;
      const newIndex = Math.round(scrollTop / itemHeight);
      
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < feedItems.length) {
        setCurrentIndex(newIndex);
      }
    }, 50);
  }, [currentIndex, feedItems.length]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await fetchGames(true);
    setRefreshing(false);
    setPullDistance(0);
    // Reset to top
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      setCurrentIndex(0);
    }
  }, [refreshing, fetchGames]);

  // Gesture handling for swipe and pull-to-refresh
  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], last }) => {
      if (!containerRef.current) return;
      
      const scrollTop = containerRef.current.scrollTop;
      const isAtTop = scrollTop <= 0;
      
      // Pull-to-refresh logic (only when at top and pulling down)
      if (isAtTop && my > 0 && currentIndex === 0) {
        if (!last) {
          // While dragging down at top
          const pull = Math.min(my * 0.5, PULL_THRESHOLD + 20);
          setPullDistance(pull);
        } else {
          // On release
          if (pullDistance >= PULL_THRESHOLD) {
            handleRefresh();
          } else {
            setPullDistance(0);
          }
        }
        return;
      }
      
      // Normal swipe navigation
      if (!last) return;
      
      // Lower threshold = more responsive swipes
      const velocityThreshold = 0.15;
      const distanceThreshold = 50;
      
      // Trigger on velocity OR sufficient distance
      if (Math.abs(vy) > velocityThreshold || Math.abs(my) > distanceThreshold) {
        const direction = my < 0 || (vy > velocityThreshold && my === 0) ? 1 : -1;
        const newIndex = direction > 0 
          ? Math.min(feedItems.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
        
        if (newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
          // Instant scroll - CSS snap handles the animation
          containerRef.current.scrollTo({
            top: newIndex * window.innerHeight,
            behavior: "instant",
          });
        }
      }
    },
    { axis: "y", filterTaps: true, threshold: 5 }
  );

  const playGame = (gameId: string) => {
    router.push(`/play/${gameId}`);
  };

  const toggleSave = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please login to save games");
      router.push("/profile");
      return;
    }

    const isSaved = savedGames.has(gameId);
    try {
      const res = await fetch(`${API_URL}/api/auth/save-game/${gameId}`, {
        method: isSaved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSavedGames((prev) => {
          const next = new Set(prev);
          if (isSaved) next.delete(gameId);
          else next.add(gameId);
          return next;
        });
        toast.success(isSaved ? "Removed from saved" : "Game saved!");
      }
    } catch {
      toast.error("Failed to save game");
    }
  };

  const shareGame = async (game: Game, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: game.title,
          text: game.description,
          url: `${window.location.origin}/play/${game.id}`,
        });
      } else {
        await navigator.clipboard.writeText(
          `${window.location.origin}/play/${game.id}`
        );
        toast.success("Link copied to clipboard!");
      }
    } catch (e) {
      console.error("Share error:", e);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-lime animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center mb-6">
          <Play className="w-10 h-10 text-lime" />
        </div>
        <h2 className="text-2xl font-heading text-foreground mb-2">No Games Yet</h2>
        <p className="text-muted-foreground mb-6">
          Games will appear here once added by admin
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="snap-container hide-scrollbar"
      onScroll={handleScroll}
      data-testid="game-feed"
      {...bind()}
    >
      {/* Pull-to-Refresh Indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || refreshing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50"
          >
            <motion.div
              animate={{
                scale: pullDistance >= PULL_THRESHOLD || refreshing ? 1 : pullDistance / PULL_THRESHOLD,
                rotate: refreshing ? 360 : 0,
              }}
              transition={{
                rotate: { repeat: refreshing ? Infinity : 0, duration: 1, ease: "linear" },
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                pullDistance >= PULL_THRESHOLD || refreshing
                  ? "bg-lime text-black"
                  : "bg-card text-foreground border border-border"
              }`}
            >
              <RefreshCw className="w-5 h-5" />
            </motion.div>
            {pullDistance > 20 && !refreshing && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-center mt-2 text-white/70"
              >
                {pullDistance >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 p-4 flex justify-between items-center bg-background/80 backdrop-blur-sm">
        {settings?.logo_url ? (
          <img 
            src={settings.logo_url} 
            alt={settings?.site_name || "Logo"}
            style={{ height: settings.logo_height ? `${settings.logo_height}px` : '32px' }}
            className="object-contain"
          />
        ) : (
          <h1 className="font-heading text-xl text-lime tracking-tight">
            {settings?.site_name || "HYPD"}
          </h1>
        )}
        <ThemeToggle />
      </div>

      {/* Virtual Feed Items */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = feedItems[virtualItem.index];
          
          // Ad placeholder
          if (item.type === "ad") {
            return (
              <div
                key={`ad-${virtualItem.index}`}
                className="snap-item h-[100dvh] w-full absolute top-0 left-0 flex items-center justify-center bg-gradient-to-br from-violet/20 to-lime/10"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-lime" />
                  </div>
                  <p className="text-muted-foreground text-sm">Ad Placeholder</p>
                  <p className="text-xs text-muted-foreground/50 mt-2">
                    Video ad will appear here
                  </p>
                </div>
              </div>
            );
          }
          
          // Game card
          const game = item.data!;
          const isActive = virtualItem.index === currentIndex;
          
          return (
            <div
              key={game.id}
              className="snap-item h-[100dvh] w-full absolute top-0 left-0 overflow-hidden bg-background"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-testid={`game-card-${virtualItem.index}`}
            >
              {/* Animated Background Pattern */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-lime/5 via-background to-violet/5" />
                <div 
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ccff00' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}
                />
              </div>

              {/* Centered Card Content */}
              <div className="relative h-full flex flex-col items-center justify-center px-6 pb-20 pt-16">
                {/* Game Image Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-sm"
                >
                  <div className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-2xl">
                    {/* Game Thumbnail */}
                    <div className="aspect-[4/3] relative">
                      <img
                        src={game.thumbnail_url || "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=800&q=80"}
                        alt={game.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center group cursor-pointer"
                           onClick={() => playGame(game.id)}>
                        <div className="w-16 h-16 rounded-full bg-lime/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
                          <Play className="w-8 h-8 text-black ml-1" fill="black" />
                        </div>
                      </div>
                    </div>

                    {/* Game Info */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <span className="inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-lime/10 text-lime rounded-full mb-2">
                            {game.category}
                          </span>
                          <h2 className="font-heading text-xl text-foreground leading-tight truncate">
                            {game.title}
                          </h2>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => toggleSave(game.id, e)}
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center touch-target transition-all hover:bg-muted/80 active:scale-95"
                            data-testid={`save-game-${virtualItem.index}`}
                          >
                            <Heart
                              className={`w-5 h-5 transition-colors ${
                                savedGames.has(game.id)
                                  ? "fill-red-500 text-red-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                          <button
                            onClick={(e) => shareGame(game, e)}
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center touch-target transition-all hover:bg-muted/80 active:scale-95"
                            data-testid={`share-game-${virtualItem.index}`}
                          >
                            <Share2 className="w-5 h-5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                        {game.description}
                      </p>

                      {/* Play Button */}
                      <button
                        onClick={() => playGame(game.id)}
                        onMouseEnter={() => {
                          const link = document.createElement('link');
                          link.rel = 'prefetch';
                          link.href = `${API_URL}/api/games/${game.id}/play`;
                          document.head.appendChild(link);
                        }}
                        className="w-full py-3.5 bg-lime text-black font-heading text-sm uppercase tracking-widest rounded-xl transition-all hover:bg-lime/90 active:scale-[0.98]"
                        data-testid={`play-button-${virtualItem.index}`}
                      >
                        Play Now
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Scroll Indicator (first item only) */}
                {virtualItem.index === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center text-muted-foreground"
                  >
                    <motion.div
                      animate={{ y: [0, 6, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-5 h-8 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1"
                    >
                      <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
                    </motion.div>
                    <span className="text-xs mt-2">Swipe for more</span>
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Padding for Nav */}
      <div className="h-20" />
    </div>
  );
}

// Game Preview Component - handles video, gif, and image
function GamePreview({
  game,
  isActive,
  muted,
}: {
  game: Game;
  isActive: boolean;
  muted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  // Video preview
  if (game.video_preview_url) {
    return (
      <>
        <video
          ref={videoRef}
          src={game.video_preview_url}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted={muted}
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-black/20" />
      </>
    );
  }

  // GIF preview
  if (game.gif_preview_url) {
    return (
      <>
        <img
          src={game.gif_preview_url}
          alt={game.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
      </>
    );
  }

  // Static image (default)
  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${
            game.thumbnail_url ||
            "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=800&q=80"
          })`,
        }}
      />
      <div className="absolute inset-0 bg-black/40" />
    </>
  );
}
