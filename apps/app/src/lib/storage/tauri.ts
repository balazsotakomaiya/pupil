import {
  type CardRecord,
  type DashboardStats,
  type PupilStorage,
  type RecentActivityRecord,
  type SpaceStats,
  type SpaceSummary,
  type StudyQueueSnapshotData,
  type StudySettings,
  scheduleCard,
} from "@pupil/core";
import { invokeCommand } from "../ipc";

/**
 * Desktop storage backed by the Rust/SQLite layer over Tauri IPC.
 *
 * Scheduling is computed here with the shared scheduler and handed to Rust
 * already resolved — the backend persists validated FSRS state, it never
 * recalculates a schedule.
 */
export function createTauriStorage(): PupilStorage {
  return {
    listSpaces() {
      return invokeCommand<SpaceSummary[]>("list_spaces");
    },

    createSpace(input) {
      return invokeCommand<SpaceSummary>("create_space", { name: input.name });
    },

    renameSpace(input) {
      return invokeCommand<SpaceSummary>("rename_space", { id: input.id, name: input.name });
    },

    async deleteSpace(input) {
      await invokeCommand("delete_space", { id: input.id });
    },

    listCards(input = {}) {
      return invokeCommand<CardRecord[]>("list_cards", { spaceId: input.spaceId ?? null });
    },

    createCard(input) {
      return invokeCommand<CardRecord>("create_card", { input });
    },

    updateCard(input) {
      return invokeCommand<CardRecord>("update_card", { input });
    },

    async deleteCard(input) {
      await invokeCommand("delete_card", { id: input.id });
    },

    suspendCard(input) {
      return invokeCommand<CardRecord>("suspend_card", { input });
    },

    reviewCard(input) {
      const reviewedAt = input.reviewedAt ?? Date.now();
      const scheduled = scheduleCard(input.card, input.grade, reviewedAt);

      return invokeCommand<CardRecord>("review_card", {
        input: {
          difficulty: scheduled.updatedCard.difficulty,
          due: scheduled.updatedCard.due,
          elapsedDays: scheduled.updatedCard.elapsedDays,
          grade: input.grade,
          id: input.card.id,
          lapses: scheduled.updatedCard.lapses,
          lastReview: scheduled.updatedCard.lastReview,
          learningSteps: scheduled.updatedCard.learningSteps,
          reps: scheduled.updatedCard.reps,
          reviewLog: {
            due: scheduled.reviewLog.due,
            elapsedDays: scheduled.reviewLog.elapsedDays,
            reviewTime: scheduled.reviewLog.reviewTime,
            scheduledDays: scheduled.reviewLog.scheduledDays,
            state: scheduled.reviewLog.state,
          },
          scheduledDays: scheduled.updatedCard.scheduledDays,
          stability: scheduled.updatedCard.stability,
          state: scheduled.updatedCard.state,
        },
      });
    },

    undoReviewCard(input) {
      const { snapshot } = input;

      return invokeCommand<CardRecord>("undo_review_card", {
        input: {
          difficulty: snapshot.difficulty,
          due: snapshot.due,
          elapsedDays: snapshot.elapsedDays,
          id: snapshot.id,
          lapses: snapshot.lapses,
          lastReview: snapshot.lastReview,
          learningSteps: snapshot.learningSteps,
          reps: snapshot.reps,
          scheduledDays: snapshot.scheduledDays,
          stability: snapshot.stability,
          state: snapshot.state,
        },
      });
    },

    getDashboardStats() {
      return invokeCommand<DashboardStats>("get_dashboard_stats");
    },

    listSpaceStats() {
      return invokeCommand<SpaceStats[]>("list_space_stats");
    },

    listRecentActivity() {
      return invokeCommand<RecentActivityRecord[]>("list_recent_activity");
    },

    getStudySettings() {
      return invokeCommand<StudySettings>("get_study_settings");
    },

    saveStudySettings(newCardsLimit) {
      return invokeCommand<StudySettings>("save_study_settings", { newCardsLimit });
    },

    getStudyQueueSnapshot() {
      return invokeCommand<StudyQueueSnapshotData>("get_study_queue_snapshot");
    },
  };
}
