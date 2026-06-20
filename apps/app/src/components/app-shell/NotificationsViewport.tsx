import { useEffect } from "react";
import { type Notification, useNotificationStore } from "../../lib/notifications";
import {
  NotificationDismissIcon,
  NotificationErrorIcon,
  NotificationInfoIcon,
  NotificationSuccessIcon,
} from "../icons/NotificationIcons";
import styles from "./NotificationsViewport.module.css";

const AUTO_DISMISS_MS = 4_000;

const ICONS: Record<Notification["type"], React.ReactNode> = {
  error: <NotificationErrorIcon />,
  info: <NotificationInfoIcon />,
  success: <NotificationSuccessIcon />,
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
          <NotificationDismissIcon />
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
