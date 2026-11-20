// QV-QUICKSCAN: landing par username daalte hi 10 second mein "quick scan" (signup se pehle).
// Games sirf is browser mein padhi jaati hain, kahin save nahi hoti.
import { useEffect, useRef, useState } from "react";
import { fetchChessComGames, fetchLichessGames } from "../../sources";
import { analyse } from "./quickScanLogic";
import { canvasToBlob, drawShareCard } from "./shareCard";
import { track } from "../telemetry/track";
import "./quickscan.css";

export default function QuickScan({ source, username, onSignup, onClose }) {
  const [state, setState] = useState({ phase: "loading" }); // loading | error | few | done
  const [shareMsg, setShareMsg] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    track("quickscan_start", { source });

    (async () => {
      try {
        const fetcher = source === "chesscom" ? fetchChessComGames : fetchLichessGames;
        const items = await fetcher(username, { max: 40, signal: controller.signal });
        const result = analyse(items, username);
        if (result.tooFew) {
          track("quickscan_few", { source, n: result.n });
          setState({ phase: "few", n: result.n });
        } else {
          track("quickscan_done", { source, n: result.n, findings: result.findings.map((f) => f.id).join(",") });
          setState({ phase: "done", result });
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        track("quickscan_error", { source, message: String(error?.message || "").slice(0, 100) });
        setState({ phase: "error", message: error?.message || "Something went wrong. Please try again." });
      }
    })();

    return () => controller.abort();
  }, [source, username]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onShare() {
    if (state.phase !== "done") return;
    track("quickscan_share");
    try {
      const canvas = drawShareCard({ username, source, result: state.result, host: window.location.host });
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("no image");
      const file = new File([blob], "qelvaris-leaks.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `Where my chess rating leaks. Find yours free: ${window.location.origin}` });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qelvaris-leaks.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setShareMsg("Image downloaded. Share it anywhere.");
    } catch (error) {
      if (error?.name !== "AbortError") setShareMsg("Could not make the image on this device.");
    }
  }

  const { phase } = state;

  return (
    <div className="qsc-overlay" role="dialog" aria-modal="true" aria-label="Quick scan" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qsc">
        <div className="qsc-top">
          <span className="qsc-kicker">QUICK SCAN</span>
          <button className="qsc-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {phase === "loading" && (
          <div className="qsc-load" role="status">
            <div className="qsc-spin" />
            <div>Reading @{username}&rsquo;s recent public games…</div>
          </div>
        )}

        {phase === "error" && (
          <>
            <h2>We could not scan that</h2>
            <div className="qsc-err" role="alert">{state.message}</div>
            <div className="qsc-actions">
              <button className="qsc-btn" onClick={onClose}>Try another username</button>
            </div>
          </>
        )}

        {phase === "few" && (
          <>
            <h2>Not enough games yet</h2>
            <p className="qsc-sub">We found {state.n} usable games for @{username}. We need at least 8 to spot a real pattern.</p>
            <div className="qsc-actions">
              <button className="qsc-btn qsc-btn--gold" onClick={onSignup}>Create free account anyway</button>
              <button className="qsc-btn" onClick={onClose}>Try another username</button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <h2>@{username}, here is what we see</h2>
            <p className="qsc-sub">From your last {state.result.n} public games. No account needed for this.</p>

            <div className="qsc-record">
              <span className="qsc-pill"><b>{state.result.wins}</b> wins</span>
              <span className="qsc-pill"><b>{state.result.draws}</b> draws</span>
              <span className="qsc-pill"><b>{state.result.losses}</b> losses</span>
            </div>

            {state.result.findings.length === 0 && (
              <div className="qsc-find is-good">
                <span className="qsc-big">✓</span>
                <strong>No big pattern in the surface stats</strong>
                <p>Your leaks are in the moves themselves. A full analysis will find them.</p>
              </div>
            )}

            {state.result.findings.map((f) => (
              <div key={f.id} className="qsc-find is-bad">
                <span className="qsc-big">{f.big}</span>
                <strong>{f.title}</strong>
                <p>{f.text}</p>
              </div>
            ))}

            {state.result.good && (
              <div className="qsc-find is-good">
                <span className="qsc-big">{state.result.good.big}</span>
                <strong>{state.result.good.title}</strong>
                <p>{state.result.good.text}</p>
              </div>
            )}

            <div className="qsc-lock">
              <strong>This is only the surface.</strong> The move-by-move leaks (hanging pieces, missed tactics,
              the exact positions where you slip) need engine analysis. A free account runs it on your device and
              turns them into a daily practice plan.
            </div>

            <div className="qsc-actions">
              <button
                className="qsc-btn qsc-btn--gold"
                onClick={() => {
                  track("quickscan_cta");
                  onSignup();
                }}
              >
                Create free account to see my leaks
              </button>
              <div className="qsc-row">
                <button className="qsc-btn" onClick={onShare}>Share my result</button>
                <button className="qsc-btn" onClick={onClose}>Close</button>
              </div>
            </div>
            {shareMsg && <p className="qsc-fine" role="status">{shareMsg}</p>}
            <p className="qsc-fine">Read straight from {source === "chesscom" ? "Chess.com" : "Lichess"}&rsquo;s public data. Nothing is saved.</p>
          </>
        )}
      </div>
    </div>
  );
}
