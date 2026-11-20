// Qelvaris — Stockfish worker ko dhoondh kar UCI client banata hai.
// Study Lab aur Practice Arena dono isi se engine lete hain.
//
// Stockfish apne aap nahi mila toh built-in basic engine chalta hai. Behtar analysis ke liye Stockfish jodo:
//  A) Stockfish ki .js file public/ folder mein hai toh uska URL niche ENGINE_URL mein likho, jaise "/stockfish.js"
//  B) Bundler se worker banta hai toh customWorker() mein wahi line do jo tumhare Review/engine file mein hai,
//     jaise:  return new Worker(new URL("stockfish/src/stockfish-nnue-16-single.js", import.meta.url));

import { createUciClient } from "./uciEngine";

const ENGINE_URL = "";

function customWorker() {
  return null;
}

const CANDIDATE_URLS = [
  "/stockfish.js",
  "/stockfish/stockfish.js",
  "/engine/stockfish.js",
  "/stockfish-nnue-16-single.js",
  "/stockfish-nnue-16.js",
  "/stockfish-17-lite-single.js",
  "/stockfish-17-single.js",
  "/stockfish.wasm.js",
];

async function looksLikeScript(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const type = res.headers.get("content-type") || "";
    return res.ok && /javascript|ecmascript/i.test(type);
  } catch {
    return false;
  }
}

async function findUrl() {
  if (ENGINE_URL) return ENGINE_URL;
  if (typeof window !== "undefined" && window.__QELVARIS_ENGINE_URL__) {
    return window.__QELVARIS_ENGINE_URL__;
  }
  for (const url of CANDIDATE_URLS) {
    if (await looksLikeScript(url)) return url;
  }
  return null;
}

let clientPromise = null;
let lastError = "";
let engineName = "";

export function getEngineName() {
  return engineName;
}

async function connect(worker, name) {
  const client = createUciClient(worker);
  worker.onerror = (event) => {
    console.error(`[engine] ${name} worker error:`, event?.message || event);
  };

  try {
    await client.init();
  } catch (err) {
    console.warn(`[engine] ${name} did not respond:`, err);
    client.terminate();
    return null;
  }

  engineName = name;
  return client;
}

async function start() {
  // 1) Stockfish (agar mila)
  let worker = null;

  try {
    worker = customWorker();
  } catch (err) {
    console.warn("[engine] customWorker failed:", err);
  }

  if (!worker) {
    const url = await findUrl();
    if (url) {
      try {
        worker = new Worker(url);
      } catch (err) {
        console.warn("[engine] could not start worker at", url, err);
      }
    }
  }

  if (worker) {
    const client = await connect(worker, "Stockfish");
    if (client) return client;
  }

  // 2) Built-in basic engine (kamzor, par hamesha chalta hai)
  try {
    const fallback = new Worker(new URL("./fallbackEngine.worker.js", import.meta.url), { type: "module" });
    const client = await connect(fallback, "Built-in basic engine");
    if (client) return client;
  } catch (err) {
    console.warn("[engine] built-in engine failed:", err);
  }

  lastError = "No engine could be started.";
  return null;
}

export function getEngine() {
  if (!clientPromise) {
    clientPromise = start().catch((err) => {
      lastError = String(err?.message || err);
      console.warn("[engine] could not start:", err);
      return null;
    });
  }
  return clientPromise;
}

export function resetEngine() {
  clientPromise = null;
  lastError = "";
  engineName = "";
}

export function getEngineError() {
  return lastError;
}

const cache = new Map();

export async function cachedAnalyze(fen, options = {}) {
  const engine = await getEngine();
  if (!engine) throw new Error("ENGINE_NOT_CONNECTED");

  const key = `${fen}|${options.multipv ?? 3}|${options.depth ?? 12}|${options.movetime ?? 0}`;
  if (cache.has(key)) return cache.get(key);

  const result = await engine.analyze(fen, options);
  if (cache.size > 400) cache.clear();
  cache.set(key, result);
  return result;
}
