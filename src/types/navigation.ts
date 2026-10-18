export type NavigationRegion =
  | "sidebar"
  | "toolbar"
  | "hero"
  | "gamegrid"
  | "gamedetail"
  | "library"
  | "detailhero"
  | "detailmeta"
  | "detaildesc"
  | "detailss"
  | "modal"
  | "menu"
  | "addonlist"
  | "addondetail";

export interface FocusableElement {
  id: string;
  region: NavigationRegion;
  element: HTMLElement;
  onClick?: () => void;
  disabled?: boolean;
  // Spatial position (updated by useFocusableElement via ResizeObserver)
  rect: DOMRect;
  centerX: number;
  centerY: number;
}

export interface FocusStackEntry {
  region: NavigationRegion;
  focusedId: string | null;
  selectedGameId?: number | null;
}
