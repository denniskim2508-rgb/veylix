import { createContext, useContext, useEffect } from "react";
import { useControllerStore } from "../store/controllerStore";

interface GamepadContextValue {
  connected: boolean;
  controllers: { id: number; name: string; controllerType: string; isActive: boolean }[];
}

const GamepadContext = createContext<GamepadContextValue>({
  connected: false,
  controllers: [],
});

export function GamepadProvider({ children }: { children: React.ReactNode }) {
  const connected = useControllerStore((s) => s.connected);
  const controllers = useControllerStore((s) => s.controllers);
  const inputMethod = useControllerStore((s) => s.inputMethod);

  // Write input method to DOM for CSS focus ring selectors
  useEffect(() => {
    document.documentElement.dataset.inputMethod = inputMethod;
  }, [inputMethod]);

  return (
    <GamepadContext.Provider value={{ connected, controllers }}>
      <div data-gamepad={connected ? "active" : undefined} className="h-full">
        {children}
      </div>
    </GamepadContext.Provider>
  );
}

export function useGamepadContext() {
  return useContext(GamepadContext);
}
