import { EyeLogo } from "./EyeLogo";
import { PlusIcon } from "./PlusIcon";
import { SearchIcon } from "./SearchIcon";
import type { DashboardTab } from "./types";

type DashboardTitlebarProps = {
  onOpenCreateDialog: () => void;
  tabs: DashboardTab[];
};

export function DashboardTitlebar({ onOpenCreateDialog, tabs }: DashboardTitlebarProps) {
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
            <span
              aria-current={tab.active ? "page" : undefined}
              className={`titlebar-tab${tab.active ? " active" : ""}`}
              key={tab.label}
            >
              {tab.label}
            </span>
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
