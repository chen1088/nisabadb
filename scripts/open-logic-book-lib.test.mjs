import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateBookGraphFile } from "../src/data/book-graph-schema.ts";
import { initialBookGraphFor } from "./book-graph-source-components.mjs";
import {
  buildOpenLogicBookFile,
  collectOpenLogicSourceUnits,
  extractOpenLogicGraphFromUnits,
} from "./open-logic-book-lib.mjs";

const capturedAt = "2026-08-27T00:00:00.000Z";
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
      throw new Error(`Refusing to remove unexpected test directory: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

function checkout(files, { config = "\\tagtrue{FOL,tagTrue}" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nisabadb-open-logic-"));
  temporaryDirectories.push(root);
  const allFiles = {
    "open-logic-config.sty": config,
    "open-logic-complete-config.sty": "",
    "open-logic-envs.sty": "% fixture environments",
    "sty/open-logic.sty": "% fixture style",
    "sty/open-logic-referencing.sty": "% fixture references",
    "sty/open-logic-selective.sty": "% fixture tags",
    "sty/open-logic-defer.sty": "% fixture defer",
    "README.md": "Fixture license: CC BY 4.0",
    "LICENSE.md": "CC BY 4.0",
    ...files,
  };
  for (const [relativePath, content] of Object.entries(allFiles)) {
    const absolutePath = path.join(root, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content.replace(/\r\n?/gu, "\n"));
  }
  return root;
}

function fixtureBaseFile() {
  const record = {
    id: "S0321",
    ordinal: 321,
    title: "The Open Logic Text",
    authorLine: "The Open Logic Project",
    rawCitation: "The Open Logic Text — The Open Logic Project",
    familyId: "F15",
    requiredEditionComponents: [{ id: "complete-source", label: "Complete source named by this row" }],
  };
  const registry = { sourceSetRevision: "fixture-revision", records: [record] };
  return initialBookGraphFor(registry, record, record.requiredEditionComponents[0]);
}

describe("Open Logic import-instance expansion", () => {
  it("keeps repeated physical files as distinct PL/FOL instances", () => {
    const root = checkout({
      "open-logic-complete.tex": String.raw`
        \olimport[content]{content}
        % \olimport[missing]{commented-out}
      `,
      "content/content.tex": String.raw`
        \olimport[shared]{shared}
        \tagfalse{FOL}
        \olimport[shared]{shared}
        \tagtrue{FOL}
      `,
      "content/shared/shared.tex": String.raw`
        \iftag{FOL}{\olfileid{fol}{syn}{shr}}{\olfileid{pl}{syn}{shr}}
        \begin{prop}\ollabel{prop:instance}An instance-sensitive result.\end{prop}
      `,
    });

    const collected = collectOpenLogicSourceUnits(root);
    expect(collected.units).toHaveLength(4);
    expect(collected.sourcePathCount).toBe(3);
    expect(collected.duplicateImportInstanceCount).toBe(1);
    expect(collected.missingImports).toEqual([]);
    const shared = collected.units.filter(({ path: sourcePath }) => sourcePath.endsWith("shared/shared.tex"));
    expect(shared).toHaveLength(2);
    expect(shared[0].contextDigest).not.toBe(shared[1].contextDigest);

    const extracted = extractOpenLogicGraphFromUnits(collected.units, { capturedAt });
    const propositions = extracted.graph.nodes.filter(({ kind }) => kind === "proposition");
    expect(propositions.map(({ sourceXmlId }) => sourceXmlId).sort()).toEqual([
      "fol:syn:shr:prop:instance",
      "pl:syn:shr:prop:instance",
    ]);
    expect(new Set(propositions.map(({ sourceTextSha256 }) => sourceTextSha256)).size).toBe(2);
  });

  it("evaluates tagblock and tagprob at their lexical tag state", () => {
    const root = checkout({
      "open-logic-complete.tex": String.raw`
        \tagfalse{keep}
        \begin{tagblock}{keep}
          \begin{thm}\ollabel{thm:hidden}Hidden.\end{thm}
        \end{tagblock}
        \tagtrue{keep}
        \begin{tagblock}{keep}
          \begin{thm}\ollabel{thm:shown}Shown.\end{thm}
        \end{tagblock}
        \tagprob{notkeep}
        \begin{prob}Inactive problem.\end{prob}
        \tagendprob
        \begin{probtag}{keep}Active tagged problem.\end{probtag}
      `,
    });

    const collected = collectOpenLogicSourceUnits(root);
    const extracted = extractOpenLogicGraphFromUnits(collected.units, { capturedAt });
    expect(extracted.stats.activeEnvironmentCounts.thm).toBe(1);
    expect(extracted.stats.activeEnvironmentCounts.prob).toBe(0);
    expect(extracted.stats.activeEnvironmentCounts.probtag).toBe(1);
  });

  it("uses the next control-sequence token as an omitted conditional argument", () => {
    const root = checkout({
      "open-logic-complete.tex": String.raw`
        \tagtrue{FOL}
        \olimport[shared]{shared}
        \tagfalse{FOL}
        \olimport[shared]{shared}
      `,
      "shared/shared.tex": String.raw`
        \iftag{FOL}{\olfileid{fol}{com}{mod}}{\olfileid{pl}{com}{mod}}
        \iftag{FOL}{%
          \begin{lem}
            \ollabel{lem:val-in-termmodel}The FOL-only lemma.
          \end{lem}
          \begin{proof}Immediate.\end{proof}
        }
        \iftag{FOL}{%
          \begin{prop}\ollabel{prop:quant-termmodel}The following FOL result.\end{prop}
        }{}
      `,
    });

    const collected = collectOpenLogicSourceUnits(root);
    const extracted = extractOpenLogicGraphFromUnits(collected.units, { capturedAt });
    expect(extracted.stats.activeEnvironmentCounts).toMatchObject({ lem: 1, prop: 1, proof: 1 });
    expect(extracted.graph.nodes.map(({ sourceXmlId }) => sourceXmlId).sort()).toEqual([
      "fol:com:mod:lem:val-in-termmodel",
      "fol:com:mod:prop:quant-termmodel",
    ]);
    expect(extracted.graph.nodes.some(({ sourceXmlId }) => [
      "pl:com:mod:lem:val-in-termmodel",
      "pl:com:mod:prop:quant-termmodel",
    ].includes(sourceXmlId))).toBe(false);
  });
});

describe("Open Logic proof dependency extraction", () => {
  function dependencyFixture() {
    const root = checkout({
      "open-logic-complete.tex": String.raw`\olimport[content]{fixture}`,
      "content/fixture.tex": String.raw`
        \olfileid{sfr}{fun}{bas}
        \begin{defn}[Fixture input]
          \ollabel{defn:input}A fixture input is marked.
        \end{defn}
        \begin{ex}
          \ollabel{ex:worked}This is a worked fixture.
          \begin{thm}\ollabel{thm:nested}A nested theorem remains formal.\end{thm}
        \end{ex}
        \begin{equation}\label{eq:raw}x=x\end{equation}
        \begin{prop}[Fixture output]
          \ollabel{prop:output}
          In the sense of \olref{defn:input}, every output is marked.
        \end{prop}
        \begin{proof}
          Apply \olref{defn:input}, compare \Olref{ex:worked}, and use
          \eqref{eq:raw}; the raw \cref{missing:result} remains pending.
          See \citep[p. 7]{FixtureSource} for an external discussion.
        \end{proof}
      `,
    });
    const collected = collectOpenLogicSourceUnits(root);
    return { root, collected, extracted: extractOpenLogicGraphFromUnits(collected.units, { capturedAt }) };
  }

  it("creates only exact proof-reference edges and preserves artifact targets", () => {
    const { extracted } = dependencyFixture();
    expect(extracted.stats.theoremCount).toBe(2);
    expect(extracted.stats.supportCount).toBe(1);
    expect(extracted.stats.sourceArtifactCount).toBe(2);
    expect(extracted.graph.nodes.some(({ sourceXmlId }) => sourceXmlId?.endsWith("thm:nested"))).toBe(true);

    const output = extracted.graph.nodes.find(({ sourceXmlId }) => sourceXmlId === "sfr:fun:bas:prop:output");
    const input = extracted.graph.nodes.find(({ sourceXmlId }) => sourceXmlId === "sfr:fun:bas:defn:input");
    const example = extracted.graph.nodes.find(({ sourceXmlId }) => sourceXmlId === "sfr:fun:bas:ex:worked");
    const equation = extracted.graph.nodes.find(({ sourceXmlId }) => sourceXmlId === "eq:raw");
    expect([example?.kind, equation?.kind]).toEqual(["example", "equation"]);
    expect(extracted.graph.directDependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dependentNodeId: output.id,
        prerequisite: { type: "node", id: input.id },
        role: "definition",
      }),
      expect.objectContaining({
        dependentNodeId: output.id,
        prerequisite: { type: "node", id: example.id },
        role: "source-reference",
      }),
      expect.objectContaining({
        dependentNodeId: output.id,
        prerequisite: { type: "node", id: equation.id },
        role: "source-reference",
      }),
    ]));
    expect(extracted.graph.directDependencies).toHaveLength(3);
    expect(extracted.graph.proofRoutes).toContainEqual(expect.objectContaining({
      theoremNodeId: output.id,
      dependencyIds: expect.arrayContaining(extracted.graph.directDependencies.map(({ id }) => id)),
    }));

    const statementReference = extracted.graph.references.find(({ basis }) => basis === "statement-xref");
    expect(statementReference).toMatchObject({
      ref: "sfr:fun:bas:defn:input",
      resolution: { status: "resolved", directDependencyId: null },
    });
    expect(extracted.graph.references).toContainEqual(expect.objectContaining({
      basis: "proof-xref",
      ref: "missing:result",
      resolution: { status: "unresolved", note: expect.any(String) },
    }));
  });

  it("retains proof-local natbib citations with their pinpoint", () => {
    const { extracted } = dependencyFixture();
    expect(extracted.stats.proofCitationCount).toBe(1);
    expect(extracted.graph.references).toContainEqual(expect.objectContaining({
      basis: "proof-citation",
      ref: "FixtureSource",
      pinpoint: "p. 7",
      resolution: { status: "unresolved", note: expect.any(String) },
    }));
  });

  it("counts duplicate active source labels and refuses to guess a target", () => {
    const root = checkout({
      "open-logic-complete.tex": String.raw`\olimport[content]{fixture}`,
      "content/fixture.tex": String.raw`
        \olfileid{sfr}{siz}{red}
        \begin{prob}\ollabel{prob:nat-nat}First exercise occurrence.\end{prob}
        \begin{prob}\ollabel{prob:nat-nat}Second exercise occurrence.\end{prob}
        \begin{prop}\ollabel{prop:owner}An owner result.\end{prop}
        \begin{proof}Use \olref{prob:nat-nat}.\end{proof}
      `,
    });
    const collected = collectOpenLogicSourceUnits(root);
    const extracted = extractOpenLogicGraphFromUnits(collected.units, { capturedAt });

    expect(extracted.stats.ambiguousLabelCount).toBe(1);
    expect(extracted.stats.sourceArtifactCount).toBe(0);
    expect(extracted.graph.directDependencies).toHaveLength(0);
    expect(extracted.graph.references).toContainEqual(expect.objectContaining({
      ref: "sfr:siz:red:prob:nat-nat",
      resolution: {
        status: "unresolved",
        note: expect.stringMatching(/ambiguous/i),
      },
    }));
  });

  it("emits a schema-valid logical BookGraphFile and binds control plus context bytes", () => {
    const { root } = dependencyFixture();
    const built = buildOpenLogicBookFile({
      baseFile: fixtureBaseFile(),
      checkoutRoot: root,
      commit: "a".repeat(40),
      capturedAt,
      sourceRepository: "https://github.com/OpenLogicProject/OpenLogic",
    });

    expect(validateBookGraphFile(built.file)).toEqual(built.file);
    expect(built.file.exactEdition).toMatchObject({
      sourceFormat: "latex",
      sourceUnitKind: "source-file",
      licenseSpdx: "CC-BY-4.0",
      sourceRevision: "a".repeat(40),
    });
    expect(built.stats.sourceUnitCount).toBe(2);
    expect(built.stats.missingImportCount).toBe(0);
    expect(built.stats.artifactSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(built.stats.expectedEnvironmentCountMismatchCount).toBeGreaterThan(0);
  });
});
