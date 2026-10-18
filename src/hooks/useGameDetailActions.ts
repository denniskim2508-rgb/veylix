import { useState } from "react";
import {
  Pencil,
  Image as ImageIcon,
  Play,
  RefreshCw,
  ImagePlus,
  FolderOpen,
  Clapperboard,
  Trash2,
} from "lucide-react";
import type { Game, EmulatorProfile } from "../types";
import type { MenuItemData } from "../components/menus/menuData";
import { useStore } from "../store/useStore";
import { useT } from "../i18n";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export interface BuildMoreItemsOptions {
  isEmulatorGame: boolean;
  emulators: EmulatorProfile[];
  onMenuClose: () => void;
  onOpenEdit: () => void;
  onOpenScreenshots: () => void;
  onOpenManageArtwork: () => void;
  onOpenManageTrailer: () => void;
  onDelete: () => void;
}

export function useGameDetailActions(game: Game | null) {
  const setGames = useStore((s) => s.setGames);
  const setSelectedGame = useStore((s) => s.setSelectedGame);
  const { t } = useT();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefreshMetadata() {
    if (!game) return;
    setRefreshing(true);
    try {
      await invoke("resolve_all_artwork", { gameId: game.id });
      await invoke("resolve_game_metadata", { gameId: game.id });
      const allGames = await invoke<Game[]>("get_games");
      const fresh = allGames.find((g) => g.id === game.id) || game;
      setGames(allGames);
      setSelectedGame(fresh);
    } catch (err) {
      console.error("Metadata refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleOpenFolder() {
    if (!game) return;
    try {
      const dir = game.installPath || (game.executablePath ? game.executablePath.replace(/[\\/][^\\/]*$/, "") : null);
      if (!dir) return;
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(dir);
    } catch (err) {
      console.error("Open folder failed:", err);
    }
  }

  async function handleLaunchWith(emulator: EmulatorProfile) {
    if (!game) return;
    try {
      const corePath = emulator.corePath || "";
      const template = emulator.commandTemplate || `"${emulator.executablePath}" "{{rom}}"`;
      const args = emulator.defaultArgs || "";
      const romPath = game.installPath || "";
      const launchCommand = template
        .replace("{{emulator}}", emulator.executablePath)
        .replace("{{rom}}", romPath)
        .replace("{{default_args}}", args)
        .replace("{{core}}", corePath);
      await invoke("launch_game", {
        launchCommand,
        executablePath: null,
      });
    } catch (err) {
      console.error("Launch failed:", err);
    }
  }

  function buildMoreItems({
    isEmulatorGame,
    emulators,
    onMenuClose,
    onOpenEdit,
    onOpenScreenshots,
    onOpenManageArtwork,
    onOpenManageTrailer,
    onDelete,
  }: BuildMoreItemsOptions): MenuItemData[] {
    return [
      { id: "more-edit", label: t("menu.editGame"), icon: Pencil, action: () => { onMenuClose(); onOpenEdit(); } },
      { id: "more-screenshots", label: t("menu.manageScreenshots"), icon: ImageIcon, action: () => { onMenuClose(); onOpenScreenshots(); } },
      { id: "more-trailer", label: t("menu.manageTrailer"), icon: Clapperboard, action: () => { onMenuClose(); onOpenManageTrailer(); } },
      ...(isEmulatorGame && emulators.length > 0
        ? [
            { id: "more-launch-divider", label: "", divider: true } as MenuItemData,
            { id: "more-launch-header", label: t("menu.launchWith"), disabled: true } as MenuItemData,
            ...emulators.map(
              (emu) =>
                ({
                  id: `more-launch-${emu.id}`,
                  label: emu.name,
                  icon: Play,
                  action: () => { onMenuClose(); handleLaunchWith(emu); },
                }) as MenuItemData
            ),
          ]
        : []),
      { id: "more-divider-1", label: "", divider: true },
      { id: "more-refresh", label: t("menu.refreshMetadata"), icon: RefreshCw, action: () => { onMenuClose(); handleRefreshMetadata(); } },
      { id: "more-artwork", label: t("menu.manageArtwork"), icon: ImagePlus, action: () => { onMenuClose(); onOpenManageArtwork(); } },
      { id: "more-open-folder", label: t("menu.openGameFolder"), icon: FolderOpen, disabled: !game?.installPath && !game?.executablePath, action: () => { onMenuClose(); handleOpenFolder(); } },
      { id: "more-divider-2", label: "", divider: true },
      { id: "more-remove", label: t("menu.removeFromLibrary"), icon: Trash2, action: () => { onMenuClose(); if (window.confirm(t("menu.removeConfirm"))) onDelete(); } },
    ];
  }

  return { refreshing, handleRefreshMetadata, handleOpenFolder, handleLaunchWith, buildMoreItems };
}