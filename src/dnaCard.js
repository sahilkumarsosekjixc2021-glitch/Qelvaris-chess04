/*
  Qelvaris: DNA card image.
  Canvas se ek shareable PNG banata hai (1080 x 1440): player photo, six-skill hexagon,
  stats, top leaks aur strongest / weakest skill. Koi library nahi chahiye.

  renderDnaCard(data) -> Promise<Blob>

  data = {
    photo,                 // image URL (same origin ya CORS allowed). Na mile toh ♟ dikhega
    title, kicker,         // "Chess DNA", "QELVARIS · PLAYER PROFILE"
    chip,                  // "121 reviewed games · Last 30 days"
    skills,                // [{ label, value }]   value null ho sakta hai
    previous,              // [{ value }] ya null
    stats,                 // [{ label, value }]   4 boxes
    leaksTitle, leaks,     // leaks: [{ title, points }]
    emptyLeaks,            // leaks khali ho toh text
    highlightsTitle,       // "Skill highlights"
    highlights,            // [{ label, name, value, tone }]  tone: "good" | "bad"
    footerLeft, footerRight
  }
*/

const W = 1080;
const H = 1440;
const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif';

const C = {
  bg1: "#041016",
  bg2: "#0a2a2f",
  cyan: "#3ce8f2",
  amber: "#f7c948",
  pink: "#ff4d8d",
  green: "#6ee7a8",
  text: "#eef7f7",
  muted: "#8fb0b3",
  line: "rgba(120, 220, 230, 0.16)",
  panel: "rgba(12, 36, 42, 0.82)",
};

// radar chart 50 (centre) se 100 (kinara) tak chalta hai, site ke radar jaisa
const FLOOR = 50;

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function font(weight, size) {
  return `${weight} ${size}px ${FONT}`;
}

