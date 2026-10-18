import { useEffect, useRef, useCallback } from "react";
import type { NavigationRegion } from "../types/navigation";
import { useNavigation } from "../components/NavigationProvider";
import { useControllerStore } from "../store/controllerStore";

interface UseFocusableElementOptions {
  id: string;
  region: NavigationRegion;
  onClick?: () => void;
  disabled?: boolean;
}

// Shared scrolling flag — suppresses mouse hover focus during wheel/touchpad scroll
let suppressTimeout: ReturnType<typeof setTimeout> | null = null;
let isScrolling = false;

const SUPPRESS_WINDOW = 250;

function markScrolling() {
  isScrolling = true;
  if (suppressTimeout) clearTimeout(suppressTimeout);
  suppressTimeout = setTimeout(() => { isScrolling = false; }, SUPPRESS_WINDOW);
}

if (typeof window !== "undefined") {
  window.addEventListener("wheel", markScrolling, { passive: true });
  window.addEventListener("touchmove", markScrolling, { passive: true });
  window.addEventListener("pointermove", markScrolling, { passive: true });
}

export function useFocusableElement({ id, region, onClick, disabled }: UseFocusableElementOptions) {
  const { registerElement, unregisterElement, updateElementRect, setFocus, focusedId } = useNavigation();
  const inputMethod = useControllerStore((s) => s.inputMethod);
  const ref = useRef<HTMLElement | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    const updateRect = () => {
      try {
        const r = el.getBoundingClientRect();
        updateElementRect(id, r);
      } catch {
        // element may have been removed from DOM
      }
    };

    registerElement({
      id,
      region,
      element: el,
      onClick: () => onClickRef.current?.(),
      disabled,
      rect: el.getBoundingClientRect(),
      centerX: el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2,
      centerY: el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2,
    });

    updateRect();

    const observer = new ResizeObserver(() => updateRect());
    observer.observe(el);

    // Update positions on scroll (for the stored rect used by focus memory)
    const onScroll = () => updateRect();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      unregisterElement(id);
    };
  }, [id, region, disabled, registerElement, unregisterElement, updateElementRect]);

  const handleMouseEnter = useCallback(() => {
    if (isScrolling) return;
    if (inputMethod === "mouse") return;
    setFocus(id);
  }, [id, inputMethod, setFocus]);

  const isFocused = focusedId === id;

  const focusableProps = {
    tabIndex: disabled ? -1 : 0,
    "data-focus-id": id,
    "data-focus-region": region,
    "data-focused": isFocused || undefined,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onClickRef.current?.();
      }
    },
    onMouseEnter: handleMouseEnter,
    onMouseDown: () => {
      setFocus(id);
    },
  };

  return { ref, isFocused, focusableProps };
}
