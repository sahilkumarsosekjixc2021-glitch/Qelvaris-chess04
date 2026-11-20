// Qelvaris — chhota UCI client. Kisi bhi Stockfish web worker se baat kar sakta hai
// (jo postMessage("uci") jaise string commands samajhta ho).
//
// analyze(fen, { multipv, depth, movetime }) -> { depth, lines: [{ multipv, scoreType, score, pv }] }
//   score side-to-move ke nazariye se hota hai (UCI ka default).
// bestMove(fen, { movetime, skill }) -> "e2e4" | null

const BOUND = /\b(lowerbound|upperbound)\b/;

export function parseInfo(line) {
  const depth = /\bdepth (\d+)/.exec(line);
  const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
  const pv = / pv (.+)$/.exec(line);
  if (!depth || !score || !pv) return null;
  const multipv = /\bmultipv (\d+)/.exec(line);
  return {
    depth: Number(depth[1]),
    multipv: multipv ? Number(multipv[1]) : 1,
    scoreType: score[1] === "mate" ? "mate" : "cp",
    score: Number(score[2]),
    pv: pv[1].trim().split(/\s+/),
  };
}

export function createUciClient(worker) {
  let handler = null;
  let chain = Promise.resolve();

  worker.onmessage = (event) => {
    const data = event && typeof event === "object" && "data" in event ? event.data : event;
    const text = typeof data === "string" ? data : String(data ?? "");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (line && handler) handler(line);
    }
  };

  const send = (cmd) => worker.postMessage(cmd);

  // Ek time par ek hi kaam. Har kaam se pehle isready/readyok, taaki purani (timeout wali)
  // bestmove line naye kaam mein na ghus jaye.
  function run(commands, onLine, { timeoutMs = 20000, sync = true } = {}) {
    const job = chain.then(
      () =>
        new Promise((resolve, reject) => {
          let phase = sync ? "sync" : "work";
          let timer = null;

          const finish = (err, value) => {
            clearTimeout(timer);
            handler = null;
            if (err) reject(err);
            else resolve(value);
          };

          timer = setTimeout(() => {
            try {
              send("stop");
            } catch {
              /* ignore */
            }
            finish(new Error("ENGINE_TIMEOUT"));
          }, timeoutMs);

          handler = (line) => {
            if (phase === "sync") {
              if (line === "readyok") {
                phase = "work";
                for (const c of commands) send(c);
              }
              return;
            }
            try {
              const out = onLine(line);
              if (out !== undefined) finish(null, out);
            } catch (err) {
              finish(err);
            }
          };

          if (sync) send("isready");
          else for (const c of commands) send(c);
        })
    );
    chain = job.catch(() => {});
    return job;
  }

  return {
    async init() {
      await run(["uci"], (l) => (l === "uciok" ? true : undefined), { timeoutMs: 10000, sync: false });
      await run(["isready"], (l) => (l === "readyok" ? true : undefined), { timeoutMs: 10000, sync: false });
      return true;
    },

    analyze(fen, { multipv = 3, depth = 12, movetime = 0 } = {}) {
      const found = new Map();
      let top = 0;
      const go = movetime ? `go movetime ${movetime}` : `go depth ${depth}`;
      const commands = [
        "setoption name Skill Level value 20",
        `setoption name MultiPV value ${multipv}`,
        `position fen ${fen}`,
        go,
      ];

      return run(
        commands,
        (line) => {
          if (line.startsWith("info") && !BOUND.test(line)) {
            const info = parseInfo(line);
            if (info) {
              found.set(info.multipv, info);
              top = Math.max(top, info.depth);
            }
            return undefined;
          }
          if (line.startsWith("bestmove")) {
            const lines = [...found.values()]
              .sort((a, b) => a.multipv - b.multipv)
              .map(({ multipv: m, scoreType, score, pv }) => ({ multipv: m, scoreType, score, pv }));
            return { depth: top, lines };
          }
          return undefined;
        },
        { timeoutMs: movetime ? movetime + 15000 : 30000 }
      );
    },

    bestMove(fen, { movetime = 300, skill = 20 } = {}) {
      const commands = [
        `setoption name Skill Level value ${skill}`,
        "setoption name MultiPV value 1",
        `position fen ${fen}`,
        `go movetime ${movetime}`,
      ];

      return run(
        commands,
        (line) => {
          if (!line.startsWith("bestmove")) return undefined;
          const move = line.split(/\s+/)[1];
          return move && move !== "(none)" ? move : null;
        },
        { timeoutMs: movetime + 15000 }
      );
    },

    terminate() {
      try {
        worker.terminate?.();
      } catch {
        /* ignore */
      }
    },
  };
}
