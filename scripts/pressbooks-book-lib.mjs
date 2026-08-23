import { createHash } from "node:crypto";

const ACTIVE_BOOK_TYPES = new Set(["front-matter", "part", "chapter"]);
const ACTIVE_STATUSES = new Set(["publish", "web-only"]);
const HTML_VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param",
  "source", "track", "wbr",
]);
const HTML_BLOCK_ELEMENTS = new Set([
  "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt", "figcaption",
  "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main",
  "nav", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

const ENTITY_REPLACEMENTS = new Map([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", "\""], ["apos", "'"],
  ["nbsp", " "], ["ensp", " "], ["emsp", " "], ["thinsp", " "],
  ["ndash", "–"], ["mdash", "—"], ["minus", "−"], ["hellip", "…"],
  ["lsquo", "‘"], ["rsquo", "’"], ["ldquo", "“"], ["rdquo", "”"],
  ["times", "×"], ["divide", "÷"], ["middot", "·"], ["le", "≤"], ["ge", "≥"],
  ["ne", "≠"], ["pi", "π"], ["infin", "∞"],
]);

const LICENSE_LABELS = new Map([
  ["cc-by", "CC BY"], ["cc-by-sa", "CC BY-SA"], ["cc-by-nd", "CC BY-ND"],
  ["cc-by-nc", "CC BY-NC"], ["cc-by-nc-sa", "CC BY-NC-SA"],
  ["cc-by-nc-nd", "CC BY-NC-ND"], ["cc0", "CC0"], ["public-domain", "Public Domain"],
]);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  return JSON.stringify(value);
}

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9.-]*);/giu, (match, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return validCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return validCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return ENTITY_REPLACEMENTS.get(entity.toLowerCase()) ?? match;
  });
}

function validCodePoint(value) {
  return Number.isInteger(value)
    && value >= 0
    && value <= 0x10ffff
    && !(value >= 0xd800 && value <= 0xdfff);
}

function normalizeWhitespace(value) {
  return value.replace(/[\t\f\v ]+/gu, " ").replace(/ *\n */gu, "\n").replace(/\n{2,}/gu, "\n").trim();
}

function markupEnd(source, start) {
  if (source.startsWith("<!--", start)) {
    const end = source.indexOf("-->", start + 4);
    return end < 0 ? source.length : end + 3;
  }
  if (source.startsWith("<![CDATA[", start)) {
    const end = source.indexOf("]]>", start + 9);
    return end < 0 ? source.length : end + 3;
  }
  if (source.startsWith("<?", start)) {
    const end = source.indexOf("?>", start + 2);
    return end < 0 ? source.length : end + 2;
  }

  let quote = "";
  let bracketDepth = 0;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") bracketDepth += 1;
    else if (character === "]" && bracketDepth > 0) bracketDepth -= 1;
    else if (character === ">" && bracketDepth === 0) return index + 1;
  }
  return source.length;
}

function attributesFromToken(token) {
  const attributes = {};
  const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:(["'])([\s\S]*?)\2|([^\s>]+))/gu;
  for (const match of token.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function newlineOffsets(source) {
  const offsets = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) offsets.push(index);
  }
  return offsets;
}

function sourceLine(offsets, offset) {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle] < offset) low = middle + 1;
    else high = middle;
  }
  return low + 1;
}

function parseXml(source, sourceName) {
  if (typeof source !== "string") throw new TypeError("Pressbooks WXR source must be a string");
  const lines = newlineOffsets(source);
  const document = {
    type: "element", name: "#document", attributes: {}, children: [], parent: null,
    start: 0, end: source.length, startLine: 1, endLine: sourceLine(lines, source.length),
    source, sourceName,
  };
  const stack = [document];
  let cursor = 0;

  const appendText = (value, start, end, cdata = false) => {
    if (!value) return;
    stack.at(-1).children.push({ type: "text", value, start, end, cdata, parent: stack.at(-1) });
  };

  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) {
      appendText(source.slice(cursor), cursor, source.length);
      break;
    }
    appendText(source.slice(cursor, start), cursor, start);
    const end = markupEnd(source, start);
    const token = source.slice(start, end);
    cursor = end;

    if (token.startsWith("<!--") || token.startsWith("<?") || /^<!DOCTYPE/iu.test(token)) continue;
    if (token.startsWith("<![CDATA[")) {
      appendText(token.slice(9, token.endsWith("]]>") ? -3 : undefined), start, end, true);
      continue;
    }
    if (/^<!/u.test(token)) continue;

    const closing = token.match(/^<\s*\/\s*([A-Za-z_:][A-Za-z0-9_.:-]*)\s*>$/u);
    if (closing) {
      const name = closing[1].toLowerCase();
      let matchIndex = stack.length - 1;
      while (matchIndex > 0 && stack[matchIndex].name !== name) matchIndex -= 1;
      if (matchIndex === 0) continue;
      while (stack.length - 1 >= matchIndex) {
        const completed = stack.pop();
        completed.end = end;
        completed.endLine = sourceLine(lines, end);
      }
      continue;
    }

    const opening = token.match(/^<\s*([A-Za-z_:][A-Za-z0-9_.:-]*)/u);
    if (!opening) continue;
    const element = {
      type: "element",
      name: opening[1].toLowerCase(),
      attributes: attributesFromToken(token),
      children: [],
      parent: stack.at(-1),
      start,
      end,
      startLine: sourceLine(lines, start),
      endLine: sourceLine(lines, end),
      source,
      sourceName,
    };
    stack.at(-1).children.push(element);
    if (!/\/\s*>$/u.test(token)) stack.push(element);
  }

  while (stack.length > 1) {
    const unfinished = stack.pop();
    unfinished.end = source.length;
    unfinished.endLine = sourceLine(lines, source.length);
  }
  return document;
}

function walkElements(node, visit) {
  if (node.type !== "element") return;
  visit(node);
  for (const child of node.children) walkElements(child, visit);
}

function directElements(node, name) {
  return node.children.filter((child) => child.type === "element" && child.name === name);
}

