export type ErrorSeverity = "fatal" | "domain" | "infra";

type ReportPayload = {
  code: string;
  context?: Record<string, unknown>;
  message: string;
  severity: ErrorSeverity;
};

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly severity: ErrorSeverity;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export abstract class DomainError extends AppError {
  readonly severity = "domain" as const;
}

export abstract class InfraError extends AppError {
  readonly severity = "infra" as const;
}

export abstract class FatalError extends AppError {
  readonly severity = "fatal" as const;
}

type Reportable = {
  readonly reportable: true;
  toReport(): ReportPayload;
};

export class ValidationError extends DomainError {
  readonly code = "VALIDATION" as const;

  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND" as const;

  constructor(readonly entity: string) {
    super(`${entity} not found`);
  }
}

export class DuplicateError extends DomainError {
  readonly code = "DUPLICATE" as const;

  constructor(readonly entity: string) {
    super(`${entity} already exists`);
  }
}

export class StorageError extends InfraError implements Reportable {
  readonly code = "STORAGE" as const;
  readonly reportable = true as const;

  toReport(): ReportPayload {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
    };
  }
}

export class NetworkError extends InfraError implements Reportable {
  readonly code = "NETWORK" as const;
  readonly reportable = true as const;

  toReport(): ReportPayload {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
    };
  }
}

export class AiProviderError extends InfraError implements Reportable {
  readonly code = "AI_PROVIDER" as const;
  readonly reportable = true as const;

  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }

  toReport(): ReportPayload {
    return {
      code: this.code,
      context: this.detail ? { detail: this.detail } : undefined,
      message: this.message,
      severity: this.severity,
    };
  }
}

export class MigrationFailedError extends FatalError implements Reportable {
  readonly code = "MIGRATION_FAILED" as const;
  readonly reportable = true as const;

  toReport(): ReportPayload {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
    };
  }
}

export class InternalAppError extends FatalError implements Reportable {
  readonly code = "INTERNAL" as const;
  readonly reportable = true as const;

  toReport(): ReportPayload {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
    };
  }
}

export function isReportable(error: unknown): error is AppError & Reportable {
  return error instanceof AppError && "reportable" in error;
}

type BackendErrorPayload = {
  code?: string;
  detail?: string;
  entity?: string;
  field?: string | null;
  message?: string;
};

function toPayload(error: unknown): BackendErrorPayload | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  return error as BackendErrorPayload;
}

export function toAppError(error: unknown, fallbackMessage = "Something went wrong"): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const payload = toPayload(error);
  const code = payload?.code?.toUpperCase();

  switch (code) {
    case "VALIDATION":
      return new ValidationError(payload?.message ?? fallbackMessage, payload?.field ?? undefined);
    case "NOT_FOUND":
      return new NotFoundError(payload?.entity ?? "resource");
    case "DUPLICATE":
      return new DuplicateError(payload?.entity ?? "resource");
    case "STORAGE":
      return new StorageError(payload?.message ?? fallbackMessage);
    case "NETWORK":
      return new NetworkError(payload?.message ?? fallbackMessage);
    case "AI_PROVIDER":
      return new AiProviderError(payload?.message ?? fallbackMessage, payload?.detail);
    case "MIGRATION_FAILED":
      return new MigrationFailedError(payload?.message ?? fallbackMessage);
    case "INTERNAL":
      return new InternalAppError(payload?.message ?? fallbackMessage);
    default:
      if (error instanceof Error) {
        return new InternalAppError(error.message);
      }
      if (typeof error === "string") {
        return new InternalAppError(error);
      }
      return new InternalAppError(fallbackMessage);
  }
}
