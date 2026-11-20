import { useEffect, useMemo, useRef, useState } from "react";
import "./BioBoard.css";

/*
 * BioBoard: organic "bio-corruption" chess board (WebGL shader + SVG pieces).
 * Drop-in replacement for <Board /> in BioCorruption.jsx (same props).
 * Props used: fen, flipped, lastMove, selected, targets, onSquareClick,
 *             infectionSquares, warningSquare, transformedSquares
 * (fog / visibleSquares are accepted but ignored.)
 */

const FW = 0.055; // frame width (same value is used inside the shader)
const FILES = "abcdefgh";

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uT,uBeat;uniform sampler2D uInf;uniform vec3 uWave;
const float FW=.055;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return v;}
vec2 worley(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.;float id=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(hash(i+g),hash(i+g+17.3));vec2 r=g+o-f;float d=dot(r,r);if(d<d1){d1=d;id=hash(i+g+5.1);}}
 return vec2(sqrt(d1),id);}
void main(){
 vec2 uv=vec2(gl_FragCoord.x/uRes.x,1.-gl_FragCoord.y/uRes.y);
 vec2 q=(uv-FW)/(1.-2.*FW);
 float fld=texture2D(uInf,clamp(q,0.,1.)).r;
 float beat=uBeat;vec3 col;vec3 gcol=vec3(.25,1.,.45);
 if(q.x>=0.&&q.x<=1.&&q.y>=0.&&q.y<=1.){
  vec2 g=q*8.;vec2 id=floor(g);vec2 f=fract(g);float chk=mod(id.x+id.y,2.);
  float n1=fbm(g*2.2+id*1.7);float n2=fbm(g*9.);
  float pores=smoothstep(.62,.8,noise(g*38.));
  vec3 bone=mix(vec3(.46,.42,.33),vec3(.80,.74,.60),n2)*(.8+.4*n1);
  bone=mix(bone,vec3(.25,.19,.12),pores*.5);
  float crk=1.-smoothstep(0.,.018,abs(fbm(g*3.+id)-.5));bone*=1.-crk*.6;
  vec3 necro=mix(vec3(.04,.03,.04),vec3(.13,.09,.12),n2)+vec3(.02,.05,.03)*n1;
  necro+=vec3(.04,.1,.05)*pores*.5;
  col=mix(bone,necro,chk);
  vec2 e=min(f,1.-f);float gr=min(e.x,e.y);
  col*=.5+.5*smoothstep(0.,.07,gr);
  float nz=fbm(g*5.+vec2(0.,uT*.03));
  float s=fld+(nz-.5)*.7;
  float m=smoothstep(.40,.52,s);
  float rim=smoothstep(.30,.42,s)*(1.-smoothstep(.52,.66,s));
  if(s>.28){
   vec2 p=g*3.;float flow=uT*.15;
   float body=fbm(p*1.5+vec2(flow*.2,0.));
   vec3 fl=mix(vec3(.26,.03,.05),vec3(.56,.12,.10),body);
   fl=mix(fl,vec3(.10,.38,.16),smoothstep(.5,.75,fbm(p*.9+3.)));
   vec2 w=worley(g*4.5);float bub=1.-smoothstep(0.,.33,w.x);float hasB=step(.55,w.y);
   float bm=bub*hasB;
   fl=mix(fl,mix(vec3(.55,.75,.25),vec3(.95,1.,.55),bub),smoothstep(.1,.5,bm)*.9);
   float ringb=smoothstep(.28,.33,w.x)*(1.-smoothstep(.33,.4,w.x))*hasB;
   fl*=1.-ringb*.6;
   float vf=abs(fbm(p*1.2+vec2(0.,flow))-.5);
   float vein=1.-smoothstep(0.,.04,vf);
   float vein2=1.-smoothstep(0.,.025,abs(fbm(p*3.1+7.+vec2(flow,0.))-.5));
   float vv=max(vein,vein2*.7);
   vec3 vcol=gcol*(.5+1.3*beat);
   fl=mix(fl,vcol,vv*.85);fl+=vcol*vv*.25*beat;
   fl+=pow(smoothstep(.55,.85,fbm(p*2.2-flow)),3.)*.5;
   col=mix(col,fl,m);
  }
  col+=gcol*rim*(.5+.9*beat);
  float wd=length(q-uWave.xy);float ww=(uT-uWave.z)*.9;
  float wr=exp(-pow((wd-ww)*14.,2.))*step(0.,uT-uWave.z)*(1.-smoothstep(0.,1.,ww));
  col+=gcol*wr*.6;
  float ed=min(min(q.x,1.-q.x),min(q.y,1.-q.y));col*=.6+.4*smoothstep(0.,.03,ed);
 }else{
  vec2 d=min(uv,1.-uv);float fd=min(d.x,d.y)/FW;
  vec2 p=uv*14.;float n=fbm(p*2.);
  vec3 fl=mix(vec3(.10,.03,.04),vec3(.30,.08,.08),n);
  float sc=(d.x<d.y)?uv.y:uv.x;
  float ribs=smoothstep(.3,.7,sin(sc*170.)*.5+.5);
  fl*=.75+.5*ribs*(1.-fd*.5);
  float vv=1.-smoothstep(0.,.05,abs(fbm(p*1.3+vec2(uT*.05,0.))-.5));
  fl=mix(fl,gcol*(.4+1.2*beat),vv*.8);
  fl*=.55+.6*smoothstep(0.,.5,fd)*(1.-smoothstep(.85,1.,fd)*.7);
  fl+=gcol*(1.-smoothstep(0.,.06,fd))*.2*(.5+beat);
  col=fl;
 }
 gl_FragColor=vec4(pow(col,vec3(.92)),1.);
}`;

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
      out.push({
        type: ch.toLowerCase(),
        color: ch === ch.toUpperCase() ? "w" : "b",
        sq: FILES[c] + (8 - r),
      });
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
  return Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(Number(a[1]) - Number(b[1]))
  );
}

/* Match new FEN pieces to old pieces so moved pieces can slide. */
function reconcile(prev, cur, lastMove, idRef) {
  const used = new Set();
  const prevBySq = new Map(prev.map((p) => [p.sq, p]));
  const out = [];
  let pending = [];

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

const PIECE_PATHS = {
  p: ["M50 16a13 13 0 1 0 .01 0z", "M37 49h26v7H37z", "M41 57h18c7 9 11 19 12 29H29c1-10 5-20 12-29z"],
  r: ["M28 18h9v9h8v-9h10v9h8v-9h9v26H28z", "M32 46h36l-3 38H35z"],
  b: ["M50 5a5 5 0 1 0 .01 0z", "M50 15c11 8 17 20 13 30-2 5-7 8-13 8s-11-3-13-8c-4-10 2-22 13-30z", "M36 55h28v6H36z", "M40 62h20c6 8 9 14 10 24H30c1-10 4-16 10-24z"],
  n: ["M29 84c2-16 5-26 12-35-7-4-11-11-10-19 2-9 9-15 17-17l3 8c14 1 23 11 25 25l1 12c-9 1-15-2-20-7 0 10 4 18 12 27v6z"],
  q: ["M30 40L22 16l15 14 7-18 6 20 6-20 7 18 15-14-8 24z", "M34 44h32q6 22 9 42H25q3-20 9-42z"],
  k: ["M46 3h8v9h9v8h-9v9h-8v-9h-9v-8h9z", "M32 33h36l4 10H28z", "M34 45h32q7 21 9 41H25q2-20 9-41z"],
};
const BASE = "M22 86h56v8H22z";

function Defs() {
  const vein = "M0 8Q8 0 16 10T34 8M6 34Q10 20 22 22T34 16M17 0Q20 12 14 20";
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="bbGB" x1="0" x2="1"><stop offset="0" stopColor="#f4eed9" /><stop offset=".55" stopColor="#bdb293" /><stop offset="1" stopColor="#6f6650" /></linearGradient>
        <linearGradient id="bbGA" x1="0" x2="1"><stop offset="0" stopColor="#27402f" /><stop offset=".5" stopColor="#0d1812" /><stop offset="1" stopColor="#020605" /></linearGradient>
        <linearGradient id="bbGI" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8a2020" /><stop offset=".5" stopColor="#3f7a2c" /><stop offset="1" stopColor="#103a1c" /></linearGradient>
        <pattern id="bbVG" width="34" height="34" patternUnits="userSpaceOnUse"><path d={vein} stroke="#37ff78" strokeWidth="1.4" fill="none" /></pattern>
        <pattern id="bbVW" width="34" height="34" patternUnits="userSpaceOnUse"><path d={vein} stroke="#7a1515" strokeWidth="1.2" fill="none" opacity=".7" /></pattern>
        <filter id="bbOrg" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="4" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="4" />
        </filter>
        <filter id="bbWob" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="7" result="t">
            <animate attributeName="baseFrequency" values=".03;.05;.03" dur="3.5s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="t" scale="9" />
        </filter>
        {Object.keys(PIECE_PATHS).map((t) => (
          <g id={"bbP" + t} key={t}>
            {PIECE_PATHS[t].map((d, i) => <path d={d} key={i} />)}
            <path d={BASE} />
          </g>
        ))}
      </defs>
    </svg>
  );
}

const rnd = (a, b) => a + Math.random() * (b - a);
const now = () => performance.now() / 1000;
const beat = (t) =>
  Math.min(1, Math.pow(Math.max(0, Math.sin(t * 2.6)), 8) + Math.pow(Math.max(0, Math.sin(t * 2.6 - 0.9)), 10) * 0.7);

export default function BioBoard({
  fen,
  flipped = false,
  lastMove = null,
  selected = null,
  targets = [],
  onSquareClick,
  infectionSquares = [],
  warningSquare = null,
  transformedSquares = [],
}) {
  const rootRef = useRef(null);
  const glRef = useRef(null);
  const fxRef = useRef(null);
  const api = useRef({});
  const tgt = useRef(new Float32Array(64));
  const idRef = useRef(1);
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  const [pieces, setPieces] = useState(() =>
    parseFen(fen).map((p) => ({ ...p, id: idRef.current++ }))
  );
  const prevPieces = useRef(pieces);
  const [ghosts, setGhosts] = useState([]);
  const [movedId, setMovedId] = useState(null);
  const [flash, setFlash] = useState([]);
  const prevInf = useRef(new Set());

  const infKey = (infectionSquares || []).join(",");
  const trKey = (transformedSquares || []).join(",");
  const infSet = useMemo(() => new Set(infectionSquares || []), [infKey]); // eslint-disable-line

  /* ---- pieces follow the FEN (slide, capture dissolve) ---- */
  useEffect(() => {
    const { next, gone } = reconcile(prevPieces.current, parseFen(fen), lastMove, idRef);
    prevPieces.current = next;
    setPieces(next);
    if (gone.length) {
      const g = gone.map((p) => ({ ...p, gid: idRef.current++ }));
      setGhosts((x) => [...x, ...g]);
      g.forEach((p) => api.current.burst && api.current.burst(p.sq, 22, flippedRef.current));
      setTimeout(() => setGhosts((x) => x.filter((y) => !g.includes(y))), 750);
    }
    const m = lastMove && next.find((p) => p.sq === lastMove.to);
    if (m) {
      setMovedId(m.id);
      setTimeout(() => setMovedId(null), 650);
    }
  }, [fen]); // eslint-disable-line

  /* ---- infection squares -> shader field ---- */
  useEffect(() => {
    const t = tgt.current;
    t.fill(0);
    infSet.forEach((sq) => {
      const { col, row } = disp(sq, flipped);
      t[row * 8 + col] = 1;
    });
    const added = [...infSet].filter((s) => !prevInf.current.has(s));
    if (added.length && api.current.wave) {
      api.current.wave(added[0], flipped);
      added.slice(0, 6).forEach((s) => api.current.burst(s, 8, flipped));
    }
    prevInf.current = infSet;
  }, [infSet, flipped]);

  /* ---- transformation effect ---- */
  useEffect(() => {
    if (!trKey) {
      setFlash([]);
      return undefined;
    }
    const list = trKey.split(",");
    list.forEach((s) => api.current.burst && api.current.burst(s, 26, flippedRef.current));
    if (api.current.wave) api.current.wave(list[0], flippedRef.current);
    setFlash(list);
    const t = setTimeout(() => setFlash([]), 1000);
    return () => clearTimeout(t);
  }, [trKey]);

  /* ---- WebGL + particles (mounted once) ---- */
  useEffect(() => {
    const cv = glRef.current;
    const fx = fxRef.current;
    const root = rootRef.current;
    const fc = fx.getContext("2d");
    const gl = cv.getContext("webgl", { antialias: false });
    const U = {};
    const cur = new Float32Array(64);
    const dat = new Uint8Array(256);
    let wave = [0.5, 0.5, -99];
    let glOK = false;
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
          ["uRes", "uT", "uBeat", "uInf", "uWave"].forEach((n) => (U[n] = gl.getUniformLocation(p, n)));
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.uniform1i(U.uInf, 0);
          glOK = true;
        } else console.error(gl.getProgramInfoLog(p));
      }
    }
    if (!glOK) cv.style.background = "#1a2a20";

    const fit = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(w * d);
      cv.height = Math.round(h * d);
      fx.width = w;
      fx.height = h;
      if (glOK) gl.viewport(0, 0, cv.width, cv.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);

    const center = (sq, fl) => {
      const { col, row } = disp(sq, fl);
      return { col, row };
    };
    api.current.burst = (sq, n, fl) => {
      const { col, row } = center(sq, fl);
      const s = (fx.width * (1 - 2 * FW)) / 8;
      const cx = fx.width * FW + (col + 0.5) * s;
      const cy = fx.height * FW + (row + 0.5) * s;
      for (let k = 0; k < n; k++)
        parts.push({ x: cx, y: cy, vx: rnd(-2.4, 2.4), vy: rnd(-2.8, 1), l: 0, m: rnd(30, 65), s: rnd(1.5, 3.8) });
    };
    api.current.wave = (sq, fl) => {
      const { col, row } = center(sq, fl);
      wave = [(col + 0.5) / 8, (row + 0.5) / 8, now()];
    };

    for (let i = 0; i < 40; i++)
      parts.push({ x: rnd(0, 500), y: rnd(0, 500), vx: rnd(-0.2, 0.2), vy: rnd(-0.6, -0.2), l: rnd(0, 200), m: 260, s: rnd(1, 2.4), amb: 1 });

    const tick = () => {
      const t = now();
      const dt = Math.min(0.05, t - last);
      last = t;
      if (glOK) {
        const T = tgt.current;
        for (let k = 0; k < 64; k++) {
          const df = T[k] - cur[k];
          cur[k] += Math.abs(df) < dt * 0.45 ? df : Math.sign(df) * dt * 0.45;
          dat[k * 4] = Math.round(cur[k] * 255);
          dat[k * 4 + 3] = 255;
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 8, 8, 0, gl.RGBA, gl.UNSIGNED_BYTE, dat);
        gl.uniform2f(U.uRes, cv.width, cv.height);
        gl.uniform1f(U.uT, t);
        gl.uniform1f(U.uBeat, beat(t));
        gl.uniform3f(U.uWave, wave[0], wave[1], wave[2]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      fc.clearRect(0, 0, fx.width, fx.height);
      fc.globalCompositeOperation = "lighter";
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.l++;
        if (!p.amb) p.vy += 0.03;
        if (p.amb && (p.l > p.m || p.y < 0)) {
          p.x = rnd(0, fx.width);
          p.y = fx.height;
          p.l = 0;
        }
        const al = p.amb ? Math.sin(Math.PI * Math.min(1, p.l / p.m)) * 0.5 : Math.max(0, 1 - p.l / p.m);
        fc.fillStyle = "rgba(90,255,150," + al + ")";
        fc.beginPath();
        fc.arc(p.x, p.y, p.s, 0, 6.3);
        fc.fill();
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
    const cls = ["bb-sq"];
    if (selected === name) cls.push("sel");
    if (tset.has(name)) cls.push(occ.has(name) ? "cap" : "dot");
    if (lastMove && (lastMove.from === name || lastMove.to === name)) cls.push("last");
    squares.push(
      <div key={name} className={cls.join(" ")} onClick={() => onSquareClick && onSquareClick(name)}>
        {warningSquare === name && <i className="bb-warn" />}
      </div>
    );
  }

  const pieceEl = (p, extra, key) => {
    const { col, row } = disp(p.sq, flipped);
    return (
      <div
        key={key}
        className={`bb-pc ${p.color} ${infSet.has(p.sq) ? "inf" : ""} ${flash.includes(p.sq) ? "flash" : ""} ${extra}`}
        style={{ transform: `translate(${col * 100}%,${row * 100}%)` }}
      >
        <svg viewBox="0 0 100 100" className={movedId === p.id ? "hop" : ""}>
          <use className="a" href={"#bbP" + p.type} />
          <use className="v" href={"#bbP" + p.type} />
        </svg>
      </div>
    );
  };

  return (
    <div className="bb-board" ref={rootRef}>
      <Defs />
      <canvas ref={glRef} className="bb-gl" />
      <div className="bb-inner">
        <div className="bb-sqs">{squares}</div>
        <div className="bb-pcs">
          {pieces.map((p) => pieceEl(p, "", "p" + p.id))}
          {ghosts.map((p) => pieceEl(p, "die", "g" + p.gid))}
        </div>
      </div>
      <canvas ref={fxRef} className="bb-fx" />
    </div>
  );
}