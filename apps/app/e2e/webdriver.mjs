// Minimal W3C WebDriver client for driving the real Pupil desktop window through
// `tauri-driver`. It talks plain HTTP so the suite needs no npm dependencies and
// behaves identically on Linux (WebKitWebDriver) and Windows (msedgedriver).

const DRIVER_URL = process.env.TAURI_DRIVER_URL ?? "http://127.0.0.1:4444";
const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

async function call(method, path, body) {
  const response = await fetch(`${DRIVER_URL}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    // Some drivers (WebKitWebDriver) reject POST commands that carry no JSON body at all.
    body:
      body === undefined && method === "POST"
        ? "{}"
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    const detail = payload.value?.message ?? JSON.stringify(payload);
    throw new Error(`${method} ${path} failed: ${detail}`);
  }
  return payload.value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(description, probe, { timeout = 15_000, interval = 150 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(
    `Timed out after ${timeout}ms waiting for ${description}${lastError ? ` (${lastError.message})` : ""}`,
  );
}

export async function startSession(application) {
  const value = await call("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "wry",
        "tauri:options": { application },
      },
    },
  });
  return new Session(value.sessionId);
}

export class Session {
  constructor(id) {
    this.id = id;
  }

  #path(suffix) {
    return `/session/${this.id}${suffix}`;
  }

  execute(script, args = []) {
    return call("POST", this.#path("/execute/sync"), { script, args });
  }

  async find(selector) {
    const element = await call("POST", this.#path("/element"), {
      using: "css selector",
      value: selector,
    });
    return new Element(this, element[ELEMENT_KEY]);
  }

  async findAll(selector) {
    const elements = await call("POST", this.#path("/elements"), {
      using: "css selector",
      value: selector,
    });
    return elements.map((element) => new Element(this, element[ELEMENT_KEY]));
  }

  // Finds the first element matching `selector` whose visible text matches `text`.
  // Text matching runs in the page so it sees exactly what the user sees.
  async findByText(selector, text, { exact = false } = {}) {
    const found = await this.execute(
      `const [selector, text, exact] = arguments;
       const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
       return Array.from(document.querySelectorAll(selector)).find((el) => {
         if (!visible(el)) return false;
         const content = (el.innerText || el.getAttribute("aria-label") || "").trim();
         return exact ? content === text : content.toLowerCase().includes(text.toLowerCase());
       }) ?? null;`,
      [selector, text, exact],
    );
    return found ? new Element(this, found[ELEMENT_KEY]) : null;
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
    return this.execute("return document.body.innerText");
  }

  async screenshot(file) {
    const { writeFile } = await import("node:fs/promises");
    const base64 = await call("GET", this.#path("/screenshot"));
    await writeFile(file, Buffer.from(base64, "base64"));
  }

  async windowRect() {
    return call("GET", this.#path("/window/rect"));
  }

  async setWindowRect(rect) {
    return call("POST", this.#path("/window/rect"), rect);
  }

  // Sends raw keystrokes to whatever currently has focus.
  async sendKeys(text) {
    const actions = [...text].flatMap((char) => [
      { type: "keyDown", value: char },
      { type: "keyUp", value: char },
    ]);
    await call("POST", this.#path("/actions"), {
      actions: [{ type: "key", id: "keyboard", actions }],
    });
    await call("DELETE", this.#path("/actions"));
  }

  async end() {
    await call("DELETE", this.#path(""));
  }
}

export class Element {
  constructor(session, id) {
    this.session = session;
    this.id = id;
  }

  #path(suffix) {
    return `/session/${this.session.id}/element/${this.id}${suffix}`;
  }

  click() {
    return call("POST", this.#path("/click"));
  }

  clear() {
    return call("POST", this.#path("/clear"));
  }

  type(text) {
    return call("POST", this.#path("/value"), { text });
  }

  text() {
    return call("GET", this.#path("/text"));
  }

  isDisplayed() {
    return call("GET", this.#path("/displayed"));
  }

  attribute(name) {
    return call("GET", this.#path(`/attribute/${name}`));
  }
}
