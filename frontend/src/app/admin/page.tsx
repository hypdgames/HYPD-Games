"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Gamepad2,
  BarChart3,
  Image as ImageIcon,
  Video,
  Globe,
  Plus,
  Check,
  Users,
  Clock,
  TrendingUp,
  Calendar,
  Activity,
  Target,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store";
import { toast } from "sonner";
import type { Game } from "@/types";
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const CATEGORIES = ["Action", "Puzzle", "Arcade", "Racing", "Sports", "Strategy"];

const CHART_COLORS = ["#CCFF00", "#8B5CF6", "#EC4899", "#06B6D4", "#F59E0B", "#10B981"];

interface GPXGame {
  gpx_game_id: string;
  title: string;
  namespace: string;
  description: string;
  category: string;
  thumbnail_url: string;
  icon_url: string;
  play_url: string;
  orientation?: string;
  quality_score?: number;
  date_published?: string;
}

interface AnalyticsOverview {
  total_users: number;
  total_games: number;
  total_plays: number;
  new_users_today: number;
  plays_today: number;
  active_users_24h: number;
  plays_this_week: number;
}

interface DailyStats {
  date: string;
  plays: number;
  unique_players: number;
  new_users: number;
}

interface CategoryStats {
  category: string;
  plays: number;
  [key: string]: string | number;
}

interface TopGame {
  id: string;
  title: string;
  plays: number;
}

interface RetentionData {
  day_1: number;
  day_1_pct?: number;
  day_3: number;
  day_3_pct?: number;
  day_7: number;
  day_7_pct?: number;
  total_new_users: number;
}

interface RegionData {
  region: string;
  events: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Importing state
  const [importing, setImporting] = useState(false);

