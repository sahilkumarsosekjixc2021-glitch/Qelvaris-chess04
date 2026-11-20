import { useCallback, useEffect, useId, useState } from "react";
import { useT } from "./i18n/i18n"; // QV-I18N
import { td, lit } from "./i18n/pages/today"; // QV-I18N
import Board from "./Board";
import StreakCard from "./features/streak/StreakCard"; // QV-STREAK
import { loadToday, setStepDone } from "./todayData";
import FocusCard from "./features/blindspot/FocusCard"; // QV-BLINDSPOT
import Onboarding from "./features/onboarding/Onboarding"; // QV-ONBOARD
import "./Today.css";
import "./TodayLayout.css";

/* Today khulne par loading screen kam se kam itni der dikhegi (ms),
   taaki data jaldi aa jaye tab bhi king wali screen dikhe. 0 karoge to sirf real loading tak. */
const MIN_LOADER_MS = 0; // QV-PERF (pehle 1200)
/* true = Today par jab bhi jao loader dikhega. false = sirf app khulne ke baad pehli baar. */
const LOADER_EVERY_VISIT = true;
let loaderShownOnce = false;

function go(page) {
  window.dispatchEvent(
    new CustomEvent("qelvaris-navigate", { detail: page })
  );
}

const minus = (n) => String(n).replace("-", "−");

function Sample() {
  useT(); // QV-I18N
  return <span className="qt-sample">{td("sampleData")}</span>;
}

/* Loading page hata diya: data aane tak khali page */
function LoadingScreen() {
  return <div className="qt-page" role="status" aria-busy="true" aria-label="Loading" />;
}

function Ring({ done, total }) {
  useT(); // QV-I18N
  const gid = `qt-ring-${useId().replace(/:/g, "")}`;
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;

  return (
    <div
      className="qt-ring"
      role="img"
      aria-label={td("ringLabel", { done, total })}
    >
      <svg viewBox="0 0 64 64" width="64" height="64">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4fd1c5" />
            <stop offset="1" stopColor="#f7b538" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} className="qt-ring-bg" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="qt-ring-fg"
          stroke={`url(#${gid})`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="qt-ring-text">
        {done}/{total}
      </span>
    </div>
  );
}

