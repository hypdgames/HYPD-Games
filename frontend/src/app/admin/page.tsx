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
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store";
import { toast } from "sonner";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const CATEGORIES = ["Action", "Puzzle", "Arcade", "Racing", "Sports", "Strategy"];

interface GDGame {
  gd_game_id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url: string;
  embed_url: string;
  instructions?: string;
  mobile?: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // GameDistribution state
  const [gdGames, setGdGames] = useState<GDGame[]>([]);
  const [gdLoading, setGdLoading] = useState(false);
  const [gdCategory, setGdCategory] = useState<string>("");
  const [gdSearch, setGdSearch] = useState("");
  const [selectedGdGames, setSelectedGdGames] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  
  const gameFileRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLInputElement>(null);

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

  // Fetch GameDistribution games
  const fetchGdGames = async (category?: string, search?: string) => {
    setGdLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.append("category", category);
      if (search) params.append("search", search);
      
      const res = await fetch(`${API_URL}/api/gamedistribution/browse?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGdGames(data.games || []);
      }
    } catch (error) {
      console.error("Error fetching GD games:", error);
      toast.error("Failed to load games from GameDistribution");
    }
    setGdLoading(false);
  };

  // Load GD games on tab switch
  useEffect(() => {
    if (gdGames.length === 0) {
      fetchGdGames();
    }
  }, []);

  const toggleGdGameSelection = (gdGameId: string) => {
    setSelectedGdGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gdGameId)) {
        newSet.delete(gdGameId);
      } else {
        newSet.add(gdGameId);
      }
      return newSet;
    });
  };

  const importSelectedGames = async () => {
    if (selectedGdGames.size === 0) {
      toast.error("Please select at least one game to import");
      return;
    }

    setImporting(true);
    try {
      const gamesToImport = gdGames
        .filter(g => selectedGdGames.has(g.gd_game_id))
        .map(g => ({
          gd_game_id: g.gd_game_id,
          title: g.title,
          description: g.description,
          category: g.category,
          thumbnail_url: g.thumbnail_url,
          embed_url: g.embed_url,
          instructions: g.instructions
        }));

      const res = await fetch(`${API_URL}/api/admin/gamedistribution/bulk-import`, {
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
        setSelectedGdGames(new Set());
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

  const isGameImported = (gdGameId: string) => {
    return games.some(g => g.gd_game_id === gdGameId);
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
        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              Games
            </TabsTrigger>
            <TabsTrigger value="gamedistribution" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Stats
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

          {/* GameDistribution Import Tab */}
          <TabsContent value="gamedistribution">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search games..."
                    value={gdSearch}
                    onChange={(e) => setGdSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchGdGames(gdCategory, gdSearch)}
                    className="pl-10"
                    data-testid="gd-search-input"
                  />
                </div>
                <select
                  value={gdCategory}
                  onChange={(e) => {
                    setGdCategory(e.target.value);
                    fetchGdGames(e.target.value, gdSearch);
                  }}
                  className="h-10 px-4 rounded-lg bg-card border border-border text-foreground"
                  data-testid="gd-category-select"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={() => fetchGdGames(gdCategory, gdSearch)}
                  disabled={gdLoading}
                >
                  {gdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                </Button>
              </div>

              {selectedGdGames.size > 0 && (
                <div className="flex items-center justify-between bg-lime/10 border border-lime/30 rounded-lg p-3">
                  <span className="text-sm text-foreground">
                    <span className="font-bold text-lime">{selectedGdGames.size}</span> games selected
                  </span>
                  <Button
                    onClick={importSelectedGames}
                    disabled={importing}
                    size="sm"
                    className="bg-lime text-black hover:bg-lime/90"
                    data-testid="import-selected-button"
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

              {gdLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-lime animate-spin" />
                </div>
              ) : gdGames.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No games found</p>
                  <p className="text-sm text-muted-foreground/70">
                    Try a different search or category
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {gdGames.map((game) => {
                    const imported = isGameImported(game.gd_game_id);
                    const selected = selectedGdGames.has(game.gd_game_id);
                    
                    return (
                      <motion.div
                        key={game.gd_game_id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`relative bg-card border rounded-xl overflow-hidden cursor-pointer transition-all ${
                          imported
                            ? "border-lime/50 opacity-60"
                            : selected
                            ? "border-lime ring-2 ring-lime/30"
                            : "border-border hover:border-lime/50"
                        }`}
                        onClick={() => !imported && toggleGdGameSelection(game.gd_game_id)}
                        data-testid={`gd-game-${game.gd_game_id}`}
                      >
                        <div className="aspect-square relative">
                          <img
                            src={game.thumbnail_url || "https://via.placeholder.com/200?text=Game"}
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
                        </div>
                        <div className="p-3">
                          <h3 className="font-bold text-sm text-foreground truncate">
                            {game.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {game.category}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
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

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-3xl font-heading text-lime">
                    {games.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Games</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-3xl font-heading text-lime">
                    {games
                      .reduce((acc, g) => acc + (g.play_count || 0), 0)
                      .toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Plays</p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-bold text-foreground mb-4">
                  Top Games by Plays
                </h3>
                {games.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No data yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[...games]
                      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
                      .slice(0, 5)
                      .map((game, i) => (
                        <div
                          key={game.id}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-lime/20 flex items-center justify-center text-xs font-bold text-lime">
                              {i + 1}
                            </span>
                            <span className="text-foreground truncate">
                              {game.title}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            {game.play_count?.toLocaleString() || 0}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
