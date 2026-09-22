import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { Window as HappyDOMWindow } from "happy-dom";
import type { ReactNode } from "react";
import type { SceneProps } from "@/components/district-scene";

// Seam 1: the real page in simple view. The 3D scene is swapped out at its
// lazy, client-only module boundary, never stubbed from the inside. The
// stand-in marks where the scene would load and keeps the props it was given,
// so a test can report a failure the way the scene would.
const scene: { props?: SceneProps } = {};
mock.module("@/components/district-scene/scene", () => ({
  default: function SceneStandIn(props: SceneProps) {
    scene.props = props;
    return <div data-testid="district-scene" />;
  },
}));

const { default: Home } = await import("@/app/page");
const { default: BuildingPage, generateMetadata: buildingMetadata } = await import(
  "@/app/buildings/[slug]/page"
);
const { default: ResidencePage, generateMetadata: residenceMetadata } = await import(
  "@/app/buildings/[slug]/residence/page"
);
const { collection, getConcept } = await import("@/lib/collection");

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

function routeProps(slug: string) {
  return { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
}

async function renderBuildingLink(slug: string) {
  await renderAt(`/buildings/${slug}`, await BuildingPage(routeProps(slug)));
}

async function renderResidenceLink(slug: string) {
  await renderAt(`/buildings/${slug}/residence`, await ResidencePage(routeProps(slug)));
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
  for (let presses = 0; presses < 20 && document.activeElement !== target; presses++) {
    await user.tab();
  }
  expect(target).toHaveFocus();
}

function story(residence: string) {
  return screen.getByRole("article", { name: residence });
}

function queryStory(residence: string) {
  return screen.queryByRole("article", { name: residence });
}

function detailsToggle() {
  return screen.getByRole("button", { name: "Dimensions and diagram" });
}

function openResidenceLink(building: string) {
  return within(overview(building)).getByRole("link", { name: "Open residence" });
}

async function openStory(user: UserEvent, building: string) {
  await openIndex(user);
  await user.click(indexEntryLink(building));
  await user.click(openResidenceLink(building));
}

// Matches the element whose whole text, children included, is `content`.
function wholeText(content: string) {
  return (_: string, element: Element | null) => element?.textContent === content;
}

function expectInDocumentOrder(nodes: HTMLElement[]) {
  const all = Array.from(document.querySelectorAll("*"));
  const positions = nodes.map((node) => all.indexOf(node));
  expect(positions).toEqual(positions.toSorted((a, b) => a - b));
}

// The system reduced-motion preference the page finds on load.
function setSystemReducedMotion(reduce: boolean) {
  (window as unknown as HappyDOMWindow).happyDOM.settings.device.prefersReducedMotion = reduce
    ? "reduce"
    : "no-preference";
}

function motionSwitch() {
  return screen.getByRole("switch", { name: "Motion" });
}

function simpleViewSwitch() {
  return screen.getByRole("switch", { name: "Simple view" });
}

function notice() {
  return screen.getByRole("status");
}

function expectPreferencesOutOfUrl() {
  expect(window.location.search).toBe("");
  expect(window.location.hash).toBe("");
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
    const metadata = await buildingMetadata(routeProps("grove"));

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

describe("opening the featured residence", () => {
  test("the overview's Open residence action opens the story with its heading focused", async () => {
    const user = userEvent.setup();
    await renderHome();

    await openStory(user, "Crest");

    expect(within(story("Horizon")).getByRole("heading", { level: 1, name: "Horizon" })).toHaveFocus();
    expect(window.location.pathname).toBe("/buildings/crest/residence");
    // The story replaces the district view rather than stacking on it.
    expect(queryOverview("Crest")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      "Horizon",
    ]);
  });

  test("opens from the keyboard", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);
    await user.click(indexEntryLink("Grove"));

    await tabTo(user, openResidenceLink("Grove"));
    await user.keyboard("{Enter}");

    expect(within(story("Garden")).getByRole("heading", { level: 1 })).toHaveFocus();
  });

  test("each building leads to exactly one featured residence, with no chooser", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openIndex(user);

    for (const concept of collection) {
      await user.click(indexEntryLink(concept.building.name));

      const links = within(overview(concept.building.name)).getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", `/buildings/${concept.slug}/residence`);
    }
  });
});

