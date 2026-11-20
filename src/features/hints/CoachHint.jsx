import { useEffect, useRef, useState } from "react";
import { getEngine, cancelEngine } from "../../engine2";
import { useT } from "../../i18n/i18n";
import { track } from "../telemetry/track";
import { buildHint } from "./hintLogic";
import { ht } from "./strings";

// Three-level hint for practice games. The coach asks first, then points, then tells.
// props: fen, active (your turn), onArrow(arrow|null), onSelect(square|null), onUsed(n)
export default function CoachHint({ fen, active, onArrow, onSelect, onUsed }) {
  useT();
  const [level, setLevel] = useState(0);
  const [hint, setHint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [total, setTotal] = useState(0);
  const fenRef = useRef(fen);

  // New position -> forget the old hint
  useEffect(() => {
    fenRef.current = fen;
    setLevel(0); setHint(null); setFailed(false);
    onArrow?.(null);
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { cancelEngine(); onArrow?.(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function ensureHint() {
    if (hint) return hint;
    setBusy(true);
    const asked = fen;
    let best = null;
    try {
      await getEngine().analyse(fen, { depth: 12, multipv: 1, onUpdate: (list) => { if (list[0]?.pv?.[0]) best = list[0].pv[0]; } });
    } catch { /* engine missing */ }
    setBusy(false);
    if (fenRef.current !== asked) return null; // position changed while thinking
    const built = buildHint(asked, best);
    if (!built) { setFailed(true); return null; }
    setHint(built);
    return built;
  }

  async function next() {
    if (!active || busy || level >= 3) return;
    const h = await ensureHint();
    if (!h) return;
    const lv = level + 1;
    setLevel(lv);
    const n = total + 1;
    setTotal(n);
    onUsed?.(n);
    track("coach_hint", { level: lv });
    if (lv === 2) onSelect?.(h.from);
    if (lv === 3) onArrow?.({ from: h.from, to: h.to });
  }

  return (
    <div className="ch" role="group" aria-label={ht("btn")}>
      <button type="button" className="ch__btn" onClick={next} disabled={!active || busy || level >= 3}>
        {busy ? ht("thinking") : level === 0 ? ht("btn") : ht("more")}
      </button>
      {!active && <p className="ch__note">{ht("wait")}</p>}
      {failed && <p className="ch__note">{ht("off")}</p>}
      {hint && level >= 1 && <p className="ch__text">{ht("l1", { piece: hint.piece })}</p>}
      {hint && level >= 2 && <p className="ch__text">{ht("l2")}</p>}
      {hint && level >= 3 && <p className="ch__text"><b>{ht("l3", { san: hint.san })}</b></p>}
      {total > 0 && <p className="ch__note">{ht("used", { n: total })}</p>}
    </div>
  );
}
