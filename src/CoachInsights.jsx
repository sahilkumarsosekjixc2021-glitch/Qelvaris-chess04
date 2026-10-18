
function formatScore(score) {
  if (score === null || score === undefined || !Number.isFinite(Number(score))) {
    return "Unavailable";
  }

  const value = Number(score);
  if (Math.abs(value) >= 9900) {
    const moves = Math.max(1, Math.round((10000 - Math.abs(value)) / 10));
    return `${value > 0 ? "White" : "Black"} mate in ${moves}`;
  }

  const pawns = value / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

const styles = {
  panel: {
    marginTop: 18,
    padding: 15,
    background: "#111c18",
    border: "1px solid #293a31",
    borderRadius: 12,
    color: "#e8eee9",
  },
  muted: { color: "#a3b4a9", fontSize: 12, lineHeight: 1.6 },
  block: {
    marginTop: 12,
    padding: 12,
    background: "#182720",
    borderRadius: 9,
    lineHeight: 1.65,
    fontSize: 13,
  },
};

function getAdvice(report) {
  const category = report.category?.label || "Unclassified";
  const best = report.bestMoveSan || "the engine's suggested move";
  const playedBest =
    best !== "the engine's suggested move" &&
    best === report.san;

  if (playedBest) {
    return {
      title: "You matched the engine's top move",
      explanation:
        `${report.san} matches the engine's preferred move at the configured search depth. ` +
        "This does not mean the move is the only good choice or that the position is fully solved.",
      action:
        "Check the opponent's strongest reply and compare the other candidate moves before deciding on your next plan.",
    };
  }

  if (category === "Blunder" || category === "Mistake") {
    return {
      title: "A stronger alternative was available",
      explanation:
        `The move ${report.san} was classified as a ${category.toLowerCase()}. ` +
        `The engine preferred ${best}. The estimated loss was ${Math.max(0, Number(report.loss) || 0)} cp.`,
      action:
        "Return to the position before this move. Look for checks, captures and threats for both sides, then compare your candidate with the engine's suggestion.",
    };
  }

  if (category === "Inaccuracy") {
    return {
      title: "Look for a more precise continuation",
      explanation:
        `${best} was preferred over ${report.san}. The evaluation difference is an estimate and can change with engine depth.`,
      action:
        "Identify the main positional goal: king safety, piece activity, pawn structure or a tactical opportunity. Check which candidate best supports it.",
    };
  }

  return {
    title: "Compare the alternatives",
    explanation:
      `The move was classified as ${category}. The engine suggestion was ${best}. ` +
      "Small differences may depend on search depth and engine settings.",
    action:
      "Compare candidate moves and their replies. Check whether the move improves your position or allows an opponent threat.",
  };
}

export default function CoachInsights({ report }) {
  if (!report) {
    return (
      <section className="coach-insights" style={styles.panel}>
        <h3 style={{ marginTop: 0 }}>Personal Chess Coach</h3>
        <p style={styles.muted}>
          Select an analyzed move in Game Review to receive move-specific feedback.
        </p>
      </section>
    );
  }

  const category = report.category?.label || "Unclassified";
  const advice = getAdvice(report);
  const loss = Math.max(0, Number(report.loss) || 0);

  return (
    <section className="coach-insights" style={styles.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <span style={{ ...styles.muted, letterSpacing: 1 }}>QELVARIS COACH</span>
          <h3 style={{ margin: "5px 0" }}>Personal Chess Coach</h3>
        </div>
        <span style={{
          alignSelf: "flex-start",
          padding: "6px 10px",
          borderRadius: 7,
          background: category === "Blunder" ? "#4a2024" :
            category === "Mistake" ? "#49321f" :
            category === "Inaccuracy" ? "#433c1d" : "#193426",
          color: category === "Blunder" ? "#ff9b9b" :
            category === "Mistake" ? "#ffc18a" :
            category === "Inaccuracy" ? "#f0df8c" : "#8fe0ae",
          fontSize: 12,
        }}>
          {category}
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))",
        gap: 9,
        marginTop: 14,
      }}>
        {[
          ["Played move", report.san || "Unavailable"],
          ["Engine choice", report.bestMoveSan || "Unavailable"],
          ["Estimated loss", `${Math.round(loss)} cp`],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: 11, background: "#182720", borderRadius: 8, minWidth: 0 }}>
            <div style={styles.muted}>{label}</div>
            <strong style={{ display: "block", marginTop: 5, overflowWrap: "anywhere" }}>{value}</strong>
          </div>
        ))}
      </div>

      <div style={styles.block}>
        <h4 style={{ margin: "0 0 6px" }}>Why review this move?</h4>
        <strong>{advice.title}</strong>
        <p style={{ margin: "6px 0 0" }}>{advice.explanation}</p>
      </div>

      <div style={styles.block}>
        <h4 style={{ margin: "0 0 6px" }}>What to examine</h4>
        <p style={{ margin: 0 }}>
          {report.bestMoveSan && report.bestMoveSan !== report.san
            ? `Compare ${report.san} with ${report.bestMoveSan}. The evaluation loss estimates the impact, but does not by itself prove a specific tactical motif.`
            : "Check the opponent's strongest reply, possible forcing moves and the safety of your pieces."}
        </p>
      </div>

      <div style={{ ...styles.block, border: "1px solid #315c43" }}>
        <h4 style={{ margin: "0 0 6px", color: "#8fe0ae" }}>Training tip</h4>
        <p style={{ margin: 0 }}>{advice.action}</p>
      </div>

      <p style={{ ...styles.muted, marginBottom: 0, marginTop: 12 }}>
        Before: {formatScore(report.beforeScore)} · After: {formatScore(report.afterScore)}
      </p>
      <p style={{ ...styles.muted, marginBottom: 0 }}>
        Engine-assisted guidance based on the available move report. It does not
        independently verify a tactical explanation or guarantee the best move.
      </p>
    </section>
  );
}
