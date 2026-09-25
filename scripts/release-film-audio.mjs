/**
 * The release film's soundtrack, synthesised from the page's cue list (window.__film.cues):
 * a sound-effects stem hung off the picture's own events, and a generative placeholder music
 * bed in D major that follows the film's chord cues. Every hiss and grain is seeded, so a
 * render sounds the same every time. Used by scripts/render-release-film.mjs.
 */
import { writeFileSync } from "node:fs";

export const SAMPLE_RATE = 48000;
const SR = SAMPLE_RATE;
const TAU = Math.PI * 2;

// ─── Building blocks ────────────────────────────────────────────────────────

const mtof = (note) => 440 * 2 ** ((note - 69) / 12);
const db = (d) => 10 ** (d / 20);
const clamp = (v, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const samples = (seconds) => Math.max(1, Math.round(seconds * SR));

/** Seeded PRNG (mulberry32). */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TABLE = new Float32Array(4097);
for (let i = 0; i <= 4096; i++) TABLE[i] = Math.sin((i / 4096) * TAU);
/** Sine of a phase given in cycles, from a lookup table. */
const sin = (cycles) => {
  const x = (cycles - Math.floor(cycles)) * 4096;
  const i = x | 0;
  return TABLE[i] + (TABLE[i + 1] - TABLE[i]) * (x - i);
};

/** RBJ biquad whose frequency can move while it runs. */
class Filter {
  constructor(type, freq, q = Math.SQRT1_2) {
    this.type = type;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
    this.set(freq, q);
  }

  set(freq, q = this.q) {
    this.q = q;
    const w = (TAU * Math.min(freq, SR * 0.45)) / SR;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    let b0;
    let b1;
    let b2;
    if (this.type === "lp") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (this.type === "hp") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha];
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  run(x) {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Scales a signal so its peak is 1, so every voice's level is set in one place. */
function normalize(sig) {
  let peak = 0;
  for (const v of sig) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < sig.length; i++) sig[i] /= peak;
  return sig;
}

/** A stereo buffer that voices are summed into, with a reverb send beside it. */
class Bus {
  constructor(length) {
    this.l = new Float32Array(length);
    this.r = new Float32Array(length);
  }

  /** Adds a mono signal at `start` seconds; `pan` is -1…1 or a function of progress. */
  add(start, mono, gain = 1, pan = 0) {
    const s = Math.round(start * SR);
    for (let i = 0; i < mono.length; i++) {
      const j = s + i;
      if (j < 0 || j >= this.l.length) continue;
      const p = typeof pan === "function" ? pan(i / mono.length) : pan;
      const a = ((clamp(p) + 1) * Math.PI) / 4;
      this.l[j] += mono[i] * gain * Math.cos(a);
      this.r[j] += mono[i] * gain * Math.sin(a);
    }
  }
}

// ─── Voices ─────────────────────────────────────────────────────────────────

/** Felt mallet: a round strike whose woody overtone is gone in a few milliseconds, so it never rings. */
function mallet(freq, { decay = 0.22, wood = 0.35 } = {}) {
  const out = new Float32Array(samples(decay * 5));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / decay);
    out[i] =
      env *
      (sin(freq * t) +
        0.3 * Math.exp(-t / (decay * 0.5)) * sin(2 * freq * t) +
        wood * Math.exp(-t / 0.02) * sin(4 * freq * t));
  }
  return out;
}

/** A low swell of warm partials through a closing low-pass: the weight of a bell without its ring. */
function bloom(freq, { attack = 0.03, decay = 0.7 } = {}) {
  const out = new Float32Array(samples(attack + decay * 4));
  const lp = new Filter("lp", 1200, 0.8);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    if (i % 32 === 0) lp.set(300 + 900 * Math.exp(-t / 0.15), 0.8);
    const env = Math.min(1, t / attack) ** 2 * Math.exp(-Math.max(0, t - attack) / decay);
    const tone =
      sin(freq * t) +
      0.5 * sin(2 * freq * t) +
      0.25 * sin(3 * freq * t) +
      0.5 * sin(0.5 * freq * t);
    out[i] = lp.run(tone * env);
  }
  return out;
}

/** Soft sine blip with an optional pitch drop from `from`× the note. */
function blip(freq, { decay = 0.12, from = 1, drop = 0.03, harmonics = 0.25 } = {}) {
  const out = new Float32Array(samples(decay * 6));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = freq * (1 + (from - 1) * Math.exp(-t / drop));
    phase += f / SR;
    const env = Math.min(1, t / 0.002) * Math.exp(-t / decay);
    out[i] = env * (sin(phase) + harmonics * sin(phase * 2));
  }
  return out;
}

