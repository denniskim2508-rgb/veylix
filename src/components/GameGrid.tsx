import type { Game } from "../types";
import { GameCard } from "./GameCard";
import { Gamepad2 } from "lucide-react";

interface GameGridProps {
  games: Game[];
  onGameClick: (game: Game) => void;
  onToggleFavorite: (id: number) => void;
}

export function GameGrid({ games, onGameClick, onToggleFavorite }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
        <Gamepad2 size={64} className="mb-4 opacity-30" />
        <h3 className="text-lg font-medium text-text-secondary mb-1">No games found</h3>
        <p className="text-sm">Add games manually or scan your libraries to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
      <div
        data-game-grid
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
      >
        {games.map((game) => (
          <div key={game.id} className="flex justify-center">
            <GameCard
              game={game}
              onClick={() => onGameClick(game)}
              onToggleFavorite={(e) => {
                e.stopPropagation();
                onToggleFavorite(game.id);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