describe.each(collection.map((concept) => [concept.featuredResidence.name, concept] as const))(
  "the %s story",
  (_, concept) => {
    const { building, featuredResidence: residence, visualizations, diagram } = concept;

    test("renders its sections in the fixed order", async () => {
      await renderResidenceLink(concept.slug);
      const article = story(residence.name);
      const text = (content: string) => within(article).getByText(content);
      const image = (alt: string) => within(article).getByRole("img", { name: alt });
      const heading = (name: string) => within(article).getByRole("heading", { level: 2, name });

      expect(
        within(article)
          .getAllByRole("heading", { level: 2 })
          .map((h) => h.textContent),
      ).toEqual([
        "The idea",
        "The arrangement",
        "Room by room",
        "Materials",
        `Within ${building.name}`,
        "More in the district",
      ]);

      expectInDocumentOrder([
        // 1. Identification, with the living visualization as the opening image
        within(article).getByRole("heading", { level: 1, name: residence.name }),
        within(article).getByText(wholeText(`${building.name} · ${building.role}`)),
        image(visualizations.living.alt),
        text(residence.roomStories.living),
        // 2. Design idea and plain-language arrangement
        heading("The idea"),
        text(residence.designIdea),
        heading("The arrangement"),
        text(residence.arrangement),
        // 3. The outdoor and quiet-room visualizations with their room stories
        heading("Room by room"),
        image(visualizations.outdoor.alt),
        text(residence.roomStories.outdoor),
        image(visualizations.quietRoom.alt),
        text(residence.roomStories.quietRoom),
        // 4. Visible materials, the material study, then the collapsed details
        heading("Materials"),
        ...residence.materials.map((material) => text(material.name)),
        image(visualizations.materialStudy.alt),
        within(article).getByRole("button", { name: "Dimensions and diagram" }),
        // 5. The home within its building
        heading(`Within ${building.name}`),
        image(visualizations.buildingContext.alt),
        text(residence.buildingRelationship),
        // 6. The way on through the district
        heading("More in the district"),
        within(article).getByRole("button", { name: "Continue exploring" }),
      ]);

      for (const material of residence.materials) {
        expect(text(material.location)).toBeVisible();
      }
    });

    test("presents the home as an imagined concept and its imagery as concept visualizations", async () => {
      await renderResidenceLink(concept.slug);
      const article = story(residence.name);

      expect(within(article).getByText(/Imagined Habitta concept/)).toBeVisible();
      expect(
        within(article).getByText(/concept visualizations of the design, not photographs/),
      ).toBeVisible();

      const figures = within(article).getAllByRole("figure");
      expect(figures).toHaveLength(5);
      for (const figure of figures) {
        expect(figure).toHaveTextContent(/Concept visualization · /);
      }
    });

    test("gives every visualization and the diagram meaningful alt text and explicit dimensions", async () => {
      const user = userEvent.setup();
      await renderResidenceLink(concept.slug);
      await user.click(detailsToggle());

      const images = within(story(residence.name)).getAllByRole("img");
      const expected = [
        visualizations.living,
        visualizations.outdoor,
        visualizations.quietRoom,
        visualizations.materialStudy,
        diagram,
        visualizations.buildingContext,
      ];
      expect(images.map((image) => image.getAttribute("alt"))).toEqual(
        expected.map((image) => image.alt),
      );
      images.forEach((image, i) => {
        expect(image).toHaveAttribute("width", String(expected[i].width));
        expect(image).toHaveAttribute("height", String(expected[i].height));
      });
    });

    test("names the residence in its page metadata, with the opening image as the preview", async () => {
      const metadata = await residenceMetadata(routeProps(concept.slug));
      const preview = visualizations.living;
      const images = [
        { url: preview.src, width: preview.width, height: preview.height, alt: preview.alt },
      ];

      expect(metadata.title).toBe(`${residence.name} residence in ${building.name}`);
      expect(metadata.description).toContain("imagined Habitta concept");
      expect(metadata.description).toContain(residence.designIdea);
      expect(metadata.openGraph?.title).toBe(
        `${residence.name} residence in ${building.name} · Habitta`,
      );
      expect(metadata.openGraph?.images).toEqual(images);
      expect(metadata.twitter?.images).toEqual(images);
    });
  },
);