/** Filtered noise whose band sweeps from f0 to f1: whooshes, swishes and air. */
function sweep(dur, f0, f1, { q = 1.1, attack = 0.55, seed = 7, type = "bp", curve = 1.6 } = {}) {
  const out = new Float32Array(samples(dur));
  const rnd = random(seed);
  const a = new Filter(type, f0, q);
  const b = new Filter(type, f0, q);
  for (let i = 0; i < out.length; i++) {
    const p = i / out.length;
    if (i % 32 === 0) {
      const f = f0 * (f1 / f0) ** p;
      a.set(f, q);
      b.set(f, q);
    }
    const env = p < attack ? (p / attack) ** 2 : ((1 - p) / (1 - attack)) ** curve;
    out[i] = b.run(a.run(rnd() * 2 - 1)) * env;
  }
  return out;
}

/** A short burst of filtered noise: clicks and key ticks. */
function burst(dur, freq, { seed = 3, type = "hp", q = 0.9 } = {}) {
  const out = new Float32Array(samples(dur));
  const rnd = random(seed);
  const f = new Filter(type, freq, q);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = f.run(rnd() * 2 - 1) * Math.exp(-t / (dur / 4));
  }
  return out;
}

/** Sums voices (each `[offsetSeconds, signal, gain]`) into one signal. */
function layer(parts) {
  const length = Math.max(...parts.map(([at, sig]) => samples(at) + sig.length));
  const out = new Float32Array(length);
  for (const [at, sig, gain = 1] of parts) {
    const s = samples(at);
    for (let i = 0; i < sig.length; i++) out[s + i] += sig[i] * gain;
  }
  return out;
}

/** Low sine that sags in pitch: the body of a thud or impact. */
function thump(freq = 55, { from = 2, decay = 0.25 } = {}) {
  return blip(freq, { decay, from, drop: 0.035, harmonics: 0.15 });
}

/** Taiko-style drum: a pitched skin that sags, over a dull slap of low noise. */
function taiko(freq = 70, { decay = 0.35, seed = 9 } = {}) {
  return normalize(
    layer([
      [0, thump(freq, { from: 1.8, decay })],
      [0, thump(freq * 1.5, { from: 1.4, decay: decay * 0.4 }), 0.3],
      [0, normalize(burst(0.08, 320, { type: "lp", seed })), 0.45],
    ]),
  );
}

/** A low brass swell ("braam"): detuned saws on a root and fifth, through a low-pass that opens. */
function braam(freq, { dur = 1.6, attack = 0.06, open = 1400 } = {}) {
  const out = new Float32Array(samples(dur));
  const lp = new Filter("lp", 150, 1.1);
  const voices = [
    [1, -0.006],
    [1, 0.006],
    [1.5, 0.003],
    [0.5, 0],
  ].map(([ratio, detune]) => {
    const f = freq * ratio * (1 + detune);
    return [f, Math.min(14, Math.floor(2500 / f))];
  });
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const rise = Math.min(1, t / attack);
    if (i % 32 === 0) lp.set(120 + open * rise * Math.exp(-t / (dur * 0.3)), 1.1);
    let v = 0;
    for (const [f, harmonics] of voices)
      for (let k = 1; k <= harmonics; k++) v += sin(f * k * t) / k;
    out[i] = lp.run(v) * rise * Math.exp(-t / (dur * 0.35));
  }
  return normalize(out);
}

/** A swell of rising noise and tone that stops dead at its end. */
function riser(dur) {
  const noise = sweep(dur, 300, 3500, { attack: 0.97, q: 0.8, seed: 21 });
  const tone = new Float32Array(noise.length);
  let phase = 0;
  for (let i = 0; i < tone.length; i++) {
    const p = i / tone.length;
    phase += (110 * 5 ** p) / SR;
    tone[i] = sin(phase) * p ** 3;
  }
  return layer([
    [0, normalize(noise), 1],
    [0, normalize(tone), 0.35],
  ]);
}

