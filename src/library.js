import { dbAll, dbPut } from "./storage";
import { summarize } from "./chessUtils";

/*
  Games aur reviews ek hi jagah se save hote hain.
  games store:   ek game ka card (naam, result, accuracy, source ...)
  reviews store: har move ka label aur eval. FEN save nahi hote, wo PGN se dobara ban jaate hain.
*/

export function makeGameRecord(parsed, { id, source, date, userColor, opening }) {
  return {
    id,
    source,
    date: date || new Date().toISOString(),
    userColor,
    pgn: parsed.pgn,
    result: parsed.result,
    white: parsed.headers.White || "White",
    black: parsed.headers.Black || "Black",
    opening: opening || parsed.opening || "",
    event: parsed.headers.Event || "",
    moves: parsed.moves.length,
    reviewed: false,
    analysisComplete: false,
  };
}

export async function saveReviewedGame({ game, parsed, moves, depth }) {
  const summary = summarize(moves);

  const record = {
    ...game,
    moves: parsed.moves.length,
    reviewed: true,
    analysisComplete: true,
    accuracy: summary.acc,
  };

  await dbPut("games", record);
  await dbPut("reviews", { gameId: game.id, depth, moves, accuracy: summary.acc, counts: summary.counts });

  return record;
}

export function listGames() {
  return dbAll("games");
}