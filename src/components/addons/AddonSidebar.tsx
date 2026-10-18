import { Monitor, Layout, Library, Database, Puzzle, Package, Bell, Star } from "lucide-react";
import { useAddonStore } from "../../store/addonStore";
import { useFocusableElement } from "../../hooks/useFocusableElement";
import clsx from "clsx";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  all: Package,
  "themes-desktop": Monitor,
  "themes-fullscreen": Layout,
  libraries: Library,
  "metadata-sources": Database,
  generic: Puzzle,
  installed: Star,
  updates: Bell,
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "themes-fullscreen", label: "Themes Fullscreen" },
  { id: "themes-desktop", label: "Themes Desktop" },
  { id: "libraries", label: "Libraries" },
  { id: "metadata-sources", label: "Metadata" },
  { id: "generic", label: "Generic" },
  { id: "divider", label: "" },
  { id: "installed", label: "Installed" },
  { id: "updates", label: "Updates" },
];

export function AddonSidebar() {
  const { activeCategory, setActiveCategory } = useAddonStore();

  return (
    <nav className="py-2">
      {CATEGORIES.map((cat) => {
        if (cat.id === "divider") {
          return <div key={cat.id} className="my-2 border-t border-border" />;
        }

        const Icon = CATEGORY_ICONS[cat.id] || Package;
        const isActive = activeCategory === cat.id;

        return (
          <CategoryItem
            key={cat.id}
            id={cat.id}
            label={cat.label}
            icon={Icon}
            isActive={isActive}
            onClick={() => setActiveCategory(cat.id)}
          />
        );
      })}
    </nav>
  );
}

function CategoryItem({
  id,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  isActive: boolean;
  onClick: () => void;
}) {
  const { ref, isFocused, focusableProps } = useFocusableElement({
    id: `addon-cat-${id}`,
    region: "modal",
    onClick,
  });

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      {...focusableProps}
      className={clsx(
        "w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
        isFocused && "ring-1 ring-inset ring-primary/40"
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
