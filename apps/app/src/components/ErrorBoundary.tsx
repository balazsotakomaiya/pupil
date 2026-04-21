import type { ReactNode } from "react";
import { Component } from "react";
import { type AppError, toAppError } from "../lib/errors";
import { log } from "../lib/log";
import { notifyError } from "../lib/notifications";
import styles from "./ErrorBoundary.module.css";

type ErrorBoundaryProps = {
  children: ReactNode;
  resetLabel?: string;
  screen: string;
  title?: string;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  error: AppError | null;
};

class BaseErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      error: toAppError(error, "The screen crashed."),
    };
  }

  override componentDidCatch(error: unknown) {
    const appError = toAppError(error, "The screen crashed.");
    log.error("React render crash", {
      code: appError.code,
      message: appError.message,
      screen: this.props.screen,
      severity: appError.severity,
    });
    notifyError(appError, "The screen crashed");
  }

  private readonly handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className={styles.panel} role="alert">
        <span className={styles.eyebrow}>{this.props.screen}</span>
        <h1 className={styles.title}>{this.props.title ?? "Something went wrong"}</h1>
        <p className={styles.message}>{this.state.error.message}</p>
        <div className={styles.actions}>
          {this.props.onReset ? (
            <button
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={this.handleReset}
              type="button"
            >
              {this.props.resetLabel ?? "Go back"}
            </button>
          ) : null}
          <button className={styles.button} onClick={() => window.location.reload()} type="button">
            Reload app
          </button>
        </div>
      </section>
    );
  }
}

export function AppErrorBoundary(props: Omit<ErrorBoundaryProps, "screen">) {
  return <BaseErrorBoundary {...props} screen="app" title="Pupil hit a fatal error" />;
}

export function ScreenErrorBoundary(props: ErrorBoundaryProps) {
  return <BaseErrorBoundary {...props} />;
}
