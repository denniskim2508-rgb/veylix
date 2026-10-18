import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MenuItem } from "./MenuItem";
import { SubmenuPanel } from "./SubmenuPanel";
import { useMenuNavigation } from "./useMenuNavigation";
import { buildMenuData } from "./menuData";
import type { MenuItemData, MenuContext } from "./menuData";

interface GameHubMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  context: MenuContext;
}

interface OpenSubmenu {
  parentId: string;
  items: MenuItemData[];
  position: { top: number; left: number };
}

export function GameHubMenu({ isOpen, onClose, anchorRef, context }: GameHubMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenu | null>(null);
  const [, setSubmenuStack] = useState<OpenSubmenu[]>([]);

  const menuData = useMemo(() => buildMenuData(context), [
    context.t,
    context.onOpenAddGame,
    context.onOpenScanFolder,
    context.onOpenEmulatedGame,
    context.onOpenEmulators,
    context.onOpenRomScanners,
    context.onOpenLibrarySources,
    context.onOpenMetadataProviders,
    context.onOpenAddons,
    context.onOpenSettings,
    context.onScanLibraries,
    context.onPickRandomGame,
    context.onSwitchFullscreen,
    context.onSetViewMode,
    context.onSetSortBy,
    context.onFilterPlatform,
    context.onClose,
    context.currentViewMode,
    context.currentSortBy,
  ]);

  const closeAllSubmenus = useCallback(() => {
    setOpenSubmenu(null);
    setSubmenuStack([]);
  }, []);

  const handleClose = useCallback(() => {
    closeAllSubmenus();
    onClose();
  }, [closeAllSubmenus, onClose]);

  const { focusedIndex, setFocusedIndex } = useMenuNavigation({
    items: menuData,
    onClose: handleClose,
    onRightArrow: (itemId: string) => {
      const item = menuData.find((i) => i.id === itemId);
      if (item?.submenu && menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const itemIndex = menuData.filter((i) => !i.divider).indexOf(item);
        const itemTop = menuRect.top + 8 + itemIndex * 36;

        const newSubmenu: OpenSubmenu = {
          parentId: itemId,
          items: item.submenu,
          position: { top: itemTop, left: menuRect.right + 4 },
        };

        setSubmenuStack((prev) => [...prev, newSubmenu]);
        setOpenSubmenu(newSubmenu);
      }
    },
    onLeftArrow: () => {
      setSubmenuStack((prev) => {
        const next = prev.slice(0, -1);
        setOpenSubmenu(next.length > 0 ? next[next.length - 1] : null);
        return next;
      });
    },
    containerRef: menuRef,
  });

  useEffect(() => {
    if (!isOpen) {
      closeAllSubmenus();
      setFocusedIndex(0);
    }
  }, [isOpen, closeAllSubmenus, setFocusedIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        const submenuEl = document.querySelector("[data-menu-root]");
        if (submenuEl && submenuEl.contains(target)) return;
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, handleClose, anchorRef]);

  if (!isOpen) return null;

  const menuPosition = anchorRef.current
    ? {
        top: anchorRef.current.getBoundingClientRect().bottom + 4,
        left: anchorRef.current.getBoundingClientRect().left,
      }
    : { top: 56, left: 8 };

  const adjustedTop = Math.min(menuPosition.top, window.innerHeight - 600);
  const adjustedLeft = Math.min(menuPosition.left, window.innerWidth - 300);

  return (
    <>
      <div className="fixed inset-0 z-[49]" onClick={handleClose} />
      <div
        ref={menuRef}
        data-menu-root
        tabIndex={-1}
        style={{ top: adjustedTop, left: adjustedLeft }}
        className="fixed z-50 w-[280px] py-1 bg-bg-card rounded-xl border border-border shadow-2xl overflow-hidden max-h-[calc(100vh-70px)] overflow-y-auto overscroll-contain"
      >
        {menuData.map((item, index) => (
          <MenuItem
            key={item.id}
            item={item}
            isFocused={focusedIndex === index}
            onMouseEnter={() => {
              setFocusedIndex(index);
              if (item.submenu && menuRef.current) {
                const menuRect = menuRef.current.getBoundingClientRect();
                const visibleIndex = menuData.filter((i) => !i.divider).indexOf(item);
                const itemTop = menuRect.top + 8 + visibleIndex * 36;

                const newSubmenu: OpenSubmenu = {
                  parentId: item.id,
                  items: item.submenu,
                  position: { top: itemTop, left: menuRect.right + 4 },
                };
                setSubmenuStack([newSubmenu]);
                setOpenSubmenu(newSubmenu);
              } else if (!item.submenu) {
                closeAllSubmenus();
              }
            }}
            onClick={() => {
              if (item.action) item.action();
              else if (item.submenu && menuRef.current) {
                const menuRect = menuRef.current.getBoundingClientRect();
                const visibleIndex = menuData.filter((i) => !i.divider).indexOf(item);
                const itemTop = menuRect.top + 8 + visibleIndex * 36;

                const newSubmenu: OpenSubmenu = {
                  parentId: item.id,
                  items: item.submenu,
                  position: { top: itemTop, left: menuRect.right + 4 },
                };
                setSubmenuStack([newSubmenu]);
                setOpenSubmenu(newSubmenu);
              }
            }}
            onRightArrow={() => {
              if (item.submenu && menuRef.current) {
                const menuRect = menuRef.current.getBoundingClientRect();
                const visibleIndex = menuData.filter((i) => !i.divider).indexOf(item);
                const itemTop = menuRect.top + 8 + visibleIndex * 36;

                const newSubmenu: OpenSubmenu = {
                  parentId: item.id,
                  items: item.submenu,
                  position: { top: itemTop, left: menuRect.right + 4 },
                };
                setSubmenuStack([newSubmenu]);
                setOpenSubmenu(newSubmenu);
              }
            }}
          />
        ))}
      </div>
      {openSubmenu && (
        <SubmenuPanel
          key={openSubmenu.parentId}
          items={openSubmenu.items}
          position={openSubmenu.position}
          onClose={handleClose}
          onRightArrow={(childId) => {
            const child = openSubmenu.items.find((i) => i.id === childId);
            if (child?.submenu) {
              const newSubmenu: OpenSubmenu = {
                parentId: childId,
                items: child.submenu,
                position: {
                  top: openSubmenu.position.top + openSubmenu.items.filter((i) => !i.divider).indexOf(child) * 36,
                  left: openSubmenu.position.left + 240,
                },
              };
              setSubmenuStack((prev) => [...prev, newSubmenu]);
              setOpenSubmenu(newSubmenu);
            }
          }}
          onLeftArrow={() => {
            setOpenSubmenu(null);
          }}
        />
      )}
    </>
  );
}
