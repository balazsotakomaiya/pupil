import { describe, expect, it } from "vitest";
import { escapeHtml, renderCardMarkup } from "./card-markup";

describe("escapeHtml", () => {
  it("escapes every character that could open or close a tag or attribute", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("escapes the ampersand before the entities it introduces", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves text without special characters untouched", () => {
    expect(escapeHtml("mitochondria")).toBe("mitochondria");
  });
});

describe("renderCardMarkup", () => {
  it("renders a script tag as inert text rather than an element", () => {
    const rendered = renderCardMarkup("<script>alert(1)</script>", "cloze");

    expect(rendered).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered).not.toContain("<script");
  });

  it("renders an img onerror payload as inert text", () => {
    expect(renderCardMarkup(`<img src=x onerror="alert(1)">`, "cloze")).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  it("wraps double-asterisk spans in strong", () => {
    expect(renderCardMarkup("the **powerhouse** of the cell", "cloze")).toBe(
      "the <strong>powerhouse</strong> of the cell",
    );
  });

  it("wraps single-asterisk spans in em", () => {
    expect(renderCardMarkup("an *organelle*", "cloze")).toBe("an <em>organelle</em>");
  });

  it("wraps backtick spans in code", () => {
    expect(renderCardMarkup("call `atp()`", "cloze")).toBe("call <code>atp()</code>");
  });

  it("renders the cloze marker as a span carrying the supplied class name", () => {
    expect(renderCardMarkup("the _____ of the cell", "blank-style")).toBe(
      'the <span class="blank-style"></span> of the cell',
    );
  });

  it("converts newlines to line breaks", () => {
    expect(renderCardMarkup("first\nsecond", "cloze")).toBe("first<br>second");
  });

  it("formats emphasis inside escaped text without unescaping it", () => {
    expect(renderCardMarkup("**<b>**", "cloze")).toBe("<strong>&lt;b&gt;</strong>");
  });
});