function firstDirectElement(node, name) {
  return directElements(node, name)[0] ?? null;
}

function elementText(node) {
  if (!node) return "";
  const visit = (candidate) => {
    if (candidate.type === "text") return candidate.cdata ? candidate.value : decodeEntities(candidate.value);
    return candidate.children.map(visit).join("");
  };
  return visit(node).trim();
}

function integerValue(value, fallback = 0) {
  if (!/^-?\d+$/u.test(value.trim())) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function safePressbooksSlug(value, fallback = "item") {
  const decoded = safeDecodeURIComponent(String(value ?? ""));
  const slug = decoded
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\\/:._%]+/gu, "-")
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
  const safeFallback = String(fallback)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "") || "item";
  return /^[a-z0-9]/u.test(slug) ? slug : safeFallback;
}

function uniqueStableId(preferred, fallback, usedIds) {
  const base = safePressbooksSlug(preferred, "item");
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  const candidate = `${base}-${sha256(`${preferred}\0${fallback}`).slice(0, 10)}`;
  if (usedIds.has(candidate)) throw new Error(`Duplicate deterministic Pressbooks ID for ${fallback}`);
  usedIds.add(candidate);
  return candidate;
}

function parseItem(itemElement, sourceName, ordinal) {
  const field = (name) => elementText(firstDirectElement(itemElement, name));
  const postMetaEntries = directElements(itemElement, "wp:postmeta").map((entry) => ({
    key: elementText(firstDirectElement(entry, "wp:meta_key")),
    value: elementText(firstDirectElement(entry, "wp:meta_value")),
  })).filter((entry) => entry.key);
  const postMeta = {};
  for (const entry of postMetaEntries) {
    if (!(entry.key in postMeta)) postMeta[entry.key] = entry.value;
  }
  const categories = directElements(itemElement, "category").map((category) => ({
    domain: category.attributes.domain ?? "",
    nicename: category.attributes.nicename ?? "",
    label: elementText(category),
  }));
  const postId = integerValue(field("wp:post_id"), -1);
  const postType = field("wp:post_type").toLowerCase();
  const postName = field("wp:post_name");
  const slug = safePressbooksSlug(postName, postId >= 0 ? `post-${postId}` : `item-${ordinal}`);
  const contentHtml = field("content:encoded");
  const partContentHtml = postMeta.pb_part_content ?? "";
  const contentSegments = [...new Set([contentHtml, partContentHtml].filter((value) => value.trim()))];
  const sourceContent = contentSegments.join("\n");
  return {
    ordinal,
    postId,
    postType,
    postName,
    slug,
    status: field("wp:status").toLowerCase(),
    postParent: integerValue(field("wp:post_parent")),
    menuOrder: integerValue(field("wp:menu_order")),
    title: normalizeWhitespace(decodeEntities(field("title"))) || `${postType || "item"} ${postId}`,
    link: field("link"),
    guid: field("guid"),
    publishedAt: field("pubdate"),
    contentHtml,
    partContentHtml,
    sourceContent,
    contentSha256: sha256(sourceContent),
    itemSha256: sha256(itemElement.source.slice(itemElement.start, itemElement.end)),
    sourceName,
    sourceLine: itemElement.startLine,
    postMeta,
    postMetaEntries,
    categories,
  };
}

function orderActiveUnits(items) {
  const active = items.filter((item) => (
    ACTIVE_BOOK_TYPES.has(item.postType)
    && ACTIVE_STATUSES.has(item.status)
    && String(item.postMeta.pb_export ?? "on").toLowerCase() !== "off"
  ));
  const compare = (left, right) => (
    left.menuOrder - right.menuOrder
    || left.postId - right.postId
    || left.ordinal - right.ordinal
  );
  const frontMatter = active.filter((item) => item.postType === "front-matter").sort(compare);
  const parts = active.filter((item) => item.postType === "part").sort(compare);
  const chapters = active.filter((item) => item.postType === "chapter");
  const consumedChapterIds = new Set();
  const ordered = [...frontMatter];
  for (const part of parts) {
    ordered.push(part);
    const children = chapters.filter((chapter) => chapter.postParent === part.postId).sort(compare);
    ordered.push(...children);
    for (const child of children) consumedChapterIds.add(child.postId);
  }
  ordered.push(...chapters.filter((chapter) => !consumedChapterIds.has(chapter.postId)).sort((left, right) => (
    left.postParent - right.postParent || compare(left, right)
  )));
  return ordered;
}

function inferExportTimestamp(xmlSource, sourceUrl) {
  const comment = xmlSource.match(/<!--\s*generator="([^"]+)"\s+created="(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)"\s*-->/iu);
  if (comment) return { value: comment[2].replace("T", " "), basis: "generator-comment", generator: comment[1] };
  const filename = String(sourceUrl ?? "").match(/(?:^|[^0-9])(\d{4})[-_]?([01]\d)[-_]?([0-3]\d)[T_.-]?([0-2]\d)[-_:]?([0-5]\d)(?:[-_:]?([0-5]\d))?(?:Z)?(?=[^0-9]|$)/u);
  if (!filename) return { value: null, basis: null, generator: null };
  return {
    value: `${filename[1]}-${filename[2]}-${filename[3]} ${filename[4]}:${filename[5]}:${filename[6] ?? "00"}`,
    basis: "source-filename",
    generator: null,
  };
}

function canonicalizeItemLink(link, sourceUrl) {
  const source = safeHttpUrl(sourceUrl);
  const item = safeHttpUrl(link);
  if (source?.protocol === "https:" && item?.protocol === "http:" && source.host.toLowerCase() === item.host.toLowerCase()) {
    item.protocol = "https:";
    return item.href;
  }
  return link;
}

