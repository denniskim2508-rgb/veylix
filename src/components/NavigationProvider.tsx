import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { GamehubAction } from "../types/controller";
import type { NavigationRegion, FocusableElement, FocusStackEntry } from "../types/navigation";

interface NavigationContextValue {
  activeRegion: NavigationRegion;
  focusedId: string | null;
  focusStack: FocusStackEntry[];
  registerElement: (el: FocusableElement) => void;
  unregisterElement: (id: string) => void;
  updateElementRect: (id: string, rect: DOMRect) => void;
  setFocus: (id: string) => void;
  setActiveRegion: (region: NavigationRegion) => void;
  pushStack: (region: NavigationRegion, focusedId: string | null, selectedGameId?: number | null) => void;
  goBack: () => boolean;
  handleAction: (action: GamehubAction) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

const REGION_ORDER: NavigationRegion[] = [
  "sidebar",
  "hero",
  "gamegrid",
  "toolbar",
  "library",
  "detailhero",
  "detailmeta",
  "detaildesc",
  "detailss",
];

const CONTAINER_TRANSITIONS: Partial<Record<NavigationRegion, Partial<Record<"up" | "down" | "left" | "right", NavigationRegion>>>> = {
  hero: { down: "gamegrid" },
  gamegrid: { up: "hero" },
  library: { right: "detailhero" },
  detailhero: { left: "library", down: "detailmeta" },
  detailmeta: { left: "library", up: "detailhero", down: "detaildesc" },
  detaildesc: { left: "library", up: "detailmeta", down: "detailss" },
  detailss: { left: "library", up: "detaildesc" },
  modal: { right: "addondetail" },
  addonlist: { right: "addondetail" },
  addondetail: { left: "addonlist" },
};

// Read fresh DOMRect from the live element, falling back to stored rect
function freshRect(el: FocusableElement): DOMRect {
  try {
    return el.element.getBoundingClientRect();
  } catch {
    return el.rect;
  }
}

function findBestCandidate(
  elements: FocusableElement[],
  current: FocusableElement,
  direction: "up" | "down" | "left" | "right",
): FocusableElement | null {
  // Read FRESH positions for current element
  const curRect = freshRect(current);
  const cx = curRect.left + curRect.width / 2;
  const cy = curRect.top + curRect.height / 2;
  const currentTop = curRect.top;
  const currentBottom = curRect.bottom;
  const currentLeft = curRect.left;
  const currentRight = curRect.right;
  const currentHeight = currentBottom - currentTop;
  const currentWidth = currentRight - currentLeft;

  const candidates = elements
    .filter((el) => el.id !== current.id)
    .map((el) => {
      // Read FRESH position for each candidate
      const r = freshRect(el);
      const elCx = r.left + r.width / 2;
      const elCy = r.top + r.height / 2;
      const dx = elCx - cx;
      const dy = elCy - cy;
      return { el, dx, dy, r };
    })
    .filter(({ dx, dy }) => {
      switch (direction) {
        case "right": return dx > 5;
        case "left": return dx < -5;
        case "down": return dy > 5;
        case "up": return dy < -5;
      }
    });

  if (candidates.length === 0) return null;

  if (direction === "right" || direction === "left") {
    const sameRow = candidates.filter(({ r }) => {
      const elTop = r.top;
      const elBottom = r.bottom;
      return (
        elTop < currentBottom - currentHeight * 0.3 &&
        elBottom > currentTop + currentHeight * 0.3
      );
    });
    const pool = sameRow.length > 0 ? sameRow : candidates;
    pool.sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx));
    return pool[0].el;
  }

  if (direction === "down" || direction === "up") {
    const sameCol = candidates.filter(({ r }) => {
      const elLeft = r.left;
      const elRight = r.right;
      return (
        elLeft < currentRight - currentWidth * 0.3 &&
        elRight > currentLeft + currentWidth * 0.3
      );
    });
    const pool = sameCol.length > 0 ? sameCol : candidates;
    pool.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy));
    return pool[0].el;
  }

  return null;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeRegion, setActiveRegion] = useState<NavigationRegion>("gamegrid");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusStackRef = useRef<FocusStackEntry[]>([]);
  const [, forceRender] = useState(0);

  const elementsRef = useRef<Map<string, FocusableElement>>(new Map());
  const lastFocusedPerRegion = useRef<Map<NavigationRegion, string | null>>(new Map());

  const registerElement = useCallback((el: FocusableElement) => {
    elementsRef.current.set(el.id, el);
  }, []);

  const unregisterElement = useCallback((id: string) => {
    elementsRef.current.delete(id);
  }, []);

  const updateElementRect = useCallback((id: string, rect: DOMRect) => {
    const el = elementsRef.current.get(id);
    if (el) {
      el.rect = rect;
      el.centerX = rect.left + rect.width / 2;
      el.centerY = rect.top + rect.height / 2;
    }
  }, []);

  const getRegionElements = useCallback((region: NavigationRegion): FocusableElement[] => {
    const els: FocusableElement[] = [];
    elementsRef.current.forEach((el) => {
      if (el.region === region && !el.disabled) {
        els.push(el);
      }
    });
    return els;
  }, []);

  const setFocus = useCallback((id: string) => {
    const el = elementsRef.current.get(id);
    if (el) {
      setActiveRegion(el.region);
      setFocusedId(id);
      lastFocusedPerRegion.current.set(el.region, id);
    }
  }, []);

  const focusElement = useCallback((id: string) => {
    const el = elementsRef.current.get(id);
    if (el && el.element) {
      el.element.focus();
      el.element.scrollIntoView({ behavior: "auto", block: "nearest" });
      setFocusedId(id);
      lastFocusedPerRegion.current.set(el.region, id);

      if (import.meta.env.DEV) {
        console.log(`[Nav] focus: ${id} (region=${el.region})`);
      }
    }
  }, []);

  const moveFocus = useCallback((direction: "up" | "down" | "left" | "right") => {
    const regionEls = getRegionElements(activeRegion);
    if (regionEls.length === 0) {
      const transition = CONTAINER_TRANSITIONS[activeRegion]?.[direction];
      if (transition) {
        const targetEls = getRegionElements(transition);
        if (targetEls.length > 0) {
          const remembered = lastFocusedPerRegion.current.get(transition);
          const target = remembered && targetEls.find((e) => e.id === remembered)
            ? targetEls.find((e) => e.id === remembered)!
            : targetEls[0];
          setActiveRegion(transition);
          focusElement(target.id);
          if (import.meta.env.DEV) {
            console.log(`[Nav] ${direction}: container transition ${activeRegion} → ${transition}, focus ${target.id}`);
          }
        }
      }
      return;
    }

    if (!focusedId) {
      const first = regionEls[0];
      if (first) {
        focusElement(first.id);
        if (import.meta.env.DEV) {
          console.log(`[Nav] ${direction}: no focus → ${first.id}`);
        }
      }
      return;
    }

    const current = elementsRef.current.get(focusedId);
    if (!current || current.region !== activeRegion) {
      const first = regionEls[0];
      if (first) focusElement(first.id);
      return;
    }

    const best = findBestCandidate(regionEls, current, direction);

    if (best) {
      if (import.meta.env.DEV) {
        console.log(`[Nav] ${direction}: ${current.id} → ${best.id} (same region)`, {
          candidates: regionEls.map((e) => e.id),
        });
      }
      focusElement(best.id);
      return;
    }

    // No candidate in current region — try container transition
    const transition = CONTAINER_TRANSITIONS[activeRegion]?.[direction];
    if (transition) {
      const targetEls = getRegionElements(transition);
      if (targetEls.length > 0) {
        const remembered = lastFocusedPerRegion.current.get(transition);
        let target: FocusableElement;
        if (remembered && targetEls.find((e) => e.id === remembered)) {
          target = targetEls.find((e) => e.id === remembered)!;
        } else {
          const curRect = freshRect(current);
          const cx = curRect.left + curRect.width / 2;
          const cy = curRect.top + curRect.height / 2;
          const withDist = targetEls.map((el) => {
            const r = freshRect(el);
            const elCx = r.left + r.width / 2;
            const elCy = r.top + r.height / 2;
            return {
              el,
              dist: Math.sqrt(Math.pow(elCx - cx, 2) + Math.pow(elCy - cy, 2)),
            };
          });
          withDist.sort((a, b) => a.dist - b.dist);
          target = withDist[0].el;
        }
        if (import.meta.env.DEV) {
          console.log(`[Nav] ${direction}: container transition ${activeRegion} → ${transition}, focus ${target.id}`);
        }
        setActiveRegion(transition);
        focusElement(target.id);
      }
    } else {
      if (import.meta.env.DEV) {
        console.log(`[Nav] ${direction}: ${current.id} → (no candidate, no transition)`, {
          candidates: regionEls.map((e) => e.id),
        });
      }
    }
  }, [activeRegion, focusedId, getRegionElements, focusElement]);

  const activate = useCallback(() => {
    if (!focusedId) return;
    const el = elementsRef.current.get(focusedId);
    if (el && el.onClick) {
      el.onClick();
    }
  }, [focusedId]);

  const pushStack = useCallback((
    region: NavigationRegion,
    fid: string | null,
    selectedGameId?: number | null,
  ) => {
    focusStackRef.current = [
      ...focusStackRef.current,
      { region, focusedId: fid, selectedGameId },
    ];
    forceRender((n) => n + 1);
  }, []);

  const goBack = useCallback((): boolean => {
    if (focusStackRef.current.length === 0) return false;

    const entry = focusStackRef.current[focusStackRef.current.length - 1];
    focusStackRef.current = focusStackRef.current.slice(0, -1);
    forceRender((n) => n + 1);

    setActiveRegion(entry.region);
    if (entry.focusedId) {
      const el = elementsRef.current.get(entry.focusedId);
      if (el) {
        setFocusedId(entry.focusedId);
        el.element?.focus();
      }
    }
    return true;
  }, []);

  const cycleRegions = useCallback((direction: "forward" | "backward") => {
    const idx = REGION_ORDER.indexOf(activeRegion);
    const nextIdx = direction === "forward"
      ? (idx + 1) % REGION_ORDER.length
      : (idx - 1 + REGION_ORDER.length) % REGION_ORDER.length;
    const nextRegion = REGION_ORDER[nextIdx];
    setActiveRegion(nextRegion);
    const els = getRegionElements(nextRegion);
    if (els.length > 0) {
      const remembered = lastFocusedPerRegion.current.get(nextRegion);
      const target = remembered && els.find((e) => e.id === remembered)
        ? els.find((e) => e.id === remembered)!
        : els[0];
      focusElement(target.id);
    }
  }, [activeRegion, getRegionElements, focusElement]);

  const handleAction = useCallback((action: GamehubAction) => {
    switch (action) {
      case "up":
        moveFocus("up");
        break;
      case "down":
        moveFocus("down");
        break;
      case "left":
        if (activeRegion === "toolbar") {
          cycleRegions("backward");
        } else {
          moveFocus("left");
        }
        break;
      case "right":
        if (activeRegion === "sidebar") {
          cycleRegions("forward");
        } else {
          moveFocus("right");
        }
        break;
      case "confirm":
        activate();
        break;
      case "cancel":
        goBack();
        break;
      case "leftShoulder":
        cycleRegions("backward");
        break;
      case "rightShoulder":
        cycleRegions("forward");
        break;
    }
  }, [activeRegion, moveFocus, activate, goBack, cycleRegions]);

  return (
    <NavigationContext.Provider
      value={{
        activeRegion,
        focusedId,
        focusStack: focusStackRef.current,
        registerElement,
        unregisterElement,
        updateElementRect,
        setFocus,
        setActiveRegion,
        pushStack,
        goBack,
        handleAction,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}
