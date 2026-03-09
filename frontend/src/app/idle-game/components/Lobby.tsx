"use client";
import { motion } from 'framer-motion';
import { LOBBY_UPGRADES, GameSave } from '../game/engine';

interface Props {
  save: GameSave;
  onPlay: () => void;
  onUpgrade: (id: string) => void;
}

export default function Lobby({ save, onPlay, onUpgrade }: Props) {
  return (
    <div className="min-h-screen pb-24 overflow-auto" style={{ fontFamily: 'monospace', background: 'linear-gradient(180deg, #1a4a24 0%, #2a6a34 40%, #3a7d44 100%)' }}>
      {/* Header */}
      <div className="bg-[#0e2e14]/80 backdrop-blur-sm p-4 text-center border-b-2 border-[#4a8a44]/50">
        <h1 className="text-xl sm:text-2xl font-bold text-[#afe] tracking-[0.2em]" data-testid="game-title">BASE DEFENCE</h1>
        <div className="flex justify-center gap-3 sm:gap-5 mt-2 text-[10px] sm:text-xs flex-wrap">
          <span className="text-yellow-400" data-testid="lobby-gold">$ {save.gold}</span>
          <span className="text-gray-300">{save.gamesPlayed} games</span>
          <span className="text-gray-300">Best: {save.bestKills} kills</span>
        </div>
      </div>

      {/* Archer Character Display */}
      <div className="flex justify-center py-4">
        <div className="relative">
          <canvas id="lobby-archer" width="80" height="80" style={{ imageRendering: 'pixelated' }} className="w-20 h-20" />
          <LobbyArcher />
        </div>
      </div>

      {/* Upgrades Grid */}
      <div className="px-3 sm:px-4">
        <h2 className="text-[10px] sm:text-xs text-[#8c8] uppercase tracking-widest mb-2">Permanent Upgrades</h2>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {LOBBY_UPGRADES.map((upg, i) => {
            const level = save.lobbyLevels[upg.id] || 0;
            const maxed = level >= upg.maxLevel;
            const cost = maxed ? 0 : upg.cost(level);
            const canAfford = save.gold >= cost;
            return (
              <motion.button
                key={upg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => !maxed && canAfford && onUpgrade(upg.id)}
                disabled={maxed || !canAfford}
                className={`bg-[#0e2e14]/70 border-2 rounded-lg p-1.5 sm:p-2 text-center transition-all ${
                  maxed ? 'border-yellow-700/60 opacity-60' :
                  canAfford ? 'border-[#4a8a44]/70 hover:border-[#afe] active:scale-95 hover:bg-[#1a4a24]' :
                  'border-[#2a4a34]/40 opacity-40'
                }`}
                data-testid={`lobby-upgrade-${upg.id}`}
              >
                <div className="text-base sm:text-lg leading-none">{upg.icon}</div>
                <div className="text-[8px] sm:text-[10px] text-white font-bold truncate mt-0.5">{upg.name}</div>
                <div className="text-[7px] sm:text-[9px] text-gray-400">Lv.{level}/{upg.maxLevel}</div>
                {!maxed ? (
                  <div className={`text-[7px] sm:text-[9px] mt-0.5 ${canAfford ? 'text-yellow-400' : 'text-gray-600'}`}>
                    ${cost}
                  </div>
                ) : (
                  <div className="text-[7px] sm:text-[9px] text-yellow-500 mt-0.5 font-bold">MAX</div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Play Button */}
      <div className="px-4 mt-5 sm:mt-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onPlay}
          className="w-full py-3.5 sm:py-4 rounded-xl text-lg sm:text-xl font-bold tracking-wider transition-colors"
          style={{
            background: 'linear-gradient(180deg, #c99a5a 0%, #a07040 100%)',
            border: '2px solid #d4a86a',
            color: '#1a1a1a',
            textShadow: '0 1px 0 rgba(255,255,255,0.3)',
          }}
          data-testid="play-btn"
        >
          PLAY
        </motion.button>
      </div>

      {/* Tip */}
      <div className="text-center mt-3 px-4">
        <p className="text-[9px] sm:text-[10px] text-[#6a6] italic">Tap XP gems and gold during battle to collect them!</p>
      </div>
    </div>
  );
}

function LobbyArcher() {
  useCanvasArcher();
  return null;
}

function useCanvasArcher() {
  const drawn = typeof window !== 'undefined';
  if (!drawn) return;
  // Draw a pixel art archer on the lobby canvas
  setTimeout(() => {
    const c = document.getElementById('lobby-archer') as HTMLCanvasElement | null;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 80, 80);
    // Tower base
    ctx.fillStyle = '#778';
    ctx.fillRect(25, 40, 30, 30);
    ctx.fillStyle = '#889';
    ctx.fillRect(27, 44, 26, 1);
    ctx.fillRect(27, 50, 26, 1);
    ctx.fillRect(27, 56, 26, 1);
    ctx.fillRect(27, 62, 26, 1);
    // Battlements
    ctx.fillStyle = '#667';
    for (let i = 0; i < 6; i++) ctx.fillRect(25 + i * 5, 36, 3, 4);
    // Platform
    ctx.fillStyle = '#a86';
    ctx.fillRect(22, 38, 36, 3);
    // Body
    ctx.fillStyle = '#2a6';
    ctx.fillRect(36, 24, 8, 14);
    // Head
    ctx.fillStyle = '#da8';
    ctx.fillRect(37, 18, 6, 6);
    // Hood
    ctx.fillStyle = '#196';
    ctx.fillRect(36, 16, 8, 4);
    // Bow
    ctx.fillStyle = '#a64';
    ctx.fillRect(45, 20, 2, 12);
    ctx.strokeStyle = '#a64';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(46, 20);
    ctx.quadraticCurveTo(52, 26, 46, 32);
    ctx.stroke();
  }, 100);
}
