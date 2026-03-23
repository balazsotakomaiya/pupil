import { useState } from "react";
import type { LayoutProps } from "./types";
import type { SpaceSummary } from "../lib/spaces";
import { SPACE_NAME_MAX_LENGTH } from "../lib/spaces";

const fmt = new Intl.NumberFormat();

export function LayoutHome({
  design,
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
  onCreateSpace,
  onRenameSpace,
  onDeleteSpace,
  onBeginRename,
  onCancelRename,
}: LayoutProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const spacesWithDue = spaces.filter((s) => s.dueTodayCount > 0);
  const bestStreak = spaces.reduce((max, s) => Math.max(max, s.streak), 0);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    onCreateSpace(e);
    setShowCreateForm(false);
  }

  return (
    <div className="home" data-design={design}>
      {/* ── Dashboard tiles (design E) ── */}
      <div className="dash-tiles">
        <div className={`dash-tile${totals.due > 0 ? " dash-tile--due" : ""}`}>
          <span className="dash-tile-n">{fmt.format(totals.due)}</span>
          <span className="dash-tile-k">due today</span>
        </div>
        <div className="dash-tile">
          <span className="dash-tile-n">{fmt.format(totals.spaces)}</span>
          <span className="dash-tile-k">spaces</span>
        </div>
        <div className="dash-tile">
          <span className="dash-tile-n">{fmt.format(totals.cards)}</span>
          <span className="dash-tile-k">total cards</span>
        </div>
        <div className={`dash-tile${bestStreak > 0 ? " dash-tile--streak" : ""}`}>
          <span className="dash-tile-n">{bestStreak > 0 ? `${bestStreak}d` : "—"}</span>
          <span className="dash-tile-k">streak</span>
        </div>
      </div>

      {/* ── Study banner ── */}
      <div className={`study-banner${totals.due > 0 ? " study-banner--due" : " study-banner--ok"}`}>
        <div className="study-banner-left">
          {totals.due > 0 ? (
            <>
              <span className="study-count">{fmt.format(totals.due)}</span>
              <div className="study-banner-text">
                <span className="study-banner-headline">cards due today</span>
                <span className="study-banner-sub">
                  across {spacesWithDue.length} space
                  {spacesWithDue.length !== 1 ? "s" : ""}
                  {bestStreak > 0 && (
                    <> · <span className="streak-inline">🔥 {bestStreak} day streak</span></>
                  )}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="study-ok-mark">✓</span>
              <div className="study-banner-text">
                <span className="study-banner-headline study-headline--ok">All caught up</span>
                <span className="study-banner-sub">
                  Nothing due right now
                  {bestStreak > 0 && (
                    <> · <span className="streak-inline streak-inline--ok">🔥 {bestStreak} day streak</span></>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="study-banner-right">
          <div className="study-global-stats">
            <span className="study-global-stat">
              <span className="study-global-n">{fmt.format(totals.cards)}</span>
              <span className="study-global-k">total cards</span>
            </span>
            <span className="study-global-sep" />
            <span className="study-global-stat">
              <span className="study-global-n">—</span>
              <span className="study-global-k">studied today</span>
            </span>
          </div>
          <button
            className="btn-study-all"
            disabled
            title="Global study sessions coming in Chunk 6"
          >
            {totals.due > 0 ? `Study all · ${fmt.format(totals.due)}` : "Study all"}
          </button>
        </div>
      </div>

      {/* ── Spaces header ── */}
      <div className="spaces-header">
        <span className="spaces-eyebrow">Spaces</span>
        <button
          className="btn-new-space"
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          disabled={Boolean(bootstrapError)}
        >
          {showCreateForm ? "Cancel" : "+ New space"}
        </button>
      </div>

      {/* ── Create form ── */}
      {showCreateForm && (
        <form className="create-space-form" onSubmit={handleCreate}>
          <input
            className="input"
            type="text"
            placeholder="e.g. Japanese, Systems Design, Piano..."
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            maxLength={SPACE_NAME_MAX_LENGTH}
            disabled={isCreating || Boolean(bootstrapError)}
            autoFocus
          />
          <div className="row-actions">
            <button
              className="button button-primary"
              type="submit"
              disabled={isCreating || !createName.trim() || Boolean(bootstrapError)}
            >
              {isCreating ? "Creating..." : "Create space"}
            </button>
            <button
              className="button button-ghost"
              type="button"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Spaces ── */}
      {isLoadingSpaces ? (
        <SpacesSkeleton />
      ) : spaces.length === 0 ? (
        <EmptySpaces
          bootstrapError={bootstrapError}
          onNewSpace={() => setShowCreateForm(true)}
        />
      ) : (
        <ul className="spaces-list">
          {spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              isEditing={editingSpaceId === space.id}
              editingName={editingName}
              setEditingName={setEditingName}
              isBusy={busySpaceId === space.id}
              anyBusy={busySpaceId !== null}
              bootstrapError={bootstrapError}
              onBeginRename={() => onBeginRename(space)}
              onCancelRename={onCancelRename}
              onRename={(e) => void onRenameSpace(e, space.id)}
              onDelete={() => void onDeleteSpace(space)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Space card ───────────────────────────────────────────────────────────────

interface SpaceCardProps {
  space: SpaceSummary;
  isEditing: boolean;
  editingName: string;
  setEditingName: (v: string) => void;
  isBusy: boolean;
  anyBusy: boolean;
  bootstrapError: string | null;
  onBeginRename: () => void;
  onCancelRename: () => void;
  onRename: (e: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}

function SpaceCard({
  space,
  isEditing,
  editingName,
  setEditingName,
  isBusy,
  anyBusy,
  bootstrapError,
  onBeginRename,
  onCancelRename,
  onRename,
  onDelete,
}: SpaceCardProps) {
  const hasDue = space.dueTodayCount > 0;
  const hasCards = space.cardCount > 0;

  return (
    <li className={`space-card${hasDue ? " space-card--due" : ""}`}>
      {isEditing ? (
        /* ── Rename form ── */
        <form className="space-card-rename" onSubmit={onRename}>
          <input
            className="input"
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            maxLength={SPACE_NAME_MAX_LENGTH}
            disabled={isBusy}
            autoFocus
          />
          <div className="row-actions">
            <button className="button button-primary" type="submit" disabled={isBusy}>
              {isBusy ? "Saving..." : "Save"}
            </button>
            <button
              className="button button-ghost"
              type="button"
              onClick={onCancelRename}
              disabled={isBusy}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* ── Header row ── */}
          <div className="space-card-head">
            <div className="space-card-identity">
              <h3 className="space-name">{space.name}</h3>
              {hasDue && (
                <span className="due-chip">{fmt.format(space.dueTodayCount)} due</span>
              )}
            </div>
            <button
              className={`btn-study-space${hasDue ? " btn-study-space--active" : ""}`}
              disabled
              title={
                !hasCards
                  ? "Add cards first"
                  : !hasDue
                    ? "Nothing due right now"
                    : "Study sessions coming in Chunk 6"
              }
            >
              {!hasCards
                ? "No cards yet"
                : hasDue
                  ? `Study · ${fmt.format(space.dueTodayCount)}`
                  : "Up to date"}
            </button>
          </div>

          {/* ── Stats row ── */}
          <div className="space-stats">
            <div className="space-stat">
              <span className="space-stat-n">{fmt.format(space.cardCount)}</span>
              <span className="space-stat-k">cards</span>
            </div>
            <span className="space-stat-sep" />
            <div className={`space-stat${hasDue ? " space-stat--due" : ""}`}>
              <span className="space-stat-n">{fmt.format(space.dueTodayCount)}</span>
              <span className="space-stat-k">due today</span>
            </div>
            <span className="space-stat-sep" />
            <div className={`space-stat${space.streak > 0 ? " space-stat--streak" : ""}`}>
              <span className="space-stat-n">
                {space.streak > 0 ? `${space.streak}d` : "—"}
              </span>
              <span className="space-stat-k">streak</span>
            </div>
            <span className="space-stat-sep" />
            <div className="space-stat space-stat--muted">
              <span className="space-stat-n">—</span>
              <span className="space-stat-k">studied today</span>
            </div>
          </div>

          {/* ── Footer row ── */}
          <div className="space-card-foot">
            <div className="space-add-acts">
              <button
                className="add-act add-act--manual"
                disabled
                title="Manual card creation coming in Chunk 3"
              >
                <span className="add-act-icon">+</span>
                Add cards
              </button>
              <button
                className="add-act add-act--import"
                disabled
                title="Anki import coming in Chunk 4"
              >
                <span className="add-act-icon">↑</span>
                Import Anki
              </button>
              <button
                className="add-act add-act--ai"
                disabled
                title="AI generation coming in Chunk 5"
              >
                <span className="add-act-icon">✦</span>
                Generate
              </button>
            </div>
            <div className="space-mgmt">
              <button
                className="mgmt-btn"
                type="button"
                onClick={onBeginRename}
                disabled={Boolean(bootstrapError) || anyBusy}
              >
                Rename
              </button>
              <button
                className="mgmt-btn mgmt-btn--danger"
                type="button"
                onClick={onDelete}
                disabled={Boolean(bootstrapError) || anyBusy}
              >
                {isBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SpacesSkeleton() {
  return (
    <div className="spaces-skeleton">
      {[0, 1].map((i) => (
        <div key={i} className="space-card space-card--skeleton">
          <div className="space-card-head">
            <div className="skel skel--name" />
            <div className="skel skel--btn" />
          </div>
          <div className="space-stats">
            <div className="skel skel--stats" />
          </div>
          <div className="space-card-foot">
            <div className="skel skel--actions" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptySpaces({
  onNewSpace,
  bootstrapError,
}: {
  onNewSpace: () => void;
  bootstrapError: string | null;
}) {
  return (
    <div className="empty-spaces">
      <div className="empty-spaces-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25">
          <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      </div>
      <p className="empty-spaces-title">No spaces yet</p>
      <p className="empty-spaces-sub">
        Create a space to start organizing cards into focused study topics. You can add cards
        manually, import from Anki, or generate them with AI.
      </p>
      <div className="empty-spaces-actions">
        <button
          className="button button-primary"
          type="button"
          onClick={onNewSpace}
          disabled={Boolean(bootstrapError)}
        >
          + Create your first space
        </button>
        <button className="button button-ghost" disabled title="Anki import coming in Chunk 4">
          ↑ Import from Anki
        </button>
      </div>
    </div>
  );
}
