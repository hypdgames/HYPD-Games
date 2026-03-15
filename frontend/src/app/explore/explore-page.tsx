"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, Flame, Gem, UserPlus, ArrowLeft, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const EXPLORE_CACHE_KEY = "hypd:explore_data";
const EXPLORE_CACHE_TTL = 30 * 1000; // 30 seconds

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

const CATEGORY_EMOJI: Record<string, string> = {
  Racing: "🏎", Action: "⚔️", Puzzle: "🧩", Adventure: "🗺️",
  Sports: "⚽", Strategy: "♟️", Arcade: "🕹️", Shooter: "🎯",
  Simulation: "🏗️", Casual: "🎮", RPG: "🧙", Horror: "👻",
  Multiplayer: "👥", Platformer: "🏃", Fighting: "🥊", Hypercasual: "⚡",
  Idle: "💤", Clicker: "👆", Card: "🃏", Match: "💎",
  "Tower Defense": "🏰", Default: "🎲",
};

function getCategoryEmoji(cat: string) {
  return CATEGORY_EMOJI[cat] || CATEGORY_EMOJI.Default;
}

// ── Big portrait card (horizontal scroll sections) ───────────────────────────
function BigCard({ game, onClick }: { game: Game; onClick: () => void }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex-shrink-0 w-[58vw] max-w-[220px] rounded-2xl overflow-hidden cursor-pointer"
      style={{ aspectRatio: "3/4" }}
      data-testid={`big-card-${game.id}`}
    >
      <img
        src={game.thumbnail_url || game.icon_url || ""}
        alt={game.title}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      {/* gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow">{game.title}</p>
      </div>
    </motion.div>
  );
}

// ── Small square card (per-category horizontal scroll) ───────────────────────
function SmallCard({ game, onClick }: { game: Game; onClick: () => void }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex-shrink-0 w-[42vw] max-w-[160px] rounded-xl overflow-hidden cursor-pointer"
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
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-white font-bold text-xs leading-tight line-clamp-2 drop-shadow">{game.title}</p>
      </div>
    </motion.div>
  );
}

// ── Category emoji tile ───────────────────────────────────────────────────────
function CategoryTile({ name, onSelect }: { name: string; onSelect: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onSelect}
      className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-[72px] h-[72px] rounded-2xl bg-card border border-border"
      data-testid={`category-tile-${name}`}
    >
      <span className="text-2xl leading-none">{getCategoryEmoji(name)}</span>
      <span className="text-foreground/80 text-[10px] font-semibold leading-tight text-center px-1 line-clamp-1">{name}</span>
    </motion.button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 mb-3">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {onViewAll && (
        <button onClick={onViewAll} className="flex items-center gap-0.5 text-lime text-sm font-medium" data-testid={`view-all-${title}`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Horizontal scroll row ─────────────────────────────────────────────────────
// NOTE: We use spacer divs instead of padding-left/right because iOS Safari
// does NOT apply padding correctly on overflow:auto flex containers (WebKit bug).
// Spacer width = 12px + gap-3 (12px) = 24px effective left/right inset.
function HScroll({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 overflow-x-auto hide-scrollbar pb-1"
      style={{ scrollSnapType: "x mandatory" }}
    >
      <div className="flex-none w-3 shrink-0" aria-hidden="true" />
      {children}
      <div className="flex-none w-3 shrink-0" aria-hidden="true" />
    </div>
  );
}


// ── Search results grid ───────────────────────────────────────────────────────
function SearchGrid({ games, onClick }: { games: Game[]; onClick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-6">
      {games.map(game => (
        <motion.div
          key={game.id}
          whileTap={{ scale: 0.96 }}
          onClick={() => onClick(game.id)}
          className="relative rounded-xl overflow-hidden cursor-pointer"
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

// ── Category drilldown page ───────────────────────────────────────────────────
function CategoryPage({ name, games, onBack, onClick }: { name: string; games: Game[]; onBack: () => void; onClick: (id: string) => void }) {
  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-foreground/70 hover:text-foreground" data-testid="back-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xl mr-2">{getCategoryEmoji(name)}</span>
        <h1 className="font-bold text-lg text-foreground">{name}</h1>
        <span className="text-muted-foreground text-sm ml-1">({games.length})</span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-6">
        {games.map(game => (
          <motion.div key={game.id} whileTap={{ scale: 0.96 }} onClick={() => onClick(game.id)}
            className="relative rounded-xl overflow-hidden cursor-pointer" style={{ aspectRatio: "1/1" }}>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
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
    // Check sessionStorage cache first (30s TTL)
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

  // Derive sections
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

  // Category drilldown
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
    <div className="min-h-screen bg-background pb-28" data-testid="explore-page">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: logo + streak + coins */}
          <div className="flex items-center gap-3">
            <button className="text-foreground/60 hover:text-foreground transition-colors" data-testid="add-friend-btn">
              <UserPlus className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2.5 py-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-bold text-foreground">{user?.login_streak || 0}</span>
            </div>
            <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2.5 py-1">
              <Gem className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-bold text-foreground">{user?.coin_balance || 0}</span>
            </div>
          </div>

          {/* Right: search icon */}
          <button
            onClick={() => setSearchActive(true)}
            className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
            data-testid="search-toggle-btn"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Search overlay ── */}
      <AnimatePresence>
        {searchActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Search header */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
              <button onClick={() => { setSearchActive(false); setSearchQuery(""); }} data-testid="search-close-btn">
                <ArrowLeft className="w-5 h-5 text-foreground/70" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-lime/50"
                  data-testid="search-input"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto pt-4">
              {searchQuery.trim() === "" ? (
                <p className="text-center text-muted-foreground text-sm pt-12">Start typing to search games</p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm pt-12">No games found for &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <>
                  <p className="px-6 mb-3 text-sm text-muted-foreground">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</p>
                  <SearchGrid games={searchResults} onClick={id => { setSearchActive(false); playGame(id); }} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Feed ── */}
      <div className="py-5 space-y-7">

        {/* Recommended For You */}
        {games.length > 0 && (
          <section>
            <SectionHeader title="Recommended For You" />
            <HScroll>
              {games.slice(0, 10).map(game => (
                <div key={game.id} style={{ scrollSnapAlign: "start" }}>
                  <BigCard game={game} onClick={() => playGame(game.id)} />
                </div>
              ))}
            </HScroll>
          </section>
        )}

        {/* Categories */}
        {categoriesWithGames.length > 0 && (
          <section>
            <SectionHeader title="Categories" />
            <HScroll>
              {categoriesWithGames.map(({ name }) => (
                <div key={name} style={{ scrollSnapAlign: "start" }}>
                  <CategoryTile name={name} onSelect={() => setSelectedCategory(name)} />
                </div>
              ))}
            </HScroll>
          </section>
        )}

        {/* New Games — horizontal scroll of square cards */}
        {newGames.length > 0 && (
          <section>
            <SectionHeader title="New Games" />
            <HScroll>
              {newGames.map(game => (
                <div key={game.id} style={{ scrollSnapAlign: "start" }}>
                  <SmallCard game={game} onClick={() => playGame(game.id)} />
                </div>
              ))}
            </HScroll>
          </section>
        )}

        {/* Trending */}
        {trending.length > 0 && (
          <section>
            <SectionHeader title="🔥 Trending" />
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
              title={`${getCategoryEmoji(name)} ${name}`}
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
