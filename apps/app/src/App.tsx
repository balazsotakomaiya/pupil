import { useEffect, useState } from "react";
import { loadBootstrapState } from "./lib/bootstrap";

export default function App() {
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        await loadBootstrapState();
      } catch (nextError: unknown) {
        if (!cancelled) {
          setBootstrapError(
            nextError instanceof Error ? nextError.message : "Failed to load app state",
          );
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      {bootstrapError ? (
        <section className="status-panel" role="alert">
          <strong>Bootstrap failed</strong>
          <p>{bootstrapError}</p>
        </section>
      ) : isBootstrapping ? (
        <section className="status-panel" aria-live="polite">
          <strong>Loading</strong>
          <p>Preparing the app shell.</p>
        </section>
      ) : (
        <section className="app-stage" aria-label="Empty app canvas" />
      )}
    </main>
  );
}
