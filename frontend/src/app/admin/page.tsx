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
  Monitor,
  Smartphone,
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

interface DeviceStats {
  device_types: { name: string; count: number; percentage: number }[];
  browsers: { name: string; count: number }[];
  operating_systems: { name: string; count: number }[];
  screen_sizes: { name: string; count: number }[];
  total_events: number;
  period_days: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  ban_reason?: string;
  total_play_time: number;
  total_games_played: number;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  last_active_at?: string;
}

interface UserStats {
  total_users: number;
  admin_count: number;
  banned_count: number;
  new_today: number;
  new_this_week: number;
  new_this_month: number;
  active_24h: number;
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
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState(false);

  // Settings state
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoHeight, setLogoHeight] = useState<number>(32);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("HYPD");
  const [faviconUrl, setFaviconUrl] = useState<string>("");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string>("");
  const [primaryColor, setPrimaryColor] = useState<string>("#CCFF00");
  const [savingSettings, setSavingSettings] = useState(false);
  
  const gameFileRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);

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
        if (data.site_name) {
          setSiteName(data.site_name);
        }
        if (data.favicon_url) {
          setFaviconUrl(data.favicon_url);
          setFaviconPreview(data.favicon_url);
        }
        if (data.primary_color) {
          setPrimaryColor(data.primary_color);
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

  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFaviconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      let finalLogoUrl = logoUrl;
      let finalFaviconUrl = faviconUrl;

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
          const errorData = await uploadRes.text();
          console.error("Logo upload failed:", uploadRes.status, errorData);
          toast.error(`Failed to upload logo: ${uploadRes.status}`);
          setSavingSettings(false);
          return;
        }
      }

      // Upload favicon if a new file was selected
      if (faviconFile) {
        const formData = new FormData();
        formData.append("file", faviconFile);
        
        const uploadRes = await fetch(`${API_URL}/api/admin/upload-favicon`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalFaviconUrl = uploadData.url;
          setFaviconUrl(finalFaviconUrl);
        } else {
          toast.error("Failed to upload favicon");
          setSavingSettings(false);
          return;
        }
      }

      // Save all settings
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          logo_url: finalLogoUrl,
          logo_height: String(logoHeight),
          site_name: siteName,
          favicon_url: finalFaviconUrl,
          primary_color: primaryColor,
        }),
      });

      if (res.ok) {
        toast.success("Settings saved!");
        setLogoFile(null);
        setFaviconFile(null);
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

  const removeFavicon = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          favicon_url: "",
        }),
      });

      if (res.ok) {
        setFaviconUrl("");
        setFaviconPreview("");
        setFaviconFile(null);
        toast.success("Favicon removed!");
      } else {
        toast.error("Failed to remove favicon");
      }
    } catch (error) {
      console.error("Error removing favicon:", error);
      toast.error("Failed to remove favicon");
    }
    setSavingSettings(false);
  };

  const resetPrimaryColor = () => {
    setPrimaryColor("#CCFF00");
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

  // Fetch user statistics
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

  // Ban user
  const banUser = async (userId: string, reason?: string) => {
    if (!token) return;
    setUserActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/ban?reason=${encodeURIComponent(reason || "")}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("User banned successfully");
        fetchUsers(usersPage, userSearch, userFilter);
        fetchUserStats();
        setShowUserModal(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to ban user");
      }
    } catch {
      toast.error("Failed to ban user");
    }
    setUserActionLoading(false);
  };

  // Unban user
  const unbanUser = async (userId: string) => {
    if (!token) return;
    setUserActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/unban`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("User unbanned successfully");
        fetchUsers(usersPage, userSearch, userFilter);
        fetchUserStats();
        setShowUserModal(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to unban user");
      }
    } catch {
      toast.error("Failed to unban user");
    }
    setUserActionLoading(false);
  };

  // Make admin
  const makeAdmin = async (userId: string) => {
    if (!token) return;
    setUserActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/make-admin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("User is now an admin");
        fetchUsers(usersPage, userSearch, userFilter);
        fetchUserStats();
        setShowUserModal(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to make admin");
      }
    } catch {
      toast.error("Failed to make admin");
    }
    setUserActionLoading(false);
  };

  // Remove admin
  const removeAdmin = async (userId: string) => {
    if (!token) return;
    setUserActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/remove-admin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Admin status removed");
        fetchUsers(usersPage, userSearch, userFilter);
        fetchUserStats();
        setShowUserModal(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to remove admin");
      }
    } catch {
      toast.error("Failed to remove admin");
    }
    setUserActionLoading(false);
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    setUserActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("User deleted successfully");
        fetchUsers(usersPage, userSearch, userFilter);
        fetchUserStats();
        setShowUserModal(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    }
    setUserActionLoading(false);
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
        <Tabs defaultValue="games" className="w-full" onValueChange={(v) => {
          if (v === "analytics") fetchAnalytics();
          if (v === "users") { fetchUsers(); fetchUserStats(); }
        }}>
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">Games</span>
            </TabsTrigger>
            <TabsTrigger value="gamepix" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">GamePix</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
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

              {/* Device Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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
                      {deviceStats.screen_sizes.slice(0, 5).map((screen, i) => (
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
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="space-y-6">
              {/* User Stats Cards */}
              {userStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Total Users</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{userStats.total_users}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Activity className="w-4 h-4" />
                      <span className="text-xs">Active (24h)</span>
                    </div>
                    <p className="text-2xl font-bold text-lime">{userStats.active_24h}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs">New Today</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{userStats.new_today}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Target className="w-4 h-4" />
                      <span className="text-xs">Banned</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{userStats.banned_count}</p>
                  </div>
                </div>
              )}

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Search by username or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchUsers(1, userSearch, userFilter)}
                    className="pr-10"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1"
                    onClick={() => fetchUsers(1, userSearch, userFilter)}
                  >
                    Search
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={userFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setUserFilter("all"); fetchUsers(1, userSearch, "all"); }}
                  >
                    All
                  </Button>
                  <Button
                    variant={userFilter === "admins" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setUserFilter("admins"); fetchUsers(1, userSearch, "admins"); }}
                  >
                    Admins
                  </Button>
                  <Button
                    variant={userFilter === "banned" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setUserFilter("banned"); fetchUsers(1, userSearch, "banned"); }}
                    className={userFilter === "banned" ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    Banned
                  </Button>
                </div>
              </div>

              {/* Users List */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-lime animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                <Users className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{u.username}</span>
                                {u.is_admin && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-lime text-black rounded-full">ADMIN</span>
                                )}
                                {u.is_banned && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">BANNED</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>{u.total_games_played} games played</p>
                            <p>Joined {new Date(u.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {usersTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPage <= 1}
                      onClick={() => fetchUsers(usersPage - 1, userSearch, userFilter)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {usersPage} of {usersTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPage >= usersTotalPages}
                      onClick={() => fetchUsers(usersPage + 1, userSearch, userFilter)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* User Detail Modal */}
            {showUserModal && selectedUser && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
                <div className="bg-card border border-border rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        {selectedUser.avatar_url ? (
                          <img src={selectedUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{selectedUser.username}</h3>
                        <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                        <div className="flex gap-2 mt-1">
                          {selectedUser.is_admin && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-lime text-black rounded-full">ADMIN</span>
                          )}
                          {selectedUser.is_banned && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">BANNED</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Games Played</span>
                        <span className="text-sm font-medium text-foreground">{selectedUser.total_games_played}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Total Play Time</span>
                        <span className="text-sm font-medium text-foreground">{Math.round(selectedUser.total_play_time / 60)} mins</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground">Joined</span>
                        <span className="text-sm font-medium text-foreground">{new Date(selectedUser.created_at).toLocaleDateString()}</span>
                      </div>
                      {selectedUser.last_active_at && (
                        <div className="flex justify-between py-2 border-b border-border">
                          <span className="text-sm text-muted-foreground">Last Active</span>
                          <span className="text-sm font-medium text-foreground">{new Date(selectedUser.last_active_at).toLocaleDateString()}</span>
                        </div>
                      )}
                      {selectedUser.ban_reason && (
                        <div className="py-2 border-b border-border">
                          <span className="text-sm text-muted-foreground">Ban Reason</span>
                          <p className="text-sm text-red-500 mt-1">{selectedUser.ban_reason}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      {selectedUser.id !== user?.id && (
                        <>
                          {!selectedUser.is_banned ? (
                            <Button
                              variant="outline"
                              className="w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                              onClick={() => banUser(selectedUser.id, "Banned by admin")}
                              disabled={userActionLoading}
                            >
                              {userActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Ban User
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                              onClick={() => unbanUser(selectedUser.id)}
                              disabled={userActionLoading}
                            >
                              {userActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Unban User
                            </Button>
                          )}

                          {!selectedUser.is_admin ? (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => makeAdmin(selectedUser.id)}
                              disabled={userActionLoading || selectedUser.is_banned}
                            >
                              Make Admin
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => removeAdmin(selectedUser.id)}
                              disabled={userActionLoading}
                            >
                              Remove Admin
                            </Button>
                          )}

                          <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => deleteUser(selectedUser.id)}
                            disabled={userActionLoading || selectedUser.is_admin}
                          >
                            Delete User
                          </Button>
                        </>
                      )}

                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setShowUserModal(false)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-foreground">Site Settings</h2>
              
              {/* Site Name */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-lime" />
                  Site Name
                </h3>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Enter site name"
                  className="max-w-md"
                  data-testid="site-name-input"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This appears in the browser tab and as fallback when no logo is set
                </p>
              </div>

              {/* Logo Settings */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-lime" />
                  Header Logo
                </h3>
                
                {/* Logo Preview */}
                <div className="mb-4">
                  <label className="text-sm text-muted-foreground mb-2 block">Preview</label>
                  <div className="bg-background border border-border rounded-lg p-4 flex items-center justify-center min-h-[100px]">
                    {logoPreview ? (
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        style={{ height: `${logoHeight}px` }}
                        className="object-contain max-w-full"
                      />
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        No logo set - showing default &quot;{siteName}&quot; text
                      </div>
                    )}
                  </div>
                </div>

                {/* Logo Upload */}
                <div className="mb-4">
                  <label className="text-sm text-muted-foreground mb-2 block">Upload Logo Image</label>
                  <input
                    type="file"
                    ref={logoFileRef}
                    onChange={handleLogoFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoFileRef.current?.click()}
                      className="flex-1"
                      data-testid="upload-logo-button"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {logoFile ? logoFile.name : "Choose Image"}
                    </Button>
                    {(logoPreview || logoUrl) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={removeLogo}
                        className="text-red-500 hover:text-red-600"
                        disabled={savingSettings}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: PNG or SVG with transparent background
                  </p>
                </div>

                {/* Logo Height */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Logo Height: <span className="font-mono" style={{ color: primaryColor }}>{logoHeight}px</span>
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    value={logoHeight}
                    onChange={(e) => setLogoHeight(parseInt(e.target.value))}
                    className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: primaryColor }}
                    data-testid="logo-height-slider"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>20px</span>
                    <span>80px</span>
                  </div>
                </div>
              </div>

              {/* Favicon Settings */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-lime" />
                  Favicon
                </h3>
                
                {/* Favicon Preview */}
                <div className="mb-4">
                  <label className="text-sm text-muted-foreground mb-2 block">Preview</label>
                  <div className="bg-background border border-border rounded-lg p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded border border-border flex items-center justify-center overflow-hidden">
                      {faviconPreview ? (
                        <img 
                          src={faviconPreview} 
                          alt="Favicon preview" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">16x</span>
                      )}
                    </div>
                    <div className="w-12 h-12 rounded border border-border flex items-center justify-center overflow-hidden">
                      {faviconPreview ? (
                        <img 
                          src={faviconPreview} 
                          alt="Favicon preview" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">32x</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {faviconPreview ? "Browser tab icon" : "No favicon set"}
                    </span>
                  </div>
                </div>

                {/* Favicon Upload */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Upload Favicon</label>
                  <input
                    type="file"
                    ref={faviconFileRef}
                    onChange={handleFaviconFileChange}
                    accept="image/png,image/x-icon,image/svg+xml"
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => faviconFileRef.current?.click()}
                      className="flex-1"
                      data-testid="upload-favicon-button"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {faviconFile ? faviconFile.name : "Choose Icon"}
                    </Button>
                    {(faviconPreview || faviconUrl) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={removeFavicon}
                        className="text-red-500 hover:text-red-600"
                        disabled={savingSettings}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: 32x32 or 64x64 PNG, ICO, or SVG
                  </p>
                </div>
              </div>

              {/* Color Settings */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: primaryColor }} />
                    Brand Color
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetPrimaryColor}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset to Default
                  </Button>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Primary Color</label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer border-0"
                      data-testid="primary-color-picker"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="font-mono text-sm flex-1"
                      placeholder="#CCFF00"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Used for buttons, accents, and highlights. Light/dark mode backgrounds are automatic.
                  </p>
                </div>

                {/* Color Preview */}
                <div className="mt-4 p-4 rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button 
                      className="px-4 py-2 rounded-lg font-semibold text-sm"
                      style={{ backgroundColor: primaryColor, color: '#000' }}
                    >
                      Primary Button
                    </button>
                    <span style={{ color: primaryColor }} className="text-sm font-semibold">
                      Highlighted Text
                    </span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full text-black hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
                data-testid="save-settings-button"
              >
                {savingSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save All Settings
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
