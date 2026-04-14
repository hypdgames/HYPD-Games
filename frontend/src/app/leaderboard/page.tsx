"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, Medal, Gamepad2, Clock, User, Loader2 } from "lucide-react";
import Image from "next/image";
import { API_URL } from "@/lib/api";
import type { Game } from "@/types";

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
  const [activeFilter, setActiveFilter] = useState("global");

  useEffect(() => {
    fetchGlobalLeaderboard();
  }, []);

  useEffect(() => {
    if (activeFilter === "games" && games.length === 0) {
      fetchGames();
    }
  }, [activeFilter, games.length]);

  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leaderboard/global`);
      if (res.ok) {
        const data = await res.json();
        setGlobalLeaderboard(data.leaderboard || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchGames = async () => {
    try {
      const res = await fetch(`${API_URL}/api/games?limit=24`);
      if (res.ok) setGames(await res.json());
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
    setGameLoading(false);
  };

  const getRankDecor = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const filters = [
    { key: "global", label: "All" },
    { key: "games", label: "By Game" },
  ];

  const LeaderList = ({ entries, type }: { entries: LeaderboardEntry[]; type: "global" | "game" }) => (
    <div className="space-y-2.5">
      {entries.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium text-lg">No rankings yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Be the first to play!</p>
        </div>
      ) : (
        entries.map((entry, i) => (
          <motion.div
            key={entry.user.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="soft-card flex items-center gap-3.5"
            data-testid={`leaderboard-row-${entry.rank}`}
          >
            <div className="flex-shrink-0 w-6 flex justify-center">{getRankDecor(entry.rank)}</div>

            {/* Avatar */}
            <div className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm relative">
              {entry.user.avatar_url ? (
                <Image src={entry.user.avatar_url} alt="" fill className="object-cover" sizes="44px" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-[15px] truncate">{entry.user.username}</p>
              {type === "global" && (
                <p className="text-[13px] text-muted-foreground">
                  {entry.total_games || entry.user.total_games_played || 0} games played
                </p>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              {type === "global" ? (
                <div className="flex items-center gap-1.5 text-violet font-bold text-sm">
                  <Clock className="w-4 h-4" />
                  {formatTime(entry.total_time || entry.user.total_play_time || 0)}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-violet font-bold text-sm">
                  <Trophy className="w-4 h-4" />
                  {entry.score?.toLocaleString() || 0}
                </div>
              )}
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen hook-gradient-bg pb-28" data-testid="leaderboard-page">
      {/* Centered title (Hook's Activity style) */}
      <div className="pt-5 pb-4 text-center">
        <h1 className="text-2xl font-extrabold text-foreground">Leaderboard</h1>
      </div>

      {/* Filter pills (Hook's All/Suggestions/Likes/Comments pills) */}
      <div className="flex gap-2.5 px-5 mb-6 overflow-x-auto hide-scrollbar">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`filter-pill whitespace-nowrap ${activeFilter === f.key ? "filter-pill-active" : ""}`}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-5">
        {activeFilter === "global" ? (
          loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 text-violet animate-spin" />
            </div>
          ) : (
            <LeaderList entries={globalLeaderboard} type="global" />
          )
        ) : (
          <div className="space-y-5">
            {/* Game selector pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {games.slice(0, 12).map(game => (
                <button
                  key={game.id}
                  onClick={() => fetchGameLeaderboard(game.id)}
                  className={`filter-pill text-[13px] whitespace-nowrap ${
                    selectedGame === game.id ? "filter-pill-active" : ""
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
                  <Loader2 className="w-8 h-8 text-violet animate-spin" />
                </div>
              ) : (
                <LeaderList entries={gameLeaderboard} type="game" />
              )
            ) : (
              <div className="text-center py-16">
                <Gamepad2 className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium text-lg">Select a game</p>
                <p className="text-muted-foreground/60 text-sm mt-1">Pick a game above to see rankings</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
