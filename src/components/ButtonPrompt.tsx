import { useControllerStore } from "../store/controllerStore";
import type { GamehubAction } from "../types/controller";

interface ButtonPromptProps {
  action: GamehubAction;
  className?: string;
}

export function ButtonPrompt({ action, className = "" }: ButtonPromptProps) {
  const label = useControllerStore((s) => s.getButtonLabel(action));
  const connected = useControllerStore((s) => s.connected);

  if (!connected || !label) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.5em] h-[1.5em] px-1 rounded text-xs font-bold bg-bg-main border border-border text-text-secondary ${className}`}
    >
      {label}
    </span>
  );
}
