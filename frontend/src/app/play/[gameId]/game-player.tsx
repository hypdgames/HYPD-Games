"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogOut, Volume2, VolumeX, Loader2, X, UserCheck, UserX } from "lucide-react";
import { useAuthStore } from "@/store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function GamePlayer() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { user, token } = useAuthStore();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startTimeRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setGameUrl(`${API_URL}/api/games/${gameId}/play`);
    startTimeRef.current = Date.now();
  }, [gameId]);

  useEffect(() => {
    return () => { recordPlaySession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordPlaySession = async () => {
    if (!startTimeRef.current) return;
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    if (durationSeconds < 3) return;
    try {
      await fetch(`${API_URL}/api/analytics/play-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ game_id: gameId, duration_seconds: durationSeconds, score: null }),
      });
    } catch (e) { console.error("Failed to record play session:", e); }
  };

  const handleExit = () => {
    recordPlaySession();
    router.back();
  };

  const toggleMute = () => {
    setMuted(prev => !prev);
    // Attempt to mute iframe audio via postMessage (works for some game engines)
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: "mute", muted: !muted }, "*");
      } catch {}
    }
  };

  const handleProfileClick = () => {
    if (!user) {
      recordPlaySession();
      router.push("/profile");
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Game Not Found</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button onClick={handleExit} className="px-6 py-3 bg-violet text-white font-bold rounded-pill" data-testid="go-back-btn">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50" data-testid="game-player">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background flex flex-col items-center justify-center z-30">
          <Loader2 className="w-12 h-12 text-violet animate-spin mb-4" />
          <p className="text-foreground font-medium text-[15px]">Loading game...</p>
        </div>
      )}

      {/* Game iframe */}
      {gameUrl && (
        <iframe
          ref={iframeRef}
          src={gameUrl}
          className="w-full h-full border-0"
          title="Game Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="eager"
          onLoad={() => setLoading(false)}
          onError={() => { setError("Failed to load game"); setLoading(false); }}
        />
      )}

      {/* ─── Top toolbar ─────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2.5 bg-background/80 backdrop-blur-md border-b border-border/50" data-testid="game-toolbar">
        {/* Exit button — themed pill */}
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 px-4 py-2 rounded-pill text-foreground font-bold text-sm active:scale-95 transition-transform"
          data-testid="exit-button"
        >
          <LogOut className="w-4 h-4" />
          Exit
        </button>

        {/* Right side: Sound + Profile status */}
        <div className="flex items-center gap-2.5">
          {/* Sound toggle */}
          <button
            onClick={toggleMute}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground active:scale-90 transition-transform"
            data-testid="sound-toggle"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Profile icon — green with tick if logged in, red with X if not */}
          <button
            onClick={handleProfileClick}
            className="w-9 h-9 flex items-center justify-center active:scale-90 transition-transform"
            data-testid="profile-status"
            title={user ? `Logged in as ${user.username}` : "Not logged in — tap to sign in"}
          >
            {user ? (
              <UserCheck className="w-6 h-6 text-green-500" strokeWidth={2} />
            ) : (
              <UserX className="w-6 h-6 text-red-500" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
