import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../Button";
import { EyeLogo } from "../brand";
import { PlusIcon } from "../icons/PlusIcon";
import { SearchIcon } from "../icons/SearchIcon";
import styles from "./AppTitlebar.module.css";

export type AppTabId = "dashboard" | "cards" | "import" | "settings";

export type AppTab = {
  id: AppTabId;
  label: string;
};

type AppTitlebarProps = {
  activeTab: AppTabId;
  globalStreak?: number | null;
  onInstallUpdate?: () => void;
  onOpenCreateDialog: () => void;
  onOpenNewCard?: () => void;
  onOpenPalette: () => void;
  onSelectTab: (tabId: AppTabId) => void;
  tabs: AppTab[];
  updateActionLabel?: string | null;
  updateBusy?: boolean;
};

export function AppTitlebar({
  activeTab,
  globalStreak,
  onInstallUpdate,
  onOpenCreateDialog,
  onOpenNewCard,
  onOpenPalette,
  onSelectTab,
  tabs,
  updateActionLabel,
  updateBusy = false,
}: AppTitlebarProps) {
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<AppTabId, HTMLButtonElement>>>({});
  const [activeIndicatorStyle, setActiveIndicatorStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const tabsElement = tabsRef.current;
    const activeTabElement = tabRefs.current[activeTab];

    if (!tabsElement || !activeTabElement) {
      return;
    }

    function updateActiveIndicator() {
      if (!tabsElement || !activeTabElement) {
        return;
      }

      const tabsRect = tabsElement.getBoundingClientRect();
      const activeRect = activeTabElement.getBoundingClientRect();

      setActiveIndicatorStyle({
        height: activeRect.height,
        transform: `translate(${activeRect.left - tabsRect.left}px, ${activeRect.top - tabsRect.top}px)`,
        width: activeRect.width,
      });
    }

    updateActiveIndicator();
    const frame = window.requestAnimationFrame(updateActiveIndicator);
    const resizeObserver = new ResizeObserver(updateActiveIndicator);
    resizeObserver.observe(tabsElement);
    resizeObserver.observe(activeTabElement);
    window.addEventListener("resize", updateActiveIndicator);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateActiveIndicator);
    };
  }, [activeTab]);

  return (
    <div className={styles.titlebar} data-window-drag>
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarLogo}>
          <EyeLogo />
          <span className={styles.titlebarLogoText}>pupil</span>
        </div>

        <div className={styles.titlebarSep} />

        <div className={styles.titlebarTabs} ref={tabsRef}>
          {activeIndicatorStyle ? (
            <span className={styles.titlebarTabIndicator} style={activeIndicatorStyle} />
          ) : null}
          {tabs.map((tab) => (
            <button
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`${styles.titlebarTab}${activeTab === tab.id ? ` ${styles.active}` : ""}`}
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              ref={(element) => {
                if (element) {
                  tabRefs.current[tab.id] = element;
                } else {
                  delete tabRefs.current[tab.id];
                }
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.titlebarRight}>
        {updateActionLabel && onInstallUpdate ? (
          <Button disabled={updateBusy} onClick={onInstallUpdate} size="compact" variant="ghost">
            {updateActionLabel}
          </Button>
        ) : null}
        {activeTab === "dashboard" && globalStreak !== undefined && globalStreak !== null ? (
          <div className={styles.titlebarStatus}>
            <span className="streak-dot" />
            {globalStreak > 0 ? `${globalStreak} day streak` : "No streak yet"}
          </div>
        ) : null}
        {onOpenNewCard ? (
          <Button onClick={onOpenNewCard} size="compact" variant="outline">
            <PlusIcon />
            New Card
          </Button>
        ) : null}
        <Button onClick={onOpenCreateDialog} size="compact" variant="outline">
          <PlusIcon />
          New Space
        </Button>
        <Button aria-label="Search" onClick={onOpenPalette} size="iconCompact" variant="outline">
          <SearchIcon />
        </Button>
      </div>
    </div>
  );
}
