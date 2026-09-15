import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTitlebar } from "../app-shell/AppTitlebar";
import { CardsScreen } from "./CardsScreen";

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

const spaces = [
  {
    id: "french",
    name: "French",
    cardCount: 0,
    dueTodayCount: 0,
    streak: 0,
    createdAt: 1,
    updatedAt: 1,
  },
];

describe("header card creation", () => {
  it("keeps card and space actions distinct", async () => {
    const user = userEvent.setup();
    const onOpenNewCard = vi.fn();
    const onOpenCreateDialog = vi.fn();
    render(
      <AppTitlebar
        activeTab="settings"
        tabs={[]}
        onOpenPalette={vi.fn()}
        onSelectTab={vi.fn()}
        onOpenNewCard={onOpenNewCard}
        onOpenCreateDialog={onOpenCreateDialog}
      />,
    );
    await user.click(screen.getByRole("button", { name: "New Card" }));
    expect(onOpenNewCard).toHaveBeenCalledOnce();
    expect(onOpenCreateDialog).not.toHaveBeenCalled();
  });

  it("waits for spaces to load, then opens the existing editor and consumes the request", async () => {
    const onNewCardRequestHandled = vi.fn();
    const props = {
      actionableDueCount: 0,
      cards: [],
      isMutating: false,
      newCardRequested: true,
      onNewCardRequestHandled,
      onCreateCard: vi.fn(),
      onDeleteCard: vi.fn(),
      onOpenCreateDialog: vi.fn(),
      onSuspendCard: vi.fn(),
      onUpdateCard: vi.fn(),
    };
    const { rerender } = render(<CardsScreen {...props} spaces={[]} />);
    expect(screen.getByText("Create a space before adding cards")).toBeInTheDocument();
    expect(onNewCardRequestHandled).not.toHaveBeenCalled();
    rerender(<CardsScreen {...props} spaces={spaces} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("combobox")).toHaveValue("french");
    expect(onNewCardRequestHandled).toHaveBeenCalled();
  });

  it("preserves an open draft when the header requests the editor again", async () => {
    const user = userEvent.setup();
    const props = {
      actionableDueCount: 0,
      cards: [],
      spaces,
      isMutating: false,
      onCreateCard: vi.fn(),
      onDeleteCard: vi.fn(),
      onOpenCreateDialog: vi.fn(),
      onSuspendCard: vi.fn(),
      onUpdateCard: vi.fn(),
    };
    const { rerender } = render(<CardsScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "New Card" }));
    const front = screen.getByPlaceholderText("A clear, single question or prompt...");
    await user.type(front, "Keep this draft");
    rerender(<CardsScreen {...props} newCardRequested onNewCardRequestHandled={vi.fn()} />);
    expect(front).toHaveValue("Keep this draft");
  });
});
