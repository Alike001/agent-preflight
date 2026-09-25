import type {
  ResolvedEdge,
  ResolvedGraph,
  ResolvedNode,
  WorkflowConfig,
} from "../shared/contracts";

export function resolveWorkflowGraph(workflow: WorkflowConfig): ResolvedGraph {
  const triggers = workflow.triggers ?? [];
  const tasks = workflow.tasks ?? [];
  const nodes: ResolvedNode[] = [
    ...triggers.map((trigger) => {
      const label = trigger.name ?? trigger.type;
      return { id: `trigger:${label}`, kind: "trigger" as const, label };
    }),
    ...tasks.map((task) => ({
      id: `task:${task.name}`,
      kind: "task" as const,
      label: task.name,
    })),
  ];

  if (Object.hasOwn(workflow, "edges")) {
    return {
      nodes,
      edges: (workflow.edges ?? []).map((edge, index) =>
        normalizeEdge(edge, index),
      ),
      edgeMode: "explicit",
    };
  }

  if (triggers.length === 0 || tasks.length === 0)
    return { nodes, edges: [], edgeMode: "none" };

  const edges: ResolvedEdge[] = [];
  const firstTask = tasks[0];
  if (!firstTask) return { nodes, edges, edgeMode: "none" };

  triggers.forEach((trigger, index) => {
    const triggerName = trigger.name ?? trigger.type;
    edges.push({
      id: `implicit-trigger-${index}`,
      from: `trigger:${triggerName}`,
      to: `task:${firstTask.name}`,
      sourcePort: "default",
      targetPort: "input",
      origin: "implicit",
    });
  });

  for (let index = 0; index < tasks.length - 1; index += 1) {
    const source = tasks[index];
    const target = tasks[index + 1];
    if (!source || !target) continue;
    edges.push({
      id: `implicit-task-${index}`,
      from: `task:${source.name}`,
      to: `task:${target.name}`,
      sourcePort: "default",
      targetPort: "input",
      origin: "implicit",
    });
  }

  return { nodes, edges, edgeMode: "implicit" };
}

function normalizeEdge(
  edge: NonNullable<WorkflowConfig["edges"]>[number],
  index: number,
): ResolvedEdge {
  return {
    id: `explicit-${index}`,
    from: edge.from,
    to: edge.to,
    sourcePort: edge.sourcePort ?? "default",
    targetPort: edge.targetPort ?? "input",
    origin: "explicit",
  };
}
