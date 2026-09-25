import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { REPO_URL } from "../lib/constants";
import { cx } from "../lib/cx";
import { getDownloadTarget } from "./DownloadCTA";
import styles from "./Nav.module.css";
import PupilEye from "./PupilEye";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { icon, shortLabel, downloadUrl } = getDownloadTarget();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={cx(styles.nav, scrolled && styles.scrolled)}>
      <div className={styles.navInner}>
        <Link to="/" className={styles.navLogo} aria-label="Pupil home">
          <PupilEye />
          pupil
        </Link>
        <ul className={styles.navLinks}>
          <li className={styles.navSection}>
            <a href="/#how-it-works">How it works</a>
          </li>
          <li className={styles.navSection}>
            <a href="/#science">The science</a>
          </li>
          <li className={styles.navSection}>
            <a href="/#features">Features</a>
          </li>
          {/* Manifesto nav restored when rewrite ships — see #34 */}
          <li className={styles.navGithubItem}>
            <a
              href={REPO_URL}
              className={styles.navGithub}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
              <span className={styles.navGithubLabel}>GitHub</span>
            </a>
          </li>
          <li>
            <a
              href={downloadUrl}
              className={styles.navDownload}
              target="_blank"
              rel="noopener noreferrer"
            >
              {icon}
              {shortLabel}
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
