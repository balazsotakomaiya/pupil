import type { ReactNode } from "react";
import { AppleIcon, DownloadIcon, LinuxIcon, WindowsIcon } from "../icons";
import { DESKTOP_APP_VERSION, DOWNLOAD_BASE, RELEASES_URL, REPO_URL } from "../lib/constants";
import { cx } from "../lib/cx";
import { detectOS, type OS } from "../lib/detectOS";
import styles from "./DownloadCTA.module.css";

type DownloadTarget = { label: string; shortLabel: string; icon: ReactNode; downloadUrl: string };

const OS_CONFIG: Record<OS, DownloadTarget> = {
  // Default to Apple Silicon — most Macs since 2020 are arm64.
  // Intel Mac users can use "All platforms" to get the x64 build.
  mac: {
    label: "Download for Mac",
    shortLabel: "Download",
    icon: <AppleIcon />,
    downloadUrl: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_aarch64.dmg`,
  },
  windows: {
    label: "Download for Windows",
    shortLabel: "Download",
    icon: <WindowsIcon />,
    downloadUrl: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_x64-setup.exe`,
  },
  linux: {
    label: "Download for Linux",
    shortLabel: "Download",
    icon: <LinuxIcon />,
    downloadUrl: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_amd64.AppImage`,
  },
  unknown: {
    label: "Download",
    shortLabel: "Download",
    icon: <DownloadIcon />,
    downloadUrl: RELEASES_URL,
  },
};

export function getDownloadTarget(): DownloadTarget {
  return OS_CONFIG[detectOS()];
}

export default function DownloadCTA({
  onBackdrop = false,
  align = "start",
}: {
  onBackdrop?: boolean;
  align?: "start" | "center";
}) {
  const { label, icon, downloadUrl } = getDownloadTarget();
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
        <span className={styles.version}>v{DESKTOP_APP_VERSION}</span>
        <span>macOS · Windows · Linux</span>
        <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
          All downloads ↗
        </a>
      </p>
    </div>
  );
}
