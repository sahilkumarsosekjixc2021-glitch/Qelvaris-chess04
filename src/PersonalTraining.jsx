
import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";

const PANEL = {
  background: "#111c18",
  border: "1px solid #293a31",
  borderRadius: 12,
  padding: 15,
  minWidth: 0,
};

const MUTED = { color: "#a3b4a9", fontSize: 12, lineHeight: 1.6 };
const STORAGE_KEY = "qelvarisTrainingCompleted";

function phaseFromFen(fen) {
  try {
    const placement = fen.split(" ")[0];
    const pieces = placement.replace(/[1-8/]/g, "");
    const nonPawns = pieces.replace(/[PpKk]/g, "");
    if (nonPawns.length <= 4) return "Endgame";
    if (nonPawns.length <= 8) return "Late middlegame";
    return "Opening / middlegame";
  } catch {
    return "Unknown";
  }
}

function getMoveSeverity(item) {
  const label = item?.category?.label || "";
  if (label === "Blunder") return 3;
  if (label === "Mistake") return 2;
  if (label === "Inaccuracy") return 1;
  return 0;
}

function makeTaskKey(item) {
  return `${item.ply}-${item.san}-${item.category?.label || "move"}`;
}

function buildTasks(analysis) {
  return analysis
    .filter(
      (item) =>
        item &&
        item.category &&
        ["Blunder", "Mistake", "Inaccuracy"].includes(item.category.label) &&
        item.fenBefore
    )
    .sort((a, b) => {
      const severity = getMoveSeverity(b) - getMoveSeverity(a);
      return severity || (Number(b.loss) || 0) - (Number(a.loss) || 0);
    })
    .slice(0, 8)
    .map((item) => ({
      id: makeTaskKey(item),
      item,
      title: `${item.category.label}: move ${item.ply}`,
      prompt: `Before revealing the engine suggestion, find a stronger move for ${item.color === "b" ? "Black" : "White"}.`,
      answer: item.bestMoveSan || "Engine suggestion unavailable",
      fen: item.fenBefore,
      explanation: item.bestMoveSan
        ? `The engine preferred ${item.bestMoveSan} over ${item.san}. Estimated evaluation loss: ${Math.round(Number(item.loss) || 0)} cp.`
        : `Review ${item.san} and compare legal candidate moves in Analysis Lab.`,
    }));
}

function getRecommendations(stats, phases) {
  const result = [];

  if (stats.blunders > 0) {
    result.push({
      title: "Blunder prevention",
      reason: `${stats.blunders} blunder(s) in this game.`,
      action: "Before moving, check opponent checks, captures and direct threats.",
      priority: 1,
    });
  }

  if (stats.mistakes + stats.inaccuracies >= 2) {
    result.push({
      title: "Improve move selection",
      reason: `${stats.mistakes} mistake(s) and ${stats.inaccuracies} inaccuracy/ies.`,
      action: "Find two candidate moves before checking the engine's choice.",
      priority: 2,
    });
  }

  const weakest = [...phases].sort(
    (a, b) => b.averageLoss - a.averageLoss
  )[0];

  if (weakest && weakest.averageLoss >= 70) {
    result.push({
      title: `Review the ${weakest.phase.toLowerCase()}`,
      reason: `${weakest.averageLoss} cp average estimated loss.`,
      action: "Replay critical positions and identify the main threat before choosing a move.",
      priority: 3,
    });
  }

  if (!result.length) {
    result.push({
      title: "Calculation and consistency",
      reason: "This game does not show a strong weakness by itself.",
      action: "Practise candidate-move calculation and review critical positions from another game.",
      priority: 1,
    });
  }

  return result.sort((a, b) => a.priority - b.priority);
}

