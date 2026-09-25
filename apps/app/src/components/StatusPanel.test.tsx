import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusPanel } from "./StatusPanel";

afterEach(() => {
  cleanup();
});

describe("StatusPanel", () => {
  it("announces failures as alerts with their recovery actions", () => {
    render(
      <StatusPanel
        actions={<button type="button">Try again</button>}
        message="The database is locked."
        role="alert"
        title="Pupil couldn’t start"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Pupil couldn’t start");
    expect(alert).toHaveTextContent("The database is locked.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("uses a polite status by default", () => {
    render(<StatusPanel message="That space no longer exists." title="Space not found" />);

    expect(screen.getByRole("status")).toHaveTextContent("Space not found");
    expect(screen.getByRole("heading", { name: "Space not found" })).toBeInTheDocument();
  });
});