/** A granular murmur: soft sine grains from a low chord, scattered across the stereo field. */
function grains(
  dur,
  {
    seed = 5,
    density = 26,
    notes = [50, 55, 57, 62, 64, 66, 69],
    len: [short, long] = [0.06, 0.12],
  } = {},
) {
  const out = { l: new Float32Array(samples(dur)), r: new Float32Array(samples(dur)) };
  const rnd = random(seed);
  const count = Math.round(dur * density);
  for (let g = 0; g < count; g++) {
    const start = rnd() * dur * SR;
    const f = mtof(notes[Math.floor(rnd() * notes.length)]);
    const len = samples(short + rnd() * (long - short));
    const pan = rnd() * 2 - 1;
    const gain = 0.4 + rnd() * 0.6;
    for (let i = 0; i < len; i++) {
      const j = Math.round(start) + i;
      if (j >= out.l.length) break;
      const w = Math.sin((Math.PI * i) / len) ** 2 * gain * sin((f * i) / SR);
      out.l[j] += w * (1 - pan) * 0.5;
      out.r[j] += w * (1 + pan) * 0.5;
    }
  }
  const fade = (p) => Math.min(1, p / 0.15) * Math.min(1, (1 - p) / 0.3);
  for (let i = 0; i < out.l.length; i++) {
    const f = fade(i / out.l.length);
    out.l[i] *= f;
    out.r[i] *= f;
  }
  return out;
}

// ─── Sound effects ──────────────────────────────────────────────────────────

/**
 * Renders one cue. Returns `[signal, levelDb, pan, reverbSend, hallSend]`, or a stereo pair
 * `{ l, r, level, send }` for voices with their own stereo image. The hall is a long, dark
 * reverb kept for the big moments.
 */
