"use client";

import { motion } from "framer-motion";
import { Lock, TrendingUp, Coins, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ANIMALS,
  formatNumber,
  getUpgradeCost,
  getAnimalDps,
  type AnimalDef,
} from "../data/animals";

interface AnimalRosterProps {
  animals: Record<string, number>; // id -> level
  playerLevel: number;
  coins: number;
  prestigeMultiplier: number;
  onUpgrade: (animalId: string) => void;
}

function AnimalRow({
  def,
  level,
  coins,
  prestigeMultiplier,
  locked,
  onUpgrade,
}: {
  def: AnimalDef;
  level: number;
  coins: number;
  prestigeMultiplier: number;
  locked: boolean;
  onUpgrade: () => void;
}) {
  const dps = level > 0 ? getAnimalDps(def, level, prestigeMultiplier) : 0;
  const cost = level > 0 ? getUpgradeCost(def, level) : def.baseCost;
  const canAfford = coins >= cost;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
        locked
          ? "bg-muted/20 border-border/30 opacity-50"
          : "bg-card border-border hover:border-lime/30"
      }`}
      data-testid={`animal-row-${def.id}`}
    >
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ backgroundColor: locked ? "#333" : "transparent" }}
      >
        {locked ? (
          <Lock className="w-4 h-4 text-muted-foreground" />
        ) : def.imageUrl ? (
          <img src={def.imageUrl} alt={def.name} className="w-full h-full object-contain" draggable={false} />
        ) : (
          <span className="text-2xl">{def.emoji}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground truncate">{def.name}</span>
          {!locked && (
            <span className="text-[10px] text-lime font-bold">Lv.{level}</span>
          )}
        </div>
        {locked ? (
          <span className="text-[10px] text-muted-foreground">
            Unlocks at Lv.{def.unlockLevel}
          </span>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>{formatNumber(dps)}/s</span>
          </div>
        )}
      </div>

      {/* Upgrade button */}
      {!locked && (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onUpgrade();
          }}
          disabled={!canAfford}
          className={`h-8 px-2.5 text-xs gap-1 ${
            canAfford
              ? "bg-lime text-black hover:bg-lime/90"
              : "bg-muted text-muted-foreground"
          }`}
          data-testid={`upgrade-${def.id}`}
        >
          <ArrowUp className="w-3 h-3" />
          <Coins className="w-3 h-3" />
          {formatNumber(cost)}
        </Button>
      )}
    </div>
  );
}

export function AnimalRoster({
  animals,
  playerLevel,
  coins,
  prestigeMultiplier,
  onUpgrade,
}: AnimalRosterProps) {
  // Show unlocked + next 3 locked animals
  const unlocked = ANIMALS.filter((a) => a.id in animals);
  const locked = ANIMALS.filter(
    (a) => !(a.id in animals) && a.unlockLevel <= playerLevel + 30
  ).slice(0, 3);
  const visible = [...unlocked, ...locked];

  return (
    <div
      className="flex-1 overflow-y-auto px-3 space-y-1.5 pb-2"
      data-testid="animal-roster"
    >
      {visible.map((def, i) => {
        const isLocked = !(def.id in animals);
        const level = animals[def.id] || 0;
        return (
          <motion.div
            key={def.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <AnimalRow
              def={def}
              level={level}
              coins={coins}
              prestigeMultiplier={prestigeMultiplier}
              locked={isLocked}
              onUpgrade={() => onUpgrade(def.id)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
