import { useEffect, useMemo, useRef, useState } from "react";
import type { SpaceSummary } from "../../lib/spaces";
import { CloseIcon } from "../dashboard/CloseIcon";

type CardDraft = {
  back: string;
  front: string;
  spaceId: string;
  tagsText: string;
};

type CardFormPanelProps = {
  draft: CardDraft;
  error: string | null;
  hasSelectedCard: boolean;
  isDeleting: boolean;
  isOpen: boolean;
  isSubmitting: boolean;
  onChange: (patch: Partial<CardDraft>) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (options: { keepOpen: boolean }) => void;
  successPulseTick?: number;
  spaces: SpaceSummary[];
};

const FRONT_LIMIT = 30;
const BACK_LIMIT = 60;

export function CardFormPanel({
  draft,
  error,
  hasSelectedCard,
  isDeleting,
  isOpen,
  isSubmitting,
  onChange,
  onClose,
  onDelete,
  onSubmit,
  successPulseTick = 0,
  spaces,
}: CardFormPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLTextAreaElement>(null);
  const lastHandledPulseTick = useRef(0);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [makeAnother, setMakeAnother] = useState(true);
  const [isSuccessPulsing, setIsSuccessPulsing] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");

  const tags = useMemo(() => parseTags(draft.tagsText), [draft.tagsText]);
  const selectedSpaceName = spaces.find((space) => space.id === draft.spaceId)?.name ?? "Space";
  const frontWordCount = wordCount(draft.front);
  const backWordCount = wordCount(draft.back);

  useEffect(() => {
    if (!isOpen) {
      setTagInputValue("");
      setIsPreviewHovered(false);
      setMakeAnother(true);
      setIsSuccessPulsing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || successPulseTick === 0 || successPulseTick === lastHandledPulseTick.current) {
      return;
    }

    lastHandledPulseTick.current = successPulseTick;
    setIsSuccessPulsing(true);
    setIsPreviewHovered(false);
    dialogRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    queueMicrotask(() => frontRef.current?.focus());

    const timeout = window.setTimeout(() => setIsSuccessPulsing(false), 420);
    return () => window.clearTimeout(timeout);
  }, [isOpen, successPulseTick]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        aria-describedby={error ? "card-form-error" : "card-form-description"}
        aria-labelledby="card-form-title"
        aria-modal="true"
        className={`dialog card-dialog${isSuccessPulsing ? " success-pulse" : ""}`}
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-form new-card-dialog-form">
          <div className="new-card-sticky-top">
            <div className="new-card-head">
              <div>
                <h2 className="new-card-title" id="card-form-title">
                  {hasSelectedCard ? "Edit Card" : "New Card"}
                </h2>
                <p className="new-card-description" id="card-form-description">
                  Write a focused prompt/answer pair. Keep the front atomic and the back tight.
                </p>
              </div>
              <button aria-label="Close" className="dialog-close" onClick={onClose} type="button">
                <CloseIcon />
              </button>
            </div>

            <div className="new-card-actions-bar">
              {!hasSelectedCard ? (
                <button
                  aria-pressed={makeAnother}
                  className={`new-card-make-another${makeAnother ? " active" : ""}`}
                  onClick={() => setMakeAnother((current) => !current)}
                  type="button"
                >
                  <span className="new-card-make-another-label">Make another</span>
                  <span className="new-card-toggle-track">
                    <span className="new-card-toggle-thumb" />
                  </span>
                </button>
              ) : (
                <span />
              )}

              <div className="new-card-actions-right">
                {hasSelectedCard ? (
                  <button
                    className="new-card-discard-btn danger-btn"
                    disabled={isDeleting || isSubmitting}
                    onClick={onDelete}
                    type="button"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                ) : (
                  <button className="new-card-discard-btn" onClick={onClose} type="button">
                    Discard
                  </button>
                )}

                <button
                  className="new-card-save-btn"
                  disabled={isSubmitting || isDeleting}
                  onClick={() => onSubmit({ keepOpen: !hasSelectedCard && makeAnother })}
                  type="button"
                >
                  <SaveIcon />
                  {isSubmitting
                    ? hasSelectedCard
                      ? "Saving..."
                      : "Creating..."
                    : hasSelectedCard
                      ? "Save changes"
                      : "Save card"}
                </button>
              </div>
            </div>
          </div>

          <div className="new-card-editor-section">
            <div className="new-card-editor-pair">
              <div className="new-card-field-block">
                <div className="new-card-field-chrome">
                  <span className="new-card-field-label">Front</span>
                  <span
                    className={`new-card-word-count${wordCountClassName(frontWordCount, FRONT_LIMIT)}`}
                  >
                    {frontWordCount} / {FRONT_LIMIT} words
                  </span>
                </div>

                <div className="new-card-toolbar front-toolbar">
                  <button
                    className="new-card-fmt-btn"
                    onClick={() =>
                      insertFormat(frontRef.current, draft.front, onChange, "front", "**", "**")
                    }
                    title="Bold"
                    type="button"
                  >
                    <BoldIcon />
                  </button>
                  <button
                    className="new-card-fmt-btn"
                    onClick={() =>
                      insertFormat(frontRef.current, draft.front, onChange, "front", "*", "*")
                    }
                    title="Italic"
                    type="button"
                  >
                    <ItalicIcon />
                  </button>
                  <button
                    className="new-card-fmt-btn"
                    onClick={() =>
                      insertFormat(frontRef.current, draft.front, onChange, "front", "`", "`")
                    }
                    title="Code"
                    type="button"
                  >
                    <CodeIcon />
                  </button>
                  <span className="new-card-fmt-sep" />
                  <button
                    className="new-card-fmt-btn"
                    onClick={() =>
                      insertCloze(
                        frontRef.current,
                        backRef.current,
                        draft.front,
                        draft.back,
                        onChange,
                      )
                    }
                    title="Cloze"
                    type="button"
                  >
                    <ClozeIcon />
                  </button>
                  <span className="new-card-fmt-hint">Markdown</span>
                </div>

                <textarea
                  className="new-card-textarea front"
                  onChange={(event) => onChange({ front: event.target.value })}
                  placeholder="A clear, single question or prompt..."
                  ref={frontRef}
                  rows={4}
                  value={draft.front}
                />

                <div
                  className={`new-card-limit-guidance${frontWordCount > FRONT_LIMIT ? " over" : ""}`}
                >
                  {frontWordCount > FRONT_LIMIT
                    ? `${frontWordCount - FRONT_LIMIT} word${frontWordCount - FRONT_LIMIT === 1 ? "" : "s"} over. Can this be tighter?`
                    : "One question. One concept. No compound prompts."}
                </div>
              </div>

              <div className="new-card-field-block">
                <div className="new-card-field-chrome">
                  <span className="new-card-field-label">Back</span>
                  <span
                    className={`new-card-word-count${wordCountClassName(backWordCount, BACK_LIMIT)}`}
                  >
                    {backWordCount} / {BACK_LIMIT} words
                  </span>
                </div>

                <div className="new-card-toolbar">
                  <button
                    className="new-card-fmt-btn"
                    onClick={() =>
                      insertFormat(backRef.current, draft.back, onChange, "back", "**", "**")
                    }
                    title="Bold"
                    type="button"
                  >
                    <BoldIcon />
                  </button>
                  <button
                    className="new-card-fmt-btn"
                    onClick={() =>
                      insertFormat(backRef.current, draft.back, onChange, "back", "*", "*")
                    }
                    title="Italic"
                    type="button"
                  >
                    <ItalicIcon />
                  </button>
                  <button
                    className="new-card-fmt-btn"
                    onClick={() =>
                      insertFormat(backRef.current, draft.back, onChange, "back", "`", "`")
                    }
                    title="Code"
                    type="button"
                  >
                    <CodeIcon />
                  </button>
                  <span className="new-card-fmt-hint">Markdown</span>
                </div>

                <textarea
                  className="new-card-textarea back"
                  onChange={(event) => onChange({ back: event.target.value })}
                  placeholder="A direct answer. Just enough context to be unambiguous..."
                  ref={backRef}
                  rows={7}
                  value={draft.back}
                />

                <div
                  className={`new-card-limit-guidance${backWordCount > BACK_LIMIT ? " over" : ""}`}
                >
                  {backWordCount > BACK_LIMIT
                    ? `${backWordCount - BACK_LIMIT} word${backWordCount - BACK_LIMIT === 1 ? "" : "s"} over. Try splitting into two cards.`
                    : "Answer the front, then stop. If you need a paragraph, the card is too broad."}
                </div>
              </div>
            </div>
          </div>

          <div className="new-card-tags-section">
            <div className="new-card-section-chrome">
              <span className="new-card-field-label">Tags</span>
              <span className="new-card-word-count subdued">optional</span>
            </div>
            <div className="new-card-tags-input-wrap">
              {tags.map((tag) => (
                <span className="new-card-tag-pill" key={tag}>
                  {tag}
                  <button
                    className="new-card-tag-remove"
                    onClick={() =>
                      onChange({ tagsText: tags.filter((item) => item !== tag).join(", ") })
                    }
                    type="button"
                  >
                    <TagRemoveIcon />
                  </button>
                </span>
              ))}
              <input
                className="new-card-tag-input"
                onChange={(event) => setTagInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    const nextTag = normalizeTag(tagInputValue);

                    if (!nextTag || tags.includes(nextTag)) {
                      setTagInputValue("");
                      return;
                    }

                    onChange({ tagsText: [...tags, nextTag].join(", ") });
                    setTagInputValue("");
                  }

                  if (event.key === "Backspace" && !tagInputValue && tags.length > 0) {
                    onChange({ tagsText: tags.slice(0, -1).join(", ") });
                  }
                }}
                placeholder="Add tag..."
                value={tagInputValue}
              />
            </div>
          </div>

          <div className="new-card-space-section">
            <div className="new-card-section-chrome">
              <span className="new-card-field-label">Space</span>
            </div>
            <div className="new-card-select-wrap">
              <select
                className="new-card-select-input"
                onChange={(event) => onChange({ spaceId: event.target.value })}
                value={draft.spaceId}
              >
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              <span className="new-card-select-chevron">
                <ChevronIcon />
              </span>
            </div>
          </div>

          {error ? (
            <p className="field-error new-card-error" id="card-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ruler-divider new-card-divider" />

          <div className="new-card-preview-section">
            <div className="new-card-preview-header">
              <span className="new-card-preview-label">Preview</span>
              <span className="new-card-preview-hint">
                <PreviewFlipIcon />
                Hover to flip
              </span>
            </div>

            <div
              className={`new-card-scene${isPreviewHovered ? " hovered" : ""}`}
              onMouseEnter={() => setIsPreviewHovered(true)}
              onMouseLeave={() => setIsPreviewHovered(false)}
            >
              <div
                className={`new-card-body${isPreviewHovered ? " hovered" : ""}`}
                role="presentation"
              >
                <div className="new-card-face new-card-face-front">
                  <span className="new-card-corner tl">front</span>
                  <div className="new-card-face-inner">
                    <div
                      className="new-card-face-text"
                      dangerouslySetInnerHTML={{
                        __html: renderPreviewHtml(draft.front, "Start typing..."),
                      }}
                    />
                  </div>
                  {tags.length > 0 ? (
                    <div className="new-card-face-tags">
                      {tags.map((tag) => (
                        <span className="new-card-face-tag" key={`preview-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="new-card-corner br">{selectedSpaceName}</span>
                </div>

                <div className="new-card-face new-card-face-back">
                  <span className="new-card-corner tl">back</span>
                  <div className="new-card-face-inner">
                    <div
                      className="new-card-face-text back"
                      dangerouslySetInnerHTML={{
                        __html: renderPreviewHtml(draft.back, "Start typing..."),
                      }}
                    />
                  </div>
                  <span className="new-card-corner br">{selectedSpaceName}</span>
                </div>
              </div>
            </div>

            <div className="new-card-dots">
              <span className={`new-card-dot${!isPreviewHovered ? " active" : ""}`} />
              <span className={`new-card-dot${isPreviewHovered ? " active" : ""}`} />
            </div>
          </div>

          <div className="new-card-opinion-box">
            <div className="new-card-opinion-title">What makes a good card</div>
            <div className="new-card-opinion-list">
              <div className="new-card-opinion-item">
                <span className="new-card-opinion-bullet" />
                <span>
                  <strong>Front: 30 words max.</strong> One question testing one atomic piece of
                  knowledge.
                </span>
              </div>
              <div className="new-card-opinion-item">
                <span className="new-card-opinion-bullet" />
                <span>
                  <strong>Back: 60 words max.</strong> A direct answer with just enough context.
                </span>
              </div>
              <div className="new-card-opinion-item">
                <span className="new-card-opinion-bullet" />
                <span>
                  <strong>Use formatting sparingly.</strong> Bold a key term, code-wrap a function,
                  and keep it scannable.
                </span>
              </div>
              <div className="new-card-opinion-item">
                <span className="new-card-opinion-bullet" />
                <span>
                  <strong>Cloze cards:</strong> use <code>_____</code> on the front and put the
                  answer on the back.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function wordCount(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function wordCountClassName(count: number, limit: number): string {
  if (count > limit) {
    return " over";
  }

  if (count > limit * 0.8) {
    return " warn";
  }

  return "";
}

function normalizeTag(value: string): string {
  return value.trim().replace(/,/g, "").toLowerCase();
}

function parseTags(tagsText: string): string[] {
  return tagsText
    .split(",")
    .map((tag) => normalizeTag(tag))
    .filter((tag, index, allTags) => tag.length > 0 && allTags.indexOf(tag) === index);
}

function insertFormat(
  element: HTMLTextAreaElement | null,
  value: string,
  onChange: (patch: Partial<CardDraft>) => void,
  field: "front" | "back",
  prefix: string,
  suffix: string,
) {
  if (!element) {
    return;
  }

  const start = element.selectionStart;
  const end = element.selectionEnd;
  const selection = value.slice(start, end);
  const nextValue = selection
    ? `${value.slice(0, start)}${prefix}${selection}${suffix}${value.slice(end)}`
    : `${value.slice(0, start)}${prefix}${suffix}${value.slice(end)}`;
  const caretPosition = start + prefix.length;

  onChange({ [field]: nextValue });

  queueMicrotask(() => {
    element.focus();
    const selectionEnd = selection ? end + prefix.length : caretPosition;
    element.setSelectionRange(caretPosition, selectionEnd);
  });
}

function insertCloze(
  frontElement: HTMLTextAreaElement | null,
  backElement: HTMLTextAreaElement | null,
  frontValue: string,
  backValue: string,
  onChange: (patch: Partial<CardDraft>) => void,
) {
  if (!frontElement) {
    return;
  }

  const start = frontElement.selectionStart;
  const end = frontElement.selectionEnd;
  const selection = frontValue.slice(start, end).trim();
  const nextFront = `${frontValue.slice(0, start)}_____${frontValue.slice(end)}`;
  const patch: Partial<CardDraft> = { front: nextFront };

  if (selection && !backValue.trim()) {
    patch.back = selection;
  }

  onChange(patch);

  queueMicrotask(() => {
    frontElement.focus();
    frontElement.setSelectionRange(start + 5, start + 5);
    if (selection && !backValue.trim() && backElement) {
      backElement.focus();
      backElement.setSelectionRange(selection.length, selection.length);
    }
  });
}

function renderPreviewHtml(value: string, emptyLabel: string): string {
  if (!value.trim()) {
    return `<span class="new-card-face-empty">${emptyLabel}</span>`;
  }

  const escaped = escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/_____/g, '<span class="new-card-cloze-blank"></span>')
    .replace(/\n/g, "<br>");

  return escaped;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2.5 7l3 3 6-6.5" />
    </svg>
  );
}

function BoldIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5h4.5a3 3 0 011.93 5.3A3.25 3.25 0 019.25 14H4V2.5zm2 2V7h2.5a1 1 0 000-2H6zm0 4.5v3h3.25a1.25 1.25 0 000-2.5H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path
        d="M6 2.5h6M4 13.5h6M9.5 2.5L6.5 13.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    >
      <path d="M5.5 4L2.5 8l3 4M10.5 4l3 4-3 4" />
    </svg>
  );
}

function ClozeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
    >
      <path d="M2 12h3M6.5 12h3M11.5 12h2.5" />
      <path d="M4.5 8H11.5" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5.5l3 3 3-3" />
    </svg>
  );
}

function TagRemoveIcon() {
  return (
    <svg viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" />
    </svg>
  );
}

function PreviewFlipIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M2 5l3-3 3 3" />
      <path d="M5 2v8a3 3 0 003 3h1" />
    </svg>
  );
}
