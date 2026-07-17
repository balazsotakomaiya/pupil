import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import type { AppTabId } from "../components/app-shell/AppTitlebar";
import { useCardsQuery, useSpacesQuery, useStudyQueueSnapshotQuery } from "../lib/app-queries";
import { buildStudyQueueCountMap } from "../lib/study-queue";

type CommandPaletteInput = {
  onOpenCreateDialog: () => void;
};

export function useCommandPalette({ onOpenCreateDialog }: CommandPaletteInput) {
  const navigate = useNavigate();
  const cards = useCardsQuery().data ?? [];
  const spaces = useSpacesQuery().data ?? [];
  const studyQueueSnapshot = useStudyQueueSnapshotQuery().data;
  const [isOpen, setIsOpen] = useState(false);
  const paletteSpaces = useMemo(() => {
    if (!studyQueueSnapshot) {
      return spaces;
    }

    const studyQueueCountsBySpace = buildStudyQueueCountMap(
      studyQueueSnapshot.actionableDueBySpace,
    );
    return spaces.map((space) => ({
      ...space,
      dueTodayCount: studyQueueCountsBySpace.get(space.id) ?? 0,
    }));
  }, [spaces, studyQueueSnapshot]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((currentValue) => !currentValue);
  }, []);

  const selectMainTab = useCallback(
    (tabId: AppTabId) => {
      if (tabId === "dashboard") {
        void navigate({ to: "/" });
      } else {
        void navigate({ to: `/${tabId}` });
      }
    },
    [navigate],
  );

  const openCreateDialog = useCallback(() => {
    close();
    onOpenCreateDialog();
  }, [close, onOpenCreateDialog]);

  return {
    cards,
    close,
    isOpen,
    onOpenAiGenerate: () => void navigate({ to: "/generate" }),
    onOpenCreateDialog: openCreateDialog,
    onOpenImport: () => void navigate({ to: "/import" }),
    onOpenSettings: () => void navigate({ to: "/settings" }),
    onOpenSpace: (spaceId: string) =>
      void navigate({ to: "/spaces/$spaceId", params: { spaceId } }),
    onSelectTab: selectMainTab,
    onStartGlobalStudy: () => void navigate({ to: "/study" }),
    open,
    spaces: paletteSpaces,
    toggle,
  };
}
