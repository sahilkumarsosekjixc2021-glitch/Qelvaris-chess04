import { useEffect, useMemo, useRef, useState } from "react";
import "./BitBoard.css";

/*
 * BitBoard: digital "circuit / matrix" chess board for BitFlip mode.
 * Drop-in replacement for <Board /> (same props) + two optional new props:
 *   unstable : true while the grid is about to glitch (pendingGlitch)
 *   charge   : 0..1, how close the next glitch is (plies % GLITCH_EVERY / GLITCH_EVERY)
 * Props used: fen, flipped, selected, targets, lastMove, glitch, onSquareClick
 * (ghosts / arrows / showCoords are accepted but ignored.)
 */

const FW = 0.05;
const FILES = "abcdefgh";

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uT,uUnst,uCharge,uGT;uniform vec4 uAB;
const float FW=.05;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 scene(vec2 uv){
 vec2 q=(uv-FW)/(1.-2.*FW);
 vec3 g=vec3(.22,1.,.53);vec3 cy=vec3(0.,.9,1.);vec3 mg=vec3(1.,.17,.84);
 vec3 col;
 if(q.x>=0.&&q.x<=1.&&q.y>=0.&&q.y<=1.){
  vec2 b=q*8.;vec2 id=floor(b);vec2 f=fract(b);
  float chk=mod(id.x+id.y,2.);
  col=mix(vec3(.045,.17,.115),vec3(.012,.06,.045),chk);
  float h=hash(id+3.1);
  col*=.85+.3*h;
  float tr;
  if(hash(id+9.7)>.5)tr=1.-smoothstep(0.,.025,abs(f.y-(.3+.4*hash(id+1.3))));
  else tr=1.-smoothstep(0.,.025,abs(f.x-(.3+.4*hash(id+2.2))));
  col+=g*tr*step(.35,hash(id+5.5))*.10;
  float via=1.-smoothstep(.05,.075,length(f-vec2(.5+.3*(hash(id+4.)-.5),.5+.3*(hash(id+6.)-.5))));
  col+=g*via*.18*step(.5,hash(id+8.));
  vec2 e=min(f,1.-f);float gl=min(e.x,e.y);
  col+=g*(1.-smoothstep(0.,.03,gl))*.25;
  float tick=step(e.x,.14)*step(e.y,.04)+step(e.y,.14)*step(e.x,.04);
  col+=g*clamp(tick,0.,1.)*.45;
  float fl=hash(id+floor(uT*.8)*7.3);
  float p=.012+.10*uCharge;
  float on=step(1.-p,fl)*(.5+.5*sin(uT*3.+h*6.));
  col+=g*on*.12;
  col*=.88+.12*sin(gl_FragCoord.y*2.);
  float bar=exp(-pow((q.y-fract(uT*.1))*14.,2.));
  col+=g*bar*.05;
  if(uGT>=0.&&uGT<1.8){
   float fade=1.-smoothstep(.5,1.6,uGT);
   vec2 A=uAB.xy;vec2 B=uAB.zw;
   vec2 pa=q-A;vec2 ba=B-A;
   float hh=clamp(dot(pa,ba)/max(dot(ba,ba),.0001),0.,1.);
   float dd=length(pa-ba*hh);
   float beam=exp(-dd*dd*9000.)*(.5+.5*sin(hh*60.-uT*40.));
   col+=mix(cy,mg,.5+.5*sin(uT*25.))*beam*1.4*fade;
   vec2 ia=floor(A*8.);vec2 ib=floor(B*8.);
   float inA=1.-step(.5,abs(id.x-ia.x)+abs(id.y-ia.y));
   float inB=1.-step(.5,abs(id.x-ib.x)+abs(id.y-ib.y));
   float fz=(inA+inB)*(.5+.5*step(.5,fract(uT*14.)));
   col+=mix(cy,mg,inB)*fz*.5*fade;
  }
  float ed=min(min(q.x,1.-q.x),min(q.y,1.-q.y));
  col*=.7+.3*smoothstep(0.,.03,ed);
 }else{
  vec2 d=min(uv,1.-uv);float fd=min(d.x,d.y)/FW;
  float sc=(d.x<d.y)?uv.y:uv.x;
  col=vec3(.012,.035,.03);
  float pin=step(.5,fract(sc*64.))*step(fd,.45);
  col+=vec3(.05,.2,.14)*pin*.9;
  float line=1.-smoothstep(0.,.05,abs(fd-.75));
  float pulse=smoothstep(.85,1.,fract(sc*3.-uT*.4));
  col+=g*line*(.35+.9*pulse);
  col+=g*(1.-smoothstep(0.,.04,abs(fd-.08)))*.25;
  col+=g*(1.-smoothstep(0.,.03,abs(fd-.45)))*.12*(.5+.5*sin(sc*40.));
 }
 return col;
}
void main(){
 vec2 uv=vec2(gl_FragCoord.x/uRes.x,1.-gl_FragCoord.y/uRes.y);
 vec3 col;
 if(uUnst>.01){
  float band=floor(uv.y*34.);
  float r=hash(vec2(band,floor(uT*16.)));
  float on=step(1.-.28*uUnst,r);
  float dx=(hash(vec2(band,floor(uT*16.)+3.))-.5)*.09*uUnst*on;
  float ch=(.002+.012*uUnst)*(.4+.6*on);
  vec2 u2=uv+vec2(dx,0.);
  col=vec3(scene(u2+vec2(ch,0.)).r,scene(u2).g,scene(u2-vec2(ch,0.)).b);
  col+=vec3(0.,.9,1.)*on*.04*uUnst;
 }else col=scene(uv);
 gl_FragColor=vec4(pow(col,vec3(.95)),1.);
}`;

const PIECE_PATHS = {
  p: ["M50 16a13 13 0 1 0 .01 0z", "M37 49h26v7H37z", "M41 57h18c7 9 11 19 12 29H29c1-10 5-20 12-29z"],
  r: ["M28 18h9v9h8v-9h10v9h8v-9h9v26H28z", "M32 46h36l-3 38H35z"],
  b: ["M50 5a5 5 0 1 0 .01 0z", "M50 15c11 8 17 20 13 30-2 5-7 8-13 8s-11-3-13-8c-4-10 2-22 13-30z", "M36 55h28v6H36z", "M40 62h20c6 8 9 14 10 24H30c1-10 4-16 10-24z"],
  n: ["M29 84c2-16 5-26 12-35-7-4-11-11-10-19 2-9 9-15 17-17l3 8c14 1 23 11 25 25l1 12c-9 1-15-2-20-7 0 10 4 18 12 27v6z"],
  q: ["M30 40L22 16l15 14 7-18 6 20 6-20 7 18 15-14-8 24z", "M34 44h32q6 22 9 42H25q3-20 9-42z"],
  k: ["M46 3h8v9h9v8h-9v9h-8v-9h-9v-8h9z", "M32 33h36l4 10H28z", "M34 45h32q7 21 9 41H25q2-20 9-41z"],
};
const BASE = "M22 86h56v8H22z";
const GROUPS = Object.keys(PIECE_PATHS)
  .map((t) => `<g id="btP${t}">${PIECE_PATHS[t].map((d) => `<path d="${d}"/>`).join("")}<path d="${BASE}"/></g>`)
  .join("");
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="btGW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eafffb"/><stop offset="1" stop-color="#7ff7e6"/></linearGradient>
<linearGradient id="btGB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a3322"/><stop offset="1" stop-color="#020b07"/></linearGradient>
<pattern id="btScD" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.5" fill="#06402f"/></pattern>
<pattern id="btScG" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.5" fill="#39ff88"/></pattern>
${GROUPS}</defs></svg>`;

