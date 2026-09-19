import type { CardRecord } from "@pupil/core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardsScreen } from "./CardsScreen";

afterEach(() => {
  cleanup();
});

const NOW = Date.UTC(2026, 8, 19, 10, 0, 0);

const spaces = [
  {
    id: "space-a",
    name: "Space A",
    cardCount: 1,
    dueTodayCount: 0,
    streak: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const card: CardRecord = {
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
  hasExplanation: true,
};

describe("CardsScreen explanations", () => {
  it("opens a cached explanation from the expanded card", async () => {
    const user = userEvent.setup();
    const onExplainCard = vi.fn().mockResolvedValue({
      cached: true,
      generatedAt: NOW,
      payload: {
        schemaVersion: 1,
        paragraphs: [
          "Ownership means one value has one owner.",
          "When the owner goes away, the value is dropped.",
          "Move the value if another binding needs it.",
        ],
        visual: null,
      },
    });

    render(
      <CardsScreen
        actionableDueCount={0}
        cards={[card]}
        isMutating={false}
        onCreateCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onExplainCard={onExplainCard}
        onOpenCreateDialog={vi.fn()}
        onSuspendCard={vi.fn()}
        onUpdateCard={vi.fn()}
        spaces={spaces}
      />,
    );

    await user.click(screen.getByRole("button", { name: /What is ownership/ }));
    await user.click(screen.getByRole("button", { name: "View explanation" }));

    expect(onExplainCard).toHaveBeenCalledWith({ cardId: "card-a", force: false });
    expect(
      await screen.findByRole("complementary", { name: "AI explanation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ownership means one value has one owner.")).toBeInTheDocument();
  });
});
