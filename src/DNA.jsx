import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { computeLeaks, loadReviewedGames } from "./leaks";
import {
  averageAccuracy,
  clockAccuracy,
  computeSkills,
  periodRecords,
  verdict,
} from "./skills";

import { setSetting } from "./storage";
import { requestCoachLesson, SKILL_TO_LEAK, TRAIN_MAP } from "./features/blindspot/blindspot"; // QV-BLINDSPOT
import { bt } from "./features/blindspot/strings";
import { tx } from "./i18n/pages/dna"; // QV-I18N
import { lit } from "./i18n/pages/today"; // QV-I18N
import PageLoader, { usePageLoaderDelay } from "./PageLoader";
import { downloadBlob, renderDnaCard } from "./dnaCard";
import "./DNA.css";
import "./DNAGlow.css";
import "./DNAFx.css";
import "./DNALayout.css"; // sabse last: naya compact layout

const HORSE = "/dna/horse.jpg";
const MIN_LOAD_MS = 0; // QV-PERF (pehle 800) // loader kam se kam itni der (ms) dikhega. 0 = minimum band.

// cursor position -> CSS variables, used for the border glow and the horse parallax
function trackGlow(e) {
  const el = e.target.closest ? e.target.closest(".dn-glow") : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  el.style.setProperty("--mx", `${x}px`);
  el.style.setProperty("--my", `${y}px`);
  el.style.setProperty("--px", String((x / r.width - 0.5) * 2));
  el.style.setProperty("--py", String((y / r.height - 0.5) * 2));
}

const WINDOWS = [
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "all", label: "All time" },
]; // labels are English keys, shown through tx()

function goTo(page) {
  window.dispatchEvent(
    new CustomEvent("qelvaris-navigate", { detail: page })
  );
}

async function trainLeak(id) {
  try {
    await setSetting("labLeak", id);
  } catch (error) {
    console.error("Could not save leak choice:", error);
  }
  goTo("Leak Lab");
}

const tone = (value) =>
  value === null || value === undefined
    ? "none"
    : value >= 70
      ? "good"
      : value >= 55
        ? "warn"
        : "bad";

const show = (value) =>
  value === null || value === undefined ? "—" : value;

