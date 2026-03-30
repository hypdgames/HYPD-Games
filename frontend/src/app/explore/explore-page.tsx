"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, Flame, Gem, ArrowLeft, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const EXPLORE_CACHE_KEY = "hypd:explore_data";
const EXPLORE_CACHE_TTL = 30 * 1000;

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
  Racing: "from-orange-500/80 to-red-600/80",
  Action: "from-red-500/80 to-rose-700/80",
  Puzzle: "from-blue-500/80 to-indigo-600/80",
  Adventure: "from-emerald-500/80 to-teal-600/80",
  Sports: "from-green-500/80 to-emerald-600/80",
  Strategy: "from-violet-500/80 to-purple-600/80",
  Arcade: "from-yellow-500/80 to-orange-500/80",
  Shooter: "from-slate-500/80 to-zinc-700/80",
  Simulation: "from-cyan-500/80 to-blue-600/80",
  Casual: "from-pink-400/80 to-rose-500/80",
  RPG: "from-purple-500/80 to-indigo-700/80",
  Horror: "from-gray-700/80 to-zinc-900/80",
  Multiplayer: "from-sky-500/80 to-blue-600/80",
  Platformer: "from-lime-500/80 to-green-600/80",
  Fighting: "from-red-600/80 to-orange-600/80",
  Hypercasual: "from-fuchsia-500/80 to-pink-600/80",
  Default: "from-violet-500/80 to-indigo-600/80",
};

function getCategoryGradient(cat: string) {
  return CATEGORY_GRADIENTS[cat] || CATEGORY_GRADIENTS.Default;
}

// Big portrait card
function BigCard({ game, onClick }: { game: Game; onClick: () => void }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex-shrink-0 w-[58vw] max-w-[220px] squircle cursor-pointer"
      style={{ aspectRatio: "3/4" }}
      data-testid={`big-card-${game.id}`}
    >
      <img
        src={game.thumbnail_url || game.icon_url || ""}
        alt={game.title}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3.5">
        <p className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow">{game.title}</p>
        {game.category && (
          <span className="text-white/50 text-[11px] mt-1 block">{game.category}</span>
        )}
      </div>
    </motion.div>
  );
}

// Small card
function SmallCard({ game, onClick }: { game: Game; onClick: () => void }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex-shrink-0 w-[42vw] max-w-[160px] squircle cursor-pointer"
      style={{ aspectRatio: "1/1" }}
      data-testid={`small-card-${game.id}`}
    >
      <img
        src={game.icon_url || game.thumbnail_url || ""}
        alt={game.title}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white font-bold text-xs leading-tight line-clamp-2 drop-shadow">{game.title}</p>
      </div>
    </motion.div>
  );
}

