import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { corpus as browserCorpus } from "./components/content";

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("NisabaDB application", () => {
  it("presents the canonical branding and paper-first corpus phase", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: /distilled, verified/i })).toBeInTheDocument();
    expect(screen.getByText("The distilled, verified graph of mathematics.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /explore the paper corpus/i }),
    ).toHaveAttribute("href", "/papers");
  });

  it("opens a deep-linked result with its exact statement and active route", () => {
    renderAt(
      "/papers/dimension-free-dictatorship-tester?view=main&node=S01_T01&route=compressed-source",
    );
    const selectedPanel = screen.getByRole("article", { name: /main theorem/i });
    expect(within(selectedPanel).getByText("Exact statement")).toBeInTheDocument();
    expect(within(selectedPanel).getByLabelText(/proof route for thm 1.1/i)).toHaveValue(
      "compressed-source",
    );
    expect(within(selectedPanel).getByText(/complete relative to the listed prerequisites/i)).toBeInTheDocument();
    expect(within(selectedPanel).getByLabelText(/available dependency routes/i)).toHaveTextContent(
      /original/i,
    );
  });

  it("uses a papers-first information architecture and gates premature Knowledge", () => {
    renderAt("/knowledge");
    const navigation = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Papers",
      "Knowledge",
      "Unsolved",
      "Learn",
    ]);
    expect(screen.getByRole("heading", { name: /knowledge comes after corpus coverage/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/knowledge activation status/i)).toHaveTextContent(/canonical knowledge nodes\s*0/i);
    expect(screen.queryByLabelText(/layered prerequisite graph/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /build the paper corpus first/i })).toHaveAttribute("href", "/papers");
  });

  it("shows the paper citation DAG, processing backlog, and bounded catalog", () => {
    renderAt("/papers");
    expect(screen.getByRole("heading", { name: /papers first/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rooted paper citation dag/i)).toBeInTheDocument();
    expect(screen.getByText(/additional raw relations omitted to preserve the dag/i)).toBeInTheDocument();
    expect(screen.getAllByText(/cited by later in this projection/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /find a paper to map/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /paper at the goal/i })).not.toBeInTheDocument();
    expect(screen.getByText(/record limit|depth limit/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what the corpus still needs/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/paper catalog pages/i)).toHaveTextContent(/page 1 of/i);
    expect(screen.getByLabelText(/paper catalog filters/i)).toHaveTextContent(
      new RegExp(`${browserCorpus.papers.length.toLocaleString()} records`, "i"),
    );
  });

  it("renders one complete paper graph without topic-view tabs", () => {
    renderAt("/papers/dimension-free-dictatorship-tester");
    expect(screen.getByRole("heading", { name: /complete paper graph/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/graph scope/i)).toHaveTextContent(/all results.*one dependency space/i);
    expect(screen.queryByRole("tablist", { name: /graph views/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /expand visible/i }));
    const graphNodeIds = Array.from(document.querySelectorAll<HTMLElement>("[id^='graph-node-']"))
      .map((node) => node.id);
    expect(new Set(graphNodeIds).size).toBe(graphNodeIds.length);
  });

  it("keeps unreviewed conjectures out of the public Unsolved list", () => {
    renderAt("/unsolved");
    expect(screen.getByRole("heading", { name: /the empty list is intentional/i })).toBeInTheDocument();
    expect(screen.getByText(/none has completed.*confirmed open as of/i)).toBeInTheDocument();
  });

  it("gates global learning routes until Knowledge compression exists", () => {
    renderAt("/learn");
    expect(screen.getByRole("heading", { name: /training follows compression/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/learning activation status/i)).toHaveTextContent(/active curricula\s*0/i);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /paper/i }).length).toBeGreaterThan(0);
  });

  it("serves the multislice gold rewrite and its source-audited main theorem", () => {
    renderAt(
      "/papers/braverman-khot-lifshitz-minzer-2025-invariance-principle-multislice?view=main-invariance&node=BKLM_T01",
    );
    expect(screen.getByRole("heading", {
      name: /an invariance principle for the multi-slice/i,
    })).toBeInTheDocument();
    const selectedPanel = screen.getByRole("article", {
      name: /multilinear invariance principle for the multislice/i,
    });
    expect(within(selectedPanel).getByText(/complete relative to the listed prerequisites/i))
      .toBeInTheDocument();
    expect(within(selectedPanel).getAllByRole("button", { name: /claim 4\.1/i }).length)
      .toBeGreaterThan(0);
    expect(document.querySelector(".katex-error")).not.toBeInTheDocument();
  });

  it("filters the graph by mathematical content without losing its ancestor path", () => {
    renderAt("/papers/dimension-free-dictatorship-tester?view=main");
    fireEvent.change(screen.getByRole("searchbox", { name: /search statements/i }), {
      target: { value: "odd certificate" },
    });
    expect(screen.getAllByText("Odd certificate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Main theorem").length).toBeGreaterThan(0);
  });

  it("reports kernel checking independently and exposes the formal audit footprint", () => {
    renderAt(
      "/papers/dimension-free-dictatorship-tester?view=main&node=S01_T01&route=compressed-source",
    );
    const coverage = screen.getByRole("region", { name: /evidence, not a blanket badge/i });
    expect(within(coverage).getByText("49")).toBeInTheDocument();
    expect(within(coverage).getByText(/of 51 statement records have checker-accepted artifacts/i)).toBeInTheDocument();
    const graphControls = screen.getByLabelText("Dependency graph controls");
    expect(within(graphControls).getByText("49").parentElement).toHaveTextContent(
      /49\s*formally checked/i,
    );

    const selectedPanel = screen.getByRole("article", { name: /main theorem/i });
    expect(within(selectedPanel).getAllByText("Axiom footprint").length).toBeGreaterThan(0);
    expect(within(selectedPanel).getByText("fknStability_input")).toBeInTheDocument();
    expect(within(selectedPanel).getAllByText("Contains sorry").length).toBeGreaterThan(0);
  });

  it("qualifies incomplete citation coverage on the public paper page", () => {
    renderAt("/papers/dimension-free-dictatorship-tester");
    const citations = screen.getByRole("region", {
      name: /the paper in its mathematical neighborhood/i,
    });
    expect(within(citations).getByText(/target unindexed/i)).toBeInTheDocument();
    expect(
      within(citations).getByText(/zero provider-visible incoming citations is not evidence/i),
    ).toBeInTheDocument();
    expect(within(citations).getByText(/why this queue item is blocked/i)).toBeInTheDocument();
  });

  it("renders retained unresolved provider identifiers instead of only their count", () => {
    const queueItem = browserCorpus.ingestionQueue.find(
      (item) => item.paperId === "dimension-free-dictatorship-tester",
    );
    if (!queueItem) throw new Error("fixture missing featured-paper queue item");
    const originalProviderIds = queueItem.unresolvedProviderIds;
    queueItem.unresolvedProviderIds = ["W404000999"];

    try {
      renderAt("/papers/dimension-free-dictatorship-tester");
      const retainedIds = screen.getByRole("complementary", {
        name: /unresolved provider identifiers/i,
      });
      expect(within(retainedIds).getByText("W404000999")).toBeInTheDocument();
    } finally {
      queueItem.unresolvedProviderIds = originalProviderIds;
    }
  });

  it("shows preserved wording in source mode and withholds empty provisional readings", () => {
    const { unmount } = renderAt(
      "/papers/dimension-free-dictatorship-tester/distilled?mode=source&expand=all",
    );
    const sourceHeading = screen.getByRole("heading", {
      name: /structural input: boolean degree-one functions/i,
    });
    const sourceSection = sourceHeading.closest("section");
    if (!sourceSection) throw new Error("source statement section not found");
    expect(within(sourceSection).getByText("Preserved source statement")).toBeInTheDocument();
    expect(within(sourceSection).getByText("Statement audit")).toBeInTheDocument();
    expect(within(sourceSection).queryByText(/^Assume/)).not.toBeInTheDocument();
    expect(document.querySelector(".katex-error")).not.toBeInTheDocument();

    unmount();
    renderAt("/papers/blais-2009-testing-juntas-nearly-optimally");
    expect(screen.queryByRole("link", { name: /read distilled paper/i })).not.toBeInTheDocument();
  });
});
