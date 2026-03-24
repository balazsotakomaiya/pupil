type ImportNotesCardProps = {
  items: string[];
};

export function ImportNotesCard({ items }: ImportNotesCardProps) {
  return (
    <div className="notes-card">
      <div className="notes-title">What to know about Anki imports</div>
      <div className="notes-list">
        {items.map((item) => (
          <div className="note-item" key={item}>
            <div className="note-bullet" />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </div>
        ))}
      </div>
    </div>
  );
}
