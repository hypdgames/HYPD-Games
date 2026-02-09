export interface Animal {
  id: string;
  name: string;
  tier: number;
  emoji: string;
  color: string;
  bgColor: string;
  baseCps: number;
}

// 50 animals ordered by tier, matching the user's character sheet
export const ANIMALS: Animal[] = [
  { id: "bunny", name: "Bunny", tier: 1, emoji: "🐰", color: "#fff", bgColor: "#f8c8dc", baseCps: 1 },
  { id: "kitty", name: "Kitty", tier: 2, emoji: "🐱", color: "#fff", bgColor: "#c4a882", baseCps: 2 },
  { id: "pigy", name: "Pigy", tier: 3, emoji: "🐷", color: "#fff", bgColor: "#f4a0a0", baseCps: 5 },
  { id: "s-whaly", name: "S-Whaly", tier: 4, emoji: "🐳", color: "#fff", bgColor: "#7ec8e3", baseCps: 12 },
  { id: "yety", name: "Yety", tier: 5, emoji: "🦣", color: "#333", bgColor: "#e8e8e8", baseCps: 28 },
  { id: "horsy", name: "Horsy", tier: 6, emoji: "🐴", color: "#fff", bgColor: "#b07d4f", baseCps: 65 },
  { id: "bully", name: "Bully", tier: 7, emoji: "🐂", color: "#fff", bgColor: "#4a3578", baseCps: 150 },
  { id: "goaty", name: "Goaty", tier: 8, emoji: "🐐", color: "#fff", bgColor: "#a08060", baseCps: 340 },
  { id: "wormy", name: "Wormy", tier: 9, emoji: "🪱", color: "#fff", bgColor: "#d4956a", baseCps: 780 },
  { id: "monkey", name: "Monkey", tier: 10, emoji: "🐒", color: "#fff", bgColor: "#8b6914", baseCps: 1800 },
  { id: "birdy", name: "Birdy", tier: 11, emoji: "🐦", color: "#fff", bgColor: "#5ca0d3", baseCps: 4100 },
  { id: "hedgy", name: "Hedgy", tier: 12, emoji: "🦔", color: "#fff", bgColor: "#8b7355", baseCps: 9500 },
  { id: "dogy", name: "Dogy", tier: 13, emoji: "🐶", color: "#fff", bgColor: "#c49a6c", baseCps: 22000 },
  { id: "crocky", name: "Crocky", tier: 14, emoji: "🐊", color: "#fff", bgColor: "#5a7a3a", baseCps: 50000 },
  { id: "mousy", name: "Mousy", tier: 15, emoji: "🐭", color: "#fff", bgColor: "#9e8e7e", baseCps: 115000 },
  { id: "sheepy", name: "Sheepy", tier: 16, emoji: "🐑", color: "#333", bgColor: "#f0f0f0", baseCps: 265000 },
  { id: "racoony", name: "Racoony", tier: 17, emoji: "🦝", color: "#fff", bgColor: "#7a7a7a", baseCps: 610000 },
  { id: "snaily", name: "Snaily", tier: 18, emoji: "🐌", color: "#fff", bgColor: "#9b59b6", baseCps: 1400000 },
  { id: "ducky", name: "Ducky", tier: 19, emoji: "🦆", color: "#333", bgColor: "#f1c40f", baseCps: 3200000 },
  { id: "batty", name: "Batty", tier: 20, emoji: "🦇", color: "#fff", bgColor: "#4a3020", baseCps: 7400000 },
  { id: "teddy", name: "Teddy", tier: 21, emoji: "🧸", color: "#fff", bgColor: "#8b5e3c", baseCps: 17000000 },
  { id: "chicky", name: "Chicky", tier: 22, emoji: "🐔", color: "#fff", bgColor: "#f5deb3", baseCps: 39000000 },
  { id: "blowfishy", name: "Blowfishy", tier: 23, emoji: "🐡", color: "#fff", bgColor: "#e67e22", baseCps: 90000000 },
  { id: "turtly", name: "Turtly", tier: 24, emoji: "🐢", color: "#fff", bgColor: "#27ae60", baseCps: 207000000 },
  { id: "bearverly", name: "Bearverly", tier: 25, emoji: "🦫", color: "#fff", bgColor: "#6b4226", baseCps: 476000000 },
  { id: "foxy", name: "Foxy", tier: 26, emoji: "🦊", color: "#fff", bgColor: "#d35400", baseCps: 1100000000 },
  { id: "mountain-liony", name: "Mountain Liony", tier: 27, emoji: "🦁", color: "#fff", bgColor: "#a0522d", baseCps: 2500000000 },
  { id: "zebry", name: "Zebry", tier: 28, emoji: "🦓", color: "#fff", bgColor: "#2c3e50", baseCps: 5800000000 },
  { id: "giraffy", name: "Giraffy", tier: 29, emoji: "🦒", color: "#333", bgColor: "#f39c12", baseCps: 13000000000 },
  { id: "beey", name: "Beey", tier: 30, emoji: "🐝", color: "#333", bgColor: "#f5c542", baseCps: 30000000000 },
  { id: "skunky", name: "Skunky", tier: 31, emoji: "🦨", color: "#fff", bgColor: "#1a1a2e", baseCps: 70000000000 },
  { id: "cowy", name: "Cowy", tier: 32, emoji: "🐮", color: "#333", bgColor: "#f0e6d3", baseCps: 160000000000 },
  { id: "lizardy", name: "Lizardy", tier: 33, emoji: "🦎", color: "#fff", bgColor: "#2ecc71", baseCps: 370000000000 },
  { id: "tucany", name: "Tucany", tier: 34, emoji: "🐦‍⬛", color: "#fff", bgColor: "#1a1a1a", baseCps: 850000000000 },
  { id: "reindeery", name: "Reindeery", tier: 35, emoji: "🦌", color: "#fff", bgColor: "#8b6c5c", baseCps: 1950000000000 },
  { id: "squirrely", name: "Squirrely", tier: 36, emoji: "🐿️", color: "#fff", bgColor: "#d2691e", baseCps: 4500000000000 },
  { id: "pingy", name: "Pingy", tier: 37, emoji: "🐧", color: "#fff", bgColor: "#2c3e50", baseCps: 10000000000000 },
  { id: "snaky", name: "Snaky", tier: 38, emoji: "🐍", color: "#fff", bgColor: "#6b8e23", baseCps: 23000000000000 },
  { id: "bugy", name: "Bugy", tier: 39, emoji: "🐞", color: "#fff", bgColor: "#c0392b", baseCps: 53000000000000 },
  { id: "wolfy", name: "Wolfy", tier: 40, emoji: "🐺", color: "#fff", bgColor: "#5d6d7e", baseCps: 122000000000000 },
  { id: "hippy", name: "Hippy", tier: 41, emoji: "🦛", color: "#fff", bgColor: "#7f8c8d", baseCps: 280000000000000 },
  { id: "tigy", name: "Tigy", tier: 42, emoji: "🐯", color: "#333", bgColor: "#f5a623", baseCps: 645000000000000 },
  { id: "pandy", name: "Pandy", tier: 43, emoji: "🐼", color: "#333", bgColor: "#ecf0f1", baseCps: 1480000000000000 },
  { id: "squidy", name: "Squidy", tier: 44, emoji: "🦑", color: "#fff", bgColor: "#e74c3c", baseCps: 3400000000000000 },
  { id: "parroty", name: "Parroty", tier: 45, emoji: "🦜", color: "#fff", bgColor: "#27ae60", baseCps: 7800000000000000 },
  { id: "k-whally", name: "K-Whally", tier: 46, emoji: "🐋", color: "#fff", bgColor: "#1a252f", baseCps: 18000000000000000 },
  { id: "rhiny", name: "Rhiny", tier: 47, emoji: "🦏", color: "#fff", bgColor: "#95a5a6", baseCps: 41000000000000000 },
  { id: "liony", name: "Liony", tier: 48, emoji: "🦁", color: "#333", bgColor: "#daa520", baseCps: 95000000000000000 },
  { id: "t-rexy", name: "T-Rexy", tier: 49, emoji: "🦖", color: "#fff", bgColor: "#3d5c3a", baseCps: 218000000000000000 },
  { id: "koaly", name: "Koaly", tier: 50, emoji: "🐨", color: "#fff", bgColor: "#16a085", baseCps: 500000000000000000 },
];