function effect(cue) {
  const g = cue.gain ?? 1;
  const seed = Math.round(cue.t * 1000) + 17;
  const dur = cue.end != null ? cue.end - cue.t : cue.dur;
  switch (cue.type) {
    case "drone": {
      const out = new Float32Array(samples(dur + 0.1));
      const air = new Filter("lp", 900);
      const rnd = random(seed);
      for (let i = 0; i < out.length; i++) {
        const t = i / SR;
        const p = t / dur;
        const swell = Math.min(1, p * 1.6) ** 2 * Math.min(1, (1.02 - p) * 30);
        const tone = 0.6 * sin(73.42 * t) + 0.5 * sin(146.83 * t) + 0.35 * sin(220 * t);
        out[i] = swell * (tone + 0.3 * air.run(rnd() * 2 - 1));
      }
      return [out, -21, 0, 0.2];
    }
    case "ting":
      return [bloom(mtof(cue.note), { decay: 0.8 }), -13 + 20 * Math.log10(g), 0, 0.25];
    case "ping":
      return [
        blip(mtof(cue.note), { decay: 0.3, harmonics: 0.2 }),
        -20 + 20 * Math.log10(g),
        0,
        0.5,
      ];
    case "sweep":
      return [
        sweep(dur, 300, 1600, { q: 0.9, seed, attack: 0.6 }),
        -24 + 20 * Math.log10(g),
        (p) => p * 0.6 - 0.3,
        0.3,
      ];
    case "blink":
      return [
        layer([
          [0, burst(0.012, 900, { seed, type: "bp", q: 1.5 })],
          [0, blip(mtof(66), { decay: 0.014 }), 0.5],
        ]),
        -24,
        0,
        0.1,
      ];
    case "riser":
      return [riser(dur), -13, 0, 0.15];
    case "flash":
      return [
        layer([
          [0, normalize(sweep(0.9, 3200, 800, { attack: 0.02, q: 0.7, seed, curve: 2.5 })), 0.5],
          [0, normalize(thump(mtof(26), { from: 2.5, decay: 0.6 }))],
          [0, taiko(mtof(38), { decay: 0.45, seed }), 0.6],
          [0, braam(mtof(38), { dur: 1.8, open: 1200 }), 0.5],
        ]),
        -9,
        0,
        0.2,
        0.4,
      ];
    case "bloom":
      return [sweep(0.9, 1800, 250, { q: 0.8, attack: 0.25, seed }), -18, 0, 0.4];
    case "tap":
      return [
        layer([
          [0, blip(mtof(62), { decay: 0.05, from: 1.4, drop: 0.01 })],
          [0, burst(0.006, 1500, { seed, type: "bp" }), 0.4],
        ]),
        -17 + 20 * Math.log10(g),
        0,
        0.15,
      ];
    case "sparkle": {
      const notes = cue.bright ? [50, 57, 62] : [50, 57];
      return [
        layer(notes.map((n, i) => [i * 0.04, bloom(mtof(n), { decay: 0.5 }), 1 - i * 0.15])),
        (cue.bright ? -14 : -19) + 20 * Math.log10(g),
        0.1,
        0.3,
      ];
    }
    case "stroke":
      return [sweep(dur, 700, 1800, { q: 0.7, attack: 0.3, seed }), -22, (p) => p - 0.5, 0.2];
    case "whoosh": {
      const [f0, f1] =
        cue.dir === "down"
          ? [1800, 250]
          : cue.low
            ? [120, 600]
            : cue.high
              ? [800, 3000]
              : [250, 1800];
      const pan = cue.dir === "right" ? (p) => p * 1.2 - 0.6 : 0;
      return [
        sweep(dur, f0, f1, { q: 0.9, seed, attack: 0.6 }),
        -16 + 20 * Math.log10(g),
        pan,
        0.25,
      ];
    }
    case "zip": {
      const out = new Float32Array(samples(dur));
      let phase = 0;
      for (let i = 0; i < out.length; i++) {
        const p = i / out.length;
        phase += (120 * 3 ** p) / SR;
        out[i] = sin(phase) * Math.sin(Math.PI * p) ** 1.5;
      }
      return [
        layer([
          [0, out],
          [0, normalize(sweep(dur, 300, 2000, { seed, attack: 0.7 })), 0.5],
        ]),
        -20,
        (p) => p - 0.5,
        0.3,
      ];
    }
    case "pop":
      return [
        blip(mtof(cue.note), { decay: 0.07, from: 1.6, drop: 0.012 }),
        -16 + 20 * Math.log10(g),
        0,
        0.2,
      ];
    case "key": {
      // No pitch at all: a soft switch click over the dull thock of the keycap bottoming out.
      const rnd = random(cue.seed * 97 + 3);
      const vel = 0.6 + rnd() * 0.4;
      const sig = layer([
        [
          0,
          normalize(burst(0.004, 1800 + rnd() * 600, { seed: cue.seed, type: "bp", q: 0.8 })),
          0.5,
        ],
        [0.002, normalize(burst(0.03, 240 + rnd() * 120, { seed: cue.seed + 50, type: "lp" }))],
      ]);
      return [sig, -21 + 20 * Math.log10(vel), rnd() * 0.4 - 0.2, 0.05];
    }
    case "tick":
      return [
        layer([
          [0, normalize(burst(0.004, 2000, { seed, type: "bp", q: 0.8 })), 0.6],
          [0, normalize(burst(0.02, 400, { seed: seed + 1, type: "lp" }))],
        ]),
        -24 + 20 * Math.log10(g),
        0,
        0.08,
      ];
    case "click":
      return [
        layer([
          [0, thump(mtof(50), { from: 1.4, decay: 0.035 })],
          [0, burst(0.004, 1800, { seed, type: "bp" }), 0.5],
          [0, blip(mtof(69), { decay: 0.012 }), 0.4],
        ]),
        -15,
        0,
        0.12,
      ];
    case "shimmer": {
      const st = grains(dur, { seed });
      return { l: st.l, r: st.r, level: -22, send: 0.35 };
    }
    case "approve": {
      const [a, b] = cue.step ? [52, 59] : [50, 57];
      return [
        layer([
          [0, mallet(mtof(a), { decay: 0.14 })],
          [0.07, mallet(mtof(b), { decay: 0.2 })],
        ]),
        -16,
        0.1,
        0.15,
      ];
    }
    case "discard":
      return [
        layer([
          [0, blip(400, { decay: 0.1, from: 0.45, drop: 0.08 })],
          [0, burst(0.05, 500, { type: "lp", seed }), 0.3],
        ]),
        -20,
        -0.1,
        0.15,
      ];
    case "chime":
      return [
        layer([
          [0, mallet(mtof(50), { decay: 0.3 })],
          [0.08, mallet(mtof(54), { decay: 0.3 }), 0.85],
          [0.16, mallet(mtof(57), { decay: 0.45 }), 0.8],
        ]),
        -14,
        0,
        0.2,
      ];
    case "land":
      return [
        layer([
          [0, thump(mtof(cue.soft ? 38 : 33), { from: 2, decay: 0.22 })],
          [0, burst(0.06, 380, { type: "lp", seed }), 0.35],
        ]),
        cue.soft ? -16 : -13,
        0,
        0.15,
      ];
    case "riffle":
      return [
        layer(
          Array.from({ length: 9 }, (_, i) => [
            i * 0.028,
            burst(0.01, 900 + i * 50, { seed: seed + i, type: "bp", q: 1.2 }),
            1 - i * 0.06,
          ]),
        ),
        -22 + 20 * Math.log10(g),
        (p) => p * 0.4 - 0.2,
        0.15,
      ];
    case "thock":
      return [
        layer([
          [0, thump(mtof(57), { from: 1.3, decay: 0.05 })],
          [0, burst(0.006, 1400, { seed, type: "bp" }), 0.45],
        ]),
        -13,
        0,
        0.1,
      ];
    case "flip":
      return [
        layer([
          [0, sweep(0.34, 600, 2400, { q: 0.8, attack: 0.45, seed })],
          [0.1, thump(mtof(42), { decay: 0.12 }), 0.25],
        ]),
        -15,
        (p) => 0.3 - p * 0.6,
        0.2,
      ];
    case "swish":
      return [
        sweep(0.4, 500, 1800, { q: 0.8, attack: 0.5, seed }),
        -19 + 20 * Math.log10(g),
        0,
        0.2,
      ];
    case "review":
      return [
        layer([
          [0, mallet(mtof(cue.note), { decay: 0.32, wood: 0.25 })],
          [0, mallet(mtof(cue.note - 12), { decay: 0.4, wood: 0 }), 0.45],
          [0, taiko(mtof(38), { decay: 0.2, seed }), 0.25],
        ]),
        -13,
        (cue.note - 66) / 12,
        0.2,
      ];
    case "whip":
      return [
        sweep(0.34, 400, 4000, { q: 0.7, attack: 0.72, seed, curve: 2.4 }),
        -10,
        (p) => 0.6 - p * 1.2,
        0.2,
      ];
    case "hit": {
      const f = mtof(cue.note);
      const low = mtof(28 + ((cue.note - 28) % 12)); // the chord's root, between E1 and D#2
      const stab = new Float32Array(samples(0.6));
      for (let i = 0; i < stab.length; i++) {
        const t = i / SR;
        let v = 0;
        for (const [ratio, amp] of [
          [1, 1],
          [1.5, 0.6],
          [2, 0.5],
          [3, cue.bright ? 0.35 : 0.15],
        ])
          v += amp * sin(f * ratio * t);
        stab[i] = v * Math.exp(-t / 0.16) * Math.min(1, t / 0.003);
      }
      return [
        layer([
          [0, normalize(thump(low, { from: 2.4, decay: 0.45 }))],
          [0, taiko(low, { decay: 0.3, seed }), 0.7],
          [0, braam(f / 2, { dur: 0.9, attack: 0.02, open: cue.bright ? 1800 : 1200 }), 0.55],
          [0, burst(0.04, cue.bright ? 2400 : 1400, { seed }), 0.6],
          [0, normalize(stab), 0.35],
        ]),
        -6,
        0,
        0.15,
        0.35,
      ];
    }
    case "impact":
      return [
        layer([
          [0, normalize(thump(mtof(26), { from: 3, decay: 0.9 }))],
          [0, taiko(mtof(38), { decay: 0.6, seed }), 0.7],
          [0, braam(mtof(38), { dur: 3.2, attack: 0.03, open: 1500 }), 0.6],
          [0, normalize(sweep(1.4, 2400, 300, { attack: 0.01, q: 0.7, seed, curve: 2.2 })), 0.3],
        ]),
        -7,
        0,
        0.15,
        0.6,
      ];
    case "swoosh":
      return [sweep(dur, 400, 1400, { q: 0.9, attack: 0.5, seed }), -21, 0, 0.3];
    default:
      return null;
  }
}

