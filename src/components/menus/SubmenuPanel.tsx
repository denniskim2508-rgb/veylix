import { useEffect, useRef } from "react";
import { MenuItem } from "./MenuItem";
import { useMenuNavigation } from "./useMenuNavigation";
import type { MenuItemData } from "./menuData";

interface SubmenuPanelProps {
  items: MenuItemData[];
  position: { top: number; left: number };
  onClose: () => void;
  onRightArrow: (itemId: string) => void;
  onLeftArrow: () => void;
}

export function SubmenuPanel({
  items,
  position,
  onClose,
  onRightArrow,
  onLeftArrow,
}: SubmenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const { focusedIndex, setFocusedIndex } = useMenuNavigation({
    items,
    onClose,
    onRightArrow,
    onLeftArrow,
    containerRef: panelRef,
  });

  useEffect(() => {
    setFocusedIndex(0);
  }, [items, setFocusedIndex]);

  const adjustedLeft = Math.min(position.left, window.innerWidth - 280);

  return (
    <div
      ref={panelRef}
      data-menu-root
      tabIndex={-1}
      style={{ top: position.top, left: adjustedLeft }}
      className="fixed z-[60] min-w-[220px] max-w-[280px] py-1 bg-bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
      onMouseLeave={() => {}}
    >
      {items.map((item, index) => (
        <MenuItem
          key={item.id}
          item={item}
          isFocused={focusedIndex === index}
          onMouseEnter={() => setFocusedIndex(index)}
          onClick={() => {
            if (item.action) item.action();
            else if (item.submenu) onRightArrow(item.id);
          }}
          onRightArrow={() => onRightArrow(item.id)}
        />
      ))}
    </div>
  );
}
