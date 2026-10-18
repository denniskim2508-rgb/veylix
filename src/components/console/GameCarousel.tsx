import { useMemo, useRef, useEffect } from "react";
import type { Game, ConsoleCardSize } from "../../types";
import { ArtworkType } from "../../types";
import { useArtwork } from "../../hooks/useArtwork";
import { Star } from "lucide-react";
import clsx from "clsx";

const CARD_WIDTHS: Record<ConsoleCardSize, number> = {
  small: 150,
  medium: 185,
  large: 230,
  extralarge: 290,
};

const RENDER_PAD = 10;
const GAP = 14;

interface GameCarouselProps {
  games: Game[];
  selectedIndex: number;
  cardSize: ConsoleCardSize;
  isFocused: boolean;
  onSelect: (index: number) => void;
  onActivate: (index: number) => void;
}

function CarouselCard({
  game,
  width,
  isSelected,
  isConsoleFocused,
  onClick,
}: {
  game: Game;
  width: number;
  isSelected: boolean;
  isConsoleFocused: boolean;
  onClick: () => void;
}) {
  const { url: coverUrl } = useArtwork(game.id, ArtworkType.Cover, game.coverImage);

  return (
    <div
      role="button"
      onClick={onClick}
      className={clsx(
        "absolute top-0 rounded-2xl overflow-hidden select-none cursor-pointer transition-all duration-300 ease-out",
        isSelected
          ? "scale-[1.12] z-20 shadow-[0_0_0_3px_rgba(255,255,255,0.9),0_18px_50px_rgba(0,0,0,0.65)]"
          : "scale-100 z-10 shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        isConsoleFocused && isSelected && "ring-[3px] ring-white"
      )}
      style={{ width, height: width * 1.5, left: 0, top: 0 }}
    >
      {coverUrl ? (
        <img src={coverUrl} alt={game.title} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/25 to-bg-card">
          <span className="text-4xl font-bold text-white/30">{game.title.charAt(0).toUpperCase()}</span>
        </div>
      )}

      <div className={clsx(
        "absolute inset-0 transition-colors duration-300",
        isSelected ? "bg-black/30" : "bg-black/45"
      )} />

      <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 to-transparent">
        <p className={clsx(
          "text-white font-semibold truncate",
          isSelected ? "text-sm" : "text-xs"
        )}>
          {game.title}
        </p>
      </div>

      {game.isFavorite && (
        <span className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-yellow-400 text-black">
          <Star size={12} fill="currentColor" />
        </span>
      )}
    </div>
  );
}

export function GameCarousel({
  games,
  selectedIndex,
  cardSize,
  isFocused,
  onSelect,
  onActivate,
}: GameCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardWidth = CARD_WIDTHS[cardSize];
  const step = cardWidth + GAP;

  const start = Math.max(0, selectedIndex - RENDER_PAD);
  const end = Math.min(games.length, selectedIndex + RENDER_PAD + 1);

  const visible = useMemo(() => {
    const list: { game: Game; index: number }[] = [];
    for (let i = start; i < end; i++) {
      list.push({ game: games[i], index: i });
    }
    return list;
  }, [start, end, games]);

  const handleTranslate = () => {
    const el = containerRef.current;
    if (!el) return;
    const center = el.clientWidth / 2 - cardWidth / 2;
    el.style.transform = `translateX(calc(-${selectedIndex * step}px + ${center}px))`;
  };

  useEffect(() => {
    requestAnimationFrame(() => handleTranslate());
  });

  return (
    <div className="relative w-full" style={{ height: cardWidth * 1.5 + 36 }}>
      <div
        ref={containerRef}
        className="absolute left-0 top-0 will-change-transform transition-transform duration-300 ease-out"
        style={{ width: 0 }}
      >
        {visible.map(({ game, index }) => (
          <div
            key={`${game.id}-slot`}
            className="absolute top-0"
            style={{ left: index * step, width: cardWidth, height: cardWidth * 1.5 }}
          >
            <CarouselCard
              game={game}
              width={cardWidth}
              isSelected={index === selectedIndex}
              isConsoleFocused={isFocused}
              onClick={() => {
                if (index === selectedIndex) {
                  onActivate(index);
                } else {
                  onSelect(index);
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}