import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AiGenerateError } from "./AiGenerateError";
import { AiGenerateLoading } from "./AiGenerateLoading";

function renderError(reason: Parameters<typeof AiGenerateError>[0]["reason"]) {
  const props = {
    detail: "Provider said no.",
    onEditPrompt: vi.fn(),
    onOpenSettings: vi.fn(),
    onRetry: vi.fn(),
    reason,
  };
  render(<AiGenerateError {...props} />);
  return props;
}

it("names a usage limit and still offers a retry", async () => {
  const props = renderError("usageLimit");
  expect(screen.getByText("Usage limit reached")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(props.onRetry).toHaveBeenCalled();
});

it("sends an expired connection to Settings instead of retrying", async () => {
  const props = renderError("expired");
  expect(screen.getByText("Reconnect to continue")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Open Settings" }));
  expect(props.onOpenSettings).toHaveBeenCalled();
});

it("keeps the generic failure for ordinary provider errors", () => {
  renderError(null);
  expect(screen.getByText("Generation failed")).toBeInTheDocument();
  expect(screen.getByText("Provider said no.")).toBeInTheDocument();
});

it("lets the user cancel a generation in progress", async () => {
  const onCancel = vi.fn();
  render(<AiGenerateLoading model="Opus · Claude plan" onCancel={onCancel} topic="TCP" />);
  expect(screen.getByText("Opus · Claude plan")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalled();
});
