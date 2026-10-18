import { useAddonStore } from "../../store/addonStore";
import { useFocusableElement } from "../../hooks/useFocusableElement";
import { ADDON_TYPE_LABELS } from "../../types/addon";
import type { AddonCatalogEntry } from "../../types/addon";
import clsx from "clsx";

interface AddonListProps {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export function AddonList({ onSelect, selectedId }: AddonListProps) {
  const { filteredAddons, searchQuery, setSearchQuery } = useAddonStore();
  const addons = filteredAddons();

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border shrink-0">
        <input
          type="text"
          placeholder="Search add-ons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-bg-main text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {addons.length === 0 && (
          <div className="p-4 text-center text-text-muted text-sm">
            No add-ons found.
          </div>
        )}
        {addons.map((addon) => (
          <AddonCard
            key={addon.id}
            addon={addon}
            isSelected={selectedId === addon.id}
            onClick={() => onSelect(addon.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AddonCard({
  addon,
  isSelected,
  onClick,
}: {
  addon: AddonCatalogEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { getAddonState } = useAddonStore();
  const state = getAddonState(addon.id);
  const { ref, isFocused, focusableProps } = useFocusableElement({
    id: `addon-card-${addon.id}`,
    region: "addonlist",
    onClick,
  });

  const stateBadge = () => {
    switch (state) {
      case "enabled":
        return (
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
            Enabled
          </span>
        );
      case "disabled":
        return (
          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
            Disabled
          </span>
        );
      case "update-available":
        return (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
            Update
          </span>
        );
      case "not-installed":
        return null;
      default:
        return null;
    }
  };

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      {...focusableProps}
      className={clsx(
        "w-full px-4 py-3 text-left border-b border-border-light transition-colors",
        isSelected
          ? "bg-primary/10 border-l-3 border-l-primary"
          : "hover:bg-bg-hover",
        isFocused && "ring-1 ring-inset ring-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">
            {addon.name}
          </p>
          <p className="text-xs text-text-muted truncate">
            {addon.author} &middot; {ADDON_TYPE_LABELS[addon.type] || addon.type}
          </p>
        </div>
        {stateBadge()}
      </div>
    </button>
  );
}
