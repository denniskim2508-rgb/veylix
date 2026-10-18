import { PLATFORM_COLORS, PLATFORM_LABELS } from "../types";
import type { Platform } from "../types";
import { useT } from "../i18n";
import clsx from "clsx";

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const { t } = useT();
  const label =
    platform === "emulator"
      ? t("platform.emulator")
      : platform === "manual"
        ? t("platform.manual")
        : platform === "local"
          ? t("platform.local")
          : PLATFORM_LABELS[platform];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white",
        className
      )}
      style={{ backgroundColor: PLATFORM_COLORS[platform] }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
      {label}
    </span>
  );
}
