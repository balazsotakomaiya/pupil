import { useEffect } from "react";
import { type Notification, useNotificationStore } from "../../lib/notifications";
import styles from "./NotificationsViewport.module.css";

const AUTO_DISMISS_MS = 4_000;

const ICONS = {
  success: (
    <svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 8l2 2 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  ),
  error: (
    <svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  ),
  info: (
    <svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <circle cx="8" cy="4.75" fill="currentColor" r="0.875" />
    </svg>
  ),
};

function NotificationItem({
  dismiss,
  item,
}: {
  dismiss: (id: string) => void;
  item: Notification;
}) {
  const progressMs = Math.max(0, item.createdAt + AUTO_DISMISS_MS - Date.now());

  useEffect(() => {
    const remainingMs = Math.max(0, item.createdAt + AUTO_DISMISS_MS - Date.now());
    const timer = window.setTimeout(() => {
      dismiss(item.id);
    }, remainingMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dismiss, item.createdAt, item.id]);

  return (
    <section className={`${styles.item} ${styles[item.type]}`}>
      <div className={styles.body}>
        <span aria-hidden="true" className={styles.icon}>
          {ICONS[item.type]}
        </span>
        <div className={styles.content}>
          {item.title ? <h2 className={styles.title}>{item.title}</h2> : null}
          <p className={styles.message}>{item.message}</p>
        </div>
        <button
          aria-label="Dismiss"
          className={styles.dismiss}
          onClick={() => dismiss(item.id)}
          type="button"
        >
          <svg fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 2l8 8M10 2l-8 8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
      <div className={styles.progress} style={{ animationDuration: `${progressMs}ms` }} />
    </section>
  );
}

export function NotificationsViewport() {
  const dismiss = useNotificationStore((state) => state.dismiss);
  const items = useNotificationStore((state) => state.items);

  return (
    <div aria-live="polite" className={styles.viewport}>
      {items.map((item) => (
        <NotificationItem dismiss={dismiss} item={item} key={item.id} />
      ))}
    </div>
  );
}
