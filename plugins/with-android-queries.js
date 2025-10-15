// plugins/with-android-queries.js
const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Adiciona <queries> ao AndroidManifest para permitir resolução de intents
 * e visibilidade dos pacotes do WhatsApp (normal e Business).
 */
module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest.queries) manifest.queries = [{}];
    const queries = manifest.queries[0];

    // Permite intents para whatsapp/http/https
    queries.intent = queries.intent || [];
    const addIntent = (scheme) => {
      queries.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": scheme } }]
      });
    };
    ["whatsapp", "http", "https"].forEach(addIntent);

    // Visibilidade explícita dos pacotes (WhatsApp normal e Business)
    queries.package = queries.package || [];
    ["com.whatsapp", "com.whatsapp.w4b"].forEach((pkg) => {
      if (!queries.package.find((p) => p.$["android:name"] === pkg)) {
        queries.package.push({ $: { "android:name": pkg } });
      }
    });

    return cfg;
  });
};
