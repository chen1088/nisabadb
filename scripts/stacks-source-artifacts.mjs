function stripLatexComment(line) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%") continue;
    let slashCount = 0;
    for (let previous = index - 1; previous >= 0 && line[previous] === "\\"; previous -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) return line.slice(0, index);
  }
  return line;
}

function normalizeWhitespace(value) {
  return value
    .split(/\r?\n/u)
    .map(stripLatexComment)
    .join("\n")
    .replace(/\\label\{[^{}]+\}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function findBalancedCommandArgument(source, command) {
  const marker = `\\${command}{`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let depth = 1;
  for (let index = start + marker.length; index < source.length; index += 1) {
    if (source[index] === "{" && source[index - 1] !== "\\") depth += 1;
    if (source[index] === "}" && source[index - 1] !== "\\") depth -= 1;
    if (depth === 0) return source.slice(start + marker.length, index);
  }
  return null;
}

function labelArguments(source) {
  const labels = [];
  const pattern = /\\label\{([^{}]+)\}/gu;
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = stripLatexComment(rawLine);
    for (const match of line.matchAll(pattern)) labels.push(match[1]);
  }
  return labels;
}

function environmentRanges(lines) {
  const stack = [];
  const ranges = [];
  const commandPattern = /\\(begin|end)\{([^{}]+)\}/gu;
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripLatexComment(lines[index]);
    for (const match of line.matchAll(commandPattern)) {
      const [, action, environment] = match;
      if (action === "begin") {
        stack.push({ environment, startLine: index + 1 });
        continue;
      }
      const opening = stack.pop();
      if (!opening || opening.environment !== environment) {
        throw new Error(`Unbalanced LaTeX environment ${environment} near line ${index + 1}`);
      }
      ranges.push({
        environment,
        startLine: opening.startLine,
        endLine: index + 1,
      });
    }
  }
  if (stack.length > 0) {
    const opening = stack.at(-1);
    throw new Error(`Unclosed LaTeX environment ${opening.environment} at line ${opening.startLine}`);
  }
  return ranges;
}

const structuralCommandPattern = /^\s*\\(?:chapter|section|subsection|subsubsection|paragraph)\b/u;
const structuralRank = new Map([
  ["chapter", 0],
  ["section", 1],
  ["subsection", 2],
  ["subsubsection", 3],
  ["paragraph", 4],
]);
const mathEnvironments = new Set([
  "equation",
  "equation*",
  "align",
  "align*",
  "gather",
  "gather*",
  "multline",
  "multline*",
  "eqnarray",
  "eqnarray*",
  "displaymath",
]);
const listEnvironments = new Set(["enumerate", "itemize", "description"]);

function enclosingRange(ranges, lineNumber, acceptedEnvironments) {
  return ranges
    .filter(({ environment, startLine, endLine }) => (
      acceptedEnvironments.has(environment)
      && startLine <= lineNumber
      && lineNumber <= endLine
    ))
    .sort((left, right) => (
      (left.endLine - left.startLine) - (right.endLine - right.startLine)
    ))[0] ?? null;
}

function sectionHeaderRange(lines, localLabel, labelLine, unitPath) {
  const headingPattern = /^\s*\\(chapter|section|subsection|subsubsection|paragraph)\b/u;
  for (let lineNumber = labelLine; lineNumber >= 1; lineNumber -= 1) {
    const line = stripLatexComment(lines[lineNumber - 1] ?? "");
    const match = line.match(headingPattern);
    if (match) {
      const rawHeading = lines.slice(lineNumber - 1, labelLine).join("\n");
      if (!labelArguments(rawHeading).includes(localLabel)) {
        throw new Error(`${unitPath}:${labelLine} source heading does not own label ${localLabel}`);
      }
      const ownerRank = structuralRank.get(match[1]);
      let endLine = lines.length;
      for (let candidateLine = labelLine + 1; candidateLine <= lines.length; candidateLine += 1) {
        const candidate = stripLatexComment(lines[candidateLine - 1] ?? "");
        const candidateMatch = candidate.match(headingPattern);
        if (candidateMatch && structuralRank.get(candidateMatch[1]) <= ownerRank) {
          endLine = candidateLine - 1;
          break;
        }
      }
      while (endLine > labelLine && !stripLatexComment(lines[endLine - 1] ?? "").trim()) {
        endLine -= 1;
      }
      return {
        kind: "section",
        startLine: lineNumber,
        endLine,
        headingCommand: match[1],
      };
    }
    if (lineNumber < labelLine && structuralCommandPattern.test(line)) break;
  }
  throw new Error(`${unitPath}:${labelLine} has no heading for ${localLabel}`);
}

function itemRange(lines, ranges, labelLine, unitPath) {
  const container = enclosingRange(ranges, labelLine, listEnvironments);
  if (!container) throw new Error(`${unitPath}:${labelLine} has no list container for an item label`);
  let listDepth = 0;
  const itemLines = [];
  const listCommandPattern = /\\(begin|end)\{(enumerate|itemize|description)\}/gu;
  for (let lineNumber = container.startLine; lineNumber <= container.endLine; lineNumber += 1) {
    const line = stripLatexComment(lines[lineNumber - 1] ?? "");
    for (const match of line.matchAll(listCommandPattern)) {
      if (match[1] === "begin") listDepth += 1;
      else listDepth -= 1;
    }
    if (listDepth === 1 && /\\item(?:\[[^\]]*\])?/u.test(line)) itemLines.push(lineNumber);
  }
  const startLine = itemLines.filter((lineNumber) => lineNumber <= labelLine).at(-1);
  if (!startLine) throw new Error(`${unitPath}:${labelLine} has no owning item for its label`);
  const nextItemLine = itemLines.find((lineNumber) => lineNumber > labelLine);
  return {
    kind: "item",
    startLine,
    endLine: nextItemLine ? nextItemLine - 1 : container.endLine - 1,
  };
}

