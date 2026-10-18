import { convertFileSrc } from "@tauri-apps/api/core";
import { resolveArtworkUrl } from "./artwork";

export interface ScreenshotItem {
  id: number;
  url: string;
  source: "user" | "provider";
}

export async function resolveShotUrl(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("artwork/")) {
    const resolved = await resolveArtworkUrl(url);
    return resolved || url;
  }
  return convertFileSrc(url);
}

export function mergeScreenshots(userShots: ScreenshotItem[], providerShots: ScreenshotItem[]): ScreenshotItem[] {
  const seen = new Set<string>();
  const out: ScreenshotItem[] = [];
  for (const item of [...userShots, ...providerShots]) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}