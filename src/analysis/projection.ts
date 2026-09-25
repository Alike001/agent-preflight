import { redactDefensively } from "../input/secrets";
import type {
  ResolvedGraph,
  SemanticProjection,
  StructuralAnalysis,
  WorkflowConfig,
} from "../shared/contracts";

export const PROJECTION_LIMITS = Object.freeze({
  maxTasks: 25,
  maxEdges: 100,
  maxGoalChars: 2_000,
  maxDescriptionChars: 2_000,
  maxBodyChars: 4_000,
  maxInputChars: 4_000,
  maxOutputNameChars: 120,
  maxOutputInstructionsChars: 2_000,
  maxOutputOptions: 10,
  maxBytes: 65_536,
});

export class ProjectionLimitError extends Error {
  constructor(
    public readonly path: string,
    public readonly limit: number,
  ) {
    super(`Semantic projection limit exceeded at ${path} (${limit}).`);
    this.name = "ProjectionLimitError";
  }
}

export function createSemanticProjection(
  reviewId: string,
  workflow: WorkflowConfig,
  graph: ResolvedGraph,
  structural: StructuralAnalysis,
): SemanticProjection {
  enforceCount(
    "$.tasks",
    workflow.tasks?.length ?? 0,
    PROJECTION_LIMITS.maxTasks,
  );
  enforceCount(
    "$.effectiveEdges",
    graph.edges.length,
    PROJECTION_LIMITS.maxEdges,
  );
  enforceText("$.goal", workflow.goal ?? "", PROJECTION_LIMITS.maxGoalChars);

  const tasks = (workflow.tasks ?? []).map((task, taskIndex) => {
    enforceText(
      `$.tasks[${taskIndex}].description`,
      task.description,
      PROJECTION_LIMITS.maxDescriptionChars,
    );
    if (task.body)
      enforceText(
        `$.tasks[${taskIndex}].body`,
        task.body,
        PROJECTION_LIMITS.maxBodyChars,
      );
    if (task.input)
      enforceText(
        `$.tasks[${taskIndex}].input`,
        task.input,
        PROJECTION_LIMITS.maxInputChars,
      );
    const outputs = Object.entries(task.outputOptions ?? {});
    enforceCount(
      `$.tasks[${taskIndex}].outputOptions`,
      outputs.length,
      PROJECTION_LIMITS.maxOutputOptions,
    );
    return {
      identifier: `task:${task.name}`,
      agentId: String(task.agentId),
      description: task.description,
      ...(task.body ? { body: task.body } : {}),
      ...(task.input ? { inputExpectation: task.input } : {}),
      outputExpectations: outputs.map(([port, output]) => {
        enforceText(
          `$.tasks[${taskIndex}].outputOptions.${port}.name`,
          output.name,
          PROJECTION_LIMITS.maxOutputNameChars,
        );
        enforceText(
          `$.tasks[${taskIndex}].outputOptions.${port}.instructions`,
          output.instructions,
          PROJECTION_LIMITS.maxOutputInstructionsChars,
        );
        return {
          port,
          name: output.name,
          type: output.type,
          instructions: output.instructions,
        };
      }),
      dependencies: task.dependencies ?? [],
    };
  });

  const projection: SemanticProjection = redactDefensively({
    projectionVersion: "1",
    reviewId,
    workflow: {
      identifier: `workflow:${workflow.name}`,
      objective: workflow.goal ?? "",
    },
    tasks,
    handoffs: graph.edges.map((edge) => ({
      identifier: edge.id,
      from: edge.from,
      to: edge.to,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      origin: edge.origin,
    })),
    structuralFindings: structural.findings.map((item) => ({
      code: item.code,
      severity: item.severity,
      identifiers: item.evidence.map((evidence) => evidence.identifier),
    })),
  });

  const size = new TextEncoder().encode(JSON.stringify(projection)).byteLength;
  if (size > PROJECTION_LIMITS.maxBytes)
    throw new ProjectionLimitError("$", PROJECTION_LIMITS.maxBytes);
  return projection;
}

function enforceCount(path: string, actual: number, limit: number) {
  if (actual > limit) throw new ProjectionLimitError(path, limit);
}

function enforceText(path: string, value: string, limit: number) {
  if ([...value].length > limit) throw new ProjectionLimitError(path, limit);
}
