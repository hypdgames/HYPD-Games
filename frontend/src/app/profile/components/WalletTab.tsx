"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Crown,
  Clock,
  Coins,
  ShoppingCart,
  History,
  Gift,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { User } from "@/types";
import type { CoinPackage, AdFreeOption, Transaction } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface WalletTabProps {
  user: User;
  token: string;
  walletPackages: CoinPackage[];
  adFreeOptions: AdFreeOption[];
  transactions: Transaction[];
  walletLoading: boolean;
  purchasesEnabled: boolean;
  onRefreshUser: () => void;
  onRefreshTransactions: () => void;
}

function formatTxDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WalletTab({
  user,
  token,
  walletPackages,
  adFreeOptions,
  transactions,
  walletLoading,
  purchasesEnabled,
  onRefreshUser,
  onRefreshTransactions,
}: WalletTabProps) {
  const [walletTab, setWalletTab] = useState<"buy" | "spend" | "history">(
    "buy"
  );
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [spending, setSpending] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
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
    const option = adFreeOptions.find((o) => o.option_id === optionId);
    if (!option) return;

    if ((user?.coin_balance || 0) < option.coins) {
      toast.error("Not enough coins!");
      setWalletTab("buy");
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
        onRefreshUser();
        onRefreshTransactions();
      } else {
        const error = await res.json();
        toast.error(error.detail || "Failed to purchase ad-free");
      }
    } catch {
      toast.error("Failed to spend coins");
    }
    setSpending(null);
  };

  if (walletLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-lime animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Coin Balance Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20 border-2 border-amber-500/50 rounded-2xl p-6"
      >
        <div className="absolute top-4 right-4">
          <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
        </div>
        <div className="text-center">
          <Coins className="w-12 h-12 text-amber-400 mx-auto mb-2" />
          <p className="text-4xl font-heading text-foreground">
            {(user?.coin_balance || 0).toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">Total Coins</p>
        </div>
      </motion.div>

      {/* Sub-tabs for Buy / Spend / History */}
      <div className="flex gap-2 p-1 bg-card border border-border rounded-lg">
        <button
          onClick={() => setWalletTab("buy")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            walletTab === "buy"
              ? "bg-lime text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Buy
        </button>
        <button
          onClick={() => setWalletTab("spend")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            walletTab === "spend"
              ? "bg-lime text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Gift className="w-4 h-4" />
          Spend
        </button>
        <button
          onClick={() => setWalletTab("history")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            walletTab === "history"
              ? "bg-lime text-black"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* Buy Coins Section */}
      {walletTab === "buy" && (
        <div className="space-y-3">
          {!purchasesEnabled && (
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <Gift className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Coin purchases coming soon!
              </p>
            </div>
          )}
          {walletPackages.map((pkg, index) => (
            <motion.div
              key={pkg.package_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-card border rounded-xl p-4 ${
                pkg.is_popular ? "border-lime" : "border-border"
              }`}
            >
              {pkg.is_popular && (
                <div className="absolute -top-2.5 left-4">
                  <span className="bg-lime text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    POPULAR
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-lg text-foreground">
                    {pkg.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-foreground">
                      {pkg.coins.toLocaleString()}
                    </span>
                    {pkg.bonus_coins > 0 && (
                      <span className="text-xs text-lime">
                        +{pkg.bonus_coins.toLocaleString()} bonus
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handlePurchase(pkg.package_id)}
                  disabled={
                    !purchasesEnabled || purchasing === pkg.package_id
                  }
                  className="bg-lime text-black hover:bg-lime/90"
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
        </div>
      )}

      {/* Spend Coins Section */}
      {walletTab === "spend" && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-violet-400" />
              <h3 className="font-heading text-lg text-foreground">
                Ad-Free Gaming
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Remove ads from GamePix games for a limited time
            </p>
            {adFreeOptions.map((option) => (
              <div
                key={option.option_id}
                className="flex items-center justify-between py-2 border-t border-border first:border-0"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{option.label}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSpendAdFree(option.option_id)}
                  disabled={
                    spending === option.option_id ||
                    (user?.coin_balance || 0) < option.coins
                  }
                  variant={
                    (user?.coin_balance || 0) >= option.coins
                      ? "default"
                      : "outline"
                  }
                  className={
                    (user?.coin_balance || 0) >= option.coins
                      ? "bg-violet-500 hover:bg-violet-600"
                      : ""
                  }
                >
                  {spending === option.option_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Coins className="w-3 h-3 mr-1" />
                      {option.coins}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              More ways to spend coins coming soon!
            </p>
          </div>
        </div>
      )}

      {/* Transaction History */}
      {walletTab === "history" && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between bg-card border border-border rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.transaction_type === "purchase"
                        ? "bg-green-500/20"
                        : tx.transaction_type === "spend"
                          ? "bg-violet-500/20"
                          : "bg-amber-500/20"
                    }`}
                  >
                    {tx.transaction_type === "purchase" ? (
                      <ShoppingCart className="w-4 h-4 text-green-400" />
                    ) : tx.transaction_type === "spend" ? (
                      <Gift className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Coins className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {tx.description || tx.transaction_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTxDate(tx.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-medium ${
                      tx.coins > 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {tx.coins > 0 ? "+" : ""}
                    {tx.coins}
                  </p>
                  {tx.amount_usd && (
                    <p className="text-xs text-muted-foreground">
                      ${tx.amount_usd.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
