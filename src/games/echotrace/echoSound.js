/*
 * Original generated sounds (Web Audio API), no samples and no copyrighted audio.
 * Each piece type has its own sound identity. Replace `play` with audio files if you want.
 */
let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(c, { f, to, type = "sine", t = 0, d = 0.3, g = 0.15 }) {
  const o = c.createOscillator();
  const a = c.createGain();
  const s = c.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, s);
  if (to) o.frequency.exponentialRampToValueAtTime(to, s + d);
  a.gain.setValueAtTime(0.0001, s);
  a.gain.exponentialRampToValueAtTime(g, s + 0.015);
  a.gain.exponentialRampToValueAtTime(0.0001, s + d);
  o.connect(a);
  a.connect(c.destination);
  o.start(s);
  o.stop(s + d + 0.05);
}

export const SOUND_IDENTITIES = {
  p: { label: "Tick", play: (c) => tone(c, { f: 520, type: "triangle", d: 0.09, g: 0.12 }) },
  r: { label: "Thud", play: (c) => { tone(c, { f: 130, to: 55, d: 0.38, g: 0.3 }); tone(c, { f: 90, type: "square", d: 0.1, g: 0.06 }); } },
  b: { label: "Chime", play: (c) => { tone(c, { f: 740, d: 0.5, g: 0.1 }); tone(c, { f: 1110, t: 0.04, d: 0.4, g: 0.05 }); } },
  n: { label: "Gallop", play: (c) => { [0, 0.1, 0.2].forEach((t, i) => tone(c, { f: i === 2 ? 470 : 300, type: "triangle", t, d: 0.08, g: 0.14 })); } },
  q: { label: "Chord", play: (c) => [392, 494, 587].forEach((f) => tone(c, { f, d: 0.6, g: 0.08 })) },
  k: { label: "Toll", play: (c) => { tone(c, { f: 147, d: 0.9, g: 0.22 }); tone(c, { f: 295, d: 0.7, g: 0.07 }); } },
};

/* Called when an opponent move is detected. */
export function playEchoSound(piece, enabled = true) {
  if (!enabled) return;
  const c = getCtx();
  if (c && SOUND_IDENTITIES[piece]) SOUND_IDENTITIES[piece].play(c);
}

export function playRejected(enabled = true) {
  if (!enabled) return;
  const c = getCtx();
  if (c) tone(c, { f: 180, to: 120, type: "sawtooth", d: 0.18, g: 0.06 });
}