// QV-LANDING: login se pehle dikhne wala landing page.
// onStart({source, username}) -> signup screen kholo (source/username Connect mein khud bhar jayenge)
// onSignIn() -> seedha login screen
import { useLayoutEffect, useRef, useState } from "react";
import MARKUP from "./landingMarkup";
import { initLanding } from "./landingLogic";
import { track } from "../features/telemetry/track"; // QV-TRACK
import QuickScan from "../features/quickscan/QuickScan.jsx"; // QV-QUICKSCAN
import "./landing.css";

export const PENDING_KEY = "qv_pending"; // Connect.jsx yahi key padhta hai

export default function Landing({ onStart, onSignIn }) {
  const ref = useRef(null);
  const [scan, setScan] = useState(null); // { source, username } jab quick scan khula ho
  const handlers = useRef({ onStart, onSignIn });
  handlers.current = { onStart, onSignIn };

  function goSignup(pending) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      /* ignore */
    }
    handlers.current.onStart?.(pending);
  }

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    root.innerHTML = MARKUP;
    const html = document.documentElement;
    const prevScroll = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";

    track("landing_view");
    initLanding(root, {
      onStart: (pending) => {
        track("landing_start", { source: pending?.source, hasName: Boolean(pending?.username) });
        // QV-QUICKSCAN: Lichess/Chess.com username ho toh pehle signup se pehle ka quick scan dikhao
        if ((pending?.source === "lichess" || pending?.source === "chesscom") && pending?.username) {
          setScan({ source: pending.source, username: pending.username });
          return;
        }
        goSignup(pending);
      },
      onSignIn: () => {
        track("landing_signin_click");
        handlers.current.onSignIn?.();
      },
    });

    return () => {
      html.style.scrollBehavior = prevScroll;
      root.innerHTML = ""; // listeners bhi saath hat jaate hain
    };
  }, []);

  return (
    <>
      <div className="qvl" ref={ref} />
      {scan && (
        <QuickScan
          source={scan.source}
          username={scan.username}
          onClose={() => setScan(null)}
          onSignup={() => goSignup(scan)}
        />
      )}
    </>
  );
}
