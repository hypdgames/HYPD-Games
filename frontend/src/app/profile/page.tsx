"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  LogOut,
  Heart,
  Trophy,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  Clock,
  Crown,
  Check,
  Zap,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import BottomNav from "@/components/bottom-nav";
import { toast } from "sonner";
import type { Game } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Friend {
  id: string;
  username: string;
  email?: string;
  total_games_played?: number;
  total_play_time?: number;
}

interface FriendRequest {
  request_id: string;
  user: Friend;
  created_at: string;
}

interface SearchUser {
  id: string;
  username: string;
  email?: string;
  friendship_status: "none" | "friends" | "pending_sent" | "pending_received";
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, login, register, logout, settings } = useAuthStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedGames, setSavedGames] = useState<Game[]>([]);

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const fetchSavedGames = async () => {
    try {
      if (!user?.saved_games?.length) return;

      const gamesRes = await fetch(`${API_URL}/api/games`);
      if (gamesRes.ok) {
        const allGames = await gamesRes.json();
        const saved = allGames.filter((g: Game) =>
          user.saved_games.includes(g.id)
        );
        setSavedGames(saved);
      }
    } catch (e) {
      console.error("Error fetching saved games:", e);
    }
  };

  const fetchFriends = async () => {
    if (!token) return;
    setFriendsLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/api/friends`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/friends/requests`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
      }
      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setFriendRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Error fetching friends:", e);
    }
    setFriendsLoading(false);
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (e) {
      console.error("Error searching users:", e);
    }
    setSearchLoading(false);
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/friends/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        toast.success("Friend request sent!");
        searchUsers(searchQuery);
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to send request");
      }
    } catch {
      toast.error("Failed to send friend request");
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/friends/accept/${requestId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Friend request accepted!");
        fetchFriends();
      } else {
        toast.error("Failed to accept request");
      }
    } catch {
      toast.error("Failed to accept request");
    }
  };

  const declineRequest = async (requestId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/friends/decline/${requestId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Friend request declined");
        fetchFriends();
      } else {
        toast.error("Failed to decline request");
      }
    } catch {
      toast.error("Failed to decline request");
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      const res = await fetch(`${API_URL}/api/friends/${friendId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Friend removed");
        fetchFriends();
      } else {
        toast.error("Failed to remove friend");
      }
    } catch {
      toast.error("Failed to remove friend");
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchSavedGames();
      fetchFriends();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery && token) {
        searchUsers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm);
      toast.success("Welcome back!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
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
      await register(registerForm);
      toast.success("Account created successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
  };

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Logged out view
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24" data-testid="profile-page">
        {/* Header */}
        <div className="glass p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-8" />
              ) : (
                <h1 className="font-heading text-xl text-lime tracking-tight">
                  HYPD
                </h1>
              )}
              <span className="text-muted-foreground">Profile</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="p-6 max-w-md mx-auto">
          {/* Auth/PRO Tabs for logged out users */}
          <Tabs defaultValue="auth" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="auth" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Account
              </TabsTrigger>
              <TabsTrigger value="pro" className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                PRO
              </TabsTrigger>
            </TabsList>

            {/* Auth Tab */}
            <TabsContent value="auth">
              {/* Welcome Message */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="font-heading text-2xl text-foreground mb-2">
                  Join HYPD
                </h2>
                <p className="text-muted-foreground text-sm">
                  Save your progress, track high scores, and more
                </p>
              </div>

              {/* Auth Sub-Tabs */}
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" data-testid="login-tab">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="register" data-testid="register-tab">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                {/* Login Form */}
                <TabsContent value="login" className="mt-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={loginForm.email}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, email: e.target.value })
                          }
                          className="pl-12"
                          required
                          data-testid="login-email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={loginForm.password}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, password: e.target.value })
                          }
                          className="pl-12 pr-12"
                          required
                          data-testid="login-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full"
                      data-testid="login-submit"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Register Form */}
                <TabsContent value="register" className="mt-6">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="gamer123"
                          value={registerForm.username}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              username: e.target.value,
                            })
                          }
                          className="pl-12"
                          required
                          data-testid="register-username"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={registerForm.email}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              email: e.target.value,
                            })
                          }
                          className="pl-12"
                          required
                          data-testid="register-email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={registerForm.password}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              password: e.target.value,
                            })
                          }
                          className="pl-12 pr-12"
                          required
                          data-testid="register-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={registerForm.confirmPassword}
                          onChange={(e) =>
                            setRegisterForm({
                              ...registerForm,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="pl-12"
                          required
                          data-testid="register-confirm-password"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full"
                      data-testid="register-submit"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* PRO Tab for logged out users */}
            <TabsContent value="pro">
              {/* Hero */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border-2 border-lime flex items-center justify-center mx-auto mb-3">
                  <Crown className="w-8 h-8 text-lime" />
                </div>
                <h2 className="font-heading text-2xl text-foreground mb-1">
                  Upgrade to PRO
                </h2>
                <p className="text-sm text-muted-foreground">
                  Remove ads and unlock exclusive features
                </p>
              </div>

              {/* Plans */}
              <div className="space-y-3">
                {/* Free Plan */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-heading text-lg text-foreground">Free</h3>
                      <p className="text-muted-foreground text-sm">$0/forever</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">
                      Current Plan
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {["Access to all games", "Basic save progress", "Standard quality"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-lime flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* PRO Plan */}
                <div className="relative bg-card border-2 border-lime rounded-xl p-4">
                  <div className="absolute -top-2.5 left-4">
                    <span className="bg-lime text-black text-xs font-bold px-2 py-0.5 rounded-full">
                      POPULAR
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-heading text-lg text-foreground">PRO</h3>
                      <p className="text-lime text-sm font-bold">$4.99/month</p>
                    </div>
                    <Button disabled className="bg-lime/50 text-black">
                      Coming Soon
                    </Button>
                  </div>
                  <ul className="grid grid-cols-2 gap-2">
                    {["Ad-free experience", "Cloud save sync", "HD quality games", "Early access", "Exclusive badges"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-lime flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* PRO+ Plan */}
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-heading text-lg text-foreground">PRO+</h3>
                      <p className="text-muted-foreground text-sm">$9.99/month</p>
                    </div>
                    <Button variant="outline" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  <ul className="grid grid-cols-2 gap-2">
                    {["Everything in PRO", "Priority support", "Beta testing", "Custom themes", "Monthly credits"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-lime flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Benefits */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
                    <Zap className="w-5 h-5 text-lime" />
                  </div>
                  <p className="text-xs text-muted-foreground">No Ads</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
                    <Shield className="w-5 h-5 text-lime" />
                  </div>
                  <p className="text-xs text-muted-foreground">Cloud Saves</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
                    <Star className="w-5 h-5 text-lime" />
                  </div>
                  <p className="text-xs text-muted-foreground">Early Access</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Logged in view
  return (
    <div
      className="min-h-screen bg-background pb-24"
      data-testid="profile-page-logged-in"
    >
      {/* Header */}
      <div className="glass p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">
                HYPD
              </h1>
            )}
            <span className="text-muted-foreground">Profile</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
              data-testid="logout-button"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* User Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border-2 border-lime flex items-center justify-center mx-auto mb-4">
            <span className="font-heading text-3xl text-lime">
              {user.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="font-heading text-2xl text-foreground mb-1">
            {user.username}
          </h2>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Heart className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-heading text-foreground">
              {user.saved_games?.length || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Saved</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-xl font-heading text-foreground">
              {Object.keys(user.high_scores || {}).length}
            </p>
            <p className="text-[10px] text-muted-foreground">Scores</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-heading text-foreground">
              {friends.length}
            </p>
            <p className="text-[10px] text-muted-foreground">Friends</p>
          </div>
        </div>

        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Games
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Friends
              {friendRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-lime text-black text-xs flex items-center justify-center font-bold">
                  {friendRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pro" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              PRO
            </TabsTrigger>
          </TabsList>

          {/* Games Tab */}
          <TabsContent value="games">
            {/* Saved Games */}
            {savedGames.length > 0 ? (
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  Saved Games
                </h3>
                {savedGames.map((game) => (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => router.push(`/play/${game.id}`)}
                    className="flex items-center gap-4 bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-lime/30 transition-colors"
                    data-testid={`saved-game-${game.id}`}
                  >
                    <img
                      src={
                        game.thumbnail_url ||
                        "https://images.unsplash.com/photo-1637734373619-af1e76434bec?w=100&q=80"
                      }
                      alt={game.title}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground truncate text-sm">
                        {game.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {game.category}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-card rounded-xl border border-border mb-6">
                <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground text-sm">No saved games yet</p>
                <p className="text-xs text-muted-foreground/70">Tap the heart on any game to save it</p>
              </div>
            )}

            {/* High Scores */}
            {Object.keys(user.high_scores || {}).length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  High Scores
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {Object.entries(user.high_scores).map(
                    ([gameId, score], index) => (
                      <div
                        key={gameId}
                        className={`flex items-center justify-between p-3 ${
                          index !== Object.entries(user.high_scores).length - 1
                            ? "border-b border-border"
                            : ""
                        }`}
                      >
                        <span className="text-sm text-foreground">
                          Game #{gameId.slice(0, 8)}
                        </span>
                        <span className="font-heading text-lime">
                          {score.toLocaleString()}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends">
            {/* Search Users */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="friend-search-input"
                />
              </div>

              {/* Search Results */}
              {searchQuery.length >= 2 && (
                <div className="mt-3 space-y-2">
                  {searchLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 text-lime animate-spin" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      No users found
                    </p>
                  ) : (
                    searchResults.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
                        data-testid={`search-result-${u.id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="font-bold text-foreground">
                            {u.username?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-sm truncate">
                            {u.username}
                          </p>
                        </div>
                        {u.friendship_status === "none" && (
                          <Button
                            size="sm"
                            onClick={() => sendFriendRequest(u.id)}
                            className="bg-lime text-black hover:bg-lime/90"
                            data-testid={`add-friend-${u.id}`}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        )}
                        {u.friendship_status === "friends" && (
                          <span className="text-xs text-lime flex items-center gap-1">
                            <UserCheck className="w-4 h-4" />
                            Friends
                          </span>
                        )}
                        {u.friendship_status === "pending_sent" && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Pending
                          </span>
                        )}
                        {u.friendship_status === "pending_received" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const req = friendRequests.find(r => r.user.id === u.id);
                              if (req) acceptRequest(req.request_id);
                            }}
                          >
                            Accept
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Friend Requests ({friendRequests.length})
                </h3>
                <div className="space-y-2">
                  {friendRequests.map((req) => (
                    <motion.div
                      key={req.request_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 bg-lime/10 border border-lime/30 rounded-xl p-3"
                      data-testid={`friend-request-${req.request_id}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="font-bold text-foreground">
                          {req.user.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">
                          {req.user.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Wants to be your friend
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => acceptRequest(req.request_id)}
                          className="bg-lime text-black hover:bg-lime/90"
                          data-testid={`accept-request-${req.request_id}`}
                        >
                          <UserCheck className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => declineRequest(req.request_id)}
                          data-testid={`decline-request-${req.request_id}`}
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends List */}
            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Friends ({friends.length})
              </h3>
              {friendsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-lime animate-spin" />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8 bg-card rounded-xl border border-border">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground text-sm">No friends yet</p>
                  <p className="text-xs text-muted-foreground/70">Search for users above to add friends</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <motion.div
                      key={friend.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
                      data-testid={`friend-${friend.id}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 flex items-center justify-center">
                        <span className="font-bold text-foreground">
                          {friend.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">
                          {friend.username}
                        </p>
                        {friend.total_games_played !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            {friend.total_games_played} games • {formatPlayTime(friend.total_play_time || 0)} played
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFriend(friend.id)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* PRO Tab */}
          <TabsContent value="pro">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lime/20 to-violet/20 border-2 border-lime flex items-center justify-center mx-auto mb-3">
                <Crown className="w-8 h-8 text-lime" />
              </div>
              <h2 className="font-heading text-2xl text-foreground mb-1">
                Upgrade to PRO
              </h2>
              <p className="text-sm text-muted-foreground">
                Remove ads and unlock exclusive features
              </p>
            </motion.div>

            {/* Plans */}
            <div className="space-y-3">
              {/* Free Plan */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-heading text-lg text-foreground">Free</h3>
                    <p className="text-muted-foreground text-sm">$0/forever</p>
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">
                    Current Plan
                  </span>
                </div>
                <ul className="space-y-2">
                  {["Access to all games", "Basic save progress", "Standard quality"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-lime flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* PRO Plan */}
              <div className="relative bg-card border-2 border-lime rounded-xl p-4">
                <div className="absolute -top-2.5 left-4">
                  <span className="bg-lime text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-heading text-lg text-foreground">PRO</h3>
                    <p className="text-lime text-sm font-bold">$4.99/month</p>
                  </div>
                  <Button disabled className="bg-lime/50 text-black">
                    Coming Soon
                  </Button>
                </div>
                <ul className="grid grid-cols-2 gap-2">
                  {["Ad-free experience", "Cloud save sync", "HD quality games", "Early access", "Exclusive badges"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-lime flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* PRO+ Plan */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-heading text-lg text-foreground">PRO+</h3>
                    <p className="text-muted-foreground text-sm">$9.99/month</p>
                  </div>
                  <Button variant="outline" disabled>
                    Coming Soon
                  </Button>
                </div>
                <ul className="grid grid-cols-2 gap-2">
                  {["Everything in PRO", "Priority support", "Beta testing", "Custom themes", "Monthly credits"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-lime flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Benefits */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-5 h-5 text-lime" />
                </div>
                <p className="text-xs text-muted-foreground">No Ads</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-5 h-5 text-lime" />
                </div>
                <p className="text-xs text-muted-foreground">Cloud Saves</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center mx-auto mb-2">
                  <Star className="w-5 h-5 text-lime" />
                </div>
                <p className="text-xs text-muted-foreground">Early Access</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Admin Link */}
        {user.is_admin && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => router.push("/admin")}
            className="w-full flex items-center justify-between bg-violet/20 border border-violet/30 rounded-xl p-4 hover:bg-violet/30 transition-colors mt-6"
            data-testid="admin-link"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-violet" />
              <span className="font-bold text-foreground">Admin Dashboard</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        )}

        {/* Hidden Admin Login Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push("/admin")}
            className="text-xs text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            data-testid="hidden-admin-link"
          >
            Admin Access
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
