import styles from "./Import.module.css";

type ImportNotesCardProps = {
  items: string[];
};

export function ImportNotesCard({ items }: ImportNotesCardProps) {
  return (
    <div className={styles.notesCard}>
      <div className={styles.notesTitle}>What to know about Anki imports</div>
      <div className={styles.notesList}>
        {items.map((item) => (
          <div className={styles.noteItem} key={item}>
            <div className={styles.noteBullet} />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </div>
        ))}
      </div>
    </div>
  );
}
