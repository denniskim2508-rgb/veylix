import { HardDrive } from "lucide-react";
import type { Drive } from "../types";
import { useT } from "../i18n";

interface DriveInfoProps {
  drive: Drive;
}

export function DriveInfo({ drive }: DriveInfoProps) {
  const { t } = useT();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return t("format.sizeBytes", { value: 0 });
    const gb = 1024 * 1024 * 1024;
    const mb = 1024 * 1024;
    if (bytes >= gb) return t("format.sizeGb", { value: (bytes / gb).toFixed(0) });
    if (bytes >= mb) return t("format.sizeMb", { value: (bytes / mb).toFixed(0) });
    return t("format.sizeBytes", { value: bytes });
  };

  const usedBytes = drive.totalBytes - drive.freeBytes;
  const usagePercent = drive.totalBytes > 0 ? (usedBytes / drive.totalBytes) * 100 : 0;

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <HardDrive size={14} className="text-text-muted shrink-0" />
        <span className="text-sm font-medium text-text-primary truncate">
          {drive.letter}: {drive.volumeLabel || t("format.localDisk")}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <span className="text-xs text-text-muted">{t("format.freeSpace", { value: formatBytes(drive.freeBytes) })}</span>
    </div>
  );
}
