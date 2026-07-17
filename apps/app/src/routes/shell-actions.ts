import { createContext, useContext } from "react";

export type ShellActions = {
  openCreateDialog: () => void;
};

export const ShellActionsContext = createContext<ShellActions | null>(null);

export function useShellActions() {
  const context = useContext(ShellActionsContext);

  if (!context) {
    throw new Error("Shell actions are unavailable outside the router shell.");
  }

  return context;
}
