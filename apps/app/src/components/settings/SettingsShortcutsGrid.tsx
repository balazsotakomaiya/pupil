import styles from "./Settings.module.css";

type ShortcutItem = {
  keys: string[];
  label: string;
};

type SettingsShortcutsGridProps = {
  items: ShortcutItem[];
};

export function SettingsShortcutsGrid({ items }: SettingsShortcutsGridProps) {
  return (
    <div className={styles.settingsShortcutsGrid}>
      {items.map((item) => (
        <div className={styles.settingsShortcutRow} key={`${item.label}-${item.keys.join("-")}`}>
          <span>{item.label}</span>
          <div className={styles.settingsShortcutKeys}>
            {item.keys.map((key) => (
              <span className={styles.settingsKbd} key={`${item.label}-${key}`}>
                {key}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