function PlanCard({ data, onToggle }) {
  useT(); // QV-I18N
  const { steps } = data.plan;
  const doneCount = steps.filter((s) =>
    data.doneIds.includes(s.id)
  ).length;

  const firstOpen = steps.find(
    (s) => !data.doneIds.includes(s.id)
  );

  const pct = steps.length
    ? (doneCount / steps.length) * 100
    : 0;

  return (
    <section className="qt-card qt-plan-card">
      <div className="qt-card-kicker">
        <span className="qt-card-icon">✦</span>
        {td("kicker")}
        <span className="qt-card-label">{td("fifteen")}</span>
      </div>

      <div className="qt-plan-head">
        <div>
          <h2 className="qt-h2">{td("planTitle")}</h2>
          <div className="qt-sub">
            {td("planSub")}
          </div>
        </div>
        <Ring done={doneCount} total={steps.length} />
      </div>

      <div
        className="qt-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="qt-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="qt-progress-caption">
        <span>{td("completedOf", { done: doneCount, total: steps.length })}</span>
        <span>{td("pctComplete", { pct: Math.round(pct) })}</span>
      </div>

      <ol className="qt-steps">
        {steps.map((step, i) => {
          const done = data.doneIds.includes(step.id);
          const isCurrent = !done && firstOpen?.id === step.id;

          if (isCurrent) {
            return (
              <li key={step.id} className="qt-step qt-step--current">
                <div className="qt-current-top">
                  <span className="qt-upnext">
                    <span className="qt-live-dot" />
                    {td("upNext")}
                  </span>
                  <span className="qt-min">{td("min", { n: step.minutes })}</span>
                </div>

                <div className="qt-current-body">
                  <div className="qt-current-board">
                    <Board
                      fen={step.fen || data.lastGame.fen}
                      showCoords={false}
                    />
                  </div>

                  <div className="qt-current-info">
                    <div className="qt-current-title">
                      {lit(step.title)}
                    </div>
                    <div className="qt-step-kind">{lit(step.kind)}</div>
                    <div className="qt-step-from">{lit(step.from)}</div>
                    <button
                      className="qt-cta"
                      onClick={() => go(step.goTo)}
                    >
                      {td("continue", { kind: lit(step.kind).toLowerCase() })}
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li
              key={step.id}
              className={`qt-step qt-step--row ${
                done ? "qt-step--done" : ""
              }`}
            >
              <button
                className="qt-check"
                onClick={() => onToggle(step.id, !done)}
                aria-label={
                  done
                    ? td("markUndone", { kind: lit(step.kind) })
                    : td("markDone", { kind: lit(step.kind) })
                }
                aria-pressed={done}
              >
                {done ? "✓" : i + 1}
              </button>

              <div className="qt-step-body">
                <div className="qt-step-title">{lit(step.title)}</div>
                <div className="qt-step-from">
                  {lit(step.kind)} · {lit(step.from)}
                </div>
              </div>

              <span className="qt-min">{td("min", { n: step.minutes })}</span>

              {done ? (
                <span className="qt-chip qt-chip--good">{td("done")}</span>
              ) : (
                <span className="qt-chip">{td("next")}</span>
              )}
            </li>
          );
        })}
      </ol>

      {data.plan.isSample && (
        <p className="qt-note">
          {td("samplePlan")}
        </p>
      )}
    </section>
  );
}

function LastGameCard({ game }) {
  useT(); // QV-I18N
  const won = game.result && game.result.startsWith("1-0");

  return (
    <section className="qt-card qt-last">
      <div className="qt-card-head">
        <div>
          <div className="qt-eyebrow">{td("recent")}</div>
          <h2 className="qt-section-title">{td("lastGame")}</h2>
        </div>

        {game.isSample && <Sample />}
        {game.result && (
          <span className={`qt-chip ${won ? "qt-chip--good" : ""}`}>
            {won ? td("win") : td("result")} · {game.result}
          </span>
        )}
      </div>

      <div className="qt-last-row">
        <div className="qt-last-symbol">♟</div>

        <div className="qt-last-info">
          <div className="qt-last-title">{game.title}</div>
          <div className="qt-last-meta">
            {game.turningPoints
              ? td("turningPoints", { n: game.turningPoints })
              : td("notReviewed")}
            {game.source ? ` · ${game.source}` : ""}
          </div>
        </div>

        {game.accuracy !== null && game.accuracy !== undefined && (
          <div className="qt-acc-box">
            <strong className="qt-acc">{game.accuracy}</strong>
            <span>{td("accuracy")}</span>
          </div>
        )}

        <button className="qt-btn" onClick={() => go("Review")}>
          {td("openStory")}
        </button>
      </div>
    </section>
  );
}

function LeakCard({ leaks }) {
  useT(); // QV-I18N
  const max = Math.max(
    ...leaks.leaks.map((l) => Math.abs(l.points)),
    1
  );

  const s = leaks.status;

  return (
    <section className="qt-card qt-leak-card">
      <div className="qt-card-head">
        <div>
          <div className="qt-eyebrow">{td("insights")}</div>
          <h2 className="qt-section-title">{td("leaksTitle")}</h2>
        </div>
        {leaks.isSample && <Sample />}
        <span
          className="qt-info"
          title={td("leaksInfo")}
        >
          i
        </span>
      </div>

      <div className="qt-scorerow">
        <div className="qt-score">{minus(leaks.total)}</div>
        <div className="qt-scoretext">
          <strong>{td("ratingPoints")}</strong>
          <span>{td("estCost", { window: lit(leaks.windowLabel) })}</span>
        </div>
      </div>

      <p className="qt-tagline">
        {td("tagline")}
      </p>

      {leaks.leaks.length === 0 && (
        <p className="qt-note">
          {td("noLeaks")}
        </p>
      )}

      <ul className="qt-leaks">
        {leaks.leaks.map((leak) => (
          <li key={leak.name} className="qt-leak">
            <div className="qt-leak-row">
              <span>{lit(leak.name)}</span>
              <span className="qt-leak-pts">
                {minus(leak.points)}
              </span>
            </div>
            <div className="qt-bar">
              <div
                className="qt-bar-fill"
                style={{
                  width: `${(Math.abs(leak.points) / max) * 100}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="qt-status">
        <span className="qt-st qt-st--good">{td("fixed", { n: s.fixed })}</span>
        <span className="qt-st qt-st--warn">{td("improving", { n: s.improving })}</span>
        <span className="qt-st qt-st--bad">{td("open", { n: s.open })}</span>
      </div>

      <button className="qt-link" onClick={() => go("DNA")}>
        {td("exploreDna")} <span>↗</span>
      </button>
    </section>
  );
}

function QuickPlayCard() {
  useT(); // QV-I18N
  return (
    <section className="qt-card qt-quick">
      <div className="qt-quick-head">
        <div className="qt-quick-icon" aria-hidden="true">♞</div>
        <div>
          <div className="qt-eyebrow">{td("breakEyebrow")}</div>
          <div className="qt-quick-title">{td("justGame")}</div>
          <div className="qt-quick-sub">{td("noPressure")}</div>
        </div>
      </div>

      <button className="qt-quick-btn" onClick={() => go("Play")}>
        <span>▷</span> {td("quickPlay")}
        <span className="qt-quick-arrow">→</span>
      </button>

      <div className="qt-quick-foot">
        {td("quickFoot")}
      </div>
    </section>
  );
}

function ConnectBanner() {
  useT(); // QV-I18N
  return (
    <section className="qt-banner">
      <div className="qt-banner-icon" aria-hidden="true">♜</div>

      <div className="qt-banner-text">
        <div className="qt-eyebrow">{td("coachEyebrow")}</div>
        <strong>{td("coachLine")}</strong>
        <span>
          {td("coachFlow")}
        </span>
      </div>

      <div className="qt-banner-actions">
        <span className="qt-chip qt-chip--good">✓ Lichess</span>
        <button className="qt-btn" onClick={() => go("Games")}>
          {td("connectChess")}
        </button>
        <button className="qt-btn" onClick={() => go("Games")}>
          {td("importPgn")}
        </button>
      </div>
    </section>
  );
}

export default function Today() {
  useT(); // QV-I18N: re-render when the language changes
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [minDone, setMinDone] = useState(
    MIN_LOADER_MS <= 0 || (!LOADER_EVERY_VISIT && loaderShownOnce)
  );

  /* Pehli baar loader ko minimum time dikhao */
  useEffect(() => {
    if (minDone) return undefined;
    const t = setTimeout(() => {
      loaderShownOnce = true;
      setMinDone(true);
    }, MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, [minDone]);

  useEffect(() => {
    let alive = true;

    loadToday()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((err) => {
        console.error("Today load failed:", err);
        if (alive) {
          setError(
            td("loadError")
          );
        }
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

  if (error) {
    return (
      <div className="qt-page qt-state">
        <p className="qt-note">{error}</p>
      </div>
    );
  }

  if (!data || !minDone) {
    return <LoadingScreen />;
  }

  return (
    <div className="qt-page">
      <Onboarding />

      <div className="qt-grid">
        <div className="qt-col">
          <FocusCard />
          <PlanCard data={data} onToggle={onToggle} />
        </div>

        <div className="qt-col">
          <StreakCard streak={data.streak} />
          <LeakCard leaks={data.leaks} />
          <div className="qt-bottom">
            <LastGameCard game={data.lastGame} />
            <QuickPlayCard />
          </div>
        </div>
      </div>

      <ConnectBanner />

      <footer className="qt-foot">
        <span>{td("footer")}</span>
        {(data.plan.isSample ||
          data.lastGame.isSample ||
          data.leaks.isSample) && (
          <span>{td("sampleFoot")}</span>
        )}
      </footer>
    </div>
  );
}