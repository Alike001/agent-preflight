import { describe, expect, it } from "vitest";
import { createSemanticProjection } from "../src/analysis/projection";
import { analyzeStructure } from "../src/analysis/structural";
import { resolveWorkflowGraph } from "../src/graph/resolve";
import { mapSemanticFindings } from "../src/serv/map-findings";
import { parseAndValidateSemanticReview } from "../src/serv/validate";
import { buildServRequest, SERV_BASE_URL } from "../src/server/serv-client";
import type { SemanticReview, WorkflowConfig } from "../src/shared/contracts";

const workflow: WorkflowConfig = {
  name: "Review",
  goal: "Turn research into a reviewed brief.",
  triggers: [{ type: "manual", name: "Start" }],
  tasks: [
    { name: "Research", agentId: 1, description: "Produce research." },
    {
      name: "Review",
      agentId: 2,
      description: "Review research.",
      dependencies: ["Research"],
    },
  ],
};

function projection() {
  const graph = resolveWorkflowGraph(workflow);
  return createSemanticProjection(
    "scan-1",
    workflow,
    graph,
    analyzeStructure(workflow, graph),
  );
}

const validReview: SemanticReview = {
  status: "blocked",
  summary: "The handoff is incompatible.",
  findings: [
    {
      id: "finding-1",
      category: "handoff_mismatch",
      severity: "critical",
      confidence: "high",
      evidence: [
        { identifier: "task:Research", explanation: "Produces research." },
        {
          identifier: "task:Review",
          explanation: "Requires different evidence.",
        },
      ],
      rationale: "The meanings do not align.",
      suggestedFix:
        "Align the local output and input descriptions, then rescan.",
    },
  ],
};

describe("SERV result validation", () => {
  it("builds the exact request contract with a system prompt and no temperature", () => {
    const request = buildServRequest("gpt-5.4-mini", projection());
    expect(SERV_BASE_URL).toBe("https://inference-api.openserv.ai/v1");
    expect(request).toMatchObject({
      model: "gpt-5.4-mini",
      reasoning_effort: "low",
      messages: [{ role: "system" }, { role: "user" }],
      response_format: {
        type: "json_schema",
        json_schema: { strict: true },
      },
    });
    expect(request).not.toHaveProperty("temperature");
    expect(request.messages[0].content.toLowerCase()).toContain(
      "review an agent workflow before execution",
    );
  });
  it("accepts schema-valid evidence and maps application-owned codes", () => {
    const review = parseAndValidateSemanticReview(
      JSON.stringify(validReview),
      projection(),
    );
    expect(mapSemanticFindings(review)[0]).toMatchObject({
      code: "SEMANTIC_HANDOFF_MISMATCH",
      source: "serv",
      severity: "critical",
    });
  });

  it("fails closed on malformed output", () => {
    expect(() =>
      parseAndValidateSemanticReview("not json", projection()),
    ).toThrow("malformed JSON");
  });

  it("fails closed on unknown evidence identifiers", () => {
    const invalid = structuredClone(validReview);
    invalid.findings[0].evidence[0].identifier = "task:invented";
    expect(() =>
      parseAndValidateSemanticReview(JSON.stringify(invalid), projection()),
    ).toThrow("outside the submitted projection");
  });

  it("rejects unsafe mutation suggestions", () => {
    const invalid = structuredClone(validReview);
    invalid.findings[0].suggestedFix =
      "Call workflows.sync and deploy the change.";
    expect(() =>
      parseAndValidateSemanticReview(JSON.stringify(invalid), projection()),
    ).toThrow("unsafe suggested correction");
  });

  it("rejects inconsistent passing output", () => {
    const invalid = structuredClone(validReview);
    invalid.status = "pass";
    expect(() =>
      parseAndValidateSemanticReview(JSON.stringify(invalid), projection()),
    ).toThrow("inconsistent pass status");
  });
});
