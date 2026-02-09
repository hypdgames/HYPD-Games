"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Coins,
  TrendingUp,
  RotateCcw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/bottom-nav";
import { useGameState } from "./hooks/useGameState";
import { BattleArena } from "./components/BattleArena";
import { AnimalRoster } from "./components/AnimalRoster";
import { formatNumber, ANIMALS } from "./data/animals";

export default function IdleGamePage() {
  const {
    state,
    loaded,
    totalDps,
    xpNeeded,
    nextUnlock,
    prestigeBonus,
    canPrestige,
    tapTarget,
    upgradeAnimal,
    prestige,
  } = useGameState();

  const [showPrestige, setShowPrestige] = useState(false);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-lime animate-spin" />
      </div>
    );
  }

  // Find the highest-level unlocked animal to display in the arena
  const sortedOwned = Object.entries(state.animals)
    .map(([id, lvl]) => ({ def: ANIMALS.find((a) => a.id === id), lvl }))
    .filter((x) => x.def)
    .sort((a, b) => b.lvl - a.lvl);
  const activeAnimal = sortedOwned[0]?.def;

  const xpPct = (state.playerXp / xpNeeded) * 100;

  return (
    <div
      className="min-h-screen bg-background flex flex-col pb-20"
      data-testid="idle-game-page"
    >
      {/* Top Bar - Coins + DPS */}
      <div className="px-4 pt-3 pb-1" data-testid="idle-game-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <span
              className="text-2xl font-heading text-foreground tabular-nums"
              data-testid="idle-coin-display"
            >
              {formatNumber(state.coins)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3 text-lime" />
              <span data-testid="idle-dps-display">{formatNumber(totalDps)}/s</span>
            </div>
            {canPrestige && (
              <button
                onClick={() => setShowPrestige(true)}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 px-2 py-1 rounded-full"
                data-testid="prestige-button"
              >
                <RotateCcw className="w-3 h-3" />
                Prestige
              </button>
            )}
          </div>
        </div>

        {/* Player Level + XP */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-lime font-bold" data-testid="player-level">
              Level {state.playerLevel}
            </span>
            {nextUnlock && (
              <span className="text-muted-foreground">
                Next: {nextUnlock.emoji} {nextUnlock.name} @ Lv.{nextUnlock.unlockLevel}
              </span>
            )}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-lime rounded-full"
              style={{ width: `${xpPct}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <div className="text-[9px] text-muted-foreground text-right mt-0.5">
            {state.playerXp}/{xpNeeded} XP
          </div>
        </div>

        {state.prestigeLevel > 0 && (
          <div className="text-[10px] text-purple-400 flex items-center gap-1">
            <Star className="w-3 h-3" />
            Prestige {state.prestigeLevel} ({state.prestigeMultiplier.toFixed(1)}x)
          </div>
        )}
      </div>

      {/* Battle Arena */}
      <BattleArena
        targetHp={state.targetHp}
        targetMaxHp={state.targetMaxHp}
        targetsDestroyed={state.targetsDestroyed}
        totalDps={totalDps}
        onTap={tapTarget}
        activeAnimalEmoji={activeAnimal?.emoji || "🐰"}
        activeAnimalImage={activeAnimal?.imageUrl}
      />

      {/* Roster Label */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Your Animals ({Object.keys(state.animals).length})
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {state.targetsDestroyed} targets destroyed
        </span>
      </div>

      {/* Animal Roster - scrollable list */}
      <AnimalRoster
        animals={state.animals}
        playerLevel={state.playerLevel}
        coins={state.coins}
        prestigeMultiplier={state.prestigeMultiplier}
        onUpgrade={upgradeAnimal}
      />

      {/* Prestige Modal */}
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
                  Reset all progress for a permanent multiplier boost.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Multiplier</span>
                  <span className="text-foreground font-bold">
                    {state.prestigeMultiplier.toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="text-purple-400 font-bold">
                    +{prestigeBonus.toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-muted-foreground">New Multiplier</span>
                  <span className="text-lime font-bold">
                    {(state.prestigeMultiplier + prestigeBonus).toFixed(1)}x
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
                    prestige();
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

      <BottomNav />
    </div>
  );
}
