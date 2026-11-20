// QV-CELEBRATE: App mein ek baar lagta hai. Chhote reward par toast, bade moment par card + confetti.
// prefers-reduced-motion par confetti/animation band, sirf card dikhta hai.
import { useCallback, useEffect, useRef, useState } from "react";
import { playSound } from "../../sound";
import "./celebrate.css";

const BIG = new Set(["perfect", "milestone"]);
const COLORS = ["#f7b538", "#ffd98a", "#4fd1c5", "#8be9df", "#ff7d7d", "#ffffff"];

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function burst(canvas, count) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = (canvas.width = window.innerWidth * dpr);
  const h = (canvas.height = window.innerHeight * dpr);
  const parts = Array.from({ length: count }, () => {
    const angle = (Math.random() * Math.PI) / 1.6 + Math.PI / 1.45; // upar ki taraf fan
    const speed = (6 + Math.random() * 9) * dpr;
    return {
      x: w / 2 + (Math.random() - 0.5) * w * 0.12,
      y: h * 0.62,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * 0.9,
      vy: Math.sin(angle) * speed,
      size: (5 + Math.random() * 6) * dpr,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
    };
  });

  const start = performance.now();
  let raf = 0;
  const DURATION = 2400;

  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    const fade = t > DURATION - 600 ? Math.max(0, (DURATION - t) / 600) : 1;
    for (const p of parts) {
      p.vy += 0.32 * dpr;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < DURATION) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w, h);
  }
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, w, h);
  };
}

export default function CelebrationHost() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const canvasRef = useRef(null);
  const stopConfetti = useRef(null);

  useEffect(() => {
    const onCelebrate = (e) => {
      const d = e.detail;
      if (!d || !d.title) return;
      setQueue((q) => [...q.slice(-3), { ...d, id: Date.now() + Math.random() }]);
    };
    window.addEventListener("qelvaris-celebrate", onCelebrate);
    return () => window.removeEventListener("qelvaris-celebrate", onCelebrate);
  }, []);

  // Ek time par ek hi celebration
  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [queue, current]);

  const dismiss = useCallback(() => {
    if (stopConfetti.current) {
      stopConfetti.current();
      stopConfetti.current = null;
    }
    setCurrent(null);
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    const big = BIG.has(current.kind);

    if (big) {
      try {
        playSound("win");
      } catch {
        /* ignore */
      }
    }
    if ((big || current.kind === "purchase" || current.kind === "claim") && !reducedMotion() && canvasRef.current) {
      stopConfetti.current = burst(canvasRef.current, big ? 150 : 60);
    }

    const timer = setTimeout(dismiss, big ? 5200 : 3200);
    return () => {
      clearTimeout(timer);
      if (stopConfetti.current) {
        stopConfetti.current();
        stopConfetti.current = null;
      }
    };
  }, [current, dismiss]);

  const big = current && BIG.has(current.kind);

  return (
    <>
      <canvas ref={canvasRef} className="qcel-canvas" aria-hidden="true" />
      {current && (
        <div
          className={`qcel ${big ? "qcel--big" : "qcel--toast"}`}
          role="status"
          aria-live="polite"
          onClick={dismiss}
        >
          {big && <div className="qcel-glow" aria-hidden="true" />}
          <div className="qcel-icon" aria-hidden="true">
            {current.kind === "milestone" ? "🔥" : current.kind === "perfect" ? "♛" : current.kind === "purchase" ? "◆" : "✓"}
          </div>
          <div className="qcel-text">
            <strong>{current.title}</strong>
            {current.sub && <span>{current.sub}</span>}
          </div>
          {current.qc > 0 && <div className="qcel-qc">+{current.qc} QC</div>}
          {big && (
            <button type="button" className="qcel-close" onClick={dismiss} aria-label="Close">
              Nice
            </button>
          )}
        </div>
      )}
    </>
  );
}
