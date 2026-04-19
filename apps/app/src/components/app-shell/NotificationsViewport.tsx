import { useEffect } from "react";
import { useNotificationStore } from "../../lib/notifications";
import styles from "./NotificationsViewport.module.css";

const AUTO_DISMISS_MS = 4_000;

export function NotificationsViewport() {
  const dismiss = useNotificationStore((state) => state.dismiss);
  const items = useNotificationStore((state) => state.items);

  useEffect(() => {
    const timers = items.map((item) =>
      window.setTimeout(() => {
        dismiss(item.id);
      }, AUTO_DISMISS_MS),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [dismiss, items]);

  return (
    <div aria-live="polite" className={styles.viewport}>
      {items.map((item) => (
        <section className={`${styles.item} ${styles[item.type]}`} key={item.id}>
          {item.title ? <h2 className={styles.title}>{item.title}</h2> : null}
          <p className={styles.message}>{item.message}</p>
          <button className={styles.dismiss} onClick={() => dismiss(item.id)} type="button">
            Dismiss
          </button>
        </section>
      ))}
    </div>
  );
}
