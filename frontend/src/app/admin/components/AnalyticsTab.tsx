"use client";

import { motion } from "framer-motion";
import {
  Users,
  Gamepad2,
  Activity,
  Clock,
  TrendingUp,
  Calendar,
  Target,
  Globe,
  Monitor,
  Settings,
  Smartphone,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type {
  AnalyticsOverview,
  DailyStats,
  CategoryStats,
  TopGame,
  RetentionData,
  RegionData,
  DeviceStats,
  Game,
} from "./types";
import { CHART_COLORS } from "./types";

interface AnalyticsTabProps {
  loading: boolean;
  overview: AnalyticsOverview | null;
  dailyStats: DailyStats[];
  categoryStats: CategoryStats[];
  topGames: TopGame[];
  retention: RetentionData | null;
  regionData: RegionData[];
  deviceStats: DeviceStats | null;
  games: Game[];
}

export function AnalyticsTab({
  loading,
  overview,
  dailyStats,
  categoryStats,
  topGames,
  retention,
  regionData,
  deviceStats,
  games,
}: AnalyticsTabProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-lime animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-muted-foreground">Total Users</span>
          </div>
          <p className="text-2xl font-heading text-foreground">
            {overview?.total_users?.toLocaleString() || 0}
          </p>
          {overview?.new_users_today ? (
            <p className="text-xs text-lime flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" />
              +{overview.new_users_today} today
            </p>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="w-4 h-4 text-lime" />
            <span className="text-xs text-muted-foreground">Total Games</span>
          </div>
          <p className="text-2xl font-heading text-foreground">
            {overview?.total_games || games.length}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-violet" />
            <span className="text-xs text-muted-foreground">Total Plays</span>
          </div>
          <p className="text-2xl font-heading text-foreground">
            {overview?.total_plays?.toLocaleString() || 
             games.reduce((acc, g) => acc + (g.play_count || 0), 0).toLocaleString()}
          </p>
          {overview?.plays_today ? (
            <p className="text-xs text-lime flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" />
              +{overview.plays_today} today
            </p>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-muted-foreground">Active (24h)</span>
          </div>
          <p className="text-2xl font-heading text-foreground">
            {overview?.active_users_24h || 0}
          </p>
        </motion.div>
      </div>

      {/* Daily Activity Chart */}
      {dailyStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-lime" />
            Daily Activity (Last 14 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#666"
                  fontSize={11}
                />
                <YAxis stroke="#666" fontSize={11} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelFormatter={formatDate}
                />
                <Area 
                  type="monotone" 
                  dataKey="plays" 
                  stroke="#CCFF00" 
                  fillOpacity={1} 
                  fill="url(#colorPlays)"
                  name="Plays"
                />
                <Area 
                  type="monotone" 
                  dataKey="unique_players" 
                  stroke="#8B5CF6" 
                  fillOpacity={1} 
                  fill="url(#colorUsers)"
                  name="Unique Players"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        {categoryStats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-lime" />
              Plays by Category
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="plays"
                    nameKey="category"
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {categoryStats.map((cat, index) => (
                <div key={cat.category} className="flex items-center gap-1 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{cat.category}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* User Retention */}
        {retention && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-lime" />
              User Retention
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "Day 1", value: retention.day_1_pct || 0 },
                  { name: "Day 3", value: retention.day_3_pct || 0 },
                  { name: "Day 7", value: retention.day_7_pct || 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} unit="%" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Retention"]}
                  />
                  <Bar dataKey="value" fill="#CCFF00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Based on {retention.total_new_users} new users (last 7 days)
            </p>
          </motion.div>
        )}
      </div>

      {/* Top Games */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-lime" />
          Top Games by Plays
        </h3>
        {(topGames.length > 0 ? topGames : [...games]
          .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
          .slice(0, 5)
          .map(g => ({ id: g.id, title: g.title, plays: g.play_count || 0 }))
        ).length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No data yet
          </p>
        ) : (
          <div className="space-y-3">
            {(topGames.length > 0 ? topGames : [...games]
              .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
              .slice(0, 5)
              .map(g => ({ id: g.id, title: g.title, plays: g.play_count || 0 }))
            ).map((game, i) => (
              <div key={game.id} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-lime/20 text-lime" : 
                  i === 1 ? "bg-violet/20 text-violet" :
                  i === 2 ? "bg-orange-400/20 text-orange-400" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i + 1}
                </span>
                <span className="text-foreground flex-1 truncate text-sm">
                  {game.title}
                </span>
                <span className="text-muted-foreground text-sm">
                  {game.plays?.toLocaleString() || 0}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Region Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border rounded-xl p-4"
      >
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-lime" />
          Geographic Distribution
        </h3>
        {regionData.length === 0 ? (
          <div className="text-center py-6">
            <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No region data yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Region tracking will begin once users start playing
            </p>
          </div>
        ) : (
          <>
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={regionData.slice(0, 8)} 
                  layout="vertical"
                  margin={{ left: 0, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" stroke="#666" fontSize={11} />
                  <YAxis 
                    type="category" 
                    dataKey="region" 
                    stroke="#666" 
                    fontSize={10}
                    width={80}
                    tickFormatter={(value) => value.length > 12 ? value.slice(0, 10) + '...' : value}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value) => [value, "Events"]}
                  />
                  <Bar dataKey="events" fill="#CCFF00" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {regionData.slice(0, 6).map((region, i) => (
                <div 
                  key={region.region}
                  className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded-lg"
                >
                  <span className="text-foreground truncate flex-1 mr-2">
                    {region.region}
                  </span>
                  <span className={`font-bold ${
                    i === 0 ? "text-lime" : "text-muted-foreground"
                  }`}>
                    {region.events}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Last 30 days • {regionData.reduce((acc, r) => acc + r.events, 0)} total events
            </p>
          </>
        )}
      </motion.div>

      {/* Device Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device Types */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-lime" />
            Device Types
          </h3>
          {deviceStats ? (
            <>
              <div className="space-y-3">
                {deviceStats.device_types.map((device, i) => (
                  <div key={device.name} className="flex items-center gap-3">
                    <div className="w-16 text-sm text-muted-foreground">{device.name}</div>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${i === 0 ? 'bg-lime' : i === 1 ? 'bg-blue-500' : 'bg-purple-500'}`}
                        style={{ width: `${device.percentage}%` }}
                      />
                    </div>
                    <div className="w-14 text-right text-sm font-medium text-foreground">
                      {device.percentage}%
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                {deviceStats.total_events} total events tracked
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No device data yet</p>
          )}
        </motion.div>

        {/* Browsers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-lime" />
            Browsers
          </h3>
          {deviceStats && deviceStats.browsers.length > 0 ? (
            <div className="space-y-2">
              {deviceStats.browsers.slice(0, 5).map((browser) => (
                <div key={browser.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{browser.name}</span>
                  <span className="text-sm font-medium text-muted-foreground">{browser.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No browser data yet</p>
          )}
        </motion.div>

        {/* Operating Systems */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-lime" />
            Operating Systems
          </h3>
          {deviceStats && deviceStats.operating_systems.length > 0 ? (
            <div className="space-y-2">
              {deviceStats.operating_systems.slice(0, 5).map((os) => (
                <div key={os.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{os.name}</span>
                  <span className="text-sm font-medium text-muted-foreground">{os.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No OS data yet</p>
          )}
        </motion.div>

        {/* Screen Sizes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-lime" />
            Screen Sizes
          </h3>
          {deviceStats && deviceStats.screen_sizes.length > 0 ? (
            <div className="space-y-2">
              {deviceStats.screen_sizes.slice(0, 5).map((screen) => (
                <div key={screen.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground">{screen.name}</span>
                  <span className="text-sm font-medium text-muted-foreground">{screen.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No screen data yet</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
