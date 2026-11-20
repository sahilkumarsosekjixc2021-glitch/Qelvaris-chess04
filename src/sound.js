const SOUND_FILES = {
  move: "/sounds/move.wav",
  capture: "/sounds/capture.wav",
  castle: "/sounds/castle.wav",
  promotion: "/sounds/promotion.wav",

  click: "/sounds/click.wav",
  check: "/sounds/check.wav",
  checkmate: "/sounds/checkmate.wav",

  gameStart: "/sounds/game-start.wav",
  "game-start": "/sounds/game-start.wav",

  lowTime: "/sounds/low-time.wav",
  "low-time": "/sounds/low-time.wav",

  win: "/sounds/win.wav",
  loss: "/sounds/loss.wav",
  draw: "/sounds/draw.wav"
};

const ALIASES = {
  "ui-click": "click",
  uiClick: "click",
  gameStart: "game-start",
  lowTime: "low-time"
};

let audioContext = null;
let masterGain = null;
let unlocked = false;
let muted = false;
let volume = 0.7;
const buffers = new Map();
const loading = new Map();
let lastPlayedAt = {};

function getContext() {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

export async function unlockAudio() {
  const ctx = getContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    unlocked = ctx.state === "running";
    return unlocked;
  } catch (error) {
    console.warn("Qelvaris audio unlock failed:", error);
    return false;
  }
}

async function loadSound(name) {
  const path = SOUND_FILES[name];
  if (!path) return null;

  if (buffers.has(name)) return buffers.get(name);
  if (loading.has(name)) return loading.get(name);

  const ctx = getContext();
  if (!ctx) return null;

  const request = fetch(path)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Audio file not found: ${path}`);
      }
      return response.arrayBuffer();
    })
    .then(data => ctx.decodeAudioData(data))
    .then(buffer => {
      buffers.set(name, buffer);
      loading.delete(name);
      return buffer;
    })
    .catch(error => {
      loading.delete(name);
      console.warn(error.message);
      return null;
    });

  loading.set(name, request);
  return request;
}

export async function preloadSounds() {
  const names = [...new Set(Object.keys(SOUND_FILES).map(
    name => ALIASES[name] || name
  ))];

  await Promise.all(names.map(loadSound));
}

export function playSound(requestedName, options = {}) {
  if (muted) return;

  const name = ALIASES[requestedName] || requestedName;
  if (!SOUND_FILES[name]) return;

  const ctx = getContext();
  if (!ctx || !unlocked || ctx.state !== "running") return;

  const now = performance.now();
  const cooldown = options.cooldown ?? 45;

  if (now - (lastPlayedAt[name] || 0) < cooldown) return;
  lastPlayedAt[name] = now;

  const buffer = buffers.get(name);

  if (!buffer) {
    loadSound(name).then(() => {
      if (buffers.has(name)) {
        playSound(requestedName, { ...options, cooldown: 0 });
      }
    });
    return;
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();

  source.buffer = buffer;
  gain.gain.value = options.volume ?? 1;

  source.connect(gain);
  gain.connect(masterGain);
  source.start(0);
}

export function setSoundSettings(settings = {}) {
  if (typeof settings.muted === "boolean") {
    muted = settings.muted;
  }

  if (typeof settings.volume === "number") {
    volume = Math.max(0, Math.min(1, settings.volume));

    if (masterGain) {
      masterGain.gain.value = volume;
    }
  }
}

export function getSoundSettings() {
  return { muted, volume };
}

export async function previewSound(name) {
  await unlockAudio();
  playSound(name, { cooldown: 0 });
}
