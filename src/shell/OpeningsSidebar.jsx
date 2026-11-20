import { useEffect, useState } from "react";
import { getMiddlegames } from "../middlegames/middlegameBuild";
import { loadProgress } from "../middlegames/lessonStorage";
import "./OpeningsShell.css";

// Openings page ka left sidebar. onSelect(id): "" = Openings home, baaki section ids.

const Icon = ({ children }) => (
  <svg className="qs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ITEMS = [
  { id: "", label: "Openings", icon: <Icon><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" /><path d="M12 6v13.5" /></Icon> },
  { id: "explore", label: "Explore", icon: <Icon><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Icon> },
  { id: "repertoire", label: "Repertoire", icon: <Icon><path d="M7 4h10v16l-5-3.5L7 20z" /></Icon> },
  { id: "lab", label: "Middlegame Lab", icon: <Icon><path d="M9 3h6" /><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" /><path d="M7.5 15h9" /></Icon> },
  { id: "arena", label: "Practice", icon: <Icon><path d="M5 5l14 14" /><path d="M19 5L5 19" /><circle cx="12" cy="12" r="9" /></Icon> },
  { id: "progress", label: "Progress", icon: <Icon><path d="M5 20V11" /><path d="M12 20V5" /><path d="M19 20v-6" /></Icon> },
];

// Purane sections ko sidebar mein kis item ke neeche dikhana hai
const ALIAS = { study: "explore", practice: "arena" };

export default function OpeningsSidebar({ active = "", onSelect }) {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    loadProgress().then((p) => {
      if (!alive) return;
      let count = 0;
      try {
        const lessons = getMiddlegames().list;
        setTotal(lessons.length);
        count = lessons.filter((m) => p[m.id]).length;
      } catch {
        setTotal(0);
      }
      setDone(count);
    });
    return () => {
      alive = false;
    };
  }, [active]);

  const current = ALIAS[active] ?? active;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <nav className="qs-side" aria-label="Openings sections">
      <ul className="qs-menu">
        {ITEMS.map((item) => (
          <li key={item.id || "home"}>
            <button
              type="button"
              className={`qs-item ${current === item.id ? "is-on" : ""}`}
              aria-current={current === item.id ? "page" : undefined}
              onClick={() => onSelect?.(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {total > 0 && (
        <div className="qs-mile">
          <svg className="qs-cup" viewBox="0 0 48 48" aria-hidden="true">
            <defs>
              <linearGradient id="qs-cup-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffe08a" />
                <stop offset="1" stopColor="#c98a1c" />
              </linearGradient>
            </defs>
            <path d="M14 8h20v10a10 10 0 0 1-20 0z" fill="url(#qs-cup-g)" />
            <path d="M14 11H8c0 6 3 9 7 9M34 11h6c0 6-3 9-7 9" fill="none" stroke="#e8b04a" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="21" y="26" width="6" height="8" fill="#d79a2b" />
            <rect x="15" y="34" width="18" height="5" rx="2" fill="url(#qs-cup-g)" />
          </svg>
          <div className="qs-mile-title">{done === total ? "Every lesson done!" : "Lab progress"}</div>
          <div className="qs-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="qs-mile-sub">
            {done} of {total} lessons · {percent}%
          </div>
        </div>
      )}
    </nav>
  );
}
