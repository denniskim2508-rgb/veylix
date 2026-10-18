import { convertFileSrc } from "@tauri-apps/api/core";
import type { Game } from "../types";
import type { TrailerProbeResult } from "../types/console";

export const TRAILER_EXTENSIONS = ["mp4", "webm", "mkv", "mov", "avi", "m4v", "ogv"];

export const WALLPAPER_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

export const WALLPAPER_VIDEO_EXTENSIONS = TRAILER_EXTENSIONS;

export function isSupportedTrailerPath(path: string): boolean {
  const lower = path.toLowerCase();
  return TRAILER_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: apiInvoke } = await import("@tauri-apps/api/core");
  return apiInvoke<T>(cmd, args);
}

export async function probeTrailer(path: string): Promise<TrailerProbeResult> {
  return invoke<TrailerProbeResult>("probe_trailer", { path });
}

export async function probeWallpaper(path: string): Promise<TrailerProbeResult> {
  return invoke<TrailerProbeResult>("probe_wallpaper", { path });
}

export function resolveTrailerPlaybackUrl(path: string): string {
  const lower = path.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return path;
  }
  if (lower.startsWith("file://")) {
    const local = lower.replace(/^file:\/\//, "");
    return convertFileSrc(local);
  }
  if (lower.startsWith("artwork/")) {
    return convertFileSrc(path.replace("artwork/", ""));
  }
  return convertFileSrc(path);
}

export function getAssignedTrailerPath(game: Game): string | null {
  if (game.trailerPath) return game.trailerPath;
  return null;
}

export async function discoverAutoTrailer(gameId: number): Promise<string | null> {
  try {
    return await invoke<string | null>("find_auto_trailer", { gameId });
  } catch {
    return null;
  }
}