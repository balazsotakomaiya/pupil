import { TimeoutError } from "./errors";

/**
 * Bounds a pending IPC call so a wedged backend or an unresponsive AI provider
 * surfaces an error instead of leaving the UI spinning indefinitely.
 *
 * The backend applies its own, shorter timeout to outbound provider requests;
 * this is the last-resort guard for the renderer, so callers should pick a
 * value comfortably above the backend budget. Rejecting here does not cancel
 * the in-flight command — it only unblocks the UI.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  hint?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      const seconds = Math.round(ms / 1000);
      const message = hint
        ? `${label} timed out after ${seconds}s. ${hint}`
        : `${label} timed out after ${seconds}s.`;

      reject(new TimeoutError(message, ms));
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
