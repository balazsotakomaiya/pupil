import { ArrowUpRightIcon } from "../icons";
import { cx } from "../lib/cx";
import styles from "./ScreenshotFrame.module.css";

type ScreenshotFrameProps = {
  src: string;
  alt: string;
  priority?: boolean;
  onOpen?: (src: string, alt: string) => void;
  className?: string;
};

export default function ScreenshotFrame({
  src,
  alt,
  priority = false,
  onOpen,
  className,
}: ScreenshotFrameProps) {
  const img = (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
    />
  );

  if (!onOpen) {
    return <figure className={cx(styles.screenshotFrame, className)}>{img}</figure>;
  }

  return (
    <button
      type="button"
      className={cx(styles.screenshotFrame, className)}
      onClick={() => onOpen(src, alt)}
      aria-label={`Open screenshot: ${alt}`}
    >
      {img}
      <span className={styles.screenshotOpenIndicator} aria-hidden="true">
        <ArrowUpRightIcon />
      </span>
    </button>
  );
}
