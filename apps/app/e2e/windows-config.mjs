// Writes a Tauri config override that opens WebView2's DevTools port, for the Windows E2E build.
//
//   node e2e/windows-config.mjs <output.json>
//   tauri build --no-bundle --config <output.json>
//
// WebView2 ignores WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS and the registry policy when the host
// app passes its own browser arguments (wry always does), so the port has to be requested in the
// window config itself. `--config` merges with JSON Merge Patch, which replaces arrays wholesale,
// so the real window definitions are copied from tauri.conf.json instead of restated here.
//
// The result is the shipped app plus one extra browser flag. Never distribute a build made this way.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const output = process.argv[2];
if (!output) {
  console.error("usage: node windows-config.mjs <output.json>");
  process.exit(2);
}

const port = process.env.E2E_CDP_PORT ?? "9222";
const configPath = join(dirname(fileURLToPath(import.meta.url)), "../src-tauri/tauri.conf.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

// wry's own defaults, which apply only when no additional arguments are given.
const defaults = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

const windows = config.app.windows.map((window) => ({
  ...window,
  additionalBrowserArgs: `${defaults} --remote-debugging-port=${port} --remote-allow-origins=*`,
}));

writeFileSync(output, JSON.stringify({ app: { windows } }, null, 2));
console.log(`wrote ${output} (${windows.length} window(s), DevTools port ${port})`);
