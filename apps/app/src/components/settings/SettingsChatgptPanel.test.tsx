import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  cancelChatgptSignIn,
  disconnectChatgpt,
  listChatgptModels,
  startChatgptSignIn,
} from "../../lib/ai-connections";
import { type ChatgptConnectionState, DEFAULT_AI_SETTINGS } from "../../lib/ai-settings";
import { AiConnectionError } from "../../lib/errors";
import { SettingsChatgptPanel } from "./SettingsChatgptPanel";

vi.mock("../../lib/ai-connections", async (original) => ({
  ...(await original<typeof import("../../lib/ai-connections")>()),
  cancelChatgptSignIn: vi.fn(),
  disconnectChatgpt: vi.fn(),
  listChatgptModels: vi.fn(),
  startChatgptSignIn: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(startChatgptSignIn).mockReset();
  vi.mocked(disconnectChatgpt).mockReset();
  vi.mocked(listChatgptModels).mockReset();
  vi.mocked(cancelChatgptSignIn).mockReset();
});

const disconnected = DEFAULT_AI_SETTINGS.chatgpt;
const connected: ChatgptConnectionState = {
  status: "connected",
  email: "learner@example.com",
  planUsage: true,
  model: "gpt-a",
  savedAccount: true,
};

function renderPanel(state: ChatgptConnectionState, overrides = {}) {
  const props = {
    disabled: false,
    model: state.model,
    onModelChange: vi.fn(),
    onOpenUrl: vi.fn(),
    onSettingsChanged: vi.fn(),
    state,
    ...overrides,
  };
  render(<SettingsChatgptPanel {...props} />);
  return props;
}

it("signs in through the browser and explains that the plan is now in use", async () => {
  vi.mocked(startChatgptSignIn).mockResolvedValue({
    ...DEFAULT_AI_SETTINGS,
    connection: "chatgpt",
    chatgpt: connected,
  });
  const props = renderPanel(disconnected);

  await userEvent.click(screen.getByRole("button", { name: "Continue with ChatGPT" }));

  expect(await screen.findByText("You're using your ChatGPT plan")).toBeInTheDocument();
  expect(props.onSettingsChanged).toHaveBeenCalledWith(
    expect.objectContaining({ chatgpt: connected }),
  );
});

it("offers Cancel while the browser sign-in is open, without showing an error", async () => {
  let reject!: (error: unknown) => void;
  vi.mocked(startChatgptSignIn).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  renderPanel(disconnected);

  await userEvent.click(screen.getByRole("button", { name: "Continue with ChatGPT" }));
  expect(screen.getByRole("button", { name: "Waiting for your browser…" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancelChatgptSignIn).toHaveBeenCalled();
  reject(new AiConnectionError("The AI request was cancelled.", "cancelled", "chatgpt"));

  expect(await screen.findByRole("button", { name: "Continue with ChatGPT" })).toBeEnabled();
  expect(screen.queryByText("Not connected", { selector: "[role=status] *" })).toBeNull();
});

it("signs in a different account with a fresh registration", async () => {
  vi.mocked(startChatgptSignIn).mockResolvedValue({
    ...DEFAULT_AI_SETTINGS,
    connection: "chatgpt",
    chatgpt: connected,
  });
  renderPanel({ ...disconnected, savedAccount: true });

  await userEvent.click(screen.getByRole("button", { name: "Use a different account" }));

  expect(startChatgptSignIn).toHaveBeenCalledWith({ newAccount: true });
  expect(await screen.findByText("You're using your ChatGPT plan")).toBeInTheDocument();
});

it("reauthorizes the saved account by default and hides the switch on first sign-in", async () => {
  vi.mocked(startChatgptSignIn).mockResolvedValue({ ...DEFAULT_AI_SETTINGS });
  renderPanel(disconnected);

  expect(screen.queryByRole("button", { name: "Use a different account" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Continue with ChatGPT" }));
  expect(startChatgptSignIn).toHaveBeenCalledWith({ newAccount: false });
});

it("shows why a sign-in failed", async () => {
  vi.mocked(startChatgptSignIn).mockRejectedValue(
    new AiConnectionError(
      "ChatGPT sign-in was cancelled, so plan usage is off.",
      "declined",
      "chatgpt",
    ),
  );
  renderPanel(disconnected);

  await userEvent.click(screen.getByRole("button", { name: "Continue with ChatGPT" }));

  expect(await screen.findByText(/plan usage is off/)).toBeInTheDocument();
});

it("lists the plan's models and switches to an available one", async () => {
  vi.mocked(listChatgptModels).mockResolvedValue([
    { id: "gpt-b", label: "GPT B" },
    { id: "gpt-c", label: "GPT C" },
  ]);
  const props = renderPanel(connected);

  expect(await screen.findByRole("combobox", { name: "Model" })).toBeInTheDocument();
  expect(props.onModelChange).toHaveBeenCalledWith("gpt-b");
  expect(screen.getByText("Using ChatGPT plan")).toBeInTheDocument();
});

it("asks to reconnect when the connection ended", () => {
  renderPanel({ ...connected, status: "expired" });
  expect(screen.getByText("Connection ended")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reconnect ChatGPT" })).toBeInTheDocument();
  expect(listChatgptModels).not.toHaveBeenCalled();
});

it("says so when OpenAI could not confirm a disconnect", async () => {
  vi.mocked(listChatgptModels).mockResolvedValue([{ id: "gpt-a", label: "GPT A" }]);
  vi.mocked(disconnectChatgpt).mockResolvedValue({
    remoteRevoked: false,
    settings: { ...DEFAULT_AI_SETTINGS, connection: "chatgpt" },
  });
  renderPanel(connected);

  await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

  await waitFor(() => expect(screen.getByText("Disconnected on this device")).toBeInTheDocument());
  expect(screen.getByText(/remove Pupil in ChatGPT settings/)).toBeInTheDocument();
});

it("opens ChatGPT usage settings from Manage usage", async () => {
  vi.mocked(listChatgptModels).mockResolvedValue([]);
  const props = renderPanel(connected);
  await userEvent.click(screen.getByRole("button", { name: "Manage usage" }));
  expect(props.onOpenUrl).toHaveBeenCalledWith("https://chatgpt.com/settings/usage");
});
