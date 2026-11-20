import { useEffect, useState } from "react";
import { computeLeaks, inWindow, loadReviewedGames } from "../../leaks";
import { useT } from "../../i18n/i18n";
import { computeHeat, requestCoachLesson, TRAIN_MAP } from "./blindspot";
import { bt } from "./strings";

// Today's focus: your most costly leak that has a Coach lesson, plus where it happens most.
export default function FocusCard() {
  useT();
  const [pick, setPick] = useState(undefined); // undefined = loading, null = none

  useEffect(() => {
    let alive = true;
    loadReviewedGames()
      .then((records) => {
        if (!alive) return;
        if (!records.length) return setPick(null);
        const win = inWindow(records, 30);
        const used = win.length ? win : records;
        const { leaks } = computeLeaks(used, records);
        const leak = leaks.find((l) => TRAIN_MAP[l.id]);
        if (!leak) return setPick(null);
        const heat = computeHeat(used, leak.id);
        setPick({ id: leak.id, title: leak.title, n: leak.games, g: used.length, sq: heat.top[0] || null });
      })
      .catch((e) => { console.error("Focus failed:", e); if (alive) setPick(null); });
    return () => { alive = false; };
  }, []);

  if (pick === undefined) return null;

  return (
    <section className="qt-card" style={{ borderColor: "rgba(79,209,197,.4)" }}>
      <div className="qt-eyebrow qt-eyebrow--accent">{bt("focusTitle")}</div>
      {pick ? (
        <>
          <h2 className="qt-section-title">{pick.title}</h2>
          <p style={{ margin: "6px 0 0", color: "var(--qt-muted)", lineHeight: 1.5 }}>
            {bt("focusLeak", { leak: pick.title, n: pick.n, g: pick.g })}
            {pick.sq ? " " + bt("focusHot", { sq: pick.sq }) : ""}
          </p>
          <button
            type="button"
            onClick={() => requestCoachLesson(pick.id)}
            style={{ marginTop: 14, padding: "10px 18px", border: 0, borderRadius: 12, background: "#4fd1c5", color: "#052421", fontWeight: 800, cursor: "pointer" }}
          >
            {bt("focusStart")}
          </button>
        </>
      ) : (
        <p style={{ margin: "8px 0 0", color: "var(--qt-muted)", lineHeight: 1.5 }}>{bt("focusNone")}</p>
      )}
    </section>
  );
}
