
import { useCallback, useEffect, useRef, useState } from "react";
import queenArt from "../assets/queen-clear.webp";
import EchoTrace from "../games/echotrace/EchoTrace";

import "./GameModes.css";
import { tx } from "../i18n/pages/modes"; // QV-I18N
import "./GameModes-queen.css";

/* GAME MODES */

export const GAME_MODES = [
  {
    label: "Classic Missions",
    section: "classic",
    description: "Classic chess · Play against AI",
    status: "LIVE",
    tone: "live",
    img: "/modes/classic.jpg",
    color: "#ffb52e",
  },
  {
    label: "Fog of War",
    section: "fog",
    description: "Vision · Strategy",
    status: "LIVE",
    tone: "live",
    img: "/modes/fog.jpg",
    color: "#22e6ff",
  },
  {
    label: "BitFlip Chess",
    section: "bitflip",
    description: "Chaos · Strategy",
    status: "LIVE",
    tone: "live",
    img: "/modes/bitflip.jpg",
    color: "#ff4fd8",
  },
  {
    label: "BioCorruption",
    section: "biocorruption",
    description: "Survival · Strategy",
    status: "LIVE",
    tone: "live",
    img: "/modes/biocorruption.jpg",
    color: "#3dff7a",
  },
  {
    label: "Echo-Trace",
    section: "echo-trace",
    description: "Footprints · Deception",
    status: "LIVE",
    tone: "live",
    img: "/modes/echo-trace.jpg",
    color: "#b388ff",
  },
  {
    label: "Rogue AI",
    section: "rogue-ai",
    description: "Glitches · Adaptation",
    status: "SOON",
    tone: "soon",
    img: "/modes/rogue-ai.jpg",
    color: "#ff5a3c",
  },
  {
    label: "Dark Forest",
    section: "dark-forest",
    description: "Traps · Survival",
    status: "SOON",
    tone: "soon",
    img: "/modes/dark-forest.jpg",
    color: "#2bffc0",
  },
  {
    label: "Phantom Chess",
    section: "phantom-chess",
    description: "Ghosts · Hidden threats",
    status: "SOON",
    tone: "soon",
    img: "/modes/phantom-chess.jpg",
    color: "#7cc0ff",
  },
];

/* MODE CARD */

function ModeCard({ mode, index, onEnter }) {
  const imgRef = useRef(null);

  const soon = mode.tone === "soon";
  const baseTilt = index % 2 ? 9 : -9;

  const tilt = useCallback((ry, rx, scale) => {
    const el = imgRef.current;
    if (!el) return;

    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--s", scale);
  }, []);

  useEffect(() => {
    tilt(baseTilt, 5, 1);
  }, [baseTilt, tilt]);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();

    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;

    tilt(x * 18, -y * 14, 1.1);
  };

  return (
    <article
      className={`gm-card${soon ? " is-soon" : ""}`}
      style={{ "--c": mode.color }}
      data-section={mode.section}
      onMouseMove={onMove}
      onMouseLeave={() => tilt(baseTilt, 5, 1)}
    >
      <span className="gm-badge">{tx(mode.status)}</span>

      <div className="gm-art" aria-hidden="true">
        <img
          ref={imgRef}
          src={mode.img}
          alt=""
          draggable="false"
          loading="lazy"
        />
      </div>

      <h3>{mode.label}</h3>

      <div className="gm-sep" aria-hidden="true" />

      <p>{tx(mode.description)}</p>

      <button
        type="button"
        className="gm-btn"
        disabled={soon}
        onClick={() => onEnter(mode)}
      >
        {soon ? tx("Coming soon") : tx("Enter experience")}
      </button>
    </article>
  );
}

/* MAIN GAME ROOM */

