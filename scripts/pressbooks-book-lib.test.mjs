import { describe, expect, it } from "vitest";
import {
  buildPressbooksBookFile,
  canonicalJson,
  extractPressbooksGraph,
  parsePressbooksWxr,
  safePressbooksSlug,
  sha256,
  stripAndDecodeHtml,
} from "./pressbooks-book-lib.mjs";

const capturedAt = "2026-08-22T12:34:56.000Z";

function meta(key, value) {
  return `<wp:postmeta><wp:meta_key><![CDATA[${key}]]></wp:meta_key><wp:meta_value><![CDATA[${value}]]></wp:meta_value></wp:postmeta>`;
}

function item({
  id,
  type,
  title,
  slug,
  status = "publish",
  parent = 0,
  order = 0,
  link = null,
  content = "",
  metadata = [],
  categories = "",
}) {
  return `<item>
    <title>${title}</title>
    <link>${link ?? `http://books.example/book/${type}/${slug}/`}</link>
    <guid isPermaLink="false">http://books.example/?p=${id}</guid>
    <content:encoded><![CDATA[${content}]]></content:encoded>
    <wp:post_id>${id}</wp:post_id>
    <wp:post_name><![CDATA[${slug}]]></wp:post_name>
    <wp:status><![CDATA[${status}]]></wp:status>
    <wp:post_parent>${parent}</wp:post_parent>
    <wp:menu_order>${order}</wp:menu_order>
    <wp:post_type><![CDATA[${type}]]></wp:post_type>
    ${categories}
    ${metadata.join("\n")}
  </item>`;
}

function wxr(items, {
  title = "Fixture Mathematics",
  author = "Ada Lovelace",
  year = "2024",
  license = "cc-by-sa",
  includeGenerator = true,
} = {}) {
  const metadata = item({
    id: 1000,
    type: "metadata",
    title: "Book Information",
    slug: "book-information",
    metadata: [
      meta("pb_title", title),
      meta("pb_author", author),
      meta("pb_copyright_year", year),
      meta("pb_book_license", license),
    ],
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
  ${includeGenerator ? '<!-- generator="WordPress/6.0" created="2024-02-03 04:05" -->' : ""}
  <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wp="http://wordpress.org/export/1.2/">
    <channel>
      <title>${title}</title>
      <link>http://books.example/book</link>
      <description>Open fixture</description>
      <language>en-US</language>
      <wp:wxr_version>1.2</wp:wxr_version>
      <wp:base_site_url>http://books.example/</wp:base_site_url>
      <wp:base_blog_url>http://books.example/book</wp:base_blog_url>
      ${items.join("\n")}
      ${metadata}
    </channel>
  </rss>`;
}

function baseFile({ title = "Fixture Mathematics", author = "Ada Lovelace" } = {}) {
  return {
    schemaVersion: "1.0.0",
    phase: "source-dependency-graph",
    identity: {
      bookGraphId: "S0001:complete-source",
      sourceSetRevision: "fixture",
      sourceRecordId: "S0001",
      sourceOrdinal: 1,
      familyId: "F01",
      sourceTitle: title,
      sourceAuthorLine: author,
      sourceRawCitation: `${title} — ${author}`,
      componentId: "complete-source",
      componentLabel: "Complete source",
    },
    exactEdition: null,
    sourceUnits: [],
    unitInventories: [],
    graph: { nodes: [], externalInputs: [], directDependencies: [], proofRoutes: [], references: [] },
    extractionState: { status: "awaiting-edition", extractionAudit: null, independentReview: null, note: "Pending." },
    graphState: { status: "not-started", graphAudit: null, independentReview: null, note: "Pending." },
  };
}

