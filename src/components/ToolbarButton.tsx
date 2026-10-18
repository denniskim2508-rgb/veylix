import type { LucideIcon } from "lucide-react";

interface ToolbarButtonProps {
  icon: LucideIcon;
  tooltip: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ToolbarButton({ icon: Icon, tooltip, isActive, onClick, className = "" }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        p-2 rounded-lg transition-colors
        ${isActive
          ? "bg-white/20 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
        }
        ${className}
      `}
    >
      <Icon size={18} />
    </button>
  );
}
