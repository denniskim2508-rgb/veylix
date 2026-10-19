import type { LucideIcon } from "lucide-react";
import type { Platform, SortBy, ViewMode } from "../../types";
import type { TFn } from "../../i18n";

export interface MenuItemData {
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  action?: () => void;
  submenu?: MenuItemData[];
  divider?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

export interface MenuContext {
  t: TFn;
  onOpenAddGame: () => void;
  onOpenScanFolder: () => void;
  onOpenEmulatedGame: () => void;
  onOpenEmulators: () => void;
  onOpenRomScanners: () => void;
  onOpenLibrarySources: () => void;
  onOpenMetadataProviders: () => void;
  onOpenAddons: () => void;
  onOpenSettings: () => void;
  onCheckForUpdates: () => void;
  onScanLibraries: () => void;
  onPickRandomGame: () => void;
  onSwitchFullscreen: () => void;
  onSwitchConsole: () => void;
  onSetViewMode: (mode: ViewMode) => void;
  onSetSortBy: (sort: SortBy) => void;
  onFilterPlatform: (platform: Platform) => void;
  onClose: () => void;
  currentViewMode: ViewMode;
  currentSortBy: SortBy;
}

export function buildMenuData(ctx: MenuContext): MenuItemData[] {
  const t = ctx.t;
  return [
    {
      id: "add-game",
      label: t("menu.addGame"),
      submenu: [
        {
          id: "add-manually",
          label: t("menu.addManually"),
          action: () => { ctx.onOpenAddGame(); ctx.onClose(); },
        },
        {
          id: "scan-folder",
          label: t("menu.scanFolder"),
          action: () => { ctx.onOpenScanFolder(); ctx.onClose(); },
        },
        {
          id: "add-emulated",
          label: t("menu.addEmulatedGame"),
          action: () => { ctx.onOpenEmulatedGame(); ctx.onClose(); },
        },
      ],
    },
    {
      id: "library",
      label: t("menu.library"),
      submenu: [
        {
          id: "configure-emulators",
          label: t("menu.configureEmulators"),
          action: () => { ctx.onOpenEmulators(); ctx.onClose(); },
        },
        {
          id: "rom-scanners",
          label: t("menu.romScanners"),
          action: () => { ctx.onOpenRomScanners(); ctx.onClose(); },
        },
        {
          id: "library-sources",
          label: t("menu.librarySources"),
          action: () => { ctx.onOpenLibrarySources(); ctx.onClose(); },
        },
        {
          id: "metadata-providers",
          label: t("menu.metadataProviders"),
          action: () => { ctx.onOpenMetadataProviders(); ctx.onClose(); },
        },
      ],
    },
    {
      id: "update-library",
      label: t("menu.updateLibrary"),
      shortcut: "F5",
      action: () => { ctx.onScanLibraries(); ctx.onClose(); },
    },
    {
      id: "random-game",
      label: t("menu.pickRandomGame"),
      shortcut: "Ctrl+R",
      action: () => { ctx.onPickRandomGame(); ctx.onClose(); },
    },
    {
      id: "addons",
      label: t("menu.addons"),
      action: () => { ctx.onOpenAddons(); ctx.onClose(); },
    },
    {
      id: "settings",
      label: t("menu.settings"),
      action: () => { ctx.onOpenSettings(); ctx.onClose(); },
    },
    { id: "divider-1", label: "", divider: true },
    {
      id: "view",
      label: t("menu.view"),
      submenu: [
        {
          id: "view-grid",
          label: t("menu.gridView"),
          checked: ctx.currentViewMode === "grid",
          action: () => { ctx.onSetViewMode("grid"); ctx.onClose(); },
        },
        {
          id: "view-list",
          label: t("menu.listView"),
          checked: ctx.currentViewMode === "list",
          action: () => { ctx.onSetViewMode("list"); ctx.onClose(); },
        },
        {
          id: "view-details",
          label: t("menu.detailsView"),
          checked: ctx.currentViewMode === "details",
          action: () => { ctx.onSetViewMode("details"); ctx.onClose(); },
        },
        { id: "view-divider", label: "", divider: true },
        {
          id: "sort-by",
          label: t("menu.sortBy"),
          submenu: [
            { id: "sort-title", label: t("menu.sortName"), checked: ctx.currentSortBy === "title", action: () => { ctx.onSetSortBy("title"); ctx.onClose(); } },
            { id: "sort-last-played", label: t("menu.sortLastPlayed"), checked: ctx.currentSortBy === "lastPlayed", action: () => { ctx.onSetSortBy("lastPlayed"); ctx.onClose(); } },
            { id: "sort-play-time", label: t("menu.sortPlayTime"), checked: ctx.currentSortBy === "playTime", action: () => { ctx.onSetSortBy("playTime"); ctx.onClose(); } },
            { id: "sort-platform", label: t("menu.sortPlatform"), checked: ctx.currentSortBy === "platform", action: () => { ctx.onSetSortBy("platform"); ctx.onClose(); } },
          ],
        },
      ],
    },
    {
      id: "third-party",
      label: t("menu.thirdPartyClients"),
      submenu: [
        { id: "filter-steam", label: "Steam", action: () => { ctx.onFilterPlatform("steam"); ctx.onClose(); } },
        { id: "filter-epic", label: "Epic Games", action: () => { ctx.onFilterPlatform("epic"); ctx.onClose(); } },
        { id: "filter-gog", label: "GOG", action: () => { ctx.onFilterPlatform("gog"); ctx.onClose(); } },
        { id: "filter-ea", label: "EA App", action: () => { ctx.onFilterPlatform("ea"); ctx.onClose(); } },
        { id: "filter-ubisoft", label: "Ubisoft Connect", action: () => { ctx.onFilterPlatform("ubisoft"); ctx.onClose(); } },
        { id: "filter-battlenet", label: "Battle.net", action: () => { ctx.onFilterPlatform("battlenet"); ctx.onClose(); } },
        { id: "filter-rockstar", label: "Rockstar", action: () => { ctx.onFilterPlatform("rockstar"); ctx.onClose(); } },
        { id: "filter-xbox", label: "Xbox", action: () => { ctx.onFilterPlatform("xbox"); ctx.onClose(); } },
      ],
    },
    {
      id: "extensions",
      label: t("menu.extensions"),
      submenu: [
        { id: "extensions-placeholder", label: t("menu.noExtensionsInstalled"), disabled: true },
      ],
    },
    { id: "divider-2", label: "", divider: true },
    {
      id: "fullscreen",
      label: t("menu.switchToFullscreen"),
      shortcut: "F11",
      action: () => { ctx.onSwitchFullscreen(); ctx.onClose(); },
    },
    {
      id: "console-mode",
      label: t("menu.switchToConsoleMode"),
      shortcut: "Ctrl+C",
      action: () => { ctx.onSwitchConsole(); ctx.onClose(); },
    },
    { id: "divider-3", label: "", divider: true },
    {
      id: "links",
      label: t("menu.links"),
      submenu: [
        { id: "link-github", label: "GitHub", action: () => { window.open("https://github.com", "_blank"); ctx.onClose(); } },
        { id: "link-docs", label: t("menu.documentation"), action: () => { ctx.onClose(); } },
        { id: "link-issue", label: t("menu.reportIssue"), action: () => { window.open("https://github.com/issues", "_blank"); ctx.onClose(); } },
      ],
    },
    {
      id: "help",
      label: t("menu.help"),
      action: () => { ctx.onClose(); },
    },
    {
      id: "about",
      label: t("menu.aboutGamehub"),
      action: () => { ctx.onClose(); },
    },
    {
      id: "updates",
      label: t("menu.checkForUpdates"),
      action: () => { ctx.onCheckForUpdates(); ctx.onClose(); },
    },
  ];
}
