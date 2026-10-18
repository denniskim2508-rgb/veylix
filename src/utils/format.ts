import type { PlaySession } from "../types";
import { tGlobal, tpGlobal, currentLocale } from "../i18n";

export function formatPlayTime(minutes: number): string {
  if (minutes === 0) return tGlobal("format.playTimeZero");
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return tGlobal("format.playTimeMinutes", { minutes: m });
  if (m === 0) return tGlobal("format.playTimeHours", { hours: h });
  return tGlobal("format.playTimeHoursMinutes", { hours: h, minutes: m });
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return tGlobal("format.today");
  if (diffDays === 1) return tGlobal("format.yesterday");
  if (diffDays < 7) return tpGlobal("format.daysAgo", diffDays);
  return date.toLocaleDateString(currentLocale(), { month: "short", day: "numeric", year: "numeric" });
}

export function calculateDaysPlayed(sessions: PlaySession[]): number {
  const uniqueDays = new Set<string>();
  sessions.forEach((s) => {
    const date = new Date(s.startedAt);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    uniqueDays.add(dayKey);
  });
  return uniqueDays.size;
}