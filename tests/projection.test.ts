import { describe, expect, it } from "vitest";
import {
  createSemanticProjection,
  ProjectionLimitError,
} from "../src/analysis/projection";
import { analyzeStructure } from "../src/analysis/structural";
import { resolveWorkflowGraph } from "../src/graph/resolve";
import type { WorkflowConfig } from "../src/shared/contracts";

const workflow: WorkflowConfig = {
  name: "Semantic handoff",
  goal: "Turn research into a verified execution plan.",
  triggers: [{ type: "manual", name: "Start" }],
  tasks: [
    {
      name: "Research",
      agentId: 1,
      description: "Produce researched competitor findings.",
    },
    {
      name: "Execute",
      agentId: 2,
      description: "Consume a validated Solidity ABI.",
      dependencies: ["Research"],
    },
  ],
};

describe("semantic projection", () => {
  it("includes only bounded semantic evidence and resolved handoffs", () => {
    const graph = resolveWorkflowGraph(workflow);
    const projection = createSemanticProjection(
      "review-1",
      workflow,
      graph,
      analyzeStructure(workflow, graph),
    );
    expect(projection.tasks).toHaveLength(2);
    expect(projection.handoffs[1]).toMatchObject({
      from: "task:Research",
      to: "task:Execute",
      origin: "implicit",
    });
    expect(JSON.stringify(projection)).not.toContain("inputSchema");
  });

  it("rejects oversized fields instead of truncating them", () => {
    const oversized = { ...workflow, goal: "x".repeat(2_001) };
    const graph = resolveWorkflowGraph(oversized);
    expect(() =>
      createSemanticProjection(
        "review-2",
        oversized,
        graph,
        analyzeStructure(oversized, graph),
      ),
    ).toThrow(ProjectionLimitError);
  });
});
