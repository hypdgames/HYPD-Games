"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogOut, Volume2, VolumeX, Loader2, X, UserCheck, UserX, PlayCircle, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ─── GMZ Walkthrough Video Player ──────────────────────────────────────────
function GMZWalkthroughPlayer({ gameHash, adsEnabled, onClose }: {
  gameHash: string;
  adsEnabled: boolean;
  onClose: () => void;
}) {
  const initialized = useRef(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!gameHash || initialized.current) return;
    initialized.current = true;

    // Set VIDEO_OPTIONS BEFORE loading the script
    (window as Window & { VIDEO_OPTIONS?: object }).VIDEO_OPTIONS = {
      gameid: gameHash,
      width: "100%",
      height: "100%",
      color: "#AAFF00",
      getAds: adsEnabled ? "true" : "false",
    };

    // Remove any previous instance of the script
    const old = document.getElementById("gamemonetize-video-api");
    if (old) old.remove();

    // Reset container
    const container = document.getElementById("gamemonetize-video");
    if (container) container.innerHTML = "";

    // Inject the official GMZ video.js
    const script = document.createElement("script");
    script.id = "gamemonetize-video-api";
    script.src = "https://api.gamemonetize.com/video.js";
    script.type = "text/javascript";
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById("gamemonetize-video-api");
      if (s) s.remove();
    };
  }, [gameHash, adsEnabled]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      data-testid="walkthrough-sheet"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black border-b border-white/10">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-[#AAFF00]" />
          <span className="font-bold text-white text-sm">Walkthrough Video</span>
          {!adsEnabled && (
            <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">Ad-free</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 px-3 py-1.5 rounded-full text-white text-xs font-semibold active:scale-95 transition-all"
          data-testid="close-walkthrough-btn"
        >
          <X className="w-3.5 h-3.5" />
          Close
        </button>
      </div>

      {/* Tap hint */}
      <div className="flex-shrink-0 flex items-center justify-center gap-1.5 py-2 bg-black/80 border-b border-white/5">
        <PlayCircle className="w-3 h-3 text-[#AAFF00]/70" />
        <span className="text-[11px] text-white/50">Tap the video to start playing</span>
      </div>

      {/* Player fills remaining height */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {!scriptLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
            <Loader2 className="w-8 h-8 text-[#AAFF00] animate-spin" />
            <span className="text-white/50 text-sm">Loading walkthrough...</span>
          </div>
        )}
        <div id="gamemonetize-video" className="w-full h-full" />
      </div>

      {/* Bottom close strip */}
      <button
        onClick={onClose}
        className="flex-shrink-0 flex items-center justify-center gap-2 py-4 bg-black border-t border-white/10 text-white/50 active:text-white/80 transition-colors"
        data-testid="dismiss-walkthrough-btn"
      >
        <ChevronDown className="w-4 h-4" />
        <span className="text-xs font-medium">Close Walkthrough</span>
      </button>
    </div>
  );
}

// ─── Main Game Player ───────────────────────────────────────────────────────
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

  // Walkthrough state
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [gmzHash, setGmzHash] = useState<string | null>(null);
  const [gmzAdsEnabled, setGmzAdsEnabled] = useState(true);

  useEffect(() => {
    setGameUrl(`${API_URL}/api/games/${gameId}/play`);
    startTimeRef.current = Date.now();
    fetchGameDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const fetchGameDetails = async () => {
    try {
      const [gameRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/games/${gameId}`),
        fetch(`${API_URL}/api/settings`),
      ]);
      if (gameRes.ok) {
        const game = await gameRes.json();
        if (game.source === "gamemonetize" && game.embed_url) {
          // Extract hash from embed URL: last path segment
          const hash = game.embed_url.replace(/\/$/, "").split("/").pop();
          if (hash) setGmzHash(hash);
        }
      }
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setGmzAdsEnabled(settings.gmz_video_ads_enabled !== "false");
      }
    } catch {
      // non-fatal — walkthrough button just won't show
    }
  };

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
    <>
      <div className="fixed inset-0 bg-black z-50 flex flex-col" data-testid="game-player">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background flex flex-col items-center justify-center z-30">
            <Loader2 className="w-12 h-12 text-violet animate-spin mb-4" />
            <p className="text-foreground font-medium text-[15px]">Loading game...</p>
          </div>
        )}

        {/* ─── Top toolbar ─────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-background border-b border-border/50" data-testid="game-toolbar">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 px-3.5 py-1.5 rounded-pill text-foreground font-bold text-xs active:scale-95 transition-transform"
            data-testid="exit-button"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit
          </button>

          <div className="flex items-center gap-2.5">
            {/* Walkthrough button — only shown for GMZ games */}
            {gmzHash && (
              <button
                onClick={() => setShowWalkthrough(true)}
                className="flex items-center gap-1.5 bg-[var(--violet)]/10 hover:bg-[var(--violet)]/20 border border-[var(--violet)]/30 px-3 py-1.5 rounded-pill text-[var(--violet)] font-bold text-xs active:scale-95 transition-transform"
                data-testid="walkthrough-button"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Walkthrough
              </button>
            )}

            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground active:scale-90 transition-transform"
              data-testid="sound-toggle"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={handleProfileClick}
              className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
              data-testid="profile-status"
              title={user ? `Logged in as ${user.username}` : "Not logged in — tap to sign in"}
            >
              {user ? (
                <UserCheck className="w-5 h-5 text-green-500" strokeWidth={2} />
              ) : (
                <UserX className="w-5 h-5 text-red-500" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* Game iframe */}
        {gameUrl && (
          <iframe
            ref={iframeRef}
            src={gameUrl}
            className="flex-1 w-full border-0"
            title="Game Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="eager"
            onLoad={() => setLoading(false)}
            onError={() => { setError("Failed to load game"); setLoading(false); }}
          />
        )}
      </div>

      {/* Walkthrough overlay */}
      {showWalkthrough && gmzHash && (
        <GMZWalkthroughPlayer
          gameHash={gmzHash}
          adsEnabled={gmzAdsEnabled}
          onClose={() => setShowWalkthrough(false)}
        />
      )}
    </>
  );
}
