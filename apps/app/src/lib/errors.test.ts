import { describe, expect, it } from "vitest";
import {
  AiConnectionError,
  AiProviderError,
  InternalAppError,
  isAiConnectionError,
  isReportable,
  toAppError,
  ValidationError,
} from "./errors";

describe("toAppError", () => {
  it("maps top-level backend payloads", () => {
    const error = toAppError({
      code: "validation",
      field: "topic",
      message: "Add a topic first.",
    });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({
      code: "VALIDATION",
      field: "topic",
      message: "Add a topic first.",
    });
  });

  it("maps nested IPC error payloads", () => {
    const error = toAppError({
      error: {
        code: "AI_PROVIDER",
        detail: "upstream timeout",
        message: "Provider request failed.",
      },
    });

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({
      code: "AI_PROVIDER",
      detail: "upstream timeout",
      message: "Provider request failed.",
    });
  });

  it("maps connection errors with their reason and provider", () => {
    const error = toAppError({
      code: "AI_CONNECTION",
      message: "You've reached your ChatGPT plan usage limit.",
      provider: "chatgpt",
      reason: "usageLimit",
    });

    expect(error).toBeInstanceOf(AiConnectionError);
    expect(isAiConnectionError(error, "usageLimit")).toBe(true);
    expect(isAiConnectionError(error, "expired")).toBe(false);
    expect(error).toMatchObject({ provider: "chatgpt", severity: "domain" });
    expect(isReportable(error)).toBe(false);
  });

  it("treats an unknown connection reason as a provider failure", () => {
    const error = toAppError({ code: "AI_CONNECTION", message: "x", reason: "new-reason" });
    expect(error).toMatchObject({ reason: "provider", provider: "unknown" });
  });

  it("falls back for unrelated objects", () => {
    const error = toAppError({ reason: "ignored" }, "Fallback message");

    expect(error).toBeInstanceOf(InternalAppError);
    expect(error.message).toBe("Fallback message");
  });
});
