"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store";
import {
  ANIMALS,
  GRID_SIZE,
  calculateTotalCps,
  getBuyCost,
  getPrestigeBonus,
  getCpsUpgradeCost,
} from "../data/animals";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const SAVE_INTERVAL = 30000; // Auto-save every 30 seconds
const TICK_INTERVAL = 100; // Update coins every 100ms for smooth display

export interface GameState {
  grid: (number | null)[]; // tier numbers or null
  coins: number;
  totalEarned: number;
  totalPurchased: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  highestTier: number;
  cpsUpgradeLevel: number;
  lastTick: number; // timestamp ms
}

const DEFAULT_STATE: GameState = {
  grid: Array(GRID_SIZE).fill(null),
  coins: 50,
  totalEarned: 0,
  totalPurchased: 0,
  prestigeLevel: 0,
  prestigeMultiplier: 1,
  highestTier: 0,
  cpsUpgradeLevel: 0,
  lastTick: Date.now(),
};

const LOCAL_KEY = "petIdle_gameState";

function loadLocalState(): GameState | null {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function saveLocalState(state: GameState) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {}
}

export function useGameState() {
  const { token } = useAuthStore();
  const [gameState, setGameState] = useState<GameState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // Computed values
  const totalCps = calculateTotalCps(
    gameState.grid,
    gameState.prestigeMultiplier,
    gameState.cpsUpgradeLevel
  );
  const buyCost = getBuyCost(gameState.totalPurchased, gameState.prestigeLevel);
  const canBuy = gameState.coins >= buyCost && gameState.grid.includes(null);
  const prestigeBonus = getPrestigeBonus(gameState.totalEarned);
  const canPrestige = prestigeBonus > 0;
  const cpsUpgradeCost = getCpsUpgradeCost(gameState.cpsUpgradeLevel);
  const canUpgradeCps = gameState.coins >= cpsUpgradeCost;

  // Load state on mount
  useEffect(() => {
    const loadState = async () => {
      let state: GameState | null = null;

      // Try backend first if logged in
      if (token) {
        try {
          const res = await fetch(`${API_URL}/api/idle-game/state`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.state) state = data.state;
          }
        } catch {}
      }

      // Fallback to localStorage
      if (!state) state = loadLocalState();

      if (state) {
        // Calculate offline earnings
        const now = Date.now();
        const elapsed = (now - state.lastTick) / 1000;
        if (elapsed > 1) {
          const cps = calculateTotalCps(
            state.grid,
            state.prestigeMultiplier,
            state.cpsUpgradeLevel
          );
          const offlineEarnings = Math.floor(cps * elapsed * 0.5); // 50% offline rate
          state.coins += offlineEarnings;
          state.totalEarned += offlineEarnings;
        }
        state.lastTick = now;
        setGameState(state);
      }
      setLoaded(true);
    };
    loadState();
  }, [token]);

  // Game tick - earn coins
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      setGameState((prev) => {
        const cps = calculateTotalCps(
          prev.grid,
          prev.prestigeMultiplier,
          prev.cpsUpgradeLevel
        );
        if (cps === 0) return prev;
        const earned = cps / (1000 / TICK_INTERVAL);
        return {
          ...prev,
          coins: prev.coins + earned,
          totalEarned: prev.totalEarned + earned,
          lastTick: Date.now(),
        };
      });
    }, TICK_INTERVAL);
    return () => clearInterval(interval);
  }, [loaded]);

  // Auto-save
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      saveLocalState(stateRef.current);
      if (token) {
        fetch(`${API_URL}/api/idle-game/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ state: stateRef.current }),
        }).catch(() => {});
      }
    }, SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [loaded, token]);

  // Save on state change (debounced via localStorage)
  useEffect(() => {
    if (loaded) saveLocalState(gameState);
  }, [gameState, loaded]);

  const buyAnimal = useCallback(() => {
    setGameState((prev) => {
      const cost = getBuyCost(prev.totalPurchased, prev.prestigeLevel);
      if (prev.coins < cost) return prev;
      const emptySlot = prev.grid.indexOf(null);
      if (emptySlot === -1) return prev;

      const newGrid = [...prev.grid];
      newGrid[emptySlot] = 1; // Always buy tier 1
      return {
        ...prev,
        grid: newGrid,
        coins: prev.coins - cost,
        totalPurchased: prev.totalPurchased + 1,
        highestTier: Math.max(prev.highestTier, 1),
      };
    });
  }, []);

  const handleSlotClick = useCallback((index: number) => {
    setGameState((prev) => {
      const clickedTier = prev.grid[index];

      // If no animal in slot, do nothing
      if (clickedTier === null) {
        setSelectedSlot(null);
        return prev;
      }

      // If no slot selected, select this one
      if (selectedSlot === null) {
        setSelectedSlot(index);
        return prev;
      }

      // If same slot clicked, deselect
      if (selectedSlot === index) {
        setSelectedSlot(null);
        return prev;
      }

      const selectedTier = prev.grid[selectedSlot];

      // If tiers match, merge!
      if (selectedTier === clickedTier && clickedTier < ANIMALS.length) {
        const newGrid = [...prev.grid];
        newGrid[selectedSlot] = null; // Clear source
        newGrid[index] = clickedTier + 1; // Upgrade target
        setSelectedSlot(null);
        return {
          ...prev,
          grid: newGrid,
          highestTier: Math.max(prev.highestTier, clickedTier + 1),
        };
      }

      // If tiers don't match, swap positions
      if (selectedTier !== null) {
        const newGrid = [...prev.grid];
        newGrid[selectedSlot] = clickedTier;
        newGrid[index] = selectedTier;
        setSelectedSlot(null);
        return { ...prev, grid: newGrid };
      }

      setSelectedSlot(index);
      return prev;
    });
  }, [selectedSlot]);

  const upgradeCps = useCallback(() => {
    setGameState((prev) => {
      const cost = getCpsUpgradeCost(prev.cpsUpgradeLevel);
      if (prev.coins < cost) return prev;
      return {
        ...prev,
        coins: prev.coins - cost,
        cpsUpgradeLevel: prev.cpsUpgradeLevel + 1,
      };
    });
  }, []);

  const prestige = useCallback(() => {
    setGameState((prev) => {
      const bonus = getPrestigeBonus(prev.totalEarned);
      if (bonus <= 0) return prev;
      return {
        ...DEFAULT_STATE,
        coins: 50,
        prestigeLevel: prev.prestigeLevel + 1,
        prestigeMultiplier: prev.prestigeMultiplier + bonus,
        highestTier: 0,
        lastTick: Date.now(),
      };
    });
    setSelectedSlot(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
  }, []);

  return {
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
  };
}
