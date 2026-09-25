import { describe, expect, it } from "vitest";
import invalidSecret from "../fixtures/invalid/embedded-secret.json";
import invalidUnknown from "../fixtures/invalid/unknown-field.json";
import validImplicit from "../fixtures/valid/implicit-sequential.json";
import { INPUT_LIMITS } from "../src/input/limits";
import { parseWorkflowBytes } from "../src/input/parse-workflow";

const encoder = new TextEncoder();

function bytes(value: unknown): Uint8Array {
  return encoder.encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );
}

describe("parseWorkflowBytes", () => {
  it("accepts the approved native WorkflowConfig subset", () => {
    const result = parseWorkflowBytes(bytes(validImplicit));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.workflow.name).toBe("Editorial review");
  });

  it("rejects an upload larger than 256 KiB before decoding", () => {
    const result = parseWorkflowBytes(
      new Uint8Array(INPUT_LIMITS.maxBytes + 1),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "INPUT_TOO_LARGE" }],
    });
  });

  it("rejects invalid UTF-8", () => {
    const result = parseWorkflowBytes(Uint8Array.from([0xc3, 0x28]));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "INPUT_INVALID_UTF8" }],
    });
  });

  it("rejects malformed JSON", () => {
    const result = parseWorkflowBytes(bytes('{"name":'));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "INPUT_INVALID_JSON" }],
    });
  });

  it("rejects fields outside the approved schema", () => {
    const result = parseWorkflowBytes(bytes(invalidUnknown));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "INPUT_SCHEMA_INVALID" }],
    });
  });

  it("rejects actual secret material before schema reporting", () => {
    const result = parseWorkflowBytes(bytes(invalidSecret));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(
        result.issues.every(
          (issue) => issue.code === "SECRET_MATERIAL_DETECTED",
        ),
      ).toBe(true);
      expect(
        result.issues.every((issue) => !issue.message.includes("sk_example")),
      ).toBe(true);
    }
  });

  it("rejects excessive JSON nesting before schema validation", () => {
    let nested: unknown = "leaf";
    for (let index = 0; index < INPUT_LIMITS.maxDepth; index += 1)
      nested = { child: nested };

    const result = parseWorkflowBytes(bytes(nested));

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "INPUT_COMPLEXITY_EXCEEDED" }],
    });
  });

  it("rejects excessive total JSON values before schema validation", () => {
    const result = parseWorkflowBytes(
      bytes(Array.from({ length: INPUT_LIMITS.maxValues }, () => 1)),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "INPUT_COMPLEXITY_EXCEEDED" }],
    });
  });
});
