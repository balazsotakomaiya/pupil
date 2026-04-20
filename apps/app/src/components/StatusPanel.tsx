export function StatusPanel({ message, title }: { message: string; title: string }) {
  return (
    <section className="status-panel" aria-live="polite">
      <strong>{title}</strong>
      <p>{message}</p>
    </section>
  );
}
