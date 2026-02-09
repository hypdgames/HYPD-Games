"use client";

import { motion } from "framer-motion";
import { getAnimalByTier, GRID_COLS, GRID_ROWS } from "../data/animals";

interface GameGridProps {
  grid: (number | null)[];
  selectedSlot: number | null;
  onSlotClick: (index: number) => void;
}

function AnimalSlot({
  tier,
  index,
  isSelected,
  onClick,
}: {
  tier: number | null;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const animal = tier !== null ? getAnimalByTier(tier) : null;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={`
        relative aspect-square rounded-xl border-2 transition-all duration-150
        flex flex-col items-center justify-center gap-0.5 overflow-hidden
        ${
          isSelected
            ? "border-lime shadow-[0_0_12px_rgba(163,230,53,0.5)] scale-105 z-10"
            : animal
              ? "border-border/60 hover:border-foreground/30"
              : "border-dashed border-border/30"
        }
        ${animal ? "bg-card" : "bg-card/30"}
      `}
      data-testid={`grid-slot-${index}`}
    >
      {animal ? (
        <>
          {/* Animal display */}
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: animal.imageUrl ? "transparent" : animal.bgColor }}
          >
            {animal.imageUrl ? (
              <img
                src={animal.imageUrl}
                alt={animal.name}
                className="w-full h-full object-contain"
                draggable={false}
              />
            ) : (
              <span className="text-2xl sm:text-3xl">{animal.emoji}</span>
            )}
          </div>
          {/* Tier badge */}
          <span className="text-[9px] font-bold text-muted-foreground leading-none">
            {animal.name}
          </span>
          {/* Tier number */}
          <div className="absolute top-0.5 right-1 text-[8px] font-bold text-lime/70">
            T{animal.tier}
          </div>
        </>
      ) : (
        <div className="text-muted-foreground/20 text-2xl">+</div>
      )}

      {/* Selection glow */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-lime pointer-events-none"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      )}
    </motion.button>
  );
}

export function GameGrid({ grid, selectedSlot, onSlotClick }: GameGridProps) {
  return (
    <div
      className="px-3 py-2"
      data-testid="idle-game-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
        gap: "6px",
      }}
    >
      {grid.map((tier, index) => (
        <AnimalSlot
          key={index}
          tier={tier}
          index={index}
          isSelected={selectedSlot === index}
          onClick={() => onSlotClick(index)}
        />
      ))}
    </div>
  );
}
