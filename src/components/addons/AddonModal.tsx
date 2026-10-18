import { useEffect } from "react";
import { X, FolderOpen } from "lucide-react";
import { useAddonStore } from "../../store/addonStore";
import { useFocusableElement } from "../../hooks/useFocusableElement";
import { AddonSidebar } from "./AddonSidebar";
import { AddonList } from "./AddonList";
import { AddonDetail } from "./AddonDetail";

interface AddonModalProps {
  onClose: () => void;
  catalogUrl?: string;
}

export function AddonModal({ onClose, catalogUrl }: AddonModalProps) {
  const {
    loadCatalog,
    loadLocalCatalog,
    loadDefaultCatalog,
    loadInstalled,
    selectAddon,
    selectedAddonId,
    catalog,
    isLoading,
    error,
    setCatalogUrl,
  } = useAddonStore();

  const closeBtn = useFocusableElement({
    id: "addon-close",
    region: "modal",
    onClick: onClose,
  });

  const handleBrowse = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({
        multiple: false,
        title: "Select Catalog JSON",
        filters: [
          { name: "JSON", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      let path: string | null = null;
      if (typeof result === "string") path = result;
      else if (result !== null) path = null;
      if (path) {
        loadLocalCatalog(path);
      }
    } catch (err) {
      console.error("Failed to open file picker:", err);
    }
  };

  const browseBtn = useFocusableElement({
    id: "addon-browse",
    region: "modal",
    onClick: handleBrowse,
  });

  useEffect(() => {
    const url = catalogUrl || useAddonStore.getState().catalogUrl;
    if (url) {
      setCatalogUrl(url);
      loadCatalog(url);
    } else {
      loadDefaultCatalog();
    }
    loadInstalled();
  }, [catalogUrl, loadCatalog, loadDefaultCatalog, loadInstalled, setCatalogUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add-ons"
        className="w-full max-w-5xl max-h-[90vh] bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-text-primary">Add-ons</h2>
          <div className="flex items-center gap-2">
            <button
              ref={browseBtn.ref as React.RefObject<HTMLButtonElement>}
              onClick={handleBrowse}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
              {...browseBtn.focusableProps}
            >
              <FolderOpen size={14} />
              Browse Catalog
            </button>
            <button
              ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
              {...closeBtn.focusableProps}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Sidebar */}
          <div className="w-48 border-r border-border shrink-0 overflow-y-auto overscroll-contain">
            <AddonSidebar />
          </div>

          {/* Center: List */}
          <div className="w-72 border-r border-border shrink-0 overflow-y-auto overscroll-contain">
            <AddonList onSelect={selectAddon} selectedId={selectedAddonId} />
          </div>

          {/* Right: Detail */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <AddonDetail />
          </div>
        </div>

        {/* Footer */}
        {(isLoading || error) && (
          <div className="px-6 py-3 border-t border-border shrink-0">
            {isLoading && (
              <p className="text-sm text-text-muted">Loading...</p>
            )}
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
        )}

        {!catalog && !isLoading && (
          <div className="px-6 py-8 border-t border-border shrink-0 text-center">
            <p className="text-text-muted text-sm mb-2">No catalog configured.</p>
            <p className="text-text-muted text-xs">
              Set a catalog URL in Settings, or click "Browse Catalog" to load a local JSON file.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
