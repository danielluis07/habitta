import { describe, expect, mock, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";

// Seam 1: the real page in simple view. The 3D scene is swapped out at its
// lazy, client-only module boundary, never stubbed from the inside.
mock.module("@/components/district-scene/scene", () => ({
  default: () => null,
}));

const { default: Home } = await import("@/app/page");
const { default: BuildingPage, generateMetadata: buildingMetadata } = await import(
  "@/app/buildings/[slug]/page"
);
const { getConcept } = await import("@/lib/collection");

// Opens `path` the way a visitor arriving on it would: the URL first, then the
// route's page, letting the lazy scene boundary settle.
async function renderAt(path: string, page: ReactNode) {
  window.history.replaceState(null, "", path);
  await act(async () => {
    render(page);
  });
}

async function renderHome() {
  await renderAt("/", <Home />);
}

async function renderBuildingLink(slug: string) {
  const page = await BuildingPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({}),
  });
  await renderAt(`/buildings/${slug}`, page);
}

function indexToggle() {
  return screen.getByRole("button", { name: "Building index" });
}

function buildingIndex() {
  return screen.getByRole("region", { name: "Building index" });
}

function indexEntryLink(name: string) {
  return within(buildingIndex()).getByRole("link", { name });
}

function overview(name: string) {
  return screen.getByRole("region", { name });
}

function queryOverview(name: string) {
  return screen.queryByRole("region", { name });
}

async function openIndex(user: UserEvent) {
  await user.click(indexToggle());
}

async function goBack() {
  await act(async () => {
    window.history.back();
  });
}

async function goForward() {
  await act(async () => {
    window.history.forward();
  });
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

describe("building overview", () => {
  test("opens from an index entry, naming the building, its featured residence and description", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);

    await user.click(indexEntryLink("Crest"));

    const crest = getConcept("crest")!;
    const panel = overview("Crest");
    expect(within(panel).getByRole("heading", { level: 2, name: "Crest" })).toHaveFocus();
    expect(within(panel).getByText(crest.building.description)).toBeInTheDocument();
    expect(within(panel).getByText("Featured residence")).toBeInTheDocument();
    expect(within(panel).getByText("Horizon")).toBeInTheDocument();
    expect(within(panel).getByText(/Imagined concept/)).toBeInTheDocument();
  });

  test("opens from the keyboard and keeps the visitor in the district", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);

    await tabTo(user, indexEntryLink("Grove"));
    await user.keyboard("{Enter}");

    expect(within(overview("Grove")).getByRole("heading", { name: "Grove" })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(buildingIndex()).toBeInTheDocument();
    expect(indexEntryLink("Grove")).toHaveAttribute("aria-current", "page");
  });

  test("closes back to the district and returns focus to the index entry that opened it", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);
    await user.click(indexEntryLink("Contour"));

    await user.click(
      within(overview("Contour")).getByRole("button", { name: "Return to district" }),
    );

    expect(queryOverview("Contour")).not.toBeInTheDocument();
    expect(indexEntryLink("Contour")).toHaveFocus();
    expect(indexEntryLink("Contour")).not.toHaveAttribute("aria-current");
    expect(window.location.pathname).toBe("/");
  });

  test("switches straight from one building to another", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);
    await user.click(indexEntryLink("Crest"));

    await user.click(indexEntryLink("Grove"));

    expect(queryOverview("Crest")).not.toBeInTheDocument();
    expect(within(overview("Grove")).getByRole("heading", { name: "Grove" })).toHaveFocus();
    expect(within(overview("Grove")).getByText("Garden")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/buildings/grove");

    await user.click(within(overview("Grove")).getByRole("button", { name: "Return to district" }));

    expect(indexEntryLink("Grove")).toHaveFocus();
  });

  test("the Habitta wordmark returns to the district overview in place", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);
    await user.click(indexEntryLink("Crest"));

    await user.click(screen.getByRole("link", { name: "Habitta" }));

    expect(queryOverview("Crest")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
});

describe("building URL", () => {
  test("reflects the selected building", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);

    expect(indexEntryLink("Contour")).toHaveAttribute("href", "/buildings/contour");

    await user.click(indexEntryLink("Contour"));

    expect(window.location.pathname).toBe("/buildings/contour");
  });

  test("a direct link renders that building's overview without the scene", async () => {
    await renderBuildingLink("contour");

    const panel = overview("Contour");
    expect(within(panel).getByRole("heading", { level: 2, name: "Contour" })).toBeInTheDocument();
    expect(within(panel).getByText("Terrace")).toBeInTheDocument();
    expect(
      within(panel).getByText(getConcept("contour")!.building.description),
    ).toBeInTheDocument();
  });

  test("a direct link names the building in the page metadata", async () => {
    const metadata = await buildingMetadata({
      params: Promise.resolve({ slug: "grove" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe("Grove");
    expect(metadata.description).toBe(getConcept("grove")!.building.description);
  });

  test("closing a directly linked overview returns to the district with focus on the index toggle", async () => {
    const user = userEvent.setup();
    await renderBuildingLink("crest");

    await user.click(within(overview("Crest")).getByRole("button", { name: "Return to district" }));

    expect(queryOverview("Crest")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(indexToggle()).toHaveFocus();
  });

  test("back and forward move between the district and building stages", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);
    await user.click(indexEntryLink("Crest"));
    await user.click(indexEntryLink("Contour"));

    await goBack();
    await waitFor(() => expect(window.location.pathname).toBe("/buildings/crest"));
    expect(queryOverview("Contour")).not.toBeInTheDocument();
    expect(within(overview("Crest")).getByRole("heading", { name: "Crest" })).toHaveFocus();

    await goBack();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(queryOverview("Crest")).not.toBeInTheDocument();
    // Crest was reached through history, not a control, so focus lands on the index toggle.
    expect(indexToggle()).toHaveFocus();

    await goForward();
    await waitFor(() => expect(window.location.pathname).toBe("/buildings/crest"));
    expect(overview("Crest")).toBeInTheDocument();
  });
});
