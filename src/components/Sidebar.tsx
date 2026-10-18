import {
  Library,
  Download,
  Star,
  Tag,
  Clock,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useT } from "../i18n";
import { DriveInfo } from "./DriveInfo";
import { PlatformIcon } from "./PlatformIcon";
import { PLATFORM_LABELS } from "../types";
import { useFocusableElement } from "../hooks/useFocusableElement";
import type { Platform } from "../types";
import clsx from "clsx";

export function Sidebar() {
  const {
    games,
    drives,
    categories,
    activePlatform,
    setActivePlatform,
    filterType,
    setFilterType,
    isSidebarCollapsed,
  } = useStore();
  const { t } = useT();

  if (isSidebarCollapsed) return null;

  const platformLabel = (platform: Platform): string => {
    if (platform === "emulator") return t("platform.emulator");
    if (platform === "manual") return t("platform.manual");
    if (platform === "local") return t("platform.local");
    return PLATFORM_LABELS[platform];
  };

  const platformCounts = games.reduce(
    (acc, g) => {
      acc[g.platform] = (acc[g.platform] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const installedCount = games.filter((g) => g.isInstalled).length;
  const favoritesCount = games.filter((g) => g.isFavorite).length;
  const recentCount = games.filter((g) => g.lastPlayed).length;

  const platforms: Platform[] = [
    "steam",
    "epic",
    "gog",
    "ea",
    "ubisoft",
    "battlenet",
    "rockstar",
    "xbox",
    "emulator",
    "local",
    "manual",
  ];

  return (
    <aside className="w-60 h-full border-r border-border bg-bg-sidebar flex flex-col shrink-0 overflow-y-auto overscroll-contain">
      <nav className="flex-1 py-3">
        <div className="px-4 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {t("sidebar.library")}
          </span>
        </div>
        <SidebarItem
          id="sidebar-all"
          icon={<Library size={18} />}
          label={t("sidebar.allGames")}
          count={games.length}
          active={filterType === "all" && activePlatform === "all"}
          onClick={() => {
            setFilterType("all");
            setActivePlatform("all");
          }}
        />
        <SidebarItem
          id="sidebar-installed"
          icon={<Download size={18} />}
          label={t("sidebar.installed")}
          count={installedCount}
          active={filterType === "installed" && activePlatform === "all"}
          onClick={() => {
            setFilterType("installed");
            setActivePlatform("all");
          }}
        />
        <SidebarItem
          id="sidebar-favorites"
          icon={<Star size={18} />}
          label={t("sidebar.favorites")}
          count={favoritesCount}
          active={filterType === "favorites" && activePlatform === "all"}
          onClick={() => {
            setFilterType("favorites");
            setActivePlatform("all");
          }}
        />
        <SidebarItem
          id="sidebar-recent"
          icon={<Clock size={18} />}
          label={t("sidebar.recentlyPlayed")}
          count={recentCount}
          active={filterType === "recent" && activePlatform === "all"}
          onClick={() => {
            setFilterType("recent");
            setActivePlatform("all");
          }}
        />

        <div className="px-4 mt-5 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {t("sidebar.sources")}
          </span>
        </div>
        {platforms.map((platform) => {
          const count = platformCounts[platform] || 0;
          if (count === 0 && platform !== "steam" && platform !== "manual" && platform !== "local") return null;
          return (
            <SidebarItem
              key={platform}
              id={`sidebar-${platform}`}
              icon={<PlatformIcon platform={platform} size={18} />}
              label={platformLabel(platform)}
              count={count}
              active={activePlatform === platform && filterType === "all"}
              onClick={() => {
                setActivePlatform(platform);
                setFilterType("all");
              }}
            />
          );
        })}

        <div className="px-4 mt-5 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {t("sidebar.library")}
          </span>
        </div>
        {drives.map((drive) => (
          <DriveInfo key={drive.letter} drive={drive} />
        ))}

        {categories.length > 0 && (
          <>
            <div className="px-4 mt-5 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("sidebar.categories")}
              </span>
            </div>
            {categories.map((cat) => (
              <SidebarItem
                key={cat.id}
                id={`sidebar-cat-${cat.id}`}
                icon={<Tag size={18} />}
                label={cat.name}
                active={false}
                onClick={() => {}}
              />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}

function SidebarItem({
  id,
  icon,
  label,
  count,
  active,
  onClick,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  const { ref, isFocused, focusableProps } = useFocusableElement({
    id,
    region: "sidebar",
    onClick,
  });

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors",
        active
          ? "bg-primary-light text-primary font-medium border-l-3 border-primary"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary border-l-3 border-transparent",
        isFocused && "is-focused"
      )}
      {...focusableProps}
    >
      {icon}
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-text-muted tabular-nums">{count}</span>
      )}
    </button>
  );
}
