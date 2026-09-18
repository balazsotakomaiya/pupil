import { describe, expect, it } from "vitest";
import {
  normalizeCardInput,
  normalizeCardSource,
  normalizeSpaceName,
  normalizeTags,
  SPACE_NAME_MAX_LENGTH,
  spaceNameKey,
} from "./normalize";

describe("normalizeSpaceName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeSpaceName("  Rust  ")).toBe("Rust");
  });

  it("rejects blank names", () => {
    expect(() => normalizeSpaceName("   ")).toThrow("Space name can't be empty.");
  });

  it("measures length in code points, not UTF-16 units", () => {
    const emoji = "🦀".repeat(SPACE_NAME_MAX_LENGTH);

    expect(normalizeSpaceName(emoji)).toBe(emoji);
    expect(() => normalizeSpaceName("🦀".repeat(SPACE_NAME_MAX_LENGTH + 1))).toThrow();
  });
});

describe("normalizeCardInput", () => {
  it("trims the front and back", () => {
    const result = normalizeCardInput({
      back: "  a systems language  ",
      front: "  what is rust?  ",
      spaceId: "space-1",
      tags: [],
    });

    expect(result.front).toBe("what is rust?");
    expect(result.back).toBe("a systems language");
    expect(result.source).toBe("manual");
  });

  it("rejects empty required fields", () => {
    const base = { back: "back", front: "front", spaceId: "space-1", tags: [] };

    expect(() => normalizeCardInput({ ...base, spaceId: " " })).toThrow(
      "Space identifier is required.",
    );
    expect(() => normalizeCardInput({ ...base, front: " " })).toThrow("Front can't be empty.");
    expect(() => normalizeCardInput({ ...base, back: " " })).toThrow("Back can't be empty.");
  });
});

describe("normalizeTags", () => {
  it("trims, drops blanks, and de-duplicates while preserving order", () => {
    expect(normalizeTags([" rust ", "", "  ", "rust", "memory"])).toEqual(["rust", "memory"]);
  });
});

describe("normalizeCardSource", () => {
  it("passes through known sources and falls back to manual", () => {
    expect(normalizeCardSource("ai")).toBe("ai");
    expect(normalizeCardSource("anki")).toBe("anki");
    expect(normalizeCardSource("manual")).toBe("manual");
    expect(normalizeCardSource(undefined)).toBe("manual");
    expect(normalizeCardSource("nonsense")).toBe("manual");
  });
});

describe("spaceNameKey", () => {
  it("lowercases ASCII only, matching the SQLite unique index", () => {
    expect(spaceNameKey("Rust")).toBe(spaceNameKey("rust"));
    expect(spaceNameKey("İ")).toBe("İ");
  });
});
