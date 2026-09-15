import styles from "./Settings.module.css";

export type SettingsSectionId = "general" | "ai" | "data" | "about";

type SettingsNavProps = {
  activeSection: SettingsSectionId;
  onSelect: (sectionId: SettingsSectionId) => void;
};

const NAV_ITEMS: Array<{ id: SettingsSectionId; label: string }> = [
  { id: "general", label: "General" },
  { id: "ai", label: "AI Provider" },
  { id: "data", label: "Data" },
  { id: "about", label: "About" },
];

export function SettingsNav({ activeSection, onSelect }: SettingsNavProps) {
  return (
    <div className={styles.settingsNav} role="tablist" aria-label="Settings">
      {NAV_ITEMS.map((item) => (
        <button
          className={`${styles.settingsNavItem}${activeSection === item.id ? ` ${styles.active}` : ""}`}
          aria-controls={`settings-panel-${item.id}`}
          aria-selected={activeSection === item.id}
          id={`settings-tab-${item.id}`}
          role="tab"
          tabIndex={activeSection === item.id ? 0 : -1}
          onKeyDown={(event) => {
            const index = NAV_ITEMS.findIndex((entry) => entry.id === item.id);
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % NAV_ITEMS.length
                : event.key === "ArrowLeft"
                  ? (index + NAV_ITEMS.length - 1) % NAV_ITEMS.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? NAV_ITEMS.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            onSelect(NAV_ITEMS[next].id);
            document.getElementById(`settings-tab-${NAV_ITEMS[next].id}`)?.focus();
          }}
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
