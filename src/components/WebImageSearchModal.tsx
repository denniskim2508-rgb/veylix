import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Search,
  Loader2,
  AlertCircle,
  Check,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ShieldOff,
  ImageOff,
  ChevronDown,
} from "lucide-react";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import type { WebImageResult, WebImageSearchPage } from "../types";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

type ArtworkKind = "cover" | "background" | "logo" | "icon";
type Engine = "bing" | "google" | "duckduckgo";

const ENGINE_LABELS: Record<Engine, string> = {
  bing: "Bing Images",
  google: "Google Images",
  duckduckgo: "DuckDuckGo Images",
};

const ARTWORK_ASPECT: Record<ArtworkKind, string> = {
  cover: "aspect-[3/4]",
  background: "aspect-video",
  logo: "aspect-[3/1]",
  icon: "aspect-square",
};

const RESOLUTION_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Any size", w: 0, h: 0 },
  { label: "At least 512 × 512", w: 512, h: 512 },
  { label: "At least 1280 × 720", w: 1280, h: 720 },
  { label: "At least 1920 × 1080", w: 1920, h: 1080 },
];

function queryPresets(gameName: string): { label: string; query: string }[] {
  const n = gameName.trim();
  return [
    { label: "Game Cover", query: `${n} game cover art` },
    { label: "Game Icon", query: `${n} game icon` },
    { label: "Transparent Logo", query: `${n} official logo transparent PNG` },
    { label: "Hero Background", query: `${n} wallpaper 1920x1080` },
    { label: "Official Artwork", query: `${n} official promotional artwork` },
  ];
}

function formatDimensions(w: number, h: number): string {
  if (!w || !h) return "Dimensions unknown";
  return `${w} × ${h} px`;
}

/** A single gallery card. Own component so the focus hook can be used per item. */
function ThumbCard({
  result,
  aspect,
  selected,
  onSelect,
}: {
  result: WebImageResult;
  aspect: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState(result.thumbnailUrl || result.sourceUrl);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  const focus = useFocusableElement({
    id: `wimg-thumb-${result.id}`,
    region: "modal",
    onClick: onSelect,
  });

  const handleError = () => {
    if (src !== result.sourceUrl && result.sourceUrl) {
      setSrc(result.sourceUrl);
      setStatus("loading");
    } else {
      setStatus("error");
    }
  };

  return (
    <button
      ref={focus.ref as React.RefObject<HTMLButtonElement>}
      onClick={onSelect}
      {...focus.focusableProps}
      className={`group relative rounded-xl border overflow-hidden bg-bg-main text-left transition-colors ${
        selected ? "border-primary ring-2 ring-primary/60" : "border-border hover:border-primary/50"
      } ${focus.isFocused ? "is-focused" : ""}`}
    >
      <div className={`relative w-full ${aspect} bg-bg-hover flex items-center justify-center`}>
        {status === "error" ? (
          <div className="flex flex-col items-center gap-1 text-text-muted">
            <ImageOff size={22} />
            <span className="text-[10px]">Preview unavailable</span>
          </div>
        ) : (
          <>
            <img
              src={src}
              alt={result.title || "result"}
              loading="lazy"
              onLoad={() => setStatus("ok")}
              onError={handleError}
              className="w-full h-full object-contain"
            />
            {status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 size={18} className="animate-spin text-text-muted" />
              </div>
            )}
          </>
        )}
        {selected && (
          <div className="absolute top-2 right-2 p-1 rounded-full bg-primary text-white shadow">
            <Check size={12} />
          </div>
        )}
      </div>
      <div className="px-2.5 py-1.5 border-t border-border/60 flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-secondary tabular-nums truncate">
          {formatDimensions(result.width, result.height)}
        </span>
        {result.format && result.format !== "unknown" && (
          <span className="text-[10px] uppercase text-text-muted">{result.format}</span>
        )}
      </div>
    </button>
  );
}

interface WebImageSearchModalProps {
  gameName: string;
  artworkType: ArtworkKind;
  /** Downloads and applies the chosen full-size image. Reject to keep the dialog open. */
  onSelect: (result: WebImageResult) => Promise<void>;
  onClose: () => void;
}

