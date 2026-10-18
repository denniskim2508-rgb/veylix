import { useEffect, useRef, useCallback } from "react";
import { MenuItem } from "./MenuItem";
import { useMenuNavigation } from "./useMenuNavigation";
import { useFocusableElement } from "../../hooks/useFocusableElement";
import type { MenuItemData } from "./menuData";

interface GameDetailMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  items: MenuItemData[];
}

export function GameDetailMoreMenu({ isOpen, onClose, anchorRef, items }: GameDetailMoreMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const sentinel = useFocusableElement({ id: "detail-more-sentinel", region: "menu" });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const { focusedIndex, setFocusedIndex } = useMenuNavigation({
    items,
    onClose: handleClose,
    onRightArrow: () => {},
    onLeftArrow: () => {},
    containerRef: menuRef,
  });

  useEffect(() => {
    if (!isOpen) setFocusedIndex(0);
  }, [isOpen, setFocusedIndex]);

  // Capture Escape/B at the window level so it closes the menu here instead of
  // falling through to global navigation (which would otherwise pop the page).
  useEffect(() => {
    if (!isOpen) return;
    const capture = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "b" || e.key === "B") {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", capture, { capture: true });
    return () => window.removeEventListener("keydown", capture, { capture: true });
  }, [isOpen, handleClose]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", close);
      return () => document.removeEventListener("mousedown", close);
    }
  }, [isOpen, handleClose, anchorRef]);

  if (!isOpen) return null;

  const rect = anchorRef.current?.getBoundingClientRect();
  const left = rect ? Math.min(rect.right + 4, window.innerWidth - 280) : 20;
  const top = rect ? Math.min(rect.bottom + 4, window.innerHeight - 420) : 60;

  return (
    <>
      <div className="fixed inset-0 z-[69]" onClick={handleClose} />
      <div
        ref={menuRef}
        data-menu-root
        role="menu"
        tabIndex={-1}
        style={{ top, left }}
        className="fixed z-[70] w-64 py-1 bg-bg-card rounded-xl border border-border shadow-2xl overflow-hidden max-h-[calc(100vh-70px)] overflow-y-auto overscroll-contain"
      >
        {items.map((item, index) => (
          <MenuItem
            key={item.id}
            item={item}
            isFocused={focusedIndex === index}
            onMouseEnter={() => setFocusedIndex(index)}
            onClick={() => {
              if (item.action) item.action();
            }}
            onRightArrow={() => {}}
          />
        ))}
        <div
          ref={sentinel.ref as React.RefObject<HTMLDivElement>}
          className="sr-only"
          {...sentinel.focusableProps}
        />
      </div>
    </>
  );
}