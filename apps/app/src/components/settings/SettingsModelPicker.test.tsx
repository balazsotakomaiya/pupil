import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { type AiModelCatalog, discoverAiModels } from "../../lib/ai-models";
import { SettingsModelPicker } from "./SettingsModelPicker";

vi.mock("../../lib/ai-models", async (original) => ({
  ...(await original<typeof import("../../lib/ai-models")>()),
  discoverAiModels: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.mocked(discoverAiModels).mockReset();
});
const props = {
  baseUrl: "http://localhost:11434/v1",
  autoDiscover: false,
  disabled: false,
  model: "saved-model",
  saved: false,
  onChange: vi.fn(),
};

it("loads endpoint suggestions without changing the selected model", async () => {
  vi.mocked(discoverAiModels).mockResolvedValue({
    models: ["local-10", "local-9"],
    popular: false,
  });
  render(<SettingsModelPicker {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "Refresh models" }));
  expect(await screen.findByRole("button", { name: "local-10" })).toBeInTheDocument();
  expect(screen.getByLabelText("Model")).toHaveValue("saved-model");
  expect(discoverAiModels).toHaveBeenCalledWith({ baseUrl: props.baseUrl, apiKey: undefined });
});

it("keeps manual model entry usable when discovery fails", async () => {
  vi.mocked(discoverAiModels).mockRejectedValue(new Error("Catalog unavailable"));
  render(<SettingsModelPicker {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "Refresh models" }));
  expect(await screen.findByText(/Catalog unavailable.*fallback suggestions/)).toBeInTheDocument();
  expect(screen.getByLabelText("Model")).toBeEnabled();
});

it("ignores a stale model response after the endpoint changes", async () => {
  let resolve!: (result: AiModelCatalog) => void;
  vi.mocked(discoverAiModels).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(<SettingsModelPicker {...props} autoDiscover />);
  await waitFor(() => expect(discoverAiModels).toHaveBeenCalledOnce());
  view.rerender(<SettingsModelPicker {...props} baseUrl="http://localhost:1234/v1" />);
  await act(async () => resolve({ models: ["old-endpoint-model"], popular: false }));
  expect(screen.queryByRole("button", { name: "old-endpoint-model" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refresh models" })).toBeEnabled();
});
