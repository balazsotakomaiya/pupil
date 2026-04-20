import { describe, expect, it } from "vitest";
import { AiProviderError, InternalAppError, toAppError, ValidationError } from "./errors";

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

  it("falls back for unrelated objects", () => {
    const error = toAppError({ reason: "ignored" }, "Fallback message");

    expect(error).toBeInstanceOf(InternalAppError);
    expect(error.message).toBe("Fallback message");
  });
});
