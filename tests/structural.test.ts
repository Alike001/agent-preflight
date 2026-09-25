import { describe, expect, it } from "vitest";
import { analyzeStructure } from "../src/analysis/structural";
import { resolveWorkflowGraph } from "../src/graph/resolve";
import type { WorkflowConfig } from "../src/shared/contracts";

function analyze(workflow: WorkflowConfig) {
  return analyzeStructure(workflow, resolveWorkflowGraph(workflow));
}

describe("structural analysis", () => {
  it("blocks a missing dependency edge", () => {
    const workflow: WorkflowConfig = {
      name: "Missing edge",
      goal: "Move reviewed input into a final response.",
      triggers: [{ type: "manual", name: "Start" }],
      tasks: [
        { name: "Prepare", agentId: 1, description: "Prepare input." },
        {
          name: "Review",
          agentId: 2,
          description: "Review input.",
          dependencies: ["Prepare"],
        },
      ],
      edges: [{ from: "trigger:Start", to: "task:Prepare" }],
    };
    expect(analyze(workflow).findings.map((item) => item.code)).toContain(
      "MISSING_REQUIRED_EDGE",
    );
  });

  it("finds dangling nodes, invalid ports, and unreachable tasks", () => {
    const workflow: WorkflowConfig = {
      name: "Broken graph",
      goal: "Demonstrate deterministic findings.",
      triggers: [{ type: "manual", name: "Start" }],
      tasks: [{ name: "Review", agentId: 1, description: "Review input." }],
      edges: [
        {
          from: "task:Missing",
          to: "task:Review",
          sourcePort: "unknown",
          targetPort: "wrong",
        },
      ],
    };
    expect(analyze(workflow).findings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "INVALID_EDGE_SOURCE",
        "INVALID_TARGET_PORT",
        "UNREACHABLE_TASK",
      ]),
    );
  });

  it("detects duplicate edges and cycles with stable ordering", () => {
    const workflow: WorkflowConfig = {
      name: "Cycle",
      goal: "Demonstrate a cycle.",
      triggers: [{ type: "manual", name: "Start" }],
      tasks: [
        { name: "A", agentId: 1, description: "A." },
        { name: "B", agentId: 2, description: "B." },
      ],
      edges: [
        { from: "trigger:Start", to: "task:A" },
        { from: "task:A", to: "task:B" },
        { from: "task:A", to: "task:B" },
        { from: "task:B", to: "task:A" },
      ],
    };
    const first = analyze(workflow);
    expect(first.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_EDGE", "WORKFLOW_CYCLE"]),
    );
    expect(analyze(workflow)).toEqual(first);
  });

  it("passes a corrected connected workflow", () => {
    const workflow: WorkflowConfig = {
      name: "Corrected",
      goal: "Prepare and review a response.",
      triggers: [{ type: "manual", name: "Start" }],
      tasks: [
        { name: "Prepare", agentId: 1, description: "Prepare a response." },
        {
          name: "Review",
          agentId: 2,
          description: "Review the response.",
          dependencies: ["Prepare"],
        },
      ],
    };
    expect(analyze(workflow)).toEqual({ findings: [], passed: true });
  });
});
