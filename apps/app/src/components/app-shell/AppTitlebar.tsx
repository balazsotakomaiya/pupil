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
  onOpenCreateDialog: () => void;
  onSelectTab: (tabId: AppTabId) => void;
  tabs: AppTab[];
};

export function AppTitlebar({
  activeTab,
  onOpenCreateDialog,
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
        <button className="titlebar-btn-label" onClick={onOpenCreateDialog} type="button">
          <PlusIcon />
          New Space
        </button>
        <button aria-label="Search" className="titlebar-btn" type="button">
          <SearchIcon />
        </button>
      </div>
    </div>
  );
}
