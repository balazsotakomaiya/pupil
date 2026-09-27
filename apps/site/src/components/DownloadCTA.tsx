import type { ReactNode } from "react";
import { AppleIcon, DownloadIcon, LinuxIcon, WindowsIcon } from "../icons";
import { DESKTOP_APP_VERSION, DOWNLOAD_BASE, RELEASES_URL, REPO_URL } from "../lib/constants";
import { cx } from "../lib/cx";
import { detectOS, type OS } from "../lib/detectOS";
import { type LatestRelease, useLatestRelease } from "../lib/latestRelease";
import styles from "./DownloadCTA.module.css";

type DownloadTarget = { label: string; shortLabel: string; icon: ReactNode; downloadUrl: string };

const FALLBACK_DOWNLOADS = {
  mac: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_aarch64.dmg`,
  windows: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_x64-setup.exe`,
  linux: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_amd64.AppImage`,
};

function downloadUrlFor(os: OS, release: LatestRelease | null): string {
  if (os === "unknown") return RELEASES_URL;
  return release?.downloads[os] ?? FALLBACK_DOWNLOADS[os];
}

export function getDownloadTarget(release: LatestRelease | null): DownloadTarget {
  const os = detectOS();
  const targets: Record<OS, Omit<DownloadTarget, "downloadUrl">> = {
    // Default to Apple Silicon — most Macs since 2020 are arm64.
    // Intel Mac users can use "All platforms" to get the x64 build.
    mac: { label: "Download for Mac", shortLabel: "Download", icon: <AppleIcon /> },
    windows: { label: "Download for Windows", shortLabel: "Download", icon: <WindowsIcon /> },
    linux: { label: "Download for Linux", shortLabel: "Download", icon: <LinuxIcon /> },
    unknown: { label: "Download", shortLabel: "Download", icon: <DownloadIcon /> },
  };

  return { ...targets[os], downloadUrl: downloadUrlFor(os, release) };
}

export default function DownloadCTA({
  onBackdrop = false,
  align = "start",
}: {
  onBackdrop?: boolean;
  align?: "start" | "center";
}) {
  const release = useLatestRelease();
  const version = release?.version ?? DESKTOP_APP_VERSION;
  const { label, icon, downloadUrl } = getDownloadTarget(release);
  return (
    <div
      className={cx(
        styles.ctaGroup,
        onBackdrop && styles.onBackdrop,
        align === "center" && styles.centered,
      )}
    >
      <div className={styles.ctas}>
        <a
          href={downloadUrl}
          className={styles.btnPrimary}
          target="_blank"
          rel="noopener noreferrer"
        >
          {icon}
          {label}
        </a>
        <a
          href={REPO_URL}
          className={styles.btnSecondary}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>
      <p className={styles.meta}>
        <span className={styles.version}>v{version}</span>
        <span>macOS · Windows · Linux</span>
        <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
          All downloads ↗
        </a>
      </p>
    </div>
  );
}
