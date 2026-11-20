// Run in your project folder:  node verifyOpenings.mjs
// Checks every move of the opening trees (all except the Italian Game) with chess.js.
import { Chess } from "chess.js";
import { LONDON } from "./openings/london.js";
import { CARO_KANN } from "./openings/caroKann.js";
import { RUY_LOPEZ } from "./openings/ruyLopez.js";
import { SCOTCH } from "./openings/scotch.js";
import { QUEENS_GAMBIT } from "./openings/queensGambit.js";
import { ENGLISH } from "./openings/english.js";
import { VIENNA } from "./openings/vienna.js";
import { SICILIAN } from "./openings/sicilian.js";
import { FRENCH } from "./openings/french.js";
import { SCANDINAVIAN } from "./openings/scandinavian.js";
import { PETROV } from "./openings/petrov.js";
import { SLAV } from "./openings/slav.js";
import { KINGS_INDIAN } from "./openings/kingsIndian.js";
import { FOUR_KNIGHTS } from "./openings/fourKnights.js";
import { KINGS_GAMBIT } from "./openings/kingsGambit.js";
import { PHILIDOR } from "./openings/philidor.js";
import { MODERN } from "./openings/modernDefence.js";
import { PIRC } from "./openings/pirc.js";
import { ALEKHINE } from "./openings/alekhine.js";
import { STONEWALL } from "./openings/stonewall.js";
import { CATALAN } from "./openings/catalan.js";
import { QGD } from "./openings/queensGambitDeclined.js";
import { DUTCH } from "./openings/dutch.js";
import { NIMZO } from "./openings/nimzoIndian.js";
import { GRUNFELD } from "./openings/grunfeld.js";
import { BENONI } from "./openings/benoni.js";
import { BENKO } from "./openings/benko.js";
import { RETI } from "./openings/reti.js";
import { BIRD } from "./openings/bird.js";

let bad = 0;
function walk(fen, path, defs) {
  for (const def of defs) {
    const c = new Chess(fen);
    let ok = null;
    try { ok = c.move(def.san); } catch { ok = null; }
    const line = [...path, def.san].join(" ");
    if (!ok) { bad += 1; console.log("ILLEGAL:", line); continue; }
    if (def.children?.length) walk(c.fen(), [...path, def.san], def.children);
  }
}
for (const o of [LONDON, CARO_KANN, RUY_LOPEZ, SCOTCH, QUEENS_GAMBIT, ENGLISH, VIENNA, SICILIAN, FRENCH, SCANDINAVIAN, PETROV, SLAV, KINGS_INDIAN, FOUR_KNIGHTS, KINGS_GAMBIT, PHILIDOR, MODERN, PIRC, ALEKHINE, STONEWALL, CATALAN, QGD, DUTCH, NIMZO, GRUNFELD, BENONI, BENKO, RETI, BIRD]) {
  const c = new Chess();
  for (const san of o.trunk.split(" ")) c.move(san);
  walk(c.fen(), o.trunk.split(" "), o.tree);
  console.log(o.name, "checked");
}
console.log(bad ? `\n${bad} illegal` : "\nAll openings OK");
process.exit(bad ? 1 : 0);
