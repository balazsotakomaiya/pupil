import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu, MenuItem } from "./Menu";

afterEach(() => {
  cleanup();
});

function renderMenu({ onRename = vi.fn(), onDelete = vi.fn() } = {}) {
  render(
    <>
      <Menu
        label="Space actions"
        trigger={(props) => (
          <button {...props} type="button">
            More
          </button>
        )}
      >
        <MenuItem onSelect={onRename}>Rename space</MenuItem>
        <MenuItem onSelect={onDelete} tone="danger">
          Delete space
        </MenuItem>
      </Menu>
      <button type="button">Elsewhere</button>
    </>,
  );
  return { onDelete, onRename };
}

describe("Menu", () => {
  it("opens from its trigger and focuses the first item", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "More" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(screen.getByRole("menu", { name: "Space actions" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Rename space" })).toHaveFocus();
  });

  it("runs the chosen item, closes, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderMenu();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete space" }));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });

  it("moves between items with the arrow keys and wraps around", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete space" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Rename space" })).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Delete space" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Rename space" })).toHaveFocus();
  });

  it("opens on the last item when ArrowUp is pressed on the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();

    screen.getByRole("button", { name: "More" }).focus();
    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("menuitem", { name: "Delete space" })).toHaveFocus();
  });

  it("closes on Escape without letting the key reach window shortcuts", async () => {
    const user = userEvent.setup();
    const windowListener = vi.fn();
    window.addEventListener("keydown", windowListener);
    renderMenu();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
    expect(windowListener).not.toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
    window.removeEventListener("keydown", windowListener);
  });

  it("closes when the pointer goes down outside it", async () => {
    const user = userEvent.setup();
    const { onRename } = renderMenu();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });
});
