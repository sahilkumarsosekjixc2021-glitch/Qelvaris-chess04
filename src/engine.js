import { makeEval, parseInfoLine, terminalEval } from "./chessUtils";

export const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";

/*
  Stockfish ko ek baar chalake bahut saari games analyse karta hai.
  Har position sirf ek baar analyse hoti hai. Position i ka result move i ke pehle
  aur move i-1 ke baad, dono ke liye kaam aata hai.

  const engine = createEngine({ multiPv: 2 });
  const evals = await engine.analyseGame(parsed, { depth: 8, onProgress });
  engine.stop();
*/
export function createEngine({ multiPv = 2 } = {}) {
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

      const lines = Object.values(job.found)
        .sort((a, b) => a.mpv - b.mpv)
        .map((item) => ({ uci: item.pv.split(" ")[0], score: item.score, pvUci: item.pv }));

      if (!lines.length) {
        const token = line.split(" ")[1];
        const uci = token && token !== "(none)" ? token : "";
        lines.push({ uci, score: 0, pvUci: uci });
      }

      job.resolve(makeEval(job.fen, lines));
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
            worker.postMessage(`setoption name MultiPV value ${multiPv}`);
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

  function analysePosition(fen, depth) {
    return new Promise((resolve, reject) => {
      pending = { fen, found: {}, resolve, reject };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }

  async function analyseGame(parsed, { depth = 10, onProgress } = {}) {
    await boot();

    const total = parsed.fens.length;
    const evals = new Array(total).fill(null);

    for (let i = 0; i < total; i += 1) {
      if (stopped) throw new Error("stopped");

      const terminal = terminalEval(parsed.fens[i]);
      evals[i] = terminal || (await analysePosition(parsed.fens[i], depth));

      if (onProgress) onProgress(i + 1, total);
    }

    return evals;
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

  return { analyseGame, stop };
}