import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { AppTab } from "../components/app-shell/AppTitlebar";
import { LaunchScreen } from "../components/app-shell/LaunchScreen";
import { Button } from "../components/Button";
import { StatusPanel } from "../components/StatusPanel";
import {
  useBootstrapQuery,
  useDashboardStatsQuery,
  useStudySettingsQuery,
} from "../lib/app-queries";
import { toAppError } from "../lib/errors";
import { AppShellFrame } from "./AppShellFrame";
import { ShellActionsProvider } from "./ShellActionsProvider";
import { useShellActions } from "./shell-actions";
import { useDateSensitiveQuerySync } from "./useDateSensitiveQuerySync";
import { useOnboardingRouteGuard } from "./useOnboardingRouteGuard";
import { useShellRuntimeEvents } from "./useShellRuntimeEvents";
import { useTrayStatusSync } from "./useTrayStatusSync";

const APP_TABS: AppTab[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "cards", label: "All Cards" },
  { id: "import", label: "Import" },
  { id: "settings", label: "Settings" },
] as const;

function resolveMainTab(pathname: string) {
  switch (pathname) {
    case "/":
      return "dashboard";
    case "/cards":
      return "cards";
    case "/import":
      return "import";
    case "/settings":
      return "settings";
    default:
      return null;
  }
}

export function RootShell() {
  return (
    <ShellActionsProvider>
      <RootShellContent />
    </ShellActionsProvider>
  );
}

function RootShellContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const bootstrapQuery = useBootstrapQuery();
  const dashboardStatsQuery = useDashboardStatsQuery();
  const studySettingsQuery = useStudySettingsQuery();
  const shellActions = useShellActions();
  const globalStreak = dashboardStatsQuery.data?.globalStreak ?? null;
  const mainTab = resolveMainTab(location.pathname);
  const resetOnboarding = useOnboardingRouteGuard({
    onReset: shellActions.closeShellOverlays,
  });
  const selectMainTab = useCallback(
    (tabId: AppTab["id"]) => {
      if (tabId === "dashboard") {
        void navigate({ to: "/" });
      } else {
        void navigate({ to: `/${tabId}` });
      }
    },
    [navigate],
  );
  const startStudy = useCallback(() => {
    void navigate({ to: "/study" });
  }, [navigate]);

  useDateSensitiveQuerySync();
  useTrayStatusSync({ bootstrapQuery, dashboardStatsQuery, studySettingsQuery });
  useShellRuntimeEvents({
    onResetOnboarding: resetOnboarding,
    onStartStudy: startStudy,
    onToggleCommandPalette: shellActions.toggleCommandPalette,
  });

  return (
    <>
      {bootstrapQuery.error ? (
        <StatusPanel
          actions={
            <Button
              disabled={bootstrapQuery.isFetching}
              onClick={() => void bootstrapQuery.refetch()}
            >
              {bootstrapQuery.isFetching ? "Trying again…" : "Try again"}
            </Button>
          }
          message={toAppError(bootstrapQuery.error).message}
          role="alert"
          title="Pupil couldn’t start"
        />
      ) : bootstrapQuery.isPending ? null : (
        <AppShellFrame
          activeTab={mainTab ? (APP_TABS.find((tab) => tab.id === mainTab) ?? null) : null}
          globalStreak={globalStreak}
          onOpenCommandPalette={shellActions.openCommandPalette}
          onOpenCreateDialog={shellActions.openCreateDialog}
          onOpenNewCard={() => {
            shellActions.requestNewCardEditor?.();
            void navigate({ to: "/cards" });
          }}
          onSelectTab={selectMainTab}
          pathname={location.pathname}
          tabs={APP_TABS}
        >
          <Outlet />
        </AppShellFrame>
      )}
      <LaunchScreen ready={!bootstrapQuery.isPending} />
    </>
  );
}
