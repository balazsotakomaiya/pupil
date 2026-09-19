import type { CardRecord } from "@pupil/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardList } from "./CardList";

afterEach(() => {
  cleanup();
});

const NOW = Date.UTC(2026, 8, 19, 10, 0, 0);

function card(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: "card-a",
    spaceId: "space-a",
    spaceName: "Space A",
    front: "What is ownership?",
    back: "Each value has one owner.",
    tags: [],
    source: "manual",
    state: 0,
    due: NOW,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    createdAt: NOW,
    updatedAt: NOW,
    suspended: false,
    hasExplanation: false,
    ...overrides,
  };
}

describe("CardList explanations", () => {
  it("offers view explanation only when a card already has one", async () => {
    const user = userEvent.setup();
    const onViewExplanation = vi.fn();
    const { rerender } = render(
      <CardList
        cards={[card()]}
        expandedCardId="card-a"
        onDeleteCard={vi.fn()}
        onEditCard={vi.fn()}
        onToggleExpand={vi.fn()}
        onViewExplanation={onViewExplanation}
      />,
    );

    expect(screen.queryByRole("button", { name: "View explanation" })).not.toBeInTheDocument();

    rerender(
      <CardList
        cards={[card({ hasExplanation: true })]}
        expandedCardId="card-a"
        onDeleteCard={vi.fn()}
        onEditCard={vi.fn()}
        onToggleExpand={vi.fn()}
        onViewExplanation={onViewExplanation}
      />,
    );

    await user.click(screen.getByRole("button", { name: "View explanation" }));
    expect(onViewExplanation).toHaveBeenCalledWith("card-a");
  });
});