describe("dimensions and diagram", () => {
  test("start collapsed and expand from the keyboard, labeled schematic and approximate", async () => {
    const user = userEvent.setup();
    await renderResidenceLink("crest");
    const crest = getConcept("crest")!;
    const article = story("Horizon");

    expect(detailsToggle()).toHaveAttribute("aria-expanded", "false");
    expect(within(article).queryByRole("img", { name: crest.diagram.alt })).not.toBeInTheDocument();
    expect(within(article).getByText("Approx. 140 m²")).not.toBeVisible();

    await tabTo(user, detailsToggle());
    await user.keyboard("{Enter}");

    expect(detailsToggle()).toHaveAttribute("aria-expanded", "true");
    expect(within(article).getByRole("img", { name: crest.diagram.alt })).toBeVisible();
    expect(within(article).getByText("Schematic, not to scale")).toBeVisible();
    expect(within(article).getByText(/Approximate design targets/)).toBeVisible();
    for (const figure of ["Approx. 140 m²", "Approx. 22 m²", "Approx. 42 m"]) {
      expect(within(article).getByText(figure)).toBeVisible();
    }
    for (const label of [
      "Interior area",
      "Outdoor area",
      "Bedrooms",
      "Building storeys",
      "Building height",
    ]) {
      expect(within(article).getByText(label)).toBeVisible();
    }
  });
});

describe("leaving the residence story", () => {
  test("Back to building returns to that overview with the selection kept", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openStory(user, "Crest");

    await user.click(screen.getByRole("button", { name: "Back to Crest" }));

    expect(queryStory("Horizon")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/buildings/crest");
    expect(within(overview("Crest")).getByText("Horizon")).toBeInTheDocument();
    expect(openResidenceLink("Crest")).toHaveFocus();
    expect(indexEntryLink("Crest")).toHaveAttribute("aria-current", "page");
  });

  test("Return to district clears the selection and returns focus to the entry that selected it", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openStory(user, "Contour");

    await user.click(screen.getByRole("button", { name: "Return to district" }));

    expect(queryStory("Terrace")).not.toBeInTheDocument();
    expect(queryOverview("Contour")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(indexEntryLink("Contour")).toHaveFocus();
    expect(indexEntryLink("Contour")).not.toHaveAttribute("aria-current");
  });

  test("Continue exploring at the end of the story opens the building index with nothing selected", async () => {
    const user = userEvent.setup();
    await renderResidenceLink("grove");

    await tabTo(user, screen.getByRole("button", { name: "Continue exploring" }));
    await user.keyboard("{Enter}");

    expect(queryStory("Garden")).not.toBeInTheDocument();
    expect(queryOverview("Grove")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(within(buildingIndex()).getByRole("heading", { name: "Building index" })).toHaveFocus();
    expect(indexToggle()).toHaveAttribute("aria-expanded", "true");
    expect(indexEntryLink("Grove")).not.toHaveAttribute("aria-current");
  });

  test("Continue exploring lands on the index even when it was already open", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openStory(user, "Crest");

    await user.click(screen.getByRole("button", { name: "Continue exploring" }));

    expect(within(buildingIndex()).getByRole("heading", { name: "Building index" })).toHaveFocus();
    expect(window.location.pathname).toBe("/");
  });
});

describe("residence URL", () => {
  test("a direct link renders the story without loading the scene", async () => {
    const user = userEvent.setup();
    await renderResidenceLink("grove");

    expect(within(story("Garden")).getByRole("heading", { level: 1, name: "Garden" })).toBeVisible();
    expect(screen.queryByTestId("district-scene")).not.toBeInTheDocument();

    // The scene loads once the visitor heads back into the district.
    await user.click(screen.getByRole("button", { name: "Back to Grove" }));

    expect(within(overview("Grove")).getByRole("heading", { name: "Grove" })).toBeInTheDocument();
    expect(await screen.findByTestId("district-scene")).toBeInTheDocument();
  });

  test("a direct link server-renders the whole story, including the collapsed details", async () => {
    const contour = getConcept("contour")!;
    const html = renderToString(await ResidencePage(routeProps("contour")));
    // Parse the server's HTML without hydrating it.
    const { container } = render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    const article = within(container).getByRole("article", { name: "Terrace" });

    expect(within(article).getByRole("heading", { level: 1, name: "Terrace" })).toBeInTheDocument();
    expect(within(article).getByText(contour.featuredResidence.arrangement)).toBeInTheDocument();
    for (const image of Object.values(contour.visualizations)) {
      expect(within(article).getByRole("img", { name: image.alt })).toBeInTheDocument();
    }
    expect(within(article).getByText("Approx. 155 m²")).toBeInTheDocument();
    expect(within(article).getByText("Schematic, not to scale")).toBeInTheDocument();
  });

  test("back and forward move between the building and residence stages", async () => {
    const user = userEvent.setup();
    await renderHome();
    await openStory(user, "Crest");
    expect(window.location.pathname).toBe("/buildings/crest/residence");

    await goBack();
    await waitFor(() => expect(window.location.pathname).toBe("/buildings/crest"));
    expect(queryStory("Horizon")).not.toBeInTheDocument();
    expect(openResidenceLink("Crest")).toHaveFocus();

    await goBack();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(queryOverview("Crest")).not.toBeInTheDocument();

    await goForward();
    await waitFor(() => expect(window.location.pathname).toBe("/buildings/crest"));
    expect(overview("Crest")).toBeInTheDocument();

    await goForward();
    await waitFor(() => expect(window.location.pathname).toBe("/buildings/crest/residence"));
    expect(within(story("Horizon")).getByRole("heading", { level: 1 })).toHaveFocus();
  });
});

