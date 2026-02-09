"use client";

import { Coins, TrendingUp } from "lucide-react";
import { formatNumber } from "../data/animals";

interface GameHeaderProps {
  coins: number;
  cps: number;
  highestTier: number;
  prestigeLevel: number;
}

export function GameHeader({ coins, cps, highestTier, prestigeLevel }: GameHeaderProps) {
  return (
    <div className="px-4 pt-4 pb-2" data-testid="idle-game-header">
      {/* Coin Display */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Coins className="w-5 h-5 text-amber-400" />
        </div>
        <span
          className="text-3xl font-heading text-foreground tabular-nums"
          data-testid="idle-coin-display"
        >
          {formatNumber(coins)}
        </span>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-lime" />
          <span data-testid="idle-cps-display">
            {formatNumber(cps)}/s
          </span>
        </div>
        {highestTier > 0 && (
          <span>Best: Tier {highestTier}</span>
        )}
        {prestigeLevel > 0 && (
          <span className="text-purple-400">
            Prestige {prestigeLevel}
          </span>
        )}
      </div>
    </div>
  );
}
