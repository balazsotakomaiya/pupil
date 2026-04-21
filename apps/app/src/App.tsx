import { AppRouter } from "./app-router";
import { AppErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <AppErrorBoundary resetLabel="Back to dashboard">
      <AppRouter />
    </AppErrorBoundary>
  );
}
