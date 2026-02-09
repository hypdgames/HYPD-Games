export interface AnimalDef {
  id: string;
  name: string;
  tier: number;
  emoji: string;
  color: string;
  bgColor: string;
  baseDps: number; // damage per second at level 1
  unlockLevel: number; // player level needed to unlock
  baseCost: number; // cost to buy/unlock initially
  imageUrl?: string;
}

// 50 animals - unlocked progressively as the player levels up
export const ANIMALS: AnimalDef[] = [
  { id: "bunny", name: "Bunny", tier: 1, emoji: "🐰", color: "#fff", bgColor: "#f8c8dc", baseDps: 1, unlockLevel: 1, baseCost: 0, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/e7fb8ff47e547c9385320067259ca33f74142ea98d7d24952c14220e61c53422.png" },
  { id: "kitty", name: "Kitty", tier: 2, emoji: "🐱", color: "#fff", bgColor: "#c4a882", baseDps: 3, unlockLevel: 3, baseCost: 50, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/5b2e07859d1fbc3388b2806738ec4d7763fbb0091dad38f3c753a70ef6d60229.png" },
  { id: "pigy", name: "Pigy", tier: 3, emoji: "🐷", color: "#fff", bgColor: "#f4a0a0", baseDps: 8, unlockLevel: 5, baseCost: 200, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/13507cd567a1b2855226cb756aaf468b35f89d76b002b089a90b1e6c3541c477.png" },
  { id: "s-whaly", name: "S-Whaly", tier: 4, emoji: "🐳", color: "#fff", bgColor: "#7ec8e3", baseDps: 20, unlockLevel: 8, baseCost: 800, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/05de2e55ef79e0dab94142e86b2f2aa02d9ebcce190219104034fcf515852116.png" },
  { id: "yety", name: "Yety", tier: 5, emoji: "🦣", color: "#333", bgColor: "#e8e8e8", baseDps: 50, unlockLevel: 12, baseCost: 3000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/b815c81825a1845f3b667352f2886423bc8e46628e66b753aa6a4031643102a3.png" },
  { id: "horsy", name: "Horsy", tier: 6, emoji: "🐴", color: "#fff", bgColor: "#b07d4f", baseDps: 120, unlockLevel: 16, baseCost: 10000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/459caf246e443029a0dcb7d7dd680f564cf10971ef1fa04a9dd136d82804495b.png" },
  { id: "bully", name: "Bully", tier: 7, emoji: "🐂", color: "#fff", bgColor: "#4a3578", baseDps: 280, unlockLevel: 20, baseCost: 35000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/3597cf664a19245e71d8d3cf69a8c2a55a5ca928cb03ebf35faf55d5121ee7fb.png" },
  { id: "goaty", name: "Goaty", tier: 8, emoji: "🐐", color: "#fff", bgColor: "#a08060", baseDps: 650, unlockLevel: 25, baseCost: 120000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/1e88d27a1298282fa5184ea8d9befde5ca28aaa9724c1db61a4ca9da0b94ca7f.png" },
  { id: "wormy", name: "Wormy", tier: 9, emoji: "🪱", color: "#fff", bgColor: "#d4956a", baseDps: 1500, unlockLevel: 30, baseCost: 400000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/7ab31b090124098ced0566389746f786212b033d8d18b9af0ef90496f4832381.png" },
  { id: "monkey", name: "Monkey", tier: 10, emoji: "🐒", color: "#fff", bgColor: "#8b6914", baseDps: 3500, unlockLevel: 36, baseCost: 1500000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/627c9960518b99f3faefa5a371e184cad31748f17ac1b63fcb0c4bcdc9c97850.png" },
  { id: "birdy", name: "Birdy", tier: 11, emoji: "🐦", color: "#fff", bgColor: "#5ca0d3", baseDps: 8000, unlockLevel: 42, baseCost: 5000000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/7a49725b043c6c3e0c5bd7264d8b41388b77390ea5ed525ccd9c9f7b9340a580.png" },
  { id: "hedgy", name: "Hedgy", tier: 12, emoji: "🦔", color: "#fff", bgColor: "#8b7355", baseDps: 18000, unlockLevel: 48, baseCost: 20000000, imageUrl: "https://static.prod-images.emergentagent.com/jobs/66d25550-ce37-4ffd-872b-92b9e5eee482/images/86ee43aeefef520c79cf299ff0e3cb36e7c99df17e1af91f27172665acd5812b.png" },
  { id: "dogy", name: "Dogy", tier: 13, emoji: "🐶", color: "#fff", bgColor: "#c49a6c", baseDps: 42000, unlockLevel: 55, baseCost: 75000000 },
  { id: "crocky", name: "Crocky", tier: 14, emoji: "🐊", color: "#fff", bgColor: "#5a7a3a", baseDps: 100000, unlockLevel: 62, baseCost: 300000000 },
  { id: "mousy", name: "Mousy", tier: 15, emoji: "🐭", color: "#fff", bgColor: "#9e8e7e", baseDps: 230000, unlockLevel: 70, baseCost: 1200000000 },
  { id: "sheepy", name: "Sheepy", tier: 16, emoji: "🐑", color: "#333", bgColor: "#f0f0f0", baseDps: 530000, unlockLevel: 78, baseCost: 5000000000 },
  { id: "racoony", name: "Racoony", tier: 17, emoji: "🦝", color: "#fff", bgColor: "#7a7a7a", baseDps: 1200000, unlockLevel: 86, baseCost: 20000000000 },
  { id: "snaily", name: "Snaily", tier: 18, emoji: "🐌", color: "#fff", bgColor: "#9b59b6", baseDps: 2800000, unlockLevel: 95, baseCost: 80000000000 },
  { id: "ducky", name: "Ducky", tier: 19, emoji: "🦆", color: "#333", bgColor: "#f1c40f", baseDps: 6500000, unlockLevel: 105, baseCost: 350000000000 },
  { id: "batty", name: "Batty", tier: 20, emoji: "🦇", color: "#fff", bgColor: "#4a3020", baseDps: 15000000, unlockLevel: 115, baseCost: 1500000000000 },
  { id: "teddy", name: "Teddy", tier: 21, emoji: "🧸", color: "#fff", bgColor: "#8b5e3c", baseDps: 35000000, unlockLevel: 126, baseCost: 6000000000000 },
  { id: "chicky", name: "Chicky", tier: 22, emoji: "🐔", color: "#fff", bgColor: "#f5deb3", baseDps: 80000000, unlockLevel: 138, baseCost: 25000000000000 },
  { id: "blowfishy", name: "Blowfishy", tier: 23, emoji: "🐡", color: "#fff", bgColor: "#e67e22", baseDps: 185000000, unlockLevel: 150, baseCost: 100000000000000 },
  { id: "turtly", name: "Turtly", tier: 24, emoji: "🐢", color: "#fff", bgColor: "#27ae60", baseDps: 425000000, unlockLevel: 163, baseCost: 450000000000000 },
  { id: "bearverly", name: "Bearverly", tier: 25, emoji: "🦫", color: "#fff", bgColor: "#6b4226", baseDps: 980000000, unlockLevel: 177, baseCost: 2000000000000000 },
  { id: "foxy", name: "Foxy", tier: 26, emoji: "🦊", color: "#fff", bgColor: "#d35400", baseDps: 2250000000, unlockLevel: 191, baseCost: 8500000000000000 },
  { id: "mountain-liony", name: "Mt. Liony", tier: 27, emoji: "🦁", color: "#fff", bgColor: "#a0522d", baseDps: 5200000000, unlockLevel: 206, baseCost: 37000000000000000 },
  { id: "zebry", name: "Zebry", tier: 28, emoji: "🦓", color: "#fff", bgColor: "#2c3e50", baseDps: 12000000000, unlockLevel: 222, baseCost: 160000000000000000 },
  { id: "giraffy", name: "Giraffy", tier: 29, emoji: "🦒", color: "#333", bgColor: "#f39c12", baseDps: 27000000000, unlockLevel: 238, baseCost: 700000000000000000 },
  { id: "beey", name: "Beey", tier: 30, emoji: "🐝", color: "#333", bgColor: "#f5c542", baseDps: 63000000000, unlockLevel: 255, baseCost: 3e18 },
  { id: "skunky", name: "Skunky", tier: 31, emoji: "🦨", color: "#fff", bgColor: "#1a1a2e", baseDps: 145000000000, unlockLevel: 272, baseCost: 1.3e19 },
  { id: "cowy", name: "Cowy", tier: 32, emoji: "🐮", color: "#333", bgColor: "#f0e6d3", baseDps: 333000000000, unlockLevel: 290, baseCost: 5.5e19 },
  { id: "lizardy", name: "Lizardy", tier: 33, emoji: "🦎", color: "#fff", bgColor: "#2ecc71", baseDps: 770000000000, unlockLevel: 308, baseCost: 2.4e20 },
  { id: "tucany", name: "Tucany", tier: 34, emoji: "🐦‍⬛", color: "#fff", bgColor: "#1a1a1a", baseDps: 1.8e12, unlockLevel: 327, baseCost: 1e21 },
  { id: "reindeery", name: "Reindeery", tier: 35, emoji: "🦌", color: "#fff", bgColor: "#8b6c5c", baseDps: 4.1e12, unlockLevel: 346, baseCost: 4.3e21 },
  { id: "squirrely", name: "Squirrely", tier: 36, emoji: "🐿️", color: "#fff", bgColor: "#d2691e", baseDps: 9.5e12, unlockLevel: 366, baseCost: 1.9e22 },
  { id: "pingy", name: "Pingy", tier: 37, emoji: "🐧", color: "#fff", bgColor: "#2c3e50", baseDps: 2.2e13, unlockLevel: 386, baseCost: 8.1e22 },
  { id: "snaky", name: "Snaky", tier: 38, emoji: "🐍", color: "#fff", bgColor: "#6b8e23", baseDps: 5e13, unlockLevel: 407, baseCost: 3.5e23 },
  { id: "bugy", name: "Bugy", tier: 39, emoji: "🐞", color: "#fff", bgColor: "#c0392b", baseDps: 1.2e14, unlockLevel: 428, baseCost: 1.5e24 },
  { id: "wolfy", name: "Wolfy", tier: 40, emoji: "🐺", color: "#fff", bgColor: "#5d6d7e", baseDps: 2.7e14, unlockLevel: 450, baseCost: 6.5e24 },
  { id: "hippy", name: "Hippy", tier: 41, emoji: "🦛", color: "#fff", bgColor: "#7f8c8d", baseDps: 6.2e14, unlockLevel: 472, baseCost: 2.8e25 },
  { id: "tigy", name: "Tigy", tier: 42, emoji: "🐯", color: "#333", bgColor: "#f5a623", baseDps: 1.4e15, unlockLevel: 495, baseCost: 1.2e26 },
  { id: "pandy", name: "Pandy", tier: 43, emoji: "🐼", color: "#333", bgColor: "#ecf0f1", baseDps: 3.3e15, unlockLevel: 518, baseCost: 5.2e26 },
  { id: "squidy", name: "Squidy", tier: 44, emoji: "🦑", color: "#fff", bgColor: "#e74c3c", baseDps: 7.5e15, unlockLevel: 542, baseCost: 2.3e27 },
  { id: "parroty", name: "Parroty", tier: 45, emoji: "🦜", color: "#fff", bgColor: "#27ae60", baseDps: 1.7e16, unlockLevel: 566, baseCost: 9.8e27 },
  { id: "k-whally", name: "K-Whally", tier: 46, emoji: "🐋", color: "#fff", bgColor: "#1a252f", baseDps: 4e16, unlockLevel: 591, baseCost: 4.2e28 },
  { id: "rhiny", name: "Rhiny", tier: 47, emoji: "🦏", color: "#fff", bgColor: "#95a5a6", baseDps: 9.2e16, unlockLevel: 616, baseCost: 1.8e29 },
  { id: "liony", name: "Liony", tier: 48, emoji: "🦁", color: "#333", bgColor: "#daa520", baseDps: 2.1e17, unlockLevel: 642, baseCost: 7.8e29 },
  { id: "t-rexy", name: "T-Rexy", tier: 49, emoji: "🦖", color: "#fff", bgColor: "#3d5c3a", baseDps: 4.8e17, unlockLevel: 668, baseCost: 3.4e30 },
  { id: "koaly", name: "Koaly", tier: 50, emoji: "🐨", color: "#fff", bgColor: "#16a085", baseDps: 1.1e18, unlockLevel: 695, baseCost: 1.5e31 },
];

export function getAnimalById(id: string): AnimalDef | undefined {
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

// Get upgrade cost for an animal at a given level
export function getUpgradeCost(animal: AnimalDef, currentLevel: number): number {
  return Math.floor(animal.baseCost * Math.pow(1.08, currentLevel) * (1 + currentLevel * 0.5));
}

// Get DPS for an animal at a given level
export function getAnimalDps(animal: AnimalDef, level: number, prestigeMultiplier: number): number {
  return animal.baseDps * level * prestigeMultiplier;
}

// XP needed to reach next player level
export function xpForLevel(level: number): number {
  return Math.floor(10 * Math.pow(1.15, level - 1));
}

// Target HP scaling
export function getTargetMaxHp(targetsDestroyed: number): number {
  return Math.floor(10 * Math.pow(1.12, targetsDestroyed));
}

// Coins earned from destroying a target
export function getTargetReward(targetsDestroyed: number): number {
  return Math.max(1, Math.floor(getTargetMaxHp(targetsDestroyed) * 0.15));
}

// Prestige multiplier bonus from total earned
export function getPrestigeBonus(totalEarned: number): number {
  if (totalEarned < 50000) return 0;
  return Math.floor(Math.sqrt(totalEarned / 50000) * 10) / 10;
}
