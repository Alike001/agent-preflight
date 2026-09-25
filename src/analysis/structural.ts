import type {
  PreflightFinding,
  ResolvedGraph,
  StructuralAnalysis,
  WorkflowConfig,
} from "../shared/contracts";

interface FindingInput {
  code: string;
  severity?: "warning" | "critical";
  title: string;
  identifiers: string[];
  rationale: string;
  suggestedFix: string;
}

export function analyzeStructure(
  workflow: WorkflowConfig,
  graph: ResolvedGraph,
): StructuralAnalysis {
  const findings: PreflightFinding[] = [];
  const tasks = workflow.tasks ?? [];
  const triggers = workflow.triggers ?? [];
  const taskNames = new Set(tasks.map((task) => task.name));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  if (!workflow.goal?.trim()) {
    findings.push(
      finding({
        code: "MISSING_WORKFLOW_GOAL",
        title: "Workflow goal is missing",
        identifiers: ["$.goal"],
        rationale: "Semantic review needs a stated workflow objective.",
        suggestedFix:
          "Add a complete goal sentence to the local workflow configuration.",
      }),
    );
  }
  if (triggers.length === 0)
    findings.push(
      simple("NO_TRIGGERS", "No trigger starts this workflow", "$.triggers"),
    );
  if (tasks.length === 0)
    findings.push(simple("NO_TASKS", "No tasks are declared", "$.tasks"));

  addDuplicates(
    findings,
    triggers.map((trigger) => trigger.name ?? trigger.type),
    "DUPLICATE_TRIGGER_NAME",
    "$.triggers",
  );
  addDuplicates(
    findings,
    tasks.map((task) => task.name),
    "DUPLICATE_TASK_NAME",
    "$.tasks",
  );

  const seenEdges = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from))
      findings.push(
        simple("INVALID_EDGE_SOURCE", "Edge source does not exist", edge.from),
      );
    if (!nodeIds.has(edge.to))
      findings.push(
        simple("INVALID_EDGE_TARGET", "Edge target does not exist", edge.to),
      );
    if (!edge.to.startsWith("task:"))
      findings.push(
        simple("INVALID_EDGE_DIRECTION", "Edges must target a task", edge.id),
      );
    if (edge.targetPort !== "input")
      findings.push(
        simple(
          "INVALID_TARGET_PORT",
          "Task target port must be input",
          edge.id,
        ),
      );

    const sourceTask = edge.from.startsWith("task:")
      ? tasks.find((task) => `task:${task.name}` === edge.from)
      : undefined;
    const allowedPorts = sourceTask
      ? Object.keys(sourceTask.outputOptions ?? { default: true })
      : ["default"];
    if (nodeIds.has(edge.from) && !allowedPorts.includes(edge.sourcePort)) {
      findings.push(
        simple("INVALID_SOURCE_PORT", "Source port is not declared", edge.id),
      );
    }

    const signature = `${edge.from}|${edge.sourcePort}|${edge.to}|${edge.targetPort}`;
    if (seenEdges.has(signature))
      findings.push(simple("DUPLICATE_EDGE", "Duplicate edge", edge.id));
    seenEdges.add(signature);
  }

  for (const [taskIndex, task] of tasks.entries()) {
    const dependencies = task.dependencies ?? [];
    addDuplicates(
      findings,
      dependencies,
      "DUPLICATE_TASK_DEPENDENCY",
      `$.tasks[${taskIndex}].dependencies`,
      "warning",
    );
    for (const dependency of dependencies) {
      if (!taskNames.has(dependency)) {
        findings.push(
          simple(
            "UNKNOWN_TASK_DEPENDENCY",
            "Dependency names no task",
            `$.tasks[${taskIndex}].dependencies`,
          ),
        );
      } else if (dependency === task.name) {
        findings.push(
          simple(
            "SELF_DEPENDENCY",
            "Task depends on itself",
            `task:${task.name}`,
          ),
        );
      } else if (
        !graph.edges.some(
          (edge) =>
            edge.from === `task:${dependency}` &&
            edge.to === `task:${task.name}`,
        )
      ) {
        findings.push(
          simple(
            "MISSING_REQUIRED_EDGE",
            "Declared dependency has no data-flow edge",
            `task:${dependency} -> task:${task.name}`,
          ),
        );
      }
    }
  }

  const reachable = reachableNodes(graph);
  for (const task of tasks) {
    if (!reachable.has(`task:${task.name}`))
      findings.push(
        simple(
          "UNREACHABLE_TASK",
          "Task is unreachable from every trigger",
          `task:${task.name}`,
        ),
      );
  }
  if (hasTaskCycle(graph))
    findings.push(
      simple("WORKFLOW_CYCLE", "Task graph contains a cycle", "$.edges"),
    );

  findings.sort((left, right) =>
    `${left.code}:${left.evidence[0]?.identifier}`.localeCompare(
      `${right.code}:${right.evidence[0]?.identifier}`,
    ),
  );
  return {
    findings,
    passed: !findings.some((item) => item.severity === "critical"),
  };
}

function simple(
  code: string,
  title: string,
  identifier: string,
  severity: "warning" | "critical" = "critical",
) {
  return finding({
    code,
    severity,
    title,
    identifiers: [identifier],
    rationale: title,
    suggestedFix: "Update the local workflow configuration and rescan.",
  });
}

function finding(input: FindingInput): PreflightFinding {
  return {
    id: `structural:${input.code}:${input.identifiers.join("|")}`,
    code: input.code,
    source: "structural",
    category: "workflow_structure",
    severity: input.severity ?? "critical",
    confidence: "deterministic",
    title: input.title,
    evidence: input.identifiers.map((identifier) => ({
      identifier,
      explanation: input.title,
    })),
    rationale: input.rationale,
    suggestedFix: input.suggestedFix,
  };
}

function addDuplicates(
  findings: PreflightFinding[],
  values: string[],
  code: string,
  path: string,
  severity: "warning" | "critical" = "critical",
) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value))
      findings.push(simple(code, `Duplicate value: ${value}`, path, severity));
    seen.add(value);
  }
}

function reachableNodes(graph: ResolvedGraph): Set<string> {
  const reachable = new Set(
    graph.nodes
      .filter((node) => node.kind === "trigger")
      .map((node) => node.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (reachable.has(edge.from) && !reachable.has(edge.to)) {
        reachable.add(edge.to);
        changed = true;
      }
    }
  }
  return reachable;
}

function hasTaskCycle(graph: ResolvedGraph): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.from.startsWith("task:") && edge.to.startsWith("task:")) {
      adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    if ((adjacency.get(node) ?? []).some(visit)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...adjacency.keys()].some(visit);
}
