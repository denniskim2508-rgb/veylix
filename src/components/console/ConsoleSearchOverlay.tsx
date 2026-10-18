import { useEffect, useMemo, useState, useRef } from "react";
import { Search } from "lucide-react";
import type { Game } from "../../types";
import { GameIcon } from "../GameIcon";
import type { GamehubAction } from "../../types/controller";
import { useControllerStore } from "../../store/controllerStore";
import { setConsoleOverlayHandler } from "../../utils/consoleInput";
import { uiAudio } from "../../utils/uiAudio";
import { useT } from "../../i18n";
import { useNavFeedback } from "../../hooks/useNavFeedback";
import clsx from "clsx";

interface ConsoleSearchOverlayProps {
  games: Game[];
  onClose: () => void;
  onSelect: (game: Game) => void;
}

export function ConsoleSearchOverlay({ games, onClose, onSelect }: ConsoleSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const getButtonLabel = useControllerStore((s) => s.getButtonLabel);
  const { t } = useT();

  useNavFeedback(index, { resetKey: query });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games.slice(0, 60);
    return games
      .filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.platform.toLowerCase().includes(q) ||
          g.genre?.toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [games, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  // Keep the focused result visible while navigating with the controller or
  // keyboard. The results list is the only scrollable ancestor, so this never
  // disturbs the overlay itself.
  useEffect(() => {
    itemRefs.current.get(index)?.scrollIntoView({ block: "nearest" });
  }, [index, query]);

  const move = (dir: 1 | -1) =>
    setIndex((i) => {
      if (results.length === 0) return 0;
      return (i + dir + results.length) % results.length;
    });

  const activate = () => {
    const game = results[index];
    if (game) {
      void uiAudio.playUiSound("confirm");
      onSelect(game);
    }
  };

  const close = () => {
    void uiAudio.playUiSound("close");
    onClose();
  };

  const handleAction = (a: GamehubAction): boolean => {
    switch (a) {
      case "down": move(1); return true;
      case "up": move(-1); return true;
      case "confirm": activate(); return true;
      case "cancel": close(); return true;
      default: return false;
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setConsoleOverlayHandler(handleAction);
    return () => setConsoleOverlayHandler(null);
  }, [results, index]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={close} />
      <div
        className="relative w-[560px] max-w-[92vw] rounded-2xl bg-[#111827]/95 border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <Search size={18} className="text-white/50" />
          <input
            ref={inputRef}
            value={query}
            placeholder={t("console.searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
              else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
              else if (e.key === "Enter") { e.preventDefault(); activate(); }
              else if (e.key === "Escape") { e.preventDefault(); close(); }
              e.stopPropagation();
            }}
            className="w-full bg-transparent outline-none text-white text-base placeholder:text-white/40"
          />
        </div>
        <div className="py-1 max-h-[46vh] overflow-y-auto overscroll-contain">
          {results.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-white/45">
              {t("console.noSearchResults", { query })}
            </p>
          ) : (
            results.map((game, i) => {
              const focused = i === index;
              return (
                <button
                  key={game.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(i, el);
                    else itemRefs.current.delete(i);
                  }}
                  onClick={() => { void uiAudio.playUiSound("confirm"); onSelect(game); }}
                  onMouseEnter={() => setIndex(i)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors",
                    focused ? "bg-white text-black" : "text-white/85 hover:bg-white/10"
                  )}
                >
                  <GameIcon
                    game={game}
                    className="w-8 h-8 rounded-md bg-black/40 border border-white/15 overflow-hidden shrink-0"
                    fallbackClassName="text-xs"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{game.title}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-4 px-5 py-3 border-t border-white/10 text-[11px] text-white/45">
          <span>
            <span className="inline-block w-4 text-center font-bold">{getButtonLabel("confirm")}</span> {t("console.hintSelect")}
          </span>
          <span>
            <span className="inline-block w-4 text-center font-bold">{getButtonLabel("cancel")}</span> {t("common.back")}
          </span>
        </div>
      </div>
    </div>
  );
}