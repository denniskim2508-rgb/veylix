import { useEffect, useState } from "react";
import type { Game } from "../types";
import { resolveIconUrl } from "../utils/artwork";
import clsx from "clsx";

/**
 * Resolves a game's stored icon path to a renderable URL. Only the icon
 * already applied via Manage Artwork is used (no provider lookups).
 */
function useGameIcon(path: string | null): string | null {
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    resolveIconUrl(path).then((url) => {
      if (!cancelled) setResolved({ path, url });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Derived (not set in the effect): null while a different/absent path is used.
  return path != null && resolved?.path === path ? resolved.url : null;
}

interface GameIconProps {
  game: Game;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
}

/**
 * Renders a game's official icon, falling back to a first-letter box when no
 * icon has been applied (or the image fails to load).
 */
export function GameIcon({ game, className, imgClassName, fallbackClassName }: GameIconProps) {
  const url = useGameIcon(game.icon);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = url != null && failedUrl === url;

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={game.title}
        draggable={false}
        onError={() => setFailedUrl(url)}
        className={clsx("object-cover", className, imgClassName)}
      />
    );
  }

  return (
    <span className={clsx("flex items-center justify-center font-bold", className, fallbackClassName)}>
      {game.title.charAt(0).toUpperCase()}
    </span>
  );
}