// text lamba ho toh "…" laga ke chhota kar deta hai
function fitText(ctx, text, maxWidth) {
  const value = String(text ?? "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

// font size tab tak ghatata hai jab tak text width mein fit na ho
function fitSize(ctx, text, weight, startSize, minSize, maxWidth) {
  let size = startSize;
  ctx.font = font(weight, size);
  while (size > minSize && ctx.measureText(String(text)).width > maxWidth) {
    size -= 2;
    ctx.font = font(weight, size);
  }
  return size;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// seed se same jaisa network har baar (random nahi)
function drawNetwork(ctx) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const points = Array.from({ length: 34 }, () => [rand() * W, rand() * H]);

  ctx.lineWidth = 1.4;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
      if (d < 280) {
        ctx.strokeStyle = `rgba(60, 232, 242, ${0.1 * (1 - d / 280)})`;
        ctx.beginPath();
        ctx.moveTo(points[i][0], points[i][1]);
        ctx.lineTo(points[j][0], points[j][1]);
        ctx.stroke();
      }
    }
  }
  ctx.fillStyle = "rgba(60, 232, 242, 0.28)";
  points.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBackground(ctx) {
  const base = ctx.createLinearGradient(0, 0, W * 0.4, H);
  base.addColorStop(0, C.bg2);
  base.addColorStop(0.55, C.bg1);
  base.addColorStop(1, "#06141a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const glowA = ctx.createRadialGradient(150, 130, 0, 150, 130, 620);
  glowA.addColorStop(0, "rgba(60, 232, 242, 0.20)");
  glowA.addColorStop(1, "rgba(60, 232, 242, 0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);

  const glowB = ctx.createRadialGradient(W - 100, H - 180, 0, W - 100, H - 180, 640);
  glowB.addColorStop(0, "rgba(255, 77, 141, 0.16)");
  glowB.addColorStop(1, "rgba(255, 77, 141, 0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);

  drawNetwork(ctx);

  ctx.strokeStyle = "rgba(60, 232, 242, 0.28)";
  ctx.lineWidth = 2;
  roundRect(ctx, 24, 24, W - 48, H - 48, 38);
  ctx.stroke();
}

function drawPhoto(ctx, img, cx, cy, r) {
  // glow
  const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.7);
  glow.addColorStop(0, "rgba(60, 232, 242, 0.30)");
  glow.addColorStop(1, "rgba(60, 232, 242, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (img) {
    // cover: poora circle bhare, aspect ratio bani rahe
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = "#0d2c33";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = C.cyan;
    ctx.font = font(700, r * 1.1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♟", cx, cy + 4);
  }
  ctx.restore();

  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, C.cyan);
  ring.addColorStop(1, C.pink);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHeader(ctx, data, img) {
  drawPhoto(ctx, img, 158, 160, 78);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.cyan;
  ctx.font = font(800, 22);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
  ctx.fillText(fitText(ctx, data.kicker, 700), 270, 112);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  // "Chess" safed, "DNA" gradient
  const [first, ...rest] = String(data.title || "Chess DNA").split(" ");
  const second = rest.join(" ");
  ctx.font = font(800, 84);
  ctx.fillStyle = C.text;
  ctx.fillText(first, 268, 192);
  if (second) {
    const x = 268 + ctx.measureText(`${first} `).width;
    const wide = ctx.measureText(second).width;
    const grad = ctx.createLinearGradient(x, 0, x + wide, 0);
    grad.addColorStop(0, C.cyan);
    grad.addColorStop(1, C.pink);
    ctx.fillStyle = grad;
    ctx.fillText(second, x, 192);
  }

  // chip
  ctx.font = font(600, 22);
  const label = fitText(ctx, data.chip, 640);
  const chipW = ctx.measureText(label).width + 64;
  roundRect(ctx, 268, 216, chipW, 46, 23);
  ctx.fillStyle = "rgba(60, 232, 242, 0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 232, 242, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = C.green;
  ctx.beginPath();
  ctx.arc(292, 239, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.text;
  ctx.textBaseline = "middle";
  ctx.fillText(label, 308, 240);
  ctx.textBaseline = "alphabetic";
}

function drawRadar(ctx, skills, previous, legend) {
  const cx = W / 2;
  const cy = 612;
  const R = 210;
  const count = skills.length;
  const norm = (v) => Math.min(1, Math.max(0, ((v ?? 0) - FLOOR) / (100 - FLOOR)));
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / count;
  const point = (i, v, scale = 1) => [
    cx + R * norm(v) * scale * Math.cos(angle(i)),
    cy + R * norm(v) * scale * Math.sin(angle(i)),
  ];

  // panel
  roundRect(ctx, 56, 280, W - 112, 670, 36);
  ctx.fillStyle = "rgba(10, 32, 38, 0.55)";
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // rings
  [60, 70, 80, 90, 100].forEach((ring, k) => {
    ctx.beginPath();
    skills.forEach((_, i) => {
      const [x, y] = point(i, ring);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = k === 4 ? "rgba(60, 232, 242, 0.34)" : "rgba(120, 220, 230, 0.16)";
    ctx.lineWidth = k === 4 ? 2.5 : 1.5;
    ctx.stroke();
  });

  // axes
  ctx.strokeStyle = "rgba(120, 220, 230, 0.16)";
  ctx.lineWidth = 1.5;
  skills.forEach((_, i) => {
    const [x, y] = point(i, 100);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  });

  // ring numbers (upar wali axis par)
  ctx.fillStyle = "rgba(143, 176, 179, 0.7)";
  ctx.font = font(600, 17);
  ctx.textAlign = "left";
  [60, 80, 100].forEach((ring) => {
    const [x, y] = point(0, ring);
    ctx.fillText(String(ring), x + 8, y + 6);
  });

  const trace = (list) => {
    ctx.beginPath();
    list.forEach((item, i) => {
      const [x, y] = point(i, item.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  // previous period (dashed)
  if (previous && previous.some((item) => item.value !== null && item.value !== undefined)) {
    trace(previous);
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // current
  trace(skills);
  const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  fill.addColorStop(0, "rgba(60, 232, 242, 0.10)");
  fill.addColorStop(1, "rgba(60, 232, 242, 0.34)");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(60, 232, 242, 0.55)";
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // dots + labels
  skills.forEach((item, i) => {
    const has = item.value !== null && item.value !== undefined;
    if (has) {
      const [px, py] = point(i, item.value);
      ctx.fillStyle = "#06141a";
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.cyan;
      ctx.beginPath();
      ctx.arc(px, py, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const [lx, ly] = point(i, 100, 1.2);
    const cos = Math.cos(angle(i));
    const sin = Math.sin(angle(i));
    const align = cos > 0.3 ? "left" : cos < -0.3 ? "right" : "center";
    let nameY = ly - 4;
    let valueY = ly + 34;
    if (Math.abs(cos) <= 0.3) {
      if (sin < 0) {
        nameY = ly - 44;
        valueY = ly - 8;
      } else {
        nameY = ly + 30;
        valueY = ly + 68;
      }
    }

    ctx.textAlign = align;
    ctx.fillStyle = C.text;
    ctx.font = font(700, 28);
    ctx.fillText(fitText(ctx, item.label, align === "center" ? 300 : 230), lx, nameY);
    ctx.fillStyle = has ? C.amber : C.muted;
    ctx.font = font(800, 32);
    ctx.fillText(has ? String(item.value) : "—", lx, valueY);
  });

  // legend (panel ke upar-left kone mein)
  ctx.textAlign = "left";
  ctx.font = font(600, 20);
  ctx.fillStyle = C.cyan;
  roundRect(ctx, 92, 318, 34, 14, 4);
  ctx.fill();
  ctx.fillStyle = C.muted;
  ctx.fillText(legend.current, 138, 332);
  if (legend.previous) {
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(92, 363);
    ctx.lineTo(126, 363);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.muted;
    ctx.fillText(legend.previous, 138, 369);
  }
}

function drawStats(ctx, stats) {
  const left = 56;
  const gap = 16;
  const width = (W - 112 - gap * 3) / 4;
  const top = 966;
  const height = 128;

  stats.slice(0, 4).forEach((stat, i) => {
    const x = left + i * (width + gap);
    roundRect(ctx, x, top, width, height, 22);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = C.muted;
    ctx.font = font(600, 19);
    ctx.fillText(fitText(ctx, stat.label, width - 40), x + 22, top + 40);

    const size = fitSize(ctx, stat.value, 800, 46, 24, width - 40);
    ctx.fillStyle = C.text;
    ctx.font = font(800, size);
    ctx.fillText(String(stat.value), x + 22, top + 92);
  });
}

function drawLeaks(ctx, data) {
  const x = 56;
  const y = 1110;
  const w = 560;
  const h = 218;

  roundRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = C.amber;
  ctx.font = font(800, 23);
  ctx.fillText(fitText(ctx, data.leaksTitle, w - 48), x + 26, y + 46);

  const leaks = (data.leaks || []).slice(0, 3);
  if (!leaks.length) {
    ctx.fillStyle = C.muted;
    ctx.font = font(500, 21);
    ctx.fillText(fitText(ctx, data.emptyLeaks || "", w - 52), x + 26, y + 112);
    return;
  }

  leaks.forEach((leak, i) => {
    const rowY = y + 70 + i * 50;
    ctx.fillStyle = "rgba(60, 232, 242, 0.12)";
    roundRect(ctx, x + 26, rowY, 36, 36, 10);
    ctx.fill();
    ctx.fillStyle = C.cyan;
    ctx.font = font(800, 19);
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x + 44, rowY + 25);

    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = font(700, 23);
    ctx.fillText(fitText(ctx, leak.title, w - 220), x + 78, rowY + 26);

    ctx.textAlign = "right";
    ctx.fillStyle = C.pink;
    ctx.font = font(800, 25);
    ctx.fillText(`−${leak.points}`, x + w - 26, rowY + 27);
  });
}

function drawHighlights(ctx, data) {
  const x = 56 + 560 + 16;
  const y = 1110;
  const w = W - 56 - x;
  const h = 218;

  roundRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = C.amber;
  ctx.font = font(800, 23);
  ctx.fillText(fitText(ctx, data.highlightsTitle, w - 48), x + 26, y + 46);

  (data.highlights || []).slice(0, 2).forEach((item, i) => {
    const rowY = y + 72 + i * 74;
    const color = item.tone === "bad" ? C.pink : C.green;

    ctx.fillStyle = C.muted;
    ctx.font = font(600, 18);
    ctx.fillText(fitText(ctx, item.label, w - 52), x + 26, rowY + 14);

    ctx.fillStyle = color;
    ctx.font = font(800, 32);
    ctx.textAlign = "right";
    ctx.fillText(item.value === null || item.value === undefined ? "—" : String(item.value), x + w - 26, rowY + 52);

    ctx.textAlign = "left";
    ctx.fillStyle = C.text;
    ctx.font = font(700, 26);
    ctx.fillText(fitText(ctx, item.name, w - 130), x + 26, rowY + 52);
  });
}

function drawFooter(ctx, data) {
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = C.cyan;
  ctx.font = font(800, 20);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
  ctx.fillText(fitText(ctx, data.footerLeft, 560), 56, 1392);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  ctx.textAlign = "right";
  ctx.fillStyle = C.muted;
  ctx.font = font(600, 20);
  ctx.fillText(fitText(ctx, data.footerRight, 420), W - 56, 1392);
}

export async function renderDnaCard(data) {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* font load fail ho toh bhi card banega */
    }
  }

  const img = await loadImage(data.photo);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const legend = {
    current: data.legendCurrent || "Current period",
    previous:
      data.previous && data.previous.some((item) => item.value !== null && item.value !== undefined)
        ? data.legendPrevious || "Previous period"
        : "",
  };

  drawBackground(ctx);
  drawHeader(ctx, data, img);
  drawRadar(ctx, data.skills, data.previous, legend);
  drawStats(ctx, data.stats || []);
  drawLeaks(ctx, data);
  drawHighlights(ctx, data);
  drawFooter(ctx, data);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image could not be created"))),
      "image/png"
    );
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
