import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTitlebar } from "./AppTitlebar";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppTitlebar update prompt", () => {
  it("installs from the header Update button", async () => {
    const user = userEvent.setup();
    const onInstallUpdate = vi.fn();

    render(
      <AppTitlebar
        activeTab="dashboard"
        onInstallUpdate={onInstallUpdate}
        onOpenCreateDialog={vi.fn()}
        onOpenPalette={vi.fn()}
        onSelectTab={vi.fn()}
        tabs={[]}
        updateActionLabel="Update"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(onInstallUpdate).toHaveBeenCalledOnce();
  });
});
