import { useEffect, useState } from "react";
import { Search, Settings, Power, Gamepad2, Heart } from "lucide-react";
import type { ConsoleNavItem } from "../../types/console";
import { useControllerStore } from "../../store/controllerStore";
import { useT, currentLocale } from "../../i18n";
import clsx from "clsx";

interface ConsoleNavBarProps {
  items: ConsoleNavItem[];
  activeSection: string;
  focusedIndex: number;
  isFocused: boolean;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}

const NAV_ICONS: Record<string, React.ReactNode> = {
  search: <Search size={15} />,
  settings: <Settings size={15} />,
  favorites: <Heart size={15} />,
  exit: <Power size={15} />,
};

export function ConsoleNavBar({
  items,
  activeSection,
  focusedIndex,
  isFocused,
  onSelect,
  onHover,
}: ConsoleNavBarProps) {
  const connected = useControllerStore((s) => s.connected);
  const { t } = useT();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative z-20 flex w-full items-center justify-between gap-8 px-10 pt-6 pb-2">
      <div className="flex items-center gap-6 flex-wrap">
        {items.map((item, index) => {
          const isActiveSection = activeSection === item.id;
          const isNavFocused = isFocused && focusedIndex === index;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(index)}
              onMouseEnter={() => onHover(index)}
              className={clsx(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-150",
                isNavFocused
                  ? "bg-white text-black shadow-[0_0_0_3px_rgba(255,255,255,0.55)]"
                  : isActiveSection
                    ? "bg-white/25 text-white backdrop-blur-md"
                    : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              {NAV_ICONS[item.id]}
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-5 text-white/80">
        {connected && (
          <span className="flex items-center gap-2 text-sm text-white/80">
            <Gamepad2 size={16} className={clsx(connected && "text-emerald-400")} />
            <span className="hidden sm:inline">{t("console.controller")}</span>
          </span>
        )}
        <span className="text-sm tabular-nums text-white/80">
          {now.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}