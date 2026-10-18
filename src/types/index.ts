export type Platform =
  | "steam"
  | "epic"
  | "gog"
  | "ea"
  | "ubisoft"
  | "battlenet"
  | "rockstar"
  | "xbox"
  | "emulator"
  | "manual"
  | "local";

export type DriveType = "fixed" | "removable" | "remote" | "unknown";

export interface Game {
  id: number;
  title: string;
  platform: Platform;
  installPath: string | null;
  executablePath: string | null;
  coverImage: string | null;
  backgroundImage: string | null;
  description: string | null;
  releaseDate: string | null;
  genre: string | null;
  developer: string | null;
  publisher: string | null;
  playTime: number;
  lastPlayed: string | null;
  isInstalled: boolean;
  isFavorite: boolean;
  platformGameId: string | null;
  launchCommand: string | null;
  driveLetter: string | null;
  icon: string | null;
  logo: string | null;
  trailerPath: string | null;
  trailerSource: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Drive {
  letter: string;
  volumeLabel: string;
  driveType: DriveType;
  fsType: string;
  totalBytes: number;
  freeBytes: number;
  lastSeen: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
}

export interface PlaySession {
  id: number;
  gameId: number;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
}

export type ViewMode = "grid" | "list" | "details";
export type SortBy = "title" | "lastPlayed" | "playTime" | "platform";
export type FilterType = "all" | "installed" | "favorites" | "recent";

export interface ScanFolder {
  id: number;
  path: string;
  label: string | null;
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  steam: "#1B2838",
  epic: "#0078F2",
  gog: "#86328A",
  ea: "#F06523",
  ubisoft: "#0068E0",
  battlenet: "#009AE4",
  rockstar: "#F5A623",
  xbox: "#107C10",
  emulator: "#6366F1",
  manual: "#64748B",
  local: "#22C55E",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  steam: "Steam",
  epic: "Epic Games",
  gog: "GOG",
  ea: "EA App",
  ubisoft: "Ubisoft Connect",
  battlenet: "Battle.net",
  rockstar: "Rockstar",
  xbox: "Xbox",
  emulator: "Emulator",
  manual: "Manual",
  local: "Local",
};

export interface EmulatorProfile {
  id: number;
  name: string;
  executablePath: string;
  platform: string;
  commandTemplate: string | null;
  supportedExtensions: string | null;
  defaultArgs: string | null;
  isInstalled: boolean;
  icon: string | null;
  corePath: string | null;
}

export interface DetectedEmulator {
  name: string;
  executablePath: string;
  platform: string;
  commandTemplate: string;
  supportedExtensions: string;
  defaultArgs: string;
  availableCores: string[];
}

export interface RomFile {
  id: number;
  gameId: number;
  emulatorId: number | null;
  filePath: string;
  fileName: string;
  fileSize: number;
}

export interface RomScanFolder {
  id: number;
  path: string;
  label: string | null;
  emulatorId: number | null;
}

export interface ScanExclusion {
  id: number;
  pattern: string;
  exclusionType: string;
  isRegex: boolean;
}

export const EMULATOR_PLATFORMS: string[] = [
  "Multi-System",
  "Nintendo Entertainment System",
  "Super Nintendo",
  "Nintendo 64",
  "Game Boy",
  "Game Boy Advance",
  "Nintendo DS",
  "Nintendo 3DS",
  "Nintendo Switch",
  "Sega Genesis",
  "Sega Master System",
  "Sega Dreamcast",
  "Sega Saturn",
  "PlayStation 1",
  "PlayStation 2",
  "PlayStation Portable",
  "GameCube",
  "Wii",
  "Wii U",
  "Xbox",
  "Xbox 360",
  "Atari 2600",
  "Atari 7800",
  "Neo Geo",
  "TurboGrafx-16",
  "WonderSwan",
];

export const DEFAULT_ROM_EXTENSIONS: Record<string, string[]> = {
  "Nintendo Entertainment System": [".nes"],
  "Super Nintendo": [".sfc", ".smc"],
  "Nintendo 64": [".n64", ".z64", ".v64"],
  "Game Boy": [".gb", ".gbc"],
  "Game Boy Advance": [".gba"],
  "Nintendo DS": [".nds"],
  "Nintendo 3DS": [".3ds"],
  "Nintendo Switch": [".nsp", ".xci", ".nca", ".nro"],
  "Sega Genesis": [".gen", ".md", ".bin"],
  "Sega Master System": [".sms"],
  "Sega Dreamcast": [".cdi", ".gdi", ".chd"],
  "Sega Saturn": [".bin", ".cue"],
  "PlayStation 1": [".bin", ".cue", ".iso", ".pbp"],
  "PlayStation 2": [".iso", ".bin", ".chd"],
  "PlayStation Portable": [".iso", ".cso"],
  "GameCube": [".iso", ".gcm", ".rvz"],
  "Wii": [".iso", ".wbfs", ".rvz"],
  "Wii U": [".wud", ".wux", ".rpx"],
  "Xbox": [".iso", ".xbe"],
  "Xbox 360": [".iso", ".xex"],
  "Atari 2600": [".a26"],
  "Atari 7800": [".a78"],
  "Neo Geo": [".neo", ".zip"],
  "TurboGrafx-16": [".pce"],
  "WonderSwan": [".ws", ".wsc"],
};

export interface DatEntry {
  id: number;
  platform: string;
  gameName: string;
  description: string | null;
  romName: string;
  crc32: string;
  romSize: number;
}

export interface DatLookupResult {
  gameName: string;
  description: string | null;
  platform: string;
  romName: string;
}

export interface ArtworkSearchResult {
  title: string;
  sourceUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  provider: string;
}

export interface WebImageResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourcePage: string;
  width: number;
  height: number;
  format: string;
  engine: string;
  query: string;
}

export interface WebImageSearchPage {
  results: WebImageResult[];
  page: number;
  hasMore: boolean;
  engine: string;
  note: string | null;
}

export const ArtworkType = {
  Cover: "cover",
  Hero: "hero",
  Logo: "logo",
  Background: "background",
  Icon: "icon",
  Screenshot: "screenshot",
  Header: "header",
  Capsule: "capsule",
} as const;
export type ArtworkType = (typeof ArtworkType)[keyof typeof ArtworkType];

export interface ArtworkCandidate {
  id: number;
  gameId: number;
  artworkType: string;
  url: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  provider: string;
  providerAssetId: string | null;
  score: number;
  isPrimary: boolean;
  selectionMode: string;
  cachedPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalId {
  id: number;
  gameId: number;
  provider: string;
  externalId: string;
}

export const ArtworkSelectionMode = {
  Automatic: "automatic",
  Manual: "manual",
} as const;
export type ArtworkSelectionMode = (typeof ArtworkSelectionMode)[keyof typeof ArtworkSelectionMode];

export interface GameUpdate {
  title?: string;
  description?: string;
  genre?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  coverImage?: string;
  backgroundImage?: string;
  icon?: string;
  logo?: string;
  trailerPath?: string;
  trailerSource?: string;
}

export type StartupMode = "desktop" | "console" | "last";

export type ConsoleCardSize = "small" | "medium" | "large" | "extralarge";

export type ConsoleWallpaperMode = "default" | "static" | "live";

export type ConsoleUiStyle = "standard" | "vertical";

export type TrailerSource = "manual" | "auto";
