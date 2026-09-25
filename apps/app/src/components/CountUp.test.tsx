import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "./CountUp";

let frameCallbacks: FrameRequestCallback[] = [];

function flushFrame(time: number) {
  const callbacks = frameCallbacks;
  frameCallbacks = [];
  act(() => {
    for (const callback of callbacks) {
      callback(time);
    }
  });
}

beforeEach(() => {
  frameCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CountUp", () => {
  it("counts from zero and lands exactly on the value", () => {
    render(<CountUp durationMs={100} value={42} />);
    const number = screen.getByText("0");

    flushFrame(0);
    flushFrame(50);
    expect(Number(number.textContent)).toBeGreaterThan(0);
    expect(Number(number.textContent)).toBeLessThan(42);

    flushFrame(100);
    expect(number).toHaveTextContent("42");
  });

  it("shows the final value straight away when motion is reduced", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query }));
    render(<CountUp value={7} />);

    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
