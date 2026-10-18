// Generates the original GameHub Console Mode UI sounds.
//
// Every sound is synthesized from scratch (oscillators + filtered noise +
// envelopes) and written as 16-bit mono PCM WAV files. This is original
// material — no copyrighted or licensed samples are used — so the files are
// freely redistributable with the app.
//
// Run:  node scripts/generate-sounds.mjs
// When regenerating, restart the dev server so Vite picks up new files.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "assets", "sounds");
const SAMPLE_RATE = 22050;

// ── Low-level synthesis helpers ────────────────────────────────────────────

function makeBuffer(duration) {
  return new Float32Array(Math.floor(duration * SAMPLE_RATE));
}

function addTone(buf, startSec, freq, duration, amp, { decay = 0.03, harmonics = [] } = {}) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.min(buf.length - start, Math.floor(duration * SAMPLE_RATE));
  const twoPi = Math.PI * 2;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const sustain = Math.exp(-t / decay);
    const env = sustain * Math.min(1, t / 0.004);
    let v = Math.sin(twoPi * freq * t);
    for (const [h, hAmp] of harmonics) {
      v += hAmp * Math.sin(twoPi * freq * h * t);
    }
    buf[start + i] += v * amp * env;
  }
}

function addSweep(buf, startSec, freqFrom, freqTo, duration, amp, decay = 0.03) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.min(buf.length - start, Math.floor(duration * SAMPLE_RATE));
  const twoPi = Math.PI * 2;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const k = t / duration;
    const freq = freqFrom + (freqTo - freqFrom) * k;
    phase += twoPi * freq / SAMPLE_RATE;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.005, (duration - t) / 0.02);
    buf[start + i] += Math.sin(phase) * amp * env;
  }
}

// Cheap low-passed noise (average 3 samples) for soft "whoosh" textures.
function addNoise(buf, startSec, duration, amp, { lowpass = 0.3, decay = 0.05 } = {}) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.min(buf.length - start, Math.floor(duration * SAMPLE_RATE));
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.004, (duration - t) / 0.04);
    const r = Math.random() * 2 - 1;
    let v = r;
    if (lowpass > 0 && lowpass < 1) v = v * lowpass + (buf[start + i - 2] ?? 0) * (1 - lowpass);
    buf[start + i] += v * amp * env;
  }
}

// ── Per-sound composers (each returns a Float32Array of normalized shape) ──

function soundEntry() {
  const buf = makeBuffer(1.15);
  // Soft cinematic swell: two gentle tones climbing, plus a low warm hum.
  addTone(buf, 0.0, 110, 1.15, 0.30, { decay: 0.45 });
  addTone(buf, 0.05, 220, 1.05, 0.30, { decay: 0.4, harmonics: [[2, 0.25]] });
  addTone(buf, 0.22, 330, 0.8, 0.18, { decay: 0.3, harmonics: [[2, 0.15]] });
  addNoise(buf, 0.0, 1.15, 0.05, { lowpass: 0.2, decay: 0.5 });
  // Gentle rising attack into the fade that aligns with the background fade-in.
  for (let i = 0; i < buf.length; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.18);
    const release = Math.min(1, (1.15 - t) / 0.4);
    buf[i] *= attack * Math.max(0, release);
  }
  return buf;
}

function soundNav() {
  const buf = makeBuffer(0.045);
  addTone(buf, 0.0, 2400, 0.045, 0.42, { decay: 0.012, harmonics: [[2, 0.2]] });
  return buf;
}

function soundSelect() {
  const buf = makeBuffer(0.09);
  addTone(buf, 0.0, 880, 0.09, 0.42, { decay: 0.03, harmonics: [[2, 0.35], [3, 0.12]] });
  addTone(buf, 0.005, 1760, 0.06, 0.12, { decay: 0.02 });
  return buf;
}

function soundOpen() {
  const buf = makeBuffer(0.095);
  addSweep(buf, 0.0, 480, 1500, 0.09, 0.4, 0.03);
  addNoise(buf, 0.0, 0.09, 0.06, { lowpass: 0.35, decay: 0.03 });
  return buf;
}

function soundClose() {
  const buf = makeBuffer(0.08);
  addSweep(buf, 0.0, 1500, 480, 0.075, 0.4, 0.03);
  addNoise(buf, 0.0, 0.08, 0.05, { lowpass: 0.35, decay: 0.03 });
  return buf;
}

function soundConfirm() {
  const buf = makeBuffer(0.14);
  addTone(buf, 0.0, 660, 0.07, 0.4, { decay: 0.025, harmonics: [[2, 0.2]] });
  addTone(buf, 0.06, 990, 0.08, 0.4, { decay: 0.03, harmonics: [[2, 0.25]] });
  return buf;
}

function soundLaunch() {
  const buf = makeBuffer(0.46);
  // Soft optimistic three-note ascent — G4, C5, E5.
  const notes = [
    [392.0, 0.0, 0.1],
    [523.25, 0.09, 0.11],
    [659.25, 0.18, 0.28],
  ];
  for (const [f, t, d] of notes) {
    addTone(buf, t, f, d, 0.32, { decay: 0.05, harmonics: [[2, 0.15]] });
  }
  return buf;
}

function soundError() {
  const buf = makeBuffer(0.3);
  addTone(buf, 0.0, 150, 0.08, 0.4, { decay: 0.02, harmonics: [[2, 0.6], [3, 0.3]] });
  addTone(buf, 0.11, 130, 0.1, 0.42, { decay: 0.025, harmonics: [[2, 0.6], [3, 0.3]] });
  return buf;
}

// ── WAV encoding ───────────────────────────────────────────────────────────

function encodeWav(samples) {
  const n = samples.length;
  const dataSize = n * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  const norm = peak > 0 ? 0.92 / peak : 1;

  for (let i = 0; i < n; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] * norm));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

const SOUNDS = {
  "entry.wav": soundEntry,
  "nav.wav": soundNav,
  "select.wav": soundSelect,
  "open.wav": soundOpen,
  "close.wav": soundClose,
  "confirm.wav": soundConfirm,
  "launch.wav": soundLaunch,
  "error.wav": soundError,
};

mkdirSync(OUT_DIR, { recursive: true });

let regenerated = 0;
for (const [file, compose] of Object.entries(SOUNDS)) {
  const path = join(OUT_DIR, file);
  const data = encodeWav(compose());
  writeFileSync(path, data);
  console.log(`wrote ${file} (${(data.length / 1024).toFixed(1)} KB)`);
  regenerated++;
}
console.log(`Generated ${regenerated} sound file(s) into ${OUT_DIR}`);