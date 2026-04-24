import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AiGenerateTitlebar } from "../../components/ai-generate";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import { SettingsScreen } from "../../components/settings";
import { useCardsQuery, useSpacesQuery, useStudySettingsQuery } from "../../lib/app-queries";
import { resetAllData } from "../../lib/data-actions";
import { toAppError } from "../../lib/errors";
import { notifyError, notifySuccess } from "../../lib/notifications";
import { appQueryKeys, invalidateAllAppData } from "../../lib/query";
import { saveStudySettings } from "../../lib/study-settings";

export function SettingsPage({
  fromAi = false,
  onBack,
}: {
  fromAi?: boolean;
  onBack?: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const studySettings = useStudySettingsQuery().data ?? { newCardsLimit: null, newCardsToday: 0 };
  const saveStudySettingsMutation = useMutation({
    mutationFn: saveStudySettings,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.studyQueueSnapshot }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.studySettings }),
      ]);
      notifySuccess("Study settings saved");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to save study settings."), "Settings save failed");
    },
  });
  const resetMutation = useMutation({
    mutationFn: resetAllData,
    onSuccess: async () => {
      await invalidateAllAppData(queryClient);
      notifySuccess("All local data was reset");
      void navigate({ to: "/onboarding" });
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to reset local data."), "Reset failed");
    },
  });

  const content = (
    <SettingsScreen
      cardsCount={cards.length}
      isSavingStudySettings={saveStudySettingsMutation.isPending}
      onResetAllData={async () => {
        await resetMutation.mutateAsync();
      }}
      onSaveStudySettings={async (newCardsLimit) => {
        await saveStudySettingsMutation.mutateAsync(newCardsLimit);
      }}
      spacesCount={spaces.length}
      studySettings={studySettings}
    />
  );

  if (fromAi && onBack) {
    return (
      <>
        <AiGenerateTitlebar backLabel="AI Generate" onBack={onBack} />
        {content}
      </>
    );
  }

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="settings"
      title="Settings unavailable"
    >
      {content}
    </ScreenErrorBoundary>
  );
}