export function parsePressbooksWxr(xmlSource, { sourceName = "pressbooks-export.xml", sourceUrl = null } = {}) {
  const document = parseXml(xmlSource, sourceName);
  let rss = null;
  walkElements(document, (element) => {
    if (!rss && element.name === "rss") rss = element;
  });
  if (!rss) throw new Error("Pressbooks WXR is missing its rss root element");
  const channel = firstDirectElement(rss, "channel");
  if (!channel) throw new Error("Pressbooks WXR is missing its channel element");
  const channelField = (name) => elementText(firstDirectElement(channel, name));
  const itemElements = directElements(channel, "item");
  const items = itemElements.map((item, index) => parseItem(item, sourceName, index + 1));
  for (const item of items) item.link = canonicalizeItemLink(item.link, sourceUrl);
  const nonnegativeIds = items.filter((item) => item.postId >= 0).map((item) => item.postId);
  if (new Set(nonnegativeIds).size !== nonnegativeIds.length) {
    throw new Error("Pressbooks WXR contains duplicate wp:post_id values");
  }
  const metadataItem = items.find((item) => item.postType === "metadata") ?? null;
  const exportTimestamp = inferExportTimestamp(xmlSource, sourceUrl);
  const title = normalizeWhitespace(metadataItem?.postMeta.pb_title || channelField("title")) || "Untitled Pressbooks export";
  const author = normalizeWhitespace(metadataItem?.postMeta.pb_author ?? "") || null;
  const copyrightYearValue = metadataItem?.postMeta.pb_copyright_year ?? "";
  const copyrightYear = /^(?:1[4-9]|20|21)\d{2}$/u.test(copyrightYearValue)
    ? Number.parseInt(copyrightYearValue, 10)
    : null;
  const licenseSlug = safePressbooksSlug(
    metadataItem?.postMeta.pb_book_license
      || metadataItem?.categories.find((category) => category.domain === "license")?.nicename
      || "",
    "unknown",
  );
  const activeItems = orderActiveUnits(items);
  if (activeItems.some((item) => item.postId <= 0)) {
    throw new Error("Every active Pressbooks book unit must have a positive wp:post_id");
  }
  const usedUnitIds = new Set();
  const activeUnits = activeItems.map((item, index) => ({
    ...item,
    id: uniqueStableId(
      `unit-${item.postType}-${item.postId}`,
      `${item.postType}:${item.slug}:${item.postId}:${item.ordinal}`,
      usedUnitIds,
    ),
    bookOrdinal: index + 1,
    locator: `wxr:item:${item.postId}:${item.postType}/${item.slug}`,
    contentSha256: item.itemSha256,
  }));
  return {
    sourceName,
    channel: {
      title: normalizeWhitespace(decodeEntities(channelField("title"))),
      link: channelField("link"),
      description: normalizeWhitespace(decodeEntities(channelField("description"))),
      language: channelField("language"),
      baseSiteUrl: channelField("wp:base_site_url"),
      baseBlogUrl: channelField("wp:base_blog_url"),
      wxrVersion: channelField("wp:wxr_version"),
    },
    metadata: {
      title,
      author,
      copyrightYear,
      licenseSlug: licenseSlug === "unknown" ? null : licenseSlug,
      exportCreatedAt: exportTimestamp.value,
      exportTimestampBasis: exportTimestamp.basis,
      generator: exportTimestamp.generator,
    },
    items,
    activeUnits,
    excludedItemCount: items.length - activeUnits.length,
  };
}

function scanHtmlTags(html) {
  const tags = [];
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start < 0) break;
    const end = markupEnd(html, start);
    const token = html.slice(start, end);
    cursor = Math.max(end, start + 1);
    if (token.startsWith("<!--") || token.startsWith("<!") || token.startsWith("<?")) continue;
    const closing = token.match(/^<\s*\/\s*([A-Za-z][A-Za-z0-9:-]*)/u);
    if (closing) {
      tags.push({ name: closing[1].toLowerCase(), start, end, closing: true, selfClosing: false, attributes: {}, raw: token });
      continue;
    }
    const opening = token.match(/^<\s*([A-Za-z][A-Za-z0-9:-]*)/u);
    if (!opening) continue;
    const name = opening[1].toLowerCase();
    tags.push({
      name,
      start,
      end,
      closing: false,
      selfClosing: /\/\s*>$/u.test(token) || HTML_VOID_ELEMENTS.has(name),
      attributes: attributesFromToken(token),
      raw: token,
    });
    if ((name === "script" || name === "style") && !/\/\s*>$/u.test(token)) {
      const lower = html.toLowerCase();
      const closeStart = lower.indexOf(`</${name}`, end);
      if (closeStart >= 0) cursor = markupEnd(html, closeStart);
    }
  }
  return tags;
}

function tagRanges(html, acceptedNames) {
  const names = acceptedNames instanceof Set ? acceptedNames : new Set(acceptedNames);
  const stacks = new Map([...names].map((name) => [name, []]));
  const ranges = [];
  for (const tag of scanHtmlTags(html)) {
    if (!names.has(tag.name)) continue;
    const stack = stacks.get(tag.name);
    if (tag.closing) {
      const opening = stack.pop();
      if (opening) ranges.push({
        name: tag.name,
        level: /^h[1-6]$/u.test(tag.name) ? Number.parseInt(tag.name.slice(1), 10) : null,
        start: opening.start,
        contentStart: opening.end,
        contentEnd: tag.start,
        end: tag.end,
        attributes: opening.attributes,
      });
    } else if (!tag.selfClosing) {
      stack.push(tag);
    }
  }
  for (const [name, stack] of stacks) {
    for (const opening of stack) ranges.push({
      name,
      level: /^h[1-6]$/u.test(name) ? Number.parseInt(name.slice(1), 10) : null,
      start: opening.start,
      contentStart: opening.end,
      contentEnd: html.length,
      end: html.length,
      attributes: opening.attributes,
    });
  }
  return ranges.sort((left, right) => left.start - right.start || left.end - right.end);
}

