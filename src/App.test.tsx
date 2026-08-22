import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { corpus as browserCorpus } from "./components/content";
import { knowledgeNodes } from "./data/knowledge";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("NisabaDB application", () => {
  it("presents the canonical branding and living textbook", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: /from first steps/i })).toBeInTheDocument();
    expect(screen.getByText("From first arithmetic to research proofs.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start the living textbook/i }),
    ).toHaveAttribute("href", "/knowledge");
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

  it("uses the one-book information architecture", () => {
    renderAt("/knowledge");
    const navigation = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Knowledge",
      "Papers",
      "Unsolved",
      "Train",
    ]);
    expect(screen.getByRole("heading", { name: /the nisaba mathematics text/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/textbook status/i)).toHaveTextContent(
      new RegExp(`written lessons\\s*${knowledgeNodes.length}`, "i"),
    );
    expect(screen.getByLabelText(/textbook status/i)).toHaveTextContent(/draft chapters\s*20 of 126/i);
    expect(screen.getByLabelText(/textbook status/i)).toHaveTextContent(/reviewed lessons\s*0/i);
    expect(screen.getByLabelText(/textbook table of contents/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/local knowledge dependency graph/i)).toBeInTheDocument();
    expect(screen.getByText(/open all 60 written lessons/i).closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("link", { name: /explore candidate compression routes/i })).toHaveAttribute("href", "/knowledge/compression");
    expect(screen.getByRole("link", { name: /audit all 688 reference records/i })).toHaveAttribute("href", "/knowledge/coverage");
    expect(within(navigation).queryByRole("link", { name: /materials|learn/i })).not.toBeInTheDocument();
  });

  it("separates the actual book draft from its provisional whole-field map", () => {
    renderAt("/knowledge");
    expect(screen.getByRole("heading", { name: /a quantity is an attribute reported with a value and a unit/i })).toBeInTheDocument();
    expect(screen.getByText(/what this chapter compresses/i)).toBeInTheDocument();

    const roadmap = screen.getByRole("region", { name: /126 chapters across 21 parts/i });
    expect(within(roadmap).getByLabelText(/whole-book map status/i)).toHaveTextContent(/20\s*draft/i);
    expect(within(roadmap).getByLabelText(/whole-book map status/i)).toHaveTextContent(/106\s*planned/i);
    expect(within(roadmap).getByLabelText(/whole-book map status/i)).toHaveTextContent(/only draft entries open lessons/i);

    const draftChapter = within(roadmap).getByRole("link", { name: "Quantities, objects, units, and symbols" });
    expect(draftChapter).toHaveAttribute("href", "/knowledge?node=quantities-objects-and-units");
    const plannedChapter = within(roadmap).getByText("Scope, binding, and substitution").closest("li");
    expect(plannedChapter).not.toBeNull();
    expect(within(plannedChapter as HTMLElement).queryByRole("link")).not.toBeInTheDocument();

    const reader = screen.getByRole("article", { name: /a quantity is an attribute/i });
    const references = screen.getByRole("heading", { name: /source works remain evidence behind the book/i });
    expect(reader.compareDocumentPosition(references) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the whole-field compression atlas under Knowledge", async () => {
    renderAt("/knowledge/compression?cluster=linearity-as-common-engine");
    const selectedClusterHeading = await screen.findByRole("heading", { name: /linearity as a common computational engine/i });
    await waitFor(() => expect(selectedClusterHeading).toHaveFocus());
    const navigation = screen.getByRole("navigation", { name: /primary navigation/i });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Knowledge",
      "Papers",
      "Unsolved",
      "Train",
    ]);
    const originalRoute = screen.getByText("Candidate source-route pattern", { selector: "summary span" }).closest("details");
    expect(originalRoute).not.toHaveAttribute("open");
    expect(screen.getByRole("heading", { name: /what does not disappear/i })).toBeInTheDocument();
  });

  it("shows source coverage as an incomplete theorem ledger, not a bookshelf", async () => {
    const registry = {
      schemaVersion: "1.1.0",
      updatedAt: "2026-08-22",
      sourceSetName: "Fixture registry",
      sourceSetRevision: "fixture-r1",
      approvedRecordCount: 1,
      approvedManifestSha256: "a".repeat(64),
      provenance: "Fixture provenance",
      coverageTarget: "Every theorem remains traceable.",
      families: [{ id: "F01", number: 1, title: "Elementary mathematics" }],
      records: [{
        id: "S0001",
        ordinal: 1,
        title: "Fixture Mathematics",
        authorLine: "Ada Example",
        rawCitation: "Fixture Mathematics — Ada Example",
        familyId: "F01",
        requiredEditionComponents: [{ id: "complete-source", label: "Complete fixture source" }],
        resolutionState: "unresolved",
        editionIds: [],
        duplicateOfRecordId: null,
        duplicateEvidence: null,
        resolutionProposalAudit: null,
        resolutionReview: null,
      }],
    };
    const ledger = {
      schemaVersion: "1.1.0",
      updatedAt: "2026-08-22",
      inventoryPolicyVersion: "theorem-floor-v1",
      inventoryPolicy: "Every theorem is inventoried.",
      editions: [],
      scanSegments: [],
      canonicalClaims: [],
      residualArtifacts: [],
      theoremOccurrences: [],
    };
    const verificationPolicy = {
      schemaVersion: "1.0.0",
      updatedAt: "2026-08-22",
      policyRevision: "fixture-policy",
      requireIndependentAdministrativeReview: true,
      administrators: [{ actorId: "admin:fixture", displayName: "Fixture administrator" }],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => String(input).includes("source-records")
        ? registry
        : String(input).includes("verification-policy")
          ? verificationPolicy
          : ledger,
    })));

    renderAt("/knowledge/coverage?source=S0001");
    expect(await screen.findByRole("heading", { name: /every source theorem gets a durable address/i })).toBeInTheDocument();
    const selectedSourceHeading = await screen.findByRole("heading", { name: "Fixture Mathematics" });
    await waitFor(() => expect(selectedSourceHeading).toHaveFocus());
    expect(screen.getByText(/coverage is incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/not a reading list or a materials shelf/i)).toBeInTheDocument();
  });

  it("reads rewritten knowledge with unified notation and searchable chapters", async () => {
    renderAt("/knowledge?node=sets-elements-extensionality");
    const lessonHeading = screen.getByRole("heading", { name: /sets, elements, and extensionality/i });
    expect(lessonHeading).toBeInTheDocument();
    await waitFor(() => expect(lessonHeading).toHaveFocus());
    expect(screen.getByLabelText(/required knowledge/i)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /canonical notation/i })).toBeInTheDocument();
    const lineageSummary = screen.getByText(/reference lineage and rewrite status/i);
    expect(lineageSummary).toBeInTheDocument();
    fireEvent.click(lineageSummary);
    expect(screen.getByRole("link", { name: /S0060 · registry record/i })).toHaveAttribute(
      "href",
      "/knowledge/coverage?source=S0060",
    );

    fireEvent.change(screen.getByRole("searchbox", { name: /find a knowledge node/i }), {
      target: { value: "quantifiers" },
    });
    const contents = screen.getByLabelText(/textbook table of contents/i);
    expect(within(contents).getByRole("link", { name: /quantifiers always have domains/i })).toBeInTheDocument();
    expect(within(contents).queryByRole("link", { name: /equality is not definition/i })).not.toBeInTheDocument();
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

  it("trains a human or AI by re-proving a random reviewed paper node", () => {
    renderAt("/train");
    expect(screen.getByRole("heading", { name: /train by rebuilding a result/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /re-prove this statement/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /your proof attempt/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Reviewed route/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reveal prerequisites/i }));
    expect(screen.getByText(/hint 1.*permitted inputs/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reveal proof idea/i }));
    expect(screen.getByText(/hint 2.*proof idea/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /compare with the reviewed proof/i }));
    expect(screen.getByText(/^Reviewed route/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    expect(screen.getByText(/act as a rigorous proof trainee/i)).toBeInTheDocument();
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
