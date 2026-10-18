import { useState, useEffect } from "react";
import { X, Search, Download, Loader2, AlertCircle } from "lucide-react";
import { useFocusableElement } from "../hooks/useFocusableElement";
import type { ArtworkSearchResult } from "../types";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

function ResultThumb({ result }: { result: ArtworkSearchResult }) {
  const [src, setSrc] = useState<string>(result.thumbnailUrl || result.sourceUrl);

  return (
    <img
      src={src}
      alt={result.title}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => {
        if (src !== result.sourceUrl) {
          setSrc(result.sourceUrl);
        }
      }}
    />
  );
}

interface ArtworkSearchModalProps {
  gameName: string;
  artworkType: string;
  onSelect: (result: ArtworkSearchResult) => void;
  onClose: () => void;
}

export function ArtworkSearchModal({ gameName, artworkType, onSelect, onClose }: ArtworkSearchModalProps) {
  const [query, setQuery] = useState(gameName);
  const [results, setResults] = useState<ArtworkSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const closeBtn = useFocusableElement({ id: "artworksearch-close", region: "modal", onClick: onClose });

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setError("");
    try {
      const res = await invoke<ArtworkSearchResult[]>("search_artwork_online", {
        gameName: query,
        artworkType,
      });
      setResults(res);
      setSearched(true);
    } catch (err) {
      setError(String(err));
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[80vh] bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Search Artwork</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} for "{gameName}"
            </p>
          </div>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary ${closeBtn.isFocused ? "is-focused" : ""}`}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search game name..."
              className="flex-1 px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">Searching IGDB...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(r)}
                  className="group relative rounded-xl border border-border overflow-hidden bg-bg-main hover:border-primary/50 transition-colors text-left"
                >
                  <div className="aspect-video bg-bg-hover">
                    <ResultThumb result={r} />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-text-primary truncate">{r.title}</p>
                    <p className="text-xs text-text-muted">{r.width}x{r.height} - {r.provider}</p>
                  </div>
                  <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="p-3 rounded-full bg-primary text-white">
                      <Download size={20} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searched ? (
            error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-500">{error}</p>
                </div>
                <p className="text-xs text-text-muted">Check your IGDB settings in Metadata Providers.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                <Search size={32} className="mb-3 opacity-40" />
                <p className="text-sm">No results found.</p>
                <p className="text-xs mt-1">Try a different search term.</p>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
