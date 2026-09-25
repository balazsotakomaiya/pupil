import type { ReactNode } from "react";
import { useEffect } from "react";
import { AppTitlebar, NotificationsViewport } from "../components/app-shell";
import type { AppTab } from "../components/app-shell/AppTitlebar";
import { RulersOverlay } from "../components/brand";
import { getUpdatePromptLabel, isUpdateBusy } from "../lib/app-update";
import { useAppUpdateStore } from "../lib/app-update-store";
import shellStyles from "./AppShell.module.css";

type AppShellFrameProps = {
  activeTab: AppTab | null;
  children: ReactNode;
  globalStreak: number | null;
  onOpenCommandPalette: () => void;
  onOpenCreateDialog: () => void;
  onOpenNewCard?: () => void;
  onSelectTab: (tabId: AppTab["id"]) => void;
  pathname: string;
  tabs: AppTab[];
};

export function AppShellFrame({
  activeTab,
  children,
  globalStreak,
  onOpenCommandPalette,
  onOpenCreateDialog,
  onOpenNewCard,
  onSelectTab,
  pathname,
  tabs,
}: AppShellFrameProps) {
  const errorMessage = useAppUpdateStore((state) => state.errorMessage);
  const install = useAppUpdateStore((state) => state.install);
  const notes = useAppUpdateStore((state) => state.notes);
  const phase = useAppUpdateStore((state) => state.phase);
  const progress = useAppUpdateStore((state) => state.progress);
  const version = useAppUpdateStore((state) => state.version);
  const updateBusy = isUpdateBusy(phase);
  const updateActionLabel = getUpdatePromptLabel({
    currentVersion: null,
    errorMessage,
    notes,
    phase,
    progress,
    version,
  });

  useEffect(() => {
    void useAppUpdateStore.getState().refresh();
  }, []);

  return (
    <main className={shellStyles.appShell}>
      {pathname.startsWith("/study") ? null : <RulersOverlay />}

      <div className={shellStyles.dashboardShell}>
        {activeTab ? (
          <AppTitlebar
            activeTab={activeTab.id}
            globalStreak={activeTab.id === "dashboard" ? globalStreak : null}
            onInstallUpdate={updateActionLabel ? () => void install() : undefined}
            onOpenCreateDialog={onOpenCreateDialog}
            onOpenNewCard={onOpenNewCard}
            onOpenPalette={onOpenCommandPalette}
            onSelectTab={onSelectTab}
            tabs={tabs}
            updateActionLabel={updateActionLabel}
            updateBusy={updateBusy}
          />
        ) : null}

        {children}
      </div>

      <NotificationsViewport />
    </main>
  );
}