describe("Pressbooks WXR structure", () => {
  it("selects and orders only active book units, independent of item order", () => {
    const xml = wxr([
      item({ id: 12, type: "chapter", title: "Second", slug: "second", parent: 10, order: 2, content: "Second chapter" }),
      item({ id: 99, type: "attachment", title: "Image", slug: "image", status: "inherit" }),
      item({ id: 20, type: "part", title: "Later Part", slug: "later-part", status: "web-only", order: 2 }),
      item({ id: 2, type: "front-matter", title: "Introduction", slug: "introduction", status: "web-only", order: 1 }),
      item({ id: 22, type: "chapter", title: "Later Chapter", slug: "later-chapter", parent: 20, order: 1 }),
      item({ id: 10, type: "part", title: "First Part", slug: "first-part", status: "web-only", order: 1, content: "Part teaser", metadata: [meta("pb_part_content", "Part body")] }),
      item({ id: 11, type: "chapter", title: "First", slug: "first", parent: 10, order: 1, content: "First chapter" }),
      item({ id: 30, type: "chapter", title: "Draft", slug: "draft", status: "draft" }),
      item({ id: 31, type: "page", title: "Table of Contents", slug: "table-of-contents" }),
    ]);
    const parsed = parsePressbooksWxr(xml, {
      sourceUrl: "https://books.example/book/export.xml",
    });

    expect(parsed.activeUnits.map((unit) => unit.id)).toEqual([
      "unit-front-matter-2",
      "unit-part-10",
      "unit-chapter-11",
      "unit-chapter-12",
      "unit-part-20",
      "unit-chapter-22",
    ]);
    expect(parsed.activeUnits.map((unit) => unit.bookOrdinal)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parsed.activeUnits[1].sourceContent).toBe("Part teaser\nPart body");
    expect(parsed.activeUnits[0].link).toBe("https://books.example/book/front-matter/introduction/");
    expect(parsed.excludedItemCount).toBe(4);

    const firstPartRaw = xml.match(/<item>\s*<title>First Part<\/title>[\s\S]*?<\/item>/u)?.[0];
    expect(firstPartRaw).toBeTruthy();
    expect(parsed.activeUnits[1].contentSha256).toBe(sha256(firstPartRaw));
    expect(parsed.activeUnits[1].contentSha256).toBe(parsed.activeUnits[1].itemSha256);
  });

  it("keeps IDs and locators safe even when WordPress slugs and anchors are hostile", () => {
    const xml = wxr([
      item({
        id: 7,
        type: "chapter",
        title: "Unsafe",
        slug: "../../Bad Slug",
        content: '<div class="textbox key-takeaways"><h3><a id="../A B"></a>Definition</h3><p>An object.</p></div>',
      }),
    ]);
    const parsed = parsePressbooksWxr(xml);
    const extracted = extractPressbooksGraph(parsed, { capturedAt });

    expect(parsed.activeUnits[0]).toMatchObject({ id: "unit-chapter-7", slug: "bad-slug" });
    expect(parsed.activeUnits[0].locator).not.toContain("..");
    expect(extracted.graph.nodes[0].id).toMatch(/^[a-z0-9][a-z0-9-]*$/u);
    expect(extracted.graph.nodes[0].sourceLocator).not.toContain("../");
    expect(safePressbooksSlug("../../A B")).toBe("a-b");
  });

  it("rejects duplicate or missing active post IDs", () => {
    const duplicate = wxr([
      item({ id: 5, type: "part", title: "One", slug: "one", status: "web-only" }),
      item({ id: 5, type: "chapter", title: "Two", slug: "two" }),
    ]);
    expect(() => parsePressbooksWxr(duplicate)).toThrow(/duplicate wp:post_id/iu);
  });
});

