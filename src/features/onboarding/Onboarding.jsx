import { useEffect, useRef, useState } from "react";
import { getSetting, setSetting, dbAll } from "../../storage";
import { LANGS, getLang, setLang, useT } from "../../i18n/i18n";
import { track } from "../telemetry/track";
import { COACH_OPEN_KEY } from "../blindspot/blindspot";
import { GOALS, LEVELS, firstStep } from "./flow.js";
import { ot } from "./strings";
import "./onboarding.css";

const DONE_KEY = "onboarded-v1";

export default function Onboarding() {
  useT();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState(null);
  const [goal, setGoal] = useState(null);
  const boxRef = useRef(null);

  // Show once, only for accounts with no games yet and no earlier onboarding.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (await getSetting(DONE_KEY, false)) return;
        const games = await dbAll("games");
        if (games && games.length > 0) { await setSetting(DONE_KEY, true); return; }
        if (alive) { setShow(true); track("onboarding_shown"); }
      } catch (e) { console.error("Onboarding check failed:", e); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (show) boxRef.current?.focus(); }, [show, step]);

  if (!show) return null;

  async function finish(action) {
    try { await setSetting(DONE_KEY, true); if (level) await setSetting("player-level", level); if (goal) await setSetting("player-goal", goal); }
    catch (e) { console.error("Could not save onboarding:", e); }
    track("onboarding_done", { level, goal, action });
    setShow(false);
    if (action === "lesson") {
      const f = firstStep(level, goal);
      if (f.type === "lesson") {
        try { sessionStorage.setItem(COACH_OPEN_KEY, JSON.stringify({ courseId: f.course, lessonId: f.lesson })); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: "Coach" }));
      } else {
        window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: f.page }));
      }
    } else if (action === "import") {
      window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: "Connect" }));
    }
  }

  const f = firstStep(level, goal);
  const Option = ({ on, onClick, title, desc }) => (
    <button type="button" className={`ob__opt ${on ? "is-on" : ""}`} onClick={onClick} aria-pressed={on}>
      <b>{title}</b>{desc && <span>{desc}</span>}
    </button>
  );

  return (
    <div className="ob" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="ob__box" ref={boxRef} tabIndex={-1}>
        <div className="ob__top">
          <span className="ob__step">{ot("step", { n: step })}</span>
          <button type="button" className="ob__skip" onClick={() => finish("skip")}>{ot("skip")}</button>
        </div>
        <h2 id="ob-title" className="ob__title">{step === 1 ? ot("welcome") : step === 2 ? ot("s2") : step === 3 ? ot("s3") : ot("ready")}</h2>
        {step === 1 && <p className="ob__sub">{ot("sub")}</p>}

        {step === 1 && (
          <div className="ob__grid">
            <p className="ob__q">{ot("s1")}</p>
            {LANGS.map((l) => <Option key={l.id} on={getLang() === l.id} onClick={() => setLang(l.id)} title={l.label} />)}
          </div>
        )}
        {step === 2 && (
          <div className="ob__grid">
            {LEVELS.map((l) => <Option key={l} on={level === l} onClick={() => setLevel(l)} title={ot("lv_" + l)} desc={ot("lv_" + l + "_d")} />)}
          </div>
        )}
        {step === 3 && (
          <div className="ob__grid">
            {GOALS.map((g) => <Option key={g} on={goal === g} onClick={() => setGoal(g)} title={ot("g_" + g)} desc={ot("g_" + g + "_d")} />)}
          </div>
        )}
        {step === 4 && (
          <div className="ob__grid">
            <p className="ob__sub">{f.type === "lesson" ? ot("readyLesson") : ot("readyPlay")}</p>
            <button type="button" className="ob__primary" onClick={() => finish("lesson")}>{f.type === "lesson" ? ot("startLesson") : ot("startPlay")}</button>
            <button type="button" className="ob__ghost" onClick={() => finish("import")}>{ot("importGames")}</button>
            <p className="ob__hint">{ot("importHint")}</p>
          </div>
        )}

        {step < 4 && (
          <div className="ob__nav">
            {step > 1 ? <button type="button" className="ob__ghost" onClick={() => setStep(step - 1)}>{ot("back")}</button> : <span />}
            <button
              type="button"
              className="ob__primary"
              disabled={(step === 2 && !level) || (step === 3 && !goal)}
              onClick={() => setStep(step + 1)}
            >{ot("next")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
