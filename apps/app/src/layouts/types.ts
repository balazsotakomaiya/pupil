import type { FormEvent } from "react";
import type { SpaceSummary } from "../lib/spaces";

export type DesignId = "A" | "B" | "C" | "D" | "E";

export interface LayoutProps {
  design: DesignId;
  spaces: SpaceSummary[];
  totals: { spaces: number; cards: number; due: number };
  isLoadingSpaces: boolean;
  createName: string;
  setCreateName: (name: string) => void;
  editingSpaceId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  isCreating: boolean;
  busySpaceId: string | null;
  bootstrapError: string | null;
  onCreateSpace: (event: FormEvent<HTMLFormElement>) => void;
  onRenameSpace: (event: FormEvent<HTMLFormElement>, spaceId: string) => void;
  onDeleteSpace: (space: SpaceSummary) => void;
  onBeginRename: (space: SpaceSummary) => void;
  onCancelRename: () => void;
}