export default function PersonalTraining({
  analysis = [],
  reviewPgn = "",
  reviewLabel = "",
}) {
  const valid = useMemo(
    () => Array.isArray(analysis) ? analysis.filter((x) => x && x.category) : [],
    [analysis]
  );

  const gameKey = useMemo(() => {
    const source = reviewPgn || reviewLabel || "current-game";
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = (hash * 31 + source.charCodeAt(i)) | 0;
    }
    return `game-${Math.abs(hash)}`;
  }, [reviewPgn, reviewLabel]);

  const [completed, setCompleted] = useState({});
  const [revealed, setRevealed] = useState([]);
  const [selectedFen, setSelectedFen] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setCompleted(saved[gameKey] || {});
    } catch {
      setCompleted({});
    }
    setRevealed([]);
    setSelectedFen("");
  }, [gameKey]);

  const report = useMemo(() => {
    const stats = {
      total: valid.length,
      blunders: 0,
      mistakes: 0,
      inaccuracies: 0,
      other: 0,
    };
    const phases = {};

    valid.forEach((item) => {
      const label = item.category?.label;
      if (label === "Blunder") stats.blunders++;
      else if (label === "Mistake") stats.mistakes++;
      else if (label === "Inaccuracy") stats.inaccuracies++;
      else stats.other++;

      const phase = phaseFromFen(item.fenBefore);
      if (!phases[phase]) phases[phase] = { count: 0, loss: 0, errors: 0 };

      phases[phase].count++;
      phases[phase].loss += Math.max(0, Number(item.loss) || 0);
      if (getMoveSeverity(item)) phases[phase].errors++;
    });

    const weakPhases = Object.entries(phases)
      .filter(([name, data]) => name !== "Unknown" && data.count > 0)
      .map(([phase, data]) => ({
        phase,
        count: data.count,
        errors: data.errors,
        averageLoss: Math.round(data.loss / data.count),
      }))
      .sort((a, b) => b.averageLoss - a.averageLoss);

    return {
      stats,
      weakPhases,
      recommendations: getRecommendations(stats, weakPhases),
      tasks: buildTasks(valid),
    };
  }, [valid]);

  function toggleTask(id) {
    setCompleted((previous) => {
      const next = { ...previous, [id]: !previous[id] };

      try {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        all[gameKey] = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch {
        // The current session still works if storage is unavailable.
      }

      return next;
    });
  }

  const completedCount = report.tasks.filter(
    (task) => completed[task.id]
  ).length;

  return (
    <section style={{ ...PANEL, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 5px" }}>Personal Training</h3>
          <div style={MUTED}>
            Turn mistakes from this analyzed game into practice tasks.
          </div>
          {reviewLabel && <div style={{ ...MUTED, marginTop: 5 }}>Game: {reviewLabel}</div>}
        </div>
        <div style={{ color: "#8fe0ae", fontSize: 12 }}>
          {valid.length ? `${valid.length} moves analyzed` : "Awaiting analysis"}
        </div>
      </div>

      {!valid.length ? (
        <div style={{ ...MUTED, marginTop: 14 }}>
          Load a game in Game Review and run Automatic Analysis to generate a
          personalized training plan.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 9, marginTop: 16 }}>
            {[
              ["Blunders", report.stats.blunders, "#ff7777"],
              ["Mistakes", report.stats.mistakes, "#ffb36b"],
              ["Inaccuracies", report.stats.inaccuracies, "#e9d77e"],
              ["Other moves", report.stats.other, "#8bd7be"],
            ].map(([label, value, color]) => (
              <div key={label} style={{ ...PANEL, padding: 11 }}>
                <div style={MUTED}>{label}</div>
                <strong style={{ color, fontSize: 23 }}>{value}</strong>
              </div>
            ))}
          </div>

          <h4 style={{ margin: "20px 0 9px" }}>Training progress</h4>
          <div style={{ height: 7, background: "#24342b", borderRadius: 8, overflow: "hidden" }}>
            <div style={{
              width: `${report.tasks.length ? completedCount / report.tasks.length * 100 : 0}%`,
              height: "100%",
              background: "#51c58b",
              transition: "width .2s",
            }} />
          </div>
          <div style={{ ...MUTED, marginTop: 5 }}>
            {completedCount} of {report.tasks.length} practice tasks completed
          </div>

          <h4 style={{ margin: "20px 0 9px" }}>Practice your mistakes</h4>
          {report.tasks.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {report.tasks.map((task) => {
                const isRevealed = revealed.includes(task.id);
                const isDone = Boolean(completed[task.id]);

                return (
                  <div key={task.id} style={{
                    padding: 13,
                    background: "#0c1510",
                    border: `1px solid ${isDone ? "#477c59" : "#293a31"}`,
                    borderRadius: 10,
                  }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleTask(task.id)}
                        style={{ marginTop: 4, accentColor: "#51c58b" }}
                      />
                      <span style={{ flex: 1 }}>
                        <strong>{task.title}</strong>
                        <div style={{ ...MUTED, marginTop: 4 }}>{task.prompt}</div>
                        <div style={{ ...MUTED, marginTop: 4 }}>
                          Played: {task.item.san} · Loss: {Math.round(Number(task.item.loss) || 0)} cp
                        </div>
                      </span>
                    </label>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 11 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedFen(task.fen)}
                        style={{ background: "#1b3026", border: "1px solid #385343", color: "#e8eee9", padding: "8px 10px", borderRadius: 7, cursor: "pointer" }}
                      >
                        Show position FEN
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevealed((old) =>
                          old.includes(task.id) ? old.filter((id) => id !== task.id) : [...old, task.id]
                        )}
                        style={{ background: "#176b48", border: "1px solid #397b57", color: "white", padding: "8px 10px", borderRadius: 7, cursor: "pointer" }}
                      >
                        {isRevealed ? "Hide answer" : "Reveal engine suggestion"}
                      </button>
                    </div>

                    {isRevealed && (
                      <div style={{ marginTop: 10, padding: 11, background: "#182720", borderRadius: 8, fontSize: 13, lineHeight: 1.65 }}>
                        <strong style={{ color: "#8fe0ae" }}>Engine suggestion: {task.answer}</strong>
                        <div style={{ ...MUTED, marginTop: 4 }}>{task.explanation}</div>
                      </div>
                    )}

                    {selectedFen === task.fen && (
                      <div style={{ marginTop: 8, padding: 9, background: "#182720", borderRadius: 7 }}>
                        <div style={MUTED}>Position FEN — paste into a compatible FEN loader or Analysis Lab if supported:</div>
                        <code style={{ display: "block", marginTop: 5, fontSize: 11, overflowWrap: "anywhere", color: "#dce8df" }}>
                          {task.fen}
                        </code>
                        <button type="button" onClick={() => {
                          try { navigator.clipboard?.writeText(task.fen); } catch {}
                        }} style={{ marginTop: 7, background: "#1b3026", border: "1px solid #385343", color: "#e8eee9", padding: "6px 9px", borderRadius: 6, cursor: "pointer" }}>
                          Copy FEN
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ ...MUTED, marginTop: 8 }}>
              No blunders, mistakes or inaccuracies were classified in this analysis.
              Review candidate moves and keep analyzing games to build a larger sample.
            </div>
          )}

          <h4 style={{ margin: "20px 0 9px" }}>Where to improve</h4>
          <div style={{ display: "grid", gap: 8 }}>
            {report.weakPhases.map((phase) => (
              <div key={phase.phase} style={{ padding: 11, background: "#182720", borderRadius: 8 }}>
                <strong>{phase.phase}</strong>
                <div style={{ ...MUTED, marginTop: 4 }}>
                  {phase.averageLoss} cp average estimated loss · {phase.errors} classified errors in {phase.count} moves
                </div>
              </div>
            ))}
          </div>

          <h4 style={{ margin: "20px 0 9px" }}>Coach recommendations</h4>
          {report.recommendations.map((item) => (
            <div key={item.title} style={{ padding: 12, background: "#182720", borderRadius: 8, marginBottom: 8 }}>
              <strong>{item.title}</strong>
              <div style={{ ...MUTED, marginTop: 4 }}>{item.reason}</div>
              <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>{item.action}</div>
            </div>
          ))}

          <p style={{ ...MUTED, marginBottom: 0 }}>
            Evaluations and phase labels are estimates based on this game's engine
            analysis. One game is not enough to establish a long-term weakness.
          </p>
        </>
      )}
    </section>
  );
}
