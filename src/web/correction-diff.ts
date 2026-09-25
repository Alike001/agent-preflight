interface LineChange {
  line: number;
  before: string;
  after: string;
}

export function lineChanges(before: string, after: string): LineChange[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  return Array.from(
    { length: Math.max(beforeLines.length, afterLines.length) },
    (_, index) => ({
      line: index + 1,
      before: beforeLines[index] ?? "",
      after: afterLines[index] ?? "",
    }),
  ).filter((item) => item.before !== item.after);
}
