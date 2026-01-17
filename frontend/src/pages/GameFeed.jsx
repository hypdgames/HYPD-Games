import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Volume2, VolumeX, Heart, Share2, Loader2 } from "lucide-react";
import { useAuth } from "@/App";
import { toast } from "sonner";

export default function GameFeed() {
  const { API, user, token, settings } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [savedGames, setSavedGames] = useState(new Set(user?.saved_games || []));
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch(`${API}/games`);
        if (res.ok) {
          const data = await res.json();
          setGames(data);
        }
      } catch (e) {
        console.error("Error fetching games:", e);
      }
      setLoading(false);
    };
    fetchGames();
  }, [API]);

  useEffect(() => {
    if (user?.saved_games) {
      setSavedGames(new Set(user.saved_games));
    }
  }, [user]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const itemHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < games.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, games.length]);

  const playGame = (gameId) => {
    navigate(`/play/${gameId}`);
  };

  const toggleSave = async (gameId, e) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please login to save games");
      navigate("/profile");
      return;
    }

    const isSaved = savedGames.has(gameId);
    try {
      const res = await fetch(`${API}/auth/save-game/${gameId}`, {
        method: isSaved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSavedGames(prev => {
          const next = new Set(prev);
          if (isSaved) next.delete(gameId);
          else next.add(gameId);
          return next;
        });
        toast.success(isSaved ? "Removed from saved" : "Game saved!");
      }
    } catch (e) {
      toast.error("Failed to save game");
    }
  };

  const shareGame = async (game, e) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({
          title: game.title,
          text: game.description,
          url: `${window.location.origin}/play/${game.id}`
        });
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/play/${game.id}`);
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
        <h2 className="text-2xl font-heading text-white mb-2">No Games Yet</h2>
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
    >
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 p-4 flex justify-between items-center">
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt="Logo" className="h-8" />
        ) : (
          <h1 className="font-heading text-xl text-lime tracking-tight">
            HYPD
          </h1>
        )}
        <button
          onClick={() => setMuted(!muted)}
          className="w-10 h-10 rounded-full glass flex items-center justify-center touch-target"
          data-testid="mute-button"
        >
          {muted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Game Cards */}
      {games.map((game, index) => (
        <div
          key={game.id}
          className="snap-item h-[100dvh] w-full relative overflow-hidden"
          data-testid={`game-card-${index}`}
        >
          {/* Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${game.thumbnail_url || 'https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=800&q=80'})` 
            }}
          >
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* Overlay Gradient */}
          <div className="absolute inset-0 game-overlay" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 pb-24">
            {/* Game Info */}
            <div className="flex items-end justify-between gap-4">
              <div className="flex-1">
                <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-lime text-black rounded-full mb-3">
                  {game.category}
                </span>
                <h2 className="font-heading text-3xl md:text-4xl text-white mb-2 leading-tight">
                  {game.title}
                </h2>
                <p className="text-white/70 text-sm line-clamp-2 mb-4">
                  {game.description}
                </p>
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <span>{game.play_count?.toLocaleString() || 0} plays</span>
                </div>
              </div>

              {/* Side Actions */}
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={(e) => toggleSave(game.id, e)}
                  className="w-12 h-12 rounded-full glass flex items-center justify-center touch-target transition-transform active:scale-90"
                  data-testid={`save-game-${index}`}
                >
                  <Heart 
                    className={`w-6 h-6 transition-colors ${
                      savedGames.has(game.id) 
                        ? "fill-red-500 text-red-500" 
                        : "text-white"
                    }`} 
                  />
                </button>
                <button
                  onClick={(e) => shareGame(game, e)}
                  className="w-12 h-12 rounded-full glass flex items-center justify-center touch-target transition-transform active:scale-90"
                  data-testid={`share-game-${index}`}
                >
                  <Share2 className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Play Button */}
            <AnimatePresence>
              {index === currentIndex && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  onClick={() => playGame(game.id)}
                  className="mt-6 w-full py-4 bg-lime text-black font-heading text-lg uppercase tracking-widest rounded-full glow-lime transition-transform active:scale-95"
                  data-testid={`play-button-${index}`}
                >
                  Play Now
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Scroll Indicator */}
          {index === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/50"
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1"
              >
                <div className="w-1.5 h-3 bg-white/50 rounded-full" />
              </motion.div>
              <span className="text-xs mt-2">Swipe for more</span>
            </motion.div>
          )}
        </div>
      ))}

      {/* Bottom Padding for Nav */}
      <div className="h-20" />
    </div>
  );
}
