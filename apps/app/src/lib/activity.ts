import type { RecentActivityRecord } from "@pupil/core";
import { getStorage } from "./storage";

export type { RecentActivityRecord } from "@pupil/core";

export function listRecentActivity(): Promise<RecentActivityRecord[]> {
  return getStorage().listRecentActivity();
}
