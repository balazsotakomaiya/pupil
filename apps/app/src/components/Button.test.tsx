import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("defaults to a native button and forwards its props", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button aria-label="Create space" className="caller-class" onClick={onClick}>
        Create
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Create space" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("caller-class");
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("preserves submit semantics and prevents disabled actions", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <>
        <Button type="submit">Save</Button>
        <Button disabled onClick={onClick} variant="destructive">
          Delete
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton).toBeDisabled();
    await user.click(deleteButton);
    expect(onClick).not.toHaveBeenCalled();
  });
});
