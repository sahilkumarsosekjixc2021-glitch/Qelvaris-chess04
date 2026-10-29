import { useCallback, useEffect, useState } from "react";
import Board from "./Board";
import { loadToday, setStepDone } from "./todayData";
import "./Today.css";

function go(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

// Negative numbers ko "−134" jaisa dikhao (asli minus sign)
const minus = (n) => String(n).replace("-", "−");

function Sample() {
  return <span className="qt-sample">Sample data</span>;
}

/* ---------- Progress ring (1 / 3) ---------- */
function Ring({ done, total }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="qt-ring" aria-label={`${done} of ${total} done`}>
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r={r} className="qt-ring-bg" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="qt-ring-fg"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="qt-ring-text">
        {done} / {total}
      </span>
    </div>
  );
}

/* ---------- Plan card ---------- */
function PlanCard({ data, onToggle }) {
  const { steps } = data.plan;
  const doneCount = steps.filter((s) => data.doneIds.includes(s.id)).length;
  const firstOpen = steps.find((s) => !data.doneIds.includes(s.id));
  const pct = steps.length ? (doneCount / steps.length) * 100 : 0;

  return (
    <section className="qt-card">
      <div className="qt-plan-head">
        <div>
          <h2 className="qt-h2">A little focus. A stronger game.</h2>
          <div className="qt-sub">Your 15-minute daily plan · Built from your games</div>
        </div>
        <Ring done={doneCount} total={steps.length} />
      </div>

      <div className="qt-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className="qt-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <ol className="qt-steps">
        {steps.map((step, i) => {
          const done = data.doneIds.includes(step.id);
          const isCurrent = !done && firstOpen?.id === step.id;

          if (isCurrent) {
            return (
              <li key={step.id} className="qt-step qt-step--current">
                <div className="qt-current-top">
                  <span className="qt-upnext">▶ Up next for you</span>
                  <span className="qt-min">{step.minutes} min</span>
                </div>
                <div className="qt-current-body">
                  <div className="qt-current-board">
                    <Board fen={step.fen || data.lastGame.fen} showCoords={false} />
                  </div>
                  <div className="qt-current-info">
                    <div className="qt-current-title">
                      {step.kind} · {step.title}
                    </div>
                    <div className="qt-step-from">{step.from}</div>
                    <button className="qt-cta" onClick={() => go(step.goTo)}>
                      → Continue {step.kind.toLowerCase()}
                    </button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={step.id} className={`qt-step qt-step--row ${done ? "qt-step--done" : ""}`}>
              <button
                className="qt-check"
                onClick={() => onToggle(step.id, !done)}
                aria-label={done ? `Mark ${step.kind} as not done` : `Mark ${step.kind} as done`}
                aria-pressed={done}
              >
                {done ? "✓" : i + 1}
              </button>

              <div className="qt-step-body">
                <div className="qt-step-title">
                  {step.kind} · {step.title}
                </div>
                <div className="qt-step-from">{step.from}</div>
              </div>

              <span className="qt-min">{step.minutes} min</span>

              {done ? (
                <span className="qt-chip qt-chip--good">✓ Done</span>
              ) : (
                <span className="qt-chip">○ Next</span>
              )}
            </li>
          );
        })}
      </ol>

      {data.plan.isSample && (
        <p className="qt-note">
          Plan sample hai, kyunki abhi koi game review nahi hui. Games add karke review karo, tab ye aapke asli leaks se banega.
        </p>
      )}
    </section>
  );
}

/* ---------- Last game ---------- */
function LastGameCard({ game }) {
  const won = game.result && game.result.startsWith("1-0");
  return (
    <section className="qt-card qt-last">
      <div className="qt-last-head">
        <span className="qt-eyebrow">
          Your last game {game.isSample && <Sample />}
        </span>
        {game.result && (
          <span className={`qt-chip ${won ? "qt-chip--good" : ""}`}>
            {won ? "✓ Win" : "Result"} · {game.result}
          </span>
        )}
      </div>

      <div className="qt-last-row">
        <div className="qt-last-info">
          <div className="qt-last-title">{game.title}</div>
          <div className="qt-last-meta">
            {game.turningPoints ? `${game.turningPoints} turning points` : "Not reviewed yet"}
            {game.source ? ` · ${game.source}` : ""}
          </div>
        </div>

        {game.accuracy !== null && game.accuracy !== undefined && (
          <div className="qt-acc-box">
            <strong className="qt-acc">{game.accuracy}</strong>
            <span>ACCURACY</span>
          </div>
        )}

        <button className="qt-btn" onClick={() => go("Review")}>
          Open story
        </button>
      </div>
    </section>
  );
}

/* ---------- Rating leaks ---------- */
function LeakCard({ leaks }) {
  const max = Math.max(...leaks.leaks.map((l) => Math.abs(l.points)), 1);
  const s = leaks.status;

  return (
    <section className="qt-card">
      <div className="qt-card-head">
        <span className="qt-eyebrow">
          Your rating leaks {leaks.isSample && <Sample />}
        </span>
        <span className="qt-info" title="Estimate of rating points lost to repeating habits">i</span>
      </div>

      <div className="qt-scorerow">
        <div className="qt-score">{minus(leaks.total)}</div>
        <div className="qt-scoretext">
          <strong>rating points</strong>
          <span>estimated cost · {leaks.windowLabel}</span>
        </div>
      </div>

      <p className="qt-tagline">Small, repeatable habits. Real rating upside.</p>

      {leaks.leaks.length === 0 && <p className="qt-note">Abhi koi leak nahi mila. Aur games review karo.</p>}

      <ul className="qt-leaks">
        {leaks.leaks.map((leak) => (
          <li key={leak.name} className="qt-leak">
            <div className="qt-leak-row">
              <span>{leak.name}</span>
              <span className="qt-leak-pts">{minus(leak.points)}</span>
            </div>
            <div className="qt-bar">
              <div className="qt-bar-fill" style={{ width: `${(Math.abs(leak.points) / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="qt-status">
        <span className="qt-st qt-st--good">✓ {s.fixed} fixed</span>
        <span className="qt-st qt-st--warn">↗ {s.improving} improving</span>
        <span className="qt-st qt-st--bad">○ {s.open} open</span>
      </div>

      <button className="qt-link" onClick={() => go("DNA")}>
        Explore your Chess DNA ↗
      </button>
    </section>
  );
}

/* ---------- Just want a game ---------- */
function QuickPlayCard() {
  return (
    <section className="qt-card qt-quick">
      <div className="qt-quick-head">
        <div className="qt-quick-icon" aria-hidden="true">⚔</div>
        <div>
          <div className="qt-quick-title">Just want a game?</div>
          <div className="qt-quick-sub">No mission. No pressure.</div>
        </div>
      </div>
      <button className="qt-quick-btn" onClick={() => go("Play")}>
        ▷ Quick play · 10 + 0
      </button>
      <div className="qt-quick-foot">Always here. Every game can teach you.</div>
    </section>
  );
}

/* ---------- Bottom connect banner ---------- */
function ConnectBanner() {
  return (
    <section className="qt-banner">
      <div className="qt-banner-icon" aria-hidden="true">🔗</div>
      <div className="qt-banner-text">
        <strong>The coach that learns from your games.</strong>
        <span>Connect → Find your leaks → Train your positions → Prove it in play</span>
      </div>
      <div className="qt-banner-actions">
        <span className="qt-chip qt-chip--good">✓ Lichess</span>
        <button className="qt-btn" onClick={() => go("Games")}>Connect Chess.com</button>
        <button className="qt-btn" onClick={() => go("Games")}>⇪ Import PGN</button>
      </div>
    </section>
  );
}

export default function Today() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    loadToday()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((err) => {
        console.error("Today load failed:", err);
        if (alive) setError("Today ka data load nahi ho paya. Page refresh karke dekho.");
      });

    return () => {
      alive = false;
    };
  }, []);

  const onToggle = useCallback(async (id, done) => {
    try {
      const next = await setStepDone(id, done);
      setData((prev) => (prev ? { ...prev, ...next } : prev));
    } catch (err) {
      console.error("Could not save step:", err);
    }
  }, []);

  if (error) return <div className="qt-page"><p className="qt-note">{error}</p></div>;
  if (!data) return <div className="qt-page"><p className="qt-note">Loading…</p></div>;

  const dateLabel = new Date()
    .toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();

  // data.user?.name ho to welcome mein dikhega, warna sirf "Welcome back"
  const name = data.user?.name;

  return (
    <div className="qt-page">
      <header className="qt-hero">
        <div>
          <div className="qt-eyebrow qt-eyebrow--accent">{dateLabel}</div>
          <h1 className="qt-hero-title">Your next move is a better you.</h1>
          <p className="qt-hero-sub">
            Welcome back{name ? `, ${name}` : ""}. Let&rsquo;s turn yesterday&rsquo;s games into today&rsquo;s edge.
          </p>
        </div>
        <span className="qt-streak">🔥 You&rsquo;re on a {data.streak.count}-day streak</span>
      </header>

      <div className="qt-grid">
        <div className="qt-col">
          <PlanCard data={data} onToggle={onToggle} />
          <LastGameCard game={data.lastGame} />
        </div>

        <div className="qt-col">
          <LeakCard leaks={data.leaks} />
          <QuickPlayCard />
        </div>
      </div>

      <ConnectBanner />

      <footer className="qt-foot">
        <span>Built from your games. Measured in your games.</span>
        {(data.plan.isSample || data.lastGame.isSample || data.leaks.isSample) && <span>Sample player &amp; game data</span>}
      </footer>
    </div>
  );
}