import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import PracticePuzzles from "./PracticePuzzles";
import { LEAK_DEFS, computeLeaks, loadReviewedGames } from "./leaks";

import {
  afterMiss,
  afterSolve,
  buildQueue,
  comingBack,
  isDue,
  leakInfo,
  leakSeries,
  masteryOf,
  masteryTone,
  proofText,
  promptFor,
  seedTraining,
} from "./lab";
import { dbPut, getSetting, setSetting } from "./storage";
import { setStepDone } from "./todayData"; // QV-STREAK
import { judgeMove } from "./labJudge"; // QV-LABFIX
import { track } from "./features/telemetry/track"; // QV-TRACK
import { cancelEngine } from "./engine2"; // QV-LABFIX
import PageLoader, { usePageLoaderDelay } from "./PageLoader";
import BlindSpotMap from "./features/blindspot/BlindSpotMap"; // QV-BLINDSPOT
import { useT } from "./i18n/i18n"; // QV-I18N
import { ll } from "./i18n/pages/leaklab"; // QV-I18N
import { lit } from "./i18n/pages/today"; // QV-I18N
import ExplorePanel from "./ExplorePanel";
import { useExplore } from "./useExplore";
import "./LeakLab.css";
import "./LeakLabExtras.css";
import AnalysisPage from "./AnalysisPage";
import "./LeakLabShell.css";
import { TRAIN_MAP, requestCoachLesson } from "./features/blindspot/blindspot";
import "./ExploreForLab.css";
import "./LeakLabTheme.css"; // sabse last

/* Loader kam se kam itni der (ms) dikhega. 0 = sirf real loading tak. */
const MIN_LOADER_MS = 0; // QV-PERF (pehle 1500)
const DAILY_GOAL = 5; // roz ke kitne positions ka target
const SIZES = [5, 10, 20]; // ek session me kitni positions

function goTo(page) {
  window.dispatchEvent(
    new CustomEvent("qelvaris-navigate", { detail: page })
  );
}

const tone = (status) =>
  status === "Fixed"
    ? "good"
    : status === "Improving"
      ? "warn"
      : "bad";

function Sparkline({ values }) {
  useT(); // QV-I18N
  const w = 300;
  const h = 120;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;

  const pts = values.map((v, i) => [
    i * step,
    h - 10 - (v / max) * (h - 28),
  ]);

  const line = pts
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      className="ll-chart"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ll("sparkLabel")}
    >
      <polygon
        points={`${line} ${w},${h} 0,${h}`}
        className="ll-chart-area"
      />
      <polyline
        points={line}
        className="ll-chart-line"
        vectorEffect="non-scaling-stroke"
      />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="3.2"
          className="ll-chart-dot"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

const todayKey = () => new Date().toLocaleDateString("en-CA");

/* ---------- Side menu (navbar se Leak Lab chuno, phir yahan se section) ---------- */
const SECTIONS = [
  { id: "train", label: "Train", icon: "target" },
  { id: "analysis", label: "Analysis", icon: "scan" },
  { id: "blindspots", label: "Blind spots", icon: "grid" },
  { id: "puzzles", label: "Practice", icon: "bolt" },
  { id: "progress", label: "Progress", icon: "bars" },
];

function Icon({ name }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "target") return (<svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>);
  if (name === "grid") return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
  if (name === "scan") return (<svg {...common}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
  if (name === "bolt") return (<svg {...common}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></svg>);
  return (<svg {...common}><rect x="4" y="11" width="4" height="9" rx="1" /><rect x="10" y="6" width="4" height="14" rx="1" /><rect x="16" y="3" width="4" height="17" rx="1" /></svg>);
}

