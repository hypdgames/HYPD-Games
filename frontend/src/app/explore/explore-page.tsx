"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Gamepad2, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ExplorePage() {
  const router = useRouter();
  const { settings } = useAuthStore();
  
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gamesRes, categoriesRes] = await Promise.all([
          fetch(`${API_URL}/api/games`),
          fetch(`${API_URL}/api/categories`),
        ]);

        if (gamesRes.ok) {
          const gamesData = await gamesRes.json();
          setGames(gamesData);
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData.categories || []);
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      const results = games.filter((game) =>
        game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [searchQuery, games]);

  // Group games by category
  const gamesByCategory = categories.reduce((acc, category) => {
    acc[category] = games.filter((game) => game.category === category);
    return acc;
  }, {} as Record<string, Game[]>);

  const playGame = (gameId: string) => {
    router.push(`/play/${gameId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-lime animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="explore-page">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-8" />
              ) : (
                <h1 className="font-heading text-xl text-lime tracking-tight">
                  {settings?.site_name || "HYPD"}
                </h1>
              )}
              <span className="text-muted-foreground text-sm">Explore</span>
            </div>
            <ThemeToggle />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-11 bg-card border-border rounded-xl text-foreground placeholder:text-muted-foreground"
              data-testid="search-input"
            />
          </div>
        </div>
      </div>

      {/* Search Results */}
      {isSearching ? (
        <div className="p-4">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Search Results
            <span className="text-muted-foreground font-normal ml-2">
              ({searchResults.length})
            </span>
          </h2>
          {searchResults.length === 0 ? (
            <div className="text-center py-12">
              <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No games found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {searchResults.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => playGame(game.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Category Sections */
        <div className="py-4">
          {categories.map((category) => {
            const categoryGames = gamesByCategory[category] || [];
            if (categoryGames.length === 0) return null;

            return (
              <CategorySection
                key={category}
                title={category}
                games={categoryGames}
                onGameClick={playGame}
                onViewAll={() => setSearchQuery(category)}
              />
            );
          })}

          {/* All Games Section */}
          {games.length > 0 && (
            <CategorySection
              title="All Games"
              games={games}
              onGameClick={playGame}
              showViewAll={false}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Category Section Component
function CategorySection({
  title,
  games,
  onGameClick,
  onViewAll,
  showViewAll = true,
}: {
  title: string;
  games: Game[];
  onGameClick: (gameId: string) => void;
  onViewAll?: () => void;
  showViewAll?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="mb-6">
      {/* Category Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {showViewAll && games.length > 4 && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-lime hover:text-lime/80 transition-colors"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Horizontal Scroll Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto hide-scrollbar px-4 pb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {games.slice(0, 12).map((game, index) => (
          <div
            key={game.id}
            className="flex-shrink-0"
            style={{ scrollSnapAlign: "start" }}
          >
            <GameCard
              game={game}
              onClick={() => onGameClick(game.id)}
              index={index}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// Game Card Component
function GameCard({
  game,
  onClick,
  index = 0,
}: {
  game: Game;
  onClick: () => void;
  index?: number;
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer w-[130px] md:w-[150px]"
      data-testid={`game-card-${index}`}
    >
      {/* Image */}
      <div className="aspect-[4/3] relative overflow-hidden rounded-xl bg-card border border-border group-hover:border-lime/50 transition-all group-hover:scale-[1.02]">
        <img
          src={
            game.thumbnail_url ||
            "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=400&q=80"
          }
          alt={game.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Title - Below Image */}
      <div className="pt-2">
        <h3 className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
          {game.title}
        </h3>
      </div>
    </div>
  );
}