export default function GameModes({
  modes = GAME_MODES,
  onEnter,
}) {
  const track = useRef(null);

  const [activeGame, setActiveGame] = useState(null);

  const [ui, setUi] = useState({
    active: 0,
    atStart: true,
    atEnd: false,
    left: 0,
    width: 100,
  });

  const live = modes.filter((m) => m.tone === "live").length;

  /* OPEN GAME */

  const handleEnter = (mode) => {
    if (mode.tone === "soon") return;

    if (mode.section === "echo-trace") {
      setActiveGame("echo-trace");
      return;
    }

    onEnter?.(mode);
  };

  /* CAROUSEL */

  const step = () => {
    const el = track.current;
    const first = el?.firstElementChild;

    if (!first) return 1;

    return (
      first.offsetWidth +
      (parseFloat(getComputedStyle(el).columnGap) || 16)
    );
  };

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;

    const max = el.scrollWidth - el.clientWidth;
    const p = el.clientWidth / el.scrollWidth;
    const atEnd = el.scrollLeft > max - 4;

    setUi({
      active: atEnd
        ? modes.length - 1
        : Math.round(el.scrollLeft / step()),
      atStart: el.scrollLeft < 4,
      atEnd,
      width: p * 100,
      left:
        max > 0
          ? (el.scrollLeft / max) * (1 - p) * 100
          : 0,
    });
  }, [modes.length]);

  useEffect(() => {
    sync();

    window.addEventListener("resize", sync);

    return () => {
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const go = (dir) => {
    track.current?.scrollBy({
      left: dir * step(),
      behavior: "smooth",
    });
  };

  const goTo = (i) => {
    track.current?.scrollTo({
      left: i * step(),
      behavior: "smooth",
    });
  };

  const onKey = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };

  /* ECHO TRACE GAME SCREEN */

  if (activeGame === "echo-trace") {
    return (
      <section className="gm-echo-screen">
        <button
          type="button"
          className="gm-echo-back"
          onClick={() => setActiveGame(null)}
        >
          {tx("← Back to Game Room")}</button>

        <EchoTrace
          playerColor="w"
          mode="bot"
        />
      </section>
    );
  }

  /* GAME ROOM SCREEN */

  return (
    <section className="gm" aria-label={tx("Qelvaris game room")}>

      <div className="gm-hero">
        <div>
          <div className="gm-k">
            {tx("Qelvaris · The Game Room")}</div>

          <h1>
            {tx("Beyond the")}<br />
            <span>{tx("ordinary game.")}</span>
          </h1>

          <div className="gm-meta">
            {tx("{n} game experiences · {live} live · {soon} soon", { n: modes.length, live, soon: modes.length - live })}
          </div>
        </div>

        <div className="gm-queen" aria-hidden="true">
          <i className="gm-queen-ring r1" />
          <i className="gm-queen-ring r2" />

          <img
            src={queenArt}
            alt=""
            draggable="false"
          />
        </div>
      </div>

      <div className="gm-sec">
        <div>
          <div className="gm-k gm-k-sm">
            {tx("Select your experience")}</div>

          <h2>{tx("Choose your game mode")}</h2>
        </div>

        <div className="gm-k gm-k-sm">
          {tx("{n} experiences", { n: modes.length })}
        </div>
      </div>

      <div className="gm-car">

        <button
          type="button"
          className={`gm-nav gm-prev${ui.atStart ? " off" : ""}`}
          aria-label={tx("Previous mode")}
          onClick={() => go(-1)}
        >
          &#8249;
        </button>

        <div
          className="gm-track"
          ref={track}
          onScroll={sync}
          onKeyDown={onKey}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={tx("Game modes")}
        >
          {modes.map((m, i) => (
            <ModeCard
              key={m.section}
              mode={m}
              index={i}
              onEnter={handleEnter}
            />
          ))}
        </div>

        <button
          type="button"
          className={`gm-nav gm-next${ui.atEnd ? " off" : ""}`}
          aria-label={tx("Next mode")}
          onClick={() => go(1)}
        >
          &#8250;
        </button>

      </div>

      <div className="gm-bar" aria-hidden="true">
        <i
          style={{
            width: `${ui.width}%`,
            left: `${ui.left}%`,
          }}
        />
      </div>

      <div className="gm-pager">
        {modes.map((m, i) => (
          <button
            key={m.section}
            type="button"
            className={`gm-dot${ui.active === i ? " on" : ""}`}
            aria-label={tx("Go to {name}", { name: m.label })}
            aria-current={ui.active === i}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

    </section>
  );
}