function proseRange(lines, labelLine) {
  let startLine = labelLine;
  while (startLine > 1) {
    const previous = stripLatexComment(lines[startLine - 2] ?? "");
    if (!previous.trim() || structuralCommandPattern.test(previous)) break;
    if (/\\(?:begin|end)\{(?:proof|lemma|proposition|theorem|definition|situation)\}/u.test(previous)) break;
    startLine -= 1;
  }
  let endLine = labelLine;
  while (endLine < lines.length) {
    const next = stripLatexComment(lines[endLine] ?? "");
    if (!next.trim() || structuralCommandPattern.test(next)) break;
    if (/\\(?:begin|end)\{(?:proof|lemma|proposition|theorem|definition|situation)\}/u.test(next)) break;
    endLine += 1;
  }
  return { kind: "prose", startLine, endLine };
}

function rangeForLabel(lines, ranges, localLabel, labelLine, unitPath) {
  if (/^(?:section|subsection|subsubsection|paragraph)-/u.test(localLabel)) {
    return sectionHeaderRange(lines, localLabel, labelLine, unitPath);
  }

  const prefix = localLabel.split("-", 1)[0];
  if (["remark", "remarks", "example", "exercise"].includes(prefix)) {
    const environment = enclosingRange(ranges, labelLine, new Set([prefix]));
    if (!environment) {
      throw new Error(`${unitPath}:${labelLine} has no ${prefix} environment for ${localLabel}`);
    }
    return { kind: prefix, startLine: environment.startLine, endLine: environment.endLine };
  }
  if (prefix === "equation") {
    const environment = enclosingRange(ranges, labelLine, mathEnvironments);
    if (environment) {
      return { kind: "equation", startLine: environment.startLine, endLine: environment.endLine };
    }
    return { ...proseRange(lines, labelLine), kind: "equation" };
  }
  if (prefix === "item") return itemRange(lines, ranges, labelLine, unitPath);
  return proseRange(lines, labelLine);
}

function titleForArtifact(kind, localLabel, rawSource, headingCommand = null) {
  if (kind === "section" && headingCommand) {
    const heading = findBalancedCommandArgument(rawSource, headingCommand);
    if (heading) return normalizeWhitespace(heading);
  }
  const preview = normalizeWhitespace(rawSource)
    .replace(/^\\begin\{[^{}]+\}(?:\[[^\]]*\])?/u, "")
    .replace(/\\end\{[^{}]+\}$/u, "")
    .trim();
  if (preview) return `Referenced source ${kind}: ${preview.slice(0, 160)}`;
  return `Referenced source ${kind}: ${localLabel}`;
}

function owningUnit(unitsByStemLength, fullLabel) {
  return unitsByStemLength.find(({ stem }) => fullLabel.startsWith(`${stem}-`)) ?? null;
}

export function locateStacksSourceArtifacts(units, fullLabels) {
  if (!Array.isArray(units) || units.length === 0) throw new Error("Stacks units are required");
  const requested = [...new Set(fullLabels)].sort();
  const unitsByStemLength = [...units].sort((left, right) => right.stem.length - left.stem.length);
  const requestedUnitStems = new Set(requested.map((fullLabel) => {
    const unit = owningUnit(unitsByStemLength, fullLabel);
    if (!unit) throw new Error(`No Stacks source unit owns referenced label ${fullLabel}`);
    return unit.stem;
  }));
  const unitState = new Map(units.filter(({ stem }) => requestedUnitStems.has(stem)).map((unit) => {
    const lines = unit.content.split(/\r?\n/u);
    return [unit.stem, { lines, ranges: environmentRanges(lines) }];
  }));

  return requested.map((fullLabel) => {
    const unit = owningUnit(unitsByStemLength, fullLabel);
    if (!unit) throw new Error(`No Stacks source unit owns referenced label ${fullLabel}`);
    const localLabel = fullLabel.slice(unit.stem.length + 1);
    const state = unitState.get(unit.stem);
    const matchingLines = [];
    for (let index = 0; index < state.lines.length; index += 1) {
      if (labelArguments(state.lines[index]).includes(localLabel)) matchingLines.push(index + 1);
    }
    if (matchingLines.length !== 1) {
      throw new Error(`${unit.path} expected one source line for ${localLabel}, found ${matchingLines.length}`);
    }
    const range = rangeForLabel(
      state.lines,
      state.ranges,
      localLabel,
      matchingLines[0],
      unit.path,
    );
    const rawSource = state.lines.slice(range.startLine - 1, range.endLine).join("\n");
    if (!labelArguments(rawSource).includes(localLabel)) {
      throw new Error(`${unit.path}:${range.startLine}-${range.endLine} does not contain ${localLabel}`);
    }
    return {
      fullLabel,
      localLabel,
      unit,
      kind: range.kind,
      startLine: range.startLine,
      endLine: range.endLine,
      rawSource,
      normalizedSource: normalizeWhitespace(rawSource),
      title: titleForArtifact(range.kind, localLabel, rawSource, range.headingCommand),
    };
  });
}
