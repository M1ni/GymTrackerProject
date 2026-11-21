// Lets the unit tests run our website code in Node (no browser):
// 1. The Firebase links (https://www.gstatic.com/firebasejs/...) load the stand-in in fake-firebase/.
// 2. Node has no localStorage, so we give it a simple one.
import { register } from "node:module";

const FAKE = new URL("./fake-firebase/", import.meta.url).href;

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        const match = specifier.match(/^https:\\/\\/www\\.gstatic\\.com\\/firebasejs\\/[^/]+\\/(.+)$/);
        if (match) {
          return { url: ${JSON.stringify(FAKE)} + match[1], shortCircuit: true };
        }
        return next(specifier, context);
      }
    `)
);

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
  key: (index) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  }
};
