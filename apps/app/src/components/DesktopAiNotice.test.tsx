import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DESKTOP_DOWNLOAD_URL } from "../lib/links";
import { DesktopAiNotice } from "./DesktopAiNotice";

describe("DesktopAiNotice", () => {
  it("explains that AI is desktop-only and links to the download page", () => {
    render(<DesktopAiNotice />);

    expect(screen.getByRole("heading", { name: "AI needs the desktop app" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Download Pupil" });
    expect(link).toHaveAttribute("href", DESKTOP_DOWNLOAD_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
