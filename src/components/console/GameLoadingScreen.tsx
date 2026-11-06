import { useEffect, useState } from "react";
import type { Game } from "../../types";
import { useArtwork } from "../../hooks/useArtwork";
import { ArtworkType } from "../../types";

interface GameLoadingScreenProps {
  game: Game;
  error?: string | null;
  onCancel?: () => void;
}

export function GameLoadingScreen({ game, error, onCancel }: GameLoadingScreenProps) {
  const bg = useArtwork(game.id, ArtworkType.Background, game.backgroundImage);
  const cover = useArtwork(game.id, ArtworkType.Cover, game.coverImage);
  const logo = useArtwork(game.id, ArtworkType.Logo, game.logo);
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (error) return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, [error]);

  const bgUrl = bg.url || cover.url || null;
  const logoUrl = logo.url || null;
  const fallbackCoverUrl = cover.url || null;

  return (
    <div className="fixed inset-0 z-[200] bg-black overflow-hidden select-none">
      {/* Background artwork */}
      {bgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      )}
      {/* Cinematic overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80" />
      
      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
        }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center gap-8">
        {/* Game logo or cover fallback */}
        <div className="relative">
          <div className="absolute -inset-6 bg-blue-500/15 blur-3xl rounded-lg animate-pulse" />
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={game.title}
              className="relative max-w-[420px] max-h-[200px] w-auto h-auto object-contain drop-shadow-[0_0_40px_rgba(0,0,0,0.9)]"
              style={{ filter: "drop-shadow(0 4px 60px rgba(59, 130, 246, 0.4))" }}
            />
          ) : fallbackCoverUrl ? (
            <img
              src={fallbackCoverUrl}
              alt={game.title}
              className="relative w-48 h-72 object-cover rounded-lg shadow-2xl shadow-black/80 border border-white/10"
            />
          ) : (
            <h1 className="relative text-4xl md:text-5xl font-bold text-white tracking-wide drop-shadow-[0_0_30px_rgba(59,130,246,0.5)]">
              {game.title}
            </h1>
          )}
        </div>

        {/* Loading indicator */}
        {error ? (
          <div className="flex flex-col items-center gap-4 mt-4">
            <div className="text-red-400 text-lg font-medium">Launch Failed</div>
            <div className="text-white/60 text-sm max-w-md text-center">{error}</div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20"
              >
                Back to Console
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
            </div>
            <div className="text-white/70 text-lg tracking-widest uppercase">
              Starting{dots}
            </div>
          </div>
        )}
      </div>

      {/* Bottom branding */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="text-white/30 text-xs tracking-[0.3em] uppercase">
          Veylix
        </div>
      </div>
    </div>
  );
}
