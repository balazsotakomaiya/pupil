// End-to-end smoke test that drives the real Pupil desktop window.
//
//   PUPIL_BIN=/path/to/pupil-app node e2e/smoke.mjs
//
// It launches the built binary, clicks through the main
// flows (first run, create space, add cards, browse, study, settings, export),
// quits the app, relaunches it against the same data, and checks that
// everything survived - including after the process is killed abruptly.
//
// Two backends drive the window, both through ./webdriver.mjs-shaped sessions:
//   webdriver (default)  tauri-driver + the platform WebDriver; used on Linux (WebKitWebDriver)
//   cdp                  Chrome DevTools Protocol straight into WebView2; used on Windows
//
// Environment:
//   PUPIL_BIN        path to the built app binary (required)
//   E2E_BACKEND      "webdriver" (default) or "cdp"
//   E2E_OUT          directory for screenshots and report.json (default ./e2e-out)
//   TAURI_DRIVER     tauri-driver executable (default "tauri-driver")
//   NATIVE_DRIVER    WebDriver the tauri-driver should wrap, if it cannot find one itself

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const useDriverProcess = process.env.E2E_BACKEND !== "cdp";
const { startSession, waitFor } = await import(useDriverProcess ? "./webdriver.mjs" : "./cdp.mjs");

const binary = process.env.PUPIL_BIN;
if (!binary) {
  console.error("PUPIL_BIN must point at the built Pupil binary");
  process.exit(2);
}
const outDir = resolve(process.env.E2E_OUT ?? "e2e-out");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const SPACE = "E2E Geography";
const CARDS = [
  { front: "Capital of France?", back: "Paris", tag: "europe" },
  { front: "Capital of Japan?", back: "Tokyo", tag: "asia" },
];

const results = [];
let session;
let shots = 0;

