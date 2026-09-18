import type {
  CreateSpaceInput,
  DeleteSpaceInput,
  RenameSpaceInput,
  SpaceSummary,
} from "@pupil/core";
import { getStorage } from "./storage";

export type { SpaceSummary } from "@pupil/core";
export { SPACE_NAME_MAX_LENGTH } from "@pupil/core";

export function listSpaces(): Promise<SpaceSummary[]> {
  return getStorage().listSpaces();
}

export function createSpace(input: CreateSpaceInput): Promise<SpaceSummary> {
  return getStorage().createSpace(input);
}

export function renameSpace(input: RenameSpaceInput): Promise<SpaceSummary> {
  return getStorage().renameSpace(input);
}

export function deleteSpace(input: DeleteSpaceInput): Promise<void> {
  return getStorage().deleteSpace(input);
}
