export type ConsoleFocusArea =
  | "carousel"
  | "nav"
  | "actions"
  | "quickmenu"
  | "search"
  | "settings"
  | "moremenu"
  | "trailer";

export interface ConsoleNavItem {
  id: string;
  label: string;
}

export interface TrailerProbeResult {
  valid: boolean;
  exists: boolean;
  path: string;
  fileName: string;
  sizeBytes: number;
  extension: string;
  error: string | null;
}

export interface TrailerAssignment {
  path: string;
  source: "manual" | "auto";
  valid: boolean;
  fileName: string;
}