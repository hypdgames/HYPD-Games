import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Gamepad2, Zap, Brain, Rocket, Target, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/App";
import ThemeToggle from "@/components/ThemeToggle";

const categoryIcons = {
  "Action": Zap,
  "Puzzle": Brain,
  "Arcade": Gamepad2,
  "Racing": Rocket,
  "Sports": Target
};

const categoryColors = {
  "Action": "from-red-500/20 to-orange-500/20",
  "Puzzle": "from-blue-500/20 to-purple-500/20",
  "Arcade": "from-lime/20 to-green-500/20",
  "Racing": "from-cyan-500/20 to-blue-500/20",
  "Sports": "from-yellow-500/20 to-orange-500/20"
};

export default function Explore() {
  const { API, settings } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gamesRes, categoriesRes] = await Promise.all([
          fetch(`${API}/games`),
          fetch(`${API}/categories`)
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
  }, [API]);

  const filteredGames = games.filter(game => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         game.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || game.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const playGame = (gameId) => {
    navigate(`/play/${gameId}`);
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
      <div className="sticky top-0 z-30 glass p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">HYPD</h1>
            )}
            <span className="text-muted-foreground">Explore</span>
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
            className="pl-12 h-12 bg-card border-border rounded-xl text-foreground placeholder:text-muted-foreground"
            data-testid="search-input"
          />
        </div>
      </div>

      <div className="p-4">
        {/* Categories */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Categories</h2>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`flex-shrink-0 px-5 py-3 rounded-full font-medium transition-all ${
                selectedCategory === "all"
                  ? "bg-lime text-black"
                  : "bg-card text-foreground border border-border hover:border-lime/50"
              }`}
              data-testid="category-all"
            >
              All Games
            </button>
            {categories.map(category => {
              const Icon = categoryIcons[category] || Gamepad2;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all ${
                    selectedCategory === category
                      ? "bg-lime text-black"
                      : "bg-card text-foreground border border-border hover:border-lime/50"
                  }`}
                  data-testid={`category-${category.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  {category}
                </button>
              );
            })}
          </div>
        </section>

        {/* Games Grid */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-4">
            {selectedCategory === "all" ? "All Games" : selectedCategory}
            <span className="text-muted-foreground font-normal ml-2">
              ({filteredGames.length})
            </span>
          </h2>
          
          {filteredGames.length === 0 ? (
            <div className="text-center py-12">
              <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No games found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => playGame(game.id)}
                  className="group cursor-pointer game-card-hover"
                  data-testid={`explore-game-${index}`}
                >
                  <div className="aspect-square relative overflow-hidden rounded-2xl bg-card border border-white/5 group-hover:border-lime/50 transition-colors">
                    {/* Background Image */}
                    <img
                      src={game.thumbnail_url || "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=400&q=80"}
                      alt={game.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                    />
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Category Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-sm text-white rounded-full">
                        {game.category}
                      </span>
                    </div>
                    
                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="font-heading text-sm text-white truncate">
                        {game.title}
                      </h3>
                      <p className="text-xs text-white/50 mt-1">
                        {game.play_count?.toLocaleString() || 0} plays
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
