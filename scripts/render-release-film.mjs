#!/usr/bin/env node
/**
 * Renders the release film (apps/site/release-film.html) to video, frame by frame.
 *
 *   node scripts/render-release-film.mjs                       → docs/assets/release-film.mp4
 *   node scripts/render-release-film.mjs --out film.mp4 --fps 30 --crf 20 --workers 2
 *   node scripts/render-release-film.mjs --stills 2.5,6.4,13.8 [--out-dir stills/]  (default: OS tmpdir)
 *
 * The page exposes window.__film.seek(t); every frame is seeked and screenshotted, so the output
 * is identical no matter how fast the machine is. The version shown on screen is read from
 * apps/app/package.json.
 *
 * Requires Playwright with Chromium (resolved locally, then from the global npm root) and an
 * ffmpeg build with libx264, on PATH or given as FFMPEG=/path/to/ffmpeg.
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "apps/site");
const PAGE = "release-film.html";
const WIDTH = 1920;
const HEIGHT = 1080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

function parseArgs(argv) {
  const opts = {
    out: join(ROOT, "docs/assets/release-film.mp4"),
    fps: 60,
    crf: 22,
    stills: null,
    outDir: join(tmpdir(), "pupil-release-film-stills"),
    // Each worker is its own headless browser; leave a core for the encoder.
    workers: Math.max(1, Math.min(4, availableParallelism() - 1)),
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === "--out") opts.out = resolve(value);
    else if (flag === "--fps") opts.fps = Number(value);
    else if (flag === "--crf") opts.crf = Number(value);
    else if (flag === "--stills") opts.stills = value.split(",").map(Number);
    else if (flag === "--out-dir") opts.outDir = resolve(value);
    else if (flag === "--workers") opts.workers = Math.max(1, Number(value));
    else throw new Error(`Unknown argument: ${flag}`);
    i++;
  }
  return opts;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    return import(pathToFileURL(join(globalRoot, "playwright/index.mjs")).href);
  }
}

/** Serves apps/site so the page's relative asset paths resolve exactly as in the repo. */
function serveSite() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = join(SITE, path);
    const inside = !relative(SITE, file).startsWith(`..${sep}`);
    try {
      if (!inside || !statSync(file).isFile()) throw new Error("not found");
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

function startEncoder(opts) {
  const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
  mkdirSync(dirname(opts.out), { recursive: true });
  // PNG frames in, BT.709 H.264 out; faststart so the file streams on the web.
  const args = [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-framerate",
    String(opts.fps),
    "-c:v",
    "png",
    "-i",
    "-",
    "-vf",
    "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(opts.crf),
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-colorspace",
    "bt709",
    "-movflags",
    "+faststart",
    opts.out,
  ];
  const proc = spawn(ffmpeg, args, { stdio: ["pipe", "inherit", "inherit"] });
  const finished = new Promise((done, fail) => {
    proc.on("error", fail);
    proc.on("close", (code) => (code === 0 ? done() : fail(new Error(`ffmpeg exited ${code}`))));
  });
  const write = (buf) =>
    new Promise((done) => {
      if (proc.stdin.write(buf)) done();
      else proc.stdin.once("drain", done);
    });
  return { write, end: () => proc.stdin.end(), finished };
}

/** Opens the film in its own browser, ready to seek and capture. */
async function openFilm(chromium, url) {
  const browser = await chromium.launch({
    args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--hide-scrollbars"],
  });
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (error) => console.error(`page error: ${error.message}`));
  page.on("console", (msg) => msg.type() === "error" && console.error(`console: ${msg.text()}`));
  // Fetch web fonts from Node rather than the browser, so the render honours the host's
  // CA and proxy configuration (NODE_EXTRA_CA_CERTS etc.) the way other repo tooling does.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    await route.fulfill({ response: await route.fetch() });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const duration = await page.evaluate(async () => {
    await window.__film.ready;
    return window.__film.duration;
  });
  // CDP capture with optimizeForSpeed is still lossless PNG, but several times faster than
  // page.screenshot(), which spends most of its time in zlib.
  const cdp = await page.context().newCDPSession(page);
  return {
    browser,
    page,
    duration,
    seek: (t) => page.evaluate((time) => window.__film.seek(time), t),
    capture: async () => {
      const shot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        optimizeForSpeed: true,
      });
      return Buffer.from(shot.data, "base64");
    },
  };
}

/** Renders every frame across the workers, feeding the encoder in order. */
async function renderVideo(films, opts) {
  const frames = Math.round(films[0].duration * opts.fps);
  const encoder = startEncoder(opts);
  const started = Date.now();
  for (let batch = 0; batch < frames; batch += films.length) {
    const shots = await Promise.all(
      films.map(async (film, worker) => {
        const frame = batch + worker;
        if (frame >= frames) return null;
        await film.seek(frame / opts.fps);
        return film.capture();
      }),
    );
    for (const shot of shots) if (shot) await encoder.write(shot);
    process.stdout.write(`\rframe ${Math.min(batch + films.length, frames)}/${frames}`);
  }
  encoder.end();
  await encoder.finished;
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\rrendered ${frames} frames in ${secs}s → ${relative(ROOT, opts.out)}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const version = JSON.parse(readFileSync(join(ROOT, "apps/app/package.json"), "utf8")).version;
  const { chromium } = await loadPlaywright();
  const server = await serveSite();
  const query = new URLSearchParams({ render: "1", version });
  const url = `http://127.0.0.1:${server.address().port}/${PAGE}?${query}`;
  const workers = opts.stills ? 1 : opts.workers;
  const films = await Promise.all(Array.from({ length: workers }, () => openFilm(chromium, url)));

  try {
    if (opts.stills) {
      const [film] = films;
      mkdirSync(opts.outDir, { recursive: true });
      for (const t of opts.stills) {
        await film.seek(t);
        const file = join(opts.outDir, `still-${t.toFixed(2)}.jpg`);
        await film.page.screenshot({ path: file, type: "jpeg", quality: 92 });
        console.log(file);
      }
    } else {
      await renderVideo(films, opts);
    }
  } finally {
    await Promise.all(films.map((film) => film.browser.close()));
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
