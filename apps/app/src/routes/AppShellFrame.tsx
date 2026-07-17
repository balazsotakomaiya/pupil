import type { ReactNode } from "react";
import { AppTitlebar, NotificationsViewport } from "../components/app-shell";
import type { AppTab } from "../components/app-shell/AppTitlebar";
import { RulersOverlay } from "../components/dashboard";
import shellStyles from "./AppShell.module.css";

type AppShellFrameProps = {
  activeTab: AppTab | null;
  children: ReactNode;
  globalStreak: number | null;
  onOpenCommandPalette: () => void;
  onOpenCreateDialog: () => void;
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
  onSelectTab,
  pathname,
  tabs,
}: AppShellFrameProps) {
  return (
    <main className={shellStyles.appShell}>
      {pathname.startsWith("/study") ? null : <RulersOverlay />}

      <div className={shellStyles.dashboardShell}>
        {activeTab ? (
          <AppTitlebar
            activeTab={activeTab.id}
            globalStreak={activeTab.id === "dashboard" ? globalStreak : null}
            onOpenCreateDialog={onOpenCreateDialog}
            onOpenPalette={onOpenCommandPalette}
            onSelectTab={onSelectTab}
            tabs={tabs}
          />
        ) : null}

        {children}
      </div>

      <NotificationsViewport />
    </main>
  );
}