// ─── Music bed ──────────────────────────────────────────────────────────────

const CHORDS = {
  Dmaj9: [50, 57, 61, 64, 66],
  Bm11: [47, 54, 57, 62, 64],
  Gmaj9: [43, 50, 54, 57, 59],
  Em9: [40, 47, 50, 55, 66],
  A6sus: [45, 52, 54, 59, 62],
  Bm7: [47, 54, 57, 62],
  Gmaj7: [43, 50, 54, 59],
  Asus4: [45, 52, 57, 62],
  Dresolve: [38, 45, 54, 61, 64, 69],
};
const BPM = 100;

/** Warm pad: detuned, softly filtered saw partials, panned wide. */
function pad(bus, send, notes, t0, t1, { attack = 0.7, release = 1.1, level = -21 } = {}) {
  const start = samples(t0);
  const length = samples(t1 - t0 + release);
  const gain = db(level) / Math.sqrt(notes.length);
  for (const [n, note] of notes.entries()) {
    const f = mtof(note);
    const weight = note < 48 ? 0.45 : 1; // keep the low voicing from muddying the mix
    for (const [detune, pan] of [
      [-0.004, -0.55],
      [0.004, 0.55],
    ]) {
      const a = ((pan + 1) * Math.PI) / 4;
      const [gl, gr] = [Math.cos(a), Math.sin(a)];
      const fd = f * (1 + detune);
      const harmonics = Math.min(9, Math.floor(6000 / fd));
      for (let i = 0; i < length; i++) {
        const t = i / SR;
        const env =
          Math.min(1, t / attack) ** 2 *
          (t > t1 - t0 ? Math.exp(-(t - (t1 - t0)) / (release / 3)) : 1);
        let v = 0;
        for (let k = 1; k <= harmonics; k++)
          v += (sin(fd * k * t + n * 0.13) / k) * Math.exp(-(k - 1) * 0.7);
        const breathe = 1 + 0.08 * Math.sin(TAU * 0.21 * t + n);
        const s = v * env * breathe * gain * weight;
        const j = start + i;
        if (j >= bus.l.length) break;
        bus.l[j] += s * gl;
        bus.r[j] += s * gr;
        send.l[j] += s * gl * 0.5;
        send.r[j] += s * gr * 0.5;
      }
    }
  }
  // A quiet sub under the root.
  const root = notes[0] >= 45 ? notes[0] - 12 : notes[0];
  const sub = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SR;
    sub[i] =
      sin(mtof(root) * t) *
      Math.min(1, t / attack) *
      (t > t1 - t0 ? Math.exp(-(t - (t1 - t0)) / 0.3) : 1);
  }
  bus.add(t0, sub, db(level - 9));
}