describe("Pressbooks HTML and semantic extraction", () => {
  it("strips markup and decodes only known or valid entities conservatively", () => {
    const html = '<p>A&nbsp;&lt;B &amp; C &#x3c; D &unknown; &amp;lt;</p><script>bad <b>code</b></script><p><img alt="Diagram" src="x">Done</p>';
    expect(stripAndDecodeHtml(html)).toBe("A <B & C < D &unknown; &lt;\nDiagram Done");
  });

  it("extracts the narrow explicit-marker baseline and stops standalone algorithm sections correctly", () => {
    const xml = wxr([
      item({
        id: 10,
        type: "part",
        title: "Part",
        slug: "part",
        status: "web-only",
        order: 1,
      }),
      item({
        id: 11,
        type: "chapter",
        title: "Foundations",
        slug: "foundations",
        parent: 10,
        order: 1,
        content: `
          <div class="textbox key-takeaways">
            <h3><a id="BaseDef"></a>Definition</h3>
            <p>A base object is marked.</p>
          </div>
          <div class="textbox key-takeaways">
            <h3>Example: a marked object</h3><p>This explicitly labeled key-takeaway example is retained as support.</p>
          </div>
          <div class="textbox examples">
            <h3>Example: ordinary activity box</h3><p>This non-key-takeaway example stays outside the baseline.</p>
          </div>
          <h2>The Standard Algorithm for Addition</h2>
          <p>Add from right to left.</p>
          <h2>Unrelated discussion</h2>
          <p>This must not enter the algorithm statement.</p>
        `,
      }),
      item({
        id: 12,
        type: "chapter",
        title: "Results",
        slug: "results",
        parent: 10,
        order: 2,
        content: `
          <div class="textbox key-takeaways">
            <h3><a id="MainTheorem"></a>Theorem 1</h3>
            <p>A result uses the <a href="/book/chapter/foundations/#BaseDef">definition</a>.</p>
            <h4>Proof</h4>
            <p>Apply the <a href="/book/chapter/foundations/#BaseDef">definition</a>, not an implicit fact.</p>
            <p>An unresolved source link stays visible: <a href="#Missing">missing result</a>.</p>
          </div>
          <h2>Zero Property for Multiplication</h2>
          <p>For every number n, n times zero is zero.</p>
          <h2>Discussion</h2>
          <p>This is not part of the property.</p>
        `,
      }),
    ]);
    const extracted = extractPressbooksGraph(xml, { capturedAt });
    const byTitle = new Map(extracted.graph.nodes.map((node) => [node.title, node]));

    expect(byTitle.get("Definition")).toMatchObject({ nodeClass: "support", kind: "definition" });
    expect(byTitle.get("The Standard Algorithm for Addition")).toMatchObject({ nodeClass: "support", kind: "algorithm" });
    expect(byTitle.get("Theorem 1")).toMatchObject({ nodeClass: "theorem-like", kind: "theorem" });
    expect([...byTitle.keys()]).not.toContain("Zero Property for Multiplication");
    expect(byTitle.get("Example: a marked object")).toMatchObject({ nodeClass: "support", kind: "example" });
    expect([...byTitle.keys()]).not.toContain("Example: ordinary activity box");
    expect(byTitle.get("The Standard Algorithm for Addition").normalizedStatement).not.toMatch(/unrelated discussion/iu);
    expect(extracted.stats.includedExampleBoxCount).toBe(1);
    expect(extracted.stats.skippedExampleBoxCount).toBe(1);
    expect(extracted.graph.nodes.filter((node) => node.title === "Theorem 1")).toHaveLength(1);

    const theorem = byTitle.get("Theorem 1");
    const definition = byTitle.get("Definition");
    expect(extracted.graph.directDependencies).toHaveLength(1);
    expect(extracted.graph.directDependencies[0]).toMatchObject({
      dependentNodeId: theorem.id,
      prerequisite: { type: "node", id: definition.id },
      role: "definition",
    });
    const statementReference = extracted.graph.references.find((reference) => reference.basis === "statement-xref");
    expect(statementReference).toMatchObject({
      ownerNodeId: theorem.id,
      resolution: {
        status: "resolved",
        target: { type: "node", id: definition.id },
        directDependencyId: null,
      },
    });
    const resolvedProofReference = extracted.graph.references.find((reference) => (
      reference.basis === "proof-xref" && reference.resolution.status === "resolved"
    ));
    expect(resolvedProofReference.resolution.directDependencyId).toBe(extracted.graph.directDependencies[0].id);
    expect(extracted.graph.references).toContainEqual(expect.objectContaining({
      basis: "proof-xref",
      ref: "#Missing",
      resolution: { status: "unresolved", note: expect.any(String) },
    }));
    expect(extracted.graph.proofRoutes[0].dependencyIds).toEqual([extracted.graph.directDependencies[0].id]);
  });

  it("keeps the audited Pressbooks result-versus-method boundary", () => {
    const xml = wxr([
      item({
        id: 1,
        type: "chapter",
        title: "Arithmetic",
        slug: "arithmetic",
        content: `
          <div class="textbox key-takeaways"><h3>Addition and Subtraction: Explanation 1</h3><p>a + b = c if and only if c - b = a.</p></div>
          <div class="textbox key-takeaways"><h3>Common denominator method</h3><p>Divide the numerators after choosing a common denominator.</p></div>
        `,
      }),
    ]);
    const extracted = extractPressbooksGraph(xml, { capturedAt });
    const byTitle = new Map(extracted.graph.nodes.map((node) => [node.title, node]));

    expect(byTitle.get("Addition and Subtraction: Explanation 1")).toMatchObject({
      nodeClass: "theorem-like",
      kind: "named-result",
    });
    expect(byTitle.get("Common denominator method")).toMatchObject({
      nodeClass: "support",
      kind: "algorithm",
    });
  });

  it("never turns statement links or prose mentions into direct dependencies", () => {
    const xml = wxr([
      item({ id: 1, type: "chapter", title: "Input", slug: "input", content: '<div class="textbox key-takeaways"><h3><a id="D"></a>Definition</h3><p>An input.</p></div>' }),
      item({ id: 2, type: "chapter", title: "Output", slug: "output", content: '<div class="textbox key-takeaways"><h3>Theorem</h3><p>By the <a href="/book/chapter/input/#D">definition</a>, the result holds. We also use an unnamed standard fact.</p></div>' }),
    ]);
    const extracted = extractPressbooksGraph(xml, { capturedAt });

    expect(extracted.graph.references).toHaveLength(1);
    expect(extracted.graph.references[0]).toMatchObject({ basis: "statement-xref", resolution: { status: "resolved", directDependencyId: null } });
    expect(extracted.graph.directDependencies).toHaveLength(0);
    expect(extracted.graph.proofRoutes).toHaveLength(0);
    expect(extracted.stats.pendingTheoremCount).toBe(1);
  });

  it("does not label a support-node link as a proof dependency", () => {
    const xml = wxr([
      item({ id: 1, type: "chapter", title: "Input", slug: "input", content: '<div class="textbox key-takeaways"><h3><a id="InputDef"></a>Definition</h3><p>An input.</p></div>' }),
      item({ id: 2, type: "chapter", title: "Output", slug: "output", content: '<div class="textbox key-takeaways"><h3>Definition</h3><p>An output.</p><h4>Proof</h4><p>See the <a href="/book/chapter/input/#InputDef">input definition</a>.</p></div>' }),
    ]);
    const extracted = extractPressbooksGraph(xml, { capturedAt });

    expect(extracted.graph.references).toHaveLength(1);
    expect(extracted.graph.references[0]).toMatchObject({
      basis: "statement-xref",
      resolution: { status: "resolved", directDependencyId: null },
    });
    expect(extracted.graph.directDependencies).toHaveLength(0);
    expect(extracted.graph.proofRoutes).toHaveLength(0);
  });
});

