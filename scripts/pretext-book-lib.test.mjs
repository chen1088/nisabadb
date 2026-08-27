import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectPretextSourceUnits,
  extractPretextGraphFromUnits,
  licenseFromText,
} from "./pretext-book-lib.mjs";

const capturedAt = "2026-01-02T03:04:05.000Z";
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function extract(body) {
  return extractPretextGraphFromUnits([{
    path: "source/fixture.ptx",
    content: `<?xml version="1.0" encoding="UTF-8"?><section>${body}</section>`,
  }], { capturedAt });
}

describe("PreTeXt proof dependency extraction", () => {
  it("traverses .xml PreTeXt roots and includes while retaining text includes as evidence only", () => {
    const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "nisabadb-pretext-xml-"));
    temporaryDirectories.push(checkout);
    const sourceDirectory = path.join(checkout, "src");
    fs.mkdirSync(sourceDirectory);
    fs.writeFileSync(path.join(sourceDirectory, "book.xml"), `
      <pretext xmlns:xi="http://www.w3.org/2001/XInclude">
        <book>
          <xi:include href="chapter.xml"/>
          <xi:include href="snippet.txt" parse="text"/>
          <image><prefigure><xi:include href="diagram.xml"/></prefigure></image>
        </book>
      </pretext>
    `);
    fs.writeFileSync(path.join(sourceDirectory, "chapter.xml"), "<chapter>\r\n<p>Chapter text.</p>\r\n</chapter>\r\n");
    fs.writeFileSync(path.join(sourceDirectory, "snippet.txt"), "Embedded text.");
    fs.writeFileSync(path.join(sourceDirectory, "diagram.xml"), "<diagram><definition>x=1</definition></diagram>");

    const collected = collectPretextSourceUnits(checkout, "src/book.xml");

    expect(collected.units.map((unit) => unit.path)).toEqual([
      "src/book.xml",
      "src/chapter.xml",
    ]);
    expect(collected.units.find(({ path: unitPath }) => unitPath === "src/chapter.xml")?.content)
      .toBe("<chapter>\n<p>Chapter text.</p>\n</chapter>\n");
    expect(collected.embeddedTextIncludes).toEqual([
      expect.objectContaining({ ownerPath: "src/book.xml", target: "src/snippet.txt" }),
    ]);
    expect(collected.excludedXmlIncludes).toEqual([
      expect.objectContaining({ ownerPath: "src/book.xml", target: "src/diagram.xml" }),
    ]);
    expect(collected.missingIncludes).toEqual([]);
  });

  it("recognizes the edition-level Creative Commons Attribution 4.0 license", () => {
    expect(licenseFromText("https://creativecommons.org/licenses/by/4.0/")).toEqual({
      licenseSpdx: "CC-BY-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });
  });

  it("distinguishes GFDL 1.2-or-later from 1.3-or-later evidence", () => {
    expect(licenseFromText(
      "GNU Free Documentation License, Version 1.2 or any later version",
    )).toEqual({
      licenseSpdx: "GFDL-1.2-or-later",
      licenseUrl: "https://www.gnu.org/licenses/old-licenses/fdl-1.2.html",
    });
    expect(licenseFromText(
      "GNU Free Documentation License, Version 1.3\nor any later version",
    )).toEqual({
      licenseSpdx: "GFDL-1.3-or-later",
      licenseUrl: "https://www.gnu.org/licenses/fdl-1.3.html",
    });
  });

  it("refuses to select one license when active source text contains distinct markers", () => {
    expect(licenseFromText(`
      https://creativecommons.org/licenses/by/4.0/
      https://creativecommons.org/licenses/by-sa/4.0/
    `)).toEqual({ licenseSpdx: null, licenseUrl: null });
  });

  it("excludes graph-like tags nested in pedagogical, remark, and PreFigure containers", () => {
    const result = extract(`
      <definition xml:id="kept-definition"><statement><p>A kept definition.</p></statement></definition>
      <lemma xml:id="kept-lemma"><statement><p>A kept lemma.</p></statement></lemma>
      <example><definition xml:id="example-definition"><statement><p>Not a graph node.</p></statement></definition></example>
      <exercise><theorem xml:id="exercise-theorem"><statement><p>Not a graph node.</p></statement></theorem></exercise>
      <remark><notation xml:id="remark-notation"><p>Not a graph node.</p></notation></remark>
      <activity><claim xml:id="activity-claim"><statement><p>Not a graph node.</p></statement></claim></activity>
      <prefigure><definition xml:id="figure-variable"><p>origin=(0,0)</p></definition></prefigure>
    `);

    expect(result.graph.nodes.map(({ sourceXmlId }) => sourceXmlId)).toEqual([
      "kept-definition",
      "kept-lemma",
    ]);
  });

  it("turns a proof xref to an inventoried node into a candidate edge", () => {
    const result = extract(`
      <lemma xml:id="lemma-input"><statement><p>Every fixture input is valid.</p></statement></lemma>
      <theorem xml:id="theorem-output">
        <statement><p>Every fixture output is valid.</p></statement>
        <proof><p>Apply <xref ref="lemma-input"/>.</p></proof>
      </theorem>
    `);

    expect(result.graph.directDependencies).toHaveLength(1);
    expect(result.graph.directDependencies[0]).toMatchObject({
      dependentNodeId: "theorem-output",
      prerequisite: { type: "node", id: "lemma-input" },
      role: "logical",
      evidence: { status: "captured", independentReview: null },
    });
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "theorem-output",
      basis: "proof-xref",
      ref: "lemma-input",
      resolution: {
        status: "resolved",
        target: { type: "node", id: "lemma-input" },
        directDependencyId: result.graph.directDependencies[0].id,
        note: expect.any(String),
      },
    }));
    expect(result.graph.proofRoutes[0]?.dependencyIds).toEqual([
      result.graph.directDependencies[0].id,
    ]);
  });

  it("merges repeated proof xrefs into one direct edge while retaining both references", () => {
    const result = extract(`
      <lemma xml:id="lemma-input"><statement><p>Input.</p></statement></lemma>
      <theorem xml:id="theorem-output">
        <statement><p>Output.</p></statement>
        <proof>
          <p>First use <xref ref="lemma-input"/>.</p>
          <p>Then use <xref ref="lemma-input"/> again.</p>
        </proof>
      </theorem>
    `);

    const proofReferences = result.graph.references.filter((reference) => (
      reference.ownerNodeId === "theorem-output" && reference.basis === "proof-xref"
    ));
    expect(proofReferences).toHaveLength(2);
    expect(result.graph.directDependencies).toHaveLength(1);
    expect(new Set(proofReferences.map((reference) => reference.resolution.directDependencyId))).toEqual(
      new Set([result.graph.directDependencies[0].id]),
    );
    expect(result.graph.directDependencies[0].evidence.note).toMatch(/2 explicit proof xrefs/i);
  });

  it("retains a statement xref separately without promoting it to a proof dependency", () => {
    const result = extract(`
      <definition xml:id="definition-input"><statement><p>An input is a marked object.</p></statement></definition>
      <theorem xml:id="theorem-output">
        <statement><p>Using <xref ref="definition-input"/>, every input is marked.</p></statement>
        <proof><p>This follows directly.</p></proof>
      </theorem>
    `);

    expect(result.graph.directDependencies).toHaveLength(0);
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "theorem-output",
      basis: "statement-xref",
      ref: "definition-input",
      resolution: {
        status: "resolved",
        target: { type: "node", id: "definition-input" },
        directDependencyId: null,
        note: expect.any(String),
      },
    }));
    expect(result.stats.statementXrefCount).toBe(1);
  });

  it("retains an unresolved proof xref instead of dropping or inventing an edge", () => {
    const result = extract(`
      <theorem xml:id="theorem-output">
        <statement><p>Output.</p></statement>
        <proof><p>Use <xref ref="missing-result"/>.</p></proof>
      </theorem>
    `);

    expect(result.graph.directDependencies).toHaveLength(0);
    expect(result.stats.unresolvedProofXrefCount).toBe(1);
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      basis: "proof-xref",
      ref: "missing-result",
      resolution: { status: "unresolved", note: expect.any(String) },
    }));
  });

  it("inventories a definition and permits it as an explicit proof prerequisite", () => {
    const result = extract(`
      <definition xml:id="def_fixture"><title>Fixture objects</title><statement><p>A fixture is marked.</p></statement></definition>
      <proposition xml:id="prop-fixture">
        <statement><p>Every fixture is marked.</p></statement>
        <proof><p>Apply <xref ref="def_fixture"/>.</p></proof>
      </proposition>
    `);

    const definition = result.graph.nodes.find((node) => node.sourceXmlId === "def_fixture");
    expect(definition).toMatchObject({
      id: "def-fixture",
      nodeClass: "support",
      kind: "definition",
      title: "Fixture objects",
    });
    expect(result.graph.directDependencies[0]).toMatchObject({
      dependentNodeId: "prop-fixture",
      prerequisite: { type: "node", id: "def-fixture" },
      role: "definition",
    });
  });

  it("leaves a theorem with no resolved proof dependency pending rather than making it a root", () => {
    const result = extract(`
      <theorem xml:id="theorem-entry">
        <statement><p>An elementary source claim.</p></statement>
        <proof><p>The source gives a direct argument without a cross-reference.</p></proof>
      </theorem>
    `);

    expect(result.stats.pendingTheoremCount).toBe(1);
    expect(result.graph.directDependencies).toHaveLength(0);
    expect(result.graph.proofRoutes).toHaveLength(0);
    expect(result.graph.proofRoutes.some((route) => route.routeKind === "root-attestation")).toBe(false);
    expect(result.unitInventories).toContainEqual(expect.objectContaining({
      sourceUnitId: result.sourceUnits[0].id,
      theoremNodeIds: ["theorem-entry"],
      supportNodeIds: [],
      theoremFreeAttestation: false,
      evidence: expect.objectContaining({
        status: "captured",
        sourceUnitIds: [result.sourceUnits[0].id],
        captureAudit: expect.objectContaining({
          artifactSha256: result.sourceUnits[0].contentSha256,
        }),
      }),
    }));
  });

  it("records an explicit captured theorem-free inventory for a source unit with no graph nodes", () => {
    const result = extract("<p>This source unit contains narrative only.</p>");

    expect(result.graph.nodes).toHaveLength(0);
    expect(result.unitInventories).toEqual([
      expect.objectContaining({
        sourceUnitId: result.sourceUnits[0].id,
        theoremNodeIds: [],
        supportNodeIds: [],
        theoremFreeAttestation: true,
        evidence: expect.objectContaining({
          status: "captured",
          sourceUnitIds: [result.sourceUnits[0].id],
          independentReview: null,
        }),
      }),
    ]);
  });

  it("associates a standalone proof with the nearest preceding theorem-like sibling", () => {
    const result = extract(`
      <lemma xml:id="lemma-input"><statement><p>Input.</p></statement></lemma>
      <proposition xml:id="prop-output"><statement><p>Output.</p></statement></proposition>
      <p>We now prove the proposition.</p>
      <proof><p>Apply <xref ref="lemma-input"/>.</p></proof>
    `);

    expect(result.graph.directDependencies).toContainEqual(expect.objectContaining({
      dependentNodeId: "prop-output",
      prerequisite: { type: "node", id: "lemma-input" },
    }));
    expect(result.graph.references).toContainEqual(expect.objectContaining({
      ownerNodeId: "prop-output",
      basis: "proof-xref",
      ref: "lemma-input",
      evidence: expect.objectContaining({ note: expect.stringMatching(/structural candidate/i) }),
    }));
    expect(result.graph.proofRoutes).toContainEqual(expect.objectContaining({
      theoremNodeId: "prop-output",
    }));
  });

  it("does not reach past an intervening theorem whose nested proof already owns the position", () => {
    const result = extract(`
      <lemma xml:id="lemma-input"><statement><p>Input.</p></statement></lemma>
      <theorem xml:id="theorem-earlier"><statement><p>Earlier.</p></statement></theorem>
      <theorem xml:id="theorem-intervening">
        <statement><p>Intervening.</p></statement>
        <proof><p>Already proved without an xref.</p></proof>
      </theorem>
      <proof><p>An ambiguous standalone proof cites <xref ref="lemma-input"/>.</p></proof>
    `);

    expect(result.graph.directDependencies).toHaveLength(0);
    expect(result.graph.references).toHaveLength(0);
    expect(result.stats.pendingTheoremCount).toBe(3);
  });
});
