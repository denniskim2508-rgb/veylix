import { useEffect, useRef } from "react";
import { uiAudio } from "../utils/uiAudio";

interface NavFeedbackOptions {
  /** When false, index changes won't trigger a sound (e.g. while typing). */
  enabled?: boolean;
  /** Minimum absolute index delta required to beep (default 1). */
  minChange?: number;
  /** Range the index can cycle, used to ignore wrap-around resets. */
  maxIndex?: number;
  /**
   * Changes to this key (e.g. the active section or search query) reset the
   * focus without emitting a navigation sound, since the resulting index jump
   * is not a real user step.
   */
  resetKey?: unknown;
}

/**
 * Plays the subtle navigation tick whenever a focus index actually moves to a
 * different valid item. Because both controller and keyboard events funnel into
 * the same state, bouncing this off the resulting index change naturally
 * prevents duplicate sounds when the two input paths overlap.
 */
export function useNavFeedback(index: number, options?: NavFeedbackOptions): void {
  const enabled = options?.enabled ?? true;
  const minChange = options?.minChange ?? 1;
  const maxIndex = options?.maxIndex;
  const resetKey = options?.resetKey;

  const prevRef = useRef<number | null>(null);
  const lastKeyRef = useRef(resetKey);

  useEffect(() => {
    const prev = prevRef.current;
    const keyChanged = lastKeyRef.current !== resetKey;
    lastKeyRef.current = resetKey;
    prevRef.current = index;

    if (prev === null || keyChanged || !enabled || prev === index) return;

    const diff = Math.abs(index - prev);
    if (diff < minChange) return;
    if (maxIndex !== undefined && diff >= maxIndex) return;

    void uiAudio.playUiSound("nav");
  }, [index, enabled, minChange, maxIndex, resetKey]);
}