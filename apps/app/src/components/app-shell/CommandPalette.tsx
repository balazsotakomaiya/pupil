import { useEffect, useRef, useState } from "react";
import type { CardRecord } from "../../lib/cards";
import type { SpaceSummary } from "../../lib/spaces";
import type { AppTabId } from "./AppTitlebar";

type CommandPaletteProps = {
  cards: CardRecord[];
  onClose: () => void;
  onOpenAiGenerate: () => void;
  onOpenCreateDialog: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenSpace: (spaceId: string) => void;
  onSelectTab: (tab: AppTabId) => void;
  onStartGlobalStudy: () => void;
  spaces: SpaceSummary[];
};

type PaletteItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof ICONS;
  badge?: string;
  shortcut?: string;
  onSelect: () => void;
};

type ScopeId = "actions" | "spaces" | "cards" | "navigate";

const SCOPES: Array<{ id: ScopeId; label: string }> = [
  { id: "actions", label: "Actions" },
  { id: "spaces", label: "Spaces" },
  { id: "cards", label: "Cards" },
  { id: "navigate", label: "Navigate" },
];

const CARD_STATE_BADGE: Record<number, string> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

const ICONS = {
  study: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 4v3.5l2 1.5" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 3v8M3 7h8" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M7 1l1.5 4L13 7l-4.5 2L7 13 5.5 9 1 7l4.5-2z" />
    </svg>
  ),
  import: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M10 8.5v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3" />
      <path d="M7 2v7.5" />
      <path d="M5 7l2 2.5L9 7" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" />
    </svg>
  ),
  space: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="2" width="10" height="10" rx="2.5" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="3" width="10" height="8" rx="1.5" />
      <path d="M4.5 6h5M4.5 8.5h3" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="1" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 3.5h10M2 7h7M2 10.5h9" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 2l4 4-4 4" />
    </svg>
  ),
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="palette-match">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CommandPalette({
  cards,
  onClose,
  onOpenAiGenerate,
  onOpenCreateDialog,
  onOpenImport,
  onOpenSettings,
  onOpenSpace,
  onSelectTab,
  onStartGlobalStudy,
  spaces,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [scopeIdx, setScopeIdx] = useState<number>(-1); // -1 = no scope
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const totalDue = spaces.reduce((sum, s) => sum + s.dueTodayCount, 0);
  const totalCards = spaces.reduce((sum, s) => sum + s.cardCount, 0);

  const activeScope: ScopeId | null = scopeIdx >= 0 ? SCOPES[scopeIdx].id : null;

  const allGroups: Array<{ id: ScopeId; label: string; items: PaletteItem[] }> = [
    {
      id: "actions",
      label: "Actions",
      items: [
        {
          id: "study-all",
          title: "Study all due cards",
          subtitle:
            totalDue > 0
              ? `${totalDue} card${totalDue === 1 ? "" : "s"} across ${spaces.length} space${spaces.length === 1 ? "" : "s"}`
              : "No cards due right now",
          icon: "study",
          onSelect() {
            onClose();
            onStartGlobalStudy();
          },
        },
        {
          id: "new-space",
          title: "New Space",
          subtitle: "Create an empty space",
          icon: "plus",
          onSelect() {
            onClose();
            onOpenCreateDialog();
          },
        },
        {
          id: "ai-generate",
          title: "AI Generate",
          subtitle: "Generate cards with AI",
          icon: "sparkle",
          onSelect() {
            onClose();
            onOpenAiGenerate();
          },
        },
        {
          id: "import",
          title: "Import .apkg",
          subtitle: "Import from Anki",
          icon: "import",
          onSelect() {
            onClose();
            onOpenImport();
          },
        },
        {
          id: "settings",
          title: "Settings",
          subtitle: "AI provider, data, shortcuts",
          icon: "settings",
          shortcut: "⌘,",
          onSelect() {
            onClose();
            onOpenSettings();
          },
        },
      ],
    },
    {
      id: "spaces",
      label: "Spaces",
      items: spaces.map((space) => ({
        id: `space-${space.id}`,
        title: space.name,
        subtitle: `${space.cardCount} card${space.cardCount === 1 ? "" : "s"} · ${space.dueTodayCount} due`,
        icon: "space" as const,
        onSelect() {
          onClose();
          onOpenSpace(space.id);
        },
      })),
    },
    {
      id: "cards",
      label: "Cards",
      items: cards.slice(0, 50).map((card) => ({
        id: `card-${card.id}`,
        title: card.front,
        subtitle: card.spaceName ?? card.spaceId,
        icon: "card" as const,
        badge: CARD_STATE_BADGE[card.state] ?? "New",
        onSelect() {
          onClose();
          onOpenSpace(card.spaceId);
        },
      })),
    },
    {
      id: "navigate",
      label: "Navigate",
      items: [
        {
          id: "nav-dashboard",
          title: "Dashboard",
          subtitle: "Home screen",
          icon: "grid" as const,
          onSelect() {
            onClose();
            onSelectTab("dashboard");
          },
        },
        {
          id: "nav-cards",
          title: "All Cards",
          subtitle: `${totalCards} card${totalCards === 1 ? "" : "s"} total`,
          icon: "list" as const,
          onSelect() {
            onClose();
            onSelectTab("cards");
          },
        },
        {
          id: "nav-import",
          title: "Import",
          subtitle: "Anki import",
          icon: "import" as const,
          onSelect() {
            onClose();
            onOpenImport();
          },
        },
      ],
    },
  ];

  const q = query.trim().toLowerCase();

  const visibleGroups = allGroups
    .filter((group) => activeScope === null || group.id === activeScope)
    .map((group) => ({
      ...group,
      items: q
        ? group.items.filter(
            (item) =>
              item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q),
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0);

  const flatItems = visibleGroups.flatMap((group) => group.items);
  const safeSelectedIdx = Math.min(selectedIdx, Math.max(0, flatItems.length - 1));

  function selectAndScroll(idx: number) {
    setSelectedIdx(idx);
    requestAnimationFrame(() => {
      const el = resultsRef.current?.querySelector(`[data-idx="${idx}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query, scopeIdx]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "ArrowDown") {
        e.preventDefault();
        selectAndScroll(Math.min(flatItems.length - 1, safeSelectedIdx + 1));
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        selectAndScroll(Math.max(0, safeSelectedIdx - 1));
      } else if (e.code === "Enter") {
        e.preventDefault();
        flatItems[safeSelectedIdx]?.onSelect();
      } else if (e.code === "Escape") {
        if (activeScope !== null) {
          setScopeIdx(-1);
        } else {
          onClose();
        }
      } else if (e.code === "Tab") {
        e.preventDefault();
        setScopeIdx((prev) => {
          const next = prev + 1;
          return next >= SCOPES.length ? -1 : next;
        });
      } else if (e.code === "Backspace" && query === "" && activeScope !== null) {
        setScopeIdx(-1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flatItems, safeSelectedIdx, activeScope, query, onClose]);

  let flatIdx = 0;

  return (
    <div
      className="palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        {/* Input row */}
        <div className="palette-input-wrap">
          <div className="palette-input-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
          </div>

          {activeScope !== null && (
            <div className="palette-scope-chip">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="1.5" y="1.5" width="9" height="9" rx="2" />
              </svg>
              <span>{SCOPES[scopeIdx].label}</span>
              <span className="palette-scope-sep">›</span>
            </div>
          )}

          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeScope !== null
                ? `Search ${SCOPES[scopeIdx].label.toLowerCase()}…`
                : "Search cards, spaces, or actions…"
            }
            autoComplete="off"
            spellCheck={false}
          />

          <div className="palette-input-shortcut">
            <span className="palette-kbd">esc</span>
          </div>
        </div>

        {/* Results */}
        <div className="palette-results" ref={resultsRef}>
          {flatItems.length === 0 ? (
            <div className="palette-empty">
              <span className="palette-empty-text">No results for "{query}"</span>
            </div>
          ) : (
            visibleGroups.map((group) => (
              <div className="palette-group" key={group.id}>
                <div className="palette-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const idx = flatIdx++;
                  const isSelected = idx === safeSelectedIdx;
                  return (
                    <div
                      key={item.id}
                      className={`palette-item${isSelected ? " selected" : ""}`}
                      data-idx={idx}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => item.onSelect()}
                    >
                      <div className="palette-item-icon">{ICONS[item.icon]}</div>
                      <div className="palette-item-content">
                        <div className="palette-item-title">{highlight(item.title, q)}</div>
                        {item.subtitle && (
                          <div className="palette-item-subtitle">{highlight(item.subtitle, q)}</div>
                        )}
                      </div>
                      <div className="palette-item-meta">
                        {item.badge && <span className="palette-item-badge">{item.badge}</span>}
                        {item.shortcut && (
                          <div className="palette-item-shortcut">
                            {item.shortcut.split("").map((k, i) => (
                              <span className="palette-kbd" key={i}>
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="palette-item-arrow">{ICONS.arrow}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="palette-footer">
          <div className="palette-footer-hints">
            <div className="palette-footer-hint">
              <span className="palette-kbd">↑</span>
              <span className="palette-kbd">↓</span>
              Navigate
            </div>
            <div className="palette-footer-hint">
              <span className="palette-kbd">↵</span>
              Open
            </div>
            <div className="palette-footer-hint">
              <span className="palette-kbd">tab</span>
              Scope
            </div>
          </div>
          <div className="palette-footer-logo">⌘K</div>
        </div>
      </div>
    </div>
  );
}
