// QV-QUICKSCAN: shareable result image (1080x1350, PNG). Koi library nahi, sirf canvas.
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawShareCard({ username, source, result, host }) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1120");
  bg.addColorStop(1, "#06120e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.8, 160, 20, W * 0.8, 160, 520);
  glow.addColorStop(0, "rgba(247,181,56,0.25)");
  glow.addColorStop(1, "rgba(247,181,56,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const pad = 80;

  // Brand
  ctx.fillStyle = "#f7b538";
  ctx.font = `800 40px ${font}`;
  ctx.fillText("♛  QELVARIS", pad, 120);

  ctx.fillStyle = "#8c97ab";
  ctx.font = `600 30px ${font}`;
  ctx.fillText("WHERE MY RATING LEAKS", pad, 190);

  // Player
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 64px ${font}`;
  ctx.fillText(`@${String(username).slice(0, 24)}`, pad, 290);
  ctx.fillStyle = "#8c97ab";
  ctx.font = `500 32px ${font}`;
  ctx.fillText(`${source === "chesscom" ? "Chess.com" : "Lichess"} · last ${result.n} games`, pad, 342);

  // Record
  ctx.fillStyle = "#4fd1c5";
  ctx.font = `800 44px ${font}`;
  ctx.fillText(`${result.wins}W  ${result.draws}D  ${result.losses}L`, pad, 430);

  // Findings
  let y = 490;
  const items = [...result.findings, ...(result.good ? [result.good] : [])].slice(0, 3);
  for (const f of items) {
    const bad = f.tone === "bad";
    ctx.fillStyle = bad ? "rgba(255,125,125,0.10)" : "rgba(97,214,154,0.10)";
    ctx.strokeStyle = bad ? "rgba(255,125,125,0.45)" : "rgba(97,214,154,0.45)";
    ctx.lineWidth = 2;
    const h = 190;
    ctx.beginPath();
    ctx.roundRect(pad, y, W - pad * 2, h, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = bad ? "#ff8f8f" : "#61d69a";
    ctx.font = `800 84px ${font}`;
    ctx.fillText(f.big, pad + 36, y + h / 2 + 30);
    const bigW = ctx.measureText(f.big).width;

    ctx.fillStyle = "#eef1f6";
    ctx.font = `700 34px ${font}`;
    const lines = wrap(ctx, f.title, W - pad * 2 - bigW - 100).slice(0, 3);
    lines.forEach((line, i) =>
      ctx.fillText(line, pad + 36 + bigW + 28, y + h / 2 + 12 + (i - (lines.length - 1) / 2) * 44)
    );
    y += h + 22;
  }

  // Footer
  ctx.fillStyle = "#f7b538";
  ctx.font = `800 38px ${font}`;
  ctx.fillText("Find your leaks free", pad, H - 118);
  ctx.fillStyle = "#8c97ab";
  ctx.font = `600 32px ${font}`;
  ctx.fillText(host || "qelvaris.vercel.app", pad, H - 70);

  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
