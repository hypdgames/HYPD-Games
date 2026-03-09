"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, Heart, Coins, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store";
import BottomNav from "@/components/bottom-nav";
import { toast } from "sonner";
import type { Game } from "@/types";

import type {
  Friend,
  FriendRequest,
  SearchUser,
  StreakData,
  LeaderboardEntry,
  CoinPackage,
  Transaction,
} from "./types";

import { AuthView } from "./components/AuthView";
import { ProfileHeader } from "./components/ProfileHeader";
import { StreakTab } from "./components/StreakTab";
import { GamesTab } from "./components/GamesTab";
import { FriendsTab } from "./components/FriendsTab";
import { WalletTab } from "./components/WalletTab";
import { AdminSection } from "./components/AdminSection";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { user, token, login, register, logout, settings } =
    useAuthStore();

  const defaultTab = tabParam === "wallet" ? "wallet" : "streak";

  const [savedGames, setSavedGames] = useState<Game[]>([]);

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Streak state
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [streakLeaderboard, setStreakLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [streakLoading, setStreakLoading] = useState(false);

  // Wallet state
  const [walletPackages, setWalletPackages] = useState<CoinPackage[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [purchasesEnabled, setPurchasesEnabled] = useState(false);

  // --- Data Fetching ---

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

  const fetchStreakData = async () => {
    if (!token) return;
    setStreakLoading(true);
    try {
      const [streakRes, leaderboardRes] = await Promise.all([
        fetch(`${API_URL}/api/user/streak`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/user/streak/leaderboard`),
      ]);
      if (streakRes.ok) setStreakData(await streakRes.json());
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json();
        setStreakLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error("Error fetching streak data:", e);
    }
    setStreakLoading(false);
  };

  const fetchWalletData = async () => {
    setWalletLoading(true);
    try {
      const packagesRes = await fetch(`${API_URL}/api/wallet/packages`);
      if (packagesRes.ok) {
        const data = await packagesRes.json();
        setWalletPackages(data.packages || []);
        setPurchasesEnabled(data.purchases_enabled || false);
      }
    } catch (e) {
      console.error("Error fetching wallet data:", e);
    }
    setWalletLoading(false);
  };

  const fetchTransactions = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/wallet/transactions?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (e) {
      console.error("Error fetching transactions:", e);
    }
  };

  // --- Friend Actions ---

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/users/search?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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

  // --- Effects ---

  useEffect(() => {
    if (user && token) {
      fetchSavedGames();
      fetchFriends();
      fetchStreakData();
      fetchWalletData();
      fetchTransactions();
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

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
  };

  // --- Logged out view ---
  if (!user) {
    return (
      <AuthView
        settings={settings}
        onLogin={(form) => login(form)}
        onRegister={(form) => register(form)}
      />
    );
  }

  // --- Logged in view ---
  return (
    <div
      className="min-h-screen bg-background pb-24"
      data-testid="profile-page-logged-in"
    >
      <ProfileHeader
        user={user}
        settings={settings}
        friendsCount={friends.length}
        onLogout={handleLogout}
      />

      <div className="px-6">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger
              value="streak"
              className="flex items-center gap-1"
              data-testid="streak-tab"
            >
              <Flame className="w-4 h-4" />
              <span className="hidden sm:inline">Streak</span>
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Games</span>
            </TabsTrigger>
            <TabsTrigger
              value="wallet"
              className="flex items-center gap-1"
              data-testid="wallet-tab"
            >
              <Coins className="w-4 h-4" />
              <span className="hidden sm:inline">Coins</span>
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {friendRequests.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-lime text-black text-[10px] flex items-center justify-center font-bold">
                  {friendRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="streak" data-testid="streak-tab-content">
            <StreakTab
              user={user}
              streakData={streakData}
              streakLeaderboard={streakLeaderboard}
              streakLoading={streakLoading}
            />
          </TabsContent>

          <TabsContent value="games">
            <GamesTab user={user} savedGames={savedGames} />
          </TabsContent>

          <TabsContent value="wallet" data-testid="wallet-tab-content">
            <WalletTab
              user={user}
              token={token!}
              walletPackages={walletPackages}
              transactions={transactions}
              walletLoading={walletLoading}
              purchasesEnabled={purchasesEnabled}
            />
          </TabsContent>

          <TabsContent value="friends">
            <FriendsTab
              friends={friends}
              friendRequests={friendRequests}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              friendsLoading={friendsLoading}
              onSendFriendRequest={sendFriendRequest}
              onAcceptRequest={acceptRequest}
              onDeclineRequest={declineRequest}
              onRemoveFriend={removeFriend}
            />
          </TabsContent>
        </Tabs>

        {/* Admin sections */}
        {user.is_admin && <AdminSection />}

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
