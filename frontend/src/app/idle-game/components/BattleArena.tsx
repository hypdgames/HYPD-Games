"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair } from "lucide-react";
import { formatNumber, getTargetReward } from "../data/animals";

interface BattleArenaProps {
  targetHp: number;
  targetMaxHp: number;
  targetsDestroyed: number;
  totalDps: number;
  onTap: () => void;
  activeAnimalEmoji: string;
  activeAnimalImage?: string;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
}

let floatId = 0;

export function BattleArena({
  targetHp,
  targetMaxHp,
  targetsDestroyed,
  totalDps,
  onTap,
  activeAnimalEmoji,
  activeAnimalImage,
}: BattleArenaProps) {
  const arenaRef = useRef<HTMLDivElement>(null);
  const [floats, setFloats] = useState<FloatingText[]>([]);
  const hpPct = Math.max(0, (targetHp / targetMaxHp) * 100);
  const reward = getTargetReward(targetsDestroyed);

  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      onTap();

      // Create floating damage text
      const rect = arenaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX =
        "touches" in e ? e.touches[0]?.clientX ?? rect.left + rect.width / 2 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? rect.top + rect.height / 2 : e.clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const tapDmg = Math.max(1, Math.floor(totalDps * 0.05) + 1);
      const id = ++floatId;
      setFloats((prev) => [...prev.slice(-5), { id, x, y, text: `-${formatNumber(tapDmg)}` }]);
      setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 800);
    },
    [onTap, totalDps]
  );

  // Projectile animation dots
  const [dots, setDots] = useState<number[]>([]);
  useEffect(() => {
    if (totalDps <= 0) return;
    const rate = Math.min(200, Math.max(50, 1000 / Math.log2(totalDps + 2)));
    const iv = setInterval(() => {
      const id = Date.now();
      setDots((p) => [...p.slice(-8), id]);
      setTimeout(() => setDots((p) => p.filter((d) => d !== id)), 600);
    }, rate);
    return () => clearInterval(iv);
  }, [totalDps]);

  return (
    <div
      ref={arenaRef}
      onClick={handleTap}
      className="relative bg-gradient-to-b from-card/80 to-card border border-border rounded-2xl mx-3 overflow-hidden cursor-pointer select-none"
      style={{ height: "240px" }}
      data-testid="battle-arena"
    >
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Active animal (left side) */}
      <div className="absolute left-4 bottom-8 z-10">
        <motion.div
          animate={{ x: [0, 3, 0] }}
          transition={{ repeat: Infinity, duration: 0.3, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden"
        >
          {activeAnimalImage ? (
            <img src={activeAnimalImage} alt="" className="w-full h-full object-contain" draggable={false} />
          ) : (
            <span className="text-4xl">{activeAnimalEmoji}</span>
          )}
        </motion.div>
      </div>

      {/* Projectile dots */}
      <AnimatePresence>
        {dots.map((d) => (
          <motion.div
            key={d}
            initial={{ left: "20%", top: "55%", opacity: 1, scale: 1 }}
            animate={{ left: "70%", top: `${45 + Math.random() * 20}%`, opacity: 0.3, scale: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "linear" }}
            className="absolute w-2 h-2 rounded-full bg-lime shadow-[0_0_6px_rgba(163,230,53,0.8)]"
          />
        ))}
      </AnimatePresence>

      {/* Target (right side) */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10">
        <motion.div
          key={targetsDestroyed}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          {/* Target circles */}
          <motion.div
            animate={hpPct < 30 ? { x: [-2, 2, -2, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.15 }}
            className="w-20 h-20 rounded-full border-4 border-red-500/60 bg-red-500/10 flex items-center justify-center"
          >
            <div className="w-14 h-14 rounded-full border-2 border-red-400/50 bg-red-500/10 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-red-400/40 bg-red-500/15 flex items-center justify-center">
                <Crosshair className="w-4 h-4 text-red-400/60" />
              </div>
            </div>
          </motion.div>
          {/* Reward label */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-amber-400 font-bold whitespace-nowrap">
            +{formatNumber(reward)}
          </div>
        </motion.div>
      </div>

      {/* HP Bar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-2">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Target #{targetsDestroyed + 1}</span>
          <span>{formatNumber(targetHp)} / {formatNumber(targetMaxHp)}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${hpPct}%`,
              background:
                hpPct > 50
                  ? "linear-gradient(90deg, #22c55e, #4ade80)"
                  : hpPct > 25
                    ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                    : "linear-gradient(90deg, #ef4444, #f87171)",
            }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Floating damage text */}
      <AnimatePresence>
        {floats.map((f) => (
          <motion.div
            key={f.id}
            initial={{ x: f.x, y: f.y, opacity: 1, scale: 1 }}
            animate={{ y: f.y - 50, opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute text-red-400 font-heading text-lg pointer-events-none z-20"
          >
            {f.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Tap hint */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50">
        TAP TO ATTACK
      </div>
    </div>
  );
}