export function stripAndDecodeHtml(html) {
  const source = String(html ?? "");
  const tags = scanHtmlTags(source);
  let cursor = 0;
  let output = "";
  let suppressedUntil = -1;
  for (const tag of tags) {
    if (tag.start < suppressedUntil) continue;
    if (tag.start > cursor) output += source.slice(cursor, tag.start);
    if (!tag.closing && (tag.name === "script" || tag.name === "style")) {
      const lower = source.toLowerCase();
      const closeStart = lower.indexOf(`</${tag.name}`, tag.end);
      suppressedUntil = closeStart < 0 ? source.length : markupEnd(source, closeStart);
      cursor = suppressedUntil;
      output += "\n";
      continue;
    }
    cursor = tag.end;
    if (tag.name === "img" && tag.attributes.alt) output += ` ${tag.attributes.alt} `;
    if (HTML_BLOCK_ELEMENTS.has(tag.name)) output += "\n";
  }
  if (cursor < source.length) output += source.slice(cursor);
  output = output.replace(/<!--[\s\S]*?(?:-->|$)/gu, " ");
  return normalizeWhitespace(decodeEntities(output));
}

function semanticMapping(label, { textbox = false, paragraph = false } = {}) {
  const normalized = normalizeWhitespace(label).replace(/^[\s:–—-]+|[\s:–—-]+$/gu, "");
  const lower = normalized.toLowerCase();
  const starts = (word) => new RegExp(`^${word}(?:\\b|\\s|[:.0-9])`, "iu").test(normalized);
  if (starts("theorem")) return { nodeClass: "theorem-like", kind: "theorem", label: normalized };
  if (starts("lemma")) return { nodeClass: "theorem-like", kind: "lemma", label: normalized };
  if (starts("proposition")) return { nodeClass: "theorem-like", kind: "proposition", label: normalized };
  if (starts("corollary")) return { nodeClass: "theorem-like", kind: "corollary", label: normalized };
  if (starts("claim")) return { nodeClass: "theorem-like", kind: "claim", label: normalized };
  if (starts("definition")) return { nodeClass: "support", kind: "definition", label: normalized };
  if (starts("notation")) return { nodeClass: "support", kind: "notation", label: normalized };
  if (starts("axiom")) return { nodeClass: "support", kind: "axiom", label: normalized };
  if (starts("assumption")) return { nodeClass: "support", kind: "assumption", label: normalized };
  if (/\b(?:standard\s+)?algorithm\b/iu.test(normalized)) {
    return { nodeClass: "support", kind: "algorithm", label: normalized };
  }
  if (textbox && /^examples?(?:\b|\s|:)/iu.test(normalized)) {
    return { nodeClass: "support", kind: "example", label: normalized };
  }
  if (/^(?:key\s+fraction\s+rule|multiplying\s+fractions)$/iu.test(normalized)) {
    return { nodeClass: "theorem-like", kind: "named-result", label: normalized };
  }
  if (textbox && /^addition\s+and\s+subtraction\s*:\s*explanation\s+1$/iu.test(normalized)) {
    return { nodeClass: "theorem-like", kind: "named-result", label: normalized };
  }
  if (textbox && /^common\s+denominator\s+method$/iu.test(normalized)) {
    return { nodeClass: "support", kind: "algorithm", label: normalized };
  }
  if (textbox && /\brule\b/iu.test(normalized)) {
    return { nodeClass: "support", kind: "algorithm", label: normalized };
  }
  if (
    /\b(?:key\s+)?(?:fraction\s+)?rule\b/iu.test(normalized)
    || /\bpropert(?:y|ies)\b/iu.test(normalized)
    || /\bidentity\b/iu.test(normalized)
    || /\blaw\b/iu.test(normalized)
  ) {
    return { nodeClass: "theorem-like", kind: "named-result", label: normalized };
  }
  if (paragraph && /^(?:fact|principle)(?:\b|\s|:)/iu.test(lower)) {
    return { nodeClass: "theorem-like", kind: "named-result", label: normalized };
  }
  return null;
}

function headingRanges(html) {
  return tagRanges(html, new Set(["h1", "h2", "h3", "h4", "h5", "h6"]));
}

function isInside(offset, range) {
  return offset >= range.start && offset < range.end;
}

function firstAnchor(html, start, end) {
  for (const tag of scanHtmlTags(html)) {
    if (tag.start < start || tag.start >= end || tag.closing) continue;
    const anchor = tag.attributes.id || (tag.name === "a" ? tag.attributes.name : "");
    if (anchor) return anchor;
  }
  return null;
}

