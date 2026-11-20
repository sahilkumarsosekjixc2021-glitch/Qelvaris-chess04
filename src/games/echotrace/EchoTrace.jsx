import "./EchoTrace.css";
import EchoBoard from "./EchoBoard";
import { CapturedTray, EchoHistory, FootprintLegend, PlayerPanel, SoundIndicator, TurnIndicator } from "./EchoPanels";
import { ECHO_CONFIG } from "./echoConfig";
import useEchoTrace from "./useEchoTrace";

/*
 * <EchoTrace />  Hidden-information chess mode.
 * Props:
 *   playerColor : "w" | "b"
 *   mode        : "bot" (practice placeholder) | "online" (needs `network`, see echoNetwork.js)
 *   config      : override parts of ECHO_CONFIG
 *   network     : object from createEchoNetwork()
 *   player / opponent : { name, rating }
 */
export default function EchoTrace({
  playerColor = "w",
  mode = "bot",
  config = ECHO_CONFIG,
  network = null,
  player = { name: "You", rating: null },
  opponent = { name: "Opponent", rating: null },
}) {
  const g = useEchoTrace({ playerColor, mode, config, network });
  const hidden = Math.max(0, 16 - g.captured.mine.length);

  return (
    <div className="ec-root">
      <header className="ec-head">
        <div>
          <h2>ECHO-TRACE</h2>
          <p>Hidden-information chess. You only see your own pieces. Listen and follow the footprints.</p>
        </div>
        <span className="ec-badge">{mode === "bot" ? "Practice (placeholder bot)" : "Online"}</span>
      </header>

      <div className="ec-layout">
        <section className="ec-main">
          <PlayerPanel name={opponent.name} rating={opponent.rating} active={!g.isMyTurn && !g.status.over} note={`${hidden} hidden pieces`} capturedCount={g.captured.lost.length} />
          <EchoBoard
            pieces={g.pieces}
            footprints={g.footprints}
            currentPly={g.currentPly}
            config={config}
            flipped={g.flipped}
            selected={g.selected}
            hints={g.hints}
            lastOwn={g.lastOwn}
            onSquareClick={g.onSquareClick}
          />
          <PlayerPanel you name={player.name} rating={player.rating} active={g.isMyTurn} note="Pieces visible to you" capturedCount={g.captured.mine.length} />
          <TurnIndicator status={g.status} isMyTurn={g.isMyTurn} message={g.message} />
        </section>

        <aside className="ec-side">
          <SoundIndicator event={g.echo} on={g.soundOn} onToggle={() => g.setSoundOn(!g.soundOn)} reveal={config.soundReveal} />
          <FootprintLegend config={config} />
          <EchoHistory log={g.log} revealSquares={config.historyRevealsSquares} />
          <CapturedTray captured={g.captured} />
          <button className="ec-new" onClick={g.newGame}>New game</button>
        </aside>
      </div>
    </div>
  );
}