// Category tile with gradient bg
function CategoryTile({ name, onSelect }: { name: string; onSelect: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onSelect}
      className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-[76px] h-[76px] rounded-[20px] bg-gradient-to-br ${getCategoryGradient(name)}`}
      data-testid={`category-tile-${name}`}
    >
      <span className="text-white font-bold text-[11px] leading-tight text-center px-1 line-clamp-2">{name}</span>
    </motion.button>
  );
}

// Section header
function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 mb-3">
      <h2 className="text-[20px] font-bold text-foreground tracking-tight lowercase">{title}</h2>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-0.5 text-muted-foreground text-sm font-medium" data-testid={`view-all-${title}`}>
          <span className="text-[13px]">see all</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Horizontal scroll with iOS Safari fix
function HScroll({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 overflow-x-auto hide-scrollbar pb-1"
      style={{ scrollSnapType: "x mandatory" }}
    >
      <div className="flex-none w-1 shrink-0" aria-hidden="true" />
      {children}
      <div className="flex-none w-1 shrink-0" aria-hidden="true" />
    </div>
  );
}

// Search grid
function SearchGrid({ games, onClick }: { games: Game[]; onClick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4">
      {games.map(game => (
        <motion.div
          key={game.id}
          whileTap={{ scale: 0.96 }}
          onClick={() => onClick(game.id)}
          className="relative squircle cursor-pointer"
          style={{ aspectRatio: "1/1" }}
        >
          <img src={game.icon_url || game.thumbnail_url || ""} alt={game.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-1.5">
            <p className="text-white font-bold text-[10px] leading-tight line-clamp-2">{game.title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Category drilldown
function CategoryPage({ name, games, onBack, onClick }: { name: string; games: Game[]; onBack: () => void; onClick: (id: string) => void }) {
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-4 py-3.5 flex items-center gap-3 border-b border-border/50">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground" data-testid="back-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg text-foreground lowercase">{name}</h1>
        <span className="text-muted-foreground text-sm">({games.length})</span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        {games.map(game => (
          <motion.div key={game.id} whileTap={{ scale: 0.96 }} onClick={() => onClick(game.id)}
            className="relative squircle cursor-pointer" style={{ aspectRatio: "1/1" }}>
            <img src={game.icon_url || game.thumbnail_url || ""} alt={game.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-1.5">
              <p className="text-white font-bold text-[10px] leading-tight line-clamp-2">{game.title}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Main page
export default function ExplorePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cached = sessionGet<{ games: Game[]; categories: string[] }>(EXPLORE_CACHE_KEY, EXPLORE_CACHE_TTL);
    if (cached) {
      setGames(cached.games);
      setCategories(cached.categories);
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API_URL}/api/games?feed_only=false`),
      fetch(`${API_URL}/api/categories`),
    ]).then(async ([gRes, cRes]) => {
      const gamesData = gRes.ok ? await gRes.json() : [];
      const catData = cRes.ok ? (await cRes.json()).categories || [] : [];
      setGames(gamesData);
      setCategories(catData);
      sessionSet(EXPLORE_CACHE_KEY, { games: gamesData, categories: catData });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (searchActive) setTimeout(() => searchRef.current?.focus(), 100);
  }, [searchActive]);

  const playGame = (id: string) => router.push(`/play/${id}`);

  const allByDate = [...games].sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
  const trending = [...games].sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 10);
  const newGames = allByDate.slice(0, 9);
  const categoriesWithGames = categories
    .map(cat => ({ name: cat, games: games.filter(g => g.category === cat) }))
    .filter(c => c.games.length >= 1)
    .sort((a, b) => b.games.length - a.games.length);

  const searchResults = searchQuery.trim()
    ? games.filter(g =>
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 text-lime animate-spin" />
    </div>
  );

  if (selectedCategory) {
    return (
      <CategoryPage
        name={selectedCategory}
        games={games.filter(g => g.category === selectedCategory)}
        onBack={() => setSelectedCategory(null)}
        onClick={playGame}
      />
    );
  }

  return (
    <div className="min-h-screen page-gradient pb-28" data-testid="explore-page">

      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground lowercase tracking-tight">explore</h1>
            <div className="flex items-center gap-1 bg-muted rounded-pill px-2.5 py-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-bold text-foreground">{user?.login_streak || 0}</span>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-pill px-2.5 py-1">
              <Gem className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-bold text-foreground">{user?.coin_balance || 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setSearchActive(true)}
              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
              data-testid="search-toggle-btn"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Search overlay */}
      <AnimatePresence>
        {searchActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => { setSearchActive(false); setSearchQuery(""); }} data-testid="search-close-btn"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-muted rounded-[16px] text-foreground text-[15px] placeholder:text-muted-foreground outline-none border-0"
                  data-testid="search-input"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pt-4">
              {searchQuery.trim() === "" ? (
                <p className="text-center text-muted-foreground text-sm pt-12">Start typing to search games</p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm pt-12">No games found for &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <>
                  <p className="px-4 mb-3 text-sm text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</p>
                  <SearchGrid games={searchResults} onClick={id => { setSearchActive(false); playGame(id); }} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <div className="py-6 space-y-8">

        {/* New Games */}
        {newGames.length > 0 && (
          <section>
            <SectionHeader title="new games" />
            <HScroll>
              {newGames.map(game => (
                <div key={game.id} style={{ scrollSnapAlign: "start" }}>
                  <SmallCard game={game} onClick={() => playGame(game.id)} />
                </div>
              ))}
            </HScroll>
          </section>
        )}

        {/* Categories */}
        {categoriesWithGames.length > 0 && (
          <section>
            <SectionHeader title="categories" />
            <HScroll>
              {categoriesWithGames.map(({ name }) => (
                <div key={name} style={{ scrollSnapAlign: "start" }}>
                  <CategoryTile name={name} onSelect={() => setSelectedCategory(name)} />
                </div>
              ))}
            </HScroll>
          </section>
        )}

        {/* Trending */}
        {trending.length > 0 && (
          <section>
            <SectionHeader title="trending" />
            <HScroll>
              {trending.map(game => (
                <div key={game.id} style={{ scrollSnapAlign: "start" }}>
                  <BigCard game={game} onClick={() => playGame(game.id)} />
                </div>
              ))}
            </HScroll>
          </section>
        )}

        {/* Per-category rows */}
        {categoriesWithGames.map(({ name, games: catGames }) => (
          <section key={name}>
            <SectionHeader
              title={name.toLowerCase()}
              onViewAll={() => setSelectedCategory(name)}
            />
            <HScroll>
              {catGames.slice(0, 10).map(game => (
                <div key={game.id} style={{ scrollSnapAlign: "start" }}>
                  <SmallCard game={game} onClick={() => playGame(game.id)} />
                </div>
              ))}
            </HScroll>
          </section>
        ))}
      </div>
    </div>
  );
}