function candidateRanges(unit) {
  const html = unit.sourceContent;
  const headings = headingRanges(html);
  const divs = tagRanges(html, new Set(["div", "section", "aside"]));
  const textboxes = divs.filter((range) => (
    (range.attributes.class ?? "").toLowerCase().split(/\s+/u).includes("textbox")
  ));
  const candidates = [];
  const candidateTextboxRanges = [];
  let skippedExampleBoxCount = 0;
  let includedExampleBoxCount = 0;

  for (const textbox of textboxes) {
    candidateTextboxRanges.push(textbox);
    const classNames = (textbox.attributes.class ?? "").toLowerCase().split(/\s+/u);
    const isKeyTakeaway = classNames.includes("key-takeaways");
    if (classNames.includes("examples") && !isKeyTakeaway) {
      skippedExampleBoxCount += 1;
      continue;
    }
    const heading = headings.find((item) => isInside(item.start, textbox));
    if (!heading) continue;
    const title = stripAndDecodeHtml(html.slice(heading.contentStart, heading.contentEnd));
    const mapping = semanticMapping(title, { textbox: true });
    if (!mapping) continue;
    if (mapping.kind === "example" && !isKeyTakeaway) {
      skippedExampleBoxCount += 1;
      continue;
    }
    if (mapping.kind === "example") includedExampleBoxCount += 1;
    candidates.push({
      start: textbox.start,
      end: textbox.end,
      statementStart: heading.end,
      title,
      mapping,
      basis: "semantic-textbox",
    });
  }

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (textboxes.some((textbox) => isInside(heading.start, textbox))) continue;
    const title = stripAndDecodeHtml(html.slice(heading.contentStart, heading.contentEnd));
    const mapping = semanticMapping(title);
    if (!mapping) continue;
    if (mapping.nodeClass === "theorem-like") continue;
    const following = headings.slice(index + 1).find((other) => other.level <= heading.level);
    const end = following?.start ?? html.length;
    candidates.push({
      start: heading.start,
      end,
      statementStart: heading.end,
      title,
      mapping,
      basis: "standalone-semantic-heading",
    });
  }

  const paragraphs = tagRanges(html, new Set(["p"]));
  for (const paragraph of paragraphs) {
    if (candidateTextboxRanges.some((textbox) => isInside(paragraph.start, textbox))) continue;
    const text = stripAndDecodeHtml(html.slice(paragraph.contentStart, paragraph.contentEnd));
    const labelMatch = text.match(/^(Theorem|Lemma|Proposition|Corollary|Claim|Definition|Notation|Axiom|Assumption|Property|Rule|Law|Fact|Principle)\s*:\s*(.+)$/iu);
    if (!labelMatch) continue;
    const mapping = semanticMapping(labelMatch[1], { paragraph: true });
    if (!mapping) continue;
    if (mapping.nodeClass === "theorem-like") continue;
    const detail = labelMatch[2].split(/(?<=[.!?])\s+/u)[0].slice(0, 140).trim();
    candidates.push({
      start: paragraph.start,
      end: paragraph.end,
      statementStart: paragraph.contentStart,
      title: `${labelMatch[1]}: ${detail}`,
      mapping,
      basis: "explicit-semantic-paragraph",
    });
  }

  const seen = new Set();
  const deduplicated = candidates
    .sort((left, right) => left.start - right.start || left.end - right.end || left.title.localeCompare(right.title))
    .filter((candidate) => {
      const key = `${candidate.start}:${candidate.end}:${candidate.mapping.nodeClass}:${candidate.mapping.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { candidates: deduplicated, skippedExampleBoxCount, includedExampleBoxCount };
}

function capturedEvidence({ sourceUnitId, locator, artifactSha256, capturedAt, note }) {
  return {
    status: "captured",
    sourceUnitIds: [sourceUnitId],
    locator,
    captureAudit: {
      actorId: "pressbooks-wxr-importer",
      capturedAt,
      artifactSha256,
    },
    independentReview: null,
    note,
  };
}

function safeHttpUrl(value, base = undefined) {
  try {
    const parsed = new URL(value, base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function pageKey(url) {
  if (!url) return null;
  const path = url.pathname.replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || "/";
  return `${url.host.toLowerCase()}${safeDecodeURIComponent(path)}`;
}

function encodedAnchor(anchor) {
  return anchor ? encodeURIComponent(anchor) : null;
}

function candidateProofRanges(raw) {
  const ranges = [];
  const containers = tagRanges(raw, new Set(["div", "section", "aside"]));
  for (const range of containers) {
    const classNames = (range.attributes.class ?? "").toLowerCase().split(/\s+/u);
    if (classNames.some((name) => name === "proof" || name === "derivation")) ranges.push(range);
  }
  const headings = headingRanges(raw);
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const label = stripAndDecodeHtml(raw.slice(heading.contentStart, heading.contentEnd));
    if (!/^(?:proof|derivation|why\s+it(?:'s|\s+is)\s+true|explanation)(?:\b|\s|:)/iu.test(label)) continue;
    const following = headings.slice(index + 1).find((other) => other.level <= heading.level);
    ranges.push({ start: heading.start, end: following?.start ?? raw.length });
  }
  return ranges;
}

function dependencyRole(targetNode) {
  if (targetNode.kind === "definition") return "definition";
  if (targetNode.kind === "notation") return "notation";
  if (targetNode.kind === "construction") return "construction";
  if (targetNode.kind === "calculation" || targetNode.kind === "algorithm") return "calculation";
  return "logical";
}

export function extractPressbooksGraph(parsedOrXml, {
  capturedAt = "2000-01-01T00:00:00.000Z",
  sourceName = "pressbooks-export.xml",
  sourceUrl = null,
} = {}) {
  const parsed = typeof parsedOrXml === "string"
    ? parsePressbooksWxr(parsedOrXml, { sourceName, sourceUrl })
    : parsedOrXml;
  if (!parsed || !Array.isArray(parsed.activeUnits)) throw new TypeError("A parsed Pressbooks WXR export is required");
  const sourceUnits = parsed.activeUnits.map((unit) => ({
    id: unit.id,
    ordinal: unit.bookOrdinal,
    label: `${unit.postType === "front-matter" ? "Front matter" : unit.postType === "part" ? "Part" : "Chapter"}: ${unit.title}`,
    locator: unit.locator,
    contentSha256: unit.contentSha256,
  }));
  const usedIds = new Set(sourceUnits.map((unit) => unit.id));
  const metadata = [];
  let skippedExampleBoxCount = 0;
  let includedExampleBoxCount = 0;

  for (const unit of parsed.activeUnits) {
    const candidateScan = candidateRanges(unit);
    const candidates = candidateScan.candidates;
    skippedExampleBoxCount += candidateScan.skippedExampleBoxCount;
    includedExampleBoxCount += candidateScan.includedExampleBoxCount;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const raw = unit.sourceContent.slice(candidate.start, candidate.end);
      const anchor = firstAnchor(unit.sourceContent, candidate.start, candidate.end);
      const fallback = `${unit.slug}-${candidate.mapping.kind}-${String(index + 1).padStart(4, "0")}`;
      const id = uniqueStableId(
        anchor ? `${unit.slug}-${anchor}` : fallback,
        `${unit.id}:${candidate.start}:${candidate.end}:${candidate.title}`,
        usedIds,
      );
      const anchorSuffix = encodedAnchor(anchor);
      const locator = anchorSuffix
        ? `${unit.locator}#${anchorSuffix}`
        : `${unit.locator}:semantic-${String(index + 1).padStart(4, "0")}`;
      const statementRaw = unit.sourceContent.slice(candidate.statementStart, candidate.end);
      const normalizedStatement = stripAndDecodeHtml(statementRaw)
        || `${candidate.mapping.label} recorded in ${unit.title}.`;
      const node = {
        id,
        nodeClass: candidate.mapping.nodeClass,
        kind: candidate.mapping.kind,
        sourceLabel: candidate.mapping.label,
        sourceXmlId: anchor,
        sourceLocator: locator,
        title: candidate.title,
        normalizedStatement,
        sourceTextSha256: sha256(raw),
        evidence: capturedEvidence({
          sourceUnitId: unit.id,
          locator,
          artifactSha256: sha256(raw),
          capturedAt,
          note: `Deterministic explicit semantic candidate from a ${candidate.basis} in the pinned Pressbooks WXR; not independently reviewed.`,
        }),
      };
      metadata.push({ node, unit, candidate, raw, anchor });
    }
  }

  const nodesByUnitId = new Map(sourceUnits.map((unit) => [unit.id, []]));
  for (const entry of metadata) nodesByUnitId.get(entry.unit.id)?.push(entry.node);
  const unitByPage = new Map();
  for (const unit of parsed.activeUnits) {
    const url = safeHttpUrl(unit.link);
    const key = pageKey(url);
    if (key) unitByPage.set(key, unit);
  }
  const nodeByPageAnchor = new Map();
  const ambiguousTargets = new Set();
  for (const entry of metadata) {
    if (!entry.anchor) continue;
    const key = pageKey(safeHttpUrl(entry.unit.link));
    if (!key) continue;
    const targetKey = `${key}#${safeDecodeURIComponent(entry.anchor)}`;
    if (nodeByPageAnchor.has(targetKey)) ambiguousTargets.add(targetKey);
    else nodeByPageAnchor.set(targetKey, entry.node);
  }
  for (const key of ambiguousTargets) nodeByPageAnchor.delete(key);

  const references = [];
  const proofGroups = new Map();
  let referenceOrdinal = 0;
  for (const entry of metadata) {
    const proofRanges = candidateProofRanges(entry.raw);
    const ownerUrl = safeHttpUrl(entry.unit.link) ?? safeHttpUrl(parsed.channel.baseBlogUrl) ?? safeHttpUrl(parsed.channel.link);
    const ownerPageKey = pageKey(ownerUrl);
    for (const link of scanHtmlTags(entry.raw).filter((tag) => tag.name === "a" && !tag.closing && tag.attributes.href)) {
      const href = link.attributes.href.trim();
      const targetUrl = safeHttpUrl(href, ownerUrl?.href);
      if (!targetUrl || !ownerPageKey || targetUrl.host.toLowerCase() !== ownerUrl.host.toLowerCase()) continue;
      const targetPageKey = pageKey(targetUrl);
      const targetUnit = unitByPage.get(targetPageKey);
      const fragment = safeDecodeURIComponent(targetUrl.hash.replace(/^#/u, ""));
      if (!targetUnit && !fragment) continue;
      let targetNode = fragment ? nodeByPageAnchor.get(`${targetPageKey}#${fragment}`) : null;
      if (!fragment && targetUnit) {
        const possibleNodes = nodesByUnitId.get(targetUnit.id) ?? [];
        if (possibleNodes.length === 1) [targetNode] = possibleNodes;
      }
      const inProof = proofRanges.some((range) => isInside(link.start, range));
      const isTheoremProofReference = inProof && entry.node.nodeClass === "theorem-like";
      const basis = isTheoremProofReference ? "proof-xref" : "statement-xref";
      const isSelfReference = targetNode?.id === entry.node.id;
      const rawLink = entry.raw.slice(link.start, link.end);
      const locator = `${entry.node.sourceLocator}:link-${String(referenceOrdinal + 1).padStart(4, "0")}`;
      referenceOrdinal += 1;
      const reference = {
        id: uniqueStableId(
          `ref-${entry.node.id}-${basis}-${String(referenceOrdinal).padStart(5, "0")}`,
          `${entry.node.id}:${href}:${link.start}`,
          usedIds,
        ),
        ownerNodeId: entry.node.id,
        basis,
        ref: href,
        context: entry.node.normalizedStatement.length <= 400
          ? entry.node.normalizedStatement
          : `${entry.node.normalizedStatement.slice(0, 397)}...`,
        locator,
        resolution: targetNode && !(isTheoremProofReference && isSelfReference)
          ? {
              status: "resolved",
              target: { type: "node", id: targetNode.id },
              directDependencyId: null,
              note: "The internal Pressbooks link resolves unambiguously to an anchored inventoried graph node; candidate resolution is not independently reviewed.",
            }
          : {
              status: "unresolved",
              note: isSelfReference
                ? "The proof-region link points back to its owner and cannot form a direct dependency."
                : "The internal Pressbooks link lacks an unambiguous inventoried semantic-node target.",
            },
        evidence: capturedEvidence({
          sourceUnitId: entry.unit.id,
          locator,
          artifactSha256: sha256(rawLink),
          capturedAt,
          note: `Captured internal ${basis} from the pinned Pressbooks WXR; no implicit dependency is inferred and no review is claimed.`,
        }),
      };
      references.push(reference);
      if (isTheoremProofReference && targetNode && !isSelfReference) {
        const pair = `${entry.node.id}\0${targetNode.id}`;
        const group = proofGroups.get(pair) ?? { owner: entry.node, target: targetNode, references: [], sourceUnitId: entry.unit.id };
        group.references.push(reference);
        proofGroups.set(pair, group);
      }
    }
  }

  const directDependencies = [];
  const dependencyIdsByTheorem = new Map();
  for (const group of proofGroups.values()) {
    const dependencyId = uniqueStableId(
      `dep-${group.owner.id}-to-${group.target.id}`,
      `${group.owner.id}:${group.target.id}`,
      usedIds,
    );
    const dependency = {
      id: dependencyId,
      dependentNodeId: group.owner.id,
      prerequisite: { type: "node", id: group.target.id },
      role: dependencyRole(group.target),
      rationale: `An explicit internal link inside a source-labeled proof or derivation region names ${group.target.sourceLabel}.`,
      evidence: capturedEvidence({
        sourceUnitId: group.sourceUnitId,
        locator: group.references.map((reference) => reference.locator).join("; "),
        artifactSha256: sha256(canonicalJson(group.references.map((reference) => ({
          ref: reference.ref,
          locator: reference.locator,
          artifactSha256: reference.evidence.captureAudit.artifactSha256,
        })))),
        capturedAt,
        note: `${group.references.length} explicit proof/derivation-region link${group.references.length === 1 ? "" : "s"} merged into one candidate dependency; not independently reviewed.`,
      }),
    };
    directDependencies.push(dependency);
    for (const reference of group.references) reference.resolution.directDependencyId = dependencyId;
    const ids = dependencyIdsByTheorem.get(group.owner.id) ?? [];
    ids.push(dependencyId);
    dependencyIdsByTheorem.set(group.owner.id, ids);
  }

  const proofRoutes = [];
  for (const entry of metadata) {
    if (entry.node.nodeClass !== "theorem-like") continue;
    const dependencyIds = dependencyIdsByTheorem.get(entry.node.id) ?? [];
    if (dependencyIds.length === 0) continue;
    proofRoutes.push({
      id: uniqueStableId(`route-${entry.node.id}-source-proof`, `${entry.node.id}:source-proof`, usedIds),
      theoremNodeId: entry.node.id,
      routeKind: "source-proof",
      dependencyIds,
      summary: "Candidate source-faithful route containing only prerequisites named by explicit internal links inside a source-labeled proof or derivation region.",
      evidence: capturedEvidence({
        sourceUnitId: entry.unit.id,
        locator: entry.node.sourceLocator,
        artifactSha256: entry.node.sourceTextSha256,
        capturedAt,
        note: "Candidate route from explicit proof/derivation-region links only; implicit prerequisites remain pending and no review is claimed.",
      }),
    });
  }

  const unitInventories = sourceUnits.map((unit) => {
    const nodes = nodesByUnitId.get(unit.id) ?? [];
    const theoremNodeIds = nodes.filter((node) => node.nodeClass === "theorem-like").map((node) => node.id);
    const supportNodeIds = nodes.filter((node) => node.nodeClass === "support").map((node) => node.id);
    return {
      sourceUnitId: unit.id,
      theoremNodeIds,
      supportNodeIds,
      theoremFreeAttestation: theoremNodeIds.length === 0,
      evidence: capturedEvidence({
        sourceUnitId: unit.id,
        locator: unit.locator,
        artifactSha256: unit.contentSha256,
        capturedAt,
        note: theoremNodeIds.length === 0
          ? "Deterministic explicit-marker candidate scan found no inventoried theorem-like node in this complete active WXR book unit. This is a captured scan no-hit, not an independently reviewed claim that the mathematical content is genuinely theorem-free."
          : `Deterministic explicit-marker scan assigned ${theoremNodeIds.length} theorem-like and ${supportNodeIds.length} support node(s) to this complete active WXR book unit; not independently reviewed.`,
      }),
    };
  });
  const theoremCount = metadata.filter((entry) => entry.node.nodeClass === "theorem-like").length;
  const unresolvedReferenceCount = references.filter((reference) => reference.resolution.status === "unresolved").length;
  return {
    sourceUnits,
    unitInventories,
    graph: {
      nodes: metadata.map((entry) => entry.node),
      externalInputs: [],
      directDependencies,
      proofRoutes,
      references,
    },
    stats: {
      sourceUnitCount: sourceUnits.length,
      theoremCount,
      supportCount: metadata.length - theoremCount,
      directDependencyCount: directDependencies.length,
      proofRouteCount: proofRoutes.length,
      referenceCount: references.length,
      statementXrefCount: references.filter((reference) => reference.basis === "statement-xref").length,
      proofXrefCount: references.filter((reference) => reference.basis === "proof-xref").length,
      unresolvedReferenceCount,
      pendingTheoremCount: theoremCount - proofRoutes.length,
      unitInventoryCount: unitInventories.length,
      theoremFreeUnitCount: unitInventories.filter((inventory) => inventory.theoremFreeAttestation).length,
      skippedExampleBoxCount,
      includedExampleBoxCount,
    },
  };
}

export function extractPressbooksGraphFromWxr(xmlSource, options = {}) {
  return extractPressbooksGraph(xmlSource, options);
}

function licenseMetadata(slug, officialPageLicenseLabel) {
  const label = slug ? LICENSE_LABELS.get(slug) : null;
  if (!label) return {
    licenseSpdx: null,
    licenseUrl: null,
    accessKind: "citation-only",
    note: slug
      ? `The WXR metadata declares Pressbooks license slug ${slug}, but no unambiguous SPDX mapping is encoded by this importer; license remains pending review.`
      : "No unambiguous book-level license was found in the WXR metadata; license identification remains pending review.",
  };
  const publicPageContext = officialPageLicenseLabel
    ? ` The official public book page presently labels the book ${officialPageLicenseLabel}, but that versioned label is not promoted without independent metadata review.`
    : " No license version is encoded by the WXR slug, so SPDX and license URL remain pending independent metadata review.";
  return {
    licenseSpdx: null,
    licenseUrl: null,
    accessKind: slug === "public-domain" || slug === "cc0" ? "public-domain" : "open",
    note: `The WXR book-level metadata declares the unversioned Pressbooks license ${label}.${publicPageContext}`,
  };
}

function validateCapturedAt(capturedAt) {
  if (typeof capturedAt !== "string" || !Number.isFinite(Date.parse(capturedAt))) {
    throw new Error("capturedAt must be an ISO-compatible date-time string");
  }
}

function normalizedIdentityText(value) {
  return normalizeWhitespace(decodeEntities(String(value ?? "")))
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function assertIdentityBinding(baseFile, parsed) {
  const expectedTitle = normalizedIdentityText(baseFile.identity.sourceTitle);
  const parsedTitle = normalizedIdentityText(parsed.metadata.title);
  if (!expectedTitle || parsedTitle !== expectedTitle) {
    throw new Error(`WXR title does not match source identity: expected ${baseFile.identity.sourceTitle}, found ${parsed.metadata.title}`);
  }
  const expectedAuthor = normalizedIdentityText(baseFile.identity.sourceAuthorLine);
  const parsedAuthor = normalizedIdentityText(parsed.metadata.author);
  if (!expectedAuthor || !parsedAuthor || !(parsedAuthor.includes(expectedAuthor) || expectedAuthor.includes(parsedAuthor))) {
    throw new Error(`WXR author does not match source identity: expected ${baseFile.identity.sourceAuthorLine}, found ${parsed.metadata.author ?? "missing"}`);
  }
}

export function buildPressbooksBookFile({
  baseFile,
  xmlSource,
  sourceUrl,
  capturedAt,
  publisher = null,
  officialPageLicenseLabel = null,
  expectedArtifactSha256 = null,
  sourceName = null,
}) {
  if (!baseFile?.identity?.sourceRecordId) throw new Error("baseFile with a source identity is required");
  if (typeof xmlSource !== "string" || xmlSource.length === 0) throw new Error("A nonempty WXR XML source is required");
  validateCapturedAt(capturedAt);
  const parsedSourceUrl = safeHttpUrl(sourceUrl);
  if (!parsedSourceUrl) throw new Error("sourceUrl must be an HTTP(S) URL");
  if (publisher !== null && (typeof publisher !== "string" || publisher.trim() === "")) {
    throw new Error("publisher must be null or a nonempty string");
  }
  const artifactSha256 = sha256(xmlSource);
  if (expectedArtifactSha256 !== null) {
    if (!/^[a-f0-9]{64}$/u.test(expectedArtifactSha256)) throw new Error("expectedArtifactSha256 must be a lowercase SHA-256 digest");
    if (artifactSha256 !== expectedArtifactSha256) {
      throw new Error(`WXR artifact SHA-256 mismatch: expected ${expectedArtifactSha256}, found ${artifactSha256}`);
    }
  }
  const inferredSourceName = sourceName || safeDecodeURIComponent(parsedSourceUrl.pathname.split("/").at(-1) || "pressbooks-export.xml");
  const parsed = parsePressbooksWxr(xmlSource, { sourceName: inferredSourceName, sourceUrl });
  assertIdentityBinding(baseFile, parsed);
  if (parsed.activeUnits.length === 0) throw new Error("The Pressbooks WXR has no active front-matter, part, or chapter units");
  const extracted = extractPressbooksGraph(parsed, { capturedAt });
  const unitManifestSha256 = sha256(canonicalJson(extracted.sourceUnits));
  const extractionArtifactSha256 = sha256(canonicalJson({
    sourceUnits: extracted.sourceUnits,
    unitInventories: extracted.unitInventories,
  }));
  const graphArtifactSha256 = sha256(canonicalJson(extracted.graph));
  const license = licenseMetadata(parsed.metadata.licenseSlug, officialPageLicenseLabel);
  const exportedAtLabel = parsed.metadata.exportCreatedAt
    ? `${parsed.metadata.exportCreatedAt.slice(0, 10)} Pressbooks WXR export`
    : "Pressbooks WXR export";
  const exportEvidence = parsed.metadata.exportCreatedAt
    ? ` The export timestamp ${parsed.metadata.exportCreatedAt} was inferred from ${parsed.metadata.exportTimestampBasis}; it identifies the export artifact and is not an independent publication-date claim.`
    : " No generator or filename export timestamp was present.";

  return {
    file: {
      ...baseFile,
      exactEdition: {
        editionId: `${baseFile.identity.sourceRecordId.toLowerCase()}-pressbooks-${artifactSha256.slice(0, 12)}`,
        label: `${parsed.metadata.title} — ${exportedAtLabel}`,
        publicationYear: parsed.metadata.copyrightYear,
        publisher: publisher?.trim() ?? null,
        stableLocator: parsedSourceUrl.href,
        sourceFormat: "pressbooks-wxr",
        accessKind: license.accessKind,
        licenseSpdx: license.licenseSpdx,
        licenseUrl: license.licenseUrl,
        licenseNote: `${license.note}${exportEvidence}`,
        sourceRepository: null,
        sourceRevision: null,
        artifactSha256,
        unitManifestSha256,
        sourceUnitKind: "web-node",
      },
      sourceUnits: extracted.sourceUnits,
      unitInventories: extracted.unitInventories,
      graph: extracted.graph,
      extractionState: {
        status: "extracting",
        extractionAudit: null,
        independentReview: null,
        note: `All ${extracted.sourceUnits.length} active front-matter, part, and chapter structural units received a narrow deterministic explicit-marker pass; WordPress pages, metadata records, and attachments are excluded. The WXR title and author are bound to the source identity${expectedArtifactSha256 ? " and the raw artifact matches a caller-supplied SHA-256" : ""}; the source URL remains a caller assertion and is not independently authenticated. Implicit, prose-only, exercise-embedded, and media-dependent mathematics remain pending because the WXR omits referenced media bytes. Extraction therefore remains in progress and no independent review is claimed.${exportEvidence}`,
      },
      graphState: {
        status: "building",
        graphAudit: null,
        independentReview: null,
        note: `${extracted.stats.directDependencyCount} candidate edge(s) come only from explicit internal links inside source-labeled proof or derivation regions. Statement links are retained without promotion, implicit dependencies are never inferred, and ${extracted.stats.pendingTheoremCount} theorem-like node(s) remain unrouted. The narrow baseline includes ${extracted.stats.includedExampleBoxCount} explicitly labeled key-takeaway example box(es), while ${extracted.stats.skippedExampleBoxCount} non-key-takeaway example box(es), prose/exercise-embedded results, and media-dependent mathematics remain pending. The graph remains under construction; no graph review or completeness is claimed.`,
      },
    },
    stats: {
      ...extracted.stats,
      itemCount: parsed.items.length,
      excludedItemCount: parsed.excludedItemCount,
      artifactSha256,
      unitManifestSha256,
      extractionArtifactSha256,
      graphArtifactSha256,
      metadata: parsed.metadata,
    },
  };
}
