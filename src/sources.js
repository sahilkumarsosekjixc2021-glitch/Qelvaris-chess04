/*
  Games kahan se aati hain: Lichess, Chess.com ya PGN file.
  Har function ek list deta hai: { id, source, date, text }  (text = ek game ka PGN)
*/

export class SourceError extends Error {}

export function tagOf(text, name) {
  const match = String(text).match(new RegExp(`\\[${name} "([^"]*)"\\]`));
  return match ? match[1] : "";
}

// Ek file mein kai games ho sakte hain
export function splitPgn(text) {
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  return clean.split(/\n\s*\n(?=\[Event\s)/).map((game) => game.trim()).filter(Boolean);
}

function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function isoFromTags(text) {
  const day = tagOf(text, "UTCDate") || tagOf(text, "Date");
  if (!day || day.includes("?")) return null;

  const time = tagOf(text, "UTCTime") || "00:00:00";
  const date = new Date(`${day.replace(/\./g, "-")}T${time}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// username kis side par khela, PGN ke naam se pata chalta hai
export function colorFor(headers, username) {
  const name = String(username || "").trim().toLowerCase();
  if (!name) return "w";
  if (String(headers.White || "").toLowerCase() === name) return "w";
  if (String(headers.Black || "").toLowerCase() === name) return "b";
  return "w";
}

async function request(url, options, label) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new SourceError(
      `Could not reach ${label} from the browser. Check your connection and try again, or upload a PGN instead.`
    );
  }

  if (response.status === 404) throw new SourceError(`We could not find that username on ${label}.`);
  if (response.status === 429) throw new SourceError(`${label} asked us to slow down. Wait a minute and try again.`);
  if (!response.ok) throw new SourceError(`${label} returned an error (${response.status}). Try again later.`);

  return response;
}

export async function fetchLichessGames(username, { max = 30, signal } = {}) {
  const name = String(username || "").trim();
  if (!name) throw new SourceError("Type your Lichess username first.");

  const url =
    `https://lichess.org/api/games/user/${encodeURIComponent(name)}` +
    `?max=${max}&clocks=true&opening=true&perfType=bullet,blitz,rapid,classical`;

  const response = await request(url, { headers: { Accept: "application/x-chess-pgn" }, signal }, "Lichess");
  const text = await response.text();

  return splitPgn(text)
    .filter((game) => {
      const variant = tagOf(game, "Variant");
      return !variant || variant === "Standard";
    })
    .map((game) => {
      const gameId = tagOf(game, "Site").split("/").pop() || hash(game);
      return { id: `lichess-${gameId}`, source: "lichess", date: isoFromTags(game), text: game };
    });
}

export async function fetchChessComGames(username, { max = 30, signal } = {}) {
  const name = String(username || "").trim().toLowerCase();
  if (!name) throw new SourceError("Type your Chess.com username first.");

  const base = `https://api.chess.com/pub/player/${encodeURIComponent(name)}`;
  const archivesResponse = await request(`${base}/games/archives`, { signal }, "Chess.com");
  const archives = (await archivesResponse.json()).archives || [];

  const out = [];

  for (const url of [...archives].reverse()) {
    if (out.length >= max) break;

    const monthResponse = await request(url, { signal }, "Chess.com");
    const games = ((await monthResponse.json()).games || []).reverse();

    for (const game of games) {
      if (out.length >= max) break;
      if (game.rules !== "chess" || !game.pgn) continue;

      out.push({
        id: `chesscom-${String(game.url || "").split("/").pop() || hash(game.pgn)}`,
        source: "chesscom",
        date: game.end_time ? new Date(game.end_time * 1000).toISOString() : isoFromTags(game.pgn),
        text: game.pgn,
      });
    }
  }

  return out;
}

export function gamesFromPgn(text) {
  return splitPgn(text).map((game) => ({
    id: `pgn-${hash(game)}`,
    source: "pgn",
    date: isoFromTags(game),
    text: game,
  }));
}