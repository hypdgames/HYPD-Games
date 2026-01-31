"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gamepad2, Globe, Upload, Users, BarChart3, Settings, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store";
import { toast } from "sonner";
import type { Game } from "@/types";
import {
  GamesTab,
  GamePixTab,
  GameMonetizeTab,
  UploadTab,
  AnalyticsTab,
  UsersTab,
  SettingsTab,
  GPXGame,
  AnalyticsOverview,
  DailyStats,
  CategoryStats,
  TopGame,
  RetentionData,
  RegionData,
  DeviceStats,
  AdminUser,
  UserStats,
} from "./components";
import type { GMZGame } from "./components/GameMonetizeTab";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuthStore();
  
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  
  // GamePix state
  const [gpxGames, setGpxGames] = useState<GPXGame[]>([]);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxCategory, setGpxCategory] = useState<string>("");
  const [gpxOrder, setGpxOrder] = useState<string>("quality");
  const [gpxPage, setGpxPage] = useState(1);
  const [gpxHasMore, setGpxHasMore] = useState(false);
  const [selectedGpxGames, setSelectedGpxGames] = useState<Set<string>>(new Set());
  const [gpxCategories, setGpxCategories] = useState<{id: string; name: string; icon: string}[]>([]);
  const [importing, setImporting] = useState(false);

  // GameMonetize state
  const [gmzGames, setGmzGames] = useState<GMZGame[]>([]);
  const [gmzLoading, setGmzLoading] = useState(false);
  const [gmzCategory, setGmzCategory] = useState<string>("All");
  const [gmzSort, setGmzSort] = useState<string>("newest");
  const [gmzPage, setGmzPage] = useState(1);
  const [gmzHasMore, setGmzHasMore] = useState(false);
  const [selectedGmzGames, setSelectedGmzGames] = useState<Set<string>>(new Set());
  const [gmzCategories, setGmzCategories] = useState<{id: string; name: string; icon: string}[]>([]);
  const [gmzImporting, setGmzImporting] = useState(false);

  // Analytics state
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [topGames, setTopGames] = useState<TopGame[]>([]);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [regionData, setRegionData] = useState<RegionData[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // User Management state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "admins" | "banned">("all");
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);

  // Settings state
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoHeight, setLogoHeight] = useState<number>(32);
  const [siteName, setSiteName] = useState<string>("HYPD");
  const [faviconUrl, setFaviconUrl] = useState<string>("");
  const [primaryColor, setPrimaryColor] = useState<string>("#CCFF00");

  // Check admin status
  useEffect(() => {
    // Wait for auth to hydrate before checking admin status
    if (authLoading) return;
    
    if (!user?.is_admin) {
      router.push("/profile");
      return;
    }
    fetchGames();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchGames = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGames(data);
      }
    } catch (error) {
      console.error("Error fetching games:", error);
    }
    setLoading(false);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.logo_height) setLogoHeight(parseInt(data.logo_height) || 32);
        if (data.site_name) setSiteName(data.site_name);
        if (data.favicon_url) setFaviconUrl(data.favicon_url);
        if (data.primary_color) setPrimaryColor(data.primary_color);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  // Fetch users for management
  const fetchUsers = async (page: number = 1, search?: string, filter?: string) => {
    if (!token) return;
    setUsersLoading(true);
    setUsersPage(page);
    try {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "10");
      if (search) params.append("search", search);
      if (filter === "admins") params.append("is_admin", "true");
      if (filter === "banned") params.append("is_banned", "true");
      
      const res = await fetch(`${API_URL}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUsersTotalPages(data.total_pages || 1);
      }
    } catch {
      toast.error("Failed to load users");
    }
    setUsersLoading(false);
  };

  const fetchUserStats = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/stats/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserStats(data);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  };

  const banUser = async (userId: string, reason?: string) => {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/ban?reason=${encodeURIComponent(reason || "")}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast.success("User banned successfully");
      fetchUsers(usersPage, userSearch, userFilter);
      fetchUserStats();
    } else {
      const err = await res.json();
      toast.error(err.detail || "Failed to ban user");
    }
  };

  const unbanUser = async (userId: string) => {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/unban`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast.success("User unbanned successfully");
      fetchUsers(usersPage, userSearch, userFilter);
      fetchUserStats();
    } else {
      const err = await res.json();
      toast.error(err.detail || "Failed to unban user");
    }
  };

  const makeAdmin = async (userId: string) => {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/make-admin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast.success("User is now an admin");
      fetchUsers(usersPage, userSearch, userFilter);
      fetchUserStats();
    } else {
      const err = await res.json();
      toast.error(err.detail || "Failed to make admin");
    }
  };

  const removeAdmin = async (userId: string) => {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/remove-admin`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast.success("Admin status removed");
      fetchUsers(usersPage, userSearch, userFilter);
      fetchUserStats();
    } else {
      const err = await res.json();
      toast.error(err.detail || "Failed to remove admin");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast.success("User deleted successfully");
      fetchUsers(usersPage, userSearch, userFilter);
      fetchUserStats();
    } else {
      const err = await res.json();
      toast.error(err.detail || "Failed to delete user");
    }
  };

  const fetchAnalytics = async () => {
    if (!token) {
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [overviewRes, dailyRes, retentionRes, regionsRes, devicesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/analytics/overview`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/daily?days=14`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/retention`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/regions?days=30`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/devices?days=30`, { headers }),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setAnalyticsOverview(data.overview);
        setCategoryStats(data.categories || []);
        setTopGames(data.top_games || []);
      }
      if (dailyRes.ok) {
        const data = await dailyRes.json();
        setDailyStats(data.daily_stats || []);
      }
      if (retentionRes.ok) {
        const data = await retentionRes.json();
        setRetention(data.retention);
      }
      if (regionsRes.ok) {
        const data = await regionsRes.json();
        setRegionData(data.regions || []);
      }
      if (devicesRes.ok) {
        const data = await devicesRes.json();
        setDeviceStats(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
    setAnalyticsLoading(false);
  };

  // Fetch GamePix games
  const fetchGpxGames = async (category?: string, page: number = 1, append: boolean = false, order: string = gpxOrder) => {
    setGpxLoading(true);
    try {
      const params = new URLSearchParams();
      if (category && category !== "all") params.append("category", category);
      params.append("page", String(page));
      params.append("limit", "12");
      params.append("order", order);
      
      const res = await fetch(`${API_URL}/api/gamepix/browse?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setGpxGames(prev => [...prev, ...(data.games || [])]);
        } else {
          setGpxGames(data.games || []);
        }
        setGpxHasMore(data.has_more || false);
        setGpxPage(page);
      }
    } catch (error) {
      console.error("Error fetching GamePix games:", error);
      toast.error("Failed to load games from GamePix");
    }
    setGpxLoading(false);
  };

  const fetchGpxCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gamepix/categories`);
      if (res.ok) {
        const data = await res.json();
        setGpxCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Error fetching GamePix categories:", error);
    }
  };

  useEffect(() => {
    fetchGpxCategories();
    fetchGpxGames();
    fetchGmzCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GameMonetize state for search
  const [gmzSearch, setGmzSearch] = useState("");

  // GameMonetize functions
  const fetchGmzGames = async (category?: string, page: number = 1, append: boolean = false, search?: string, sort?: string) => {
    setGmzLoading(true);
    try {
      const params = new URLSearchParams();
      if (category && category.toLowerCase() !== "all") params.append("category", category);
      if (search) params.append("search", search);
      if (sort) params.append("sort", sort);
      params.append("page", String(page));
      params.append("num", "50");
      
      const res = await fetch(`${API_URL}/api/gamemonetize/browse?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setGmzGames(prev => [...prev, ...(data.games || [])]);
        } else {
          setGmzGames(data.games || []);
        }
        setGmzHasMore(data.has_more || false);
        setGmzPage(page);
      }
    } catch (error) {
      console.error("Error fetching GameMonetize games:", error);
      toast.error("Failed to load games from GameMonetize");
    }
    setGmzLoading(false);
  };

  const fetchGmzCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/gamemonetize/categories`);
      if (res.ok) {
        const data = await res.json();
        setGmzCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Error fetching GameMonetize categories:", error);
    }
  };

  const toggleGmzGameSelection = (id: string) => {
    setSelectedGmzGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllGmzGames = () => {
    const selectableIds = gmzGames
      .filter(g => !games.some(existing => existing.gd_game_id === `gmz-${g.gmz_game_id}`))
      .map(g => g.gmz_game_id);
    setSelectedGmzGames(new Set(selectableIds));
  };

  const clearGmzSelection = () => {
    setSelectedGmzGames(new Set());
  };

  const handleGmzSearch = (query: string) => {
    setGmzSearch(query);
    fetchGmzGames(gmzCategory, 1, false, query, gmzSort);
  };

  const handleGmzSortChange = (sort: string) => {
    setGmzSort(sort);
    fetchGmzGames(gmzCategory, 1, false, gmzSearch, sort);
  };

  const importSelectedGmzGames = async () => {
    if (selectedGmzGames.size === 0) {
      toast.error("Please select at least one game to import");
      return;
    }

    setGmzImporting(true);
    try {
      const gamesToImport = gmzGames
        .filter(g => selectedGmzGames.has(g.gmz_game_id))
        .map(g => ({
          gmz_game_id: g.gmz_game_id,
          title: g.title,
          description: g.description,
          category: g.category,
          thumbnail_url: g.thumbnail_url,
          play_url: g.play_url,
          instructions: g.instructions,
          tags: g.tags,
          width: g.width,
          height: g.height,
        }));

      const res = await fetch(`${API_URL}/api/admin/gamemonetize/bulk-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(gamesToImport),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(`Imported ${result.imported} games!`);
        if (result.skipped > 0) {
          toast.info(`${result.skipped} games were already imported`);
        }
        setSelectedGmzGames(new Set());
        fetchGames();
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to import games");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import games");
    }
    setGmzImporting(false);
  };

  const toggleGpxGameSelection = (namespace: string) => {
    setSelectedGpxGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(namespace)) {
        newSet.delete(namespace);
      } else {
        newSet.add(namespace);
      }
      return newSet;
    });
  };

  const importSelectedGpxGames = async () => {
    if (selectedGpxGames.size === 0) {
      toast.error("Please select at least one game to import");
      return;
    }

    setImporting(true);
    try {
      const gamesToImport = gpxGames
        .filter(g => selectedGpxGames.has(g.namespace))
        .map(g => ({
          gpx_game_id: g.gpx_game_id,
          title: g.title,
          namespace: g.namespace,
          description: g.description,
          category: g.category,
          thumbnail_url: g.thumbnail_url,
          icon_url: g.icon_url,
          play_url: g.play_url,
          orientation: g.orientation,
          quality_score: g.quality_score
        }));

      const res = await fetch(`${API_URL}/api/admin/gamepix/bulk-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(gamesToImport),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(`Imported ${result.imported} games!`);
        if (result.skipped > 0) {
          toast.info(`${result.skipped} games were already imported`);
        }
        setSelectedGpxGames(new Set());
        fetchGames();
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to import games");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import games");
    }
    setImporting(false);
  };

  const toggleVisibility = async (gameId: string, currentVisibility: boolean) => {
    try {
      const res = await fetch(
        `${API_URL}/api/admin/games/${gameId}/visibility`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_visible: !currentVisibility }),
        }
      );
      if (res.ok) {
        toast.success(
          !currentVisibility ? "Game is now visible" : "Game is now hidden"
        );
        fetchGames();
      }
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  const deleteGame = async (gameId: string) => {
    if (!confirm("Are you sure you want to delete this game?")) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/games/${gameId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Game deleted");
        fetchGames();
      }
    } catch {
      toast.error("Failed to delete game");
    }
  };

  if (authLoading || !user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-lime animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="admin-dashboard">
      {/* Header */}
      <div className="glass p-4 border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-lime/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-heading text-xl text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage games & settings
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <Tabs defaultValue="games" className="w-full" onValueChange={(v) => {
          if (v === "analytics") fetchAnalytics();
          if (v === "users") { fetchUsers(); fetchUserStats(); }
          if (v === "gamemonetize") fetchGmzGames(gmzCategory);
        }}>
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="games" className="flex items-center gap-1 text-xs sm:text-sm">
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">Games</span>
            </TabsTrigger>
            <TabsTrigger value="gamepix" className="flex items-center gap-1 text-xs sm:text-sm">
              <Globe className="w-4 h-4 text-lime" />
              <span className="hidden sm:inline">GamePix</span>
            </TabsTrigger>
            <TabsTrigger value="gamemonetize" className="flex items-center gap-1 text-xs sm:text-sm">
              <Globe className="w-4 h-4 text-purple-500" />
              <span className="hidden sm:inline">GMZ</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1 text-xs sm:text-sm">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1 text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1 text-xs sm:text-sm">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games">
            <GamesTab
              games={games}
              loading={loading}
              onToggleVisibility={toggleVisibility}
              onDeleteGame={deleteGame}
            />
          </TabsContent>

          <TabsContent value="gamepix">
            <GamePixTab
              gpxGames={gpxGames}
              gpxLoading={gpxLoading}
              gpxCategory={gpxCategory}
              gpxCategories={gpxCategories}
              gpxHasMore={gpxHasMore}
              gpxPage={gpxPage}
              gpxOrder={gpxOrder}
              selectedGpxGames={selectedGpxGames}
              games={games}
              importing={importing}
              onCategoryChange={(cat) => {
                setGpxCategory(cat);
                fetchGpxGames(cat, 1, false, gpxOrder);
              }}
              onOrderChange={(order) => {
                setGpxOrder(order);
                fetchGpxGames(gpxCategory, 1, false, order);
              }}
              onRefresh={() => fetchGpxGames(gpxCategory, 1, false, gpxOrder)}
              onLoadMore={() => fetchGpxGames(gpxCategory, gpxPage + 1, true, gpxOrder)}
              onToggleSelection={toggleGpxGameSelection}
              onImportSelected={importSelectedGpxGames}
            />
          </TabsContent>

          <TabsContent value="gamemonetize">
            <GameMonetizeTab
              gmzGames={gmzGames}
              gmzLoading={gmzLoading}
              gmzCategory={gmzCategory}
              gmzCategories={gmzCategories}
              gmzSort={gmzSort}
              gmzHasMore={gmzHasMore}
              gmzPage={gmzPage}
              selectedGmzGames={selectedGmzGames}
              games={games}
              importing={gmzImporting}
              onCategoryChange={(cat) => {
                setGmzCategory(cat);
                fetchGmzGames(cat, 1, false, gmzSearch, gmzSort);
              }}
              onSortChange={handleGmzSortChange}
              onSearch={handleGmzSearch}
              onRefresh={() => fetchGmzGames(gmzCategory, 1, false, gmzSearch, gmzSort)}
              onLoadMore={() => fetchGmzGames(gmzCategory, gmzPage + 1, true, gmzSearch, gmzSort)}
              onToggleSelection={toggleGmzGameSelection}
              onImportSelected={importSelectedGmzGames}
              onSelectAll={selectAllGmzGames}
              onClearSelection={clearGmzSelection}
            />
          </TabsContent>

          <TabsContent value="upload">
            <UploadTab token={token} onGameCreated={fetchGames} />
          </TabsContent>

          <TabsContent value="users">
            <UsersTab
              users={users}
              userStats={userStats}
              loading={usersLoading}
              search={userSearch}
              filter={userFilter}
              page={usersPage}
              totalPages={usersTotalPages}
              currentUserId={user?.id}
              onSearch={setUserSearch}
              onFilterChange={(f) => { setUserFilter(f); fetchUsers(1, userSearch, f); }}
              onPageChange={(p) => fetchUsers(p, userSearch, userFilter)}
              onBanUser={banUser}
              onUnbanUser={unbanUser}
              onMakeAdmin={makeAdmin}
              onRemoveAdmin={removeAdmin}
              onDeleteUser={deleteUser}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab
              loading={analyticsLoading}
              overview={analyticsOverview}
              dailyStats={dailyStats}
              categoryStats={categoryStats}
              topGames={topGames}
              retention={retention}
              regionData={regionData}
              deviceStats={deviceStats}
              games={games}
            />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab
              token={token}
              initialLogoUrl={logoUrl}
              initialLogoHeight={logoHeight}
              initialSiteName={siteName}
              initialFaviconUrl={faviconUrl}
              initialPrimaryColor={primaryColor}
              onSettingsSaved={fetchSettings}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
