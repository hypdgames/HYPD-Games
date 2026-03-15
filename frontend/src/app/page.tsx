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
const VIDEO_CACHE_KEY = "hypd:video_urls";
const VIDEO_CACHE_TTL = 3600 * 1000; // 1 hour in ms
const GAMES_CACHE_KEY = "hypd:games_feed";
const GAMES_CACHE_TTL = 30 * 1000; // 30 seconds in ms

function sessionGet<T>(key: string, ttl: number): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) return null;
    return data as T;
  } catch { return null; }
}

function sessionSet(key: string, data: unknown): void {
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* storage full */ }
}

// ─── VideoCard ────────────────────────────────────────────────────────────────
function VideoCard({
  game,
  isActive,
  isAdjacent,
  videoUrl,
  onPlay,
  onSave,
  isSaved,
  showScrollHint,
}: {
  game: Game;
  isActive: boolean;
  isAdjacent: boolean; // card directly before/after active — preload but don't play
  videoUrl: string | null;
  onPlay: () => void;
  onSave: (e: React.MouseEvent) => void;
  isSaved: boolean;
  showScrollHint: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Play active, pause all others
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive, videoUrl]);

  // Determine preload strategy: active/adjacent = auto, far = none
  const preload = isActive || isAdjacent ? "auto" : "none";

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">

      {/* Video — always rendered when url available, preload controlled by proximity */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay={isActive}
          muted
          loop
          playsInline
          preload={preload}
        />
      ) : (
        // No video — show thumbnail as fallback background
        game.thumbnail_url || game.icon_url ? (
          <img
            src={game.thumbnail_url || game.icon_url || ""}
            alt={game.title}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-900" />
        )
      )}

      {/* Bottom gradient for text legibility only */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-20" />

      {/* Side buttons — Save + Play */}
      <div className="absolute right-4 bottom-28 flex flex-col gap-4 z-30">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onSave}
          className="flex flex-col items-center gap-1"
          data-testid={`save-game-btn-${game.id}`}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all ${
            isSaved ? "bg-red-500/80 border-red-400" : "bg-white/10 border-white/20"
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
      <div className="absolute bottom-0 left-0 right-20 z-30 px-5 pb-28">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-lime bg-lime/15 px-2.5 py-1 rounded-full border border-lime/30">
            {game.category}
          </span>
        </div>
        <h2 className="text-white font-bold text-xl leading-tight drop-shadow-lg">
          {game.title}
        </h2>
        {game.description && (
          <p className="text-white/60 text-sm mt-1 line-clamp-2 leading-snug">
            {game.description}
          </p>
        )}
      </div>

      {/* Swipe hint — first card only */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GameFeed() {
  const router = useRouter();
  const { user, token, settings } = useAuthStore();

  const [games, setGames] = useState<Game[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedGames, setSavedGames] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);

  // Fetch games then immediately kick off batch video URL fetch
  const fetchGames = useCallback(async (showToast = false) => {
    try {
      // Check sessionStorage cache first (30s TTL)
      const cachedGames = showToast ? null : sessionGet<Game[]>(GAMES_CACHE_KEY, GAMES_CACHE_TTL);
      let data: Game[];

      if (cachedGames) {
        data = cachedGames;
      } else {
        const res = await fetch(`${API_URL}/api/games`);
        if (!res.ok) return;
        data = await res.json();
        sessionSet(GAMES_CACHE_KEY, data);
      }

      setGames(data);

      const items: FeedItem[] = [];
      data.forEach((game, i) => {
        items.push({ type: "game", data: game });
        if ((i + 1) % AD_FREQUENCY === 0 && i < data.length - 1) {
          items.push({ type: "ad", adType: "video" });
        }
      });
      setFeedItems(items);
      if (showToast) toast.success("Feed refreshed!");

      // Check sessionStorage for cached video URLs (1h TTL)
      const cachedUrls = showToast ? null : sessionGet<Record<string, string>>(VIDEO_CACHE_KEY, VIDEO_CACHE_TTL);
      if (cachedUrls) {
        setVideoUrls(cachedUrls);
      } else {
        // Fetch in background — non-blocking
        fetch(`${API_URL}/api/games/video-previews-batch`)
          .then(r => r.json())
          .then((urls: Record<string, string>) => {
            setVideoUrls(urls);
            sessionSet(VIDEO_CACHE_KEY, urls);
          })
          .catch(() => {});
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

  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;
    containerRef.current.scrollTo({ top: index * window.innerHeight, behavior: "smooth" });
    setCurrentIndex(index);
    setTimeout(() => { isScrollingRef.current = false; }, 500);
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrollingRef.current) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const idx = Math.round(containerRef.current.scrollTop / window.innerHeight);
      if (idx !== currentIndex) setCurrentIndex(idx);
    }, 100);
  }, [currentIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { y: e.touches[0].clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !containerRef.current) return;
    const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(deltaY) / elapsed;

    if (currentIndex === 0 && deltaY < -80 && !refreshing) {
      setRefreshing(true);
      fetchGames(true).then(() => { setRefreshing(false); scrollToIndex(0); });
      return;
    }
    if (Math.abs(deltaY) > 40 || velocity > 0.3) {
      const dir = deltaY > 0 ? 1 : -1;
      scrollToIndex(Math.max(0, Math.min(feedItems.length - 1, currentIndex + dir)));
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
        <Loader2 className="w-10 h-10 text-lime animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-8 text-center">
        <Play className="w-10 h-10 text-lime mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">No Games Yet</h2>
        <p className="text-white/40">Games will appear here once added by admin</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black overflow-hidden" data-testid="game-feed">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <div className="pointer-events-auto">
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
        </div>
        <div className="pointer-events-auto">
          <ThemeToggle />
        </div>
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

      {/* Feed */}
      <div
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {feedItems.map((item, index) => (
          <div
            key={item.type === "ad" ? `ad-${index}` : item.data!.id}
            className="snap-start h-screen w-full flex-shrink-0"
            data-testid={item.type === "game" ? `game-card-${index}` : `ad-card-${index}`}
          >
            {item.type === "ad" ? (
              <div className="w-full h-full bg-zinc-950 flex items-center justify-center">
                <p className="text-white/20 text-sm">Advertisement</p>
              </div>
            ) : (
              <VideoCard
                game={item.data!}
                isActive={currentIndex === index}
                isAdjacent={Math.abs(currentIndex - index) === 1}
                videoUrl={videoUrls[item.data!.id] ?? null}
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
