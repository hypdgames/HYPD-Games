"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store";
import {
  ANIMALS,
  getUpgradeCost,
  getAnimalDps,
  xpForLevel,
  getTargetMaxHp,
  getTargetReward,
  getPrestigeBonus,
} from "../data/animals";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const SAVE_INTERVAL = 30000;
const TICK_MS = 100;

export interface GameState {
  coins: number;
  totalEarned: number;
  playerLevel: number;
  playerXp: number;
  // animalId -> level (only entries for unlocked animals, level >= 1)
  animals: Record<string, number>;
  targetHp: number;
  targetMaxHp: number;
  targetsDestroyed: number;
  prestigeLevel: number;
  prestigeMultiplier: number;
  lastTick: number;
}

const DEFAULT_STATE: GameState = {
  coins: 0,
  totalEarned: 0,
  playerLevel: 1,
  playerXp: 0,
  animals: { bunny: 1 }, // Start with Bunny at level 1
  targetHp: 10,
  targetMaxHp: 10,
  targetsDestroyed: 0,
  prestigeLevel: 0,
  prestigeMultiplier: 1,
  lastTick: Date.now(),
};

const LOCAL_KEY = "petIdle_v2";

function loadLocal(): GameState | null {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}
function saveLocal(state: GameState) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {}
}

