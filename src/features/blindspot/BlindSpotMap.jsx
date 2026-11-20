import { useMemo, useState } from "react";
import { LEAK_DEFS } from "../../leaks";
import { useT } from "../../i18n/i18n";
import { computeHeat, requestCoachLesson, TRAIN_MAP } from "./blindspot";
import { bt } from "./strings";
import "./blindspot.css";

const FILES = "abcdefgh";
const S = 60; // square size in the 480 viewBox

export default function BlindSpotMap({ records }) {
  useT(); // re-render when the language changes
  const [leakId, setLeakId] = useState("all");
  const [sel, setSel] = useState(null);

  const heat = useMemo(() => computeHeat(records || [], leakId), [records, leakId]);

  const present = useMemo(() => {
    const ids = new Set();
    for (const r of records || []) for (const m of r.userMoves || []) if (m.isError && m.leak) ids.add(m.leak);
    return LEAK_DEFS.filter((d) => ids.has(d.id));
  }, [records]);

  // Sabse garam 5 khane (kitni galtiyan aur kitna nuksaan)
  const ranked = useMemo(
    () => Object.entries(heat.cells).sort((a, b) => b[1].weight - a[1].weight).slice(0, 5),
    [heat]
  );

  const games = useMemo(() => {
    const ids = new Set();
    for (const r of records || []) {
      for (const m of r.userMoves || []) {
        if (m.isError && m.leak && (leakId === "all" || m.leak === leakId)) ids.add(r.id);
      }
    }
    return ids.size;
  }, [records, leakId]);

  if (!records || !records.length) {
    return (
      <section className="q-card bs">
        <h2 className="bs__title">{bt("title")}</h2>
        <p className="bs__muted">{bt("empty")}</p>
      </section>
    );
  }

  // Kuch tap na kiya ho to bhi sabse garam khana dikhao, taaki side kabhi khali na rahe
  const focusSq = sel || heat.top[0] || null;
  const cell = focusSq ? heat.cells[focusSq] : null;
  const maxWeight = ranked.length ? ranked[0][1].weight : 1;
  const lostTotal = Math.round(Object.values(heat.cells).reduce((sum, c) => sum + c.weight, 0));
  const activeLeak = leakId !== "all" ? leakId : cell?.examples?.[0]?.leak;
  const canTrain = activeLeak && TRAIN_MAP[activeLeak];

  const toggle = (name) => setSel(sel === name ? null : name);

  const squares = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const name = FILES[f] + (8 - r);
      const c = heat.cells[name];
      const light = (f + r) % 2 === 0;
      squares.push(
        <g
          key={name}
          onClick={() => (c ? toggle(name) : setSel(null))}
          style={{ cursor: c ? "pointer" : "default" }}
          role={c ? "button" : undefined}
          tabIndex={c ? 0 : undefined}
          aria-label={c ? bt("sel", { sq: name, n: c.count }) : undefined}
          onKeyDown={
            c
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(name);
                  }
                }
              : undefined
          }
        >
          <rect x={f * S} y={r * S} width={S} height={S} fill={light ? "#243650" : "#17233a"} />
          {c && <rect x={f * S} y={r * S} width={S} height={S} fill="#ff7d7d" opacity={0.18 + 0.62 * c.level} />}
          {focusSq === name && (
            <rect x={f * S + 3} y={r * S + 3} width={S - 6} height={S - 6} rx="6" fill="none" stroke="#f7b538" strokeWidth="4" />
          )}
          {c && (
            <text x={f * S + S / 2} y={r * S + S / 2 + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff" opacity=".9">
              {c.count}
            </text>
          )}
        </g>
      );
    }
  }

  return (
    <section className="q-card bs">
      <h2 className="bs__title">{bt("title")}</h2>
      <p className="bs__muted">{bt("sub")}</p>

      <div className="bs__chips" role="tablist">
        <button className={`bs__chip ${leakId === "all" ? "is-on" : ""}`} onClick={() => { setLeakId("all"); setSel(null); }}>
          {bt("all")}
        </button>
        {present.map((d) => (
          <button key={d.id} className={`bs__chip ${leakId === d.id ? "is-on" : ""}`} onClick={() => { setLeakId(d.id); setSel(null); }}>
            {d.title}
          </button>
        ))}
      </div>

      <div className="bs__body">
        <div className="bs__boardcol">
          <svg className="bs__board" viewBox="0 0 480 480" role="group" aria-label={bt("title")}>
            <defs>
              <clipPath id="bsclip"><rect width="480" height="480" rx="14" /></clipPath>
            </defs>
            <g clipPath="url(#bsclip)">{squares}</g>
            {FILES.split("").map((ch, i) => (
              <text key={ch} x={i * S + 4} y={476} fontSize="11" fill="#7d8aa5">{ch}</text>
            ))}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
              <text key={r} x={4} y={r * S + 14} fontSize="11" fill="#7d8aa5">{8 - r}</text>
            ))}
          </svg>

          <div className="bs__legend" aria-hidden="true">
            <span>{bt("legendLow")}</span>
            <i />
            <span>{bt("legendHigh")}</span>
          </div>
        </div>

        <div className="bs__side">
          {heat.moves === 0 ? (
            <p className="bs__muted">{bt("none")}</p>
          ) : (
            <>
              <div className="bs__stats">
                <div><strong>{heat.moves}</strong><span>{bt("mistakes")}</span></div>
                <div><strong>{games}</strong><span>{bt("games")}</span></div>
                <div><strong>{lostTotal}%</strong><span>{bt("lostTotal")}</span></div>
              </div>

              <p className="bs__hot">{bt("hotNow", { list: heat.top.join(", ") })}</p>

              <h3 className="bs__h">{bt("topSquares")}</h3>
              <ol className="bs__rank">
                {ranked.map(([sq, c]) => (
                  <li key={sq}>
                    <button type="button" className={focusSq === sq ? "is-on" : ""} onClick={() => setSel(sq)}>
                      <b>{sq}</b>
                      <span className="bs__bar"><i style={{ width: `${Math.max(6, (c.weight / maxWeight) * 100)}%` }} /></span>
                      <em>{c.count}x</em>
                    </button>
                  </li>
                ))}
              </ol>

              {cell && (
                <div className="bs__detail">
                  <h3 className="bs__h">{bt("moves", { sq: focusSq })}</h3>
                  <ul className="bs__list">
                    {cell.examples.slice(0, 5).map((e, i) => (
                      <li key={i}>
                        <b>{e.san}</b> <span>{e.label}</span> <em>{bt("loss", { n: e.loss })}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canTrain && (
                <button className="bs__train" onClick={() => requestCoachLesson(activeLeak)}>
                  {bt("train")}
                  <small>{bt("trainSub")}</small>
                </button>
              )}

              <p className="bs__foot">{bt("based", { n: heat.moves, g: games })}. {bt("note")}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
