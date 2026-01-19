"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Gamepad2, Clock, User, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BottomNav from "@/components/bottom-nav";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    username: string;
    avatar_url?: string;
    total_games_played?: number;
    total_play_time?: number;
  };
  total_games?: number;
  total_time?: number;
  score?: number;
}

export default function LeaderboardPage() {
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [gameLeaderboard, setGameLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameLoading, setGameLoading] = useState(false);

  useEffect(() => {
    fetchGlobalLeaderboard();
    fetchGames();
  }, []);

  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leaderboard/global`);
      if (res.ok) {
        const data = await res.json();
        setGlobalLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
    setLoading(false);
  };

  const fetchGames = async () => {
    try {
      const res = await fetch(`${API_URL}/api/games`);
      if (res.ok) {
        const data = await res.json();
        setGames(data);
      }
    } catch (error) {
      console.error("Error fetching games:", error);
    }
  };

  const fetchGameLeaderboard = async (gameId: string) => {
    setGameLoading(true);
    setSelectedGame(gameId);
    try {
      const res = await fetch(`${API_URL}/api/leaderboard/game/${gameId}`);
      if (res.ok) {
        const data = await res.json();
        setGameLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error("Error fetching game leaderboard:", error);
    }
    setGameLoading(false);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold">{rank}</span>;
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const LeaderboardList = ({ entries, type }: { entries: LeaderboardEntry[]; type: "global" | "game" }) => (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No rankings yet</p>
          <p className="text-sm text-muted-foreground/70">Be the first to play!</p>
        </div>
      ) : (
        entries.map((entry, index) => (
          <motion.div
            key={entry.user.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-4 p-4 rounded-xl ${
              entry.rank <= 3 ? "bg-lime/10 border border-lime/30" : "bg-card border border-border"
            }`}
          >
            <div className="flex-shrink-0">{getRankIcon(entry.rank)}</div>
            
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              {entry.user.avatar_url ? (
                <img src={entry.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate">{entry.user.username}</p>
              {type === "global" && (
                <p className="text-sm text-muted-foreground">
                  {entry.total_games || entry.user.total_games_played || 0} games played
                </p>
              )}
            </div>
            
            <div className="text-right flex-shrink-0">
              {type === "global" ? (
                <div className="flex items-center gap-1 text-lime">
                  <Clock className="w-4 h-4" />
                  <span className="font-bold">{formatTime(entry.total_time || entry.user.total_play_time || 0)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-lime">
                  <Trophy className="w-4 h-4" />
                  <span className="font-bold">{entry.score?.toLocaleString() || 0}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="leaderboard-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="p-4">
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Trophy className="w-7 h-7 text-lime" />
            Leaderboards
          </h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="global" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Global
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              By Game
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-lime animate-spin" />
              </div>
            ) : (
              <LeaderboardList entries={globalLeaderboard} type="global" />
            )}
          </TabsContent>

          <TabsContent value="games">
            <div className="space-y-4">
              {/* Game selector */}
              <div className="grid grid-cols-3 gap-2">
                {games.slice(0, 9).map((game) => (
                  <button
                    key={game.id}
                    onClick={() => fetchGameLeaderboard(game.id)}
                    className={`p-3 rounded-xl text-center transition-all ${
                      selectedGame === game.id
                        ? "bg-lime text-black"
                        : "bg-card border border-border hover:border-lime/50"
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{game.title}</p>
                  </button>
                ))}
              </div>

              {/* Game leaderboard */}
              {selectedGame ? (
                gameLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-lime animate-spin" />
                  </div>
                ) : (
                  <LeaderboardList entries={gameLeaderboard} type="game" />
                )
              ) : (
                <div className="text-center py-12">
                  <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Select a game to view rankings</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
