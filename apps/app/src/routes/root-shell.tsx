import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { createContext, type FormEvent, useContext, useEffect, useState } from "react";
import { AppTitlebar, CommandPalette, NotificationsViewport } from "../components/app-shell";
import { NewSpaceDialog, RulersOverlay } from "../components/dashboard";
import { StatusPanel } from "../components/StatusPanel";
import {
  useBootstrapQuery,
  useCardsQuery,
  useDashboardStatsQuery,
  useSpacesQuery,
} from "../lib/app-queries";
import { toAppError } from "../lib/errors";
import { log } from "../lib/log";
import { notifyError, notifySuccess } from "../lib/notifications";
import { hasDismissedOnboarding, resetOnboarding } from "../lib/onboarding";
import { appQueryKeys } from "../lib/query";
import { isTauriRuntime } from "../lib/runtime";
import { createSpace } from "../lib/spaces";

const APP_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "cards", label: "All Cards" },
  { id: "import", label: "Import" },
  { id: "settings", label: "Settings" },
] as const;

type ShellActions = {
  openCreateDialog: () => void;
};

const ShellActionsContext = createContext<ShellActions | null>(null);

export function useShellActions() {
  const context = useContext(ShellActionsContext);

  if (!context) {
    throw new Error("Shell actions are unavailable outside the router shell.");
  }

  return context;
}

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const bootstrapQuery = useBootstrapQuery();
  const spacesQuery = useSpacesQuery();
  const cardsQuery = useCardsQuery();
  const dashboardStatsQuery = useDashboardStatsQuery();
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceError, setNewSpaceError] = useState<string | null>(null);

  const spaces = spacesQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const globalStreak = dashboardStatsQuery.data?.globalStreak ?? null;
  const mainTab = resolveMainTab(location.pathname);

  useEffect(() => {
    setIsOnboardingDismissed(hasDismissedOnboarding());
  }, []);

  useEffect(() => {
    if (bootstrapQuery.isPending || spacesQuery.isPending) {
      return;
    }

    if (!isOnboardingDismissed && spaces.length === 0 && location.pathname === "/") {
      void navigate({ to: "/onboarding" });
      return;
    }

    if ((isOnboardingDismissed || spaces.length > 0) && location.pathname === "/onboarding") {
      void navigate({ to: "/" });
    }
  }, [
    bootstrapQuery.isPending,
    isOnboardingDismissed,
    location.pathname,
    navigate,
    spaces.length,
    spacesQuery.isPending,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setIsPaletteOpen((currentValue) => !currentValue);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const error = toAppError(event.reason, "Unhandled async failure.");
      log.error("Unhandled promise rejection", {
        code: error.code,
        message: error.message,
        severity: error.severity,
      });
      notifyError(error, "Unexpected async failure");
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposeReset: (() => void) | undefined;
    let disposeStudy: (() => void) | undefined;

    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen("developer://reset-onboarding", () => {
        resetOnboarding();
        setIsOnboardingDismissed(false);
        setIsCreateDialogOpen(false);
        setIsPaletteOpen(false);
        void navigate({ to: "/onboarding" });
      }).then((dispose) => {
        disposeReset = dispose;
      });

      void listen("tray://study-now", () => {
        void navigate({ to: "/study" });
      }).then((dispose) => {
        disposeStudy = dispose;
      });
    });

    return () => {
      disposeReset?.();
      disposeStudy?.();
    };
  }, [navigate]);

  function openCreateDialog() {
    setNewSpaceError(null);
    setNewSpaceName("");
    setIsCreateDialogOpen(true);
  }

  const createSpaceMutation = useMutation({
    mutationFn: async (name: string) => createSpace({ name }),
    async onError(error) {
      const appError = toAppError(error, "Failed to create space.");
      setNewSpaceError(appError.message);
      notifyError(appError, "Space creation failed");
    },
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.dashboardStats }),
      ]);
      notifySuccess("Space created");
      setIsCreateDialogOpen(false);
      setNewSpaceName("");
    },
    onSettled() {
      setIsCreatingSpace(false);
    },
  });

  async function handleCreateSpaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewSpaceError(null);
    setIsCreatingSpace(true);
    await createSpaceMutation.mutateAsync(newSpaceName);
  }

  if (bootstrapQuery.error) {
    return (
      <StatusPanel message={toAppError(bootstrapQuery.error).message} title="Bootstrap failed" />
    );
  }

  if (bootstrapQuery.isPending) {
    return <StatusPanel message="Preparing the app shell." title="Loading" />;
  }

  return (
    <ShellActionsContext.Provider value={{ openCreateDialog }}>
      <main className="app-shell">
        {location.pathname.startsWith("/study") ? null : <RulersOverlay />}

        <div className="dashboard-shell">
          {mainTab ? (
            <AppTitlebar
              activeTab={mainTab}
              globalStreak={mainTab === "dashboard" ? globalStreak : null}
              onOpenCreateDialog={openCreateDialog}
              onOpenPalette={() => setIsPaletteOpen(true)}
              onSelectTab={(tabId) => {
                if (tabId === "dashboard") {
                  void navigate({ to: "/" });
                } else {
                  void navigate({ to: `/${tabId}` });
                }
              }}
              tabs={[...APP_TABS]}
            />
          ) : null}

          <Outlet />
        </div>

        {isCreateDialogOpen ? (
          <NewSpaceDialog
            error={newSpaceError}
            isSubmitting={isCreatingSpace}
            onChange={setNewSpaceName}
            onClose={() => setIsCreateDialogOpen(false)}
            onSubmit={handleCreateSpaceSubmit}
            value={newSpaceName}
          />
        ) : null}

        {isPaletteOpen ? (
          <CommandPalette
            cards={cards}
            onClose={() => setIsPaletteOpen(false)}
            onOpenAiGenerate={() => void navigate({ to: "/generate" })}
            onOpenCreateDialog={() => {
              setIsPaletteOpen(false);
              openCreateDialog();
            }}
            onOpenImport={() => void navigate({ to: "/import" })}
            onOpenSettings={() => void navigate({ to: "/settings" })}
            onOpenSpace={(spaceId) =>
              void navigate({ to: "/spaces/$spaceId", params: { spaceId } })
            }
            onSelectTab={(tabId) => {
              if (tabId === "dashboard") {
                void navigate({ to: "/" });
              } else {
                void navigate({ to: `/${tabId}` });
              }
            }}
            onStartGlobalStudy={() => void navigate({ to: "/study" })}
            spaces={spaces}
          />
        ) : null}

        <NotificationsViewport />
      </main>
    </ShellActionsContext.Provider>
  );
}
