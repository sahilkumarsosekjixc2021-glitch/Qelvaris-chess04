/* Own-piece artwork (SVG). Opponent pieces are never rendered, so only your colour is styled. */
const PATHS = {
  p: ["M50 16a13 13 0 1 0 .01 0z", "M37 49h26v7H37z", "M41 57h18c7 9 11 19 12 29H29c1-10 5-20 12-29z"],
  r: ["M28 18h9v9h8v-9h10v9h8v-9h9v26H28z", "M32 46h36l-3 38H35z"],
  b: ["M50 5a5 5 0 1 0 .01 0z", "M50 15c11 8 17 20 13 30-2 5-7 8-13 8s-11-3-13-8c-4-10 2-22 13-30z", "M36 55h28v6H36z", "M40 62h20c6 8 9 14 10 24H30c1-10 4-16 10-24z"],
  n: ["M29 84c2-16 5-26 12-35-7-4-11-11-10-19 2-9 9-15 17-17l3 8c14 1 23 11 25 25l1 12c-9 1-15-2-20-7 0 10 4 18 12 27v6z"],
  q: ["M30 40L22 16l15 14 7-18 6 20 6-20 7 18 15-14-8 24z", "M34 44h32q6 22 9 42H25q3-20 9-42z"],
  k: ["M46 3h8v9h9v8h-9v9h-8v-9h-9v-8h9z", "M32 33h36l4 10H28z", "M34 45h32q7 21 9 41H25q2-20 9-41z"],
};

export function EchoPieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="ecGW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6d8" /><stop offset="1" stopColor="#b9a66a" /></linearGradient>
        <linearGradient id="ecGB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f5c49" /><stop offset="1" stopColor="#04100c" /></linearGradient>
      </defs>
    </svg>
  );
}

export default function EchoPiece({ type, color }) {
  return (
    <svg viewBox="0 0 100 100" className={`ec-piece ${color}`}>
      {PATHS[type].map((d, i) => <path d={d} key={i} />)}
      <path d="M22 86h56v8H22z" />
    </svg>
  );
}