export function getAnimalByTier(tier: number): Animal | undefined {
  return ANIMALS.find((a) => a.tier === tier);
}

export function getAnimalById(id: string): Animal | undefined {
  return ANIMALS.find((a) => a.id === id);
}

// Format large numbers with suffixes
export function formatNumber(num: number): string {
  if (num < 1000) return Math.floor(num).toString();
  const suffixes = [
    "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc",
    "No", "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc",
  ];
  const tier = Math.floor(Math.log10(Math.abs(num)) / 3);
  if (tier >= suffixes.length) return num.toExponential(2);
  const suffix = suffixes[tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = num / scale;
  return scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0) + suffix;
}

// Calculate buy cost for next animal
export function getBuyCost(totalPurchased: number, prestigeLevel: number): number {
  const baseCost = 10;
  const costMultiplier = Math.pow(1.12, totalPurchased);
  const prestigeDiscount = Math.max(0.5, 1 - prestigeLevel * 0.02);
  return Math.floor(baseCost * costMultiplier * prestigeDiscount);
}

// Calculate total CPS from grid
export function calculateTotalCps(
  grid: (number | null)[],
  prestigeMultiplier: number,
  cpsUpgradeLevel: number
): number {
  let total = 0;
  for (const tier of grid) {
    if (tier !== null) {
      const animal = getAnimalByTier(tier);
      if (animal) total += animal.baseCps;
    }
  }
  const upgradeMultiplier = 1 + cpsUpgradeLevel * 0.25;
  return total * prestigeMultiplier * upgradeMultiplier;
}

// Calculate prestige multiplier bonus from total earned
export function getPrestigeBonus(totalEarned: number): number {
  if (totalEarned < 100000) return 0;
  return Math.floor(Math.sqrt(totalEarned / 100000) * 10) / 10;
}

// Get CPS upgrade cost
export function getCpsUpgradeCost(level: number): number {
  return Math.floor(500 * Math.pow(2.5, level));
}

export const GRID_SIZE = 20; // 4 columns x 5 rows
export const GRID_COLS = 4;
export const GRID_ROWS = 5;