export function useGameState() {
  const { token } = useAuthStore();
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  // ---- Computed ----
  const totalDps = Object.entries(state.animals).reduce((sum, [id, lvl]) => {
    const def = ANIMALS.find((a) => a.id === id);
    if (!def) return sum;
    return sum + getAnimalDps(def, lvl, state.prestigeMultiplier);
  }, 0);

  const xpNeeded = xpForLevel(state.playerLevel);

  const unlockedAnimals = ANIMALS.filter(
    (a) => a.unlockLevel <= state.playerLevel
  );
  const nextUnlock = ANIMALS.find((a) => a.unlockLevel > state.playerLevel);

  const prestigeBonus = getPrestigeBonus(state.totalEarned);
  const canPrestige = prestigeBonus > 0;

  // ---- Load ----
  useEffect(() => {
    const load = async () => {
      let s: GameState | null = null;
      if (token) {
        try {
          const res = await fetch(`${API_URL}/api/idle-game/state`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.state) s = data.state;
          }
        } catch {}
      }
      if (!s) s = loadLocal();
      if (s) {
        // offline earnings
        const now = Date.now();
        const elapsed = (now - s.lastTick) / 1000;
        if (elapsed > 1) {
          const dps = Object.entries(s.animals).reduce((sum, [id, lvl]) => {
            const def = ANIMALS.find((a) => a.id === id);
            return def ? sum + getAnimalDps(def, lvl, s!.prestigeMultiplier) : sum;
          }, 0);
          const offlineCoins = Math.floor(dps * elapsed * 0.5);
          s.coins += offlineCoins;
          s.totalEarned += offlineCoins;
        }
        s.lastTick = now;
        setState(s);
      }
      setLoaded(true);
    };
    load();
  }, [token]);

  // ---- Game tick ----
  useEffect(() => {
    if (!loaded) return;
    const tick = setInterval(() => {
      setState((prev) => {
        const dps = Object.entries(prev.animals).reduce((sum, [id, lvl]) => {
          const def = ANIMALS.find((a) => a.id === id);
          return def ? sum + getAnimalDps(def, lvl, prev.prestigeMultiplier) : sum;
        }, 0);
        if (dps === 0) return prev;

        const dmg = dps * (TICK_MS / 1000);
        let newHp = prev.targetHp - dmg;
        let newCoins = prev.coins;
        let newTotal = prev.totalEarned;
        let newDestroyed = prev.targetsDestroyed;
        let newXp = prev.playerXp;
        let newLevel = prev.playerLevel;
        let newAnimals = prev.animals;

        // Target destroyed
        if (newHp <= 0) {
          const reward = getTargetReward(prev.targetsDestroyed);
          newCoins += reward;
          newTotal += reward;
          newDestroyed += 1;
          newXp += 1;

          // Level up check
          const xpReq = xpForLevel(newLevel);
          while (newXp >= xpReq) {
            newXp -= xpForLevel(newLevel);
            newLevel += 1;

            // Auto-unlock new animals at level-up
            const newUnlocks = ANIMALS.filter(
              (a) => a.unlockLevel === newLevel && !(a.id in prev.animals)
            );
            if (newUnlocks.length > 0) {
              newAnimals = { ...newAnimals };
              newUnlocks.forEach((a) => {
                newAnimals[a.id] = 1;
              });
            }
          }

          // Spawn new target
          const nextMaxHp = getTargetMaxHp(newDestroyed);
          return {
            ...prev,
            coins: newCoins,
            totalEarned: newTotal,
            targetHp: nextMaxHp,
            targetMaxHp: nextMaxHp,
            targetsDestroyed: newDestroyed,
            playerXp: newXp,
            playerLevel: newLevel,
            animals: newAnimals,
            lastTick: Date.now(),
          };
        }

        return {
          ...prev,
          targetHp: newHp,
          lastTick: Date.now(),
        };
      });
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [loaded]);

  // ---- Auto-save ----
  useEffect(() => {
    if (!loaded) return;
    const iv = setInterval(() => {
      saveLocal(ref.current);
      if (token) {
        fetch(`${API_URL}/api/idle-game/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ state: ref.current }),
        }).catch(() => {});
      }
    }, SAVE_INTERVAL);
    return () => clearInterval(iv);
  }, [loaded, token]);

  // Save locally on every change
  useEffect(() => {
    if (loaded) saveLocal(state);
  }, [state, loaded]);

  // ---- Actions ----
  const tapTarget = useCallback(() => {
    setState((prev) => {
      // Tap damage = 1 + 5% of total DPS
      const dps = Object.entries(prev.animals).reduce((sum, [id, lvl]) => {
        const def = ANIMALS.find((a) => a.id === id);
        return def ? sum + getAnimalDps(def, lvl, prev.prestigeMultiplier) : sum;
      }, 0);
      const tapDmg = Math.max(1, Math.floor(dps * 0.05) + 1);
      let newHp = prev.targetHp - tapDmg;
      let newCoins = prev.coins;
      let newTotal = prev.totalEarned;
      let newDestroyed = prev.targetsDestroyed;
      let newXp = prev.playerXp;
      let newLevel = prev.playerLevel;
      let newAnimals = prev.animals;

      if (newHp <= 0) {
        const reward = getTargetReward(prev.targetsDestroyed);
        newCoins += reward;
        newTotal += reward;
        newDestroyed += 1;
        newXp += 1;

        const xpReq = xpForLevel(newLevel);
        while (newXp >= xpReq) {
          newXp -= xpForLevel(newLevel);
          newLevel += 1;
          const newUnlocks = ANIMALS.filter(
            (a) => a.unlockLevel === newLevel && !(a.id in prev.animals)
          );
          if (newUnlocks.length > 0) {
            newAnimals = { ...newAnimals };
            newUnlocks.forEach((a) => {
              newAnimals[a.id] = 1;
            });
          }
        }

        const nextMaxHp = getTargetMaxHp(newDestroyed);
        return {
          ...prev,
          coins: newCoins,
          totalEarned: newTotal,
          targetHp: nextMaxHp,
          targetMaxHp: nextMaxHp,
          targetsDestroyed: newDestroyed,
          playerXp: newXp,
          playerLevel: newLevel,
          animals: newAnimals,
          lastTick: Date.now(),
        };
      }

      return { ...prev, targetHp: newHp, lastTick: Date.now() };
    });
  }, []);

  const upgradeAnimal = useCallback((animalId: string) => {
    setState((prev) => {
      const currentLvl = prev.animals[animalId];
      if (!currentLvl) return prev;
      const def = ANIMALS.find((a) => a.id === animalId);
      if (!def) return prev;
      const cost = getUpgradeCost(def, currentLvl);
      if (prev.coins < cost) return prev;
      return {
        ...prev,
        coins: prev.coins - cost,
        animals: { ...prev.animals, [animalId]: currentLvl + 1 },
      };
    });
  }, []);

  const prestige = useCallback(() => {
    setState((prev) => {
      const bonus = getPrestigeBonus(prev.totalEarned);
      if (bonus <= 0) return prev;
      const initMaxHp = getTargetMaxHp(0);
      return {
        ...DEFAULT_STATE,
        prestigeLevel: prev.prestigeLevel + 1,
        prestigeMultiplier: prev.prestigeMultiplier + bonus,
        targetHp: initMaxHp,
        targetMaxHp: initMaxHp,
        lastTick: Date.now(),
      };
    });
  }, []);

  return {
    state,
    loaded,
    totalDps,
    xpNeeded,
    unlockedAnimals,
    nextUnlock,
    prestigeBonus,
    canPrestige,
    tapTarget,
    upgradeAnimal,
    prestige,
  };
}
