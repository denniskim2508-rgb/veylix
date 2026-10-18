import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useFocusableElement } from "../../hooks/useFocusableElement";
import type { NavigationRegion } from "../../types/navigation";
import type { ScreenshotItem } from "../../utils/screenshots";

export function ScreenshotLightbox({
  items,
  index,
  resolved,
  onClose,
  onNav,
  region = "gamedetail",
  idPrefix = "lightbox",
}: {
  items: ScreenshotItem[];
  index: number;
  resolved: Record<string, string>;
  onClose: () => void;
  onNav: (next: number) => void;
  region?: NavigationRegion;
  idPrefix?: string;
}) {
  const prevBtn = useFocusableElement({ id: `${idPrefix}-prev`, region, onClick: () => onNav((index - 1 + items.length) % items.length) });
  const nextBtn = useFocusableElement({ id: `${idPrefix}-next`, region, onClick: () => onNav((index + 1) % items.length) });
  const closeBtn = useFocusableElement({ id: `${idPrefix}-close`, region, onClick: onClose });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "b" || e.key === "B") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onNav((index - 1 + items.length) % items.length);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onNav((index + 1) % items.length);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [index, items.length, onClose, onNav]);

  const item = items[index];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 animate-fade-in">
      <button
        ref={prevBtn.ref as React.RefObject<HTMLButtonElement>}
        onClick={() => onNav((index - 1 + items.length) % items.length)}
        className={`absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ${prevBtn.isFocused ? "is-focused" : ""}`}
        {...prevBtn.focusableProps}
      >
        <ChevronLeft size={26} />
      </button>
      <button
        ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
        onClick={onClose}
        className={`absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ${closeBtn.isFocused ? "is-focused" : ""}`}
        {...closeBtn.focusableProps}
      >
        <X size={24} />
      </button>
      {item && resolved[item.url] && (
        <img key={item.id} src={resolved[item.url]} alt={`Screenshot ${index + 1}`} className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl border border-border" />
      )}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">{index + 1} / {items.length}</p>
      <button
        ref={nextBtn.ref as React.RefObject<HTMLButtonElement>}
        onClick={() => onNav((index + 1) % items.length)}
        className={`absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ${nextBtn.isFocused ? "is-focused" : ""}`}
        {...nextBtn.focusableProps}
      >
        <ChevronRight size={26} />
      </button>
    </div>
  );
}