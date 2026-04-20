import { useNavigate } from "@tanstack/react-router";
import { OnboardingScreen } from "../../components/onboarding";
import { dismissOnboarding } from "../../lib/onboarding";
import { useShellActions } from "../root-shell";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { openCreateDialog } = useShellActions();

  function handleDismissOnboarding() {
    dismissOnboarding();
  }

  return (
    <OnboardingScreen
      onCreateSpace={() => {
        handleDismissOnboarding();
        openCreateDialog();
      }}
      onGenerateWithAi={() => {
        handleDismissOnboarding();
        void navigate({ to: "/generate" });
      }}
      onImport={() => {
        handleDismissOnboarding();
        void navigate({ to: "/import" });
      }}
      onOpenSettings={() => {
        handleDismissOnboarding();
        void navigate({ to: "/settings" });
      }}
      onSkip={() => {
        handleDismissOnboarding();
        void navigate({ to: "/" });
      }}
    />
  );
}