function Radar({ skills, previous }) {
  const width = 560;
  const height = 430;
  const center = width / 2;
  const middle = height / 2;
  const radius = 140;

  // The chart runs from 50 (centre) to 100 (outer edge): almost every real score sits in the
  // upper half, so a 0-100 scale made the skills look identical. The numbers shown are unchanged.
  const FLOOR = 50;
  const norm = (value) => Math.min(1, Math.max(0, (value - FLOOR) / (100 - FLOOR)));

  const point = (index, value, scale = 1) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    const r = radius * norm(value) * scale;

    return [
      center + r * Math.cos(angle),
      middle + r * Math.sin(angle),
    ];
  };

  const shape = (list) =>
    list.map((item, i) => point(i, item.value ?? 0).join(",")).join(" ");

  const ring = (value) =>
    skills.map((_, i) => point(i, value).join(",")).join(" ");

  const hasPrevious =
    previous && previous.some((item) => item.value !== null);

  return (
    <svg
      className="dn-radar"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={tx("Six chess skills radar chart")}
    >
      {[60, 70, 80, 90, 100].map((value) => (
        <polygon
          key={value}
          points={ring(value)}
          className="dn-ring"
        />
      ))}

      {[60, 80, 100].map((value) => {
        const [lx, ly] = point(0, value);
        return (
          <text key={`t${value}`} x={lx + 5} y={ly + 3} fontSize="10" fill="currentColor" opacity="0.45" aria-hidden="true">
            {value}
          </text>
        );
      })}

      {skills.map((_, i) => {
        const [x, y] = point(i, 100);
        return (
          <line
            key={i}
            x1={center}
            y1={middle}
            x2={x}
            y2={y}
            className="dn-axis"
          />
        );
      })}

      {hasPrevious && (
        <polygon points={shape(previous)} className="dn-prev" />
      )}

      <polygon points={shape(skills)} className="dn-now" />

      {skills.map((item, i) => {
        const [x, y] = point(i, 100, 1.22);
        const [px, py] = point(i, item.value ?? 0);
        const angle = -Math.PI / 2 + i * Math.PI / 3;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const anchor =
          cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";

        const offset = Math.abs(cos) < 0.3 ? (sin > 0 ? 14 : -8) : 0;

        return (
          <g key={item.id}>
            {item.value !== null && (
              <circle
                cx={px}
                cy={py}
                r="4"
                className="dn-dot"
              />
            )}

            <text
              x={x}
              y={y - 4 + offset}
              textAnchor={anchor}
              className="dn-label"
            >
              {lit(item.label)}
            </text>

            <text
              x={x}
              y={y + 14 + offset}
              textAnchor={anchor}
              className="dn-value"
            >
              {show(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MetricCard({ label, value, detail, icon }) {
  return (
    <article className="dn-glow dn-metric">
      <div className="dn-metric-top">
        <span className="dn-metric-icon">{icon}</span>
        <span className="dn-metric-label">{label}</span>
      </div>
      <strong className="dn-metric-value">{value}</strong>
      <span className="dn-metric-detail">{detail}</span>
    </article>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

/* Popup: DNA card image banata hai, preview dikhata hai, aur download deta hai */
function CardModal({ data, onClose }) {
  const [state, setState] = useState({ status: "loading", blob: null, url: null });

  useEffect(() => {
    let alive = true;
    let objectUrl = null;

    renderDnaCard(data)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: "ready", blob, url: objectUrl });
      })
      .catch((error) => {
        console.error("Could not create DNA card:", error);
        if (alive) setState({ status: "error", blob: null, url: null });
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fileName = `qelvaris-chess-dna-${new Date().toISOString().slice(0, 10)}.png`;

  return createPortal(
    <div
      className="dn2-modal"
      role="dialog"
      aria-modal="true"
      aria-label={tx("Download DNA card")}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dn2-modal-box">
        <div className="dn2-modal-head">
          <h3>{tx("Download DNA card")}</h3>
          <button type="button" className="dn2-x" onClick={onClose} aria-label={tx("Close")}>
            ✕
          </button>
        </div>

        <div className="dn2-preview">
          {state.status === "loading" && (
            <div className="dn2-loading">
              <i />
              <span>{tx("Preparing your card...")}</span>
            </div>
          )}
          {state.status === "error" && (
            <p className="dn2-error">{tx("Could not create the image. Please try again.")}</p>
          )}
          {state.status === "ready" && <img src={state.url} alt={tx("Chess DNA")} />}
        </div>

        <div className="dn2-modal-actions">
          <button type="button" className="dn2-btn" onClick={onClose}>
            {tx("Close")}
          </button>
          <button
            type="button"
            className="dn2-btn dn2-btn--primary"
            disabled={state.status !== "ready"}
            onClick={() => state.blob && downloadBlob(state.blob, fileName)}
          >
            <DownloadIcon />
            {tx("Download PNG")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function DNA() {
  const [records, setRecords] = useState(null);
  const [days, setDays] = useState("30");
  const [openLeak, setOpenLeak] = useState(null);
  const [cardData, setCardData] = useState(null);
  const minDone = usePageLoaderDelay(MIN_LOAD_MS);
  const closeCard = useCallback(() => setCardData(null), []);

  useEffect(() => {
    let alive = true;

    loadReviewedGames()
      .then((loaded) => {
        if (alive) setRecords(loaded);
      })
      .catch((error) => {
        console.error("Could not load games:", error);
        if (alive) setRecords([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  const periods = useMemo(
    () => (records ? periodRecords(records, days) : null),
    [records, days]
  );

  const skills = useMemo(
    () => (periods ? computeSkills(periods.current) : []),
    [periods]
  );

  const previousSkills = useMemo(
    () =>
      periods && periods.previous.length
        ? computeSkills(periods.previous)
        : null,
    [periods]
  );

  const report = useMemo(
    () => (periods ? computeLeaks(periods.current, records) : null),
    [periods, records]
  );

  const previousReport = useMemo(
    () =>
      periods && periods.previous.length
        ? computeLeaks(periods.previous, records)
        : null,
    [periods, records]
  );

  const clocks = useMemo(
    () => (periods ? clockAccuracy(periods.current) : null),
    [periods]
  );

  if (records === null || !minDone) {
    return (
      <PageLoader
        page="dna"
        title={tx("Reading your chess history...")}
        messages={[
          tx("Counting your games"),
          tx("Mapping your six skills"),
          tx("Finding your habits"),
        ]}
      />
    );
  }

  const hero = (withTabs) => (
    <header className="dn-glow dn2-hero">
      <div className="dn2-id">
        <span className="dn2-photo" aria-hidden="true">
          <img src={HORSE} alt="" draggable="false" />
        </span>

        <div className="dn2-titles">
          <span className="dn2-kicker">{tx("YOUR PLAYER PROFILE")}</span>
          <h1>{tx("Chess")} <span>{tx("DNA")}</span></h1>
        </div>

        {records.length > 0 && (
          <span className="dn2-chip">
            <i />
            {records.length === 1
              ? tx("Live from 1 reviewed game")
              : tx("Live from {n} reviewed games", { n: records.length })}
          </span>
        )}
      </div>

      {withTabs && (
        <div
          className="dn-windows dn2-tabs"
          role="group"
          aria-label={tx("Select time window")}
        >
          {WINDOWS.map((item) => (
            <button
              key={item.id}
              className={`dn-win ${days === item.id ? "is-on" : ""}`}
              onClick={() => {
                setDays(item.id);
                setOpenLeak(null);
              }}
              aria-pressed={days === item.id}
            >
              {tx(item.label)}
            </button>
          ))}
        </div>
      )}
    </header>
  );

  if (records.length === 0) {
    return (
      <div className="dn-page dn2-page" onPointerMove={trackGlow}>
        {hero(false)}

        <section className="dn-empty-state">
          <div className="dn-empty-icon">♟</div>
          <span className="dn-kicker">{tx("YOUR PROFILE STARTS HERE")}</span>
          <h2>{tx("Your chess DNA needs games")}</h2>
          <p>
            {tx("This profile is built from games you have played and had checked by the engine. Add your games to explore your six skills and the habits that cost you rating points.")}
          </p>
          <button
            className="dn-primary-btn"
            onClick={() => goTo("Connect")}
          >
            {tx("Add your games")} <span>→</span>
          </button>
        </section>
      </div>
    );
  }

  const current = periods.current;
  const accNow = averageAccuracy(current);
  const accPrev = periods.previous.length
    ? averageAccuracy(periods.previous)
    : null;

  const leakNow = report.total;
  const leakPrev = previousReport ? previousReport.total : null;

  const measured = skills.filter((item) => item.value !== null);

  const weakest = measured.length
    ? measured.reduce((a, b) => (b.value < a.value ? b : a))
    : null;

  const strongest = measured.length
    ? measured.reduce((a, b) => (b.value > a.value ? b : a))
    : null;

  const note = verdict({
    leakNow,
    leakPrev,
    accNow,
    accPrev,
    weakest: weakest?.label,
  });

  const maxPoints = Math.max(
    ...report.leaks.map((leak) => leak.points),
    1
  );

  const openId = openLeak === null ? report.leaks[0]?.id : openLeak;
  const windowLabel = tx(WINDOWS.find((item) => item.id === days).label);
  const periodText =
    days === "all"
      ? tx("All recorded games")
      : tx("Last {window}", { window: windowLabel });

  // Download button dabane par: card ka sara data ek jagah jama hota hai
  const openCard = () => {
    const highlights = [];
    if (strongest && measured.length > 1) {
      highlights.push({
        label: tx("Strongest skill"),
        name: lit(strongest.label),
        value: strongest.value,
        tone: "good",
      });
    }
    if (weakest) {
      highlights.push({
        label: tx("Focus area"),
        name: lit(weakest.label),
        value: weakest.value,
        tone: "bad",
      });
    }

    setCardData({
      photo: HORSE,
      kicker: `QELVARIS · ${tx("YOUR PLAYER PROFILE")}`,
      title: `${tx("Chess")} ${tx("DNA")}`,
      chip: `${tx("Reviewed games")}: ${current.length} · ${periodText}`,
      skills: skills.map((item) => ({ label: lit(item.label), value: item.value })),
      previous: previousSkills
        ? previousSkills.map((item) => ({ value: item.value }))
        : null,
      stats: [
        { label: tx("Reviewed games"), value: current.length },
        { label: tx("Average accuracy"), value: accNow !== null ? `${accNow.toFixed(1)}%` : "—" },
        { label: tx("Leak score"), value: `−${leakNow}` },
        { label: tx("Focus area"), value: weakest ? lit(weakest.label) : "—" },
      ],
      leaksTitle: tx("Where points are slipping"),
      leaks: report.leaks.slice(0, 3).map((leak) => ({
        title: lit(leak.title),
        points: leak.points,
      })),
      emptyLeaks: tx("No repeating habits found"),
      highlightsTitle: tx("Skill highlights"),
      highlights,
      legendCurrent: tx("Current period"),
      legendPrevious: tx("Previous period"),
      footerLeft: `QELVARIS · ${tx("PLAYER DNA")}`,
      footerRight: new Date().toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    });
  };

  return (
    <div className="dn-page dn2-page" onPointerMove={trackGlow}>
      {hero(true)}

      {current.length === 0 ? (
        <section className="dn-empty-state">
          <div className="dn-empty-icon">◷</div>
          <h2>{tx("No reviewed games in the last {window}", { window: windowLabel })}</h2>
          <p>
            {tx("There are no reviewed games in this time window. Choose a longer window to explore your history.")}
          </p>
          <button
            className="dn-primary-btn"
            onClick={() => setDays("all")}
          >
            {tx("Show all time")} <span>→</span>
          </button>
        </section>
      ) : (
        <>
          <section className="dn-metrics" aria-label={tx("Your performance snapshot")}>
            <MetricCard
              icon="♟"
              label={tx("Reviewed games")}
              value={current.length}
              detail={periodText}
            />

            <MetricCard
              icon="◎"
              label={tx("Average accuracy")}
              value={accNow !== null ? `${accNow.toFixed(1)}%` : "—"}
              detail={tx("Across reviewed games")}
            />

            <MetricCard
              icon="⌁"
              label={tx("Leak score")}
              value={`−${leakNow}`}
              detail={tx("Estimated points lost")}
            />

            <MetricCard
              icon="◇"
              label={tx("Focus area")}
              value={weakest ? lit(weakest.label) : "—"}
              detail={tx("Lowest measured skill")}
            />
          </section>

          <div className="dn-main-grid dn2-grid">
            <section className="dn-glow dn-panel dn-skills dn2-skills">
              <div className="dn-panel-heading">
                <div>
                  <span className="dn-kicker">{tx("PLAYER ATTRIBUTES")}</span>
                  <h2>{tx("Six skills profile")}</h2>
                  <p>
                    {tx("Your performance across six chess situations.")}
                  </p>
                </div>

                <button
                  type="button"
                  className="dn2-dl"
                  onClick={openCard}
                  title={tx("Download DNA card")}
                >
                  <DownloadIcon />
                  <span>{tx("Download DNA card")}</span>
                </button>
              </div>

              <div className="dn-chart-wrap">
                <Radar key={days} skills={skills} previous={previousSkills} />
              </div>

              <div className="dn-legend">
                <span>
                  <i className="dn-key dn-key--now" />
                  {tx("Current period")}
                </span>

                {previousSkills && (
                  <span>
                    <i className="dn-key dn-key--prev" />
                    {tx("Previous period")}
                  </span>
                )}
              </div>

              {weakest && TRAIN_MAP[SKILL_TO_LEAK[weakest.id]] && (
                <button
                  type="button"
                  className="dn2-train-skill"
                  onClick={() => requestCoachLesson(SKILL_TO_LEAK[weakest.id])}
                >
                  {bt("trainSkill", { skill: lit(weakest.label) })}
                  <span aria-hidden="true">→</span>
                </button>
              )}

              <div className="dn-chart-note">
                <span>ⓘ</span>
                <p>
                  {tx("Each skill is the average accuracy of your moves in that situation. A skill needs at least 8 such moves to show a number.")}
                </p>
              </div>
            </section>

            <section className="dn-glow dn-panel dn-leaks">
              <div className="dn-panel-heading">
                <div>
                  <span className="dn-kicker">{tx("IMPROVEMENT PRIORITIES")}</span>
                  <h2>{tx("Where points are slipping")}</h2>
                  <p>
                    {tx("Repeating habits ranked by estimated rating points lost.")}
                  </p>
                </div>
                <span className="dn-panel-symbol">↘</span>
              </div>

              {report.leaks.length === 0 ? (
                <div className="dn-no-leaks">
                  <span>✧</span>
                  <h3>{tx("No repeating habits found")}</h3>
                  <p>
                    {tx("Keep playing and checking your games. New patterns may appear as more games are reviewed.")}
                  </p>
                </div>
              ) : (
                <div className="dn-acc">
                  {report.leaks.slice(0, 6).map((leak) => {
                    const open = leak.id === openId;
                    return (
                      <div key={leak.id} className={`dn-acc-item${open ? " is-open" : ""}`}>
                        <button
                          className="dn-acc-head"
                          aria-expanded={open}
                          aria-controls={`dn-leak-${leak.id}`}
                          onClick={() => setOpenLeak(open ? "" : leak.id)}
                        >
                          <strong>{lit(leak.title)}</strong>
                          {leak.status !== "Open" && (
                            <span className={`dn-status ${leak.status === "Fixed" ? "is-fixed" : "is-working"}`}>
                              {lit(leak.status)}
                            </span>
                          )}
                          <span className="dn-points">−{leak.points}</span>
                        </button>
                        {open && (
                          <div className="dn-acc-body" id={`dn-leak-${leak.id}`}>
                            <div className="dn-acc-text">
                              <p className="dn-leak-text">
                                {lit(leak.text)}{" "}
                                {report.games === 1
                                  ? tx("Found in {n} of {total} game.", { n: leak.games, total: report.games })
                                  : tx("Found in {n} of {total} games.", { n: leak.games, total: report.games })}
                              </p>
                              <div className="dn-bar" aria-hidden="true">
                                <div style={{ width: `${(leak.points / maxPoints) * 100}%` }} />
                              </div>
                            </div>
                            <button className="dn-train" onClick={() => trainLeak(leak.id)}>
                              {tx("Train this")} <span>→</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="dn-disclaimer">
                {tx("Points are an estimate: how much winning chance each habit costs per game, converted to rating points.")}
              </p>
            </section>
          </div>

          <div className="dn-bottom-grid dn2-bottom">
            <section className="dn-glow dn-panel dn-clock-panel">
              <div className="dn-panel-heading">
                <div>
                  <span className="dn-kicker">{tx("Accuracy by clock")}</span>
                  <h2>{tx("Time management")}</h2>
                </div>
                <span className="dn-panel-symbol">◷</span>
              </div>

              {clocks.hasClocks ? (
                <div className="dn-clock">
                  {clocks.buckets.map((bucket) => (
                    <div key={bucket.id} className="dn-clock-col">
                      <strong className="dn-clock-num">
                        {show(bucket.value)}
                        {bucket.value !== null ? "%" : ""}
                      </strong>

                      <div className="dn-clock-bar">
                        <div
                          className={`dn-tone dn-tone--${tone(bucket.value)}`}
                          style={{
                            height: `${bucket.value ?? 0}%`,
                          }}
                        />
                      </div>

                      <span>{lit(bucket.label)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dn-no-clocks">
                  <span>◷</span>
                  <p>
                    {tx("These games have no clock data. Games imported from Lichess or Chess.com usually include it.")}
                  </p>
                </div>
              )}
            </section>

            <section className="dn-glow dn-panel dn-compare">
              <div className="dn-panel-heading">
                <div>
                  <span className="dn-kicker">{tx("Period comparison")}</span>
                  <h2>{tx("Progress tracker")}</h2>
                </div>
                <span className="dn-panel-symbol">↗</span>
              </div>

              <div className="dn-compare-content">
                <div className="dn-compare-row">
                  <div>
                    <span>{tx("Leak score")}</span>
                    <small>{tx("Estimated points lost")}</small>
                  </div>

                  <div className="dn-compare-values">
                    <span className="dn-from">
                      {leakPrev !== null ? `−${leakPrev} →` : ""}
                    </span>
                    <strong
                      className={
                        leakPrev !== null && leakNow < leakPrev
                          ? "is-good"
                          : ""
                      }
                    >
                      −{leakNow}
                    </strong>
                  </div>
                </div>

                <div className="dn-compare-row">
                  <div>
                    <span>{tx("Average accuracy")}</span>
                    <small>{tx("Reviewed game accuracy")}</small>
                  </div>

                  <div className="dn-compare-values">
                    <span className="dn-from">
                      {accPrev !== null
                        ? `${accPrev.toFixed(1)} →`
                        : ""}
                    </span>
                    <strong
                      className={
                        accPrev !== null &&
                        accNow !== null &&
                        accNow > accPrev
                          ? "is-good"
                          : ""
                      }
                    >
                      {accNow !== null ? accNow.toFixed(1) : "—"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="dn-verdict">
                <span>✧</span>
                <p>
                  {note
                    ? lit(note)
                    : days === "all"
                      ? tx("Choose 30 or 90 days to compare with the period before.")
                      : tx("Not enough earlier games yet to compare.")}
                </p>
              </div>
            </section>
          </div>

          <footer className="dn-footer">
            <span>QELVARIS <i>·</i> {tx("PLAYER DNA")}</span>
            <span>{tx("Built from your reviewed games")}</span>
          </footer>
        </>
      )}

      {cardData && <CardModal data={cardData} onClose={closeCard} />}
    </div>
  );
}
