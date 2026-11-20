import { Component, useEffect, useState } from "react";
import StudyLab from "../study/StudyLab";
import MiddlegameLesson from "./MiddlegameLesson";
import LabDashboard, { LabHero } from "./LabDashboard";
import { getMiddlegame } from "./middlegameBuild";
import "./Middlegames.css";

// Middlegame Lab ka ghar: "Coach lessons" (naya) aur "Think it through" (purana 4-step Lab).

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error("[LabHome] crashed:", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="qo-empty">
          <h3>This part of the Lab could not load</h3>
          <p>The rest of your Openings page is not affected.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LabHome({ lessonId = "", onPlay, onBack }) {
  const [tab, setTab] = useState("lessons");
  const [activeId, setActiveId] = useState(lessonId || "");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (lessonId) {
      setTab("lessons");
      setActiveId(lessonId);
    }
  }, [lessonId]);

  const lesson = activeId ? getMiddlegame(activeId) : null;

  return (
    <div className="qm-home">
      <Guard>
        {tab === "lessons" && !lesson && (
          <LabDashboard
            mode={tab}
            onMode={setTab}
            onBack={onBack}
            refreshKey={refresh}
            onLearn={setActiveId}
            onPlay={(id) => onPlay?.(id)}
          />
        )}

        {tab === "lessons" && lesson && (
          <MiddlegameLesson
            key={lesson.id}
            lesson={lesson}
            onExit={() => setActiveId("")}
            onDone={() => setRefresh((n) => n + 1)}
            onPlay={(l) => onPlay?.(l.id)}
          />
        )}

        {tab === "think" && (
          <>
            <LabHero mode={tab} onMode={setTab} onBack={onBack} compact />
            <p className="qo-note qm-intro">
              Slower exercises: evaluate the position, choose candidate moves, calculate, then compare with the engine.
            </p>
            <StudyLab />
          </>
        )}
      </Guard>
    </div>
  );
}
