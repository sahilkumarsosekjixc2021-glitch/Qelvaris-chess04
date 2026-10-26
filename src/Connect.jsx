import { useEffect, useMemo, useRef, useState } from "react";
import { createEngine } from "./engine";
import { buildFindings } from "./findings";
import { analyseGame as buildRecord, computeLeaks, loadReviewedGames } from "./leaks";
import { listGames, makeGameRecord, saveReviewedGame } from "./library";
import { fetchChessComGames, fetchLichessGames, colorFor, gamesFromPgn } from "./sources";
import { getSetting, setSetting } from "./storage";
import { gradeAll, parseGame } from "./chessUtils";
import "./Connect.css";

const SOURCES = [
  { id: "lichess", label: "Lichess" },
  { id: "chesscom", label: "Chess.com" },
  { id: "pgn", label: "Upload PGN" },
];

function goTo(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

function friendlyError(error, cancelled) {
  if (cancelled || error?.message === "stopped" || error?.name === "AbortError") return "";
  if (error?.message === "Stockfish could not start") {
    return "Stockfish could not start. Check that public/stockfish/stockfish-19-lite-single.js exists.";
  }
  return error?.message || "Something went wrong. Please try again.";
}

// Finding ke tag se rang: Leak = laal, Opening gap = neela, baaki = amber
function toneOf(tag) {
  const t = String(tag || "").toLowerCase();
  if (t.includes("gap") || t.includes("opening")) return "info";
  if (t.includes("leak")) return "bad";
  return "warn";
}

export default function Connect() {
  const [source, setSource] = useState("lichess");
  const [username, setUsername] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [count, setCount] = useState(30);

  const [stage, setStage] = useState("idle"); // idle | fetching | analysing | done | stopped | error
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [eta, setEta] = useState(null);

  const cancelRef = useRef(false);
  const abortRef = useRef(null);
  const engineRef = useRef(null);

  const busy = stage === "fetching" || stage === "analysing";

  /* Pichli baar ka username yaad rakho */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const savedName = await getSetting("connectUsername", "");
        const savedSource = await getSetting("connectSource", "lichess");
        if (alive) {
          setUsername(savedName || "");
          setSource(savedSource || "lichess");
        }
      } catch (err) {
        console.error("Settings read failed:", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* Page chhodte waqt sab rok do */
  useEffect(
    () => () => {
      cancelRef.current = true;
      if (abortRef.current) abortRef.current.abort();
      if (engineRef.current) engineRef.current.stop();
    },
    []
  );

  const report = useMemo(() => computeLeaks(records), [records]);
  const findings = useMemo(() => buildFindings(report, records), [report, records]);

  function stop() {
    cancelRef.current = true;
    if (abortRef.current) abortRef.current.abort();
    if (engineRef.current) engineRef.current.stop();
  }

  async function run() {
    if (busy) return;

    cancelRef.current = false;
    abortRef.current = new AbortController();
    setError("");
    setRecords([]);
    setDone(0);
    setTotal(0);
    setEta(null);
    setStage("fetching");

    try {
      setSetting("connectUsername", username.trim()).catch(() => {});
      setSetting("connectSource", source).catch(() => {});

      const depth = Number(await getSetting("engineDepth", 8)) || 8;
      const signal = abortRef.current.signal;

      let items = [];
      if (source === "lichess") items = await fetchLichessGames(username, { max: count, signal });
      else if (source === "chesscom") items = await fetchChessComGames(username, { max: count, signal });
      else items = gamesFromPgn(pgnText);

      if (!items.length) {
        throw new Error(
          source === "pgn"
            ? "No games found. Paste a PGN or choose a .pgn file."
            : "No public games found for this username."
        );
      }

      // Padho aur chhoti / alag tarah ki games hata do
      const prepared = [];
      for (const item of items) {
        try {
          const parsed = parseGame(item.text);
          if (parsed.moves.length >= 8 && !parsed.custom) prepared.push({ ...item, parsed });
        } catch {
          // ye game padhi nahi gayi, aage badho
        }
      }

      if (!prepared.length) throw new Error("None of these games could be read. Try another source or a PGN file.");

      // Jo games pehle se analyse ho chuki hain unhe dobara analyse nahi karte
      const existing = await loadReviewedGames();
      const existingIds = new Set(existing.map((r) => r.id));
      const openingById = new Map((await listGames()).map((g) => [g.id, g.opening]));

      let all = existing.map((r) => ({ ...r, opening: openingById.get(r.id) || r.opening }));
      setRecords(all);
      setTotal(prepared.length);
      setDone(prepared.filter((p) => existingIds.has(p.id)).length);
      setStage("analysing");

      const engine = createEngine({ multiPv: 2 });
      engineRef.current = engine;

      const startedAt = Date.now();
      let analysed = 0;
      const pending = prepared.filter((p) => !existingIds.has(p.id)).length;

      for (const item of prepared) {
        if (cancelRef.current) break;
        if (existingIds.has(item.id)) continue;

        const userColor = colorFor(item.parsed.headers, username);
        const game = makeGameRecord(item.parsed, {
          id: item.id,
          source: item.source,
          date: item.date,
          userColor,
          opening: item.parsed.headers.Opening || "",
        });

        const evals = await engine.analyseGame(item.parsed, { depth });
        const moves = gradeAll(item.parsed, evals);
        const saved = await saveReviewedGame({ game, parsed: item.parsed, moves, depth });

        const record = buildRecord(saved, item.parsed, moves);
        record.opening = saved.opening || record.opening;

        all = [...all, record];
        analysed += 1;
        setRecords(all);
        setDone((d) => d + 1);
        setEta(Math.round(((Date.now() - startedAt) / analysed / 1000) * (pending - analysed)));
      }

      engine.stop();
      engineRef.current = null;
      setStage(cancelRef.current ? "stopped" : "done");
    } catch (err) {
      console.error("Connect failed:", err);
      if (engineRef.current) engineRef.current.stop();
      engineRef.current = null;

      const message = friendlyError(err, cancelRef.current);
      if (message) {
        setError(message);
        setStage("error");
      } else {
        setStage("stopped");
      }
    }
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setPgnText(String(reader.result || ""));
    reader.onerror = () => setError("Could not read the selected file.");
    reader.readAsText(file);
    event.target.value = "";
  }

  const canStart = source === "pgn" ? pgnText.trim().length > 0 : username.trim().length > 0;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const finished = stage === "done" || stage === "stopped";
  const showProgress = stage !== "idle" && stage !== "error";

  return (
    <div className="cn-page">
      <div className="cn-grid">
        {/* ---------- Left panel: form + progress ---------- */}
        <section className="cn-panel cn-left">
          <div>
            <span className="q-eyebrow">Step 1 of 2</span>
            <h1 className="cn-title">See what is costing you rating points.</h1>
          </div>
          <p className="q-muted cn-lead">
            Type your username. We read your public games, so there is no password and nothing is posted anywhere.
          </p>

          <div className="cn-sources">
            {SOURCES.map((item) => (
              <button
                key={item.id}
                className={`q-chip ${source === item.id ? "is-on" : ""}`}
                onClick={() => setSource(item.id)}
                disabled={busy}
              >
                {item.label}
              </button>
            ))}

            {source !== "pgn" && (
              <select
                className="cn-select cn-select--end"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={busy}
                aria-label="Number of games"
              >
                <option value={20}>Last 20 games</option>
                <option value={30}>Last 30 games</option>
                <option value={50}>Last 50 games</option>
                <option value={100}>Last 100 games</option>
              </select>
            )}
          </div>

          {source === "pgn" && (
            <>
              <textarea
                className="cn-textarea"
                rows={5}
                value={pgnText}
                onChange={(e) => setPgnText(e.target.value)}
                placeholder="Paste one or more PGN games here, or choose a file."
                disabled={busy}
              />
              <div className="q-row">
                <label className="q-btn cn-file">
                  Choose file
                  <input type="file" accept=".pgn,.txt" onChange={handleFile} hidden disabled={busy} />
                </label>
                <input
                  className="cn-input cn-input--small"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your name in these games"
                  disabled={busy}
                />
              </div>
              <p className="q-muted cn-note">
                Your name tells us which side you played. If it is empty, we assume White.
              </p>
            </>
          )}

          <div className="cn-action">
            {source !== "pgn" && (
              <input
                className="cn-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canStart && run()}
                placeholder={source === "lichess" ? "Lichess username" : "Chess.com username"}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
              />
            )}

            {busy ? (
              <button className="q-btn" onClick={stop}>
                Stop
              </button>
            ) : (
              <button className="q-btn q-btn--primary" onClick={run} disabled={!canStart}>
                {finished ? "Analyse again" : "Analyse my games"}
              </button>
            )}
          </div>

          <p className="q-muted cn-note">
            {source === "pgn"
              ? "Games stay on this device."
              : `Reads your last ${count} public games. Free, no card needed.`}
          </p>

          {error && (
            <p className="cn-error" role="alert">
              {error}
            </p>
          )}

          {showProgress && (
            <div className="cn-progress">
              <div className="cn-progress-head">
                <span className="q-eyebrow">{stage === "fetching" ? "Fetching games" : "Analysing"}</span>
                {total > 0 && (
                  <strong className="cn-count">
                    {done} of {total} games
                  </strong>
                )}
              </div>

              <div className="cn-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${percent}%` }} />
              </div>

              <div className="cn-progress-head">
                <p className="q-muted cn-note">
                  Each game is checked once by the engine in your browser, so it stays fast and private. Keep this tab
                  open.
                </p>
                {stage === "analysing" && eta !== null && eta > 0 && (
                  <span className="q-muted cn-note">
                    about {eta >= 90 ? `${Math.round(eta / 60)} min` : `${eta} sec`} left
                  </span>
                )}
                {stage === "done" && <span className="q-badge q-badge--good">Done</span>}
                {stage === "stopped" && <span className="q-badge">Stopped</span>}
              </div>
            </div>
          )}
        </section>

        {/* ---------- Right panel: live findings + Pro banner ---------- */}
        <section className="cn-panel cn-right">
          <div className="cn-right-head">
            <span className="q-eyebrow">Your first findings{busy ? ", building live" : ""}</span>
            {busy && <span className="q-badge q-badge--good">Live</span>}
          </div>

          <ol className="cn-findings">
            {findings.map((item, i) => (
              <li key={item.key} className={`cn-finding cn-finding--${toneOf(item.tag)}`}>
                <span className="cn-finding-no">{i + 1}</span>
                <div className="cn-finding-main">
                  <strong>{item.title}</strong>
                  <span className="q-muted">{item.sub}</span>
                </div>
                <span className="q-badge">{item.tag}</span>
              </li>
            ))}

            {records.length === 0 &&
              [1, 2, 3].map((n) => (
                <li key={`skeleton-${n}`} className="cn-finding is-empty">
                  <span className="cn-finding-no">{n}</span>
                  <div className="cn-skel" aria-hidden="true">
                    <i />
                    <i />
                  </div>
                  <span className="q-muted cn-note">{n === 1 ? "Findings appear here" : ""}</span>
                </li>
              ))}

            {records.length > 0 && findings.length === 0 && !busy && (
              <li className="cn-finding is-empty">
                <span className="cn-finding-no">–</span>
                <div className="cn-finding-main">
                  <strong>No repeating habits found yet</strong>
                  <span className="q-muted">More games will make this clearer.</span>
                </div>
                <span />
              </li>
            )}

            {busy && (
              <li className="cn-finding is-waiting">
                <span className="cn-finding-no">{findings.length + 1}</span>
                <div className="cn-finding-main">
                  <strong>Checking the remaining games…</strong>
                </div>
                <span />
              </li>
            )}
          </ol>

          {finished && report.total > 0 && (
            <p className="cn-total">
              Estimated cost of these habits: <strong>−{report.total} rating points</strong>
              <span className="q-muted"> (an estimate from how often each habit decides a game)</span>
            </p>
          )}

          {finished && (
            <div className="q-row cn-actions">
              <button className="q-btn q-btn--primary" onClick={() => goTo("DNA")}>
                See my DNA
              </button>
              <button className="q-btn" onClick={() => goTo("Review")}>
                Review a game
              </button>
            </div>
          )}

          <div className="cn-pro">
            <span className="cn-pro-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 4h6a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a2 2 0 0 1 2-2Zm0 2v1h6V6H9Z" />
              </svg>
            </span>
            <div className="cn-pro-text">
              <strong>The full report is a Pro feature</strong>
              <span className="q-muted">
                Free shows your top finding. Pro unlocks all six skills, five ranked leaks and a daily training plan.
              </span>
            </div>
            <div className="cn-pro-cta">
              <button className="q-btn q-btn--primary" onClick={() => goTo("Settings")}>
                Founding Member ₹999 a year
              </button>
              <button className="q-btn" onClick={() => goTo("Settings")}>
                See all plans
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}