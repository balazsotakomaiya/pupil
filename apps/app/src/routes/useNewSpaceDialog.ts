import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type SyntheticEvent, useCallback, useState } from "react";
import { toAppError } from "../lib/errors";
import { notifyError, notifySuccess } from "../lib/notifications";
import { appQueryKeys } from "../lib/query";
import { createSpace } from "../lib/spaces";

export function useNewSpaceDialog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createSpaceMutation = useMutation({
    mutationFn: (spaceName: string) => createSpace({ name: spaceName }),
    onError(mutationError) {
      const appError = toAppError(mutationError, "Failed to create space.");
      setError(appError.message);
      notifyError(appError, "Space creation failed");
    },
    async onSuccess(createdSpace) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appQueryKeys.spaces }),
        queryClient.invalidateQueries({ queryKey: appQueryKeys.dashboardStats }),
      ]);
      notifySuccess("Space created");
      setIsOpen(false);
      setName("");
      await navigate({ to: "/spaces/$spaceId", params: { spaceId: createdSpace.id } });
    },
  });

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setError(null);
    setName("");
    setIsOpen(true);
  }, []);

  const submit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      createSpaceMutation.mutate(name);
    },
    [createSpaceMutation, name],
  );

  return {
    close,
    error,
    isOpen,
    isSubmitting: createSpaceMutation.isPending,
    name,
    open,
    setName,
    submit,
  };
}
