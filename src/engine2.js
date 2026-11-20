
/* Stockfish Web Worker Engine
   Files:
   public/stockfish/stockfish-19-lite-single.js
   public/stockfish/stockfish-19-lite-single.wasm
*/

const WORKER_URL = "/stockfish/stockfish-19-lite-single.js";

let shared = null;
let retainCount = 0;

/* Poori app mein ek shared engine */
export function getEngine() {
  if (!shared) {
    shared = createEngine();
  }

  return shared;
}

/* Engine ko use karne wale components ka reference count */
export function retainEngine() {
  retainCount++;

  let released = false;

  return () => {
    if (released) return;
    released = true;

    retainCount = Math.max(0, retainCount - 1);

    if (retainCount === 0) {
      destroyEngine();
    }
  };
}

/* Current search cancel karo */
export function cancelEngine() {
  if (shared) {
    shared.cancel();
  }
}

/* Engine destroy karo */
export function destroyEngine() {
  if (shared) {
    const engine = shared;
    shared = null;
    engine.destroy();
  }
}

/* UCI info parse karo */
function parseInfo(line, turn) {
  if (line.includes("lowerbound") || line.includes("upperbound")) {
    return null;
  }

  const depth = /\bdepth (\d+)/.exec(line);
  const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
  const pv = / pv (.+)$/.exec(line);

  if (!depth || !score || !pv) return null;

  const multipv = /\bmultipv (\d+)/.exec(line);
  const sign = turn === "w" ? 1 : -1;
  const value = Number(score[2]) * sign;

  return {
    multipv: multipv ? Number(multipv[1]) : 1,
    depth: Number(depth[1]),
    cp: score[1] === "cp" ? value : null,
    mate: score[1] === "mate" ? value : null,
    pv: pv[1].trim().split(/\s+/),
  };
}

function createEngine() {
  const worker = new Worker(WORKER_URL);

  let ready = false;
  let busy = false;
  let failed = null;
  let destroyed = false;

  let job = null;
  let queued = null;

  const send = (cmd) => {
    if (!destroyed) {
      worker.postMessage(cmd);
    }
  };

  function pump() {
    if (!ready || busy || !queued || destroyed) return;

    job = queued;
    queued = null;
    busy = true;

    send(`setoption name MultiPV value ${job.multipv}`);
    send(`position fen ${job.fen}`);
    send(`go depth ${job.depth}`);
  }

  worker.onmessage = (event) => {
    const line = typeof event.data === "string" ? event.data : "";

    if (line === "uciok") {
      send("isready");
      return;
    }

    if (line === "readyok") {
      ready = true;
      pump();
      return;
    }

    if (line.startsWith("info") && job && !job.cancelled) {
      const parsed = parseInfo(line, job.turn);
      if (!parsed) return;

      job.lines[parsed.multipv] = parsed;

      const list = Object.values(job.lines).sort(
        (a, b) => a.multipv - b.multipv
      );

      job.onUpdate?.(list);
      return;
    }

    if (line.startsWith("bestmove")) {
      const done = job;

      job = null;
      busy = false;

      if (done) {
        done.resolve(!done.cancelled);
      }

      pump();
    }
  };

  worker.onerror = () => {
    failed = new Error(
      "The chess engine could not load. Check that the /stockfish/ folder has both the .js and .wasm files."
    );

    if (job) job.reject(failed);
    if (queued) queued.reject(failed);

    job = null;
    queued = null;
    busy = false;
  };

  send("uci");

  return {
    analyse(fen, { depth = 10, multipv = 3, onUpdate } = {}) {
      return new Promise((resolve, reject) => {
        if (destroyed) {
          reject(new Error("Chess engine has been destroyed."));
          return;
        }

        if (failed) {
          reject(failed);
          return;
        }

        if (queued) {
          queued.resolve(false);
        }

        queued = {
          fen,
          depth,
          multipv,
          onUpdate,
          resolve,
          reject,
          turn: fen.split(" ")[1] || "w",
          lines: {},
          cancelled: false,
        };

        if (busy && job) {
          job.cancelled = true;
          send("stop");
        } else {
          pump();
        }
      });
    },

    cancel() {
      if (queued) {
        queued.resolve(false);
        queued = null;
      }

      if (busy && job) {
        job.cancelled = true;
        send("stop");
      }
    },

    destroy() {
      if (destroyed) return;

      destroyed = true;

      const error = new Error("Chess engine destroyed.");

      if (job) job.reject(error);
      if (queued) queued.reject(error);

      job = null;
      queued = null;
      busy = false;

      try {
        worker.postMessage("quit");
      } catch {
        // Ignore shutdown errors
      }

      worker.terminate();
    },
  };
}
