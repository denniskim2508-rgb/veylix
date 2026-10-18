import { useState } from "react";
import { X, FolderOpen, FileCode, Gamepad2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import type { Platform } from "../types";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function openFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: true,
    multiple: false,
    title: "Select Game Folder",
  });
  if (typeof result === "string") return result;
  if (result === null) return null;
  return null;
}

async function openFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    title: "Select Game Executable",
    filters: [
      { name: "Executables", extensions: ["exe", "bat", "cmd", "lnk"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (typeof result === "string") return result;
  if (result === null) return null;
  return null;
}

interface AddGameModalProps {
  onClose: () => void;
}

export function AddGameModal({ onClose }: AddGameModalProps) {
  const { addGame } = useStore();
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("manual");
  const [installPath, setInstallPath] = useState("");
  const [executablePath, setExecutablePath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeBtn = useFocusableElement({ id: "addgame-close", region: "modal", onClick: onClose });
  const cancelBtn = useFocusableElement({ id: "addgame-cancel", region: "modal", onClick: onClose });
  const submitBtn = useFocusableElement({
    id: "addgame-submit",
    region: "modal",
    onClick: () => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent);
    },
  });

  const handleFolderPick = async () => {
    const folder = await openFolder();
    if (folder) {
      setInstallPath(folder);
      if (!title.trim()) {
        const folderName = folder.split(/[\\/]/).pop() || "";
        setTitle(folderName);
      }
    }
  };

  const handleFilePick = async () => {
    const file = await openFile();
    if (file) {
      setExecutablePath(file);
      if (!installPath) {
        const parts = file.split(/[\\/]/);
        parts.pop();
        setInstallPath(parts.join("\\"));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const id = await invoke<number>("add_game", {
        title: title.trim(),
        platform,
        installPath: installPath || null,
        executablePath: executablePath || null,
        platformGameId: null,
        launchCommand: executablePath || null,
      });

      addGame({
        id,
        title: title.trim(),
        platform,
        installPath: installPath || null,
        executablePath: executablePath || null,
        coverImage: null,
        backgroundImage: null,
        description: null,
        releaseDate: null,
        genre: null,
        developer: null,
        publisher: null,
        playTime: 0,
        lastPlayed: null,
        isInstalled: true,
        isFavorite: false,
        platformGameId: null,
        launchCommand: executablePath || null,
        driveLetter: installPath?.charAt(0) || null,
        icon: null,
        logo: null,
        trailerPath: null,
        trailerSource: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      onClose();
    } catch (err) {
      console.error("Failed to add game:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Gamepad2 size={20} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Add Game</h2>
          </div>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-bg-hover text-text-muted transition-colors ${closeBtn.isFocused ? "is-focused" : ""}`}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Game Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter game title"
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-main text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Platform
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg-main text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="manual">Manual</option>
              <option value="steam">Steam</option>
              <option value="epic">Epic Games</option>
              <option value="gog">GOG</option>
              <option value="ea">EA App</option>
              <option value="ubisoft">Ubisoft Connect</option>
              <option value="battlenet">Battle.net</option>
              <option value="rockstar">Rockstar</option>
              <option value="xbox">Xbox</option>
              <option value="emulator">Emulator</option>
              <option value="local">Local</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Install Location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={installPath}
                onChange={(e) => setInstallPath(e.target.value)}
                placeholder="C:\Games\MyGame"
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-bg-main text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={handleFolderPick}
                className="px-3 py-2.5 rounded-lg border border-border bg-bg-main hover:bg-bg-hover text-text-secondary transition-colors"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Executable Path (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={executablePath}
                onChange={(e) => setExecutablePath(e.target.value)}
                placeholder="C:\Games\MyGame\game.exe"
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-bg-main text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={handleFilePick}
                className="px-3 py-2.5 rounded-lg border border-border bg-bg-main hover:bg-bg-hover text-text-secondary transition-colors"
              >
                <FileCode size={18} />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              ref={cancelBtn.ref as React.RefObject<HTMLButtonElement>}
              type="button"
              onClick={onClose}
              className={`flex-1 px-4 py-2.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors ${cancelBtn.isFocused ? "is-focused" : ""}`}
              {...cancelBtn.focusableProps}
            >
              {t("common.cancel")}
            </button>
            <button
              ref={submitBtn.ref as React.RefObject<HTMLButtonElement>}
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className={`flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${submitBtn.isFocused ? "is-focused" : ""}`}
              {...submitBtn.focusableProps}
            >
              {isSubmitting ? t("common.saving") : t("menu.addGame")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
