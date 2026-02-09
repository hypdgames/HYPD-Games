"use client";

import { useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  TrendingUp,
  ArrowUp,
  Lock,
  Crosshair,
} from "lucide-react";
import {
  ANIMALS,
  formatNumber,
  getUpgradeCost,
  getAnimalDps,
  type AnimalDef,
} from "../data/animals";

// ──────── Projectile system for each lane ────────
interface Dot {
  id: number;
  y: number; // random vertical offset
}
let dotCounter = 0;

function useProjectiles(active: boolean) {
  const [dots, setDots] = useState<Dot[]>([]);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const id = ++dotCounter;
      setDots((p) => [...p.slice(-4), { id, y: 30 + Math.random() * 40 }]);
      setTimeout(() => setDots((p) => p.filter((d) => d.id !== id)), 500);
    }, 350);
    return () => clearInterval(iv);
  }, [active]);

  return dots;
}

// ──────── Single Animal Lane ────────
interface AnimalLaneProps {
  def: AnimalDef;
  level: number;
  coins: number;
  prestigeMultiplier: number;
  onUpgrade: () => void;
  onTapTarget: () => void;
}

const AnimalLane = memo(function AnimalLane({
  def,
  level,
  coins,
  prestigeMultiplier,
  onUpgrade,
  onTapTarget,
}: AnimalLaneProps) {
  const dps = getAnimalDps(def, level, prestigeMultiplier);
  const cost = getUpgradeCost(def, level);
  const canAfford = coins >= cost;
  const dots = useProjectiles(true);

  return (
    <div
      className="relative bg-card border border-border rounded-xl overflow-hidden"
      data-testid={`animal-lane-${def.id}`}
    >
      {/* Header: name + level + DPS */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{def.name}</span>
          <span className="text-xs text-lime font-bold">Lv.{level}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <TrendingUp className="w-3 h-3 text-lime" />
          {formatNumber(dps)}/s
        </div>
      </div>

      {/* Shooting scene */}
      <div
        className="relative h-20 mx-2 mb-1 rounded-lg bg-background/50 cursor-pointer overflow-hidden"
        onClick={onTapTarget}
      >
        {/* Animal (left side) */}
        <motion.div
          animate={{ x: [0, 2, 0] }}
          transition={{ repeat: Infinity, duration: 0.25, ease: "easeInOut" }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center overflow-hidden z-10"
        >
          {def.imageUrl ? (
            <img
              src={def.imageUrl}
              alt={def.name}
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : (
            <span className="text-3xl">{def.emoji}</span>
          )}
        </motion.div>

        {/* Projectile dots flying right */}
        {dots.map((d) => (
          <motion.div
            key={d.id}
            initial={{ left: "18%", top: `${d.y}%`, opacity: 1 }}
            animate={{ left: "78%", opacity: 0.2 }}
            transition={{ duration: 0.45, ease: "linear" }}
            className="absolute w-1.5 h-1.5 rounded-full bg-lime shadow-[0_0_4px_rgba(163,230,53,0.8)]"
          />
        ))}

        {/* Target (right side) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="w-12 h-12 rounded-full border-2 border-red-500/50 bg-red-500/5 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border border-red-400/40 bg-red-500/10 flex items-center justify-center">
              <Crosshair className="w-3.5 h-3.5 text-red-400/50" />
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade bar */}
      <div className="px-3 pb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpgrade();
          }}
          disabled={!canAfford}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            canAfford
              ? "bg-lime text-black hover:brightness-110 active:scale-[0.98]"
              : "bg-muted text-muted-foreground"
          }`}
          data-testid={`upgrade-${def.id}`}
        >
          <ArrowUp className="w-3 h-3" />
          Level Up
          <span className="flex items-center gap-0.5 opacity-80">
            <Coins className="w-3 h-3" />
            {formatNumber(cost)}
          </span>
        </button>
      </div>
    </div>
  );
});

// ──────── Locked Animal Lane ────────
interface LockedLaneProps {
  def: AnimalDef;
}

const LockedLane = memo(function LockedLane({ def }: LockedLaneProps) {
  return (
    <div
      className="relative bg-card/40 border border-border/30 rounded-xl overflow-hidden opacity-50"
      data-testid={`animal-lane-locked-${def.id}`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <span className="text-sm font-bold text-muted-foreground">{def.name}</span>
          <p className="text-[10px] text-muted-foreground">
            Unlocks at Level {def.unlockLevel}
          </p>
        </div>
      </div>
    </div>
  );
});

// ──────── Exported Lane List ────────
interface AnimalLaneListProps {
  animals: Record<string, number>;
  playerLevel: number;
  coins: number;
  prestigeMultiplier: number;
  onUpgrade: (id: string) => void;
  onTapTarget: () => void;
}

export function AnimalLaneList({
  animals,
  playerLevel,
  coins,
  prestigeMultiplier,
  onUpgrade,
  onTapTarget,
}: AnimalLaneListProps) {
  const unlocked = ANIMALS.filter((a) => a.id in animals);
  const locked = ANIMALS.filter(
    (a) => !(a.id in animals) && a.unlockLevel <= playerLevel + 30
  ).slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto px-3 space-y-2.5 pb-2" data-testid="animal-lane-list">
      {unlocked.map((def) => (
        <AnimalLane
          key={def.id}
          def={def}
          level={animals[def.id]}
          coins={coins}
          prestigeMultiplier={prestigeMultiplier}
          onUpgrade={() => onUpgrade(def.id)}
          onTapTarget={onTapTarget}
        />
      ))}
      {locked.map((def) => (
        <LockedLane key={def.id} def={def} />
      ))}
    </div>
  );
}
