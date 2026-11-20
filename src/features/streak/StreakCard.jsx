// QV-STREAK: Today page ka streak card (hafte ka view, freeze, agla milestone).
import { statusText } from "./streakCore";
import { Flame } from "./StreakBadge";
import { useT } from "../../i18n/i18n"; // QV-I18N
import { ll } from "../../i18n/pages/leaklab"; // QV-I18N
import { lit } from "../../i18n/pages/today"; // QV-I18N
import "./streak.css";

const dotLabel = (state) =>
  ({ done: ll("dDone"), frozen: ll("dFrozen"), pending: ll("dPending"), missed: ll("dMissed"), future: ll("dFuture") })[state];

export default function StreakCard({ streak }) {
  useT(); // QV-I18N
  if (!streak) return null;
  const letters = ll("weekLetters").split(",");
  const { count, best, freezes, week, nextMilestone, milestoneProgress } = streak;

  return (
    <section className="qt-card qs-card">
      <div className="qs-head">
        <div className="qs-head-left">
          <span className={`qs-big-flame ${streak.activeToday ? "is-lit" : ""}`}>
            <Flame lit={streak.activeToday} />
          </span>
          <div>
            <div className="qt-eyebrow">{ll("sYour")}</div>
            <div className="qs-count">
              {count}
              <span> {count === 1 ? ll("sDay") : ll("sDays")}</span>
            </div>
          </div>
        </div>
        <div className="qs-best" title={ll("sBestTip")}>
          <strong>{best}</strong>
          <span>{ll("sBest")}</span>
        </div>
      </div>

      <div className="qs-week" role="list" aria-label={ll("sWeek")}>
        {week.map((d, i) => (
          <div
            key={d.key}
            role="listitem"
            className={`qs-day qs-day--${d.state} ${d.isToday ? "is-today" : ""}`}
            title={dotLabel(d.state)}
          >
            <span className="qs-dot" aria-label={dotLabel(d.state)}>
              {d.state === "done" ? "✓" : d.state === "frozen" ? "❄" : ""}
            </span>
            <span className="qs-dl">{letters[i] || d.label}</span>
          </div>
        ))}
      </div>

      <p className="qs-msg">{lit(statusText(streak))}</p>

      {nextMilestone && (
        <div className="qs-mile">
          <div className="qs-mile-bar" aria-hidden="true">
            <div className="qs-mile-fill" style={{ width: `${Math.round(milestoneProgress * 100)}%` }} />
          </div>
          <div className="qs-mile-cap">
            <span>{ll("sDaysOf", { count, next: nextMilestone })}</span>
            <span>{ll("sNext")}</span>
          </div>
        </div>
      )}

      <div className="qs-foot">
        <span title={ll("sFreezeTip")}>
          {freezes === 1 ? ll("sFreeze1", { n: freezes }) : ll("sFreezeN", { n: freezes })}
        </span>
        <span>{ll("sAny")}</span>
      </div>
    </section>
  );
}
