import EchoPiece, { EchoPieceDefs } from "./EchoPieces";
import { footprintStage, sqToXY } from "./echoEngine";

const FILES = "abcdefgh";

/* Draws ONE opponent echo. It only knows squares and the piece KIND (for style), never the piece. */
function Footprint({ fp, stage, rule, flipped }) {
  const P = (sq) => {
    const { f, r } = sqToXY(sq);
    return { x: (flipped ? 7 - f : f) + 0.5, y: (flipped ? r : 7 - r) + 0.5 };
  };
  const a = P(fp.from), b = P(fp.to);
  const theta = Math.atan2(b.y - a.y, b.x - a.x);
  const ang = (theta * 180) / Math.PI + 90;
  const knight = fp.kind === "knight";
  const style = { opacity: stage.opacity, filter: `drop-shadow(0 0 ${5 * stage.glow}px currentColor)` };
  const items = [];

  if (knight) {
    if (rule.showArc && rule.arcStages.includes(stage.name)) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const nx = -(b.y - a.y), ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      items.push(<path key="arc" className="ec-arc" d={`M${a.x} ${a.y} Q${mx + (nx / len) * 1.1} ${my + (ny / len) * 1.1} ${b.x} ${b.y}`} />);
    }
    fp.squares.forEach((s) => {
      const c = P(s.sq);
      if (s.kind === "landing" && !rule.landingStages.includes(stage.name)) return;
      items.push(
        <g key={s.kind} transform={`translate(${c.x} ${c.y})`}>
          <circle r=".3" className="ec-ring" />
          <circle r=".16" className="ec-ring" />
          {s.kind === "landing" && <path className="ec-spark" d="M0 -.42V-.3M0 .3V.42M-.42 0H-.3M.3 0H.42" />}
        </g>
      );
    });
  } else {
    items.push(<line key="line" className="ec-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    let step = 0;
    fp.squares.forEach((s) => {
      const c = P(s.sq);
      if (s.kind === "origin") items.push(<circle key="o" className="ec-ring ec-dash" cx={c.x} cy={c.y} r=".24" />);
      else if (s.kind === "path") {
        const alt = step++ % 2 ? -1 : 1;
        items.push(
          <g key={s.sq} transform={`translate(${c.x} ${c.y}) rotate(${ang})`} className="ec-feet">
            <ellipse cx={-0.1} cy={0.07 * alt} rx=".06" ry=".11" />
            <ellipse cx={0.1} cy={-0.07 * alt} rx=".06" ry=".11" />
          </g>
        );
      } else {
        items.push(
          <g key="l" transform={`translate(${c.x} ${c.y})`}>
            <circle className="ec-ring" r=".28" />
            {fp.capture ? <path className="ec-spark" d="M-.14 -.14L.14 .14M.14 -.14L-.14 .14" /> : <path className="ec-chev" transform={`rotate(${ang})`} d="M-.12 .08L0 -.1L.12 .08" />}
          </g>
        );
      }
    });
  }
  return <g className={`ec-fp ec-fp--${knight ? "knight" : "normal"} ec-fp--${stage.name}`} style={style}>{items}</g>;
}

export default function EchoBoard({ pieces, footprints, currentPly, config, flipped, selected, hints, lastOwn, onSquareClick }) {
  const hintMap = new Map(hints.map((h) => [h.sq, h.kind]));
  const cells = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const f = flipped ? 7 - col : col;
      const r = flipped ? row : 7 - row;
      const sq = FILES[f] + (r + 1);
      const cls = ["ec-sq", (f + r) % 2 === 0 ? "d" : "l"];
      if (selected === sq) cls.push("sel");
      if (hintMap.has(sq)) cls.push("hint", hintMap.get(sq));
      if (lastOwn && (lastOwn.from === sq || lastOwn.to === sq)) cls.push("last");
      cells.push(<div key={sq} className={cls.join(" ")} onClick={() => onSquareClick(sq)} />);
    }
  }
  const files = [...Array(8)].map((_, i) => FILES[flipped ? 7 - i : i]);
  const ranks = [...Array(8)].map((_, i) => (flipped ? i + 1 : 8 - i));

  return (
    <div className="ec-board">
      <EchoPieceDefs />
      <div className="ec-ranks">{ranks.map((n) => <span key={n}>{n}</span>)}</div>
      <div className="ec-files">{files.map((l) => <span key={l}>{l}</span>)}</div>
      <div className="ec-grid">
        <div className="ec-squares">{cells}</div>
        <svg className="ec-fp-layer" viewBox="0 0 8 8" aria-hidden="true">
          {footprints.map((fp) => {
            const stage = footprintStage(fp, currentPly, config);
            if (!stage) return null;
            return <Footprint key={fp.id} fp={fp} stage={stage} flipped={flipped} rule={fp.kind === "knight" ? config.knight : config.footprints} />;
          })}
        </svg>
        <div className="ec-pieces">
          {pieces.map((p) => {
            const f = sqToXY(p.sq);
            const col = flipped ? 7 - f.f : f.f;
            const row = flipped ? f.r : 7 - f.r;
            return (
              <div key={p.id} className="ec-pc" style={{ transform: `translate(${col * 100}%,${row * 100}%)` }}>
                <EchoPiece type={p.type} color={p.color} />
              </div>
            );
          })}
        </div>
        <div className="ec-fog" />
      </div>
    </div>
  );
}