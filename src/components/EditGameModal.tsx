import { useState, useEffect } from "react";
import { X, Upload, Trash2, Search, Image as ImageIcon } from "lucide-react";
import type { Game, ArtworkSearchResult } from "../types";
import { useStore } from "../store/useStore";
import { ArtworkSearchModal } from "./ArtworkSearchModal";
import { resolveArtworkUrl } from "../utils/artwork";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface EditGameModalProps {
  game: Game;
  onClose: () => void;
}

type ArtworkType = "cover" | "background" | "icon" | "logo";

const ARTWORK_LABELS: Record<ArtworkType, string> = {
  cover: "Cover Image",
  background: "Background Image",
  icon: "Icon",
  logo: "Logo",
};

export function EditGameModal({ game, onClose }: EditGameModalProps) {
  const updateGame = useStore((s) => s.updateGame);
  const setSelectedGame = useStore((s) => s.setSelectedGame);
  const { t } = useT();
  const [form, setForm] = useState({
    title: game.title,
    description: game.description || "",
    genre: game.genre || "",
    developer: game.developer || "",
    publisher: game.publisher || "",
    releaseDate: game.releaseDate || "",
  });
  const [artwork, setArtwork] = useState({
    cover: game.coverImage,
    background: game.backgroundImage,
    icon: game.icon,
    logo: game.logo,
  });
  const [resolvedArtwork, setResolvedArtwork] = useState<Record<string, string | null>>({});
  const [searchModal, setSearchModal] = useState<ArtworkType | null>(null);
  const [uploading, setUploading] = useState<ArtworkType | null>(null);
  const [saving, setSaving] = useState(false);
  const closeBtn = useFocusableElement({ id: "editgame-close", region: "modal", onClick: onClose });
  const cancelBtn = useFocusableElement({ id: "editgame-cancel", region: "modal", onClick: onClose });

  useEffect(() => {
    (Object.keys(artwork) as ArtworkType[]).forEach((type) => {
      resolveArtworkUrl(artwork[type as keyof typeof artwork]).then((url) => {
        setResolvedArtwork((prev) => ({ ...prev, [type]: url }));
      });
    });
  }, [artwork.cover, artwork.background, artwork.icon, artwork.logo]);

  const applyUpdate = (updates: Partial<Game>) => {
    updateGame(game.id, updates);
    setSelectedGame({ ...game, ...updates });
  };

  const handleUpload = async (type: ArtworkType) => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });

    if (result) {
      setUploading(type);
      try {
        const path = typeof result === "string" ? result : result;
        const relativePath = await invoke<string>("upload_artwork", {
          gameId: game.id,
          artworkType: type,
          filePath: path,
        });
        setArtwork((prev) => ({ ...prev, [type]: relativePath }));
        applyUpdate({ [type === "cover" ? "coverImage" : type === "background" ? "backgroundImage" : type]: relativePath });
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(null);
      }
    }
  };

  const handleRemove = async (type: ArtworkType) => {
    try {
      await invoke("remove_artwork", { gameId: game.id, artworkType: type });
      setArtwork((prev) => ({ ...prev, [type]: null }));
      applyUpdate({ [type === "cover" ? "coverImage" : type === "background" ? "backgroundImage" : type]: null });
    } catch (err) {
      console.error("Remove failed:", err);
    }
  };

  const handleSearchSelect = async (type: ArtworkType, result: ArtworkSearchResult) => {
    setSearchModal(null);
    setUploading(type);
    try {
      const relativePath = await invoke<string>("download_artwork_url", {
        url: result.sourceUrl,
        gameId: game.id,
        artworkType: type,
      });
      setArtwork((prev) => ({ ...prev, [type]: relativePath }));
      applyUpdate({ [type === "cover" ? "coverImage" : type === "background" ? "backgroundImage" : type]: relativePath });
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("update_game", {
        gameId: game.id,
        update: {
          title: form.title || undefined,
          description: form.description || undefined,
          genre: form.genre || undefined,
          developer: form.developer || undefined,
          publisher: form.publisher || undefined,
          releaseDate: form.releaseDate || undefined,
        },
      });
      applyUpdate({
        title: form.title,
        description: form.description,
        genre: form.genre,
        developer: form.developer,
        publisher: form.publisher,
        releaseDate: form.releaseDate,
      });
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const saveBtn = useFocusableElement({ id: "editgame-save", region: "modal", onClick: handleSave });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Edit Game</h2>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary ${closeBtn.isFocused ? "is-focused" : ""}`}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-6 space-y-8">
          {/* Artwork Section */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">Artwork</h3>
            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(ARTWORK_LABELS) as ArtworkType[]).map((type) => (
                <div key={type} className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">{ARTWORK_LABELS[type]}</label>
                  <div className="relative group">
                    <div className={`rounded-xl border-2 border-dashed border-border bg-bg-main overflow-hidden ${
                      type === "cover" ? "aspect-[3/4]" : type === "background" ? "aspect-video" : "aspect-square"
                    }`}>
                      {resolvedArtwork[type] ? (
                        <img
                          src={resolvedArtwork[type]!}
                          alt={ARTWORK_LABELS[type]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={24} className="text-text-muted" />
                        </div>
                      )}
                      {uploading === type && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleUpload(type)}
                        className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                        title="Upload file"
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        onClick={() => setSearchModal(type)}
                        className="p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
                        title="Search online"
                      >
                        <Search size={14} />
                      </button>
                      {artwork[type as keyof typeof artwork] && (
                        <button
                          onClick={() => handleRemove(type)}
                          className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-600 transition-colors"
                          title={t("common.remove")}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata Section */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">Metadata</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Genre</label>
                  <input
                    type="text"
                    value={form.genre}
                    onChange={(e) => setForm((p) => ({ ...p, genre: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Release Date</label>
                  <input
                    type="text"
                    value={form.releaseDate}
                    onChange={(e) => setForm((p) => ({ ...p, releaseDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Developer</label>
                  <input
                    type="text"
                    value={form.developer}
                    onChange={(e) => setForm((p) => ({ ...p, developer: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Publisher</label>
                  <input
                    type="text"
                    value={form.publisher}
                    onChange={(e) => setForm((p) => ({ ...p, publisher: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            ref={cancelBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors ${cancelBtn.isFocused ? "is-focused" : ""}`}
            {...cancelBtn.focusableProps}
          >
            {t("common.cancel")}
          </button>
          <button
            ref={saveBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 ${saveBtn.isFocused ? "is-focused" : ""}`}
            {...saveBtn.focusableProps}
          >
            {saving ? t("common.saving") : t("common.save")}
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
    </div>
  );
}
