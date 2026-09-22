import { describe, expect, mock, test } from "bun:test";
import { act, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";

// Seam 1: the real page in simple view. The 3D scene is swapped out at its
// lazy, client-only module boundary, never stubbed from the inside.
mock.module("@/components/district-scene/scene", () => ({
  default: () => null,
}));

const { default: Home } = await import("@/app/page");
const { getConcept } = await import("@/lib/collection");

// Renders the page and lets the lazy scene boundary settle.
async function renderHome() {
  await act(async () => {
    render(<Home />);
  });
}

function indexToggle() {
  return screen.getByRole("button", { name: "Building index" });
}

async function tabTo(user: UserEvent, target: HTMLElement) {
  for (let presses = 0; presses < 10 && document.activeElement !== target; presses++) {
    await user.tab();
  }
  expect(target).toHaveFocus();
}

describe("arrival", () => {
  test("says Habitta shows imagined residential concepts, not real developments or listings", async () => {
    await renderHome();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(/architecture studio showing imagined residential concepts/),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a real development or listing/)).toBeInTheDocument();
  });

  test("starts with the building index closed", async () => {
    await renderHome();

    expect(indexToggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Building index" })).not.toBeInTheDocument();
  });
});

describe("building index", () => {
  test("opens from arrival with the keyboard", async () => {
    const user = userEvent.setup();
    await renderHome();

    await tabTo(user, indexToggle());
    await user.keyboard("{Enter}");

    const index = screen.getByRole("region", { name: "Building index" });
    expect(indexToggle()).toHaveAttribute("aria-expanded", "true");
    expect(within(index).getByRole("heading", { name: "Building index" })).toHaveFocus();
  });

  test("opens from arrival with a pointer", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.click(indexToggle());

    expect(screen.getByRole("region", { name: "Building index" })).toBeInTheDocument();
  });

  test("lists the whole collection in order, each with name, exterior still, description and featured residence", async () => {
    const user = userEvent.setup();
    await renderHome();
    await user.click(indexToggle());

    const index = screen.getByRole("region", { name: "Building index" });
    const entries = within(index).getAllByRole("article");
    expect(entries.map((entry) => within(entry).getByRole("heading").textContent)).toEqual([
      "Crest",
      "Contour",
      "Grove",
    ]);

    for (const [slug, residence] of [
      ["crest", "Horizon"],
      ["contour", "Terrace"],
      ["grove", "Garden"],
    ]) {
      const concept = getConcept(slug)!;
      const entry = within(index).getByRole("article", { name: concept.building.name });

      expect(
        within(entry).getByRole("heading", { level: 3, name: concept.building.name }),
      ).toBeInTheDocument();
      expect(
        within(entry).getByRole("img", { name: concept.building.exteriorStill.alt }),
      ).toBeInTheDocument();
      expect(within(entry).getByText("Placeholder")).toBeInTheDocument();
      expect(within(entry).getByText(concept.building.description)).toBeInTheDocument();
      expect(within(entry).getByText(residence)).toBeInTheDocument();
    }
  });

  test("closes and returns focus to the toggle", async () => {
    const user = userEvent.setup();
    await renderHome();
    await user.click(indexToggle());

    await user.click(screen.getByRole("button", { name: "Close building index" }));

    expect(screen.queryByRole("region", { name: "Building index" })).not.toBeInTheDocument();
    expect(indexToggle()).toHaveAttribute("aria-expanded", "false");
    expect(indexToggle()).toHaveFocus();
  });
});
