import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Users, Gamepad2, Clock, Play,
  BarChart3, PieChart, Activity, Loader2, ChevronRight,
  Download, FileText, FileJson, UserCheck, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/App";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";
import { toast } from "sonner";

const COLORS = ["#CCFF00", "#7000FF", "#FF4444", "#00FFFF", "#FF7F00", "#44FF44"];

export default function AnalyticsDashboard() {
  const { API, token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [retention, setRetention] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameAnalytics, setGameAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    if (!token) return;
    try {
      const [overviewRes, retentionRes] = await Promise.all([
        fetch(`${API}/admin/analytics/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/admin/analytics/retention`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setAnalytics(data);
      }
      
      if (retentionRes.ok) {
        const data = await retentionRes.json();
        setRetention(data);
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

  const exportData = async (format) => {
    if (!token) return;
    setExporting(true);
    try {
      const res = await fetch(`${API}/admin/analytics/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hypd_analytics.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success(`Analytics exported as ${format.toUpperCase()}`);
      } else {
        toast.error("Failed to export analytics");
      }
    } catch (e) {
      console.error("Export error:", e);
      toast.error("Export failed");
    }
    setExporting(false);
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
        <div className="flex items-center justify-between">
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
          
          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData('csv')}
              disabled={exporting}
              className="border-border text-foreground hover:bg-white/10"
              data-testid="export-csv"
            >
              <FileText className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportData('json')}
              disabled={exporting}
              className="border-border text-foreground hover:bg-white/10"
              data-testid="export-json"
            >
              <FileJson className="w-4 h-4 mr-1" />
              JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start gap-2 p-4 bg-transparent">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-lime data-[state=active]:text-black rounded-full px-4"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="retention"
            className="data-[state=active]:bg-lime data-[state=active]:text-black rounded-full px-4"
          >
            Retention
          </TabsTrigger>
          <TabsTrigger 
            value="games"
            className="data-[state=active]:bg-lime data-[state=active]:text-black rounded-full px-4"
          >
            Games
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="p-4 space-y-6">
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
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention" className="p-4 space-y-6">
          {retention ? (
            <>
              {/* Retention Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-4 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-lime/20 flex items-center justify-center mx-auto mb-3">
                    <UserCheck className="w-6 h-6 text-lime" />
                  </div>
                  <p className="text-3xl font-heading text-lime">{retention.retention.day_1_rate}%</p>
                  <p className="text-sm text-muted-foreground">Day 1 Retention</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card border border-border rounded-xl p-4 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-violet/20 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-violet" />
                  </div>
                  <p className="text-3xl font-heading text-violet">{retention.retention.day_7_rate}%</p>
                  <p className="text-sm text-muted-foreground">Day 7 Retention</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card border border-border rounded-xl p-4 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6 text-cyan-500" />
                  </div>
                  <p className="text-3xl font-heading text-cyan-500">{retention.retention.day_30_rate}%</p>
                  <p className="text-sm text-muted-foreground">Day 30 Retention</p>
                </motion.div>
              </div>

              {/* DAU Trend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-lime" />
                  Daily Active Users (30 Days)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={retention.dau_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis 
                        dataKey="label" 
                        stroke="#71717A" 
                        fontSize={10}
                        interval={4}
                      />
                      <YAxis stroke="#71717A" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "#121212", 
                          border: "1px solid #27272A",
                          borderRadius: "8px",
                          color: "#fff"
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="dau" 
                        stroke="#7000FF" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Cohort Table */}
              {retention.cohorts?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-card border border-border rounded-xl p-4 overflow-x-auto"
                >
                  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-violet" />
                    Cohort Analysis
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Signup Week</th>
                        <th className="text-center py-3 px-2 text-muted-foreground font-medium">Users</th>
                        <th className="text-center py-3 px-2 text-muted-foreground font-medium">Week 1</th>
                        <th className="text-center py-3 px-2 text-muted-foreground font-medium">Week 2</th>
                        <th className="text-center py-3 px-2 text-muted-foreground font-medium">Week 3</th>
                        <th className="text-center py-3 px-2 text-muted-foreground font-medium">Week 4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retention.cohorts.map((cohort, index) => (
                        <tr key={cohort.week} className="border-b border-border/50 hover:bg-white/5">
                          <td className="py-3 px-2 text-foreground">{cohort.week}</td>
                          <td className="py-3 px-2 text-center text-foreground">{cohort.total_users}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              cohort.week_1_retention > 50 ? 'bg-lime/20 text-lime' :
                              cohort.week_1_retention > 25 ? 'bg-yellow-500/20 text-yellow-500' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {cohort.week_1_retention}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              cohort.week_2_retention > 30 ? 'bg-lime/20 text-lime' :
                              cohort.week_2_retention > 15 ? 'bg-yellow-500/20 text-yellow-500' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {cohort.week_2_retention}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              cohort.week_3_retention > 20 ? 'bg-lime/20 text-lime' :
                              cohort.week_3_retention > 10 ? 'bg-yellow-500/20 text-yellow-500' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {cohort.week_3_retention}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              cohort.week_4_retention > 15 ? 'bg-lime/20 text-lime' :
                              cohort.week_4_retention > 5 ? 'bg-yellow-500/20 text-yellow-500' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {cohort.week_4_retention}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {/* User Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-2xl font-heading text-foreground">{retention.metrics.total_users}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-2xl font-heading text-lime">{retention.metrics.active_users}</p>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-2xl font-heading text-violet">{retention.metrics.avg_sessions_per_user}</p>
                  <p className="text-xs text-muted-foreground">Avg Sessions/User</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No retention data available yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Retention metrics will appear as users engage with the platform
              </p>
            </div>
          )}
        </TabsContent>

        {/* Games Tab */}
        <TabsContent value="games" className="p-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
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
        </TabsContent>
      </Tabs>

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
  );
}
