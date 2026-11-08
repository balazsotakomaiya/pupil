import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { type ClaudeCodeStatus, getClaudeCodeStatus } from "../../lib/ai-connections";
import { SettingsClaudeCodePanel } from "./SettingsClaudeCodePanel";

vi.mock("../../lib/ai-connections", async (original) => ({
  ...(await original<typeof import("../../lib/ai-connections")>()),
  getClaudeCodeStatus: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(getClaudeCodeStatus).mockReset();
});

const base: ClaudeCodeStatus = {
  installed: true,
  path: "/Users/learner/.local/bin/claude",
  version: "2.1.263",
  loggedIn: true,
  subscriptionType: "max",
  email: "learner@example.com",
  usable: true,
  reason: null,
  message: "Signed in with a Claude Max plan.",
};

function renderPanel(overrides = {}) {
  const props = {
    disabled: false,
    model: "opus",
    onModelChange: vi.fn(),
    onOpenUrl: vi.fn(),
    onPathChange: vi.fn(),
    onReadyChange: vi.fn(),
    path: "",
    ...overrides,
  };
  render(<SettingsClaudeCodePanel {...props} />);
  return props;
}

it("shows the plan and lets the user pick a model once Claude Code is signed in", async () => {
  vi.mocked(getClaudeCodeStatus).mockResolvedValue(base);
  const props = renderPanel();

  expect(await screen.findByText("Using Claude plan")).toBeInTheDocument();
  expect(screen.getByText(/Claude Max plan/)).toBeInTheDocument();
  expect(props.onReadyChange).toHaveBeenCalledWith(true);
  expect(screen.getByRole("button", { name: "Opus" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(screen.getByRole("button", { name: "Sonnet" }));
  expect(props.onModelChange).toHaveBeenCalledWith("sonnet");
});

it("guides installation when Claude Code is missing", async () => {
  vi.mocked(getClaudeCodeStatus).mockResolvedValue({
    ...base,
    installed: false,
    usable: false,
    reason: "notInstalled",
    message: "Claude Code isn't installed.",
  });
  const props = renderPanel();

  expect(await screen.findByText("Claude Code not found")).toBeInTheDocument();
  expect(props.onReadyChange).toHaveBeenCalledWith(false);
  await userEvent.click(screen.getByRole("button", { name: "Setup guide" }));
  expect(props.onOpenUrl).toHaveBeenCalledWith("https://code.claude.com/docs/en/setup");
  expect(screen.queryByRole("button", { name: "Opus" })).toBeNull();
});

it("shows the sign-in command when Claude Code is signed out", async () => {
  vi.mocked(getClaudeCodeStatus).mockResolvedValue({
    ...base,
    loggedIn: false,
    usable: false,
    reason: "signedOut",
    message: "Claude Code isn't signed in.",
  });
  renderPanel();

  expect(await screen.findByText("Not signed in")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
});

it("refuses Claude Code that bills an API account", async () => {
  vi.mocked(getClaudeCodeStatus).mockResolvedValue({
    ...base,
    usable: false,
    reason: "apiBilling",
    message: "Claude Code is signed in with API billing, not a Claude subscription.",
  });
  renderPanel();

  expect(await screen.findByText("Not using a Claude plan")).toBeInTheDocument();
});

it("saves a custom install location and checks again", async () => {
  vi.mocked(getClaudeCodeStatus).mockResolvedValue(base);
  const props = renderPanel();
  await screen.findByText("Using Claude plan");

  await userEvent.click(screen.getByRole("button", { name: "Claude Code is somewhere else?" }));
  await userEvent.type(screen.getByLabelText("Claude Code location"), "/opt/claude/bin/claude");
  await userEvent.click(screen.getByRole("button", { name: "Use" }));
  expect(props.onPathChange).toHaveBeenCalledWith("/opt/claude/bin/claude");

  await userEvent.click(screen.getByRole("button", { name: "Check again" }));
  expect(getClaudeCodeStatus).toHaveBeenCalledTimes(2);
});
