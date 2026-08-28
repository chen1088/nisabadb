import { describe, expect, it } from "vitest";
import {
  parseOpenLogicImporterArguments,
  runOpenLogicBookImporter,
} from "./import-open-logic-book.mjs";

const requiredArguments = [
  "--source",
  "C:/tmp/OpenLogic",
  "--record-id",
  "S0321",
  "--component-id",
  "complete-source",
  "--commit",
  "1e960beff9ed7835bf3e3f1335e21af3439cd107",
];

describe("Open Logic importer CLI", () => {
  it("defaults to a non-writing dry run", () => {
    const parsed = parseOpenLogicImporterArguments(requiredArguments);
    expect(parsed.get("--write")).toBeUndefined();
    expect(parsed.get("--record-id")).toBe("S0321");
    expect(parsed.get("--component-id")).toBe("complete-source");
  });

  it("requires an explicit, non-duplicated write flag", () => {
    expect(parseOpenLogicImporterArguments([...requiredArguments, "--write"]).get("--write"))
      .toBe(true);
    expect(() => parseOpenLogicImporterArguments([
      ...requiredArguments,
      "--write",
      "--write",
    ])).toThrow(/Duplicate option: --write/u);
  });

  it("refuses to bind the source-specific importer to another corpus component", async () => {
    const wrongIdentity = requiredArguments.map((value) => (value === "S0321" ? "S0322" : value));
    await expect(runOpenLogicBookImporter(wrongIdentity))
      .rejects.toThrow(/bound to S0321:complete-source/u);
  });
});
