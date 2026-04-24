import { EyeLogo } from "../dashboard/EyeLogo";
import { PlusIcon } from "../dashboard/PlusIcon";
import { SearchIcon } from "../dashboard/SearchIcon";
import styles from "./AppTitlebar.module.css";

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
    <div className={styles.titlebar}>
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarLogo}>
          <EyeLogo />
          <span className={styles.titlebarLogoText}>pupil</span>
        </div>

        <div className={styles.titlebarSep} />

        <div className={styles.titlebarTabs}>
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`${styles.titlebarTab}${activeTab === tab.id ? ` ${styles.active}` : ""}`}
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.titlebarRight}>
        {activeTab === "dashboard" && globalStreak !== undefined && globalStreak !== null ? (
          <div className={styles.titlebarStatus}>
            <span className="streak-dot" />
            {globalStreak > 0 ? `${globalStreak} day streak` : "No streak yet"}
          </div>
        ) : null}
        <button className={styles.titlebarBtnLabel} onClick={onOpenCreateDialog} type="button">
          <PlusIcon />
          New Space
        </button>
        <button
          aria-label="Search"
          className={styles.titlebarBtn}
          onClick={onOpenPalette}
          type="button"
        >
          <SearchIcon />
        </button>
      </div>
    </div>
  );
}
