"use client";
import { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine, UpgradeDef, GameSave, GamePhase, DURATION } from '../game/engine';
import { render } from '../game/renderer';

interface Props {
  save: GameSave;
  onExit: (updatedSave: GameSave) => void;
}

function calcDims() {
  if (typeof window === 'undefined') return { w: 480, h: 480 }
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Use 480 as base for the shorter axis, scale the other proportionally
  const base = 480
  if (vh >= vw) {
    return { w: base, h: Math.floor(base * (vh / vw)) }
  } else {
    return { w: Math.floor(base * (vw / vh)), h: base }
  }
}

export default function GameCanvas({ save, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dimsRef = useRef(calcDims());

  const [hud, setHud] = useState({ hp: 100, maxHp: 100, level: 1, kills: 0, gold: 0, time: 0, xp: 0, xpNext: 10 });
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [choices, setChoices] = useState<UpgradeDef[]>([]);
  const [speed, setSpeed] = useState(1);

  const gameW = dimsRef.current.w;
  const gameH = dimsRef.current.h;

  useEffect(() => {
    const engine = new GameEngine(save, gameW, gameH);
    engineRef.current = engine;
    engine.onLevelUp = (c) => { setChoices(c); setPhase('levelup'); };
    engine.onGameEnd = (v) => setPhase(v ? 'victory' : 'defeat');

    let hudT = 0;
    const loop = (time: number) => {
      const dt = Math.min((time - (lastTimeRef.current || time)) / 1000, 0.05);
      lastTimeRef.current = time;
      engine.update(dt);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) render(ctx, engine);
      }
      hudT += dt;
      if (hudT > 0.1) {
        hudT = 0;
        setHud({ hp: Math.floor(engine.hp), maxHp: engine.stats.maxHp, level: engine.level, kills: engine.kills, gold: engine.gold, time: engine.timeElapsed, xp: engine.xp, xpNext: engine.xpToNext });
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [save, gameW, gameH]);

  const handlePointer = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine || engine.phase !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left) * (gameW / rect.width);
    const wy = (e.clientY - rect.top) * (gameH / rect.height);
    engine.tryCollect(wx, wy);
  }, [gameW, gameH]);

  const pickUpgrade = (id: string) => {
    engineRef.current?.applyUpgrade(id);
    setPhase('playing');
    setChoices([]);
  };

  const toggleSpeed = () => {
    const s = [1, 2, 3];
    const next = s[(s.indexOf(speed) + 1) % s.length];
    setSpeed(next);
    engineRef.current?.setGameSpeed(next);
  };

  const handleExit = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const updated = { ...save, gold: save.gold + engine.goldEarned, gamesPlayed: save.gamesPlayed + 1, bestKills: Math.max(save.bestKills, engine.kills), bestTime: Math.max(save.bestTime, engine.timeElapsed) };
    onExit(updated);
  };

  const fmtTime = (t: number) => {
    const rem = Math.max(0, Math.ceil(DURATION - t));
    return `${Math.floor(rem / 60)}:${(rem % 60).toString().padStart(2, '0')}`;
  };
  const survived = (t: number) => {
    const s = Math.floor(t);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="fixed inset-0 bg-black z-[60]" style={{ touchAction: 'none' }} data-testid="game-canvas-container">
      {/* Canvas fills entire screen */}
      <canvas
        ref={canvasRef}
        width={gameW}
        height={gameH}
        onPointerDown={handlePointer}
        className="w-full h-full block"
        style={{ imageRendering: 'pixelated' }}
        data-testid="game-canvas"
      />

      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>
        {/* Top bar */}
        <div className="flex justify-between items-start p-2 sm:p-3">
          <div className="flex flex-col gap-1">
            <div className="bg-black/70 px-2 py-1 rounded text-white text-[10px] sm:text-xs" data-testid="hud-level">Lv.{hud.level}</div>
            <div className="bg-black/70 px-2 py-1 rounded text-white text-[10px] sm:text-xs" data-testid="hud-kills">Kills: {hud.kills}</div>
          </div>
          <div className="bg-black/70 px-3 py-1.5 rounded text-white text-sm sm:text-base font-bold tracking-wider" data-testid="hud-timer">
            {fmtTime(hud.time)}
          </div>
          <div className="flex flex-col gap-1 items-end">
            <div className="bg-black/70 px-2 py-1 rounded text-yellow-400 text-[10px] sm:text-xs" data-testid="hud-gold">
              $ {hud.gold}
            </div>
            <button onClick={toggleSpeed} className="bg-black/70 px-2 py-1 rounded text-lime-400 text-[10px] sm:text-xs pointer-events-auto active:bg-black/90" data-testid="speed-toggle">
              x{speed}
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom HUD */}
        <div className="p-3 sm:p-4 space-y-2">
          {/* HP Bar */}
          <div className="max-w-[200px] mx-auto">
            <div className="bg-black/70 rounded p-1">
              <div className="h-2.5 sm:h-3 bg-red-900/80 rounded-sm overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-150" style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} />
              </div>
              <div className="text-center text-[8px] sm:text-[10px] text-white mt-0.5">{hud.hp}/{hud.maxHp}</div>
            </div>
          </div>
          {/* XP Bar */}
          <div className="bg-black/70 rounded p-1">
            <div className="h-1.5 sm:h-2 bg-gray-800 rounded-sm overflow-hidden">
              <div className="h-full bg-lime-500 transition-all duration-100" style={{ width: `${(hud.xp / hud.xpNext) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Level Up Overlay */}
      {phase === 'levelup' && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-3 z-10" data-testid="levelup-overlay">
          <div className="text-center max-w-sm w-full">
            <h2 className="text-xl sm:text-2xl font-bold text-lime-400 mb-4" style={{ fontFamily: 'monospace' }}>LEVEL UP!</h2>
            <div className="flex gap-2 justify-center">
              {choices.map(upg => (
                <button
                  key={upg.id}
                  onClick={() => pickUpgrade(upg.id)}
                  className="bg-gray-900/95 border-2 border-gray-600 hover:border-lime-400 active:border-lime-300 rounded-xl p-3 w-24 sm:w-28 text-center transition-colors"
                  data-testid={`upgrade-${upg.id}`}
                >
                  <div className="text-xl sm:text-2xl mb-1">{upg.icon}</div>
                  <div className="text-[10px] sm:text-xs font-bold text-white">{upg.name}</div>
                  <div className="text-[8px] sm:text-[10px] text-gray-400 mt-1">{upg.desc}</div>
                  <div className="text-[8px] sm:text-[10px] mt-1 font-bold" style={{ color: upg.color }}>
                    Lv.{(engineRef.current?.upgradeLevels[upg.id] || 0) + 1}/{upg.maxLevel}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game End Overlay */}
      {(phase === 'victory' || phase === 'defeat') && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 z-10" data-testid="game-end-overlay">
          <div className="text-center bg-gray-900/95 border-2 border-gray-700 rounded-2xl p-5 sm:p-6 max-w-xs w-full" style={{ fontFamily: 'monospace' }}>
            <h2 className={`text-2xl sm:text-3xl font-bold mb-4 ${phase === 'victory' ? 'text-lime-400' : 'text-red-400'}`}>
              {phase === 'victory' ? 'VICTORY!' : 'DEFEAT'}
            </h2>
            <div className="space-y-1.5 text-xs sm:text-sm text-gray-300 mb-5">
              <p>Level: <span className="text-white font-bold">{hud.level}</span></p>
              <p>Kills: <span className="text-white font-bold">{hud.kills}</span></p>
              <p>Survived: <span className="text-white font-bold">{survived(hud.time)}</span></p>
              <p className="text-yellow-400 font-bold text-sm sm:text-base">+{engineRef.current?.goldEarned || 0} Gold</p>
            </div>
            <button
              onClick={handleExit}
              className="bg-lime-500 hover:bg-lime-400 active:bg-lime-300 text-black font-bold px-6 py-3 rounded-xl transition-colors text-sm sm:text-base"
              data-testid="continue-btn"
            >
              CONTINUE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
