import { useState, useEffect } from "react";
import type { Game } from "../../types";
import clsx from "clsx";

export function HeroTitle({
  game,
  logoUrl,
  className,
  imgClassName,
  textClassName,
}: {
  game: Game;
  logoUrl: string | null;
  className?: string;
  imgClassName?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (!logoUrl || failed) {
    return (
      <h1
        className={clsx("font-bold text-white", textClassName ?? "text-3xl sm:text-5xl", className)}
        style={{ textShadow: "0 2px 14px rgba(0,0,0,0.75)" }}
      >
        {game.title}
      </h1>
    );
  }
  return (
    <img
      src={logoUrl}
      alt={game.title}
      onError={() => setFailed(true)}
      className={clsx("w-auto object-contain", imgClassName ?? "max-h-20 sm:max-h-32", className)}
      style={{ filter: "drop-shadow(0 2px 14px rgba(0,0,0,0.8))" }}
    />
  );
}