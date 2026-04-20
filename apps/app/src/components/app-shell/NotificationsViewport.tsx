import { useEffect } from "react";
import { type Notification, useNotificationStore } from "../../lib/notifications";
import styles from "./NotificationsViewport.module.css";

const AUTO_DISMISS_MS = 4_000;

function NotificationItem({
  dismiss,
  item,
}: {
  dismiss: (id: string) => void;
  item: Notification;
}) {
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
      {item.title ? <h2 className={styles.title}>{item.title}</h2> : null}
      <p className={styles.message}>{item.message}</p>
      <button className={styles.dismiss} onClick={() => dismiss(item.id)} type="button">
        Dismiss
      </button>
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