describe("motion control", () => {
  afterEach(() => setSystemReducedMotion(false));

  test("starts on when the system doesn't ask for reduced motion", async () => {
    await renderHome();

    expect(motionSwitch()).toBeChecked();
    expect(motionSwitch()).toHaveTextContent("Motion On");
  });

  test("starts off when the system asks for reduced motion", async () => {
    setSystemReducedMotion(true);
    await renderHome();

    expect(motionSwitch()).not.toBeChecked();
    expect(motionSwitch()).toHaveTextContent("Motion Off");
  });

  test("overrides the system preference from the keyboard", async () => {
    const user = userEvent.setup();
    setSystemReducedMotion(true);
    await renderHome();

    await tabTo(user, motionSwitch());
    await user.keyboard(" ");

    expect(motionSwitch()).toBeChecked();
    expect(motionSwitch()).toHaveTextContent("Motion On");

    await user.keyboard("{Enter}");

    expect(motionSwitch()).not.toBeChecked();
    expect(motionSwitch()).toHaveTextContent("Motion Off");
  });

  test("keeps the visitor's choice through the journey, out of the URL", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.click(motionSwitch());
    expect(motionSwitch()).not.toBeChecked();

    await openStory(user, "Crest");
    expect(motionSwitch()).not.toBeChecked();
    expect(window.location.pathname).toBe("/buildings/crest/residence");
    expectPreferencesOutOfUrl();

    await user.click(screen.getByRole("button", { name: "Back to Crest" }));
    await user.click(screen.getByRole("link", { name: "Habitta" }));
    expect(motionSwitch()).not.toBeChecked();
    expect(window.location.pathname).toBe("/");
  });
});

