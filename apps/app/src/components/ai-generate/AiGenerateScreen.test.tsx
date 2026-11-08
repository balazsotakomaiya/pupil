import type { SpaceSummary } from "@pupil/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../../test/tauri";
import { AiGenerateScreen } from "./AiGenerateScreen";

const space = {
  id: "space-1",
  name: "Networking",
  cardCount: 0,
  dueCount: 0,
  newCount: 0,
  createdAt: 0,
  updatedAt: 0,
} as unknown as SpaceSummary;

const claudeReady = {
  hasApiKey: false,
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1",
  maxTokens: "4096",
  temperature: "0.7",
  explainEnabled: true,
  connection: "claudeCode",
  chatgpt: {
    status: "disconnected",
    email: null,
    planUsage: false,
    model: "gpt-a",
    savedAccount: false,
  },
  claudeCode: { model: "opus", path: "", ready: true },
};

/** Answers the first generation at once and holds every regeneration. */
function mockBackend() {
  const regenerations: string[] = [];
  invokeMock.mockImplementation(async (command, args) => {
    switch (command) {
      case "get_ai_settings":
        return claudeReady;
      case "generate_cards": {
        const input = (args?.input ?? {}) as { requestId?: string; count?: number | null };
        if (input.count === 1) {
          regenerations.push(input.requestId ?? "");
          return new Promise(() => {});
        }
        return [
          { front: "What is TCP?", back: "A transport protocol." },
          { front: "What is UDP?", back: "A connectionless protocol." },
        ];
      }
      case "cancel_ai_request":
        return true;
      default:
        return undefined;
    }
  });
  return regenerations;
}

function renderScreen() {
  return render(
    <AiGenerateScreen
      backLabel="Back"
      onBack={vi.fn()}
      onCreateSpace={vi.fn()}
      onOpenSettings={vi.fn()}
      onSaveApprovedCards={vi.fn()}
      spaces={[space]}
    />,
  );
}

it("cancels every card still regenerating when the screen closes", async () => {
  enableTauriRuntime();
  const regenerations = mockBackend();
  const view = renderScreen();
  await userEvent.type(await screen.findByLabelText("Topic"), "Transport protocols");
  await userEvent.click(screen.getByRole("button", { name: /Generate/ }));
  await screen.findByText("What is TCP?");

  for (const button of screen.getAllByRole("button", { name: "Regenerate" })) {
    await userEvent.click(button);
  }
  await waitFor(() => expect(regenerations).toHaveLength(2));
  expect(screen.getAllByRole("button", { name: "Regenerating…" })).toHaveLength(2);

  view.unmount();

  for (const requestId of regenerations) {
    expect(invokeMock).toHaveBeenCalledWith("cancel_ai_request", { requestId });
  }
});

it("does not start a second regeneration for a card already regenerating", async () => {
  enableTauriRuntime();
  const regenerations = mockBackend();
  renderScreen();
  await userEvent.type(await screen.findByLabelText("Topic"), "Transport protocols");
  await userEvent.click(screen.getByRole("button", { name: /Generate/ }));
  await screen.findByText("What is TCP?");

  const [first] = screen.getAllByRole("button", { name: "Regenerate" });
  await userEvent.click(first);
  await userEvent.click(screen.getAllByRole("button", { name: /Regenerat/ })[0]);

  await waitFor(() => expect(regenerations).toHaveLength(1));
});
