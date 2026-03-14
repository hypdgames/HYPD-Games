"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Heart, Loader2, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import type { Game, FeedItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const AD_FREQUENCY = 6;
const PULL_THRESHOLD = 80;

// Extract the GMZ hash from embed_url for video player
function getGMZHash(embedUrl?: string): string | null {
  if (!embedUrl) return null;
  try {
    const parts = embedUrl.replace(/\/$/, "").split("/");
    const hash = parts[parts.length - 1];
    return hash && hash.length > 10 ? hash : null;
  } catch {
    return null;
  }
}

// Build direct GMZ video embed URL — fallback iframe if direct video unavailable
function buildGMZVideoUrl(hash: string, color = "%23ccff00"): string {
  return `https://gamemonetize.video/index.php?domain=&gameid=${hash}&game=undefined&getads=false&color=${color}`;
}

// Single video card — loads video only when in viewport
function VideoCard({
  game,
  isActive,
  onPlay,
  onSave,
  isSaved,
  showScrollHint,
}: {
  game: Game;
  isActive: boolean;
  onPlay: () => void;
  onSave: (e: React.MouseEvent) => void;
  isSaved: boolean;
  showScrollHint: boolean;
}) {
  const hash = getGMZHash(game.embed_url);
  const hasVideo = game.source === "gamemonetize" && !!hash;
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [directVideoUrl, setDirectVideoUrl] = useState<string | null>(null);
  const [videoFetched, setVideoFetched] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // When card becomes active, fetch direct MP4 URL and load video
  useEffect(() => {
    if (!isActive || !hasVideo || videoFetched) return;
    setVideoFetched(true);

    fetch(`${API_URL}/api/games/${game.id}/video-preview`)
      .then(r => r.json())
      .then(data => {
        if (data.video_url) {
          setDirectVideoUrl(data.video_url);
        }
        setVideoLoaded(true);
      })
      .catch(() => setVideoLoaded(true));
  }, [isActive, hasVideo, game.id, videoFetched]);

  // Play/pause native video based on active state
  useEffect(() => {
    if (!videoRef.current || !directVideoUrl) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive, directVideoUrl]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Background layer */}
      {directVideoUrl ? (
        // Native HTML5 video — muted + autoplay works on ALL browsers including iOS
        <video
          ref={videoRef}
          src={directVideoUrl}
          poster={game.thumbnail_url || undefined}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      ) : videoLoaded && hash ? (
        // Fallback: GMZ iframe player (for games where direct URL unavailable)
        <iframe
          src={buildGMZVideoUrl(hash)}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title={`${game.title} preview`}
        />
      ) : (
        // Thumbnail background while loading
        <>
          <div
            className="absolute inset-0 bg-cover bg-center scale-110"
            style={{
              backgroundImage: `url(${game.thumbnail_url || game.banner_url || ""})`,
              filter: "blur(20px) brightness(0.4)",
            }}
          />
          {game.thumbnail_url && (
            <img
              src={game.thumbnail_url}
              alt={game.title}
              className="absolute inset-0 w-full h-full object-contain z-10"
              loading={isActive ? "eager" : "lazy"}
            />
          )}
          {hasVideo && !videoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <Loader2 className="w-10 h-10 text-lime/60 animate-spin" />
            </div>
          )}
        </>
      )}

      {/* Bottom gradient — only enough to make text readable */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-20" />

      {/* Side action buttons — Save + Play */}
      <div className="absolute right-4 bottom-28 flex flex-col gap-4 z-30">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onSave}
          className="flex flex-col items-center gap-1"
          data-testid={`save-game-btn-${game.id}`}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all ${
            isSaved
              ? "bg-red-500/80 border-red-400"
              : "bg-white/10 border-white/20 hover:bg-white/20"
          }`}>
            <Heart className={`w-6 h-6 ${isSaved ? "fill-white text-white" : "text-white"}`} />
          </div>
          <span className="text-white/70 text-xs font-medium">Save</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onPlay}
          className="flex flex-col items-center gap-1"
          data-testid={`play-now-btn-${game.id}`}
        >
          <div className="w-14 h-14 rounded-full bg-lime flex items-center justify-center shadow-lg shadow-lime/30">
            <Play className="w-7 h-7 fill-black text-black ml-0.5" />
          </div>
          <span className="text-white/70 text-xs font-medium">Play</span>
        </motion.button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-16 z-30 px-5 pb-8 pt-4">
        {/* Category tag */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-lime bg-lime/15 px-2.5 py-1 rounded-full border border-lime/30">
            {game.category}
          </span>
          {game.source === "gamemonetize" && hash && (
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
              Video Preview
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-white font-bold text-xl leading-tight drop-shadow-lg">
          {game.title}
        </h2>
      </div>

      {/* Scroll hint (first card only) */}
      {showScrollHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-36 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/30 z-30 pointer-events-none"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="w-5 h-9 rounded-full border-2 border-white/20 flex items-start justify-center p-1"
          >
            <div className="w-1 h-2.5 bg-white/30 rounded-full" />
          </motion.div>
          <span className="text-xs mt-2 tracking-wide">Swipe up</span>
        </motion.div>
      )}
    </div>
  );
}

export default function GameFeed() {
  const router = useRouter();
  const { user, token, settings } = useAuthStore();

  const [games, setGames] = useState<Game[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedGames, setSavedGames] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);

  const fetchGames = useCallback(async (showToast = false) => {
    try {
      const res = await fetch(`${API_URL}/api/games`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setGames(data);
        const items: FeedItem[] = [];
        data.forEach((game: Game, index: number) => {
          items.push({ type: "game", data: game });
          if ((index + 1) % AD_FREQUENCY === 0 && index < data.length - 1) {
            items.push({ type: "ad", adType: "video" });
          }
        });
        setFeedItems(items);
        if (showToast) toast.success("Feed refreshed!");
      }
    } catch {
      if (showToast) toast.error("Failed to refresh");
    }
  }, []);

  useEffect(() => {
    fetchGames().then(() => setLoading(false));
  }, [fetchGames]);

  useEffect(() => {
    if (user?.saved_games) setSavedGames(new Set(user.saved_games));
  }, [user]);

  // Snap scroll to specific index
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;
    containerRef.current.scrollTo({
      top: index * window.innerHeight,
      behavior: "smooth",
    });
    setCurrentIndex(index);
    setTimeout(() => { isScrollingRef.current = false; }, 500);
  }, []);

  // Track scroll position to update currentIndex
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrollingRef.current) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const idx = Math.round(containerRef.current.scrollTop / window.innerHeight);
      if (idx !== currentIndex) setCurrentIndex(idx);
    }, 100);
  }, [currentIndex]);

  // Touch-based swipe navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { y: e.touches[0].clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !containerRef.current) return;
    const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(deltaY) / elapsed;

    // Pull-to-refresh when at top
    if (currentIndex === 0 && deltaY < -PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      fetchGames(true).then(() => {
        setRefreshing(false);
        scrollToIndex(0);
      });
      return;
    }

    if (Math.abs(deltaY) > 40 || velocity > 0.3) {
      const direction = deltaY > 0 ? 1 : -1;
      const newIndex = Math.max(0, Math.min(feedItems.length - 1, currentIndex + direction));
      scrollToIndex(newIndex);
    }
    touchStartRef.current = null;
  }, [currentIndex, feedItems.length, refreshing, fetchGames, scrollToIndex]);

  const playGame = (gameId: string) => router.push(`/play/${gameId}`);

  const toggleSave = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Please login to save games"); router.push("/profile"); return; }
    const isSaved = savedGames.has(gameId);
    try {
      const res = await fetch(`${API_URL}/api/auth/save-game/${gameId}`, {
        method: isSaved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSavedGames(prev => {
          const next = new Set(prev);
          if (isSaved) next.delete(gameId); else next.add(gameId);
          return next;
        });
        toast.success(isSaved ? "Removed from saved" : "Game saved!");
      }
    } catch { toast.error("Failed to save game"); }
  };


  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-lime animate-spin" />
          <p className="text-white/40 text-sm tracking-wider uppercase">Loading feed</p>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <Play className="w-10 h-10 text-lime" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Games Yet</h2>
        <p className="text-white/40">Games will appear here once added by admin</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black overflow-hidden" data-testid="game-feed">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center">
        {settings?.logo_url ? (
          <img
            src={settings.logo_url}
            alt={settings?.site_name || "Logo"}
            style={{ height: settings.logo_height ? `${settings.logo_height}px` : "32px" }}
            className="object-contain"
          />
        ) : (
          <h1 className="font-bold text-xl text-lime tracking-tight drop-shadow-lg">
            {settings?.site_name || "HYPD"}
          </h1>
        )}
        <ThemeToggle />
      </div>

      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-lime text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            Refreshing
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable feed container */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ scrollSnapType: "y mandatory" }}
      >
        {feedItems.map((item, index) => (
          <div
            key={item.type === "ad" ? `ad-${index}` : item.data!.id}
            className="snap-start h-screen w-full flex-shrink-0"
            style={{ scrollSnapAlign: "start" }}
            data-testid={item.type === "game" ? `game-card-${index}` : `ad-card-${index}`}
          >
            {item.type === "ad" ? (
              // Ad placeholder
              <div className="w-full h-full bg-gradient-to-br from-black to-zinc-900 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-lime" />
                  </div>
                  <p className="text-white/30 text-sm">Advertisement</p>
                </div>
              </div>
            ) : (
              <VideoCard
                game={item.data!}
                isActive={currentIndex === index}
                onPlay={() => playGame(item.data!.id)}
                onSave={(e) => toggleSave(item.data!.id, e)}
                isSaved={savedGames.has(item.data!.id)}
                showScrollHint={index === 0}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
