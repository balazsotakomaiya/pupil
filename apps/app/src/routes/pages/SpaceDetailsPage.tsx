import type {
  CreateCardInput,
  DeleteCardInput,
  SuspendCardInput,
  UpdateCardInput,
} from "@pupil/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import { StatusPanel } from "../../components/StatusPanel";
import { SpaceDetailsScreen } from "../../components/space-details";
import { useCardsQuery, useSpaceStatsQuery, useSpacesQuery } from "../../lib/app-queries";
import { toAppError } from "../../lib/errors";
import { notifyError, notifySuccess } from "../../lib/notifications";
import {
  appQueryKeys,
  invalidateAfterCardDeletion,
  invalidateAfterCardMutation,
  invalidateAllAppData,
} from "../../lib/query";
import { getStorage } from "../../lib/storage";

export function SpaceDetailsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { spaceId } = useParams({ from: "/spaces/$spaceId" });
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const spaceStats = useSpaceStatsQuery().data ?? [];
  const space = spaces.find((entry) => entry.id === spaceId) ?? null;
  const stats = spaceStats.find((entry) => entry.spaceId === spaceId) ?? null;
  const createCardMutation = useMutation({
    mutationFn: (input: CreateCardInput) => getStorage().createCard(input),
    onSuccess: async () => {
      await invalidateAfterCardMutation(queryClient);
      notifySuccess("Card saved");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to save card."), "Card save failed");
    },
  });
  const updateCardMutation = useMutation({
    mutationFn: (input: UpdateCardInput) => getStorage().updateCard(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.cards }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.studyQueueSnapshot }),
      ]);
      notifySuccess("Card updated");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to update card."), "Card update failed");
    },
  });
  const deleteCardMutation = useMutation({
    mutationFn: (input: DeleteCardInput) => getStorage().deleteCard(input),
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
      notifySuccess("Card deleted");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to delete card."), "Card deletion failed");
    },
  });
  const suspendCardMutation = useMutation({
    mutationFn: (input: SuspendCardInput) => getStorage().suspendCard(input),
    onSuccess: async () => {
      await invalidateAfterCardMutation(queryClient);
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to suspend the card."), "Card update failed");
    },
  });
  const renameSpaceMutation = useMutation({
    mutationFn: async (name: string) => getStorage().renameSpace({ id: spaceId, name }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.cards }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.recentActivity }),
      ]);
      notifySuccess("Space renamed");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to rename the space."), "Space rename failed");
    },
  });
  const deleteSpaceMutation = useMutation({
    mutationFn: async () => getStorage().deleteSpace({ id: spaceId }),
    onSuccess: async () => {
      await invalidateAllAppData(queryClient);
      notifySuccess("Space deleted");
      void navigate({ to: "/" });
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to delete the space."), "Space deletion failed");
    },
  });

  if (!space) {
    return <StatusPanel message="That space no longer exists." title="Space not found" />;
  }

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="space"
      title="Space unavailable"
    >
      <SpaceDetailsScreen
        cards={cards}
        isMutating={
          createCardMutation.isPending ||
          updateCardMutation.isPending ||
          deleteCardMutation.isPending ||
          suspendCardMutation.isPending ||
          renameSpaceMutation.isPending
        }
        onBack={() => void navigate({ to: "/" })}
        onCreateCard={async (input) => {
          await createCardMutation.mutateAsync(input);
        }}
        onDeleteCard={async (input) => {
          await deleteCardMutation.mutateAsync(input);
        }}
        onDeleteSpace={() => deleteSpaceMutation.mutateAsync()}
        onOpenAiGenerate={() =>
          void navigate({ to: "/spaces/$spaceId/generate", params: { spaceId } })
        }
        onOpenImport={() => void navigate({ to: "/spaces/$spaceId/import", params: { spaceId } })}
        onRenameSpace={async (input) => {
          await renameSpaceMutation.mutateAsync(input.name);
        }}
        onStartStudy={() => void navigate({ to: "/spaces/$spaceId/study", params: { spaceId } })}
        onSuspendCard={(input) => suspendCardMutation.mutateAsync(input)}
        onUpdateCard={async (input) => {
          await updateCardMutation.mutateAsync(input);
        }}
        space={space}
        stats={stats}
      />
    </ScreenErrorBoundary>
  );
}
