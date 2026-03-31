"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Play, Heart, Share2, Bookmark, Loader2 } from "lucide-react";
import Image from "next/image";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import type { Game, FeedItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const AD_FREQUENCY = 6;
const VIDEO_CACHE_KEY = "hypd:video_cache_v2";
const VIDEO_CACHE_TTL = 3600 * 1000;
const GAMES_CACHE_KEY = "hypd:games_feed";
const GAMES_CACHE_TTL = 300 * 1000;

const gameFingerprint = (games: Game[]) => games.map(g => g.id).sort().join("|");
interface VideoCache { urls: Record<string, string>; fp: string; }

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
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

function FeedCard({
  game, isActive, isAdjacent, videoUrl, onPlay, onSave, isSaved,
}: {
  game: Game; isActive: boolean; isAdjacent: boolean; videoUrl: string | null;
  onPlay: () => void; onSave: (e: React.MouseEvent) => void; isSaved: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    if (isActive) { videoRef.current.play().catch(() => {}); }
    else { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, [isActive, videoUrl]);

  const imgSrc = game.thumbnail_url || game.icon_url || "";

  return (
    <div className="flex flex-col h-full pt-[68px] pb-[84px] px-4">
      <div className="content-card relative bg-black w-full flex-1 min-h-0 cursor-pointer" onClick={onPlay} data-testid={`game-card-${game.id}`}>
        {videoUrl ? (
          <video ref={videoRef} src={videoUrl} className="absolute inset-0 w-full h-full object-cover"
            autoPlay={isActive} muted loop playsInline preload={isActive || isAdjacent ? "auto" : "none"} />
        ) : imgSrc ? (
          <Image src={imgSrc} alt={game.title} fill className="object-cover" sizes="(max-width: 540px) 100vw, 540px" priority={isActive} />
        ) : (
          <div className="absolute inset-0 bg-zinc-900" />
        )}

        <div className="absolute bottom-0 left-0 right-0 h-44 game-overlay pointer-events-none" />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
            <Play className="w-8 h-8 fill-white text-white ml-1" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-lime bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-pill">{game.category}</span>
          <h2 className="text-white font-bold text-2xl mt-2 leading-tight drop-shadow-lg">{game.title}</h2>
          {game.description && <p className="text-white/50 text-sm mt-1 line-clamp-2">{game.description}</p>}
        </div>

        {(game.play_count ?? 0) > 0 && (
          <div className="absolute top-4 right-4 play-badge flex items-center gap-1.5 z-10">
            <Play className="w-3 h-3 fill-white text-white" />
            <span>{(game.play_count ?? 0) >= 1000 ? `${((game.play_count ?? 0) / 1000).toFixed(1)}K` : game.play_count}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 mt-3 flex-shrink-0">
        <button onClick={onPlay} className="action-pill flex-1 justify-center bg-lime text-black font-bold" data-testid={`play-btn-${game.id}`}>
          <Play className="w-4 h-4 fill-black" /> Play Now
        </button>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onSave}
          className={`action-pill ${isSaved ? "bg-red-500/15 text-red-500" : ""}`} data-testid={`save-btn-${game.id}`}>
          <Heart className={`w-4 h-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} className="action-pill" data-testid={`share-btn-${game.id}`}>
          <Share2 className="w-4 h-4" />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} className="action-pill" data-testid={`bookmark-btn-${game.id}`}>
          <Bookmark className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}

export default function GameFeed() {
  const router = useRouter();
  const { user, token, settings } = useAuthStore();

  const [games, setGames] = useState<Game[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedGames, setSavedGames] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const cachedGames = sessionGet<Game[]>(GAMES_CACHE_KEY, GAMES_CACHE_TTL);
      let data: Game[];
      if (cachedGames) { data = cachedGames; }
      else {
        const res = await fetch(`${API_URL}/api/games`);
        if (!res.ok) return;
        data = await res.json();
        sessionSet(GAMES_CACHE_KEY, data);
      }
      setGames(data);
      const items: FeedItem[] = [];
      data.forEach((game, i) => {
        items.push({ type: "game", data: game });
        if ((i + 1) % AD_FREQUENCY === 0 && i < data.length - 1) items.push({ type: "ad", adType: "video" });
      });
      setFeedItems(items);

      const fp = gameFingerprint(data);
      const cachedVideo = sessionGet<VideoCache>(VIDEO_CACHE_KEY, VIDEO_CACHE_TTL);
      if (cachedVideo && cachedVideo.fp === fp) { setVideoUrls(cachedVideo.urls); }
      else {
        fetch(`${API_URL}/api/games/video-previews-batch`)
          .then(r => r.json())
          .then((urls: Record<string, string>) => { setVideoUrls(urls); sessionSet(VIDEO_CACHE_KEY, { urls, fp } as VideoCache); })
          .catch(() => {});
      }
    } catch {}
  }, []);

  useEffect(() => { fetchGames().then(() => setLoading(false)); }, [fetchGames]);
  useEffect(() => { if (user?.saved_games) setSavedGames(new Set(user.saved_games)); }, [user]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const idx = Math.round(containerRef.current.scrollTop / window.innerHeight);
      if (idx !== currentIndex) setCurrentIndex(idx);
    }, 80);
  }, [currentIndex]);

  const playGame = (gameId: string) => router.push(`/play/${gameId}`);

  const toggleSave = async (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Please login to save games"); router.push("/profile"); return; }
    const isSaved = savedGames.has(gameId);
    try {
      const res = await fetch(`${API_URL}/api/auth/save-game/${gameId}`, {
        method: isSaved ? "DELETE" : "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSavedGames(prev => { const next = new Set(prev); if (isSaved) next.delete(gameId); else next.add(gameId); return next; });
        toast.success(isSaved ? "Removed from saved" : "Game saved!");
      }
    } catch { toast.error("Failed to save game"); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 text-violet animate-spin" /></div>;
  if (games.length === 0) return (
    <div className="h-screen flex flex-col items-center justify-center px-8 text-center">
      <Play className="w-10 h-10 text-violet mb-4" /><h2 className="text-2xl font-bold mb-2">No Games Yet</h2><p className="text-muted-foreground">Games will appear once added</p>
    </div>
  );

  return (
    <div className="relative h-[100dvh] hook-gradient-bg" data-testid="game-feed">
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="mx-auto w-full max-w-[540px] flex items-center justify-between px-5 pt-4 pb-2 pointer-events-auto">
          <div>
            {settings?.logo_url ? (
              <Image src={settings.logo_url} alt={settings?.site_name || "Logo"} width={120} height={28} className="object-contain" style={{ height: settings.logo_height ? `${settings.logo_height}px` : "28px", width: "auto" }} priority />
            ) : (
              <h1 className="font-extrabold text-2xl text-foreground tracking-tight">{settings?.site_name || "HYPD"}</h1>
            )}
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div ref={containerRef} className="h-full overflow-y-scroll hide-scrollbar" style={{ scrollSnapType: "y mandatory" }} onScroll={handleScroll}>
        {feedItems.map((item, index) => (
          <div key={item.type === "ad" ? `ad-${index}` : item.data!.id} className="h-[100dvh] w-full flex-shrink-0" style={{ scrollSnapAlign: "start" }}>
            {item.type === "ad" ? (
              <div className="w-full h-full flex items-center justify-center"><p className="text-muted-foreground text-sm">Advertisement</p></div>
            ) : (
              <FeedCard game={item.data!} isActive={currentIndex === index} isAdjacent={Math.abs(currentIndex - index) === 1}
                videoUrl={videoUrls[item.data!.id] ?? null} onPlay={() => playGame(item.data!.id)}
                onSave={(e) => toggleSave(item.data!.id, e)} isSaved={savedGames.has(item.data!.id)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
