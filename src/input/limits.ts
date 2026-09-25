export const INPUT_LIMITS = Object.freeze({
  maxBytes: 256 * 1024,
  maxDepth: 12,
  maxValues: 5_000,
});

export interface ComplexityResult {
  depth: number;
  values: number;
}

export function measureJsonComplexity(root: unknown): ComplexityResult {
  const stack: Array<{ value: unknown; depth: number }> = [
    { value: root, depth: 1 },
  ];
  let maxDepth = 0;
  let values = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    values += 1;
    maxDepth = Math.max(maxDepth, current.depth);

    if (Array.isArray(current.value)) {
      for (const value of current.value)
        stack.push({ value, depth: current.depth + 1 });
    } else if (isRecord(current.value)) {
      for (const value of Object.values(current.value)) {
        stack.push({ value, depth: current.depth + 1 });
      }
    }
  }

  return { depth: maxDepth, values };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
