"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Gamepad2, Clock, User, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      if (res.ok) setGames(await res.json());
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
      case 1: return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold text-sm">{rank}</span>;
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const LeaderboardList = ({ entries, type }: { entries: LeaderboardEntry[]; type: "global" | "game" }) => (
    <div className="space-y-2.5">
      {entries.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground font-medium">No rankings yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Be the first to play!</p>
        </div>
      ) : (
        entries.map((entry, index) => (
          <motion.div
            key={entry.user.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={`flex items-center gap-3.5 p-3.5 rounded-[20px] card-elevated ${
              entry.rank <= 3 ? "bg-lime/10 border-lime/20" : "bg-card"
            }`}
            data-testid={`leaderboard-row-${entry.rank}`}
          >
            <div className="flex-shrink-0 w-8 flex justify-center">{getRankIcon(entry.rank)}</div>

            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {entry.user.avatar_url ? (
                <img src={entry.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-[15px] truncate">{entry.user.username}</p>
              {type === "global" && (
                <p className="text-[13px] text-muted-foreground">
                  {entry.total_games || entry.user.total_games_played || 0} games
                </p>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              {type === "global" ? (
                <div className="flex items-center gap-1 text-lime">
                  <Clock className="w-4 h-4" />
                  <span className="font-bold text-sm">{formatTime(entry.total_time || entry.user.total_play_time || 0)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-lime">
                  <Trophy className="w-4 h-4" />
                  <span className="font-bold text-sm">{entry.score?.toLocaleString() || 0}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen page-gradient pb-28" data-testid="leaderboard-page">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-7 h-7 text-lime" />
          <h1 className="text-[28px] font-bold text-foreground tracking-tight lowercase">leaderboards</h1>
        </div>
      </div>

      <div className="px-4">
        <Tabs defaultValue="global" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-5">
            <TabsTrigger value="global" className="flex items-center gap-2" data-testid="global-tab">
              <Crown className="w-4 h-4" />
              Global
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-2" data-testid="games-tab">
              <Gamepad2 className="w-4 h-4" />
              By Game
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-lime animate-spin" />
              </div>
            ) : (
              <LeaderboardList entries={globalLeaderboard} type="global" />
            )}
          </TabsContent>

          <TabsContent value="games">
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {games.slice(0, 12).map((game) => (
                  <button
                    key={game.id}
                    onClick={() => fetchGameLeaderboard(game.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-pill text-[13px] font-medium transition-colors whitespace-nowrap ${
                      selectedGame === game.id
                        ? "bg-lime text-black font-bold"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                    data-testid={`game-filter-${game.id}`}
                  >
                    {game.title}
                  </button>
                ))}
              </div>

              {selectedGame ? (
                gameLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 text-lime animate-spin" />
                  </div>
                ) : (
                  <LeaderboardList entries={gameLeaderboard} type="game" />
                )
              ) : (
                <div className="text-center py-16">
                  <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <p className="text-muted-foreground font-medium">Select a game to view rankings</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
