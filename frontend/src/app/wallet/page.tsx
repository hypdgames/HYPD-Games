"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Coins,
  ShoppingCart,
  History,
  Zap,
  Gift,
  Loader2,
  Sparkles,
  Clock,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";
import BottomNav from "@/components/bottom-nav";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface CoinPackage {
  package_id: string;
  name: string;
  coins: number;
  bonus_coins: number;
  total_coins: number;
  price_usd: number;
  is_popular: boolean;
}

interface AdFreeOption {
  option_id: string;
  label: string;
  coins: number;
  hours: number;
}

interface Transaction {
  id: string;
  transaction_type: string;
  status: string;
  coins: number;
  amount_usd?: number;
  description?: string;
  created_at: string;
}

export default function WalletPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, settings, refreshUser } = useAuthStore();

  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [adFreeOptions, setAdFreeOptions] = useState<AdFreeOption[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [spending, setSpending] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"buy" | "spend" | "history">("buy");

  // Check for payment return
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");

    if (paymentStatus === "success" && sessionId) {
      pollPaymentStatus(sessionId);
    } else if (paymentStatus === "cancelled") {
      toast.error("Payment cancelled");
      // Clear URL params
      router.replace("/wallet");
    }
  }, [searchParams]);

  const pollPaymentStatus = async (sessionId: string, attempts = 0) => {
    const maxAttempts = 5;

    if (attempts >= maxAttempts) {
      toast.error("Payment verification timed out. Please check your transactions.");
      router.replace("/wallet");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/wallet/checkout/status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();

        if (data.payment_status === "paid") {
          toast.success(`Payment successful! +${data.coins_credited} coins added!`);
          refreshUser();
          fetchTransactions();
          router.replace("/wallet");
          return;
        } else if (data.status === "expired") {
          toast.error("Payment session expired");
          router.replace("/wallet");
          return;
        }
      }

      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (e) {
      console.error("Error checking payment:", e);
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [packagesRes, optionsRes] = await Promise.all([
        fetch(`${API_URL}/api/wallet/packages`),
        fetch(`${API_URL}/api/wallet/ad-free-options`),
      ]);

      if (packagesRes.ok) {
        const data = await packagesRes.json();
        setPackages(data.packages || []);
      }
      if (optionsRes.ok) {
        const data = await optionsRes.json();
        setAdFreeOptions(data.options || []);
      }
    } catch (e) {
      console.error("Error fetching wallet data:", e);
    }
    setLoading(false);
  }, []);

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

  useEffect(() => {
    fetchData();
    if (token) {
      fetchTransactions();
    }
  }, [fetchData, token]);

  const handlePurchase = async (packageId: string) => {
    if (!token) {
      toast.error("Please login to purchase coins");
      router.push("/profile");
      return;
    }

    setPurchasing(packageId);
    try {
      const res = await fetch(`${API_URL}/api/wallet/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          package_id: packageId,
          origin_url: window.location.origin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect to Stripe checkout
        window.location.href = data.checkout_url;
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to create checkout");
      }
    } catch {
      toast.error("Failed to initiate purchase");
    }
    setPurchasing(null);
  };

  const handleSpendAdFree = async (optionId: string) => {
    if (!token) {
      toast.error("Please login first");
      router.push("/profile");
      return;
    }

    const option = adFreeOptions.find((o) => o.option_id === optionId);
    if (!option) return;

    if ((user?.coin_balance || 0) < option.coins) {
      toast.error("Not enough coins!");
      setActiveTab("buy");
      return;
    }

    setSpending(optionId);
    try {
      const res = await fetch(`${API_URL}/api/wallet/spend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          spend_type: "ad_free",
          option_id: optionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        refreshUser();
        fetchTransactions();
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to purchase ad-free");
      }
    } catch (e) {
      toast.error("Failed to spend coins");
    }
    setSpending(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Not logged in view
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-24" data-testid="wallet-page">
        <div className="glass p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-8" />
              ) : (
                <h1 className="font-heading text-xl text-lime tracking-tight">HYPD</h1>
              )}
              <span className="text-muted-foreground">Wallet</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500 flex items-center justify-center mx-auto mb-4">
            <Coins className="w-10 h-10 text-yellow-500" />
          </div>
          <h2 className="font-heading text-2xl text-foreground mb-2">Coin Wallet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Login to access your wallet, purchase coins, and unlock premium features!
          </p>
          <Button onClick={() => router.push("/profile")} className="bg-lime text-black hover:bg-lime/90">
            Login to Continue
          </Button>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="wallet-page-logged-in">
      {/* Header */}
      <div className="glass p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8" />
            ) : (
              <h1 className="font-heading text-xl text-lime tracking-tight">HYPD</h1>
            )}
            <span className="text-muted-foreground">Wallet</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="p-4">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-yellow-500/20 via-orange-500/10 to-amber-500/20 border-2 border-yellow-500/50 rounded-2xl p-6 mb-6"
          data-testid="wallet-balance-card"
        >
          <div className="absolute top-4 right-4">
            <Sparkles className="w-6 h-6 text-yellow-500/50" />
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/30 to-orange-500/30 border-2 border-yellow-500 flex items-center justify-center">
              <Coins className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Balance</p>
              <p className="text-4xl font-heading text-foreground" data-testid="coin-balance">
                {(user.coin_balance || 0).toLocaleString()}
              </p>
              <p className="text-xs text-yellow-500">COINS</p>
            </div>
          </div>

          {user.is_ad_free && user.ad_free_until && (
            <div className="mt-4 flex items-center gap-2 bg-green-500/20 px-3 py-2 rounded-lg">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-400">
                Ad-free until {new Date(user.ad_free_until).toLocaleDateString()}
              </span>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("buy")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
              activeTab === "buy"
                ? "bg-lime text-black"
                : "bg-card border border-border text-muted-foreground"
            }`}
            data-testid="buy-tab"
          >
            <ShoppingCart className="w-4 h-4" />
            Buy Coins
          </button>
          <button
            onClick={() => setActiveTab("spend")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
              activeTab === "spend"
                ? "bg-lime text-black"
                : "bg-card border border-border text-muted-foreground"
            }`}
            data-testid="spend-tab"
          >
            <Zap className="w-4 h-4" />
            Spend
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
              activeTab === "history"
                ? "bg-lime text-black"
                : "bg-card border border-border text-muted-foreground"
            }`}
            data-testid="history-tab"
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-lime animate-spin" />
          </div>
        ) : (
          <>
            {/* Buy Coins Tab */}
            {activeTab === "buy" && (
              <div className="space-y-3" data-testid="buy-coins-section">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Choose a Package
                </h3>
                {packages.map((pkg) => (
                  <motion.div
                    key={pkg.package_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`relative bg-card border rounded-xl p-4 ${
                      pkg.is_popular ? "border-lime" : "border-border"
                    }`}
                    data-testid={`package-${pkg.package_id}`}
                  >
                    {pkg.is_popular && (
                      <div className="absolute -top-2.5 left-4">
                        <span className="bg-lime text-black text-xs font-bold px-2 py-0.5 rounded-full">
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <Coins className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground">{pkg.name}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-heading text-yellow-500">
                              {pkg.coins.toLocaleString()}
                            </span>
                            {pkg.bonus_coins > 0 && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Gift className="w-3 h-3" />
                                +{pkg.bonus_coins}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handlePurchase(pkg.package_id)}
                        disabled={purchasing === pkg.package_id}
                        className={pkg.is_popular ? "bg-lime text-black hover:bg-lime/90" : ""}
                        data-testid={`buy-${pkg.package_id}`}
                      >
                        {purchasing === pkg.package_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          `$${pkg.price_usd.toFixed(2)}`
                        )}
                      </Button>
                    </div>
                  </motion.div>
                ))}

                {/* Earn Free Coins */}
                <div className="mt-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                  <h4 className="font-bold text-foreground flex items-center gap-2 mb-2">
                    <Gift className="w-5 h-5 text-purple-500" />
                    Earn Free Coins!
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Maintain your daily login streak to earn bonus coins at milestones:
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-muted px-2 py-1 rounded">7 days: 50</span>
                    <span className="bg-muted px-2 py-1 rounded">14 days: 100</span>
                    <span className="bg-muted px-2 py-1 rounded">30 days: 250</span>
                    <span className="bg-muted px-2 py-1 rounded">60 days: 500</span>
                  </div>
                </div>
              </div>
            )}

            {/* Spend Coins Tab */}
            {activeTab === "spend" && (
              <div className="space-y-4" data-testid="spend-coins-section">
                {/* Ad-Free Section */}
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Remove Ads
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {adFreeOptions.map((option) => (
                      <motion.button
                        key={option.option_id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => handleSpendAdFree(option.option_id)}
                        disabled={spending === option.option_id || (user?.coin_balance || 0) < option.coins}
                        className={`bg-card border rounded-xl p-4 text-left transition-colors ${
                          (user?.coin_balance || 0) >= option.coins
                            ? "border-border hover:border-lime/50"
                            : "border-border opacity-50"
                        }`}
                        data-testid={`adfree-${option.option_id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Clock className="w-5 h-5 text-blue-500" />
                          {spending === option.option_id && (
                            <Loader2 className="w-4 h-4 animate-spin text-lime" />
                          )}
                        </div>
                        <p className="font-bold text-foreground">{option.label}</p>
                        <p className="text-sm text-yellow-500 font-heading">{option.coins} coins</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Premium Games Section - Placeholder */}
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Premium Games
                  </h3>
                  <div className="bg-card border border-border rounded-xl p-6 text-center">
                    <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground text-sm">Coming Soon!</p>
                    <p className="text-xs text-muted-foreground/70">
                      Unlock exclusive premium games with your coins
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction History Tab */}
            {activeTab === "history" && (
              <div data-testid="history-section">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Recent Transactions
                </h3>
                {transactions.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <History className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground text-sm">No transactions yet</p>
                    <p className="text-xs text-muted-foreground/70">
                      Purchase coins or spend them to see history
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
                        data-testid={`transaction-${tx.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              tx.coins > 0
                                ? "bg-green-500/20"
                                : "bg-red-500/20"
                            }`}
                          >
                            {tx.coins > 0 ? (
                              <Coins className="w-5 h-5 text-green-500" />
                            ) : (
                              <Zap className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {tx.description || tx.transaction_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-heading ${
                              tx.coins > 0 ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            {tx.coins > 0 ? "+" : ""}
                            {tx.coins}
                          </p>
                          {tx.status !== "completed" && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                tx.status === "pending"
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : "bg-red-500/20 text-red-500"
                              }`}
                            >
                              {tx.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
