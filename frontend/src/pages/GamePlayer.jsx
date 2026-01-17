import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/App";

export default function GamePlayer() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { API, token, user } = useAuth();
  const iframeRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameUrl, setGameUrl] = useState(null);
  const [buttonY, setButtonY] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const buttonStartY = useRef(0);

  useEffect(() => {
    // Set game URL
    setGameUrl(`${API}/games/${gameId}/play`);
    
    // Simulate loading time for iframe
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameId, API]);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    buttonStartY.current = buttonY;
  }, [buttonY]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - dragStartY.current;
    const newY = Math.max(50, Math.min(window.innerHeight - 150, buttonStartY.current + deltaY));
    setButtonY(newY);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleBack = () => {
    navigate(-1);
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <ArrowLeft className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-heading text-white mb-2">Game Not Found</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button
          onClick={handleBack}
          className="px-6 py-3 bg-lime text-black font-bold rounded-full"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50" data-testid="game-player">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background flex flex-col items-center justify-center z-20">
          <Loader2 className="w-12 h-12 text-lime animate-spin mb-4" />
          <p className="text-white font-medium">Loading game...</p>
        </div>
      )}

      {/* Game iFrame */}
      {gameUrl && (
        <iframe
          ref={iframeRef}
          src={gameUrl}
          className="w-full h-full border-0"
          title="Game Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoading(false)}
          onError={() => {
            setError("Failed to load game");
            setLoading(false);
          }}
        />
      )}

      {/* Draggable Back Button */}
      <button
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={(e) => {
          // Only navigate if not dragging
          if (!isDragging) {
            handleBack();
          }
        }}
        className={`fixed left-4 z-30 w-12 h-12 rounded-full glass flex items-center justify-center touch-target transition-all ${
          isDragging ? "scale-110 ring-2 ring-lime" : ""
        }`}
        style={{ top: `${buttonY}px` }}
        data-testid="back-button"
      >
        <ArrowLeft className="w-6 h-6 text-white" />
      </button>

      {/* Drag hint */}
      {!isDragging && (
        <div 
          className="fixed left-4 z-20 text-xs text-white/40 pointer-events-none transition-opacity"
          style={{ top: `${buttonY + 56}px` }}
        >
          Drag me
        </div>
      )}
    </div>
  );
}
