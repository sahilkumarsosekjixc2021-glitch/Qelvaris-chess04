// Qelvaris Explore — jo openings explorer mein khul sakti hain.
// Nayi opening: openings/ mein file banao ({id,name,side,trunk,overview,tree}), yahan jodo,
// library/openingCatalog.js mein ready: true karo, aur `node verifyOpenings.mjs` chalao.

import { ITALIAN_ID, ITALIAN_OVERVIEW, ITALIAN_TREE, ITALIAN_TRUNK } from "./openingTree";
import { LONDON } from "./openings/london";
import { CARO_KANN } from "./openings/caroKann";
import { RUY_LOPEZ } from "./openings/ruyLopez";
import { SCOTCH } from "./openings/scotch";
import { QUEENS_GAMBIT } from "./openings/queensGambit";
import { ENGLISH } from "./openings/english";
import { VIENNA } from "./openings/vienna";
import { SICILIAN } from "./openings/sicilian";
import { FRENCH } from "./openings/french";
import { SCANDINAVIAN } from "./openings/scandinavian";
import { PETROV } from "./openings/petrov";
import { SLAV } from "./openings/slav";
import { KINGS_INDIAN } from "./openings/kingsIndian";
import { FOUR_KNIGHTS } from "./openings/fourKnights";
import { KINGS_GAMBIT } from "./openings/kingsGambit";
import { PHILIDOR } from "./openings/philidor";
import { MODERN } from "./openings/modernDefence";
import { PIRC } from "./openings/pirc";
import { ALEKHINE } from "./openings/alekhine";
import { STONEWALL } from "./openings/stonewall";
import { CATALAN } from "./openings/catalan";
import { QGD } from "./openings/queensGambitDeclined";
import { DUTCH } from "./openings/dutch";
import { NIMZO } from "./openings/nimzoIndian";
import { GRUNFELD } from "./openings/grunfeld";
import { BENONI } from "./openings/benoni";
import { BENKO } from "./openings/benko";
import { RETI } from "./openings/reti";
import { BIRD } from "./openings/bird";

const ITALIAN = {
  id: ITALIAN_ID,
  name: "Italian Game",
  side: "White",
  trunk: ITALIAN_TRUNK,
  overview: ITALIAN_OVERVIEW,
  tree: ITALIAN_TREE,
};

export const OPENING_DEFS = [
  ITALIAN,
  LONDON,
  CARO_KANN,
  RUY_LOPEZ,
  SCOTCH,
  QUEENS_GAMBIT,
  ENGLISH,
  VIENNA,
  SICILIAN,
  FRENCH,
  SCANDINAVIAN,
  PETROV,
  SLAV,
  KINGS_INDIAN,
  FOUR_KNIGHTS,
  KINGS_GAMBIT,
  PHILIDOR,
  MODERN,
  PIRC,
  ALEKHINE,
  STONEWALL,
  CATALAN,
  QGD,
  DUTCH,
  NIMZO,
  GRUNFELD,
  BENONI,
  BENKO,
  RETI,
  BIRD,
];

export function getOpeningDef(name) {
  return OPENING_DEFS.find((def) => def.name === name) || null;
}

export const READY_NAMES = OPENING_DEFS.map((def) => def.name);
