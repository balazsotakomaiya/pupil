import type {
  DragEventHandler,
  ChangeEventHandler,
  RefObject,
} from "react";
import { BrowseIcon, UploadIcon } from "./ImportIcons";

type ImportDropZoneProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  isDragOver: boolean;
  onBrowse: () => void;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
};

export function ImportDropZone({
  fileInputRef,
  isDragOver,
  onBrowse,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileChange,
}: ImportDropZoneProps) {
  return (
    <section className="import-hero">
      <div
        className={`drop-zone${isDragOver ? " drag-over" : ""}`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowse();
          }
        }}
        onClick={onBrowse}
        role="button"
        tabIndex={0}
      >
        <div className="drop-zone-icon">
          <UploadIcon />
        </div>
        <div className="drop-zone-title">Import from Anki</div>
        <div className="drop-zone-desc">
          Drag an <code>.apkg</code> file here to import your decks. Each Anki deck becomes a
          Pupil space. Cards start fresh with FSRS-5 scheduling.
        </div>
        <div className="drop-zone-hint">.apkg · text only · media skipped in Phase 1</div>
        <button className="drop-zone-browse" type="button">
          <BrowseIcon />
          Browse files
        </button>
        <input
          accept=".apkg"
          className="import-file-input"
          onChange={onFileChange}
          ref={fileInputRef}
          type="file"
        />
      </div>
    </section>
  );
}
