// Stand-in for Firebase's firebase-app.js, used only by the tests.
export function initializeApp(config) {
  if (!config || !config.apiKey) {
    throw new Error("initializeApp needs the config from firebase-config.js");
  }
  return { options: config };
}
