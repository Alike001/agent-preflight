import { describe, expect, it } from "vitest";
import { lineChanges } from "../src/web/correction-diff";

describe("local correction diff", () => {
  it("reports only changed local lines", () => {
    expect(lineChanges("one\ntwo\nthree", "one\nchanged\nthree")).toEqual([
      { line: 2, before: "two", after: "changed" },
    ]);
  });

  it("does not invent changes", () => {
    expect(lineChanges("same", "same")).toEqual([]);
  });
});
