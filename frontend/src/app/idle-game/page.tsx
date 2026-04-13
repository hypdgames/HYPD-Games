"use client";
import { useState, useEffect, useCallback } from 'react';
import { GameSave, LOBBY_UPGRADES } from './game/engine';
import GameCanvas from './components/GameCanvas';
import Lobby from './components/Lobby';
import { useAuthStore } from '@/store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const DEFAULT_SAVE: GameSave = {
  gold: 0, lobbyLevels: {}, gamesPlayed: 0, bestTime: 0, bestKills: 0,
};

export default function BaseDefencePage() {
  const { token } = useAuthStore();
  const [save, setSave] = useState<GameSave>(DEFAULT_SAVE);
  const [screen, setScreen] = useState<'lobby' | 'playing'>('lobby');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) { setLoaded(true); return; }
      try {
        const res = await fetch(`${API_URL}/api/idle-game/state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.state) {
            // Backend returns state as an object directly
            const parsed = typeof data.state === 'string' ? JSON.parse(data.state) : data.state;
            if (parsed.lobbyLevels !== undefined) setSave(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load save:', e);
      }
      setLoaded(true);
    };
    load();
  }, [token]);

  const saveToDB = useCallback(async (s: GameSave) => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/idle-game/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state: s }),
      });
    } catch (e) { console.error('Save failed:', e); }
  }, [token]);

  const handleUpgrade = (id: string) => {
    const upg = LOBBY_UPGRADES.find(u => u.id === id);
    if (!upg) return;
    const lvl = save.lobbyLevels[id] || 0;
    if (lvl >= upg.maxLevel) return;
    const cost = upg.cost(lvl);
    if (save.gold < cost) return;
    const next = { ...save, gold: save.gold - cost, lobbyLevels: { ...save.lobbyLevels, [id]: lvl + 1 } };
    setSave(next);
    saveToDB(next);
  };

  const handleGameEnd = (updated: GameSave) => {
    setSave(updated);
    saveToDB(updated);
    setScreen('lobby');
  };

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a4a24', fontFamily: 'monospace' }}>
        <div className="text-[#afe] text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (screen === 'playing') {
    return <GameCanvas save={{ ...save }} onExit={handleGameEnd} />;
  }

  return (
    <Lobby save={save} onPlay={() => setScreen('playing')} onUpgrade={handleUpgrade} />
  );
}