function renderBed(cues, duration, bus, send) {
  const chords = cues.filter((c) => c.type === "chord");
  chords.forEach((c, i) => {
    const t1 = i + 1 < chords.length ? chords[i + 1].t : duration;
    const resolve = c.name === "Dresolve";
    pad(bus, send, CHORDS[c.name], c.t, t1, {
      attack: resolve ? 1.1 : 0.7,
      level: resolve ? -19 : -21,
    });
  });
  // The review notes carry the rhythm while they play, off the beat grid, so the arpeggio and
  // drums step aside for them.
  const reviews = cues.filter((c) => c.type === "review");
  const [hushFrom, hushTo] = reviews.length
    ? [reviews[0].t - 0.15, reviews.at(-1).t + 0.3]
    : [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  // The arpeggio: a soft, low pluck on 8th notes through the current chord's upper tones.
  const on = cues.find((c) => c.type === "pulse" && c.on);
  const off = cues.find((c) => c.type === "pulse" && !c.on);
  if (on) {
    const step = 60 / BPM / 2;
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let k = 0, t = on.t; t < (off ? off.t : duration); k++, t = on.t + k * step) {
      if (t > hushFrom && t < hushTo) continue;
      const chord = [...chords].reverse().find((c) => c.t <= t + 1e-6) ?? chords[0];
      const tones = CHORDS[chord.name].slice(-4);
      const note = tones[pattern[k % pattern.length] % tones.length];
      const accent = k % 4 === 0 ? 1 : 0.7;
      const sig = blip(mtof(note), { decay: 0.16, harmonics: 0.15 });
      const fade = Math.min(1, (t - on.t) / 1.2); // eases in from the aperture
      bus.add(t, sig, db(-25) * accent * fade, k % 2 ? 0.3 : -0.3);
      send.add(t, sig, db(-25) * accent * fade * 0.5, k % 2 ? 0.3 : -0.3);
    }
  }
  // Drums: a taiko pulse on the beat grid that builds from the aperture (one hit a bar, then
  // two, then four), rests under the review notes, and rolls in 16ths into the features' whip.
  const whip = cues.find((c) => c.type === "whip");
  if (on) {
    const step = 60 / BPM / 4;
    const end = whip ? whip.t - 0.04 : off ? off.t : duration;
    const buildTo = Math.min(hushFrom, end - 0.6);
    const rollFrom = Math.max(buildTo, Math.min(hushTo, end - 0.3));
    for (let k = 0, t = on.t; t < end; k++, t = on.t + k * step) {
      const roll = t >= rollFrom;
      if (!roll && t >= buildTo) continue;
      const p = roll ? (t - rollFrom) / (end - rollFrom) : (t - on.t) / (buildTo - on.t);
      const every = roll ? 1 : p < 0.35 ? 16 : p < 0.7 ? 8 : 4;
      if (k % every) continue;
      const down = !roll && k % 16 === 0;
      const vel = roll ? 0.45 + 0.55 * p : (down ? 1 : k % 8 === 0 ? 0.8 : 0.65) * (0.5 + 0.5 * p);
      const sig = taiko(mtof(down ? 33 : roll || k % 8 ? 40 : 38), {
        decay: down ? 0.4 : 0.22,
        seed: k + 1,
      });
      const pan = down ? 0 : k % 8 === 0 ? -0.2 : 0.2;
      bus.add(t, sig, db(-5) * vel, pan);
      send.add(t, sig, db(-5) * vel * 0.6, pan);
    }
  }
  // At the resolve: a deep swell under the final chord.
  const resolve = chords.find((c) => c.name === "Dresolve");
  if (resolve) {
    for (const [dt, note, level] of [
      [0.1, 38, -24],
      [0.35, 45, -27],
    ]) {
      const sig = normalize(bloom(mtof(note), { attack: 0.6, decay: 1.6 }));
      bus.add(resolve.t + dt, sig, db(level));
      send.add(resolve.t + dt, sig, db(level - 4));
    }
  }
}

