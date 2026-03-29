import { EyeLogo } from "../dashboard/EyeLogo";
import { PlusIcon } from "../dashboard/PlusIcon";
import { SearchIcon } from "../dashboard/SearchIcon";

export type AppTabId = "dashboard" | "cards" | "import" | "settings";

export type AppTab = {
  id: AppTabId;
  label: string;
};

type AppTitlebarProps = {
  activeTab: AppTabId;
  globalStreak?: number | null;
  onOpenCreateDialog: () => void;
  onOpenPalette: () => void;
  onSelectTab: (tabId: AppTabId) => void;
  tabs: AppTab[];
};

export function AppTitlebar({
  activeTab,
  globalStreak,
  onOpenCreateDialog,
  onOpenPalette,
  onSelectTab,
  tabs,
}: AppTitlebarProps) {
  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-logo">
          <EyeLogo />
          <span className="titlebar-logo-text">pupil</span>
        </div>

        <div className="titlebar-sep" />

        <div className="titlebar-tabs">
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`titlebar-tab${activeTab === tab.id ? " active" : ""}`}
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="titlebar-right">
        {activeTab === "dashboard" && globalStreak !== undefined && globalStreak !== null ? (
          <div className="titlebar-status">
            <span className="streak-dot" />
            {globalStreak > 0 ? `${globalStreak} day streak` : "No streak yet"}
          </div>
        ) : null}
        <button className="titlebar-btn-label" onClick={onOpenCreateDialog} type="button">
          <PlusIcon />
          New Space
        </button>
        <button aria-label="Search" className="titlebar-btn" onClick={onOpenPalette} type="button">
          <SearchIcon />
        </button>
      </div>
    </div>
  );
}
