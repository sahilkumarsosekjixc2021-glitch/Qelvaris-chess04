// Web worker wrapper: built-in engine ko UCI string messages se chalata hai.
import { createEngine } from "./fallbackEngineCore";

const engine = createEngine((text) => self.postMessage(text));

self.onmessage = (event) => {
  engine.handle(String(event.data));
};