// ─── Reverb and dynamics ────────────────────────────────────────────────────

/** Freeverb: eight damped combs and four allpasses per side. */
function freeverb(bus, { room = 0.84, damp = 0.3 } = {}) {
  const scale = SR / 44100;
  const make = (t) => ({ buf: new Float32Array(Math.round(t * scale)), i: 0, store: 0 });
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const passes = [556, 441, 341, 225];
  const sides = [0, 23].map((spread) => ({
    combs: combs.map((t) => make(t + spread)),
    passes: passes.map((t) => make(t + spread)),
  }));
  const feedback = room * 0.28 + 0.7;
  const d1 = damp * 0.4;
  const out = { l: new Float32Array(bus.l.length), r: new Float32Array(bus.l.length) };
  for (let i = 0; i < bus.l.length; i++) {
    const x = (bus.l[i] + bus.r[i]) * 0.015;
    sides.forEach((side, s) => {
      let y = 0;
      for (const c of side.combs) {
        const v = c.buf[c.i];
        c.store = v * (1 - d1) + c.store * d1;
        c.buf[c.i] = x + c.store * feedback;
        c.i = (c.i + 1) % c.buf.length;
        y += v;
      }
      for (const a of side.passes) {
        const b = a.buf[a.i];
        a.buf[a.i] = y + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = b - y;
      }
      (s ? out.r : out.l)[i] = y;
    });
  }
  return out;
}

