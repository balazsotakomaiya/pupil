import type { ReactNode } from "react";
import { AppleIcon, DownloadIcon, LinuxIcon, WindowsIcon } from "../icons";
import { DESKTOP_APP_VERSION, DOWNLOAD_BASE, RELEASES_URL, REPO_URL } from "../lib/constants";
import { detectOS, type OS } from "../lib/detectOS";
import styles from "./DownloadCTA.module.css";

const OS_CONFIG: Record<OS, { label: string; icon: ReactNode; downloadUrl: string }> = {
  // Default to Apple Silicon — most Macs since 2020 are arm64.
  // Intel Mac users can use "All platforms" to get the x64 build.
  mac: {
    label: "Download for Mac",
    icon: <AppleIcon />,
    downloadUrl: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_aarch64.dmg`,
  },
  windows: {
    label: "Download for Windows",
    icon: <WindowsIcon />,
    downloadUrl: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_x64-setup.exe`,
  },
  linux: {
    label: "Download for Linux",
    icon: <LinuxIcon />,
    downloadUrl: `${DOWNLOAD_BASE}/Pupil_${DESKTOP_APP_VERSION}_amd64.AppImage`,
  },
  unknown: {
    label: "Download",
    icon: <DownloadIcon />,
    downloadUrl: RELEASES_URL,
  },
};

export default function DownloadCTA() {
  const { label, icon, downloadUrl } = OS_CONFIG[detectOS()];
  return (
    <div className={styles.heroCtasGroup}>
      <div className={styles.heroCtas}>
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
          Open GitHub
        </a>
      </div>
      <a
        href={RELEASES_URL}
        className={styles.btnAllPlatforms}
        target="_blank"
        rel="noopener noreferrer"
      >
        All platforms ↗
      </a>
    </div>
  );
}
