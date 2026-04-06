"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, Play, Flame, ArrowLeft, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const EXPLORE_CACHE_KEY = "hypd:explore_data";
const EXPLORE_CACHE_TTL = 300 * 1000;

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

const CATEGORY_GRADIENTS: Record<string, string> = {
  Racing: "from-orange-500 to-red-600", Action: "from-red-500 to-rose-700",
  Puzzle: "from-blue-500 to-indigo-600", Adventure: "from-emerald-500 to-teal-600",
  Sports: "from-green-500 to-emerald-600", Strategy: "from-violet-500 to-purple-600",
  Arcade: "from-yellow-500 to-orange-500", Shooter: "from-slate-500 to-zinc-700",
  Simulation: "from-cyan-500 to-blue-600", Casual: "from-pink-400 to-rose-500",
  RPG: "from-purple-500 to-indigo-700", Default: "from-violet-500 to-indigo-600",
};

function getCatGrad(cat: string) {
  return CATEGORY_GRADIENTS[cat] || CATEGORY_GRADIENTS.Default;
}

function fmtCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function TrendingCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const imgSrc = game.thumbnail_url || game.icon_url || "";
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={onClick} className="flex-shrink-0 w-[60%] max-w-[280px] squircle relative cursor-pointer" style={{ aspectRatio: "4/5" }} data-testid={`trending-card-${game.id}`}>
      {imgSrc ? <Image src={imgSrc} alt={game.title} fill className="object-cover" sizes="(max-width: 540px) 60vw, 280px" /> : <div className="absolute inset-0 bg-muted" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-bold text-base leading-tight line-clamp-2">{game.title}</p>
        <p className="text-white/50 text-xs mt-1">{game.category}</p>
      </div>
      {(game.play_count ?? 0) > 0 && (
        <div className="absolute bottom-4 right-4 play-badge flex items-center gap-1">
          <Play className="w-3 h-3 fill-white text-white" /><span>{fmtCount(game.play_count ?? 0)}</span>
        </div>
      )}
    </motion.div>
  );
}

function GameTile({ game, onClick }: { game: Game; onClick: () => void }) {
  const imgSrc = game.icon_url || game.thumbnail_url || "";
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={onClick} className="flex-shrink-0 w-[28%] min-w-[110px] max-w-[140px] cursor-pointer" data-testid={`tile-${game.id}`}>
      <div className="squircle-sm w-full relative" style={{ aspectRatio: "1" }}>
        {imgSrc ? <Image src={imgSrc} alt={game.title} fill className="object-cover" sizes="140px" /> : <div className="w-full h-full bg-muted" />}
      </div>
      <p className="font-semibold text-xs mt-2 line-clamp-1 text-foreground px-0.5">{game.title}</p>
      <p className="text-[11px] text-muted-foreground px-0.5">{game.category}</p>
    </motion.div>
  );
}

