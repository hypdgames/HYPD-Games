import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Plus, Trash2, Eye, EyeOff, Upload, Image, 
  Gamepad2, Loader2, ArrowLeft, Save, X, Database, BarChart3,
  FileUp, ImagePlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/App";
import { toast } from "sonner";

const categories = ["Action", "Puzzle", "Arcade", "Racing", "Sports", "Strategy"];

export default function AdminDashboard() {
  const { user, token, API, setSettings } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Action",
    is_visible: true
  });
  
  // File states
  const [gameFile, setGameFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [exploreImageFile, setExploreImageFile] = useState(null);
  
  // Preview states
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [explorePreview, setExplorePreview] = useState(null);
  
  // Refs for file inputs
  const gameFileRef = useRef(null);
  const thumbnailRef = useRef(null);
  const exploreImageRef = useRef(null);

  useEffect(() => {
    if (!user?.is_admin) {
      toast.warning("Admin features require admin privileges");
    }
    fetchGames();
  }, [user]);

  const fetchGames = async () => {
    try {
      const res = await fetch(`${API}/admin/games`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setGames(data);
      } else if (res.status === 401 || res.status === 403) {
        const publicRes = await fetch(`${API}/games?visible_only=false`);
        if (publicRes.ok) {
          setGames(await publicRes.json());
        }
      }
    } catch (e) {
      console.error("Error fetching games:", e);
    }
    setLoading(false);
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (type === 'game') {
      setGameFile(file);
    } else if (type === 'thumbnail') {
      setThumbnailFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => setThumbnailPreview(reader.result);
      reader.readAsDataURL(file);
    } else if (type === 'explore') {
      setExploreImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => setExplorePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error("Please login as admin to manage games");
      return;
    }
    
    setUploading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("category", formData.category);
      formDataToSend.append("is_visible", formData.is_visible);
      
      if (gameFile) {
        formDataToSend.append("game_file", gameFile);
      }
      if (thumbnailFile) {
        formDataToSend.append("thumbnail_file", thumbnailFile);
      }
      if (exploreImageFile) {
        formDataToSend.append("explore_image_file", exploreImageFile);
      }
      
      const url = editingGame 
        ? `${API}/admin/games/${editingGame.id}/update-with-files` 
        : `${API}/admin/games/create-with-files`;
      
      const res = await fetch(url, {
        method: editingGame ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formDataToSend
      });
      
      if (res.ok) {
        toast.success(editingGame ? "Game updated!" : "Game created!");
        setShowAddDialog(false);
        setEditingGame(null);
        resetForm();
        fetchGames();
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to save game");
      }
    } catch (e) {
      console.error("Error saving game:", e);
      toast.error("Error saving game");
    }
    setUploading(false);
  };

  const handleDelete = async (gameId) => {
    if (!confirm("Are you sure you want to delete this game?")) return;
    if (!token) {
      toast.error("Please login as admin");
      return;
    }
    
    try {
      const res = await fetch(`${API}/admin/games/${gameId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success("Game deleted");
        fetchGames();
      } else {
        toast.error("Failed to delete game");
      }
    } catch (e) {
      toast.error("Error deleting game");
    }
  };

  const handleToggleVisibility = async (game) => {
    if (!token) {
      toast.error("Please login as admin");
      return;
    }
    
    try {
      const res = await fetch(`${API}/admin/toggle-visibility/${game.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchGames();
      }
    } catch (e) {
      toast.error("Error toggling visibility");
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API}/admin/settings/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setSettings({ logo_url: data.logo_url });
        toast.success("Logo uploaded!");
      }
    } catch (e) {
      toast.error("Error uploading logo");
    }
  };

  const handleSeedGames = async () => {
    if (!token) {
      toast.error("Please login as admin");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/seed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success("Sample games added!");
        fetchGames();
      } else {
        toast.error("Failed to seed games");
      }
    } catch (e) {
      toast.error("Error seeding games");
    }
    setLoading(false);
  };

  const handleGameFileUpload = async (gameId, e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch(`${API}/admin/games/${gameId}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        toast.success("Game file uploaded!");
        fetchGames();
      } else {
        toast.error("Failed to upload game file");
      }
    } catch (e) {
      toast.error("Error uploading game file");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "Action",
      is_visible: true
    });
    setGameFile(null);
    setThumbnailFile(null);
    setExploreImageFile(null);
    setThumbnailPreview(null);
    setExplorePreview(null);
    if (gameFileRef.current) gameFileRef.current.value = "";
    if (thumbnailRef.current) thumbnailRef.current.value = "";
    if (exploreImageRef.current) exploreImageRef.current.value = "";
  };

  const openEditDialog = (game) => {
    setEditingGame(game);
    setFormData({
      title: game.title,
      description: game.description,
      category: game.category,
      is_visible: game.is_visible
    });
    setThumbnailPreview(game.thumbnail_url);
    setExplorePreview(game.explore_image_url || game.thumbnail_url);
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-lime animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="admin-dashboard">
      {/* Header */}
      <div className="glass p-4 border-b border-white/5 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-card flex items-center justify-center"
              data-testid="admin-back-button"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet" />
              <span className="font-heading text-lg text-white">Admin</span>
            </div>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              setEditingGame(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                className="bg-lime text-black font-bold rounded-full"
                data-testid="add-game-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Game
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">
                  {editingGame ? "Edit Game" : "Add New Game"}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Game title"
                    className="bg-background border-white/10 text-white"
                    required
                    data-testid="game-title-input"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Game description"
                    className="bg-background border-white/10 text-white min-h-[80px]"
                    required
                    data-testid="game-description-input"
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="bg-background border-white/10 text-white" data-testid="game-category-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-white/10">
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-white hover:bg-white/10">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Game File Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileUp className="w-4 h-4" />
                    Game File (.html, .zip)
                  </Label>
                  <div 
                    onClick={() => gameFileRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-lime/50 transition-colors"
                  >
                    <input
                      ref={gameFileRef}
                      type="file"
                      accept=".html,.zip"
                      onChange={(e) => handleFileChange(e, 'game')}
                      className="hidden"
                      data-testid="game-file-input"
                    />
                    {gameFile ? (
                      <div className="flex items-center justify-center gap-2 text-lime">
                        <Gamepad2 className="w-5 h-5" />
                        <span className="text-sm font-medium">{gameFile.name}</span>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGameFile(null);
                            if (gameFileRef.current) gameFileRef.current.value = "";
                          }}
                          className="ml-2 text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Click to upload game file</p>
                        <p className="text-xs mt-1">Supports HTML5 games (.html) or ZIP archives</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Thumbnail Image Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImagePlus className="w-4 h-4" />
                    Feed Thumbnail Image
                  </Label>
                  <div 
                    onClick={() => thumbnailRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-lime/50 transition-colors"
                  >
                    <input
                      ref={thumbnailRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'thumbnail')}
                      className="hidden"
                      data-testid="thumbnail-file-input"
                    />
                    {thumbnailPreview ? (
                      <div className="relative">
                        <img 
                          src={thumbnailPreview} 
                          alt="Thumbnail preview" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setThumbnailFile(null);
                            setThumbnailPreview(null);
                            if (thumbnailRef.current) thumbnailRef.current.value = "";
                          }}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Image className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Click to upload feed thumbnail</p>
                        <p className="text-xs mt-1">Displayed in the main game feed</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Explore Image Upload */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImagePlus className="w-4 h-4" />
                    Explore Tile Image (optional)
                  </Label>
                  <div 
                    onClick={() => exploreImageRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-lime/50 transition-colors"
                  >
                    <input
                      ref={exploreImageRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'explore')}
                      className="hidden"
                      data-testid="explore-image-input"
                    />
                    {explorePreview ? (
                      <div className="relative">
                        <img 
                          src={explorePreview} 
                          alt="Explore preview" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExploreImageFile(null);
                            setExplorePreview(null);
                            if (exploreImageRef.current) exploreImageRef.current.value = "";
                          }}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Image className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">Click to upload explore tile image</p>
                        <p className="text-xs mt-1">Uses thumbnail if not provided</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visibility Toggle */}
                <div className="flex items-center justify-between py-2">
                  <Label>Visible in Feed</Label>
                  <Switch
                    checked={formData.is_visible}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
                    data-testid="game-visibility-switch"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddDialog(false);
                      setEditingGame(null);
                      resetForm();
                    }}
                    className="flex-1 border-white/10 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 bg-lime text-black font-bold hover:bg-lime/90"
                    data-testid="save-game-button"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingGame ? "Update" : "Create"} Game
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="bg-card border border-white/5 rounded-xl p-4 text-center hover:border-lime/30 transition-colors h-full">
              <Image className="w-8 h-8 text-lime mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Upload Logo</p>
            </div>
          </label>
          
          <button
            onClick={handleSeedGames}
            className="bg-card border border-white/5 rounded-xl p-4 text-center hover:border-lime/30 transition-colors"
            data-testid="seed-games-button"
          >
            <Database className="w-8 h-8 text-violet mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Seed Games</p>
          </button>

          <button
            onClick={() => navigate("/admin/analytics")}
            className="bg-card border border-lime/30 rounded-xl p-4 text-center hover:border-lime/50 transition-colors"
            data-testid="analytics-button"
          >
            <BarChart3 className="w-8 h-8 text-lime mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Analytics</p>
          </button>
        </div>

        {/* Games List */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-lime" />
            Games ({games.length})
          </h2>

          {games.length === 0 ? (
            <div className="text-center py-12 bg-card border border-white/5 rounded-xl">
              <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No games yet</p>
              <Button
                onClick={() => setShowAddDialog(true)}
                className="bg-lime text-black font-bold rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Game
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-card border border-white/5 rounded-xl p-4"
                  data-testid={`admin-game-${index}`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={game.thumbnail_url || "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=100&q=80"}
                        alt={game.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-white truncate">{game.title}</h3>
                          <p className="text-xs text-muted-foreground">{game.category}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          game.is_visible 
                            ? "bg-lime/20 text-lime" 
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {game.is_visible ? "Visible" : "Hidden"}
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {game.description}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{game.play_count || 0} plays</span>
                        <span>•</span>
                        <span className={game.has_game_file ? "text-lime" : "text-orange-400"}>
                          {game.has_game_file ? "✓ Has game file" : "⚠ No game file"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(game)}
                      className="flex-1 border-white/10 text-white hover:bg-white/10"
                      data-testid={`edit-game-${index}`}
                    >
                      Edit
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleVisibility(game)}
                      className="border-white/10 text-white hover:bg-white/10"
                      data-testid={`toggle-visibility-${index}`}
                    >
                      {game.is_visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>

                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".html,.zip"
                        onChange={(e) => handleGameFileUpload(game.id, e)}
                        className="hidden"
                      />
                      <div className="h-9 px-3 flex items-center justify-center border border-white/10 rounded-md text-white hover:bg-white/10 transition-colors">
                        <Upload className="w-4 h-4" />
                      </div>
                    </label>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(game.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      data-testid={`delete-game-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
