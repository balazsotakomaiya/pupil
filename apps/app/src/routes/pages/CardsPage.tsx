import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CardsScreen } from "../../components/cards";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import { useCardsQuery, useSpacesQuery } from "../../lib/app-queries";
import { createCard, deleteCard, suspendCard, updateCard } from "../../lib/cards";
import { toAppError } from "../../lib/errors";
import { notifyError, notifySuccess } from "../../lib/notifications";
import {
  appQueryKeys,
  invalidateAfterCardDeletion,
  invalidateAfterCardMutation,
} from "../../lib/query";
import { useShellActions } from "../root-shell";

export function CardsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openCreateDialog } = useShellActions();
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const createCardMutation = useMutation({
    mutationFn: createCard,
    onSuccess: async () => {
      await invalidateAfterCardMutation(queryClient);
      notifySuccess("Card saved");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to save card."), "Card save failed");
    },
  });
  const updateCardMutation = useMutation({
    mutationFn: updateCard,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.cards }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
      ]);
      notifySuccess("Card updated");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to update card."), "Card update failed");
    },
  });
  const deleteCardMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
      notifySuccess("Card deleted");
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to delete card."), "Card deletion failed");
    },
  });
  const suspendCardMutation = useMutation({
    mutationFn: suspendCard,
    onSuccess: async () => {
      await invalidateAfterCardMutation(queryClient);
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to update the card state."), "Card update failed");
    },
  });

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="cards"
      title="Cards unavailable"
    >
      <CardsScreen
        cards={cards}
        isMutating={
          createCardMutation.isPending ||
          updateCardMutation.isPending ||
          deleteCardMutation.isPending ||
          suspendCardMutation.isPending
        }
        onCreateCard={async (input) => {
          await createCardMutation.mutateAsync(input);
        }}
        onDeleteCard={async (input) => {
          await deleteCardMutation.mutateAsync(input);
        }}
        onOpenCreateDialog={openCreateDialog}
        onSuspendCard={(input) => suspendCardMutation.mutateAsync(input)}
        onUpdateCard={async (input) => {
          await updateCardMutation.mutateAsync(input);
        }}
        spaces={spaces}
      />
    </ScreenErrorBoundary>
  );
}
