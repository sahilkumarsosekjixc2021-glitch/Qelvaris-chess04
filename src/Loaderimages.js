/* =====================================================================
   LOADER IMAGES: har page ki loading image yahin se badalti hai.

   Kaise badlein:
   1. Nayi image ko src/assets/ folder mein rakho.
   2. Neeche us page wali line mein sirf file ka naam badlo.
      Jaise Review ke liye:
        import reviewImg from "./assets/review-rook.jpg";

   Image ke liye 2 baatein:
   - Background kaala ho (ya transparent). Loader "screen blend" use karta hai,
     isliye kaala hissa gayab ho jata hai.
   - Cheez beech mein ho (kinare halke fade hote hain).
   Size ka ratio apne aap pehchan liya jata hai, koi setting nahi chahiye.

   File ka naam bilkul sahi likhna (chhota-bada akshar bhi), warna error aayega.
===================================================================== */

import defaultImg from "./assets/glass-king.jpg"; // jis page ki line nahi hai, wahan ye aayegi

import todayImg from "./assets/glass-king.jpg";
import dnaImg from "./assets/horse.jpg"; // ye public mein hai, src mein nahi
import reviewImg from "./assets/review-rook.jpg";
import leaklabImg from "./assets/leaklab-bishop.jpg";
import practiceImg from "./assets/leaklab-bishop.jpg";
import playImg from "./assets/queen-clear.webp"; // ye public mein hai, src mein nahi
import openingsImg from "./assets/pawn-loading.webp";
import gamesImg from "./assets/games-board-clear.webp";
import settingsImg from "./assets/glass-king.jpg";

export const LOADER_IMAGES = {
  default: defaultImg,
  today: todayImg,
  dna: dnaImg,
  review: reviewImg,
  leaklab: leaklabImg,
  practice: practiceImg,
  play: playImg,
  openings: openingsImg,
  games: gamesImg,
  settings: settingsImg,
};