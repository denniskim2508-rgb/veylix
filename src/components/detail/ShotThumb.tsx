import { useState, useEffect } from "react";
import { ImageOff } from "lucide-react";
import { useFocusableElement } from "../../hooks/useFocusableElement";
import type { NavigationRegion } from "../../types/navigation";
import type { ScreenshotItem } from "../../utils/screenshots";
import clsx from "clsx";

export function ShotThumb({
  shot,
  resolvedUrl,
  index,
  onOpen,
  region = "gamedetail",
  idPrefix = "detail",
}: {
  shot: ScreenshotItem;
  resolvedUrl: string | undefined;
  index: number;
  onOpen: (index: number) => void;
  region?: NavigationRegion;
  idPrefix?: string;
}) {
  const { ref, isFocused, focusableProps } = useFocusableElement({
    id: `${idPrefix}-ss-${shot.source}-${shot.id}`,
    region,
    onClick: () => onOpen(index),
  });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [resolvedUrl]);

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={() => onOpen(index)}
      className={clsx(
        "relative shrink-0 w-56 h-32 rounded-lg overflow-hidden border border-border bg-bg-hover transition-all duration-150",
        isFocused && "is-focused"
      )}
      {...focusableProps}
    >
      {resolvedUrl && !failed ? (
        <img src={resolvedUrl} alt={`Screenshot ${index + 1}`} onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-text-muted">
          <ImageOff size={20} />
        </span>
      )}
    </button>
  );
}