import type { AiSettings, PersistedAiSettings } from "./ai-settings";
import { fromPersistedAiSettings } from "./ai-settings";
import type { AiConnectionReason } from "./errors";
import { invokeCommand } from "./ipc";
import { isTauriRuntime } from "./runtime";
import { withTimeout } from "./timeout";

/** Where ChatGPT users manage how much of their plan apps may use. */
export const CHATGPT_USAGE_URL = "https://chatgpt.com/settings/usage";
export const CLAUDE_CODE_SETUP_URL = "https://code.claude.com/docs/en/setup";
export const CLAUDE_CODE_LOGIN_COMMAND = "claude auth login";

export type ClaudeCodeStatus = {
  installed: boolean;
  path: string | null;
  version: string | null;
  loggedIn: boolean;
  subscriptionType: string | null;
  email: string | null;
  usable: boolean;
  reason: AiConnectionReason | null;
  message: string;
};

export type ChatgptModelOption = { id: string; label: string };

// The browser sign-in waits up to five minutes in the backend.
const SIGN_IN_TIMEOUT_MS = 310000;
const STATUS_TIMEOUT_MS = 45000;
const QUICK_TIMEOUT_MS = 20000;

function requireDesktop(feature: string): void {
  if (!isTauriRuntime()) {
    throw new Error(`${feature} is available in Pupil for desktop.`);
  }
}

/** Checks the local Claude Code install. With no path, checks the saved one. */
export async function getClaudeCodeStatus(path?: string): Promise<ClaudeCodeStatus> {
  requireDesktop("Claude subscriptions");
  return withTimeout(
    invokeCommand<ClaudeCodeStatus>("get_claude_code_status", { path: path ?? null }),
    STATUS_TIMEOUT_MS,
    "Checking Claude Code",
  );
}

/**
 * Opens the browser for ChatGPT sign-in and resolves once it completes.
 * `newAccount` registers afresh instead of reauthorizing the saved account.
 */
export async function startChatgptSignIn(
  options: { newAccount?: boolean } = {},
): Promise<AiSettings> {
  requireDesktop("ChatGPT plan usage");
  const state = await withTimeout(
    invokeCommand<PersistedAiSettings>("start_chatgpt_sign_in", {
      newAccount: options.newAccount ?? false,
    }),
    SIGN_IN_TIMEOUT_MS,
    "Connecting ChatGPT",
  );
  return fromPersistedAiSettings(state);
}

export async function cancelChatgptSignIn(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invokeCommand<boolean>("cancel_chatgpt_sign_in");
}

export async function disconnectChatgpt(): Promise<{
  remoteRevoked: boolean;
  settings: AiSettings;
}> {
  requireDesktop("ChatGPT plan usage");
  const result = await withTimeout(
    invokeCommand<{ remoteRevoked: boolean; settings: PersistedAiSettings }>(
      "disconnect_chatgpt_account",
    ),
    QUICK_TIMEOUT_MS,
    "Disconnecting ChatGPT",
  );
  return {
    remoteRevoked: result.remoteRevoked,
    settings: fromPersistedAiSettings(result.settings),
  };
}

export async function listChatgptModels(): Promise<ChatgptModelOption[]> {
  requireDesktop("ChatGPT plan usage");
  return withTimeout(
    invokeCommand<ChatgptModelOption[]>("list_chatgpt_account_models"),
    QUICK_TIMEOUT_MS,
    "Loading ChatGPT models",
  );
}

/** Stops a running generation or explanation. Safe to call after it ended. */
export async function cancelAiRequest(requestId: string): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invokeCommand<boolean>("cancel_ai_request", { requestId });
}

let requestCounter = 0;

export function newAiRequestId(prefix: string): string {
  requestCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${requestCounter}`;
}

/** Picks a model the account can use: the saved one if listed, else the first. */
export function pickChatgptModel(saved: string, models: ChatgptModelOption[]): string {
  if (models.some((model) => model.id === saved)) return saved;
  return models[0]?.id ?? saved;
}
