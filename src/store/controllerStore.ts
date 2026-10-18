import { create } from "zustand";
import type { ControllerInfo, ControllerSettings, GamehubAction } from "../types/controller";

type InputMethod = "mouse" | "keyboard" | "controller";

interface ControllerStore {
  connected: boolean;
  controllers: ControllerInfo[];
  activeController: ControllerInfo | null;
  inputMethod: InputMethod;
  settings: ControllerSettings;
  setConnected: (connected: boolean) => void;
  setControllers: (controllers: ControllerInfo[]) => void;
  setActiveController: (controller: ControllerInfo | null) => void;
  setInputMethod: (method: InputMethod) => void;
  setSettings: (settings: ControllerSettings) => void;
  getButtonLabel: (action: GamehubAction) => string;
}

export const useControllerStore = create<ControllerStore>((set, get) => ({
  connected: false,
  controllers: [],
  activeController: null,
  inputMethod: "mouse",
  settings: {
    deadZone: 0.2,
    repeatDelay: 300,
    repeatRate: 100,
    stickThreshold: 0.5,
  },
  setConnected: (connected) => set({ connected }),
  setControllers: (controllers) => set({ controllers }),
  setActiveController: (controller) => set({ activeController: controller }),
  setInputMethod: (method) => set({ inputMethod: method }),
  setSettings: (settings) => set({ settings }),
  getButtonLabel: (action: GamehubAction) => {
    const { activeController } = get();
    if (!activeController) return "";
    const prompt = activeController.buttonPrompts[action];
    if (!prompt) return "";
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
    return labels[prompt] || "";
  },
}));
