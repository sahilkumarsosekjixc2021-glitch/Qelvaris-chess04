/*
  Connect page ke "live findings". Sab numbers asli reviewed games se aate hain.
  report = computeLeaks(records), records = leaks.js ke game records.
*/

const SENTENCES = {
  hanging: (leak, n) => `You leave a piece hanging in ${leak.games} of ${n} games.`,
  "time-trouble": (leak, n) => `You make serious mistakes in time trouble in ${leak.games} of ${n} games.`,
  "missed-tactics": (leak, n) => `You miss a capture or a forced mate in ${leak.games} of ${n} games.`,
  "endgame-conversion": (leak, n) => `You did not convert a winning endgame in ${leak.games} of ${n} games.`,
  "opening-gaps": (leak, n) => `You slip in the first ten moves in ${leak.games} of ${n} games.`,
  "back-rank": (leak, n) => `You were back-rank mated in ${leak.games} of ${n} games.`,
};

const family = (name) => String(name || "").split(":")[0].trim();

// Kaun si opening overall se kam score deti hai (kam se kam 3 games aur 15 points ka fark)
export function openingGap(records) {
  const scored = records.filter((r) => typeof r.score === "number" && r.opening);
  if (scored.length < 8) return null;

  const overall = (scored.reduce((sum, r) => sum + r.score, 0) / scored.length) * 100;
  const groups = new Map();

  for (const record of scored) {
    const key = family(record.opening);
    if (!key) continue;
    const group = groups.get(key) || { name: key, games: 0, total: 0 };
    group.games += 1;
    group.total += record.score;
    groups.set(key, group);
  }

  let worst = null;

  for (const group of groups.values()) {
    if (group.games < 3) continue;
    const score = (group.total / group.games) * 100;
    const gap = overall - score;
    if (gap >= 15 && (!worst || gap > worst.gap)) {
      worst = { name: group.name, games: group.games, score: Math.round(score), overall: Math.round(overall), gap };
    }
  }

  return worst;
}

export function buildFindings(report, records) {
  const findings = report.leaks.slice(0, 5).map((leak) => ({
    key: leak.id,
    tag: "Leak",
    title: SENTENCES[leak.id](leak, report.games),
    sub:
      leak.points > 0
        ? `Costs an estimated ${leak.points} rating points.`
        : "Small so far, but it keeps repeating.",
  }));

  const gap = openingGap(records);

  if (gap) {
    findings.push({
      key: "opening-gap",
      tag: "Opening gap",
      title: `Your ${gap.name} scores ${gap.score}%, against ${gap.overall}% overall.`,
      sub: `Based on ${gap.games} games.`,
    });
  }

  return findings;
}