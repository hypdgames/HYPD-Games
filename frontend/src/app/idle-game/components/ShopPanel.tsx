"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  TrendingUp,
  RotateCcw,
  ChevronUp,
  Coins,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, getAnimalByTier } from "../data/animals";

interface ShopPanelProps {
  coins: number;
  buyCost: number;
  canBuy: boolean;
  cpsUpgradeCost: number;
  canUpgradeCps: boolean;
  cpsUpgradeLevel: number;
  prestigeBonus: number;
  canPrestige: boolean;
  prestigeLevel: number;
  prestigeMultiplier: number;
  onBuy: () => void;
  onUpgradeCps: () => void;
  onPrestige: () => void;
}

export function ShopPanel({
  buyCost,
  canBuy,
  cpsUpgradeCost,
  canUpgradeCps,
  cpsUpgradeLevel,
  prestigeBonus,
  canPrestige,
  prestigeLevel,
  prestigeMultiplier,
  onBuy,
  onUpgradeCps,
  onPrestige,
}: ShopPanelProps) {
  const [showPrestige, setShowPrestige] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tier1 = getAnimalByTier(1);

  return (
    <div className="px-3 pb-3" data-testid="idle-shop-panel">
      {/* Main Buy Button */}
      <motion.button
        onClick={onBuy}
        disabled={!canBuy}
        whileTap={canBuy ? { scale: 0.95 } : {}}
        className={`
          w-full py-3 rounded-xl font-heading text-lg flex items-center justify-center gap-2
          transition-all duration-200
          ${
            canBuy
              ? "bg-lime text-black hover:brightness-110 active:brightness-90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }
        `}
        data-testid="buy-animal-button"
      >
        <ShoppingCart className="w-5 h-5" />
        Buy {tier1?.emoji} {tier1?.name}
        <span className="ml-1 flex items-center gap-0.5 text-sm opacity-80">
          <Coins className="w-3.5 h-3.5" />
          {formatNumber(buyCost)}
        </span>
      </motion.button>

      {/* Expand Upgrades */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground py-2"
      >
        <ChevronUp
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {expanded ? "Hide" : "Upgrades"}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2"
          >
            {/* CPS Upgrade */}
            <button
              onClick={onUpgradeCps}
              disabled={!canUpgradeCps}
              className={`
                w-full p-3 rounded-xl flex items-center justify-between
                ${
                  canUpgradeCps
                    ? "bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20"
                    : "bg-muted/50 border border-border"
                }
              `}
              data-testid="upgrade-cps-button"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">
                    CPS Boost Lv.{cpsUpgradeLevel + 1}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    +25% coins per second
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Coins className="w-3 h-3 text-amber-400" />
                <span
                  className={
                    canUpgradeCps
                      ? "text-foreground font-bold"
                      : "text-muted-foreground"
                  }
                >
                  {formatNumber(cpsUpgradeCost)}
                </span>
              </div>
            </button>

            {/* Prestige */}
            <button
              onClick={() => canPrestige && setShowPrestige(true)}
              disabled={!canPrestige}
              className={`
                w-full p-3 rounded-xl flex items-center justify-between
                ${
                  canPrestige
                    ? "bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20"
                    : "bg-muted/50 border border-border"
                }
              `}
              data-testid="prestige-button"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">Prestige</p>
                  <p className="text-[10px] text-muted-foreground">
                    Reset for +{prestigeBonus.toFixed(1)}x multiplier
                  </p>
                </div>
              </div>
              <div className="text-sm text-purple-400 font-bold">
                {prestigeMultiplier.toFixed(1)}x
              </div>
            </button>

            {/* How to play */}
            <div className="bg-muted/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Info className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  How to Play
                </span>
              </div>
              <ul className="text-[10px] text-muted-foreground space-y-0.5">
                <li>Buy animals and place them on the grid</li>
                <li>Tap an animal to select, tap another same-tier to merge</li>
                <li>Merged animals earn more coins per second</li>
                <li>Prestige to reset with a permanent multiplier</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prestige Confirmation Modal */}
      <AnimatePresence>
        {showPrestige && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPrestige(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-card border border-purple-500/30 rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
              data-testid="prestige-modal"
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                  <RotateCcw className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="font-heading text-xl text-foreground">
                  Prestige?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Reset your grid and coins for a permanent multiplier boost.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Current Multiplier</span>
                  <span className="text-foreground font-bold">
                    {prestigeMultiplier.toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="text-purple-400 font-bold">
                    +{prestigeBonus.toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t border-border">
                  <span className="text-muted-foreground">New Multiplier</span>
                  <span className="text-lime font-bold">
                    {(prestigeMultiplier + prestigeBonus).toFixed(1)}x
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPrestige(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-purple-500 hover:bg-purple-600"
                  onClick={() => {
                    onPrestige();
                    setShowPrestige(false);
                  }}
                  data-testid="confirm-prestige"
                >
                  Prestige!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