function CategoryTile({ name, gameCount, previewImg, firstGameId, onSelect, onQuickPlay }: {
  name: string; gameCount: number; previewImg?: string; firstGameId?: string;
  onSelect: () => void; onQuickPlay: () => void;
}) {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLongPress = useRef(false);

  const handleTouchStart = useCallback(() => {
    wasLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      wasLongPress.current = true;
      setOverlayVisible(true);
    }, 500);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  const handleClick = useCallback(() => {
    if (wasLongPress.current) { wasLongPress.current = false; return; }
    if (overlayVisible) { setOverlayVisible(false); return; }
    onSelect();
  }, [overlayVisible, onSelect]);

  const handleQuickPlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOverlayVisible(false);
    if (firstGameId) onQuickPlay();
  }, [firstGameId, onQuickPlay]);

  return (
    <motion.div
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      className="flex-shrink-0 w-[42%] min-w-[155px] max-w-[185px] cursor-pointer group"
      data-testid={`category-tile-${name}`}>
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: "3/2" }}>
        {previewImg ? (
          <Image src={previewImg} alt={name} fill className="object-cover" sizes="185px" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${getCatGrad(name)}`} />
        )}
        <div className={`absolute inset-0 bg-gradient-to-br ${getCatGrad(name)} opacity-60`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Quick Play overlay — hover on desktop, long-press on mobile */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200
          ${overlayVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {firstGameId && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleQuickPlay}
              className="flex items-center gap-1.5 bg-lime text-black font-bold text-xs px-3.5 py-2 rounded-full shadow-lg"
              data-testid={`quick-play-${name}`}>
              <Play className="w-3 h-3 fill-black" /> Play Now
            </motion.button>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-bold text-sm leading-tight">{name}</p>
          <p className="text-white/60 text-[11px] mt-0.5">{gameCount} games</p>
        </div>
      </div>
    </motion.div>
  );
}

function Section({ title, onViewAll, children }: { title: string; onViewAll?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between px-5 mb-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {onViewAll && <button onClick={onViewAll} className="flex items-center text-muted-foreground text-sm"><span>See all</span><ChevronRight className="w-4 h-4" /></button>}
      </div>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar">
        <div className="flex-none w-2 shrink-0" aria-hidden="true" />{children}<div className="flex-none w-2 shrink-0" aria-hidden="true" />
      </div>
    </section>
  );
}

function CategoryPage({ name, games, onBack, onClick }: { name: string; games: Game[]; onBack: () => void; onClick: (id: string) => void }) {
  return (
    <div className="min-h-screen hook-gradient-bg pb-28">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl px-5 py-3.5 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center" data-testid="back-btn"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-bold text-lg">{name}</h1><span className="text-muted-foreground text-sm">({games.length})</span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-5">
        {games.map(game => {
          const imgSrc = game.icon_url || game.thumbnail_url || "";
          return (
            <motion.div key={game.id} whileTap={{ scale: 0.96 }} onClick={() => onClick(game.id)} className="squircle-sm relative cursor-pointer" style={{ aspectRatio: "1" }}>
              {imgSrc ? <Image src={imgSrc} alt={game.title} fill className="object-cover" sizes="(max-width: 540px) 33vw, 160px" /> : <div className="w-full h-full bg-muted" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-1.5"><p className="text-white font-bold text-[10px] leading-tight line-clamp-2">{game.title}</p></div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cached = sessionGet<Game[]>(EXPLORE_CACHE_KEY, EXPLORE_CACHE_TTL);
    if (cached) { setGames(cached); setLoading(false); return; }
    fetch(`${API_URL}/api/games?feed_only=false`)
      .then(res => res.ok ? res.json() : [])
      .then(gData => { setGames(gData); sessionSet(EXPLORE_CACHE_KEY, gData); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (searchActive) setTimeout(() => searchRef.current?.focus(), 100); }, [searchActive]);

  const playGame = (id: string) => router.push(`/play/${id}`);

  const trending = useMemo(
    () => [...games].sort((a, b) => (b.play_count || 0) - (a.play_count || 0)),
    [games]
  );
  const newGames = useMemo(
    () => [...games].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 10),
    [games]
  );

  // Derive every category directly from the games list — always in sync, no separate API call
  const categoriesWithGames = useMemo(
    () =>
      Array.from(new Set(games.map(g => g.category).filter((c): c is string => !!c)))
        .map(cat => {
          const catGames = games.filter(g => g.category === cat);
          const previewImg = catGames.find(g => g.thumbnail_url)?.thumbnail_url || catGames.find(g => g.icon_url)?.icon_url;
          const firstGameId = [...catGames].sort((a, b) => (b.play_count || 0) - (a.play_count || 0))[0]?.id;
          return { name: cat, games: catGames, previewImg, firstGameId };
        })
        .filter(c => c.games.length >= 1)
        .sort((a, b) => b.games.length - a.games.length),
    [games]
  );

  const searchResults = useMemo(
    () =>
      searchQuery.trim()
        ? games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()) || (g.description || "").toLowerCase().includes(searchQuery.toLowerCase()))
        : [],
    [games, searchQuery]
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 text-violet animate-spin" /></div>;

  if (selectedCategory) return <CategoryPage name={selectedCategory} games={games.filter(g => g.category === selectedCategory)} onBack={() => setSelectedCategory(null)} onClick={playGame} />;

  return (
    <div className="min-h-screen hook-gradient-bg pb-28" data-testid="explore-page">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-foreground">Discover</h1>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 bg-muted rounded-pill px-2.5 py-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" /><span className="text-xs font-bold">{user?.login_streak || 0}</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="px-5 mb-5 relative">
        <Search className="absolute left-9 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
        <input type="text" placeholder="What are you looking for?" readOnly onClick={() => setSearchActive(true)} className="search-bar cursor-pointer" data-testid="search-bar" />
      </div>

      <AnimatePresence>
        {searchActive && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="flex items-center gap-3 px-5 py-3">
              <button onClick={() => { setSearchActive(false); setSearchQuery(""); }} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center" data-testid="search-close-btn"><ArrowLeft className="w-5 h-5" /></button>
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input ref={searchRef} type="text" placeholder="Search games..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="search-bar" data-testid="search-input" />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pt-3 px-5">
              {searchQuery.trim() === "" ? (
                <p className="text-center text-muted-foreground text-sm pt-16">Start typing to search</p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm pt-16">No results for &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {searchResults.map(game => {
                    const imgSrc = game.icon_url || game.thumbnail_url || "";
                    return (
                      <motion.div key={game.id} whileTap={{ scale: 0.96 }} onClick={() => { setSearchActive(false); playGame(game.id); }} className="squircle-sm relative cursor-pointer" style={{ aspectRatio: "1" }}>
                        {imgSrc ? <Image src={imgSrc} alt={game.title} fill className="object-cover" sizes="(max-width: 540px) 33vw, 160px" /> : <div className="w-full h-full bg-muted" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-1.5"><p className="text-white font-bold text-[10px] line-clamp-2">{game.title}</p></div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-7">
        {newGames.length > 0 && <Section title="New Games">{newGames.map(g => <GameTile key={g.id} game={g} onClick={() => playGame(g.id)} />)}</Section>}
        {categoriesWithGames.length > 0 && <Section title="Categories">{categoriesWithGames.map(({ name, games: g, previewImg, firstGameId }) => <CategoryTile key={name} name={name} gameCount={g.length} previewImg={previewImg} firstGameId={firstGameId} onSelect={() => setSelectedCategory(name)} onQuickPlay={() => playGame(firstGameId!)} />)}</Section>}
        {trending.length > 0 && <Section title="Trending">{trending.slice(0, 8).map(g => <TrendingCard key={g.id} game={g} onClick={() => playGame(g.id)} />)}</Section>}
        {categoriesWithGames.slice(0, 5).map(({ name, games: catGames }) => (
          <Section key={name} title={name} onViewAll={() => setSelectedCategory(name)}>{catGames.slice(0, 8).map(g => <GameTile key={g.id} game={g} onClick={() => playGame(g.id)} />)}</Section>
        ))}
      </div>
    </div>
  );
}
