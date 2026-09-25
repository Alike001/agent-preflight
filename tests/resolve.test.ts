import { describe, expect, it } from "vitest";
import explicitEmpty from "../fixtures/valid/explicit-empty.json";
import explicitRoute from "../fixtures/valid/explicit-route.json";
import implicitSequential from "../fixtures/valid/implicit-sequential.json";
import { resolveWorkflowGraph } from "../src/graph/resolve";
import type { WorkflowConfig } from "../src/shared/contracts";

describe("resolveWorkflowGraph", () => {
  it("generates client-default sequential edges only when edges is omitted", () => {
    const graph = resolveWorkflowGraph(implicitSequential as WorkflowConfig);

    expect(graph.edgeMode).toBe("implicit");
    expect(graph.edges).toEqual([
      expect.objectContaining({
        from: "trigger:Start review",
        to: "task:Draft article",
        sourcePort: "default",
        targetPort: "input",
        origin: "implicit",
      }),
      expect.objectContaining({
        from: "task:Draft article",
        to: "task:Review article",
        sourcePort: "default",
        targetPort: "input",
        origin: "implicit",
      }),
    ]);
  });

  it("preserves an explicitly empty edge list", () => {
    const graph = resolveWorkflowGraph(explicitEmpty as WorkflowConfig);

    expect(graph).toMatchObject({ edgeMode: "explicit", edges: [] });
  });

  it("normalizes explicit edges and preserves their origin", () => {
    const graph = resolveWorkflowGraph(explicitRoute as WorkflowConfig);

    expect(graph.edgeMode).toBe("explicit");
    expect(graph.edges).toEqual([
      {
        id: "explicit-0",
        from: "trigger:Support request",
        to: "task:Classify request",
        sourcePort: "default",
        targetPort: "input",
        origin: "explicit",
      },
    ]);
  });

  it("uses trigger type as the effective name when name is omitted", () => {
    const workflow: WorkflowConfig = {
      name: "Unnamed trigger",
      triggers: [{ type: "manual" }],
      tasks: [
        {
          name: "First task",
          agentId: 1,
          description: "Perform the first task.",
        },
      ],
    };

    expect(resolveWorkflowGraph(workflow).edges[0]?.from).toBe(
      "trigger:manual",
    );
  });

  it("generates no implicit edge if triggers or tasks are empty", () => {
    const graph = resolveWorkflowGraph({ name: "No trigger", tasks: [] });

    expect(graph).toMatchObject({ edgeMode: "none", edges: [] });
  });
});
