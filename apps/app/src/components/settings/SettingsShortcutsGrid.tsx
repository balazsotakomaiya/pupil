type ShortcutItem = {
  keys: string[];
  label: string;
};

type SettingsShortcutsGridProps = {
  items: ShortcutItem[];
};

export function SettingsShortcutsGrid({ items }: SettingsShortcutsGridProps) {
  return (
    <div className="settings-shortcuts-grid">
      {items.map((item) => (
        <div className="settings-shortcut-row" key={`${item.label}-${item.keys.join("-")}`}>
          <span>{item.label}</span>
          <div className="settings-shortcut-keys">
            {item.keys.map((key) => (
              <span className="settings-kbd" key={`${item.label}-${key}`}>
                {key}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
