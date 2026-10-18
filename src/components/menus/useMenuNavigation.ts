import { useState, useCallback, useEffect, useRef } from "react";
import type { MenuItemData } from "./menuData";

interface UseMenuNavigationOptions {
  items: MenuItemData[];
  onClose: () => void;
  onRightArrow: (itemId: string) => void;
  onLeftArrow: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useMenuNavigation({
  items,
  onClose,
  onRightArrow,
  onLeftArrow,
  containerRef,
}: UseMenuNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const visibleItems = items.filter((item) => !item.divider);

  const focusItem = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, visibleItems.length - 1));
      setFocusedIndex(clamped);
    },
    [visibleItems.length]
  );

  const activateItem = useCallback(
    (index: number) => {
      const item = visibleItems[index];
      if (item && !item.disabled && !item.divider) {
        if (item.action) {
          item.action();
        } else if (item.submenu) {
          onRightArrow(item.id);
        }
      }
    },
    [visibleItems, onRightArrow]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const menuEl = containerRef.current;
      if (!menuEl || !menuEl.contains(document.activeElement) || !menuEl.closest("[data-menu-root]")) {
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          let next = focusedIndex + 1;
          while (next < items.length && items[next]?.divider) {
            next++;
          }
          if (next >= items.length) {
            next = items.findIndex((item) => !item.divider);
          }
          focusItem(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          let prev = focusedIndex - 1;
          while (prev >= 0 && items[prev]?.divider) {
            prev--;
          }
          if (prev < 0) {
            const lastNonDivider = items.length - 1;
            prev = lastNonDivider;
            while (prev > 0 && items[prev]?.divider) {
              prev--;
            }
          }
          focusItem(prev);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const focusedItem = visibleItems[focusedIndex];
          if (focusedItem?.submenu) {
            onRightArrow(focusedItem.id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          onLeftArrow();
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          activateItem(focusedIndex);
          break;
        }
        case "Escape":
        case "b":
        case "B": {
          e.preventDefault();
          onClose();
          break;
        }
        case "Home": {
          e.preventDefault();
          focusItem(0);
          break;
        }
        case "End": {
          e.preventDefault();
          focusItem(items.length - 1);
          break;
        }
      }
    },
    [focusedIndex, items, visibleItems, focusItem, activateItem, onRightArrow, onLeftArrow, onClose, containerRef]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    focusedIndex,
    setFocusedIndex,
    itemRefs,
  };
}
