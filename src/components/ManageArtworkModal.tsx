import { useState, useEffect } from "react";
import { X, Upload, Search, Trash2, Image as ImageIcon, Globe } from "lucide-react";
import type { Game, ArtworkSearchResult, WebImageResult } from "../types";
import { useStore } from "../store/useStore";
import { ArtworkSearchModal } from "./ArtworkSearchModal";
import { WebImageSearchModal } from "./WebImageSearchModal";
import { resolveArtworkUrl } from "../utils/artwork";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

type ArtworkKind = "cover" | "background" | "logo" | "icon";

const ARTWORK_LABELS: Record<ArtworkKind, string> = {
  cover: "Cover Image",
  background: "Background Image",
  logo: "Logo",
  icon: "Icon",
};

const ARTWORK_ASPECT: Record<ArtworkKind, string> = {
  cover: "aspect-[3/4]",
  background: "aspect-video",
  logo: "aspect-[3/1]",
  icon: "aspect-square",
};

const FIELD_KEY: Record<ArtworkKind, keyof Game> = {
  cover: "coverImage",
  background: "backgroundImage",
  logo: "logo",
  icon: "icon",
};

interface ManageArtworkModalProps {
  game: Game;
  onClose: () => void;
}

export function ManageArtworkModal({ game, onClose }: ManageArtworkModalProps) {
  const updateGame = useStore((s) => s.updateGame);
  const setSelectedGame = useStore((s) => s.setSelectedGame);
  const { t } = useT();
  const [artwork, setArtwork] = useState({
    cover: game.coverImage,
    background: game.backgroundImage,
    logo: game.logo,
    icon: game.icon,
  });
  const [resolvedArtwork, setResolvedArtwork] = useState<Record<string, string | null>>({});
  const [searchModal, setSearchModal] = useState<ArtworkKind | null>(null);
  const [webSearchModal, setWebSearchModal] = useState<ArtworkKind | null>(null);
  const [uploading, setUploading] = useState<ArtworkKind | null>(null);
  const closeBtn = useFocusableElement({ id: "manageart-close", region: "modal", onClick: onClose });
  const doneBtn = useFocusableElement({ id: "manageart-done", region: "modal", onClick: onClose });

  useEffect(() => {
    (Object.keys(artwork) as ArtworkKind[]).forEach((kind) => {
      resolveArtworkUrl(artwork[kind]).then((url) => {
        setResolvedArtwork((prev) => ({ ...prev, [kind]: url }));
      });
    });
  }, [artwork]);

  const applyUpdate = (updates: Partial<Game>) => {
    updateGame(game.id, updates);
    setSelectedGame({ ...game, ...updates });
  };

  const handleUpload = async (kind: ArtworkKind) => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });
    if (!result) return;
    setUploading(kind);
    try {
      const filePath = typeof result === "string" ? result : result;
      const relativePath = await invoke<string>("upload_artwork", {
        gameId: game.id,
        artworkType: kind,
        filePath,
      });
      setArtwork((prev) => ({ ...prev, [kind]: relativePath }));
      applyUpdate({ [FIELD_KEY[kind]]: relativePath } as Partial<Game>);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(null);
    }
  };

  const handleSearchSelect = async (kind: ArtworkKind, result: ArtworkSearchResult) => {
    setSearchModal(null);
    setUploading(kind);
    try {
      const relativePath = await invoke<string>("download_artwork_url", {
        url: result.sourceUrl,
        gameId: game.id,
        artworkType: kind,
      });
      setArtwork((prev) => ({ ...prev, [kind]: relativePath }));
      applyUpdate({ [FIELD_KEY[kind]]: relativePath } as Partial<Game>);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setUploading(null);
    }
  };

  const handleWebSelect = async (kind: ArtworkKind, result: WebImageResult) => {
    setUploading(kind);
    try {
      const relativePath = await invoke<string>("download_artwork_url", {
        url: result.sourceUrl,
        gameId: game.id,
        artworkType: kind,
      });
      setArtwork((prev) => ({ ...prev, [kind]: relativePath }));
      applyUpdate({ [FIELD_KEY[kind]]: relativePath } as Partial<Game>);
    } catch (err) {
      // Re-throw so the web search dialog stays open and shows the error,
      // letting the user pick another result or retry.
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (kind: ArtworkKind) => {
    try {
      await invoke("remove_artwork", { gameId: game.id, artworkType: kind });
      setArtwork((prev) => ({ ...prev, [kind]: null }));
      applyUpdate({ [FIELD_KEY[kind]]: null } as Partial<Game>);
    } catch (err) {
      console.error("Remove failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">{game.title}</h2>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary ${closeBtn.isFocused ? "is-focused" : ""}`}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">Manage Artwork</h3>
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(ARTWORK_LABELS) as ArtworkKind[]).map((kind) => (
              <div key={kind} className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">{ARTWORK_LABELS[kind]}</label>
                <div className="relative group">
                  <div
                    className={`rounded-xl border-2 border-dashed border-border bg-bg-main overflow-hidden ${ARTWORK_ASPECT[kind]}`}
                  >
                    {resolvedArtwork[kind] ? (
                      <img src={resolvedArtwork[kind]!} alt={ARTWORK_LABELS[kind]} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={24} className="text-text-muted" />
                      </div>
                    )}
                    {uploading === kind && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleUpload(kind)}
                      className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Upload file"
                    >
                      <Upload size={14} />
                    </button>
                    <button
                      onClick={() => setSearchModal(kind)}
                      className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Search online"
                    >
                      <Search size={14} />
                    </button>
                    {artwork[kind] && (
                      <button
                        onClick={() => handleRemove(kind)}
                        className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-600 transition-colors"
                        title={t("common.remove")}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setWebSearchModal(kind)}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-bg-main hover:bg-bg-hover text-xs text-text-secondary hover:text-text-primary transition-colors"
                  title="Search Google and DuckDuckGo for images"
                >
                  <Globe size={13} />
                  Search Online
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-border">
          <button
            ref={doneBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`px-6 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors ${doneBtn.isFocused ? "is-focused" : ""}`}
            {...doneBtn.focusableProps}
          >
            {t("common.done")}
          </button>
        </div>
      </div>

      {searchModal && (
        <ArtworkSearchModal
          gameName={game.title}
          artworkType={searchModal}
          onSelect={(result) => handleSearchSelect(searchModal, result)}
          onClose={() => setSearchModal(null)}
        />
      )}

      {webSearchModal && (
        <WebImageSearchModal
          gameName={game.title}
          artworkType={webSearchModal}
          onSelect={(result) => handleWebSelect(webSearchModal, result)}
          onClose={() => setWebSearchModal(null)}
        />
      )}
    </div>
  );
}