function LabShell({ section, onSection, daily, children }) {
  const pct = Math.min(100, Math.round((daily.done / DAILY_GOAL) * 100));

  return (
    <div className="ll-page">
      <div className="ll-shell">
        <nav className="ll-snav" aria-label="Leak Lab sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ll-snav-btn ${section === item.id ? "is-on" : ""}`}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => onSection(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}

          <div className="ll-goalcard">
            <span className="ll-label">Daily goal</span>
            <strong>{daily.done} / {DAILY_GOAL}</strong>
            <div className="ll-gbar"><div style={{ width: `${pct}%` }} /></div>
            <small>
              {daily.done >= DAILY_GOAL ? "Goal reached. Nice work." : `${DAILY_GOAL - daily.done} more to reach today's goal`}
            </small>
          </div>
        </nav>

        <div className="ll-content">{children}</div>
      </div>
    </div>
  );
}

export default function LeakLab() {
  useT(); // QV-I18N: re-render on language change
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState("train"); // train | blindspots | puzzles | progress
  const [view, setView] = useState("cards"); // train ke andar: cards (leaks ki list) | session (board)

  const [records, setRecords] = useState([]);
  const [items, setItems] = useState([]);
  const [report, setReport] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [leakId, setLeakId] = useState("all");
  const [queue, setQueue] = useState([]);
  const [pos, setPos] = useState(0);
  const [requeued, setRequeued] = useState([]);

  const [phase, setPhase] = useState("idle");
  const [size, setSize] = useState(10); // session length
  const [stats, setStats] = useState({ solved: 0, first: 0, missed: 0 }); // session recap
  const [exploring, setExploring] = useState(false);
  const judgeRef = useRef(null); // QV-LABFIX: kis position ki jaanch chal rahi hai

  useEffect(() => () => { judgeRef.current = null; cancelEngine(); }, []);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");

  const [daily, setDaily] = useState({
    day: todayKey(),
    done: 0,
    firstTry: 0,
    solved: 0, // QV-STREAK: sahi solve ki ginti (show answer count nahi hota)
  });

  // Loader: minimum time
  const minDone = usePageLoaderDelay(MIN_LOADER_MS);

  // Navbar dropdown navigation
useEffect(() => {
  function handleNavigation(event) {
    const detail = event.detail;

    const section =
      typeof detail === "object" && detail !== null
        ? detail.section
        : detail;

    // Navbar dropdown ab bhi chalta hai: "puzzles" = Practice, "leaks" = Train
    if (section === "puzzles" || section === "blindspots" || section === "progress" || section === "analysis") {
      setSection(section);
    }

    if (section === "leaks" || section === "train") {
      setSection("train");
    }
  }

  window.addEventListener("qelvaris-navigate", handleNavigation);
  window.addEventListener("qelvaris-subnavigate", handleNavigation);

  return () => {
    window.removeEventListener("qelvaris-navigate", handleNavigation);
    window.removeEventListener("qelvaris-subnavigate", handleNavigation);
  };
}, []);

  // Load existing reviewed games and training positions
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const loaded = await loadReviewedGames();
        const list = await seedTraining(loaded);

        const wanted = await getSetting("labLeak", null);
        const savedDaily = await getSetting("labDaily", null);
        const savedSize = await getSetting("labSize", 10);
        const startSize = SIZES.includes(savedSize) ? savedSize : 10;

        if (!alive) return;

        const leakKey =
          wanted && list.some(
            (i) => (i.leak || "other") === wanted
          )
            ? wanted
            : "all";

        const moment = Date.now();

        setRecords(loaded);
        setItems(list);
        setReport(computeLeaks(loaded));
        setNow(moment);
        setLeakId(leakKey);
        setSize(startSize);
        setQueue(buildQueue(list, leakKey, { now: moment, limit: startSize }));

        if (savedDaily && savedDaily.day === todayKey()) {
          setDaily(savedDaily);
        }

        setSetting("labLeak", null).catch(() => {});
      } catch (error) {
        console.error("Leak Lab failed to load:", error);
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const item =
    items.find((entry) => entry.id === queue[pos]) || null;

  const fen = item ? item.fen : "";

  const side = item
    ? item.userColor === "b"
      ? "Black"
      : "White"
    : "White";

  const info = leakInfo(item ? item.leak || "other" : leakId);

  // Solve ya answer dekhne ke baad engine ki best line dekhne ke liye
  const ex = useExplore(
    item ? item.fen : "",
    exploring && (phase === "solved" || phase === "revealed")
  );

  const targets = useMemo(() => {
    if (!item || !selected || phase !== "idle") return [];

    try {
      return new Chess(fen)
        .moves({ square: selected, verbose: true })
        .map((move) => move.to);
    } catch {
      return [];
    }
  }, [item, selected, phase, fen]);

  const entries = useMemo(() => {
    const present = new Set(
      items.map((entry) => entry.leak || "other")
    );

    return [...LEAK_DEFS.map((d) => d.id), "other"]
      .filter((id) => present.has(id))
      .map((id) => {
        const mine = items.filter(
          (entry) => (entry.leak || "other") === id
        );

        const found = report
          ? report.leaks.find((leak) => leak.id === id)
          : null;

        return {
          id,
          title: leakInfo(id).title,
          status: found ? found.status : "Open",
          progress: masteryOf(mine), // practice progress: solve karte hi badhta hai
          learned: mine.filter((entry) => (entry.box || 0) >= 3).length,
          due: mine.filter((entry) => isDue(entry, now)).length,
          total: mine.length,
        };
      });
  }, [items, report, now]);

  const scoped = useMemo(
    () =>
      leakId === "all"
        ? items
        : items.filter(
            (entry) => (entry.leak || "other") === leakId
          ),
    [items, leakId]
  );

  const schedule = useMemo(
    () => comingBack(scoped, now),
    [scoped, now]
  );

  const dueCount = scoped.filter(
    (entry) => isDue(entry, now)
  ).length;

  // Session controls
  function resetPosition() {
    setExploring(false);
    judgeRef.current = null;
    cancelEngine();
    setPhase("idle");
    setAttempts(0);
    setHint(false);
    setSelected(null);
    setMessage("");
  }

  function startSession(key, { force = false, list = items, size: limit = size } = {}) {
    setSection("train");
    setView("session");
    const moment = Date.now();

    setNow(moment);
    setLeakId(key);
    setQueue(buildQueue(list, key, { force, now: moment, limit }));
    setPos(0);
    setRequeued([]);
    setStats({ solved: 0, first: 0, missed: 0 });
    resetPosition();
  }

  function changeSize(n) {
    setSize(n);
    setSetting("labSize", n).catch(() => {});
    startSession(leakId, { size: n });
  }

  function goNext() {
    setPos((position) => position + 1);
    resetPosition();
  }

  async function saveItem(updated) {
    setItems((list) =>
      list.map((entry) =>
        entry.id === updated.id ? updated : entry
      )
    );

    setNow(Date.now());

    try {
      await dbPut("training", updated);
    } catch (error) {
      console.error("Could not save progress:", error);
    }
  }

  function bumpDaily(firstTry, solved = false) {
    const base =
      daily.day === todayKey()
        ? daily
        : { day: todayKey(), done: 0, firstTry: 0, solved: 0 };

    const next = {
      ...base,
      done: base.done + 1,
      firstTry: base.firstTry + (firstTry ? 1 : 0),
      solved: (base.solved || 0) + (solved ? 1 : 0),
    };

    setDaily(next);
    setSetting("labDaily", next).catch(() => {});
    return next;
  }

  // QV-LABFIX: sahi move = engine ka best, YA koi bhi move jo usse kam se kam utna hi achha ho
  function markSolved(note, alt = false) {
    const notDue = !isDue(item); // "Practise anyway": extra practice, schedule nahi badalta
    track("leak_solved", { leak: item.leak, firstTry: attempts === 0, alt });
    saveItem(afterSolve(item));
    const next = bumpDaily(attempts === 0, true);
    setStats((s) => ({ ...s, solved: s.solved + 1, first: s.first + (attempts === 0 ? 1 : 0) }));

    // QV-STREAK: Today ka "Fix" step poora jab 3 positions (ya session mein jitni hon) sahi solve ho jayein
    const needed = Math.min(3, new Set(queue).size);
    if (next.solved >= needed) {
      setStepDone("fix", true).catch(() => {});
    }

    setPhase("solved");
    setMessage(
      notDue ? `${note} Extra practice: this position keeps its review date.` : note
    );
  }

  async function submit(uci, san) {
    if (!item || phase !== "idle") return;

    if (uci === item.best) {
      markSolved(ll("mCorrect", { san: item.bestSan || san, label: lit(item.label) }));
      return;
    }

    // Wahi move jo game mein chala tha: pehle se pata hai ki wo galti thi
    if (san === item.playedSan) {
      setAttempts((count) => count + 1);
      setMessage(ll("mPlayed", { san }));
      return;
    }

    // Koi aur move: engine se jaanch
    const itemId = item.id;
    judgeRef.current = itemId;
    setPhase("checking");
    setMessage(ll("mChecking"));

    const verdict = await judgeMove({ fen: item.fen, uci, best: item.best });
    if (judgeRef.current !== itemId) return; // user aage badh gaya

    if (verdict.status === "accept") {
      markSolved(
        ll("mAlso", { san, best: item.bestSan || ll("onBoard"), label: lit(item.label) }),
        true
      );
      return;
    }

    setAttempts((count) => count + 1);
    setPhase("idle");

    if (verdict.status === "reject") {
      const pawns = (verdict.loss / 100).toFixed(1);
      setMessage(ll("mLoss", { san, pawns }));
    } else {
      setMessage(ll("mNoCheck", { san }));
    }
  }

  function handleSquare(square) {
    if (!item || phase !== "idle") return;

    try {
      const chess = new Chess(fen);

      if (selected && targets.includes(square)) {
        const legal = chess
          .moves({ square: selected, verbose: true })
          .filter((move) => move.to === square);

        const move =
          legal.find(
            (candidate) =>
              !candidate.promotion || candidate.promotion === "q"
          ) || legal[0];

        if (!move) return;

        setSelected(null);

        submit(
          move.from + move.to + (move.promotion || ""),
          move.san
        );

        return;
      }

      const piece = chess.get(square);

      if (
        piece &&
        piece.color === chess.turn() &&
        chess.moves({ square, verbose: true }).length
      ) {
        setSelected(square);
      } else {
        setSelected(null);
      }
    } catch (error) {
      console.error("Move failed:", error);
    }
  }

  function showAnswer() {
    if (!item || phase !== "idle") return;

    saveItem(afterMiss(item));
    bumpDaily(false);
    setStats((s) => ({ ...s, missed: s.missed + 1 }));

    setPhase("revealed");

    setMessage(
      ll("mRevealed", { best: item.bestSan || ll("onBoard"), played: item.playedSan })
    );

    if (!requeued.includes(item.id)) {
      setRequeued((list) => [...list, item.id]);
      setQueue((list) => [...list, item.id]);
    }
  }

  function goSection(id) {
    if (id === "train" && section === "train") setView("cards"); // Train dobara dabao to leaks ki list
    setSection(id);
  }

  // Analysis: kisi bhi game ya free board par chaal dar chaal analysis
  if (section === "analysis") {
    return (
      <LabShell section={section} onSection={goSection} daily={daily}>
        <AnalysisPage />
      </LabShell>
    );
  }

  // Practice Puzzles ab side menu ke saath dikhta hai
  if (section === "puzzles") {
    return (
      <LabShell section={section} onSection={goSection} daily={daily}>
        <PracticePuzzles />
      </LabShell>
    );
  }

  // Shared page loading state
  if (!ready || !minDone) {
    return (
      <PageLoader
        page="leaklab"
        title={ll("loadTitle")}
        messages={[ll("load1"), ll("load2"), ll("load3")]}
      />
    );
  }

  // No reviewed games
  if (records.length === 0) {
    return (
      <div className="ll-page">
        <section className="q-card ll-blank">
          <h1 className="q-title">{ll("blankTitle")}</h1>

          <p className="q-muted">
            {ll("blankText")}
          </p>

          <div className="ll-actions">
            <button
              className="q-btn q-btn--primary"
              onClick={() => goTo("Connect")}
            >
              {ll("addGames")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  // No personal leak positions
  if (items.length === 0) {
    return (
      <div className="ll-page">
        <section className="q-card ll-blank">
          <h1 className="q-title">{ll("nothingTitle")}</h1>

          <p className="q-muted">
            {ll("nothingText")}
          </p>

          <div className="ll-actions">
            <button
              className="q-btn"
              onClick={() => goTo("Review")}
            >
              {ll("openReview")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  // Proof chart
  const proofId =
    leakId !== "all"
      ? leakId
      : item
        ? item.leak || "other"
        : null;

  const proofLeak = proofId
    ? entries.find((entry) => entry.id === proofId)
    : null;

  const foundLeak =
    proofId && report
      ? report.leaks.find((leak) => leak.id === proofId)
      : null;

  const series = proofLeak
    ? leakSeries(records, proofId)
    : [];

  const last10 = series.slice(-10);
  const trend = foundLeak ? foundLeak.trend : null;
  const finished = pos >= queue.length;

  const pct = daily.done
    ? Math.round((daily.firstTry / daily.done) * 100)
    : null;

  const maxBack = Math.max(
    ...schedule.map((row) => row.count),
    1
  );

  const arrow =
    item && phase !== "idle" && phase !== "checking" && item.best
      ? {
          from: item.best.slice(0, 2),
          to: item.best.slice(2, 4),
        }
      : null;

  const shownSelected =
    selected ||
    (hint && phase === "idle" && item
      ? item.best.slice(0, 2)
      : null);

  const nextDue = scoped.length
    ? Math.min(...scoped.map((entry) => entry.dueAt ?? now))
    : null;

  const nextDueText =
    nextDue === null
      ? ""
      : new Date(nextDue).toDateString() ===
          new Date(now).toDateString()
        ? ll("laterToday")
        : new Date(nextDue).toLocaleDateString();

  const totalDue = items.filter((entry) => isDue(entry, now)).length;
  const heroCopy =
    {
      train: { eyebrow: ll("eyebrow"), title: ll("heroTitle"), text: ll("heroText") },
      blindspots: { eyebrow: "BLIND SPOTS", title: "Where your mistakes happen", text: "Your errors mapped on the board, from your side of it." },
      progress: { eyebrow: "PROGRESS", title: "Is it actually working?", text: "Real games decide if a habit is fixed. Practice is how you build the new habit." },
    }[section] || {};
  const inSession = section === "train" && view === "session";

  return (
    <LabShell section={section} onSection={goSection} daily={daily}>
      {!inSession && (
        <header className="ll-banner">
          <span className="ll-eyebrow">{heroCopy.eyebrow}</span>
          <h1>{heroCopy.title}</h1>
          <p>{heroCopy.text}</p>
          <div className="ll-banner-actions">
            {section === "train" ? (
              <>
                <button className="ll-btn ll-btn--primary" onClick={() => startSession("all")}>
                  Start today's session
                </button>
                <button className="ll-btn" onClick={() => goSection("blindspots")}>
                  Blind-spot map
                </button>
              </>
            ) : (
              <button className="ll-btn ll-btn--primary" onClick={() => goSection("train")}>
                Back to training
              </button>
            )}
          </div>
        </header>
      )}

      <div className="ll-strip">
        <div className="ll-strip-item">
          <span className="ll-strip-icon">◈</span>
          <div>
            <strong>{entries.length}</strong>
            <small>{ll("activeLeaks")}</small>
          </div>
        </div>

        <div className="ll-strip-item">
          <span className="ll-strip-icon">⏱</span>
          <div>
            <strong>{items.filter((entry) => isDue(entry, now)).length}</strong>
            <small>{ll("dueNow")}</small>
          </div>
        </div>

        <div className="ll-strip-item">
          <span className="ll-strip-icon">✓</span>
          <div>
            <strong>
              {daily.done}
              <span className="ll-goal"> / {DAILY_GOAL}</span>
            </strong>
            <small>{ll("doneToday")}</small>
          </div>
        </div>

        <div className="ll-strip-item">
          <span className="ll-strip-icon">%</span>
          <div>
            <strong>{pct !== null ? `${pct}%` : "—"}</strong>
            <small>{ll("firstTry")}</small>
          </div>
        </div>
      </div>


      {/* TRAIN: leaks ki cards */}
      {section === "train" && view === "cards" && (
        <>
          <div className="ll-cards">
            {entries.map((entry) => {
              const info = leakInfo(entry.id);
              return (
                <article key={entry.id} className="ll-card">
                  <div className="ll-card-top">
                    <span className="ll-tag">{lit(info.skill || "Leak")}</span>
                    <span className={`ll-pill ll-pill--${tone(entry.status)}`}>{lit(entry.status)}</span>
                  </div>

                  <h3>{lit(entry.title)}</h3>
                  <p>{lit(info.text)}</p>

                  <div
                    className="ll-leak-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={entry.progress}
                    aria-label={`${lit(entry.title)} practice progress`}
                    title={`Practice progress: ${entry.learned} of ${entry.total} positions learned`}
                  >
                    <div
                      className={`is-${masteryTone(entry.progress)}`}
                      style={{ width: `${entry.progress}%`, minWidth: entry.progress ? undefined : 0 }}
                    />
                  </div>

                  <div className="ll-leak-meta">
                    <span>
                      {ll("dueTotal", { due: entry.due, total: entry.total, unit: entry.total === 1 ? ll("pos1") : ll("posN") })}
                    </span>
                    <strong>{entry.progress}%</strong>
                  </div>

                  <div className="ll-card-actions">
                    <button type="button" className="ll-btn ll-btn--primary" onClick={() => startSession(entry.id)}>
                      Train
                    </button>
                    {TRAIN_MAP[entry.id] && (
                      <button type="button" className="ll-btn" onClick={() => requestCoachLesson(entry.id)}>
                        Learn pattern
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="ll-footbar">
            <span>
              {entries.length} {entries.length === 1 ? "leak" : "leaks"} · {totalDue} due now
            </span>
            <button type="button" className="ll-btn ll-btn--primary" onClick={() => startSession("all")}>
              Continue training
            </button>
          </div>
        </>
      )}

      {/* TRAIN: session (board) */}
      {inSession && (
        <>
          <div className="ll-sessionbar">
            <button type="button" className="ll-btn ll-back" onClick={() => setView("cards")}>
              ← All leaks
            </button>

            <div className="ll-chips" role="tablist" aria-label="Leak">
              <button
                type="button"
                className={`ll-chip ${leakId === "all" ? "is-on" : ""}`}
                onClick={() => startSession("all")}
              >
                {ll("allLeaks")}
              </button>
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`ll-chip ${leakId === entry.id ? "is-on" : ""}`}
                  onClick={() => startSession(entry.id)}
                >
                  {lit(entry.title)}
                  {entry.due > 0 && <span className="ll-chip-n">{entry.due}</span>}
                </button>
              ))}
            </div>

            <div className="ll-size" role="group" aria-label="Positions per session">
              <span>Session</span>
              {SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ll-size-btn ${size === n ? "is-on" : ""}`}
                  aria-pressed={size === n}
                  onClick={() => changeSize(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="ll-grid ll-grid--session">
        {/* Interactive training position */}
        <section className="q-card ll-main">
          {finished || !item ? (
            <div className="ll-done">
              <h2 className="ll-h2">
                {queue.length
                  ? ll("sessionComplete")
                  : ll("nothingDue")}
              </h2>

              <p className="ll-muted">
                {queue.length
                  ? ll("wentThrough", { n: queue.length, unit: queue.length === 1 ? ll("pos1") : ll("posN") })
                  : `${ll("nothingWaiting", {
                      what:
                        leakId === "all"
                          ? ll("anyLeak")
                          : lit(leakInfo(leakId).title).toLowerCase(),
                    })} ${
                      nextDueText
                        ? ll("nextDue", { when: nextDueText })
                        : ""
                    }`}
              </p>

              {stats.solved + stats.missed > 0 && (
                <div className="ll-recap">
                  <div><strong>{stats.solved}</strong><span>Solved</span></div>
                  <div><strong>{stats.first}</strong><span>First try</span></div>
                  <div><strong>{stats.missed}</strong><span>Needed the answer</span></div>
                </div>
              )}

              <div className="ll-actions">
                <button
                  className="ll-btn ll-btn--primary"
                  onClick={() =>
                    startSession(leakId, { force: true })
                  }
                >
                  {ll("practiseAnyway")}
                </button>

                {dueCount > 0 && (
                  <button
                    className="ll-btn"
                    onClick={() => startSession(leakId)}
                  >
                    {ll("practiseDue", { n: dueCount })}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="ll-poshead">
                <span className="ll-label">
                  {ll("posHead", { pos: pos + 1, total: queue.length })}
                </span>

                <span className="ll-pill ll-pill--bad">
                  {lit(info.title)}
                </span>
              </div>

              <div className="ll-sbar" aria-hidden="true">
                <div style={{ width: `${Math.min(100, (pos / Math.max(1, queue.length)) * 100)}%` }} />
              </div>

              <div className="ll-board">
                <Board
                  fen={ex.active ? ex.fen : fen}
                  flipped={item.userColor === "b"}
                  arrow={ex.active ? ex.arrow : arrow}
                  selected={ex.active ? ex.selected : shownSelected}
                  targets={ex.active ? ex.targets : targets}
                  onSquareClick={
                    ex.active
                      ? ex.squareClick
                      : phase === "idle"
                        ? handleSquare
                        : null
                  }
                />
              </div>

              <p className="ll-prompt">
                {lit(promptFor(item.leak || "other", side))}
              </p>

              {hint && phase === "idle" && info.ask && (
                <p className="ll-hint">{lit(info.ask)}</p>
              )}

              {message && (
                <p
                  className={`ll-msg ${
                    phase === "solved" ? "is-good" : ""
                  }`}
                  role="status"
                >
                  {message}
                </p>
              )}

              <div className="ll-actions">
                {phase === "idle" ? (
                  <>
                    <button
                      className="ll-btn"
                      onClick={() => setHint(true)}
                      disabled={hint}
                    >
                      {ll("hint")}
                    </button>

                    <button
                      className="ll-btn"
                      onClick={showAnswer}
                    >
                      {ll("showAnswer")}
                    </button>

                    <button
                      className="ll-btn"
                      onClick={goNext}
                    >
                      {ll("skip")}
                    </button>
                  </>
                ) : phase === "checking" ? (
                  <button className="ll-btn" disabled>
                    {ll("checking")}
                  </button>
                ) : (
                  <>
                    <button
                      className="ll-btn"
                      onClick={() => setExploring((v) => !v)}
                    >
                      {exploring ? "Close explore" : "Explore best line"}
                    </button>

                    <button
                      className="ll-btn ll-btn--primary"
                      onClick={goNext}
                    >
                      {pos + 1 >= queue.length
                        ? ll("finish")
                        : ll("nextPos")}
                    </button>
                  </>
                )}
              </div>

              <p className="ll-note">
                {ll("note")}{" "}
                <strong>{ll("doneTodayN", { n: daily.done })}</strong>
                {pct !== null && (
                  <>
                    {" "}
                    · <strong>{ll("firstTryPct", { pct })}</strong>
                  </>
                )}
              </p>
              {ex.active && (
                <div className="ll-explore">
                  <ExplorePanel ex={ex} />
                </div>
              )}
            </>
          )}
        </section>

        {/* Proof and revision schedule */}
        <aside className="ll-side">
          <div className="q-card">
            <span className="ll-label">{ll("proofTitle")}</span>

            {proofLeak ? (
              <>
                <p className="ll-small">
                  {ll("perGame", { leak: lit(proofLeak.title), n: last10.length })}
                </p>

                {last10.length >= 2 ? (
                  <Sparkline values={last10} />
                ) : (
                  <p className="ll-small">
                    {ll("needs2")}
                  </p>
                )}

                {trend ? (
                  <div className="ll-trend">
                    <span className="ll-from">
                      {trend.before.toFixed(1)} →
                    </span>

                    <strong
                      className={
                        trend.after < trend.before
                          ? "is-good"
                          : trend.after > trend.before
                            ? "is-bad"
                            : ""
                      }
                    >
                      {trend.after.toFixed(1)}
                    </strong>

                    <span
                      className={`ll-pill ll-pill--${tone(
                        proofLeak.status
                      )}`}
                    >
                      {trend.after < trend.before
                        ? ll("improving")
                        : trend.after > trend.before
                          ? ll("worse")
                          : ll("steady")}
                    </span>
                  </div>
                ) : (
                  <p className="ll-small">
                    {ll("needs4")}
                  </p>
                )}

                <p className="ll-proof">
                  {lit(proofText(series, proofLeak.status))}
                </p>
              </>
            ) : (
              <p className="ll-small">
                {ll("chooseLeak")}
              </p>
            )}

            <p className="ll-fine">
              {ll("fixedFine")}
            </p>
          </div>

          <div className="q-card">
            <span className="ll-label">{ll("comingBack")}</span>

            <ul className="ll-schedule">
              {schedule.map((row) => (
                <li key={row.id}>
                  <span>{lit(row.label)}</span>

                  <div
                    className="ll-back-bar"
                    aria-hidden="true"
                  >
                    <div
                      style={{
                        width: `${(row.count / maxBack) * 100}%`,
                      }}
                    />
                  </div>

                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </aside>
          </div>
        </>
      )}

      {/* BLIND SPOTS */}
      {section === "blindspots" && <BlindSpotMap records={records} />}

      {/* PROGRESS: har leak ka asli games wala proof + practice */}
      {section === "progress" && (
        <>
          <div className="ll-cards ll-cards--wide">
            {entries.map((entry) => {
              const series = leakSeries(records, entry.id);
              const recent = series.slice(-10);
              return (
                <article key={entry.id} className="ll-card">
                  <div className="ll-card-top">
                    <h3>{lit(entry.title)}</h3>
                    <span className={`ll-pill ll-pill--${tone(entry.status)}`}>{lit(entry.status)}</span>
                  </div>

                  <span className="ll-label">Real games</span>
                  {recent.length >= 2 ? <Sparkline values={recent} /> : <p className="ll-small">{ll("needs2")}</p>}
                  <p className="ll-proof">{lit(proofText(series, entry.status))}</p>

                  <span className="ll-label">Practice</span>
                  <div className="ll-leak-bar" aria-hidden="true">
                    <div
                      className={`is-${masteryTone(entry.progress)}`}
                      style={{ width: `${entry.progress}%`, minWidth: entry.progress ? undefined : 0 }}
                    />
                  </div>
                  <div className="ll-leak-meta">
                    <span>{entry.learned} of {entry.total} positions learned</span>
                    <strong>{entry.progress}%</strong>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="q-card ll-comingcard">
            <span className="ll-label">{ll("comingBack")}</span>
            <ul className="ll-schedule">
              {schedule.map((row) => (
                <li key={row.id}>
                  <span>{lit(row.label)}</span>
                  <div className="ll-back-bar" aria-hidden="true">
                    <div style={{ width: `${(row.count / maxBack) * 100}%` }} />
                  </div>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
            <p className="ll-fine">{ll("fixedFine")}</p>
          </div>
        </>
      )}
    </LabShell>
  );
}
