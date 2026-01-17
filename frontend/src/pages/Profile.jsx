import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  User, Mail, Lock, LogOut, Settings, Heart, Trophy, 
  ChevronRight, Eye, EyeOff, Loader2, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/App";
import { toast } from "sonner";

export default function Profile() {
  const { user, login, register, logout, API, token, settings } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedGames, setSavedGames] = useState([]);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ 
    username: "", email: "", password: "", confirmPassword: "" 
  });

  useEffect(() => {
    if (user && token) {
      fetchSavedGames();
    }
  }, [user, token]);

  const fetchSavedGames = async () => {
    try {
      // Get user's saved game IDs and fetch game details
      if (!user?.saved_games?.length) return;
      
      const gamesRes = await fetch(`${API}/games`);
      if (gamesRes.ok) {
        const allGames = await gamesRes.json();
        const saved = allGames.filter(g => user.saved_games.includes(g.id));
        setSavedGames(saved);
      }
    } catch (e) {
      console.error("Error fetching saved games:", e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(registerForm.username, registerForm.email, registerForm.password);
      toast.success("Account created successfully!");
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
  };

  // Logged out view
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24" data-testid="profile-page">
        {/* Header */}
        <div className="glass p-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">HYPD</h1>
            )}
            <span className="text-white/50">Profile</span>
          </div>
        </div>

        <div className="p-6 max-w-md mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-card border border-white/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-2xl text-white mb-2">Join HYPD</h2>
            <p className="text-muted-foreground text-sm">
              Save your progress, track high scores, and more
            </p>
          </div>

          {/* Auth Tabs */}
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-card border border-white/10 rounded-xl p-1 h-auto">
              <TabsTrigger 
                value="login" 
                className="rounded-lg py-3 data-[state=active]:bg-lime data-[state=active]:text-black"
                data-testid="login-tab"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="register"
                className="rounded-lg py-3 data-[state=active]:bg-lime data-[state=active]:text-black"
                data-testid="register-tab"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="pl-12 h-12 bg-card border-white/10 rounded-xl text-white"
                      required
                      data-testid="login-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="pl-12 pr-12 h-12 bg-card border-white/10 rounded-xl text-white"
                      required
                      data-testid="login-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-lime text-black font-bold rounded-xl hover:bg-lime/90"
                  data-testid="login-submit"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login"}
                </Button>
              </form>
            </TabsContent>

            {/* Register Form */}
            <TabsContent value="register" className="mt-6">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">Username</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="gamer123"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      className="pl-12 h-12 bg-card border-white/10 rounded-xl text-white"
                      required
                      data-testid="register-username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="pl-12 h-12 bg-card border-white/10 rounded-xl text-white"
                      required
                      data-testid="register-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="pl-12 pr-12 h-12 bg-card border-white/10 rounded-xl text-white"
                      required
                      data-testid="register-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      className="pl-12 h-12 bg-card border-white/10 rounded-xl text-white"
                      required
                      data-testid="register-confirm-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-lime text-black font-bold rounded-xl hover:bg-lime/90"
                  data-testid="register-submit"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Logged in view
  return (
    <div className="min-h-screen bg-background pb-24" data-testid="profile-page-logged-in">
      {/* Header */}
      <div className="glass p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">HYPD</h1>
            )}
            <span className="text-white/50">Profile</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-white"
            data-testid="logout-button"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border-2 border-lime flex items-center justify-center mx-auto mb-4">
            <span className="font-heading text-3xl text-lime">
              {user.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="font-heading text-2xl text-white mb-1">{user.username}</h2>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-white/5 rounded-2xl p-4 text-center">
            <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-heading text-white">{user.saved_games?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Saved Games</p>
          </div>
          <div className="bg-card border border-white/5 rounded-2xl p-4 text-center">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-heading text-white">
              {Object.keys(user.high_scores || {}).length}
            </p>
            <p className="text-xs text-muted-foreground">High Scores</p>
          </div>
        </div>

        {/* Saved Games */}
        {savedGames.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Saved Games
            </h3>
            <div className="space-y-3">
              {savedGames.map(game => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => navigate(`/play/${game.id}`)}
                  className="flex items-center gap-4 bg-card border border-white/5 rounded-xl p-3 cursor-pointer hover:border-lime/30 transition-colors"
                  data-testid={`saved-game-${game.id}`}
                >
                  <img
                    src={game.thumbnail_url || "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=100&q=80"}
                    alt={game.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{game.title}</h4>
                    <p className="text-xs text-muted-foreground">{game.category}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* High Scores */}
        {Object.keys(user.high_scores || {}).length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              High Scores
            </h3>
            <div className="bg-card border border-white/5 rounded-xl overflow-hidden">
              {Object.entries(user.high_scores).map(([gameId, score], index) => (
                <div
                  key={gameId}
                  className={`flex items-center justify-between p-4 ${
                    index !== Object.entries(user.high_scores).length - 1 
                      ? "border-b border-white/5" 
                      : ""
                  }`}
                >
                  <span className="text-white">Game #{gameId.slice(0, 8)}</span>
                  <span className="font-heading text-lime">{score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Link */}
        {user.is_admin && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => navigate("/admin")}
            className="w-full flex items-center justify-between bg-violet/20 border border-violet/30 rounded-xl p-4 hover:bg-violet/30 transition-colors"
            data-testid="admin-link"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-violet" />
              <span className="font-bold text-white">Admin Dashboard</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        )}

        {/* Hidden Admin Login Link */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate("/admin")}
            className="text-xs text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            data-testid="hidden-admin-link"
          >
            Admin Access
          </button>
        </div>
      </div>
    </div>
  );
}
