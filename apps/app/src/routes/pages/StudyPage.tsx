import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import { StudyScreen } from "../../components/study";
import { useCardsQuery, useSpacesQuery, useStudySettingsQuery } from "../../lib/app-queries";
import { deleteCard, reviewCard, suspendCard } from "../../lib/cards";
import { toAppError } from "../../lib/errors";
import { notifyError } from "../../lib/notifications";
import {
  invalidateAfterCardDeletion,
  invalidateAfterCardMutation,
  invalidateAfterReview,
} from "../../lib/query";
import { computeNewCardsBudget } from "../../lib/study-settings";

function StudyPage({ targetSpaceId }: { targetSpaceId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sessionKey] = useState(() => Date.now());
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const studySettings = useStudySettingsQuery().data ?? { newCardsLimit: null, newCardsToday: 0 };
  const targetSpace = targetSpaceId
    ? (spaces.find((space) => space.id === targetSpaceId) ?? null)
    : null;
  const sessionCards = targetSpaceId
    ? cards.filter((card) => card.spaceId === targetSpaceId)
    : cards;
  const reviewMutation = useMutation({
    mutationFn: reviewCard,
    onSuccess: async () => {
      await invalidateAfterReview(queryClient);
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to save the review."), "Review failed");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: async () => {
      await invalidateAfterCardDeletion(queryClient);
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to delete the card."), "Card deletion failed");
    },
  });
  const suspendMutation = useMutation({
    mutationFn: suspendCard,
    onSuccess: async () => {
      await invalidateAfterCardMutation(queryClient);
    },
    onError(error) {
      notifyError(toAppError(error, "Failed to suspend the card."), "Card update failed");
    },
  });

  return (
    <ScreenErrorBoundary
      onReset={() =>
        void navigate({
          to: targetSpaceId ? "/spaces/$spaceId" : "/",
          params: targetSpaceId ? { spaceId: targetSpaceId } : (undefined as never),
        })
      }
      screen="study"
      title="Study session unavailable"
    >
      <StudyScreen
        cards={sessionCards}
        newCardsBudget={computeNewCardsBudget(
          studySettings.newCardsLimit,
          studySettings.newCardsToday,
        )}
        onBack={() =>
          targetSpaceId
            ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpaceId } })
            : void navigate({ to: "/" })
        }
        onDeleteCard={(input) => deleteMutation.mutateAsync(input)}
        onReviewCard={(input) => reviewMutation.mutateAsync(input)}
        onSuspendCard={(input) => suspendMutation.mutateAsync(input)}
        scope={targetSpaceId ? "space" : "global"}
        scopeLabel={targetSpace?.name ?? "All spaces"}
        sessionKey={sessionKey}
        space={targetSpace}
      />
    </ScreenErrorBoundary>
  );
}

export function GlobalStudyPage() {
  return <StudyPage />;
}

export function SpaceStudyPage() {
  const { spaceId } = useParams({ from: "/spaces/$spaceId/study" });
  return <StudyPage targetSpaceId={spaceId} />;
}
