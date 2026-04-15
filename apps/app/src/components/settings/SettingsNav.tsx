export type SettingsSectionId = "study" | "ai" | "data" | "shortcuts" | "about";

type SettingsNavProps = {
  activeSection: SettingsSectionId;
  onSelect: (sectionId: SettingsSectionId) => void;
};

const NAV_ITEMS: Array<{ id: SettingsSectionId; label: string }> = [
  { id: "study", label: "Study" },
  { id: "ai", label: "AI Provider" },
  { id: "data", label: "Data" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];

export function SettingsNav({ activeSection, onSelect }: SettingsNavProps) {
  return (
    <div className="settings-nav">
      {NAV_ITEMS.map((item) => (
        <button
          className={`settings-nav-item${activeSection === item.id ? " active" : ""}`}
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
