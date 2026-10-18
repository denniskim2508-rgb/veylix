import { convertFileSrc } from "@tauri-apps/api/core";

let cachedAppDir: string | null = null;

async function getAppDir(): Promise<string> {
  if (cachedAppDir) return cachedAppDir;
  const { invoke } = await import("@tauri-apps/api/core");
  const dir = await invoke<string>("get_app_data_dir");
  cachedAppDir = dir;
  return dir;
}

export async function resolveArtworkUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("artwork/")) {
    const appDir = await getAppDir();
    return convertFileSrc(`${appDir}/${path}`);
  }
  return path;
}

export async function resolveCoverUrl(path: string | null): Promise<string | null> {
  return resolveArtworkUrl(path);
}

export async function resolveBackgroundUrl(path: string | null): Promise<string | null> {
  return resolveArtworkUrl(path);
}

export async function resolveIconUrl(path: string | null): Promise<string | null> {
  return resolveArtworkUrl(path);
}

export async function resolveLogoUrl(path: string | null): Promise<string | null> {
  return resolveArtworkUrl(path);
}
