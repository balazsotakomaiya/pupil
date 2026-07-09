import { AppleIcon, TuxIcon, WindowsIcon } from "../icons";
import styles from "./PlatformBar.module.css";

export default function PlatformBar() {
  return (
    <div className={styles.platformBar}>
      <span className={styles.platformBarLabel}>Available on</span>
      <span className={styles.platformBarItem}>
        <AppleIcon size={18} />
        macOS
      </span>
      <span className={styles.platformBarItem}>
        <WindowsIcon size={18} />
        Windows
      </span>
      <span className={styles.platformBarItem}>
        <TuxIcon size={18} />
        Linux
      </span>
    </div>
  );
}
