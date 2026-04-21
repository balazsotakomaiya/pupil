import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ScreenErrorBoundary } from "../../components/ErrorBoundary";
import { ImportScreen } from "../../components/import";
import { useSpacesQuery } from "../../lib/app-queries";
import { notifySuccess } from "../../lib/notifications";
import { invalidateAllAppData } from "../../lib/query";

function ImportPage({ targetSpaceId }: { targetSpaceId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const spaces = useSpacesQuery().data ?? [];
  const targetSpace = targetSpaceId
    ? (spaces.find((space) => space.id === targetSpaceId) ?? null)
    : null;

  return (
    <ScreenErrorBoundary
      onReset={() => void navigate({ to: "/" })}
      screen="import"
      title="Import unavailable"
    >
      <ImportScreen
        backLabel={targetSpace?.name ?? "Space"}
        onBack={
          targetSpace
            ? () => void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpace.id } })
            : undefined
        }
        onImportComplete={async () => {
          await invalidateAllAppData(queryClient);
          notifySuccess("Import complete");
        }}
        onOpenCards={() =>
          targetSpace
            ? void navigate({ to: "/spaces/$spaceId", params: { spaceId: targetSpace.id } })
            : void navigate({ to: "/cards" })
        }
        onStudyNow={() =>
          targetSpace
            ? void navigate({ to: "/spaces/$spaceId/study", params: { spaceId: targetSpace.id } })
            : void navigate({ to: "/study" })
        }
        spaces={targetSpace ? undefined : spaces}
        targetSpaceId={targetSpace?.id ?? null}
        targetSpaceName={targetSpace?.name ?? null}
      />
    </ScreenErrorBoundary>
  );
}

export function GlobalImportPage() {
  return <ImportPage />;
}

export function SpaceImportPage() {
  const { spaceId } = useParams({ from: "/spaces/$spaceId/import" });
  return <ImportPage targetSpaceId={spaceId} />;
}