  // GamePix state
  const [gpxGames, setGpxGames] = useState<GPXGame[]>([]);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxCategory, setGpxCategory] = useState<string>("");
  const [gpxPage, setGpxPage] = useState(1);
  const [gpxHasMore, setGpxHasMore] = useState(false);
  const [selectedGpxGames, setSelectedGpxGames] = useState<Set<string>>(new Set());
  const [gpxCategories, setGpxCategories] = useState<{id: string; name: string; icon: string}[]>([]);

  // Analytics state
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [topGames, setTopGames] = useState<TopGame[]>([]);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [regionData, setRegionData] = useState<RegionData[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Settings state
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoHeight, setLogoHeight] = useState<number>(32);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [savingSettings, setSavingSettings] = useState(false);
  
  const gameFileRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // New game form
  const [newGame, setNewGame] = useState({
    title: "",
    description: "",
    category: "Action",
    preview_type: "image" as "video" | "gif" | "image",
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [videoPreviewFile, setVideoPreviewFile] = useState<File | null>(null);

  // Check admin status
  useEffect(() => {
    if (!user?.is_admin) {
      router.push("/profile");
      return;
    }
    fetchGames();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        if (data.logo_url) {
          setLogoUrl(data.logo_url);
          setLogoPreview(data.logo_url);
        }
        if (data.logo_height) {
          setLogoHeight(parseInt(data.logo_height) || 32);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      let finalLogoUrl = logoUrl;

      // Upload logo if a new file was selected
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        
        const uploadRes = await fetch(`${API_URL}/api/admin/upload-logo`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalLogoUrl = uploadData.url;
          setLogoUrl(finalLogoUrl);
        } else {
          toast.error("Failed to upload logo");
          setSavingSettings(false);
          return;
        }
      }

      // Save settings
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          logo_url: finalLogoUrl,
          logo_height: String(logoHeight),
        }),
      });

      if (res.ok) {
        toast.success("Settings saved!");
        setLogoFile(null);
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
    setSavingSettings(false);
  };

  const removeLogo = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          logo_url: "",
          logo_height: "32",
        }),
      });

      if (res.ok) {
        setLogoUrl("");
        setLogoPreview("");
        setLogoFile(null);
        setLogoHeight(32);
        toast.success("Logo removed!");
      } else {
        toast.error("Failed to remove logo");
      }
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Failed to remove logo");
    }
    setSavingSettings(false);
  };

  const fetchAnalytics = async () => {
    if (!token) {
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [overviewRes, dailyRes, retentionRes, regionsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/analytics/overview`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/daily?days=14`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/retention`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/regions?days=30`, { headers }),
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
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
    setAnalyticsLoading(false);
  };

  // Fetch GamePix games
  const fetchGpxGames = async (category?: string, page: number = 1, append: boolean = false) => {
    setGpxLoading(true);
    try {
      const params = new URLSearchParams();
      if (category && category !== "all") params.append("category", category);
      params.append("page", String(page));
      params.append("limit", "12");
      
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

  // Fetch GamePix categories
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

  // Load GamePix games and categories on mount
  useEffect(() => {
    fetchGpxCategories();
    fetchGpxGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const isGpxGameImported = (namespace: string) => {
    return games.some(g => g.gd_game_id === `gpx-${namespace}`);
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thumbnailFile || !gameFile) {
      toast.error("Please select thumbnail and game file");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("title", newGame.title);
    formData.append("description", newGame.description);
    formData.append("category", newGame.category);
    formData.append("preview_type", newGame.preview_type);
    formData.append("thumbnail", thumbnailFile);
    formData.append("game_zip", gameFile);
    if (videoPreviewFile) {
      formData.append("video_preview", videoPreviewFile);
    }

    try {
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          toast.success("Game created successfully!");
          setNewGame({
            title: "",
            description: "",
            category: "Action",
            preview_type: "image",
          });
          setThumbnailFile(null);
          setGameFile(null);
          setVideoPreviewFile(null);
          fetchGames();
        } else {
          const error = JSON.parse(xhr.responseText);
          toast.error(error.detail || "Failed to create game");
        }
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener("error", () => {
        toast.error("Upload failed");
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.open("POST", `${API_URL}/api/admin/games/create-with-files`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    } catch (e) {
      console.error("Upload error:", e);
      toast.error("Failed to upload game");
      setUploading(false);
      setUploadProgress(0);
    }
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!user?.is_admin) {
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
        <Tabs defaultValue="games" className="w-full" onValueChange={(v) => v === "analytics" && fetchAnalytics()}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              Games
            </TabsTrigger>
            <TabsTrigger value="gamepix" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              GamePix
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Games Tab */}
          <TabsContent value="games">
            <h2 className="text-lg font-bold text-foreground mb-4">
              All Games ({games.length})
            </h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-lime animate-spin" />
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No games yet</p>
                <p className="text-sm text-muted-foreground/70">
                  Upload your first game in the Upload tab
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {games.map((game) => (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 bg-card border border-border rounded-xl p-4"
                    data-testid={`admin-game-${game.id}`}
                  >
                    <img
                      src={
                        game.thumbnail_url ||
                        "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=100&q=80"
                      }
                      alt={game.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground truncate">
                          {game.title}
                        </h3>
                        {!game.is_visible && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {game.category} •{" "}
                        {game.play_count?.toLocaleString() || 0} plays
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          toggleVisibility(game.id, game.is_visible)
                        }
                        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-lime/20 transition-colors"
                        title={game.is_visible ? "Hide game" : "Show game"}
                      >
                        {game.is_visible ? (
                          <Eye className="w-5 h-5 text-foreground" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteGame(game.id)}
                        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-red-500/20 transition-colors"
                        title="Delete game"
                      >
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* GamePix Import Tab */}
          <TabsContent value="gamepix">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={gpxCategory}
                  onChange={(e) => {
                    setGpxCategory(e.target.value);
                    fetchGpxGames(e.target.value, 1, false);
                  }}
                  className="h-10 px-4 rounded-lg bg-card border border-border text-foreground flex-1"
                  data-testid="gpx-category-select"
                >
                  {gpxCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={() => fetchGpxGames(gpxCategory, 1, false)}
                  disabled={gpxLoading}
                >
                  {gpxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
                </Button>
              </div>

              {selectedGpxGames.size > 0 && (
                <div className="flex items-center justify-between bg-lime/10 border border-lime/30 rounded-lg p-3">
                  <span className="text-sm text-foreground">
                    <span className="font-bold text-lime">{selectedGpxGames.size}</span> games selected
                  </span>
                  <Button
                    onClick={importSelectedGpxGames}
                    disabled={importing}
                    size="sm"
                    className="bg-lime text-black hover:bg-lime/90"
                    data-testid="import-gpx-selected-button"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Import Selected
                  </Button>
                </div>
              )}

              {gpxLoading && gpxGames.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-lime animate-spin" />
                </div>
              ) : gpxGames.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No games found</p>
                  <p className="text-sm text-muted-foreground/70">
                    Try a different category
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {gpxGames.map((game) => {
                      const imported = isGpxGameImported(game.namespace);
                      const selected = selectedGpxGames.has(game.namespace);
                      
                      return (
                        <motion.div
                          key={game.namespace}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`relative bg-card border rounded-xl overflow-hidden cursor-pointer transition-all ${
                            imported
                              ? "border-lime/50 opacity-60"
                              : selected
                              ? "border-lime ring-2 ring-lime/30"
                              : "border-border hover:border-lime/50"
                          }`}
                          onClick={() => !imported && toggleGpxGameSelection(game.namespace)}
                          data-testid={`gpx-game-${game.namespace}`}
                        >
                          <div className="aspect-video relative">
                            <img
                              src={game.thumbnail_url || game.icon_url || "https://via.placeholder.com/200?text=Game"}
                              alt={game.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=200&q=80";
                              }}
                            />
                            {imported && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <div className="bg-lime text-black px-3 py-1 rounded-full text-xs font-bold">
                                  Already Added
                                </div>
                              </div>
                            )}
                            {selected && !imported && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-lime rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-black" />
                              </div>
                            )}
                            {game.quality_score && (
                              <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
                                ⭐ {Math.round(game.quality_score * 100)}%
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-bold text-sm text-foreground truncate">
                              {game.title}
                            </h3>
                            <p className="text-xs text-muted-foreground capitalize">
                              {game.category}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Load More Button */}
                  {gpxHasMore && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => fetchGpxGames(gpxCategory, gpxPage + 1, true)}
                        disabled={gpxLoading}
                      >
                        {gpxLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Load More Games
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <form onSubmit={handleCreateGame} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Game Title</Label>
                  <Input
                    value={newGame.title}
                    onChange={(e) =>
                      setNewGame({ ...newGame, title: e.target.value })
                    }
                    placeholder="Enter game title"
                    required
                    data-testid="game-title-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newGame.description}
                    onChange={(e) =>
                      setNewGame({ ...newGame, description: e.target.value })
                    }
                    placeholder="Enter game description"
                    required
                    data-testid="game-description-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    value={newGame.category}
                    onChange={(e) =>
                      setNewGame({ ...newGame, category: e.target.value })
                    }
                    className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="game-category-select"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Preview Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["image", "gif", "video"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setNewGame({ ...newGame, preview_type: type })
                        }
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                          newGame.preview_type === type
                            ? "bg-lime text-black border-lime"
                            : "bg-card border-border text-foreground hover:border-lime/50"
                        }`}
                      >
                        {type === "image" && (
                          <ImageIcon className="w-4 h-4 mx-auto mb-1" />
                        )}
                        {type === "video" && (
                          <Video className="w-4 h-4 mx-auto mb-1" />
                        )}
                        {type === "gif" && (
                          <ImageIcon className="w-4 h-4 mx-auto mb-1" />
                        )}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File Uploads */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <Label>Thumbnail Image</Label>
                    <div
                      onClick={() => thumbnailRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-lime/50 transition-colors"
                    >
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {thumbnailFile
                          ? thumbnailFile.name
                          : "Click to upload thumbnail"}
                      </p>
                    </div>
                    <input
                      ref={thumbnailRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        setThumbnailFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>

                  {newGame.preview_type === "video" && (
                    <div className="space-y-2">
                      <Label>Video Preview (optional)</Label>
                      <div
                        onClick={() => videoPreviewRef.current?.click()}
                        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-lime/50 transition-colors"
                      >
                        <Video className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {videoPreviewFile
                            ? videoPreviewFile.name
                            : "Click to upload video preview"}
                        </p>
                      </div>
                      <input
                        ref={videoPreviewRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) =>
                          setVideoPreviewFile(e.target.files?.[0] || null)
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Game File (.zip)</Label>
                    <div
                      onClick={() => gameFileRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-lime/50 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {gameFile
                          ? gameFile.name
                          : "Click to upload game zip file"}
                      </p>
                    </div>
                    <input
                      ref={gameFileRef}
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) =>
                        setGameFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="h-2 bg-card rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-lime"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={uploading}
                className="w-full"
                data-testid="upload-game-button"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Upload Game"
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Enhanced Analytics Tab */}
          <TabsContent value="analytics">
            {analyticsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-lime animate-spin" />
              </div>
            ) : (
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
                      {analyticsOverview?.total_users?.toLocaleString() || 0}
                    </p>
                    {analyticsOverview?.new_users_today ? (
                      <p className="text-xs text-lime flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3" />
                        +{analyticsOverview.new_users_today} today
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
                      {analyticsOverview?.total_games || games.length}
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
                      {analyticsOverview?.total_plays?.toLocaleString() || 
                       games.reduce((acc, g) => acc + (g.play_count || 0), 0).toLocaleString()}
                    </p>
                    {analyticsOverview?.plays_today ? (
                      <p className="text-xs text-lime flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3" />
                        +{analyticsOverview.plays_today} today
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
                      {analyticsOverview?.active_users_24h || 0}
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
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
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
                        <div
                          key={game.id}
                          className="flex items-center gap-3"
                        >
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
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
