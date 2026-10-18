import { ChevronRight, Check } from "lucide-react";
import type { MenuItemData } from "./menuData";

interface MenuItemProps {
  item: MenuItemData;
  isFocused: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  onRightArrow: () => void;
}

export function MenuItem({ item, isFocused, onMouseEnter, onClick, onRightArrow }: MenuItemProps) {
  if (item.divider) {
    return <div className="my-1 border-t border-border" />;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" && item.submenu) {
      e.preventDefault();
      onRightArrow();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      role="menuitem"
      tabIndex={-1}
      data-menu-item
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={item.disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors
        ${isFocused ? "bg-primary/10 text-primary" : "text-text-primary hover:bg-bg-hover"}
        ${item.disabled ? "opacity-40 cursor-default" : "cursor-pointer"}
      `}
    >
      {item.checked !== undefined && (
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {item.checked && <Check size={14} className="text-primary" />}
        </span>
      )}
      {item.icon && !item.checked !== undefined && (
        <item.icon size={16} className="shrink-0 text-text-muted" />
      )}
      {!item.icon && item.checked === undefined && (
        <span className="w-4 h-4 shrink-0" />
      )}
      <span className="flex-1 text-left truncate">{item.label}</span>
      {item.shortcut && (
        <span className="text-xs text-text-muted ml-4">{item.shortcut}</span>
      )}
      {item.submenu && (
        <ChevronRight size={14} className="text-text-muted shrink-0" />
      )}
    </button>
  );
}