/** Look-ahead peak limiter: holds the mix under `ceiling` without audible pumping. */
function limit({ l, r }, { ceiling = db(-1), lookahead = 0.005, release = 0.08 } = {}) {
  const n = l.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++)
    need[i] = Math.min(1, ceiling / Math.max(1e-9, Math.abs(l[i]), Math.abs(r[i])));
  const ahead = samples(lookahead);
  const rel = 1 - Math.exp(-1 / (release * SR));
  let gain = 1;
  for (let i = 0; i < n; i++) {
    let target = 1;
    for (let k = i; k < Math.min(n, i + ahead); k++) target = Math.min(target, need[k]);
    gain = target < gain ? target : gain + (target - gain) * rel;
    l[i] *= gain;
    r[i] *= gain;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Synthesises the sound-effects and music-bed stems for `cues` over `duration` seconds. */
export function renderSoundtrack(cues, duration) {
  const length = samples(duration);
  const sfx = new Bus(length);
  const sfxSend = new Bus(length);
  const sfxHall = new Bus(length);
  const bed = new Bus(length);
  const bedSend = new Bus(length);

  for (const cue of cues) {
    const fx = effect(cue);
    if (!fx) continue;
    if (Array.isArray(fx)) {
      const [sig, level, pan, send, hall] = fx;
      normalize(sig);
      sfx.add(cue.t, sig, db(level), pan);
      if (send) sfxSend.add(cue.t, sig, db(level) * send, pan);
      if (hall) sfxHall.add(cue.t, sig, db(level) * hall, pan);
    } else {
      let peak = 0;
      for (let i = 0; i < fx.l.length; i++)
        peak = Math.max(peak, Math.abs(fx.l[i]), Math.abs(fx.r[i]));
      peak ||= 1;
      for (const [side, bus] of [
        ["l", sfx],
        ["r", sfx],
      ]) {
        const s = samples(cue.t);
        for (let i = 0; i < fx[side].length && s + i < length; i++) {
          const v = (fx[side][i] / peak) * db(fx.level);
          bus[side][s + i] += v;
          sfxSend[side][s + i] += v * fx.send;
        }
      }
    }
  }
  renderBed(cues, duration, bed, bedSend);

  for (const [dry, sends] of [
    [
      sfx,
      [
        [sfxSend, { room: 0.72, damp: 0.55 }],
        [sfxHall, { room: 0.95, damp: 0.6 }],
      ],
    ],
    [bed, [[bedSend, { room: 0.9, damp: 0.5 }]]],
  ]) {
    for (const [send, opts] of sends) {
      const wet = freeverb(send, opts);
      for (let i = 0; i < length; i++) {
        dry.l[i] += wet.l[i];
        dry.r[i] += wet.r[i];
      }
    }
    // Round off the top: everything here is meant to sound felt, not glassy.
    for (const side of [dry.l, dry.r]) {
      const lp = new Filter("lp", 9000);
      for (let i = 0; i < length; i++) side[i] = lp.run(side[i]);
    }
  }
  return { sfx: { l: sfx.l, r: sfx.r }, bed: { l: bed.l, r: bed.r } };
}

/**
 * Gated loudness of a stereo signal in dB (EBU R128's gating without the K-weighting): a
 * fair way to compare a sparse effects stem with a continuous music bed.
 */
function loudness({ l, r }) {
  const block = samples(0.4);
  const hop = samples(0.1);
  const powers = [];
  for (let s = 0; s + block <= l.length; s += hop) {
    let sum = 0;
    for (let i = s; i < s + block; i++) sum += l[i] * l[i] + r[i] * r[i];
    powers.push(sum / block);
  }
  const gate = (list, floor) => list.filter((p) => p > floor);
  const mean = (list) => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
  const loud = gate(powers, 10 ** -7);
  const relative = gate(loud, mean(loud) / 10);
  return 10 * Math.log10(mean(relative) || 1e-12);
}

/** Music sits this far under the effects, whether it is the generated bed or a --music track. */
const MUSIC_UNDER_SFX = 2;

/**
 * Mixes the stems: the music is balanced against the effects and dips under each big hit,
 * everything fades over the last second, and a limiter leaves headroom for normalisation.
 */
export function mixSoundtrack({ sfx, bed }, cues, { bedGain = 1 } = {}) {
  const n = sfx.l.length;
  // Clear rumble from the music, then balance it against the effects.
  for (const side of [bed.l, bed.r]) {
    const hp = new Filter("hp", 45);
    for (let i = 0; i < n; i++) side[i] = hp.run(side[i]);
  }
  const balance = db(loudness(sfx) - MUSIC_UNDER_SFX - loudness(bed)) * bedGain;
  const duck = new Float32Array(n).fill(1);
  for (const cue of cues) {
    if (!["hit", "flash", "impact"].includes(cue.type)) continue;
    const s = samples(cue.t);
    for (let i = 0; i < samples(0.7) && s + i < n; i++) {
      duck[s + i] = Math.min(duck[s + i], 1 - 0.5 * Math.exp(-i / (SR * 0.2)));
    }
  }
  const fadeFrom = n - samples(1);
  const mix = { l: new Float32Array(n), r: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const fade = i > fadeFrom ? (n - i) / (n - fadeFrom) : 1;
    mix.l[i] = (sfx.l[i] + bed.l[i] * duck[i] * balance) * fade;
    mix.r[i] = (sfx.r[i] + bed.r[i] * duck[i] * balance) * fade;
  }
  // Block DC before the limiter.
  for (const side of [mix.l, mix.r]) {
    let x1 = 0;
    let y1 = 0;
    for (let i = 0; i < n; i++) {
      const y = side[i] - x1 + 0.9974 * y1;
      x1 = side[i];
      side[i] = y;
      y1 = y;
    }
  }
  // Bring the peak to 0 dBFS, then let the limiter take the top 4 dB off the loudest hits.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix.l[i]), Math.abs(mix.r[i]));
  const gain = db(4) / (peak || 1);
  for (let i = 0; i < n; i++) {
    mix.l[i] *= gain;
    mix.r[i] *= gain;
  }
  limit(mix);
  return mix;
}

/** Deinterleaves raw 32-bit float stereo PCM (as ffmpeg's f32le output) into channels. */
export function fromInterleaved(buffer, duration) {
  const floats = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    Math.floor(buffer.byteLength / 4),
  );
  const n = samples(duration);
  const out = { l: new Float32Array(n), r: new Float32Array(n) };
  for (let i = 0; i < n && i * 2 + 1 < floats.length; i++) {
    out.l[i] = floats[i * 2];
    out.r[i] = floats[i * 2 + 1];
  }
  return out;
}

/** Writes a stereo 32-bit float WAV. */
export function writeWav(path, { l, r }) {
  const data = Buffer.alloc(l.length * 8);
  for (let i = 0; i < l.length; i++) {
    data.writeFloatLE(l[i], i * 8);
    data.writeFloatLE(r[i], i * 8 + 4);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 8, 28);
  header.writeUInt16LE(8, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}