/* ---------- helpers ---------- */
function parseFen(fen) {
  const rows = (fen || "").split(" ")[0].split("/");
  const out = [];
  rows.forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        c += Number(ch);
        continue;
      }
      out.push({ type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "w" : "b", sq: FILES[c] + (8 - r) });
      c++;
    }
  });
  return out;
}
function disp(sq, flipped) {
  const f = sq.charCodeAt(0) - 97;
  const r = Number(sq[1]);
  return { col: flipped ? 7 - f : f, row: flipped ? r - 1 : 8 - r };
}
function dist(a, b) {
  return Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));
}
function reconcile(prev, cur, lastMove, idRef) {
  const used = new Set();
  const prevBySq = new Map(prev.map((p) => [p.sq, p]));
  const out = [];
  const pending = [];
  cur.forEach((c) => {
    const o = prevBySq.get(c.sq);
    const isDest = lastMove && lastMove.to === c.sq && lastMove.from !== c.sq;
    if (o && o.type === c.type && o.color === c.color && !isDest) {
      used.add(o.id);
      out.push({ ...c, id: o.id });
    } else pending.push(c);
  });
  const rest = [];
  pending.forEach((c) => {
    if (lastMove && c.sq === lastMove.to) {
      const o = prevBySq.get(lastMove.from);
      if (o && !used.has(o.id) && o.color === c.color) {
        used.add(o.id);
        out.push({ ...c, id: o.id });
        return;
      }
    }
    rest.push(c);
  });
  rest.forEach((c) => {
    let best = null;
    let bd = 99;
    prev.forEach((o) => {
      if (used.has(o.id) || o.type !== c.type || o.color !== c.color) return;
      const d = dist(o.sq, c.sq);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    if (best) {
      used.add(best.id);
      out.push({ ...c, id: best.id });
    } else out.push({ ...c, id: idRef.current++ });
  });
  return { next: out, gone: prev.filter((p) => !used.has(p.id)) };
}

const rnd = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now() / 1000;

export default function BitBoard({
  fen,
  flipped = false,
  selected = null,
  targets = [],
  lastMove = null,
  glitch = [],
  onSquareClick,
  unstable = false,
  charge = 0,
}) {
  const rootRef = useRef(null);
  const glRef = useRef(null);
  const bitRef = useRef(null);
  const fxRef = useRef(null);
  const api = useRef({});
  const idRef = useRef(1);
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  const propsRef = useRef({});
  propsRef.current = { unstable, charge, glitch };

  const [pieces, setPieces] = useState(() => parseFen(fen).map((p) => ({ ...p, id: idRef.current++ })));
  const prevPieces = useRef(pieces);
  const [ghosts, setGhosts] = useState([]);
  const [movedId, setMovedId] = useState(null);

  const glKey = (glitch || []).join(",");
  const glSet = useMemo(() => new Set(glKey ? glKey.split(",") : []), [glKey]);

  /* ---- pieces follow the FEN ---- */
  useEffect(() => {
    const prev = prevPieces.current;
    const { next, gone } = reconcile(prev, parseFen(fen), lastMove, idRef);
    prevPieces.current = next;
    setPieces(next);
    const gsq = propsRef.current.glitch || [];
    const made = [];
    if (gsq.length) {
      prev.filter((p) => gsq.includes(p.sq)).forEach((p) => made.push({ ...p, gid: idRef.current++, kind: "ghost" }));
    }
    gone.forEach((p) => {
      made.push({ ...p, gid: idRef.current++, kind: "die" });
      if (api.current.burst) api.current.burst(p.sq, 24, flippedRef.current);
    });
    if (made.length) {
      setGhosts((x) => [...x, ...made]);
      setTimeout(() => setGhosts((x) => x.filter((y) => !made.includes(y))), 850);
    }
    const m = lastMove && next.find((p) => p.sq === lastMove.to);
    if (m) {
      setMovedId(m.id);
      setTimeout(() => setMovedId(null), 600);
    }
  }, [fen]); // eslint-disable-line

  /* ---- glitch start: beam + bit flips ---- */
  useEffect(() => {
    if (!glKey || !api.current.glitchFx) return;
    const [a, b] = glKey.split(",");
    if (a && b) api.current.glitchFx(a, b, flippedRef.current);
  }, [glKey]);

  /* ---- WebGL + bit grid + particles (mounted once) ---- */
  useEffect(() => {
    const cv = glRef.current;
    const bc = bitRef.current;
    const fx = fxRef.current;
    const root = rootRef.current;
    const bctx = bc.getContext("2d");
    const fc = fx.getContext("2d");
    const gl = cv.getContext("webgl", { antialias: false });
    const U = {};
    const bits = new Uint8Array(64).map(() => (Math.random() < 0.5 ? 1 : 0));
    const flash = new Float32Array(64);
    let ab = [0, 0, 0, 0];
    let gStart = -99;
    let glOK = false;
    let un = 0;
    let acc = 0;
    let parts = [];
    let raf = 0;
    let last = now();

    const sh = (type, src) => {
      const o = gl.createShader(type);
      gl.shaderSource(o, src);
      gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(o));
        return null;
      }
      return o;
    };
    if (gl) {
      const v = sh(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}");
      const f = sh(gl.FRAGMENT_SHADER, FS);
      if (v && f) {
        const p = gl.createProgram();
        gl.attachShader(p, v);
        gl.attachShader(p, f);
        gl.linkProgram(p);
        if (gl.getProgramParameter(p, gl.LINK_STATUS)) {
          gl.useProgram(p);
          gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
          const a = gl.getAttribLocation(p, "a");
          gl.enableVertexAttribArray(a);
          gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
          ["uRes", "uT", "uUnst", "uCharge", "uGT", "uAB"].forEach((n) => (U[n] = gl.getUniformLocation(p, n)));
          glOK = true;
        } else console.error(gl.getProgramInfoLog(p));
      }
    }
    if (!glOK) cv.style.background = "#06180f";

    const fit = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(w * d);
      cv.height = Math.round(h * d);
      bc.width = fx.width = w;
      bc.height = fx.height = h;
      if (glOK) gl.viewport(0, 0, cv.width, cv.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    const cell = (sq, fl) => {
      const { col, row } = disp(sq, fl);
      return { col, row, i: row * 8 + col };
    };
    const centre = (col, row) => {
      const s = (fx.width * (1 - 2 * FW)) / 8;
      return { x: fx.width * FW + (col + 0.5) * s, y: fx.height * FW + (row + 0.5) * s };
    };
    api.current.burst = (sq, n, fl) => {
      const { col, row } = cell(sq, fl);
      const c = centre(col, row);
      for (let k = 0; k < n; k++)
        parts.push({ x: c.x + rnd(-8, 8), y: c.y + rnd(-8, 8), vx: rnd(-1.6, 1.6), vy: rnd(-2, 1.2), l: 0, m: rnd(30, 70), s: rnd(9, 15), ch: Math.random() < 0.5 ? "0" : "1" });
    };
    api.current.glitchFx = (a, b, fl) => {
      const A = cell(a, fl);
      const B = cell(b, fl);
      ab = [(A.col + 0.5) / 8, (A.row + 0.5) / 8, (B.col + 0.5) / 8, (B.row + 0.5) / 8];
      gStart = now();
      [A, B].forEach((c) => {
        bits[c.i] ^= 1;
        flash[c.i] = 1.6;
      });
      api.current.burst(a, 18, fl);
      api.current.burst(b, 18, fl);
    };

    for (let i = 0; i < 12; i++)
      parts.push({ x: rnd(0, 500), y: rnd(0, 500), vx: 0, vy: rnd(0.4, 1.1), l: rnd(0, 200), m: 220, s: rnd(9, 12), ch: Math.random() < 0.5 ? "0" : "1", amb: 1 });

    const tick = () => {
      const t = now();
      const dt = Math.min(0.05, t - last);
      last = t;
      const P = propsRef.current;
      const target = Math.min(1, (P.unstable ? 0.85 : 0) + (P.glitch && P.glitch.length ? 1 : 0) + (P.charge || 0) * 0.22);
      un += (target - un) * Math.min(1, dt * 6);

      /* bit flipping */
      acc += dt;
      const rate = 1.3 - 1.0 * Math.max(P.charge || 0, un);
      while (acc > rate) {
        acc -= rate;
        const i = Math.floor(Math.random() * 64);
        bits[i] ^= 1;
        flash[i] = 1;
      }

      if (glOK) {
        gl.uniform2f(U.uRes, cv.width, cv.height);
        gl.uniform1f(U.uT, t);
        gl.uniform1f(U.uUnst, un);
        gl.uniform1f(U.uCharge, P.charge || 0);
        gl.uniform1f(U.uGT, t - gStart < 1.8 ? t - gStart : -1);
        gl.uniform4f(U.uAB, ab[0], ab[1], ab[2], ab[3]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      /* bit grid (under pieces) */
      const s = (bc.width * (1 - 2 * FW)) / 8;
      const o = bc.width * FW;
      bctx.clearRect(0, 0, bc.width, bc.height);
      bctx.font = Math.max(8, s * 0.2) + "px monospace";
      bctx.textBaseline = "top";
      for (let i = 0; i < 64; i++) {
        const x = o + (i & 7) * s;
        const y = o + (i >> 3) * s;
        const f = Math.min(1, flash[i]);
        if (flash[i] > 0) {
          bctx.fillStyle = "rgba(57,255,136," + 0.10 * f + ")";
          bctx.fillRect(x + 2, y + 2, s - 4, s - 4);
          flash[i] = Math.max(0, flash[i] - dt * 1.1);
        }
        bctx.fillStyle = "rgba(57,255,136," + (0.13 + 0.6 * f) + ")";
        bctx.fillText(String(bits[i]), x + s * 0.09, y + s * 0.07);
      }

      /* particles: falling digits + burst digits */
      fc.clearRect(0, 0, fx.width, fx.height);
      fc.textAlign = "center";
      fc.textBaseline = "middle";
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.l++;
        if (!p.amb) p.vy += 0.03;
        if (p.amb && (p.l > p.m || p.y > fx.height)) {
          p.x = rnd(0, fx.width);
          p.y = 0;
          p.l = 0;
        }
        const al = p.amb ? Math.sin(Math.PI * Math.min(1, p.l / p.m)) * 0.12 : Math.max(0, 1 - p.l / p.m);
        fc.font = p.s + "px monospace";
        fc.fillStyle = "rgba(90,255,160," + al + ")";
        fc.fillText(p.ch, p.x, p.y);
      });
      parts = parts.filter((p) => p.amb || p.l < p.m);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      api.current = {};
    };
  }, []);

  /* ---- render ---- */
  const occ = new Map(pieces.map((p) => [p.sq, p]));
  const tset = new Set(targets || []);
  const squares = [];
  for (let i = 0; i < 64; i++) {
    const row = i >> 3;
    const col = i & 7;
    const name = FILES[flipped ? 7 - col : col] + (flipped ? row + 1 : 8 - row);
    const cls = ["bt-sq"];
    if (selected === name) cls.push("sel");
    if (tset.has(name)) cls.push(occ.has(name) ? "cap" : "dot");
    if (lastMove && (lastMove.from === name || lastMove.to === name)) cls.push("last");
    squares.push(<div key={name} className={cls.join(" ")} onClick={() => onSquareClick && onSquareClick(name)} />);
  }

  const pieceEl = (p, extra, key) => {
    const { col, row } = disp(p.sq, flipped);
    const gl = glSet.has(p.sq) && extra === "";
    return (
      <div
        key={key}
        className={`bt-pc ${p.color} ${gl ? "gl" : ""} ${extra}`}
        style={{ transform: `translate(${col * 100}%,${row * 100}%)`, transition: gl ? "none" : undefined }}
      >
        <svg viewBox="0 0 100 100" className={movedId === p.id ? "hop" : ""}>
          <use className="a" href={"#btP" + p.type} />
          <use className="v" href={"#btP" + p.type} />
        </svg>
      </div>
    );
  };

  return (
    <div className="bt-board" ref={rootRef}>
      <div dangerouslySetInnerHTML={{ __html: DEFS }} />
      <canvas ref={glRef} className="bt-gl" />
      <canvas ref={bitRef} className="bt-bits" />
      <div className="bt-inner">
        <div className="bt-sqs">{squares}</div>
        <div className="bt-pcs">
          {pieces.map((p) => pieceEl(p, "", "p" + p.id))}
          {ghosts.map((p) => pieceEl(p, p.kind, "g" + p.gid))}
        </div>
      </div>
      <canvas ref={fxRef} className="bt-fx" />
    </div>
  );
}