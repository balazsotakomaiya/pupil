import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const APP_PACKAGE_PATH = path.resolve("apps/app/package.json");
const CARGO_TOML_PATH = path.resolve("apps/app/src-tauri/Cargo.toml");
const TAURI_CONFIG_PATH = path.resolve("apps/app/src-tauri/tauri.conf.json");
const RELEASE_TAG_PREFIX = "app-v";
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function fail(message) {
  console.error(`release contract failed: ${message}`);
  process.exit(1);
}

function validateSemver(version) {
  if (!SEMVER_PATTERN.test(version)) {
    fail(`"${version}" is not a valid semver version`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  let requestedVersion = null;
  let tag =
    process.env.GITHUB_REF_TYPE === "tag"
      ? (process.env.GITHUB_REF_NAME ?? normalizeTag(process.env.GITHUB_REF ?? null))
      : normalizeTag(process.env.GITHUB_REF ?? null);

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--tag") {
      tag = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
      continue;
    }

    if (!requestedVersion) {
      requestedVersion = arg;
      continue;
    }

    fail(`unexpected argument: ${arg}`);
  }

  return { command, requestedVersion, tag };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readCargoVersion(contents) {
  let inPackageSection = false;

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inPackageSection = trimmed === "[package]";
      continue;
    }

    if (!inPackageSection) {
      continue;
    }

    const match = trimmed.match(/^version\s*=\s*"([^"]+)"$/);
    if (match) {
      return match[1];
    }
  }

  fail("could not find [package].version in apps/app/src-tauri/Cargo.toml");
}

function replaceCargoVersion(contents, nextVersion) {
  const lines = contents.split(/\r?\n/);
  let inPackageSection = false;
  let replaced = false;

  const nextLines = lines.map((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inPackageSection = trimmed === "[package]";
      return line;
    }

    if (!inPackageSection || replaced) {
      return line;
    }

    if (/^version\s*=\s*"[^"]+"$/.test(trimmed)) {
      replaced = true;
      return `version = "${nextVersion}"`;
    }

    return line;
  });

  if (!replaced) {
    fail("could not update [package].version in apps/app/src-tauri/Cargo.toml");
  }

  return `${nextLines.join("\n")}\n`;
}

function normalizeTag(tag) {
  if (!tag) {
    return null;
  }

  if (tag.startsWith("refs/tags/")) {
    return tag.slice("refs/tags/".length);
  }

  return tag;
}

async function readReleaseState() {
  const [appPackage, cargoToml, tauriConfig] = await Promise.all([
    readJson(APP_PACKAGE_PATH),
    readFile(CARGO_TOML_PATH, "utf8"),
    readJson(TAURI_CONFIG_PATH),
  ]);

  return {
    appVersion: appPackage.version,
    appPackage,
    cargoToml,
    cargoVersion: readCargoVersion(cargoToml),
    tauriConfig,
  };
}

function getGitPushRef() {
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return branch || "HEAD";
  } catch {
    return "HEAD";
  }
}

function printNextCommands(version) {
  const tag = `${RELEASE_TAG_PREFIX}${version}`;
  const pushRef = getGitPushRef();

  console.log("");
  console.log("copy/paste next:");
  console.log(
    [
      "git add apps/app/package.json apps/app/src-tauri/Cargo.toml apps/app/src-tauri/Cargo.lock",
      `bun run release:check --tag ${tag}`,
      `git commit -m "chore(release): bump desktop app to v${version}"`,
      `git tag -a ${tag} -m "Pupil v${version}"`,
      `git push origin ${pushRef} --follow-tags`,
    ].join(" && \\\n"),
  );
}

async function checkReleaseState(tag) {
  const state = await readReleaseState();

  validateSemver(state.appVersion);

  if (state.cargoVersion !== state.appVersion) {
    fail(
      `apps/app/package.json is ${state.appVersion} but apps/app/src-tauri/Cargo.toml is ${state.cargoVersion}`,
    );
  }

  if (state.tauriConfig.version !== "../package.json") {
    fail('apps/app/src-tauri/tauri.conf.json must keep "version": "../package.json"');
  }

  const normalizedTag = normalizeTag(tag);
  if (normalizedTag) {
    const expectedTag = `${RELEASE_TAG_PREFIX}${state.appVersion}`;
    if (normalizedTag !== expectedTag) {
      fail(`release tag must be ${expectedTag}, received ${normalizedTag}`);
    }
  }

  console.log(
    `desktop release contract OK: version ${state.appVersion}${
      normalizedTag ? `, tag ${normalizedTag}` : ""
    }`,
  );
}

async function updateVersion(nextVersion) {
  if (!nextVersion) {
    fail("missing version argument, expected: bun run release:version 0.0.2");
  }

  validateSemver(nextVersion);

  const state = await readReleaseState();
  state.appPackage.version = nextVersion;

  await Promise.all([
    writeJson(APP_PACKAGE_PATH, state.appPackage),
    writeFile(CARGO_TOML_PATH, replaceCargoVersion(state.cargoToml, nextVersion)),
  ]);

  await checkReleaseState(null);
  console.log(`next release tag: ${RELEASE_TAG_PREFIX}${nextVersion}`);
  printNextCommands(nextVersion);
}

async function main() {
  const { command, requestedVersion, tag } = parseArgs(process.argv);

  switch (command) {
    case "check":
      await checkReleaseState(tag);
      break;
    case "version":
      await updateVersion(requestedVersion);
      break;
    default:
      fail("expected one of: check, version");
  }
}

await main();
