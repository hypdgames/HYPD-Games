"use client";

import { Loader2 } from "lucide-react";
import BottomNav from "@/components/bottom-nav";
import { useGameState } from "./hooks/useGameState";
import { GameHeader } from "./components/GameHeader";
import { GameGrid } from "./components/GameGrid";
import { ShopPanel } from "./components/ShopPanel";

export default function IdleGamePage() {
  const {
    gameState,
    loaded,
    selectedSlot,
    totalCps,
    buyCost,
    canBuy,
    prestigeBonus,
    canPrestige,
    cpsUpgradeCost,
    canUpgradeCps,
    buyAnimal,
    handleSlotClick,
    upgradeCps,
    prestige,
    clearSelection,
  } = useGameState();

  if (!loaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-lime animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col pb-20"
      data-testid="idle-game-page"
      onClick={(e) => {
        // Clear selection when clicking background
        if ((e.target as HTMLElement).closest("[data-testid^='grid-slot']"))
          return;
        clearSelection();
      }}
    >
      {/* Header with coins */}
      <GameHeader
        coins={gameState.coins}
        cps={totalCps}
        highestTier={gameState.highestTier}
        prestigeLevel={gameState.prestigeLevel}
      />

      {/* Grid - takes remaining space */}
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <GameGrid
          grid={gameState.grid}
          selectedSlot={selectedSlot}
          onSlotClick={handleSlotClick}
        />
      </div>

      {/* Shop Panel at bottom */}
      <ShopPanel
        coins={gameState.coins}
        buyCost={buyCost}
        canBuy={canBuy}
        cpsUpgradeCost={cpsUpgradeCost}
        canUpgradeCps={canUpgradeCps}
        cpsUpgradeLevel={gameState.cpsUpgradeLevel}
        prestigeBonus={prestigeBonus}
        canPrestige={canPrestige}
        prestigeMultiplier={gameState.prestigeMultiplier}
        onBuy={buyAnimal}
        onUpgradeCps={upgradeCps}
        onPrestige={prestige}
      />

      <BottomNav />
    </div>
  );
}
