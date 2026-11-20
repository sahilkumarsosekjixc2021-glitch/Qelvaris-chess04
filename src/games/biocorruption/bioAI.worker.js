/* BioCorruption AI worker: bhaari search main thread ko freeze na kare. */
import { chooseBioMove } from "./bioAI.js";

self.onmessage = (event) => {
  const { state, level } = event.data;
  let move = null;

  try {
    move = chooseBioMove(state, level);
  } catch (error) {
    console.error("BioCorruption AI worker:", error);
  }

  self.postMessage({ move });
};