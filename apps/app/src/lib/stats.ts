import type { DashboardStats, SpaceStats } from "@pupil/core";
import { getStorage } from "./storage";

export type { DashboardStats, SpaceStats } from "@pupil/core";

export function getDashboardStats(): Promise<DashboardStats> {
  return getStorage().getDashboardStats();
}

export function listSpaceStats(): Promise<SpaceStats[]> {
  return getStorage().listSpaceStats();
}
