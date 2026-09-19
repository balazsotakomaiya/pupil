import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetAppUpdateClient, setAppUpdateClient } from "../../lib/app-update";
import { resetAppUpdateStore, useAppUpdateStore } from "../../lib/app-update-store";
import { SettingsAboutCard } from "./SettingsAboutCard";

afterEach(() => {
  cleanup();
  resetAppUpdateStore();
  resetAppUpdateClient();
});

describe("SettingsAboutCard updates", () => {
  it("replaces Check for updates with Restart and update when a build is found", async () => {
    const user = userEvent.setup();
    setAppUpdateClient({
      check: vi.fn(async (currentVersion) => ({
        currentVersion,
        notes: "Notes",
        version: "1.0.0",
      })),
      download: vi.fn(),
      relaunch: vi.fn(),
    });

    render(
      <SettingsAboutCard onOpenDocs={vi.fn()} onOpenGithub={vi.fn()} onOpenIssues={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(await screen.findByRole("button", { name: "Restart and update" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check for updates" })).not.toBeInTheDocument();
  });

  it("installs from the replaced button without a dialog", async () => {
    const user = userEvent.setup();
    let finishDownload: (() => void) | undefined;
    setAppUpdateClient({
      check: vi.fn(),
      download: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishDownload = resolve;
          }),
      ),
      relaunch: vi.fn(async () => undefined),
    });
    useAppUpdateStore.setState({
      notes: "Notes",
      phase: "available",
      version: "1.0.0",
    });

    render(
      <SettingsAboutCard onOpenDocs={vi.fn()} onOpenGithub={vi.fn()} onOpenIssues={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Restart and update" }));
    expect(await screen.findByRole("button", { name: "Downloading…" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    finishDownload?.();
  });
});