describe("simple view control", () => {
  test("starts off, with the 3D scene loading", async () => {
    await renderHome();

    expect(simpleViewSwitch()).not.toBeChecked();
    expect(simpleViewSwitch()).toHaveTextContent("Simple view Off");
    expect(await screen.findByTestId("district-scene")).toBeInTheDocument();
  });

  test("switches from the district, where the building index becomes the page", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.click(simpleViewSwitch());

    expect(simpleViewSwitch()).toBeChecked();
    expect(simpleViewSwitch()).toHaveTextContent("Simple view On");
    expect(simpleViewSwitch()).toHaveFocus();
    expect(screen.queryByTestId("district-scene")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expectPreferencesOutOfUrl();

    // The index is always open, so it has no toggle and no close action.
    expect(buildingIndex()).toBeVisible();
    expect(screen.queryByRole("button", { name: "Building index" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close building index" }),
    ).not.toBeInTheDocument();

    await user.click(indexEntryLink("Grove"));
    await user.click(within(overview("Grove")).getByRole("button", { name: "Return to district" }));

    expect(indexEntryLink("Grove")).toHaveFocus();
    expect(simpleViewSwitch()).toBeChecked();
  });

  test("switches from a building overview without changing the selection or URL", async () => {
    const user = userEvent.setup();
    await renderBuildingLink("crest");
    await screen.findByTestId("district-scene");

    await user.click(simpleViewSwitch());

    expect(simpleViewSwitch()).toBeChecked();
    expect(screen.queryByTestId("district-scene")).not.toBeInTheDocument();
    expect(within(overview("Crest")).getByText("Horizon")).toBeInTheDocument();
    expect(indexEntryLink("Crest")).toHaveAttribute("aria-current", "page");
    expect(window.location.pathname).toBe("/buildings/crest");
    expectPreferencesOutOfUrl();

    // Closing a directly linked overview lands on the index, which simple view keeps open.
    await user.click(within(overview("Crest")).getByRole("button", { name: "Return to district" }));

    expect(queryOverview("Crest")).not.toBeInTheDocument();
    expect(within(buildingIndex()).getByRole("heading", { name: "Building index" })).toHaveFocus();
  });

  test("switches from a residence story without changing the selection or URL", async () => {
    const user = userEvent.setup();
    await renderResidenceLink("crest");

    await user.click(simpleViewSwitch());

    expect(simpleViewSwitch()).toBeChecked();
    expect(within(story("Horizon")).getByRole("heading", { level: 1 })).toBeVisible();
    expect(window.location.pathname).toBe("/buildings/crest/residence");
    expectPreferencesOutOfUrl();

    await user.click(screen.getByRole("button", { name: "Back to Crest" }));

    expect(within(overview("Crest")).getByRole("heading", { name: "Crest" })).toBeInTheDocument();
    expect(simpleViewSwitch()).toBeChecked();
    expect(buildingIndex()).toBeVisible();
    expect(screen.queryByTestId("district-scene")).not.toBeInTheDocument();
  });

  test("is operable from the keyboard", async () => {
    const user = userEvent.setup();
    await renderHome();

    await tabTo(user, simpleViewSwitch());
    await user.keyboard("{Enter}");

    expect(simpleViewSwitch()).toBeChecked();
    expect(buildingIndex()).toBeVisible();

    await user.keyboard(" ");

    expect(simpleViewSwitch()).not.toBeChecked();
    expect(simpleViewSwitch()).toHaveFocus();
  });

  test("announces the switch briefly in a polite live region, without moving focus", async () => {
    const user = userEvent.setup();
    await renderHome();

    expect(notice()).toHaveAttribute("aria-live", "polite");
    expect(notice()).toBeEmptyDOMElement();

    await user.click(simpleViewSwitch());

    expect(notice()).toHaveTextContent(
      "Simple view is on. The building index lists every building.",
    );
    expect(simpleViewSwitch()).toHaveFocus();
  });

  test("the notice can be dismissed, returning focus to the simple view control", async () => {
    const user = userEvent.setup();
    await renderHome();
    await user.click(simpleViewSwitch());

    await user.click(screen.getByRole("button", { name: "Dismiss notice" }));

    expect(notice()).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: "Dismiss notice" })).not.toBeInTheDocument();
    expect(simpleViewSwitch()).toBeChecked();
    expect(simpleViewSwitch()).toHaveFocus();
  });

  test("switching back brings back the scene and the index as it was", async () => {
    const user = userEvent.setup();
    await renderHome();
    await user.click(simpleViewSwitch());

    await user.click(simpleViewSwitch());

    expect(simpleViewSwitch()).not.toBeChecked();
    expect(await screen.findByTestId("district-scene")).toBeInTheDocument();
    expect(notice()).toBeEmptyDOMElement();
    expect(indexToggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Building index" })).not.toBeInTheDocument();
  });

  test.each([
    ["unsupported", "this device can't show the 3D district"],
    ["contextLost", "the 3D district stopped working"],
    ["assetFailed", "part of the 3D district couldn't load"],
    ["slow", "the 3D district was running too slowly"],
  ] as const)(
    "a scene reporting %s switches the same way, keeping the selection and saying why",
    async (reason, why) => {
      await renderBuildingLink("contour");
      await screen.findByTestId("district-scene");

      await act(async () => {
        scene.props?.onSimpleView(reason);
      });

      expect(simpleViewSwitch()).toBeChecked();
      expect(screen.queryByTestId("district-scene")).not.toBeInTheDocument();
      expect(notice()).toHaveTextContent(`Simple view is on because ${why}.`);
      expect(within(overview("Contour")).getByText("Terrace")).toBeInTheDocument();
      expect(window.location.pathname).toBe("/buildings/contour");
    },
  );

  test("back and forward keep simple view", async () => {
    const user = userEvent.setup();
    await renderHome();
    await user.click(simpleViewSwitch());
    await user.click(indexEntryLink("Crest"));

    await goBack();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(simpleViewSwitch()).toBeChecked();
    expect(buildingIndex()).toBeVisible();

    await goForward();
    await waitFor(() => expect(window.location.pathname).toBe("/buildings/crest"));
    expect(overview("Crest")).toBeInTheDocument();
    expect(simpleViewSwitch()).toBeChecked();
    expect(screen.queryByTestId("district-scene")).not.toBeInTheDocument();
  });

  test("the Habitta wordmark returns to the district overview without leaving simple view", async () => {
    const user = userEvent.setup();
    await renderBuildingLink("grove");
    await user.click(simpleViewSwitch());

    await user.click(screen.getByRole("link", { name: "Habitta" }));

    expect(queryOverview("Grove")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(simpleViewSwitch()).toBeChecked();
    expect(buildingIndex()).toBeVisible();
  });
});
