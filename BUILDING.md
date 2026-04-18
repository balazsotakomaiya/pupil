# Building Pupil

## Requirements

| Tool | Version |
|---|---|
| Rust | >= 1.77.2 |
| Bun | >= 1.1.0 |

Install Rust via [rustup](https://rustup.rs). Install Bun via [bun.sh](https://bun.sh).

---

## Linux

Install the system libraries that Tauri's WebView requires before building:

**Ubuntu / Debian:**
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

**Fedora / RHEL:**
```bash
sudo dnf install \
  webkit2gtk4.1-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

**Arch:**
```bash
sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg patchelf
```

Then install JS dependencies and build:

```bash
bun install
bun run --cwd apps/app tauri build
```

---

## Windows

### Prerequisites

1. **Visual Studio Build Tools 2022** — install from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **"Desktop development with C++"** workload selected.

2. **Rust MSVC target** — the correct target is `x86_64-pc-windows-msvc` (default when installing via rustup on Windows). Do **not** use the GNU target.

3. **WebView2** — ships with Windows 10/11. If building for older systems, the WebView2 runtime must be installed separately from [Microsoft's site](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### Build

```powershell
bun install
bun run --cwd apps/app tauri build
```

---

## macOS

Xcode Command Line Tools are required:

```bash
xcode-select --install
```

Then:

```bash
bun install
bun run --cwd apps/app tauri build
```

---

## Development mode

Runs the frontend dev server and Tauri shell together with hot reload:

```bash
bun run --cwd apps/app dev
```

The first Rust compilation takes a few minutes. Subsequent runs are incremental.

---

## Releases

Desktop release versioning and GitHub Releases publishing live in [`docs/RELEASING.md`](./docs/RELEASING.md).

---

## Output

Built binaries are placed in `apps/app/src-tauri/target/release/bundle/`.

| Platform | Format |
|---|---|
| Linux | `.deb`, `.rpm`, `.AppImage` |
| Windows | `.msi`, `.exe` (NSIS) |
| macOS | `.dmg`, `.app` |
