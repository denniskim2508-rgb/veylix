import { useConsoleStore } from "../store/consoleStore";
import entryUrl from "../assets/sounds/entry.wav";
import navUrl from "../assets/sounds/nav.wav";
import selectUrl from "../assets/sounds/select.wav";
import openUrl from "../assets/sounds/open.wav";
import closeUrl from "../assets/sounds/close.wav";
import confirmUrl from "../assets/sounds/confirm.wav";
import launchUrl from "../assets/sounds/launch.wav";
import errorUrl from "../assets/sounds/error.wav";

export type UiSoundName =
  | "entry"
  | "nav"
  | "select"
  | "open"
  | "close"
  | "confirm"
  | "launch"
  | "error";

const SOUND_URLS: Record<UiSoundName, string> = {
  entry: entryUrl,
  nav: navUrl,
  select: selectUrl,
  open: openUrl,
  close: closeUrl,
  confirm: confirmUrl,
  launch: launchUrl,
  error: errorUrl,
};

const MIN_GAP_MS = 35;

type AudioCtor = typeof AudioContext;

/**
 * Global UI sound service for Console Mode.
 *
 * - One shared AudioContext + a master GainNode whose level is the UI sound
 *   volume (fully independent from any <video> trailer audio).
 * - WAV assets are decoded once and cached; playback reuses the buffers.
 * - If an asset is missing or fails to decode, a short procedural tone is
 *   synthesized as a fallback so the interface never silently depends on a
 *   file being present.
 * - Every result is gated by the user's live audio settings read from the
 *   console store at play time, so changes apply immediately.
 */
class UiAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<UiSoundName, AudioBuffer>();
  private active = new Map<UiSoundName, AudioBufferSourceNode>();
  private lastPlayed = new Map<UiSoundName, number>();

  /** Create/resume the shared context. Called on first user gesture + play. */
  ensureUnlocked(): void {
    const ctx = this.getContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  /** Immediately applies the UI volume to the live gain node. */
  setMasterVolume(volume: number): void {
    if (this.master) {
      this.master.gain.value = clamp01(volume / 100);
    }
  }

  async playUiSound(name: UiSoundName, force = false): Promise<void> {
    const s = useConsoleStore.getState();
    if (!force) {
      if (!s.uiSoundsEnabled) return;
      if (name === "entry" && !s.uiSoundEntry) return;
      if (name === "nav" && !s.uiSoundNavigation) return;
      if (name !== "entry" && name !== "nav" && !s.uiSoundSelection) return;
    }

    const ctx = this.getContext();
    if (!ctx || !this.master) return;

    // Throttle so mashing a button never stacks a dozen sounds at once.
    const now = performance.now();
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < MIN_GAP_MS) return;
    this.lastPlayed.set(name, now);

    if (ctx.state === "suspended") void ctx.resume();

    // Stop a still-ringing previous instance of the same category.
    const prev = this.active.get(name);
    if (prev) {
      try { prev.stop(); } catch { /* already stopped */ }
      this.active.delete(name);
    }

    const buffer = await this.getBuffer(name, ctx);
    if (!buffer) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.master);
    src.onended = () => {
      if (this.active.get(name) === src) this.active.delete(name);
    };
    this.active.set(name, src);
    src.start();
  }

  /** Plays a short representative sequence so settings preview is audible. */
  preview(): void {
    if (!useConsoleStore.getState().uiSoundsEnabled) return;
    void this.playUiSound("entry", true);
    const delayed = (name: UiSoundName, ms: number) =>
      window.setTimeout(() => void this.playUiSound(name, true), ms);
    delayed("nav", 320);
    delayed("select", 520);
    delayed("confirm", 720);
  }

  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const win = window as Window & { webkitAudioContext?: AudioCtor };
    const Ctor: AudioCtor | undefined = window.AudioContext ?? win.webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = clamp01(useConsoleStore.getState().uiSoundVolume / 100);
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private async getBuffer(name: UiSoundName, ctx: AudioContext): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return cached;

    try {
      const res = await fetch(SOUND_URLS[name]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(data);
      this.buffers.set(name, buf);
      return buf;
    } catch {
      // Fallback: synthesize a soft blip so the UI never depends on a file.
      const buf = this.synthFallback(name, ctx);
      if (buf) this.buffers.set(name, buf);
      return buf;
    }
  }

  private synthFallback(name: UiSoundName, ctx: AudioContext): AudioBuffer | null {
    const dur =
      name === "entry" ? 1.0
      : name === "launch" ? 0.4
      : name === "error" ? 0.25
      : 0.1;
    const freq =
      name === "entry" ? 220
      : name === "nav" ? 2000
      : name === "confirm" ? 880
      : 500;
    const rate = ctx.sampleRate;
    const len = Math.floor(dur * rate);
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      data[i] =
        Math.sin(2 * Math.PI * freq * t) *
        Math.exp(-t / (dur * 0.4)) *
        Math.min(1, t / 0.004);
    }
    return buf;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export const uiAudio = new UiAudio();

// Unlock the audio context from the very first user interaction, since
// WebView2/WebKit may otherwise start it suspended.
if (typeof window !== "undefined") {
  const unlock = () => uiAudio.ensureUnlocked();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}