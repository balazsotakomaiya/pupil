import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { enableTauriRuntime, invokeMock } from "../../test/tauri";
import { SettingsScreen } from "./SettingsScreen";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

const savedApiKeySettings = {
  hasApiKey: true,
  baseUrl: "https://api.anthropic.com/v1",
  model: "claude-sonnet-5",
  maxTokens: "4096",
  temperature: "0.7",
  explainEnabled: true,
  connection: "apiKey",
  chatgpt: { status: "disconnected", email: null, planUsage: false, model: "gpt-5.6-terra" },
  claudeCode: { model: "opus", path: "", ready: false },
  aiReady: true,
};

function mockBackend(overrides: Record<string, (args?: Record<string, unknown>) => unknown> = {}) {
  let current: Record<string, unknown> = { ...savedApiKeySettings };
  invokeMock.mockImplementation(async (command, args) => {
    if (overrides[command]) return overrides[command](args);
    switch (command) {
      case "get_ai_settings":
        return current;
      case "save_ai_settings": {
        const input = (args?.input ?? {}) as Record<string, unknown>;
        current = { ...current, connection: input.connection, model: input.model };
        return current;
      }
      case "get_settings_data_summary":
        return { databasePath: "/tmp/pupil.db", reviewLogCount: 0 };
      case "get_claude_code_status":
        return {
          installed: true,
          path: "/usr/local/bin/claude",
          version: "2.1.263",
          loggedIn: true,
          subscriptionType: "max",
          email: null,
          usable: true,
          reason: null,
          message: "Signed in with a Claude Max plan.",
        };
      default:
        return undefined;
    }
  });
}

function renderScreen(onAiSettingsChanged = vi.fn()) {
  render(
    <SettingsScreen
      cardsCount={0}
      isSavingStudySettings={false}
      onAiSettingsChanged={onAiSettingsChanged}
      onResetAllData={async () => {}}
      onSaveStudySettings={async () => {}}
      spacesCount={0}
      studySettings={{ newCardsLimit: null, newCardsToday: 0 }}
    />,
  );
  return onAiSettingsChanged;
}

it("keeps an existing API key setup on the API key connection", async () => {
  enableTauriRuntime();
  mockBackend();
  renderScreen();
  await userEvent.click(screen.getByRole("tab", { name: /AI/ }));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^API key/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(screen.getByLabelText("Base URL")).toHaveValue("https://api.anthropic.com/v1");
  expect(screen.getByText("API key saved on this device.")).toBeInTheDocument();
});

it("saves a switch to the Claude plan and checks Claude Code", async () => {
  enableTauriRuntime();
  mockBackend();
  const onAiSettingsChanged = renderScreen();
  await userEvent.click(screen.getByRole("tab", { name: /AI/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Claude plan/ })).toBeEnabled());

  await userEvent.click(screen.getByRole("button", { name: /Claude plan/ }));

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith("save_ai_settings", {
      input: expect.objectContaining({
        connection: "claudeCode",
        claudeCodeModel: "opus",
        // The API key settings ride along unchanged.
        baseUrl: "https://api.anthropic.com/v1",
        model: "claude-sonnet-5",
      }),
    }),
  );
  expect(await screen.findByText("Using Claude plan")).toBeInTheDocument();
  expect(screen.queryByLabelText("Base URL")).toBeNull();
  expect(screen.getByRole("button", { name: /Test connection/ })).toBeEnabled();
  expect(onAiSettingsChanged).toHaveBeenCalled();
});

it("reports a Claude plan test result from the backend", async () => {
  enableTauriRuntime();
  mockBackend({
    test_ai_provider_connection: () => ({ detail: "opus · 2100ms", label: "Using Claude plan" }),
  });
  renderScreen();
  await userEvent.click(screen.getByRole("tab", { name: /AI/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Claude plan/ })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: /Claude plan/ }));
  await screen.findByText("Using Claude plan");

  await userEvent.click(screen.getByRole("button", { name: /Test connection/ }));

  expect(await screen.findByText("opus · 2100ms")).toBeInTheDocument();
  expect(invokeMock).toHaveBeenCalledWith("test_ai_provider_connection", {
    input: expect.objectContaining({ connection: "claudeCode" }),
  });
});

it("cannot test ChatGPT before it is connected", async () => {
  enableTauriRuntime();
  mockBackend();
  renderScreen();
  await userEvent.click(screen.getByRole("tab", { name: /AI/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: /ChatGPT plan/ })).toBeEnabled());

  await userEvent.click(screen.getByRole("button", { name: /ChatGPT plan/ }));

  expect(await screen.findByRole("button", { name: "Continue with ChatGPT" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Test connection/ })).toBeDisabled();
});
