import type { GamehubAction } from "../types/controller";

type ConsoleHandler = (action: GamehubAction) => void;

const listeners = new Set<ConsoleHandler>();

// When an overlay is open it can claim all console input. This is simpler
// than per-overlay subscriptions because only one overlay is ever open.
let overlayHandler: ConsoleHandler | null = null;

export function subscribeConsoleInput(handler: ConsoleHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

export function setConsoleOverlayHandler(handler: ConsoleHandler | null): void {
  overlayHandler = handler;
}

export function emitConsoleAction(action: GamehubAction) {
  if (overlayHandler) {
    overlayHandler(action);
    return;
  }
  for (const listener of listeners) {
    listener(action);
  }
}