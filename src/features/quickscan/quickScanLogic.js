// QV-QUICKSCAN: signup se pehle ka "quick scan". Engine ke bina, sirf public games ke headers se
// asli pattern nikalta hai (time par haarna, jaldi haarna, rang ka fark, kamzor/majboot opening).
// Pure functions: koi network/React nahi.
import { colorFor, tagOf } from "../../sources";

export const MIN_GAMES = 8;

function headersOf(text) {
  const out = {};
  const re = /\[(\w+) "([^"]*)"\]/g;
  let m;
  while ((m = re.exec(text))) out[m[1]] = m[2];
  return out;
}

function moveCount(text) {
  const body = String(text).replace(/\[[^\]]*\]\s*/g, "").replace(/\{[^}]*\}/g, " ");
  let max = 0;
  const re = /(\d+)\.(?!\d)/g;
  let m;
  while ((m = re.exec(body))) max = Math.max(max, Number(m[1]));
  return max;
}

export function openingFamily(h) {
  const lichess = (h.Opening || "").trim();
  if (lichess && lichess !== "?") return lichess.split(":")[0].trim();
  const url = h.ECOUrl || "";
  if (url) {
    const slug = url.split("/openings/")[1] || "";
    const clean = slug.replace(/-\d+\..*$/, "").replace(/-/g, " ").trim();
    if (clean) return clean.split(" ").slice(0, 2).join(" ");
  }
  return "";
}

function isTimeLoss(h, color) {
  const term = (h.Termination || "").toLowerCase();
  if (!term) return false;
  if (term.includes("time forfeit")) return true; // lichess
  return term.includes("on time"); // chess.com: "<winner> won on time"
}

export function summarise(items, username) {
  const games = [];
  for (const item of items) {
    const h = headersOf(item.text);
    const color = colorFor(h, username);
    const white = String(h.White || "").toLowerCase() === String(username).trim().toLowerCase();
    const black = String(h.Black || "").toLowerCase() === String(username).trim().toLowerCase();
    if (!white && !black) continue;

    const result = h.Result;
    let score = null;
    if (result === "1-0") score = color === "w" ? 1 : 0;
    else if (result === "0-1") score = color === "b" ? 1 : 0;
    else if (result === "1/2-1/2") score = 0.5;
    if (score === null) continue;

    games.push({
      color,
      score,
      timeLoss: score === 0 && isTimeLoss(h, color),
      moves: moveCount(item.text),
      opening: openingFamily(h),
      tc: tagOf(item.text, "TimeControl"),
    });
  }
  return games;
}

const pct = (x) => Math.round(x * 100);

export function analyse(items, username) {
  const games = summarise(items, username);
  const n = games.length;
  if (n < MIN_GAMES) return { tooFew: true, n };

  const wins = games.filter((g) => g.score === 1).length;
  const draws = games.filter((g) => g.score === 0.5).length;
  const losses = games.filter((g) => g.score === 0).length;
  const overall = games.reduce((a, g) => a + g.score, 0) / n;

  const findings = [];

  // 1) Time par haarna
  const timeLosses = games.filter((g) => g.timeLoss).length;
  if (losses >= 4 && timeLosses / losses >= 0.25 && timeLosses >= 3) {
    const share = timeLosses / losses;
    findings.push({
      id: "time",
      tone: "bad",
      big: `${pct(share)}%`,
      title: "of your losses are on the clock",
      text: `${timeLosses} of ${losses} losses were lost on time. Often the position was fine, the time was not.`,
      severity: share * 100 + 10,
    });
  }

  // 2) Jaldi haarna (20 chaal ke andar)
  const early = games.filter((g) => g.score === 0 && !g.timeLoss && g.moves > 0 && g.moves <= 20).length;
  const nonTime = losses - timeLosses;
  if (nonTime >= 4 && early / nonTime >= 0.3 && early >= 3) {
    const share = early / nonTime;
    findings.push({
      id: "early",
      tone: "bad",
      big: `${early}`,
      title: "games lost in 20 moves or fewer",
      text: `${pct(share)}% of your non-time losses ended early. That usually means one tactic or opening trap, not a bad plan.`,
      severity: share * 100,
    });
  }

  // 3) Rang ka fark
  const byColor = { w: games.filter((g) => g.color === "w"), b: games.filter((g) => g.color === "b") };
  if (byColor.w.length >= 8 && byColor.b.length >= 8) {
    const sw = byColor.w.reduce((a, g) => a + g.score, 0) / byColor.w.length;
    const sb = byColor.b.reduce((a, g) => a + g.score, 0) / byColor.b.length;
    const gap = Math.abs(sw - sb);
    if (gap >= 0.15) {
      const weak = sw < sb ? "White" : "Black";
      findings.push({
        id: "color",
        tone: "bad",
        big: `${pct(Math.min(sw, sb))}%`,
        title: `score with ${weak}`,
        text: `You score ${pct(Math.max(sw, sb))}% with ${sw < sb ? "Black" : "White"} but only ${pct(Math.min(sw, sb))}% with ${weak}. Your ${weak} openings need work.`,
        severity: gap * 100,
      });
    }
  }

  // 4) Opening: kamzor aur majboot
  const fam = new Map();
  for (const g of games) {
    if (!g.opening) continue;
    const key = `${g.opening}|${g.color}`;
    const row = fam.get(key) || { name: g.opening, color: g.color, n: 0, sum: 0 };
    row.n += 1;
    row.sum += g.score;
    fam.set(key, row);
  }
  const rows = [...fam.values()].filter((r) => r.n >= 4).map((r) => ({ ...r, avg: r.sum / r.n }));
  const worst = [...rows].sort((a, b) => a.avg - b.avg)[0];
  if (worst && worst.avg <= overall - 0.15) {
    findings.push({
      id: "opening-bad",
      tone: "bad",
      big: `${pct(worst.avg)}%`,
      title: `in the ${worst.name} as ${worst.color === "w" ? "White" : "Black"}`,
      text: `Only ${pct(worst.avg)}% over ${worst.n} games, against ${pct(overall)}% overall. This opening costs you points.`,
      severity: (overall - worst.avg) * 100,
    });
  }
  const best = [...rows].sort((a, b) => b.avg - a.avg)[0];
  const good =
    best && best.avg >= overall + 0.12
      ? {
          id: "opening-good",
          tone: "good",
          big: `${pct(best.avg)}%`,
          title: `in the ${best.name} as ${best.color === "w" ? "White" : "Black"}`,
          text: `Your strongest area: ${best.n} games at ${pct(best.avg)}%. Build more of your repertoire around it.`,
          severity: 0,
        }
      : null;

  const bad = findings.sort((a, b) => b.severity - a.severity).slice(0, 3);

  return { tooFew: false, n, wins, draws, losses, overall, findings: bad, good };
}
