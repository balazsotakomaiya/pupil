import { type ReactNode, useCallback, useMemo } from "react";
import { CommandPalette } from "../components/app-shell";
import { NewSpaceDialog } from "../components/dashboard";
import { ShellActionsContext } from "./shell-actions";
import { useCommandPalette } from "./useCommandPalette";
import { useNewSpaceDialog } from "./useNewSpaceDialog";

type ShellActionsProviderProps = {
  children: ReactNode;
};

export function ShellActionsProvider({ children }: ShellActionsProviderProps) {
  const newSpaceDialog = useNewSpaceDialog();
  const commandPalette = useCommandPalette({ onOpenCreateDialog: newSpaceDialog.open });
  const closeShellOverlays = useCallback(() => {
    newSpaceDialog.close();
    commandPalette.close();
  }, [commandPalette.close, newSpaceDialog.close]);
  const actions = useMemo(
    () => ({
      closeCreateDialog: newSpaceDialog.close,
      closeShellOverlays,
      openCommandPalette: commandPalette.open,
      openCreateDialog: newSpaceDialog.open,
      toggleCommandPalette: commandPalette.toggle,
    }),
    [
      closeShellOverlays,
      commandPalette.open,
      commandPalette.toggle,
      newSpaceDialog.close,
      newSpaceDialog.open,
    ],
  );

  return (
    <ShellActionsContext.Provider value={actions}>
      {children}

      {newSpaceDialog.isOpen ? (
        <NewSpaceDialog
          error={newSpaceDialog.error}
          isSubmitting={newSpaceDialog.isSubmitting}
          onChange={newSpaceDialog.setName}
          onClose={newSpaceDialog.close}
          onSubmit={newSpaceDialog.submit}
          value={newSpaceDialog.name}
        />
      ) : null}

      {commandPalette.isOpen ? (
        <CommandPalette
          cards={commandPalette.cards}
          onClose={commandPalette.close}
          onOpenAiGenerate={commandPalette.onOpenAiGenerate}
          onOpenCreateDialog={commandPalette.onOpenCreateDialog}
          onOpenImport={commandPalette.onOpenImport}
          onOpenSettings={commandPalette.onOpenSettings}
          onOpenSpace={commandPalette.onOpenSpace}
          onSelectTab={commandPalette.onSelectTab}
          onStartGlobalStudy={commandPalette.onStartGlobalStudy}
          spaces={commandPalette.spaces}
        />
      ) : null}
    </ShellActionsContext.Provider>
  );
}
