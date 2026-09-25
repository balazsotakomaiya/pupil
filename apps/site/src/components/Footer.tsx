import { Link } from "react-router-dom";
import { DOCS_URL, ISSUES_URL, RELEASES_URL, REPO_URL } from "../lib/constants";
import styles from "./Footer.module.css";
import PupilEye from "./PupilEye";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Link to="/" className={styles.footerLogo} aria-label="Pupil home">
        <PupilEye size={20} />
        pupil
      </Link>
      <nav className={styles.footerLinks} aria-label="Project links">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
          Releases
        </a>
        <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          Docs
        </a>
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          Issues
        </a>
      </nav>
      <p className={styles.footerCredit}>
        Made by{" "}
        <a href="https://otakomaiya.com" target="_blank" rel="noopener noreferrer">
          Balazs Otakomaiya
        </a>
      </p>
    </footer>
  );
}
