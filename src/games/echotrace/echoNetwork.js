/*
 * MULTIPLAYER INTEGRATION POINT. Nothing here is implemented: these are placeholders.
 * Connect them to your real transport (WebSocket, Supabase realtime, Firebase, ...).
 * Pass the object to <EchoTrace mode="online" network={...} />.
 *
 * Important for fairness: the SERVER must hold the real board and validate moves.
 * Never send the opponent's piece positions to the client. Send only:
 *   - the opponent move { from, to, promotion } AFTER the server accepted it
 *     (the client only uses it for footprints/sound, never to draw the piece),
 *   - accept / reject results for your own attempts.
 */
export function createEchoNetwork() {
  const notImplemented = (name) => console.warn(`[echoNetwork] ${name} is not implemented yet.`);
  return {
    /** Join or create a match. Should resolve with { matchId, playerColor }. */
    async joinMatch(/* matchId */) { notImplemented("joinMatch"); return null; },
    /** Send a move attempt to the server. */
    sendMove(/* { from, to, promotion } */) { notImplemented("sendMove"); },
    /** Subscribe to opponent moves. Must return an unsubscribe function. */
    onOpponentMove(/* callback({ from, to, promotion }) */) { notImplemented("onOpponentMove"); return () => {}; },
    sendResign() { notImplemented("sendResign"); },
    disconnect() { notImplemented("disconnect"); },
  };
}