describe("Pressbooks book-file construction", () => {
  it("binds identity and raw digest while producing unreviewed audit hashes", () => {
    const xml = wxr([
      item({ id: 1, type: "chapter", title: "Chapter", slug: "chapter", content: '<div class="textbox key-takeaways"><h3>Definition</h3><p>A fixture.</p></div>' }),
    ]);
    const expectedArtifactSha256 = sha256(xml);
    const built = buildPressbooksBookFile({
      baseFile: baseFile(),
      xmlSource: xml,
      sourceUrl: "https://books.example/book/fixture-20240203-040506.xml",
      capturedAt,
      publisher: "Fixture University",
      officialPageLicenseLabel: "CC BY-SA 4.0",
      expectedArtifactSha256,
    });

    expect(built.file.exactEdition).toMatchObject({
      label: "Fixture Mathematics — 2024-02-03 Pressbooks WXR export",
      publicationYear: 2024,
      publisher: "Fixture University",
      stableLocator: "https://books.example/book/fixture-20240203-040506.xml",
      sourceFormat: "pressbooks-wxr",
      accessKind: "open",
      licenseSpdx: null,
      licenseUrl: null,
      sourceRepository: null,
      sourceRevision: null,
      artifactSha256: expectedArtifactSha256,
      sourceUnitKind: "web-node",
    });
    expect(built.file.exactEdition.licenseNote).toMatch(/unversioned Pressbooks license CC BY-SA/iu);
    expect(built.file.exactEdition.licenseNote).toMatch(/official public book page presently labels.*CC BY-SA 4\.0/iu);
    expect(built.file.extractionState).toMatchObject({
      status: "extracting",
      extractionAudit: null,
      independentReview: null,
    });
    expect(built.file.graphState).toMatchObject({
      status: "building",
      graphAudit: null,
      independentReview: null,
    });
    expect(built.file.extractionState.note).toMatch(/source URL remains a caller assertion/iu);
    expect(built.file.extractionState.note).toMatch(/media bytes/iu);
    expect(built.file.graphState.note).toMatch(/implicit dependencies are never inferred/iu);
    expect(built.file.exactEdition.unitManifestSha256).toBe(sha256(canonicalJson(built.file.sourceUnits)));
    expect(built.stats.extractionArtifactSha256).toBe(sha256(canonicalJson({
      sourceUnits: built.file.sourceUnits,
      unitInventories: built.file.unitInventories,
    })));
    expect(built.stats.graphArtifactSha256).toBe(sha256(canonicalJson(built.file.graph)));
    expect(built.file.unitInventories[0].evidence.captureAudit.artifactSha256).toBe(built.file.sourceUnits[0].contentSha256);
    expect(built.file.graph.nodes[0].sourceTextSha256).toBe(built.file.graph.nodes[0].evidence.captureAudit.artifactSha256);
  });

  it("rejects mismatched identity or raw artifact expectations", () => {
    const xml = wxr([item({ id: 1, type: "chapter", title: "Chapter", slug: "chapter" })]);
    const common = { xmlSource: xml, sourceUrl: "https://books.example/book/export.xml", capturedAt };
    expect(() => buildPressbooksBookFile({ ...common, baseFile: baseFile({ title: "Another Book" }) })).toThrow(/title does not match/iu);
    expect(() => buildPressbooksBookFile({ ...common, baseFile: baseFile({ author: "Grace Hopper" }) })).toThrow(/author does not match/iu);
    expect(() => buildPressbooksBookFile({ ...common, baseFile: baseFile(), expectedArtifactSha256: "0".repeat(64) })).toThrow(/artifact SHA-256 mismatch/iu);
  });

  it("uses a timestamped source filename only when no generator timestamp is present", () => {
    const xml = wxr([item({ id: 1, type: "chapter", title: "Chapter", slug: "chapter" })], { includeGenerator: false });
    const parsed = parsePressbooksWxr(xml, { sourceUrl: "https://books.example/book/export-20240203-040506.xml" });
    expect(parsed.metadata).toMatchObject({
      exportCreatedAt: "2024-02-03 04:05:06",
      exportTimestampBasis: "source-filename",
    });
  });
});
