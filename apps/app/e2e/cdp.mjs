// Chrome DevTools Protocol backend with the same surface as webdriver.mjs.
//
// WebView2 (the Windows webview) speaks CDP natively, so a build that opens a remote debugging
// port can be driven directly, with no msedgedriver/tauri-driver version handshake to keep in sync.
// WebView2 will not accept the port from an environment variable or the registry when the host app
// passes its own browser arguments, so the build under test must request it in its window config
// (`additionalBrowserArgs`); e2e/windows-config.mjs generates that override.
//
// Input goes through Input.dispatch* so clicks and keystrokes are real browser input events,
// and a click on something that is covered (for example by the launch overlay) fails
// instead of silently reaching the element underneath.

import { execFileSync, spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { waitFor } from "./webdriver.mjs";

export { waitFor };

const DEFAULT_PORT = Number(process.env.E2E_CDP_PORT ?? 9222);
const SPECIAL_KEYS = {
  "\n": { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
  "": { key: "Backspace", code: "Backspace", keyCode: 8 },
  "": { key: "Escape", code: "Escape", keyCode: 27 },
  "": { key: "Tab", code: "Tab", keyCode: 9 },
};

function keyDescriptor(char) {
  if (SPECIAL_KEYS[char]) return SPECIAL_KEYS[char];
  if (char === " ") return { key: " ", code: "Space", keyCode: 32, text: " " };
  if (/[a-z]/i.test(char)) {
    return {
      key: char,
      code: `Key${char.toUpperCase()}`,
      keyCode: char.toUpperCase().charCodeAt(0),
      text: char,
    };
  }
  if (/\d/.test(char))
    return { key: char, code: `Digit${char}`, keyCode: char.charCodeAt(0), text: char };
  return { key: char, code: "", keyCode: char.charCodeAt(0), text: char };
}

class CdpConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const waiter of this.pending.values())
        waiter.reject(new Error("DevTools connection closed"));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

const HELPERS = `
  window.__e2e ??= { seq: 0, map: new Map() };
  const register = (el) => { if (!el) return null; const id = ++window.__e2e.seq; window.__e2e.map.set(id, el); return id; };
  const lookup = (id) => {
    const el = window.__e2e.map.get(id);
    if (!el || !el.isConnected) throw new Error("stale element reference");
    return el;
  };
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
`;

export async function connect(port = DEFAULT_PORT, child) {
  const target = await waitFor(
    `the DevTools endpoint on port ${port}`,
    async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      return targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
    },
    { timeout: 60_000, interval: 500 },
  );
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("could not open the DevTools socket")),
      { once: true },
    );
  });
  const connection = new CdpConnection(socket);
  await connection.send("Runtime.enable");
  await connection.send("Page.enable");
  return new Session(connection, child);
}

export async function startSession(application, { port = DEFAULT_PORT, args = [] } = {}) {
  const env = {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
  };
  const child = spawn(application, args, { env, stdio: "ignore" });
  child.on("error", (error) => console.error(`could not start ${application}: ${error.message}`));
  try {
    return await connect(port, child);
  } catch (error) {
    killTree(child);
    throw error;
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGKILL");
    }
  } catch {}
}

export class Session {
  constructor(connection, child) {
    this.connection = connection;
    this.child = child;
    this.id = "cdp";
  }

  async evaluate(source, args = []) {
    const expression = `(() => { ${HELPERS}
      const args = ${JSON.stringify(args)};
      return (function () { ${source} }).apply(null, args); })()`;
    const { result, exceptionDetails } = await this.connection.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result.value;
  }

  execute(script, args = []) {
    return this.evaluate(script, args);
  }

  async find(selector) {
    const id = await this.evaluate("return register(document.querySelector(arguments[0]));", [
      selector,
    ]);
    if (id === null) throw new Error(`no such element: ${selector}`);
    return new Element(this, id);
  }

  async findAll(selector) {
    const ids = await this.evaluate(
      "return Array.from(document.querySelectorAll(arguments[0])).map(register);",
      [selector],
    );
    return ids.map((id) => new Element(this, id));
  }

  async findByText(selector, text, { exact = false } = {}) {
    const id = await this.evaluate(
      `const [selector, text, exact] = arguments;
       return register(Array.from(document.querySelectorAll(selector)).find((el) => {
         if (!visible(el)) return false;
         const content = (el.innerText || el.getAttribute("aria-label") || "").trim();
         return exact ? content === text : content.toLowerCase().includes(text.toLowerCase());
       }) ?? null);`,
      [selector, text, exact],
    );
    return id === null ? null : new Element(this, id);
  }

  waitForText(selector, text, options) {
    return waitFor(
      `${selector} containing "${text}"`,
      () => this.findByText(selector, text, options),
      options,
    );
  }

  waitForSelector(selector, options) {
    return waitFor(
      `selector ${selector}`,
      async () => {
        const element = await this.find(selector);
        return (await element.isDisplayed()) ? element : null;
      },
      options,
    );
  }

  bodyText() {
    return this.evaluate("return document.body.innerText;");
  }

  async screenshot(file) {
    const { data } = await this.connection.send("Page.captureScreenshot", { format: "png" });
    await writeFile(file, Buffer.from(data, "base64"));
  }

  async pressKey(char) {
    const { key, code, keyCode, text } = keyDescriptor(char);
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await this.connection.send("Input.dispatchKeyEvent", {
      type: text ? "keyDown" : "rawKeyDown",
      text,
      ...base,
    });
    await this.connection.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  }

  async sendKeys(text) {
    for (const char of text) await this.pressKey(char);
  }

  async end() {
    try {
      this.connection.socket.close();
    } catch {}
    if (this.child) {
      const exited = new Promise((resolve) => this.child.once("exit", resolve));
      killTree(this.child);
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    }
  }
}

export class Element {
  constructor(session, id) {
    this.session = session;
    this.id = id;
  }

  run(body, args = []) {
    return this.session.evaluate(`const el = lookup(${this.id}); ${body}`, args);
  }

  async click() {
    const point = await this.run(`
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) {
        throw new Error("click intercepted by <" + (hit ? hit.tagName.toLowerCase() : "nothing") + ">");
      }
      return { x, y };`);
    const { connection } = this.session;
    await connection.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await connection.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...point,
      button: "left",
      clickCount: 1,
    });
    await connection.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...point,
      button: "left",
      clickCount: 1,
    });
  }

  async type(text) {
    await this.run("el.focus();");
    await this.session.sendKeys(text);
  }

  async clear() {
    await this.run("el.focus(); if (el.select) el.select();");
    await this.session.pressKey("");
  }

  text() {
    return this.run("return el.innerText;");
  }

  isDisplayed() {
    return this.run("return visible(el);");
  }

  attribute(name) {
    return this.run(
      "const name = arguments[0]; return typeof el[name] === 'string' ? el[name] : el.getAttribute(name);",
      [name],
    );
  }
}
