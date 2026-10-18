import { useEffect, useState } from "react";
import { Search, Settings, Monitor } from "lucide-react";
import type { GamehubAction } from "../../types/controller";
import { useControllerStore } from "../../store/controllerStore";
import { setConsoleOverlayHandler } from "../../utils/consoleInput";
import { uiAudio } from "../../utils/uiAudio";
import { useT } from "../../i18n";
import { useNavFeedback } from "../../hooks/useNavFeedback";
import clsx from "clsx";

interface ConsoleQuickMenuProps {
  onClose: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onExitToDesktop: () => void;
}

export function ConsoleQuickMenu({
  onClose,
  onOpenSearch,
  onOpenSettings,
  onExitToDesktop,
}: ConsoleQuickMenuProps) {
  const [index, setIndex] = useState(0);
  const getButtonLabel = useControllerStore((s) => s.getButtonLabel);
  const { t } = useT();

  useNavFeedback(index);

  const items = [
    { id: "search", label: t("common.search"), icon: Search, action: onOpenSearch },
    { id: "settings", label: t("settings.title"), icon: Settings, action: onOpenSettings },
    { id: "exit", label: t("console.switchToDesktopMode"), icon: Monitor, action: onExitToDesktop },
  ];

  const activate = (id: string, action: () => void) => {
    void uiAudio.playUiSound(id === "exit" ? "close" : "confirm");
    action();
  };

  const close = () => {
    void uiAudio.playUiSound("close");
    onClose();
  };

  const move = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + items.length) % items.length);

  const handleAction = (a: GamehubAction): boolean => {
    switch (a) {
      case "down": move(1); return true;
      case "up": move(-1); return true;
      case "confirm": activate(items[index].id, items[index].action); return true;
      case "cancel": close(); return true;
      default: return false;
    }
  };

  useEffect(() => {
    setIndex(0);
  }, []);

  useEffect(() => {
    setConsoleOverlayHandler(handleAction);
    return () => setConsoleOverlayHandler(null);
  }, [items, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); move(-1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); activate(items[index].id, items[index].action); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div
        className="relative w-80 rounded-2xl bg-[#111827]/95 border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
          {t("console.menuTitle")}
        </p>
        <div className="py-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            const focused = i === index;
            return (
              <button
                key={item.id}
                onClick={() => activate(item.id, item.action)}
                onMouseEnter={() => setIndex(i)}
                className={clsx(
                  "w-full flex items-center gap-3 px-5 py-3 text-left text-sm font-medium transition-colors",
                  focused ? "bg-white text-black" : "text-white/85 hover:bg-white/10"
                )}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
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