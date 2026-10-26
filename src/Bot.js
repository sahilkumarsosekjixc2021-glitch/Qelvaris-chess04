import { ENGINE_URL } from "./engine";
import { parseInfoLine } from "./chessUtils";
import { Chess } from "chess.js";

/*
  Play ke bots. Stockfish ko "Skill Level" aur thoda sa sochne ka time diya jaata hai (level 1 se 8).
  Personality sirf ye tay karti hai ki engine ki achhi chaalon mein se kaun si chuni jaaye:
    Solid     engine ki pehli pasand
    Attacker  capture ya check wali achhi chaal ko pehle chunta hai
    Trickster kabhi kabhi doosri sabse achhi chaal chunta hai, jo kam dikhne wali hoti hai
*/

export const PERSONALITIES = [
  { id: "solid", label: "Solid", text: "Plays safe, sensible moves and waits for your mistake." },
  { id: "attacker", label: "Attacker", text: "Goes for captures and checks. Tests whether you keep your pieces safe." },
  { id: "trickster", label: "Trickster", text: "Plays less obvious moves and sets small traps." },
];

// level 1..8: Stockfish Skill Level aur har chaal par kitne millisecond sochna hai
export const LEVELS = [
  { skill: 0, ms: 120 },
  { skill: 2, ms: 160 },
  { skill: 5, ms: 220 },
  { skill: 8, ms: 300 },
  { skill: 11, ms: 400 },
  { skill: 14, ms: 550 },
  { skill: 17, ms: 750 },
  { skill: 20, ms: 1000 },
];

function candidatesFor(fen, lines, level) {
  const botIsWhite = String(fen).split(" ")[1] === "w";
  const scored = lines
    .filter((line) => line.uci)
    .map((line) => ({ uci: line.uci, score: botIsWhite ? line.score : -line.score }))
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const tolerance = Math.max(0.35, 1.3 - level * 0.12); // pawns
  return scored.filter((line) => line.score >= scored[0].score - tolerance);
}

function describe(fen, uci) {
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return move ? { capture: Boolean(move.captured), check: /[+#]/.test(move.san) } : null;
  } catch {
    return null;
  }
}

export function choose(fen, lines, bestmove, personality, level, random = Math.random) {
  const pool = candidatesFor(fen, lines, level);
  if (!pool.length) return bestmove;

  if (personality === "attacker") {
    const forcing = pool.find((c) => {
      const d = describe(fen, c.uci);
      return d && (d.capture || d.check);
    });
    return forcing ? forcing.uci : bestmove || pool[0].uci;
  }

  if (personality === "trickster" && pool.length >= 2 && random() < 0.4) {
    return pool[1].uci;
  }

  return bestmove || pool[0].uci;
}

export function createBot() {
  let worker = null;
  let booting = null;
  let pending = null;
  let stopped = false;

  function onLine(line) {
    if (!pending) return;

    if (line.startsWith("info ")) {
      const info = parseInfoLine(line, pending.fen);
      const seen = pending.found[info?.mpv];
      if (info && (!seen || info.depth >= seen.depth)) pending.found[info.mpv] = info;
      return;
    }

    if (line.startsWith("bestmove")) {
      const job = pending;
      pending = null;

      const token = line.split(" ")[1];
      const bestmove = token && token !== "(none)" ? token : "";
      const lines = Object.values(job.found)
        .sort((a, b) => a.mpv - b.mpv)
        .map((item) => ({ uci: item.pv.split(" ")[0], score: item.score }));

      job.resolve({ bestmove, lines });
    }
  }

  function boot() {
    if (booting) return booting;

    booting = new Promise((resolve, reject) => {
      try {
        worker = new Worker(ENGINE_URL);
      } catch (error) {
        reject(error);
        return;
      }

      let stage = "uci";

      worker.onmessage = (event) => {
        const line = String(event.data || "");

        if (stage === "uci") {
          if (line === "uciok") {
            stage = "ready";
            worker.postMessage("setoption name MultiPV value 4");
            worker.postMessage("isready");
          }
        } else if (stage === "ready") {
          if (line === "readyok") {
            stage = "run";
            resolve();
          }
        } else {
          onLine(line);
        }
      };

      worker.onerror = () => {
        const error = new Error("Stockfish could not start");
        reject(error);
        if (pending) {
          pending.reject(error);
          pending = null;
        }
      };

      worker.postMessage("uci");
    });

    return booting;
  }

  // Aaj ki position par bot ki chaal (UCI, jaise "e7e5")
  async function pick(fen, { level = 4, personality = "solid" } = {}) {
    await boot();
    if (stopped) throw new Error("stopped");

    const setting = LEVELS[Math.min(8, Math.max(1, level)) - 1];
    worker.postMessage(`setoption name Skill Level value ${setting.skill}`);

    const result = await new Promise((resolve, reject) => {
      pending = { fen, found: {}, resolve, reject };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go movetime ${setting.ms}`);
    });

    return choose(fen, result.lines, result.bestmove, personality, level);
  }

  function stop() {
    stopped = true;

    if (worker) {
      try {
        worker.terminate();
      } catch {
        // ignore
      }
      worker = null;
    }

    if (pending) {
      pending.reject(new Error("stopped"));
      pending = null;
    }
  }

  return { pick, stop };
}