import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { GlobalAiGeneratePage, SpaceAiGeneratePage } from "./routes/pages/AiGeneratePage";
import { CardsPage } from "./routes/pages/CardsPage";
import { DashboardPage } from "./routes/pages/DashboardPage";
import { GlobalImportPage, SpaceImportPage } from "./routes/pages/ImportPage";
import { OnboardingPage } from "./routes/pages/OnboardingPage";
import { SettingsPage } from "./routes/pages/SettingsPage";
import { SpaceDetailsPage } from "./routes/pages/SpaceDetailsPage";
import { GlobalStudyPage, SpaceStudyPage } from "./routes/pages/StudyPage";
import { RootShell } from "./routes/root-shell";

const rootRoute = createRootRoute({
  component: RootShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
});

const cardsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cards",
  component: CardsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: GlobalImportPage,
});

const studyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/study",
  component: GlobalStudyPage,
});

const generateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/generate",
  component: GlobalAiGeneratePage,
});

const spaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId",
  component: SpaceDetailsPage,
});

const spaceImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId/import",
  component: SpaceImportPage,
});

const spaceStudyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId/study",
  component: SpaceStudyPage,
});

const spaceGenerateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/spaces/$spaceId/generate",
  component: SpaceAiGeneratePage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  onboardingRoute,
  cardsRoute,
  settingsRoute,
  importRoute,
  studyRoute,
  generateRoute,
  spaceRoute,
  spaceImportRoute,
  spaceStudyRoute,
  spaceGenerateRoute,
]);

export const router = createRouter({
  routeTree,
  history: createMemoryHistory({
    initialEntries: ["/"],
  }),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
