import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAUNCH_EXIT_MS, LAUNCH_MIN_VISIBLE_MS, LaunchScreen } from "./LaunchScreen";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("LaunchScreen", () => {
  it("holds for the full opening even when the app is already ready", () => {
    render(<LaunchScreen ready />);

    advance(LAUNCH_MIN_VISIBLE_MS - 1);
    expect(screen.getByTestId("launch-screen")).toBeInTheDocument();

    advance(1);
    advance(LAUNCH_EXIT_MS);
    expect(screen.queryByTestId("launch-screen")).not.toBeInTheDocument();
  });

  it("waits for the app to be ready before leaving", () => {
    const { rerender } = render(<LaunchScreen ready={false} />);

    advance(LAUNCH_MIN_VISIBLE_MS * 3);
    expect(screen.getByTestId("launch-screen")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Opening Pupil.");

    rerender(<LaunchScreen ready />);
    advance(LAUNCH_EXIT_MS);
    expect(screen.queryByTestId("launch-screen")).not.toBeInTheDocument();
  });

  it("can be skipped with a click once the app is ready", () => {
    render(<LaunchScreen ready />);

    fireEvent.pointerDown(screen.getByTestId("launch-screen"));
    advance(LAUNCH_EXIT_MS);

    expect(screen.queryByTestId("launch-screen")).not.toBeInTheDocument();
  });
});
