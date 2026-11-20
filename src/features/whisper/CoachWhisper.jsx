import { useEffect, useRef, useState } from "react";
import { getEngine, cancelEngine } from "../../engine2";
import { useT } from "../../i18n/i18n";
import { track } from "../telemetry/track";
import { describeMove, whisperText } from "./whisper";
import { wt } from "./strings";
import "./whisper.css";

// 3-level hints for practice games. Never plays the move for you.
export default function CoachWhisper({ fen, myTurn }) {
  useT();
  const [level, setLevel] = useState(0); // 0 = none shown
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("idle"); // idle | busy | fail
  const fenRef = useRef(fen);

  // New position: forget the old hint
  useEffect(() => {
    fenRef.current = fen;
    setLevel(0);
    setInfo(null);
    setState("idle");
  }, [fen]);

  useEffect(() => () => cancelEngine(), []);

  async function ask() {
    if (!myTurn || state === "busy") return;
    const next = Math.min(3, level + 1);
    if (info) {
      setLevel(next);
      track("whisper", { level: next });
      return;
    }
    setState("busy");
    const asked = fen;
    try {
      let best = null;
      const done = await getEngine().analyse(asked, { depth: 12, multipv: 1, onUpdate: (lines) => { best = lines[0]?.pv?.[0] || best; } });
      if (fenRef.current !== asked) return; // position changed while thinking
      const found = done ? describeMove(asked, best) : null;
      if (!found) { setState("fail"); return; }
      setInfo(found);
      setLevel(1);
      setState("idle");
      track("whisper", { level: 1 });
    } catch (e) {
      console.error("Whisper failed:", e);
      if (fenRef.current === asked) setState("fail");
    }
  }

  const text = info && level ? whisperText(info, level) : null;

  return (
    <div className="cw">
      <button type="button" className="cw__btn" onClick={ask} disabled={!myTurn || state === "busy" || level >= 3}>
        <span aria-hidden="true">♞</span> {state === "busy" ? wt("thinking") : level === 0 ? wt("btn") : wt("again")}
      </button>
      {!myTurn && <p className="cw__muted">{wt("off")}</p>}
      {state === "fail" && <p className="cw__warn" role="status">{wt("fail")}</p>}
      {text && (
        <p className="cw__say" role="status" aria-live="polite">
          <b>{level}/3</b> {wt(text.key, text.vars)}
        </p>
      )}
      <p className="cw__muted">{wt("note")}</p>
    </div>
  );
}
