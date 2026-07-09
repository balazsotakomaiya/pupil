import { Link } from "react-router-dom";
import { DOCS_URL, ISSUES_URL, REPO_URL } from "../lib/constants";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Link to="/" className={styles.footerLogo}>
        pupil
      </Link>
      <nav className={styles.footerLinks}>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <span className={styles.sep}>·</span>
        <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          Docs
        </a>
        <span className={styles.sep}>·</span>
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          Issues
        </a>
      </nav>
      <a
        href="https://otakomaiya.com"
        className={styles.footerCredit}
        target="_blank"
        rel="noopener noreferrer"
      >
        Balazs Otakomaiya
      </a>
    </footer>
  );
}