async function shot(label) {
  if (!session) return;
  const file = join(
    outDir,
    `${String(++shots).padStart(2, "0")}-${label.replace(/\W+/g, "-").toLowerCase()}.png`,
  );
  try {
    await session.screenshot(file);
  } catch {
    // The window may already be gone; a missing screenshot must not mask the real failure.
  }
}

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  PASS  ${name} (${Date.now() - started}ms)`);
    await shot(name);
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, error: error.message });
    console.log(`  FAIL  ${name}\n        ${error.message}`);
    await shot(`FAILED-${name}`);
    try {
      const text = (await session.bodyText()).replace(/\s+/g, " ").slice(0, 300);
      console.log(`        page text: ${text}`);
    } catch {}
  }
}

const clickText = async (selector, text, options) => {
  const element = await session.waitForText(selector, text, options);
  await element.click();
};

const bodyIncludes = (text) =>
  waitFor(`page to contain "${text}"`, async () => (await session.bodyText()).includes(text));

const bodyExcludes = (text) =>
  waitFor(
    `page to stop containing "${text}"`,
    async () => !(await session.bodyText()).includes(text),
  );

async function waitForShell() {
  // The launch overlay swallows clicks for ~2s; nothing is interactive until it is gone.
  await waitFor("launch screen to appear or app shell to render", async () =>
    session.execute(
      "return !!document.querySelector('[data-testid=launch-screen]') || !!document.querySelector('main')",
    ),
  );
  await waitFor(
    "launch screen to disappear",
    async () => session.execute("return !document.querySelector('[data-testid=launch-screen]')"),
    { timeout: 30_000 },
  );
}

// tauri-driver launches the app when a session starts and kills it when the session ends.
let driver;
async function stopDriver() {
  if (!driver) return;
  const exited = new Promise((resolveExit) => driver.once("exit", resolveExit));
  if (process.platform === "win32") {
    // tauri-driver spawns msedgedriver; kill the whole tree so the next driver can bind its port.
    try {
      execFileSync("taskkill", ["/PID", String(driver.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
  } else {
    driver.kill();
  }
  await exited;
  driver = undefined;
}

async function startDriver() {
  if (!useDriverProcess) return;
  const args = process.env.NATIVE_DRIVER ? ["--native-driver", process.env.NATIVE_DRIVER] : [];
  driver = spawn(process.env.TAURI_DRIVER ?? "tauri-driver", args, {
    stdio: ["ignore", "inherit", "inherit"],
  });
  driver.on("error", (error) => {
    console.error(`could not start tauri-driver: ${error.message}`);
    process.exit(2);
  });
  await waitFor(
    "tauri-driver to accept connections",
    async () => (await fetch("http://127.0.0.1:4444/status")).ok,
    { timeout: 30_000, interval: 500 },
  );
}

async function launch() {
  session = await startSession(binary);
  await waitForShell();
}

async function quit() {
  try {
    await session.end();
  } catch {}
  session = undefined;
  // Give the OS a moment to release SQLite/WebView file handles before the relaunch.
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
}

function killAppHard() {
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/F", "/T", "/IM", "pupil-app.exe"]);
  } else {
    execFileSync("pkill", ["-9", "-x", "pupil-app"]);
  }
}

async function addCard({ front, back, tag }) {
  await session.waitForSelector("textarea[placeholder^='A clear']");
  await (await session.find("textarea[placeholder^='A clear']")).type(front);
  await (await session.find("textarea[placeholder^='A direct']")).type(back);
  await (await session.find("input[placeholder='Add tag...']")).type(`${tag}\n`);
  await clickText("[role=dialog] button", "Save card");
  await bodyIncludes("Card saved");
  // "Make another" is on by default, so the dialog stays open with cleared fields.
  await waitFor(
    "card form to reset",
    async () =>
      (await (await session.find("textarea[placeholder^='A clear']")).attribute("value")) !== front,
  );
}

// The export status line names the file it wrote; the test shares a machine with the app, so check it.
async function expectExportedFile(pattern) {
  const match = (await session.bodyText()).match(pattern);
  if (!match) throw new Error(`no exported file path shown (looked for ${pattern})`);
  if (!existsSync(match[0]) || statSync(match[0]).size === 0)
    throw new Error(`exported file missing or empty: ${match[0]}`);
}

const closeDialog = () => clickText("[role=dialog] button", "Discard");

// ---------------------------------------------------------------------------

console.log("Phase 1: fresh profile");
await startDriver();

try {
  await launch();

  await step("first run shows onboarding and detects platform", async () => {
    await bodyIncludes("Create a space");
    const { platform, runtime } = await session.execute(
      "return { platform: document.documentElement.dataset.platform, runtime: document.documentElement.dataset.runtime }",
    );
    console.log(`        platform=${platform} runtime=${runtime}`);
    if (runtime !== "tauri") throw new Error(`expected runtime=tauri, got ${runtime}`);
  });

  await step("create a space from onboarding", async () => {
    await clickText("button", "Create a space");
    await session.waitForSelector("[role=dialog] input");
    await (await session.find("[role=dialog] input")).type(SPACE);
    await clickText("[role=dialog] button", "Create Space");
    await bodyIncludes("Space created");
    await bodyIncludes(SPACE);
  });

  await step("add two cards manually", async () => {
    await clickText("button", "New Card", { exact: true });
    for (const card of CARDS) await addCard(card);
    await closeDialog();
    await bodyIncludes(CARDS[0].front);
    await bodyIncludes(CARDS[1].front);
  });

  await step("dashboard lists the space", async () => {
    await clickText("button", "Dashboard", { exact: true });
    await bodyIncludes("Study all");
    await bodyIncludes(SPACE);
  });

  await step("all cards lists and searches cards", async () => {
    await clickText("button", "All Cards", { exact: true });
    await bodyIncludes(CARDS[0].front);
    await bodyIncludes(CARDS[1].front);
    await (await session.find("input[placeholder^='Search cards']")).type("japan");
    await bodyExcludes(CARDS[0].front);
    await bodyIncludes(CARDS[1].front);
    // WebDriver's clear() skips the input event React listens for, so erase like a user would.
    await (await session.find("input[placeholder^='Search cards']")).type(
      "\uE003".repeat("japan".length),
    );
    await bodyIncludes(CARDS[0].front);
  });

  await step("command palette finds the space", async () => {
    await (await session.find("button[aria-label='Search']")).click();
    await session.waitForSelector("[role=dialog][aria-label='Command palette'] input");
    await (await session.find("[role=dialog][aria-label='Command palette'] input")).type("geog");
    await waitFor("palette to list the space", async () =>
      session.findByText("[role=dialog][aria-label='Command palette'] *", SPACE),
    );
    await session.sendKeys(""); // Escape
    await waitFor(
      "palette to close",
      async () =>
        !(await session.find("[role=dialog][aria-label='Command palette']").catch(() => null)),
    );
  });

  await step("study every due card", async () => {
    await clickText("button", "Dashboard", { exact: true });
    await clickText("button", "Study all");
    for (const grade of ["Good", "Easy"]) {
      await clickText("button", "Show answer");
      await clickText("button", grade);
    }
    await bodyIncludes("Session complete");
    await clickText("button", "Back to dashboard");
    await bodyIncludes("Study all");
  });

  await step("nothing is due after studying everything", async () => {
    await clickText("button", "Study all");
    await bodyIncludes("No cards due");
    await clickText("button", "Back to dashboard");
  });

  await step("settings: switch theme", async () => {
    await clickText("button", "Settings", { exact: true });
    await clickText("button", "White");
    await waitFor("theme to change", async () =>
      session.execute("return document.documentElement.dataset.theme === 'light'"),
    );
  });

  await step("settings: every tab renders", async () => {
    for (const tab of ["AI Provider", "Data", "About", "General"]) {
      await clickText("[role=tab]", tab);
      await waitFor(`${tab} panel`, async () =>
        session.execute(
          "const t=[...document.querySelectorAll('[role=tab]')].find(e=>e.innerText.trim()===arguments[0]); return t && t.getAttribute('aria-selected')==='true'",
          [tab],
        ),
      );
    }
  });

  await step("settings: export collection and review history", async () => {
    await clickText("[role=tab]", "Data");
    await clickText("button", "Export", { exact: true });
    await bodyIncludes("Collection exported");
    await expectExportedFile(/[^\s"']*pupil-export-\d+\.db/);
    await clickText("button", "Export CSV");
    await bodyIncludes("Review logs exported");
    await expectExportedFile(/[^\s"']*pupil-review-logs-\d+\.csv/);
  });

  await step("AI key is stored in the OS keystore", async () => {
    await clickText("[role=tab]", "AI Provider");
    await (await session.waitForSelector("#settings-api-key")).type("sk-e2e-not-a-real-key");
    await clickText("button", "Save settings");
    await waitFor("key to be stored", async () => {
      const bodyText = await session.bodyText();
      if (bodyText.includes("Save failed")) {
        const detail = bodyText
          .slice(bodyText.indexOf("Save failed"), bodyText.indexOf("Save failed") + 160)
          .replace(/\s+/g, " ");
        throw new Error(`saving the key failed: ${detail}`);
      }
      return (await (await session.find("#settings-api-key")).attribute("placeholder")).startsWith(
        "Stored",
      );
    });
  });

  await quit();

  console.log("Phase 2: clean restart, same data");
  await launch();

  await step("restart skips onboarding and restores data", async () => {
    await bodyIncludes("Study all");
    await bodyIncludes(SPACE);
    if ((await session.bodyText()).includes("Create a space"))
      throw new Error("onboarding shown again after restart");
  });

  await step("restart restores cards and review progress", async () => {
    await clickText("button", "All Cards", { exact: true });
    await bodyIncludes(CARDS[0].front);
    await bodyIncludes(CARDS[1].front);
    await clickText("button", "Dashboard", { exact: true });
    await clickText("button", "Study all");
    await bodyIncludes("No cards due");
    await clickText("button", "Back to dashboard");
  });

  await step("restart restores theme preference", async () => {
    const theme = await session.execute("return document.documentElement.dataset.theme");
    if (theme !== "light") throw new Error(`theme reverted to ${theme}`);
  });

  await step("AI key is still stored after restart", async () => {
    await clickText("button", "Settings", { exact: true });
    await clickText("[role=tab]", "AI Provider");
    const placeholder = await (await session.waitForSelector("#settings-api-key")).attribute(
      "placeholder",
    );
    if (!placeholder.startsWith("Stored")) throw new Error(`key field says "${placeholder}"`);
    await clickText("button", "Dashboard", { exact: true });
  });

  await step("can write new data after restart", async () => {
    await clickText("button", "New Card", { exact: true });
    await addCard({ front: "Capital of Peru?", back: "Lima", tag: "americas" });
    await closeDialog();
    await clickText("button", "All Cards", { exact: true });
    await bodyIncludes("Capital of Peru?");
  });

  await step("new card is due and can be studied", async () => {
    await clickText("button", "Dashboard", { exact: true });
    await clickText("button", "Study all");
    await clickText("button", "Show answer");
    await bodyIncludes("Lima");
    await clickText("button", "Good");
    await bodyIncludes("Session complete");
    await clickText("button", "Back to dashboard");
  });

  console.log("Phase 3: abrupt kill, then relaunch");
  killAppHard();
  session = undefined;
  // The killed app leaves a dangling WebDriver session behind, so start a fresh driver.
  await stopDriver();
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
  await startDriver();
  await launch();

  await step("data survives the process being killed", async () => {
    await bodyIncludes(SPACE);
    await clickText("button", "All Cards", { exact: true });
    for (const front of [...CARDS.map((card) => card.front), "Capital of Peru?"])
      await bodyIncludes(front);
  });

  await step("reset wipes the data and returns to first run", async () => {
    await clickText("button", "Settings", { exact: true });
    await clickText("[role=tab]", "Data");
    await session.execute("window.confirm = () => true;");
    await clickText("button", "Reset", { exact: true });
    // A successful reset empties the collection, which sends the app back to onboarding.
    await waitFor("reset to finish", async () => {
      const text = await session.bodyText();
      if (text.includes("Reset failed")) {
        const at = text.indexOf("Reset failed");
        throw new Error(text.slice(at, at + 200).replace(/\s+/g, " "));
      }
      return text.includes("Create a space") || text.includes("Reset complete");
    });
  });

  await step("after reset the collection and the AI key are gone", async () => {
    await clickText("button", "Just explore the app");
    await bodyIncludes("New Space");
    await bodyExcludes(SPACE);
    await clickText("button", "Settings", { exact: true });
    await clickText("[role=tab]", "AI Provider");
    const placeholder = await (await session.waitForSelector("#settings-api-key")).attribute(
      "placeholder",
    );
    if (placeholder.startsWith("Stored"))
      throw new Error("API key still marked as stored after reset");
  });
} finally {
  await quit();
  await stopDriver();
}

const failed = results.filter((result) => !result.ok);
writeFileSync(
  join(outDir, "report.json"),
  JSON.stringify({ platform: process.platform, results }, null, 2),
);
console.log(
  `\n${results.length - failed.length}/${results.length} steps passed on ${process.platform}`,
);
process.exit(failed.length ? 1 : 0);
