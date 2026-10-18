export type AddonCategory =
  | "themes-desktop"
  | "themes-fullscreen"
  | "libraries"
  | "metadata-sources"
  | "generic";

export type AddonType =
  | "theme-fullscreen"
  | "theme-desktop"
  | "library"
  | "metadata-source"
  | "generic";

export interface AddonVersion {
  version: string;
  downloadUrl: string;
  sha256?: string;
  minGameHubVersion?: string;
  maxGameHubVersion?: string;
  changelog?: string;
}

export interface AddonCatalogEntry {
  id: string;
  name: string;
  type: AddonType;
  category: AddonCategory;
  author: string;
  description: string;
  longDescription?: string;
  version: string;
  minGameHubVersion?: string;
  maxGameHubVersion?: string;
  iconUrl?: string;
  screenshots: string[];
  homepageUrl?: string;
  sourceRepository?: string;
  license?: string;
  tags: string[];
  versions: AddonVersion[];
}

export interface CatalogCategory {
  id: string;
  label: string;
  icon?: string;
}

export interface AddonCatalog {
  catalogVersion: number;
  gameHubMinVersion?: string;
  updatedAt?: string;
  categories: CatalogCategory[];
  addons: AddonCatalogEntry[];
}

export interface InstalledAddon {
  id: string;
  name: string;
  type: AddonType;
  version: string;
  author: string;
  description?: string;
  enabled: boolean;
  installedAt: string;
  updatedAt?: string;
  installPath: string;
  sourceUrl?: string;
}

export type AddonState =
  | "installed"
  | "enabled"
  | "disabled"
  | "up-to-date"
  | "update-available"
  | "not-installed";

export const ADDON_CATEGORY_LABELS: Record<AddonCategory, string> = {
  "themes-desktop": "Themes Desktop",
  "themes-fullscreen": "Themes Fullscreen",
  libraries: "Libraries",
  "metadata-sources": "Metadata Sources",
  generic: "Generic",
};

export const ADDON_TYPE_LABELS: Record<AddonType, string> = {
  "theme-fullscreen": "Theme",
  "theme-desktop": "Theme",
  library: "Library",
  "metadata-source": "Metadata Source",
  generic: "Add-on",
};
