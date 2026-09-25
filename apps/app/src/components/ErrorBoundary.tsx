import type { ReactNode } from "react";
import { Component } from "react";
import { type AppError, toAppError } from "../lib/errors";
import { log } from "../lib/log";
import { notifyError } from "../lib/notifications";
import { Button } from "./Button";
import { StatusPanel } from "./StatusPanel";

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
      <StatusPanel
        actions={
          <>
            {this.props.onReset ? (
              <Button onClick={this.handleReset}>{this.props.resetLabel ?? "Go back"}</Button>
            ) : null}
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload app
            </Button>
          </>
        }
        fill={this.props.screen === "app" ? "screen" : "content"}
        message={this.state.error.message}
        role="alert"
        title={this.props.title ?? "Something went wrong"}
      />
    );
  }
}

export function AppErrorBoundary(props: Omit<ErrorBoundaryProps, "screen">) {
  return <BaseErrorBoundary {...props} screen="app" title="Pupil hit a fatal error" />;
}

export function ScreenErrorBoundary(props: ErrorBoundaryProps) {
  return <BaseErrorBoundary {...props} />;
}
