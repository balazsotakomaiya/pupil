import { create } from "zustand";
import type { AppError } from "./errors";

export type Notification = {
  createdAt: number;
  id: string;
  message: string;
  title?: string;
  type: "error" | "info" | "success";
  error?: AppError;
};

type NotificationInput = Omit<Notification, "createdAt" | "id">;

type NotificationStore = {
  dismiss: (id: string) => void;
  items: Notification[];
  notify: (input: NotificationInput) => string;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  items: [],
  dismiss(id) {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },
  notify(input) {
    const createdAt = Date.now();
    const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      items: [...state.items, { ...input, createdAt, id }],
    }));
    return id;
  },
}));

export function notifySuccess(message: string, title?: string) {
  return useNotificationStore.getState().notify({ message, title, type: "success" });
}

export function notifyInfo(message: string, title?: string) {
  return useNotificationStore.getState().notify({ message, title, type: "info" });
}

export function notifyError(error: AppError, title = "Something went wrong") {
  return useNotificationStore.getState().notify({
    error,
    message: error.message,
    title,
    type: "error",
  });
}
