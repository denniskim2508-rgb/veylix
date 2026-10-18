export const ControllerType = {
  Xbox360: "xbox360",
  XboxOne: "xboxOne",
  XboxSeries: "xboxSeries",
  PlayStation3: "playStation3",
  PlayStation4: "playStation4",
  PlayStation5: "playStation5",
  SwitchPro: "switchPro",
  SteamDeck: "steamDeck",
  Generic: "generic",
} as const;
export type ControllerType = (typeof ControllerType)[keyof typeof ControllerType];

export const GamehubAction = {
  Up: "up",
  Down: "down",
  Left: "left",
  Right: "right",
  Confirm: "confirm",
  Cancel: "cancel",
  Menu: "menu",
  SecondaryAction: "secondaryAction",
  LeftShoulder: "leftShoulder",
  RightShoulder: "rightShoulder",
  LeftTrigger: "leftTrigger",
  RightTrigger: "rightTrigger",
  LeftStickClick: "leftStickClick",
  RightStickClick: "rightStickClick",
} as const;
export type GamehubAction = (typeof GamehubAction)[keyof typeof GamehubAction];

export const ButtonPrompt = {
  XboxA: "xboxA",
  XboxB: "xboxB",
  XboxX: "xboxX",
  XboxY: "xboxY",
  XboxMenu: "xboxMenu",
  XboxView: "xboxView",
  PlayStationCross: "playStationCross",
  PlayStationCircle: "playStationCircle",
  PlayStationSquare: "playStationSquare",
  PlayStationTriangle: "playStationTriangle",
  PlayStationOptions: "playStationOptions",
  PlayStationShare: "playStationShare",
  GenericButton1: "genericButton1",
  GenericButton2: "genericButton2",
  GenericButton3: "genericButton3",
  GenericButton4: "genericButton4",
  DpadUp: "dpadUp",
  DpadDown: "dpadDown",
  DpadLeft: "dpadLeft",
  DpadRight: "dpadRight",
  LeftStick: "leftStick",
  RightStick: "rightStick",
  LeftShoulder: "leftShoulder",
  RightShoulder: "rightShoulder",
  LeftTrigger: "leftTrigger",
  RightTrigger: "rightTrigger",
} as const;
export type ButtonPrompt = (typeof ButtonPrompt)[keyof typeof ButtonPrompt];

export interface ControllerInfo {
  id: number;
  name: string;
  osName: string;
  controllerType: ControllerType;
  vendorId: number | null;
  productId: number | null;
  buttonPrompts: Partial<Record<GamehubAction, ButtonPrompt>>;
  isActive: boolean;
}

export interface ControllerSettings {
  deadZone: number;
  repeatDelay: number;
  repeatRate: number;
  stickThreshold: number;
}

export type GamepadChannelEvent =
  | {
      type: "connected";
      id: number;
      name: string;
      osName: string;
      controllerType: ControllerType;
      vendorId: number | null;
      productId: number | null;
      buttonPrompts: Partial<Record<GamehubAction, ButtonPrompt>>;
    }
  | { type: "disconnected"; id: number }
  | { type: "action"; id: number; action: GamehubAction; pressed: boolean }
  | { type: "axisChanged"; id: number; axis: string; value: number };

export function promptLabel(prompt: ButtonPrompt): string {
  const labels: Record<string, string> = {
    xboxA: "A", xboxB: "B", xboxX: "X", xboxY: "Y",
    xboxMenu: "Menu", xboxView: "View",
    playStationCross: "\u2715", playStationCircle: "\u25CB",
    playStationSquare: "\u25A1", playStationTriangle: "\u25B3",
    playStationOptions: "Options", playStationShare: "Share",
    genericButton1: "1", genericButton2: "2", genericButton3: "3", genericButton4: "4",
    dpadUp: "\u2191", dpadDown: "\u2193", dpadLeft: "\u2190", dpadRight: "\u2192",
    leftStick: "LS", rightStick: "RS",
    leftShoulder: "LB", rightShoulder: "RB",
    leftTrigger: "LT", rightTrigger: "RT",
  };
  return labels[prompt] || "?";
}

export function controllerDisplayName(type: ControllerType): string {
  const names: Record<string, string> = {
    xbox360: "Xbox 360", xboxOne: "Xbox One", xboxSeries: "Xbox Series",
    playStation3: "PlayStation 3", playStation4: "PlayStation 4", playStation5: "PlayStation 5",
    switchPro: "Switch Pro", steamDeck: "Steam Deck", generic: "Generic",
  };
  return names[type] || "Generic";
}
