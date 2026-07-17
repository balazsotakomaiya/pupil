import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useBootstrapQuery, useSpacesQuery } from "../lib/app-queries";
import { hasDismissedOnboarding, resetOnboarding } from "../lib/onboarding";

type OnboardingRouteGuardInput = {
  onReset: () => void;
};

export function useOnboardingRouteGuard({ onReset }: OnboardingRouteGuardInput) {
  const navigate = useNavigate();
  const location = useLocation();
  const bootstrapQuery = useBootstrapQuery();
  const spacesQuery = useSpacesQuery();
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(hasDismissedOnboarding);
  const spaces = spacesQuery.data ?? [];

  useEffect(() => {
    if (bootstrapQuery.isPending || spacesQuery.isPending) {
      return;
    }

    const hasDismissed = hasDismissedOnboarding();
    if (hasDismissed !== isOnboardingDismissed) {
      setIsOnboardingDismissed(hasDismissed);
    }

    if (!hasDismissed && spaces.length === 0 && location.pathname === "/") {
      void navigate({ to: "/onboarding" });
      return;
    }

    if (hasDismissed && location.pathname === "/onboarding") {
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

  return useCallback(() => {
    resetOnboarding();
    setIsOnboardingDismissed(false);
    onReset();
    void navigate({ to: "/onboarding" });
  }, [navigate, onReset]);
}
