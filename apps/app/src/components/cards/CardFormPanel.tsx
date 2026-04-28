import { useEffect, useMemo, useRef, useState } from "react";
import type { SpaceSummary } from "../../lib/spaces";
import { CloseIcon } from "../dashboard/CloseIcon";
import styles from "./CardFormPanel.module.css";

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
  const [shakeKey, setShakeKey] = useState(0);

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
      setShakeKey(0);
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

  const isDraftClean = !draft.front.trim() && !draft.back.trim() && !draft.tagsText.trim();

  function handleBackdropClick() {
    if (isDraftClean && !hasSelectedCard) {
      onClose();
      return;
    }
    setShakeKey((k) => k + 1);
  }

  return (
    <div className={styles.cardBackdrop} onClick={handleBackdropClick} role="presentation">
      <div
        aria-describedby={error ? "card-form-error" : "card-form-description"}
        aria-labelledby="card-form-title"
        aria-modal="true"
        className={`${styles.cardDialog}${isSuccessPulsing ? ` ${styles.successPulse}` : ""}`}
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className={styles.newCardDialogForm}>
          <div className={styles.newCardStickyTop}>
            <div className={styles.newCardHead}>
              <div>
                <h2 className={styles.newCardTitle} id="card-form-title">
                  {hasSelectedCard ? "Edit Card" : "New Card"}
                </h2>
                <p className={styles.newCardDescription} id="card-form-description">
                  Write a focused prompt/answer pair. Keep the front atomic and the back tight.
                </p>
              </div>
              <button
                aria-label="Close"
                className={styles.newCardCloseButton}
                onClick={onClose}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>

            <div className={styles.newCardActionsBar}>
              {!hasSelectedCard ? (
                <button
                  aria-pressed={makeAnother}
                  className={`${styles.newCardMakeAnother}${makeAnother ? ` ${styles.active}` : ""}`}
                  onClick={() => setMakeAnother((current) => !current)}
                  type="button"
                >
                  <span className={styles.newCardMakeAnotherLabel}>Make another</span>
                  <span className={styles.newCardToggleTrack}>
                    <span className={styles.newCardToggleThumb} />
                  </span>
                </button>
              ) : (
                <span />
              )}

              <div
                className={`${styles.newCardActionsRight}${shakeKey > 0 ? ` ${styles.shake}` : ""}`}
                key={shakeKey}
              >
                {hasSelectedCard ? (
                  <button
                    className={`${styles.newCardDiscardBtn} ${styles.danger}`}
                    disabled={isDeleting || isSubmitting}
                    onClick={onDelete}
                    type="button"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                ) : (
                  <button className={styles.newCardDiscardBtn} onClick={onClose} type="button">
                    Discard
                  </button>
                )}

                <button
                  className={styles.newCardSaveBtn}
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

          <div className={styles.newCardEditorSection}>
            <div className={styles.newCardEditorPair}>
              <div className={styles.newCardFieldBlock}>
                <div className={styles.newCardFieldChrome}>
                  <span className={styles.newCardFieldLabel}>Front</span>
                  <span
                    className={`${styles.newCardWordCount}${wordCountClassName(frontWordCount, FRONT_LIMIT, styles)}`}
                  >
                    {frontWordCount} / {FRONT_LIMIT} words
                  </span>
                </div>

                <div className={`${styles.newCardToolbar} ${styles.frontToolbar}`}>
                  <button
                    className={styles.newCardFmtBtn}
                    onClick={() =>
                      insertFormat(frontRef.current, draft.front, onChange, "front", "**", "**")
                    }
                    title="Bold"
                    type="button"
                  >
                    <BoldIcon />
                  </button>
                  <button
                    className={styles.newCardFmtBtn}
                    onClick={() =>
                      insertFormat(frontRef.current, draft.front, onChange, "front", "*", "*")
                    }
                    title="Italic"
                    type="button"
                  >
                    <ItalicIcon />
                  </button>
                  <button
                    className={styles.newCardFmtBtn}
                    onClick={() =>
                      insertFormat(frontRef.current, draft.front, onChange, "front", "`", "`")
                    }
                    title="Code"
                    type="button"
                  >
                    <CodeIcon />
                  </button>
                  <span className={styles.newCardFmtSep} />
                  <button
                    className={styles.newCardFmtBtn}
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
                  <span className={styles.newCardFmtHint}>Markdown</span>
                </div>

                <textarea
                  className={`${styles.newCardTextarea} ${styles.front}`}
                  onChange={(event) => onChange({ front: event.target.value })}
                  placeholder="A clear, single question or prompt..."
                  ref={frontRef}
                  rows={4}
                  value={draft.front}
                />

                <div
                  className={`${styles.newCardLimitGuidance}${frontWordCount > FRONT_LIMIT ? ` ${styles.over}` : ""}`}
                >
                  {frontWordCount > FRONT_LIMIT
                    ? `${frontWordCount - FRONT_LIMIT} word${frontWordCount - FRONT_LIMIT === 1 ? "" : "s"} over. Can this be tighter?`
                    : "One question. One concept. No compound prompts."}
                </div>
              </div>

              <div className={styles.newCardFieldBlock}>
                <div className={styles.newCardFieldChrome}>
                  <span className={styles.newCardFieldLabel}>Back</span>
                  <span
                    className={`${styles.newCardWordCount}${wordCountClassName(backWordCount, BACK_LIMIT, styles)}`}
                  >
                    {backWordCount} / {BACK_LIMIT} words
                  </span>
                </div>

                <div className={styles.newCardToolbar}>
                  <button
                    className={styles.newCardFmtBtn}
                    onClick={() =>
                      insertFormat(backRef.current, draft.back, onChange, "back", "**", "**")
                    }
                    title="Bold"
                    type="button"
                  >
                    <BoldIcon />
                  </button>
                  <button
                    className={styles.newCardFmtBtn}
                    onClick={() =>
                      insertFormat(backRef.current, draft.back, onChange, "back", "*", "*")
                    }
                    title="Italic"
                    type="button"
                  >
                    <ItalicIcon />
                  </button>
                  <button
                    className={styles.newCardFmtBtn}
                    onClick={() =>
                      insertFormat(backRef.current, draft.back, onChange, "back", "`", "`")
                    }
                    title="Code"
                    type="button"
                  >
                    <CodeIcon />
                  </button>
                  <span className={styles.newCardFmtHint}>Markdown</span>
                </div>

                <textarea
                  className={`${styles.newCardTextarea} ${styles.back}`}
                  onChange={(event) => onChange({ back: event.target.value })}
                  placeholder="A direct answer. Just enough context to be unambiguous..."
                  ref={backRef}
                  rows={7}
                  value={draft.back}
                />

                <div
                  className={`${styles.newCardLimitGuidance}${backWordCount > BACK_LIMIT ? ` ${styles.over}` : ""}`}
                >
                  {backWordCount > BACK_LIMIT
                    ? `${backWordCount - BACK_LIMIT} word${backWordCount - BACK_LIMIT === 1 ? "" : "s"} over. Try splitting into two cards.`
                    : "Answer the front, then stop. If you need a paragraph, the card is too broad."}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.newCardTagsSection}>
            <div className={styles.newCardSectionChrome}>
              <span className={styles.newCardFieldLabel}>Tags</span>
              <span className={`${styles.newCardWordCount} ${styles.subdued}`}>optional</span>
            </div>
            <div className={styles.newCardTagsInputWrap}>
              {tags.map((tag) => (
                <span className={styles.newCardTagPill} key={tag}>
                  {tag}
                  <button
                    className={styles.newCardTagRemove}
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
                className={styles.newCardTagInput}
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

          <div className={styles.newCardSpaceSection}>
            <div className={styles.newCardSectionChrome}>
              <span className={styles.newCardFieldLabel}>Space</span>
            </div>
            <div className={styles.newCardSelectWrap}>
              <select
                className={styles.newCardSelectInput}
                onChange={(event) => onChange({ spaceId: event.target.value })}
                value={draft.spaceId}
              >
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
              <span className={styles.newCardSelectChevron}>
                <ChevronIcon />
              </span>
            </div>
          </div>

          {error ? (
            <p className={styles.newCardError} id="card-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className={styles.newCardDivider} />

          <div className={styles.newCardPreviewSection}>
            <div className={styles.newCardPreviewHeader}>
              <span className={styles.newCardPreviewLabel}>Preview</span>
              <span className={styles.newCardPreviewHint}>
                <PreviewFlipIcon />
                Hover to flip
              </span>
            </div>

            <div
              className={`${styles.newCardScene}${isPreviewHovered ? ` ${styles.hovered}` : ""}`}
              onMouseEnter={() => setIsPreviewHovered(true)}
              onMouseLeave={() => setIsPreviewHovered(false)}
            >
              <div
                className={`${styles.newCardBody}${isPreviewHovered ? ` ${styles.hovered}` : ""}`}
                role="presentation"
              >
                <div className={`${styles.newCardFace} ${styles.newCardFaceFront}`}>
                  <span className={`${styles.newCardCorner} ${styles.tl}`}>front</span>
                  <div className={styles.newCardFaceInner}>
                    <div
                      className={styles.newCardFaceText}
                      dangerouslySetInnerHTML={{
                        __html: renderPreviewHtml(
                          draft.front,
                          "Start typing...",
                          styles.newCardFaceEmpty,
                          styles.newCardClozeBlank,
                        ),
                      }}
                    />
                  </div>
                  {tags.length > 0 ? (
                    <div className={styles.newCardFaceTags}>
                      {tags.map((tag) => (
                        <span className={styles.newCardFaceTag} key={`preview-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className={`${styles.newCardCorner} ${styles.br}`}>
                    {selectedSpaceName}
                  </span>
                </div>

                <div className={`${styles.newCardFace} ${styles.newCardFaceBack}`}>
                  <span className={`${styles.newCardCorner} ${styles.tl}`}>back</span>
                  <div className={styles.newCardFaceInner}>
                    <div
                      className={`${styles.newCardFaceText} ${styles.back}`}
                      dangerouslySetInnerHTML={{
                        __html: renderPreviewHtml(
                          draft.back,
                          "Start typing...",
                          styles.newCardFaceEmpty,
                          styles.newCardClozeBlank,
                        ),
                      }}
                    />
                  </div>
                  <span className={`${styles.newCardCorner} ${styles.br}`}>
                    {selectedSpaceName}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.newCardDots}>
              <span
                className={`${styles.newCardDot}${!isPreviewHovered ? ` ${styles.active}` : ""}`}
              />
              <span
                className={`${styles.newCardDot}${isPreviewHovered ? ` ${styles.active}` : ""}`}
              />
            </div>
          </div>

          <div className={styles.newCardOpinionBox}>
            <div className={styles.newCardOpinionTitle}>What makes a good card</div>
            <div className={styles.newCardOpinionList}>
              <div className={styles.newCardOpinionItem}>
                <span className={styles.newCardOpinionBullet} />
                <span>
                  <strong>Front: 30 words max.</strong> One question testing one atomic piece of
                  knowledge.
                </span>
              </div>
              <div className={styles.newCardOpinionItem}>
                <span className={styles.newCardOpinionBullet} />
                <span>
                  <strong>Back: 60 words max.</strong> A direct answer with just enough context.
                </span>
              </div>
              <div className={styles.newCardOpinionItem}>
                <span className={styles.newCardOpinionBullet} />
                <span>
                  <strong>Use formatting sparingly.</strong> Bold a key term, code-wrap a function,
                  and keep it scannable.
                </span>
              </div>
              <div className={styles.newCardOpinionItem}>
                <span className={styles.newCardOpinionBullet} />
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

function wordCountClassName(count: number, limit: number, s: Record<string, string>): string {
  if (count > limit) {
    return ` ${s.over}`;
  }

  if (count > limit * 0.8) {
    return ` ${s.warn}`;
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

function renderPreviewHtml(
  value: string,
  emptyLabel: string,
  emptyClassName: string,
  clozeClassName: string,
): string {
  if (!value.trim()) {
    return `<span class="${emptyClassName}">${emptyLabel}</span>`;
  }

  const escaped = escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/_____/g, `<span class="${clozeClassName}"></span>`)
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
