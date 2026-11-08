import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SettingsAiConnectionPicker } from "./SettingsAiConnectionPicker";

it("marks the chosen connection and reports a new choice", async () => {
  const onChange = vi.fn();
  render(<SettingsAiConnectionPicker disabled={false} onChange={onChange} value="apiKey" />);

  expect(screen.getByRole("button", { name: /API key/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /ChatGPT plan/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await userEvent.click(screen.getByRole("button", { name: /Claude plan/ }));
  expect(onChange).toHaveBeenCalledWith("claudeCode");
});
