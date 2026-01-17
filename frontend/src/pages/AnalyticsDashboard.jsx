import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Users, Gamepad2, Clock, Play,
  BarChart3, PieChart, Activity, Loader2, ChevronRight
} from "lucide-react";
import { useAuth } from "@/App";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";

const COLORS = ["#CCFF00", "#7000FF", "#FF4444", "#00FFFF", "#FF7F00", "#44FF44"];

export default function AnalyticsDashboard() {
  const { API, token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameAnalytics, setGameAnalytics] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/admin/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error("Error fetching analytics:", e);
    }
    setLoading(false);
  };

  const fetchGameAnalytics = async (gameId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/admin/analytics/game/${gameId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGameAnalytics(data);
        setSelectedGame(gameId);
      }
    } catch (e) {
      console.error("Error fetching game analytics:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-lime animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
        <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No analytics data available</p>
        <button
          onClick={() => navigate("/admin")}
          className="mt-4 px-6 py-2 bg-lime text-black rounded-full font-bold"
        >
          Back to Admin
        </button>
      </div>
    );
  }

  // Prepare pie chart data
  const categoryData = Object.entries(analytics.plays_by_category || {}).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="analytics-dashboard">
      {/* Header */}
      <div className="glass p-4 border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin")}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center"
            data-testid="analytics-back-button"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-lime" />
            <span className="font-heading text-lg text-foreground">Analytics</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-lime/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-lime" />
              </div>
            </div>
            <p className="text-2xl font-heading text-foreground">{analytics.total_plays.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Plays</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-violet/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet" />
              </div>
            </div>
            <p className="text-2xl font-heading text-foreground">{analytics.total_users}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-cyan-500" />
              </div>
            </div>
            <p className="text-2xl font-heading text-foreground">{analytics.total_games}</p>
            <p className="text-xs text-muted-foreground">Total Games</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <p className="text-2xl font-heading text-foreground">{analytics.plays_today}</p>
            <p className="text-xs text-muted-foreground">Plays Today</p>
          </motion.div>
        </div>

        {/* Weekly Plays Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-lime" />
            Plays This Week
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.plays_by_day}>
                <defs>
                  <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis dataKey="day" stroke="#71717A" fontSize={12} />
                <YAxis stroke="#71717A" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#121212", 
                    border: "1px solid #27272A",
                    borderRadius: "8px",
                    color: "#fff"
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="plays" 
                  stroke="#CCFF00" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPlays)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category Distribution */}
        {categoryData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-violet" />
              Plays by Category
            </h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "#121212", 
                      border: "1px solid #27272A",
                      borderRadius: "8px",
                      color: "#fff"
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Top Games */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-lime" />
            Top Games
          </h3>
          <div className="space-y-3">
            {analytics.top_games.map((game, index) => (
              <div
                key={game.game_id}
                onClick={() => fetchGameAnalytics(game.game_id)}
                className="flex items-center gap-4 p-3 bg-background/50 rounded-xl cursor-pointer hover:bg-background transition-colors"
                data-testid={`top-game-${index}`}
              >
                <div className="w-8 h-8 rounded-lg bg-lime/20 flex items-center justify-center font-heading text-lime">
                  {index + 1}
                </div>
                <img
                  src={game.thumbnail_url || "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=100&q=80"}
                  alt={game.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground truncate">{game.title}</h4>
                  <p className="text-xs text-muted-foreground">{game.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-lime">{game.plays.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">plays</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Game Detail Modal */}
        {selectedGame && gameAnalytics && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setSelectedGame(null)}
          >
            <div 
              className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-xl text-foreground">{gameAnalytics.title}</h3>
                <button
                  onClick={() => setSelectedGame(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-background/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-heading text-lime">{gameAnalytics.total_plays}</p>
                  <p className="text-xs text-muted-foreground">Total Plays</p>
                </div>
                <div className="bg-background/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-heading text-violet">{gameAnalytics.unique_players}</p>
                  <p className="text-xs text-muted-foreground">Unique Players</p>
                </div>
                <div className="bg-background/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-heading text-cyan-500">{gameAnalytics.plays_today}</p>
                  <p className="text-xs text-muted-foreground">Plays Today</p>
                </div>
                <div className="bg-background/50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-heading text-orange-500">{gameAnalytics.plays_this_week}</p>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </div>
              </div>

              {/* Daily Chart */}
              <h4 className="text-sm font-bold text-foreground mb-3">Daily Plays</h4>
              <div className="h-40 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gameAnalytics.daily_plays}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis dataKey="day" stroke="#71717A" fontSize={10} />
                    <YAxis stroke="#71717A" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "#121212", 
                        border: "1px solid #27272A",
                        borderRadius: "8px",
                        color: "#fff"
                      }}
                    />
                    <Bar dataKey="plays" fill="#CCFF00" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg. Play Duration</span>
                  <span className="text-foreground">{Math.round(gameAnalytics.avg_duration_seconds)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Play Time</span>
                  <span className="text-foreground">{gameAnalytics.total_play_time_minutes} min</span>
                </div>
                {gameAnalytics.score_stats?.high_score > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">High Score</span>
                    <span className="text-lime">{gameAnalytics.score_stats.high_score.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
