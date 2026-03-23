import { useEffect, useMemo, useState, type FormEvent } from "react";
import { loadBootstrapState, type BootstrapState } from "./lib/bootstrap";
import {
  createSpace,
  deleteSpace,
  listSpaces,
  renameSpace,
  type SpaceSummary,
} from "./lib/spaces";
import type { LayoutProps, DesignId } from "./layouts/types";
import { LayoutHome } from "./layouts/LayoutHome";
import { DebugBar } from "./components/DebugBar";

const isDev = import.meta.env.DEV;
const DESIGN_KEY = "pupil:debug:design";
const DEFAULT_DESIGN: DesignId = "A";

export default function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [spacesError, setSpacesError] = useState<string | null>(null);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [createName, setCreateName] = useState("");
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [busySpaceId, setBusySpaceId] = useState<string | null>(null);
  const [activeDesign, setActiveDesign] = useState<DesignId>(() =>
    isDev ? ((localStorage.getItem(DESIGN_KEY) as DesignId) ?? DEFAULT_DESIGN) : DEFAULT_DESIGN,
  );

  function handleDesignChange(id: DesignId) {
    setActiveDesign(id);
    localStorage.setItem(DESIGN_KEY, id);
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const nextBootstrapState = await loadBootstrapState();

        if (cancelled) return;
        setBootstrapState(nextBootstrapState);

        try {
          const nextSpaces = await listSpaces();
          if (!cancelled) setSpaces(nextSpaces);
        } catch (nextError: unknown) {
          if (!cancelled) {
            setSpacesError(nextError instanceof Error ? nextError.message : "Failed to load spaces");
          }
        }
      } catch (nextError: unknown) {
        if (!cancelled) {
          setBootstrapError(
            nextError instanceof Error ? nextError.message : "Failed to load app state",
          );
        }
      } finally {
        if (!cancelled) setIsLoadingSpaces(false);
      }
    }

    void initialize();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(
    () =>
      spaces.reduce(
        (acc, space) => ({
          spaces: acc.spaces + 1,
          cards: acc.cards + space.cardCount,
          due: acc.due + space.dueTodayCount,
        }),
        { spaces: 0, cards: 0, due: 0 },
      ),
    [spaces],
  );

  async function refreshSpaces() {
    const nextSpaces = await listSpaces();
    setSpaces(nextSpaces);
  }

  async function handleCreateSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSpacesError(null);
    setIsCreating(true);
    try {
      await createSpace({ name: createName });
      await refreshSpaces();
      setCreateName("");
    } catch (nextError: unknown) {
      setSpacesError(nextError instanceof Error ? nextError.message : "Failed to create space");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRenameSpace(event: FormEvent<HTMLFormElement>, spaceId: string) {
    event.preventDefault();
    setSpacesError(null);
    setBusySpaceId(spaceId);
    try {
      await renameSpace({ id: spaceId, name: editingName });
      await refreshSpaces();
      setEditingSpaceId(null);
      setEditingName("");
    } catch (nextError: unknown) {
      setSpacesError(nextError instanceof Error ? nextError.message : "Failed to rename space");
    } finally {
      setBusySpaceId(null);
    }
  }

  async function handleDeleteSpace(space: SpaceSummary) {
    const confirmed = window.confirm(
      `Delete "${space.name}"? This will also remove its cards and study history.`,
    );
    if (!confirmed) return;
    setSpacesError(null);
    setBusySpaceId(space.id);
    try {
      await deleteSpace({ id: space.id });
      await refreshSpaces();
      if (editingSpaceId === space.id) {
        setEditingSpaceId(null);
        setEditingName("");
      }
    } catch (nextError: unknown) {
      setSpacesError(nextError instanceof Error ? nextError.message : "Failed to delete space");
    } finally {
      setBusySpaceId(null);
    }
  }

  const layoutProps: LayoutProps = {
    design: activeDesign,
    spaces,
    totals,
    isLoadingSpaces,
    createName,
    setCreateName,
    editingSpaceId,
    editingName,
    setEditingName,
    isCreating,
    busySpaceId,
    bootstrapError,
    onCreateSpace: (e) => void handleCreateSpace(e),
    onRenameSpace: (e, id) => void handleRenameSpace(e, id),
    onDeleteSpace: (space) => void handleDeleteSpace(space),
    onBeginRename: (space) => {
      setEditingSpaceId(space.id);
      setEditingName(space.name);
      setSpacesError(null);
    },
    onCancelRename: () => {
      setEditingSpaceId(null);
      setEditingName("");
    },
  };

  return (
    <main className="app-shell">
      {isDev && (
        <DebugBar
          bootstrapState={bootstrapState}
          activeDesign={activeDesign}
          onDesignChange={handleDesignChange}
        />
      )}

      <header className="page-header">
        <h1 className="page-title">Pupil</h1>
        <div className="header-right">
          <button
            className="btn-settings"
            disabled
            title="AI provider settings coming in Chunk 9"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {bootstrapError ? (
        <div className="status-banner status-error">
          <strong>Bootstrap failed.</strong>
          <span>{bootstrapError}</span>
        </div>
      ) : null}

      {spacesError ? (
        <div className="status-banner status-error">
          <strong>Action failed.</strong>
          <span>{spacesError}</span>
        </div>
      ) : null}

      <LayoutHome {...layoutProps} />
    </main>
  );
}