export function WebImageSearchModal({
  gameName,
  artworkType,
  onSelect,
  onClose,
}: WebImageSearchModalProps) {
  const { t } = useT();
  const [query, setQuery] = useState(gameName);
  const [engine, setEngine] = useState<Engine>("bing");
  const [safeSearch, setSafeSearch] = useState(true);
  const [transparent, setTransparent] = useState(artworkType === "logo");
  const [minWidth, setMinWidth] = useState(0);
  const [minHeight, setMinHeight] = useState(0);

  const [results, setResults] = useState<WebImageResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [selected, setSelected] = useState<WebImageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const [maximized, setMaximized] = useState(false);
  const [size, setSize] = useState(() => ({
    w: Math.min(1040, window.innerWidth - 48),
    h: Math.min(760, window.innerHeight - 48),
  }));
  const dragRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const closeFocus = useFocusableElement({ id: "wimg-close", region: "modal", onClick: onClose });
  const maxFocus = useFocusableElement({
    id: "wimg-maximize",
    region: "modal",
    onClick: () => setMaximized((m) => !m),
  });
  const searchFocus = useFocusableElement({ id: "wimg-search", region: "modal", onClick: () => runSearch(1, false) });
  const safeFocus = useFocusableElement({
    id: "wimg-safe",
    region: "modal",
    onClick: () => setSafeSearch((s) => !s),
  });
  const transparentFocus = useFocusableElement({
    id: "wimg-transparent",
    region: "modal",
    onClick: () => setTransparent((t) => !t),
  });
  const loadMoreFocus = useFocusableElement({
    id: "wimg-loadmore",
    region: "modal",
    onClick: () => runSearch(page + 1, true),
  });
  const selectFocus = useFocusableElement({
    id: "wimg-select",
    region: "modal",
    onClick: () => handleConfirm(),
  });
  const cancelFocus = useFocusableElement({ id: "wimg-cancel", region: "modal", onClick: onClose });

  const runSearch = useCallback(
    async (targetPage: number, append: boolean) => {
      const q = query.trim();
      if (!q) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const res = await invoke<WebImageSearchPage>("web_image_search", {
          query: q,
          engine,
          safeSearch,
          transparent,
          minWidth: minWidth > 0 ? minWidth : null,
          minHeight: minHeight > 0 ? minHeight : null,
          page: targetPage,
        });
        setResults((prev) => (append ? [...prev, ...res.results] : res.results));
        setHasMore(res.hasMore);
        setPage(res.page);
        setNote(res.note);
        if (!append) setSelected(null);
        setSearched(true);

        // Some engines (e.g. Bing) do not report dimensions in their results.
        // Read them from the image itself so the resolution filter and labels work.
        const missing = res.results
          .filter((r) => (!r.width || !r.height) && r.sourceUrl)
          .slice(0, 30);
        if (missing.length > 0) {
          invoke<(number[] | null)[]>("web_image_probe_sizes", {
            urls: missing.map((r) => r.sourceUrl),
          })
            .then((sizes) => {
              const dims = new Map<string, { w: number; h: number }>();
              missing.forEach((r, i) => {
                const s = sizes[i];
                if (s && s.length === 2) dims.set(r.id, { w: s[0], h: s[1] });
              });
              if (dims.size === 0) return;
              setResults((prev) => {
                const updated = prev.map((r) => {
                  const d = dims.get(r.id);
                  return d ? { ...r, width: d.w, height: d.h } : r;
                });
                if (!minWidth && !minHeight) return updated;
                return updated.filter((r) => {
                  const known = r.width > 0 && r.height > 0;
                  if (!known) return true;
                  return (!minWidth || r.width >= minWidth) && (!minHeight || r.height >= minHeight);
                });
              });
            })
            .catch(() => {
              /* dimension probing is best-effort */
            });
        }
      } catch (err) {
        setError(String(err));
        if (!append) {
          setResults([]);
          setSelected(null);
        }
        setSearched(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, engine, safeSearch, transparent, minWidth, minHeight],
  );

  const handleConfirm = useCallback(async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSelect(selected);
      onClose();
    } catch (err) {
      setError(
        `Could not download the full-size image. ${String(err)} Pick another result or retry.`,
      );
    } finally {
      setSaving(false);
    }
  }, [selected, saving, onSelect, onClose]);

  // Seed the query from the artwork type, then run an initial search.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = await invoke<string>("web_image_search_query", { gameName, artworkType });
        if (!cancelled && q) setQuery(q);
      } catch {
        /* keep the game name as the query */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameName, artworkType]);

  useEffect(() => {
    runSearch(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cancels the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Keep the dialog within the window on resize.
  useEffect(() => {
    const onResize = () => {
      setSize((s) => ({
        w: Math.min(s.w, window.innerWidth - 24),
        h: Math.min(s.h, window.innerHeight - 24),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Corner drag-resize.
  const onResizeStart = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const w = Math.max(680, Math.min(window.innerWidth - 24, d.w + (e.clientX - d.x)));
    const h = Math.max(480, Math.min(window.innerHeight - 24, d.h + (e.clientY - d.y)));
    setSize({ w, h });
  };
  const onResizeEnd = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const boxStyle = maximized
    ? { width: "calc(100vw - 24px)", height: "calc(100vh - 24px)" }
    : { width: size.w, height: size.h };

  const aspect = ARTWORK_ASPECT[artworkType];
  const presets = queryPresets(gameName);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col"
        style={boxStyle}
      >
        {/* A. Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-semibold text-text-primary">Web Image Search</h2>
            <span className="text-xs text-text-muted truncate">
              {artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} for “{gameName}”
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              ref={maxFocus.ref as React.RefObject<HTMLButtonElement>}
              onClick={() => setMaximized((m) => !m)}
              title={maximized ? "Restore" : "Maximize"}
              className={`p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary ${maxFocus.isFocused ? "is-focused" : ""}`}
              {...maxFocus.focusableProps}
            >
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              ref={closeFocus.ref as React.RefObject<HTMLButtonElement>}
              onClick={onClose}
              title={t("common.close")}
              className={`p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary ${closeFocus.isFocused ? "is-focused" : ""}`}
              {...closeFocus.focusableProps}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* B. Gallery */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}
          {note && !error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-hover/60 border border-border mb-3">
              <AlertCircle size={14} className="text-text-muted shrink-0" />
              <p className="text-[11px] text-text-muted">{note}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">Searching {ENGINE_LABELS[engine]}…</p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
              >
                {results.map((r) => (
                  <ThumbCard
                    key={r.id}
                    result={r}
                    aspect={aspect}
                    selected={selected?.id === r.id}
                    onSelect={() => setSelected(r)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <button
                    ref={loadMoreFocus.ref as React.RefObject<HTMLButtonElement>}
                    onClick={() => runSearch(page + 1, true)}
                    disabled={loadingMore}
                    className={`px-5 py-2 rounded-xl text-sm font-medium bg-bg-hover hover:bg-border text-text-primary transition-colors disabled:opacity-50 ${loadMoreFocus.isFocused ? "is-focused" : ""}`}
                    {...loadMoreFocus.focusableProps}
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Loading…
                      </span>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}
            </>
          ) : searched ? (
            <div className="flex flex-col items-center justify-center py-20 text-text-muted">
              <Search size={32} className="mb-3 opacity-40" />
              <p className="text-sm">{error ? "Search failed." : "No results found."}</p>
              <p className="text-xs mt-1">Try a different query, engine, or resolution filter.</p>
            </div>
          ) : null}
        </div>

        {/* Preview of the selected result (thumbnail only — full-size on Select) */}
        {selected && (
          <div className="shrink-0 border-t border-border bg-bg-main/60 px-4 py-2.5 flex items-center gap-3">
            <img
              src={selected.thumbnailUrl || selected.sourceUrl}
              alt={selected.title || "preview"}
              className="h-16 w-28 object-contain rounded-lg bg-bg-hover border border-border"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-primary truncate">
                {selected.title || selected.sourceUrl}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {formatDimensions(selected.width, selected.height)}
                {selected.format && selected.format !== "unknown" ? ` · ${selected.format.toUpperCase()}` : ""}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">
                Preview is the search thumbnail. The full-size image is downloaded only when you press Select.
              </p>
            </div>
          </div>
        )}

        {/* C. Controls */}
        <div className="shrink-0 border-t border-border px-4 py-3 space-y-3">
          {/* Row 1 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              ref={searchFocus.ref as React.RefObject<HTMLButtonElement>}
              onClick={() => runSearch(1, false)}
              disabled={loading || !query.trim()}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50 ${searchFocus.isFocused ? "is-focused" : ""}`}
              {...searchFocus.focusableProps}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Search
            </button>

            <div className="relative">
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as Engine)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                title="Search engine"
              >
                <option value="bing">Bing</option>
                <option value="google">Google</option>
                <option value="duckduckgo">DuckDuckGo</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch(1, false);
              }}
              placeholder={`Search images for “${gameName}”…`}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Resolution</span>
              <input
                type="number"
                min={0}
                value={minWidth || ""}
                onChange={(e) => setMinWidth(Number(e.target.value) || 0)}
                placeholder="min W"
                className="w-20 px-2 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-text-muted">×</span>
              <input
                type="number"
                min={0}
                value={minHeight || ""}
                onChange={(e) => setMinHeight(Number(e.target.value) || 0)}
                placeholder="min H"
                className="w-20 px-2 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="relative">
                <select
                  value={`${minWidth}x${minHeight}`}
                  onChange={(e) => {
                    const p = RESOLUTION_PRESETS.find(
                      (r) => `${r.w}x${r.h}` === e.target.value,
                    );
                    if (p) {
                      setMinWidth(p.w);
                      setMinHeight(p.h);
                    }
                  }}
                  className="appearance-none pl-2 pr-6 py-2 rounded-xl bg-bg-main border border-border text-text-secondary text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                  title="Resolution presets"
                >
                  {RESOLUTION_PRESETS.map((r) => (
                    <option key={r.label} value={`${r.w}x${r.h}`}>
                      {r.label}
                    </option>
                  ))}
                  {!RESOLUTION_PRESETS.some((r) => `${r.w}x${r.h}` === `${minWidth}x${minHeight}`) && (
                    <option value={`${minWidth}x${minHeight}`}>Custom</option>
                  )}
                </select>
                <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
              </div>
            </div>

            <div className="relative">
              <select
                defaultValue=""
                onChange={(e) => {
                  const p = presets.find((x) => x.label === e.target.value);
                  if (p) setQuery(p.query);
                  e.target.value = "";
                }}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-bg-main border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                title="Query presets"
              >
                <option value="" disabled>
                  Presets
                </option>
                {presets.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
            </div>
          </div>

          {/* Row 2 + actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              ref={safeFocus.ref as React.RefObject<HTMLButtonElement>}
              onClick={() => setSafeSearch((s) => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                safeSearch
                  ? "border-primary/40 bg-primary/10 text-text-primary"
                  : "border-border bg-bg-main text-text-secondary"
              } ${safeFocus.isFocused ? "is-focused" : ""}`}
              {...safeFocus.focusableProps}
            >
              {safeSearch ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
              SafeSearch {safeSearch ? "On" : "Off"}
            </button>

            <button
              ref={transparentFocus.ref as React.RefObject<HTMLButtonElement>}
              onClick={() => setTransparent((t) => !t)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                transparent
                  ? "border-primary/40 bg-primary/10 text-text-primary"
                  : "border-border bg-bg-main text-text-secondary"
              } ${transparentFocus.isFocused ? "is-focused" : ""}`}
              {...transparentFocus.focusableProps}
            >
              <span
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                  transparent ? "bg-primary border-primary text-white" : "border-border"
                }`}
              >
                {transparent && <Check size={10} />}
              </span>
              Transparent
            </button>

            <div className="flex-1" />

            <button
              ref={selectFocus.ref as React.RefObject<HTMLButtonElement>}
              onClick={handleConfirm}
              disabled={!selected || saving}
              className={`px-5 py-2 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-40 ${selectFocus.isFocused ? "is-focused" : ""}`}
              {...selectFocus.focusableProps}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {t("common.saving")}
                </span>
              ) : (
                t("common.select")
              )}
            </button>
            <button
              ref={cancelFocus.ref as React.RefObject<HTMLButtonElement>}
              onClick={onClose}
              className={`px-5 py-2 rounded-xl text-sm font-medium bg-bg-hover hover:bg-border text-text-primary transition-colors ${cancelFocus.isFocused ? "is-focused" : ""}`}
              {...cancelFocus.focusableProps}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>

        {/* Resize handle */}
        {!maximized && (
          <div
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            style={{ touchAction: "none" }}
            title="Resize"
          />
        )}
      </div>
    </div>
  );
}
