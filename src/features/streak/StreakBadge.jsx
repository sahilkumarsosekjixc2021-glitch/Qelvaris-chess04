// QV-STREAK: topbar ka chhota streak badge. Click karne par Today khulta hai.
import { useEffect, useState } from "react";
import { loadStreak } from "../../todayData";
import "./streak.css";

export function Flame({ lit }) {
  return (
    <svg className={`qs-flame ${lit ? "is-lit" : ""}`} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function StreakBadge({ onClick }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      loadStreak()
        .then((s) => alive && setInfo(s))
        .catch((e) => console.error("Streak load failed:", e));

    refresh();
    const onChange = (e) => {
      if (e.detail) setInfo(e.detail);
      else refresh();
    };
    window.addEventListener("qelvaris-streak-changed", onChange);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("qelvaris-streak-changed", onChange);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!info) return null;

  const lit = info.activeToday;
  const title = lit
    ? `${info.count}-day streak. Today is done.`
    : info.count > 0
    ? `${info.count}-day streak. Do any one task today to keep it.`
    : "Start a streak: complete any one task today.";

  return (
    <button
      type="button"
      className={`qs-badge ${lit ? "is-lit" : ""} ${info.atRisk ? "is-risk" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <Flame lit={lit} />
      <span className="qs-badge-n">{info.count}</span>
    </button>
  );
}
