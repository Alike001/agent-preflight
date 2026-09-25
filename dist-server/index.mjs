// src/server/index.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

// src/input/parse-workflow.ts
import Ajv2020 from "ajv/dist/2020.js";

// src/input/workflow-config.schema.json
var workflow_config_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://agent-preflight.local/schemas/workflow-config-v1.json",
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { $ref: "#/$defs/nodeName" },
    goal: { type: "string", minLength: 1, maxLength: 4e3 },
    agentIds: {
      type: "array",
      maxItems: 100,
      uniqueItems: true,
      items: { $ref: "#/$defs/agentId" }
    },
    triggers: {
      type: "array",
      maxItems: 8,
      items: { $ref: "#/$defs/trigger" }
    },
    tasks: {
      type: "array",
      maxItems: 25,
      items: { $ref: "#/$defs/task" }
    },
    edges: {
      type: "array",
      maxItems: 100,
      items: { $ref: "#/$defs/edge" }
    }
  },
  $defs: {
    nodeName: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      pattern: "^[^:\\r\\n]+$"
    },
    agentId: {
      anyOf: [
        { type: "integer", minimum: 1 },
        { type: "string", pattern: "^[1-9][0-9]*$", maxLength: 20 }
      ]
    },
    outputOption: {
      type: "object",
      additionalProperties: false,
      required: ["name", "type", "instructions"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        type: { enum: ["text", "file", "json"] },
        instructions: { type: "string", minLength: 1, maxLength: 8e3 }
      }
    },
    task: {
      type: "object",
      additionalProperties: false,
      required: ["name", "agentId", "description"],
      properties: {
        id: { type: "integer", minimum: 1 },
        name: { $ref: "#/$defs/nodeName" },
        agentId: { $ref: "#/$defs/agentId" },
        description: { type: "string", minLength: 1, maxLength: 4e3 },
        body: { type: "string", maxLength: 32e3 },
        input: { type: "string", maxLength: 16e3 },
        dependencies: {
          type: "array",
          maxItems: 24,
          uniqueItems: true,
          items: { $ref: "#/$defs/nodeName" }
        },
        outputOptions: {
          type: "object",
          minProperties: 1,
          maxProperties: 10,
          propertyNames: { $ref: "#/$defs/nodeName" },
          additionalProperties: { $ref: "#/$defs/outputOption" }
        }
      }
    },
    edge: {
      type: "object",
      additionalProperties: false,
      required: ["from", "to"],
      properties: {
        from: {
          type: "string",
          pattern: "^(trigger|task):[^:\\r\\n]{1,120}$"
        },
        to: {
          type: "string",
          pattern: "^(trigger|task):[^:\\r\\n]{1,120}$"
        },
        sourcePort: { $ref: "#/$defs/nodeName" },
        targetPort: { $ref: "#/$defs/nodeName" }
      }
    },
    trigger: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["type"],
          properties: {
            type: { const: "webhook" },
            id: { type: "string", minLength: 1, maxLength: 120 },
            name: { $ref: "#/$defs/nodeName" },
            description: { type: "string", maxLength: 4e3 },
            waitForCompletion: { type: "boolean" },
            timeout: { type: "integer", minimum: 1, maximum: 3600 },
            inputSchema: { type: "object", maxProperties: 100 }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "x402Pricing", "waitForCompletion"],
          properties: {
            type: { const: "x402" },
            id: { type: "string", minLength: 1, maxLength: 120 },
            name: { $ref: "#/$defs/nodeName" },
            description: { type: "string", maxLength: 4e3 },
            x402Pricing: {
              type: "string",
              pattern: "^[0-9]+(\\.[0-9]+)?$",
              maxLength: 32
            },
            x402WalletAddress: {
              type: "string",
              minLength: 1,
              maxLength: 128
            },
            timeout: { type: "integer", minimum: 1, maximum: 3600 },
            inputSchema: { type: "object", maxProperties: 100 },
            waitForCompletion: { const: true }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "schedule", "timezone"],
          properties: {
            type: { const: "cron" },
            id: { type: "string", minLength: 1, maxLength: 120 },
            name: { $ref: "#/$defs/nodeName" },
            description: { type: "string", maxLength: 4e3 },
            schedule: { type: "string", minLength: 1, maxLength: 200 },
            timezone: { type: "string", minLength: 1, maxLength: 100 }
          }
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type"],
          properties: {
            type: { const: "manual" },
            id: { type: "string", minLength: 1, maxLength: 120 },
            name: { $ref: "#/$defs/nodeName" },
            description: { type: "string", maxLength: 4e3 }
          }
        }
      ]
    }
  }
};

// src/input/limits.ts
var INPUT_LIMITS = Object.freeze({
  maxBytes: 256 * 1024,
  maxDepth: 12,
  maxValues: 5e3
});
function measureJsonComplexity(root) {
  const stack = [
    { value: root, depth: 1 }
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
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/input/secrets.ts
var ENV_REFERENCE = /^\$\{[A-Z][A-Z0-9_]*\}$/;
var SENSITIVE_KEY = /^(authorization|api[_-]?key|password|private[_-]?key|mnemonic|seed[_-]?phrase|wallet[_-]?secret|session[_-]?secret|cookie|auth[_-]?token)$/i;
var VALUE_PATTERNS = [
  {
    kind: "authorization header",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i
  },
  {
    kind: "private key block",
    pattern: /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/
  },
  { kind: "private key", pattern: /\b0x[a-fA-F0-9]{64}\b/ },
  {
    kind: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/
  },
  { kind: "provider API key", pattern: /\b(?:sk|rk|pk)_[A-Za-z0-9_-]{20,}\b/ },
  {
    kind: "environment secret",
    pattern: /\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)\s*=\s*[^\s$][^\s]*/
  }
];
function findSecrets(root) {
  const findings = [];
  const stack = [{ value: root, path: "$", sensitiveContext: false }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    if (typeof current.value === "string") {
      if (!ENV_REFERENCE.test(current.value)) {
        if (current.sensitiveContext && current.value.trim()) {
          findings.push({ path: current.path, kind: "credential field" });
        }
        for (const candidate of VALUE_PATTERNS) {
          if (candidate.pattern.test(current.value)) {
            findings.push({ path: current.path, kind: candidate.kind });
          }
        }
      }
      continue;
    }
    if (Array.isArray(current.value)) {
      current.value.forEach((value, index) => {
        stack.push({
          value,
          path: `${current.path}[${index}]`,
          sensitiveContext: current.sensitiveContext
        });
      });
      continue;
    }
    if (isRecord2(current.value)) {
      for (const [key, value] of Object.entries(current.value)) {
        const path2 = `${current.path}.${key}`;
        const inInputSchemaDefinition = current.path.includes(".inputSchema") && isRecord2(value);
        stack.push({
          value,
          path: path2,
          sensitiveContext: !inInputSchemaDefinition && (current.sensitiveContext || SENSITIVE_KEY.test(key))
        });
      }
    }
  }
  return uniqueFindings(findings);
}
function redactDefensively(root) {
  return redactValue(root, false, "$");
}
function redactValue(value, sensitiveContext, path2) {
  if (typeof value === "string") {
    if (sensitiveContext) return "[REDACTED]";
    let redacted = value;
    for (const candidate of VALUE_PATTERNS)
      redacted = redacted.replace(candidate.pattern, "[REDACTED]");
    return redactUrl(redacted);
  }
  if (Array.isArray(value)) {
    return value.map(
      (entry, index) => redactValue(entry, sensitiveContext, `${path2}[${index}]`)
    );
  }
  if (!isRecord2(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const entryPath = `${path2}.${key}`;
      const schemaDefinition = path2.includes(".inputSchema") && isRecord2(entry);
      return [
        key,
        redactValue(
          entry,
          !schemaDefinition && (sensitiveContext || SENSITIVE_KEY.test(key)),
          entryPath
        )
      ];
    })
  );
}
function redactUrl(value) {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return value;
  }
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function uniqueFindings(findings) {
  return [
    ...new Map(
      findings.map((finding2) => [`${finding2.path}:${finding2.kind}`, finding2])
    ).values()
  ];
}

// src/input/parse-workflow.ts
var ajv = new Ajv2020({ allErrors: true, strict: true });
var validateWorkflow = ajv.compile(workflow_config_schema_default);
var decoder = new TextDecoder("utf-8", { fatal: true });
function parseWorkflowBytes(bytes) {
  if (bytes.byteLength > INPUT_LIMITS.maxBytes) {
    return failure(
      "INPUT_TOO_LARGE",
      "$",
      `File exceeds the ${INPUT_LIMITS.maxBytes}-byte limit.`
    );
  }
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    return failure(
      "INPUT_INVALID_UTF8",
      "$",
      "File must contain valid UTF-8 text."
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure(
      "INPUT_INVALID_JSON",
      "$",
      "File must contain one valid JSON object."
    );
  }
  const complexity = measureJsonComplexity(parsed);
  if (complexity.depth > INPUT_LIMITS.maxDepth || complexity.values > INPUT_LIMITS.maxValues) {
    return failure(
      "INPUT_COMPLEXITY_EXCEEDED",
      "$",
      `JSON exceeds depth ${INPUT_LIMITS.maxDepth} or ${INPUT_LIMITS.maxValues} total values.`
    );
  }
  const secrets = findSecrets(parsed);
  if (secrets.length > 0) {
    return {
      ok: false,
      issues: secrets.slice(0, 20).map((secret) => ({
        code: "SECRET_MATERIAL_DETECTED",
        path: secret.path,
        message: `${secret.kind} detected; the value was not retained or displayed.`
      }))
    };
  }
  if (!validateWorkflow(parsed)) {
    return { ok: false, issues: schemaIssues(validateWorkflow.errors ?? []) };
  }
  return { ok: true, workflow: redactDefensively(parsed) };
}
function schemaIssues(errors) {
  return errors.slice(0, 20).map((error) => ({
    code: "INPUT_SCHEMA_INVALID",
    path: error.instancePath || "$",
    message: error.message ? `Schema ${error.message}.` : "Input does not match the schema."
  }));
}
function failure(code, path2, message) {
  return { ok: false, issues: [{ code, path: path2, message }] };
}

// src/server/config.ts
function loadServerConfig(env = process.env) {
  return {
    port: positiveInteger(env.PORT, 8787),
    servApiKey: env.SERV_API_KEY?.trim() ?? "",
    servModel: env.SERV_MODEL?.trim() || "gpt-5.4-mini",
    rateWindowMs: positiveInteger(env.SERV_RATE_LIMIT_WINDOW_SECONDS, 900) * 1e3,
    sessionLimit: positiveInteger(env.SERV_SESSION_REQUEST_LIMIT, 5),
    ipLimit: positiveInteger(env.SERV_IP_REQUEST_LIMIT, 20),
    globalRequestCap: positiveInteger(env.SERV_GLOBAL_REQUEST_CAP, 100),
    globalSpendCapUsd: positiveNumber(env.SERV_GLOBAL_SPEND_CAP_USD, 1),
    requestReservationUsd: positiveNumber(
      env.SERV_ESTIMATED_MAX_COST_PER_REQUEST_USD,
      0.02
    )
  };
}
function positiveInteger(value, fallback) {
  if (value === void 0 || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error("Server usage protection configuration is invalid.");
  return parsed;
}
function positiveNumber(value, fallback) {
  if (value === void 0 || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error("Server usage protection configuration is invalid.");
  return parsed;
}

// src/server/scan-service.ts
import { randomUUID } from "node:crypto";

// src/analysis/projection.ts
var PROJECTION_LIMITS = Object.freeze({
  maxTasks: 25,
  maxEdges: 100,
  maxGoalChars: 2e3,
  maxDescriptionChars: 2e3,
  maxBodyChars: 4e3,
  maxInputChars: 4e3,
  maxOutputNameChars: 120,
  maxOutputInstructionsChars: 2e3,
  maxOutputOptions: 10,
  maxBytes: 65536
});
var ProjectionLimitError = class extends Error {
  constructor(path2, limit) {
    super(`Semantic projection limit exceeded at ${path2} (${limit}).`);
    this.path = path2;
    this.limit = limit;
    this.name = "ProjectionLimitError";
  }
  path;
  limit;
};
function createSemanticProjection(reviewId, workflow, graph, structural) {
  enforceCount(
    "$.tasks",
    workflow.tasks?.length ?? 0,
    PROJECTION_LIMITS.maxTasks
  );
  enforceCount(
    "$.effectiveEdges",
    graph.edges.length,
    PROJECTION_LIMITS.maxEdges
  );
  enforceText("$.goal", workflow.goal ?? "", PROJECTION_LIMITS.maxGoalChars);
  const tasks = (workflow.tasks ?? []).map((task, taskIndex) => {
    enforceText(
      `$.tasks[${taskIndex}].description`,
      task.description,
      PROJECTION_LIMITS.maxDescriptionChars
    );
    if (task.body)
      enforceText(
        `$.tasks[${taskIndex}].body`,
        task.body,
        PROJECTION_LIMITS.maxBodyChars
      );
    if (task.input)
      enforceText(
        `$.tasks[${taskIndex}].input`,
        task.input,
        PROJECTION_LIMITS.maxInputChars
      );
    const outputs = Object.entries(task.outputOptions ?? {});
    enforceCount(
      `$.tasks[${taskIndex}].outputOptions`,
      outputs.length,
      PROJECTION_LIMITS.maxOutputOptions
    );
    return {
      identifier: `task:${task.name}`,
      agentId: String(task.agentId),
      description: task.description,
      ...task.body ? { body: task.body } : {},
      ...task.input ? { inputExpectation: task.input } : {},
      outputExpectations: outputs.map(([port, output]) => {
        enforceText(
          `$.tasks[${taskIndex}].outputOptions.${port}.name`,
          output.name,
          PROJECTION_LIMITS.maxOutputNameChars
        );
        enforceText(
          `$.tasks[${taskIndex}].outputOptions.${port}.instructions`,
          output.instructions,
          PROJECTION_LIMITS.maxOutputInstructionsChars
        );
        return {
          port,
          name: output.name,
          type: output.type,
          instructions: output.instructions
        };
      }),
      dependencies: task.dependencies ?? []
    };
  });
  const projection = redactDefensively({
    projectionVersion: "1",
    reviewId,
    workflow: {
      identifier: `workflow:${workflow.name}`,
      objective: workflow.goal ?? ""
    },
    tasks,
    handoffs: graph.edges.map((edge) => ({
      identifier: edge.id,
      from: edge.from,
      to: edge.to,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      origin: edge.origin
    })),
    structuralFindings: structural.findings.map((item) => ({
      code: item.code,
      severity: item.severity,
      identifiers: item.evidence.map((evidence) => evidence.identifier)
    }))
  });
  const size = new TextEncoder().encode(JSON.stringify(projection)).byteLength;
  if (size > PROJECTION_LIMITS.maxBytes)
    throw new ProjectionLimitError("$", PROJECTION_LIMITS.maxBytes);
  return projection;
}
function enforceCount(path2, actual, limit) {
  if (actual > limit) throw new ProjectionLimitError(path2, limit);
}
function enforceText(path2, value, limit) {
  if ([...value].length > limit) throw new ProjectionLimitError(path2, limit);
}

// src/analysis/structural.ts
function analyzeStructure(workflow, graph) {
  const findings = [];
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
        suggestedFix: "Add a complete goal sentence to the local workflow configuration."
      })
    );
  }
  if (triggers.length === 0)
    findings.push(
      simple("NO_TRIGGERS", "No trigger starts this workflow", "$.triggers")
    );
  if (tasks.length === 0)
    findings.push(simple("NO_TASKS", "No tasks are declared", "$.tasks"));
  addDuplicates(
    findings,
    triggers.map((trigger) => trigger.name ?? trigger.type),
    "DUPLICATE_TRIGGER_NAME",
    "$.triggers"
  );
  addDuplicates(
    findings,
    tasks.map((task) => task.name),
    "DUPLICATE_TASK_NAME",
    "$.tasks"
  );
  const seenEdges = /* @__PURE__ */ new Set();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from))
      findings.push(
        simple("INVALID_EDGE_SOURCE", "Edge source does not exist", edge.from)
      );
    if (!nodeIds.has(edge.to))
      findings.push(
        simple("INVALID_EDGE_TARGET", "Edge target does not exist", edge.to)
      );
    if (!edge.to.startsWith("task:"))
      findings.push(
        simple("INVALID_EDGE_DIRECTION", "Edges must target a task", edge.id)
      );
    if (edge.targetPort !== "input")
      findings.push(
        simple(
          "INVALID_TARGET_PORT",
          "Task target port must be input",
          edge.id
        )
      );
    const sourceTask = edge.from.startsWith("task:") ? tasks.find((task) => `task:${task.name}` === edge.from) : void 0;
    const allowedPorts = sourceTask ? Object.keys(sourceTask.outputOptions ?? { default: true }) : ["default"];
    if (nodeIds.has(edge.from) && !allowedPorts.includes(edge.sourcePort)) {
      findings.push(
        simple("INVALID_SOURCE_PORT", "Source port is not declared", edge.id)
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
      "warning"
    );
    for (const dependency of dependencies) {
      if (!taskNames.has(dependency)) {
        findings.push(
          simple(
            "UNKNOWN_TASK_DEPENDENCY",
            "Dependency names no task",
            `$.tasks[${taskIndex}].dependencies`
          )
        );
      } else if (dependency === task.name) {
        findings.push(
          simple(
            "SELF_DEPENDENCY",
            "Task depends on itself",
            `task:${task.name}`
          )
        );
      } else if (!graph.edges.some(
        (edge) => edge.from === `task:${dependency}` && edge.to === `task:${task.name}`
      )) {
        findings.push(
          simple(
            "MISSING_REQUIRED_EDGE",
            "Declared dependency has no data-flow edge",
            `task:${dependency} -> task:${task.name}`
          )
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
          `task:${task.name}`
        )
      );
  }
  if (hasTaskCycle(graph))
    findings.push(
      simple("WORKFLOW_CYCLE", "Task graph contains a cycle", "$.edges")
    );
  findings.sort(
    (left, right) => `${left.code}:${left.evidence[0]?.identifier}`.localeCompare(
      `${right.code}:${right.evidence[0]?.identifier}`
    )
  );
  return {
    findings,
    passed: !findings.some((item) => item.severity === "critical")
  };
}
function simple(code, title, identifier, severity = "critical") {
  return finding({
    code,
    severity,
    title,
    identifiers: [identifier],
    rationale: title,
    suggestedFix: "Update the local workflow configuration and rescan."
  });
}
function finding(input) {
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
      explanation: input.title
    })),
    rationale: input.rationale,
    suggestedFix: input.suggestedFix
  };
}
function addDuplicates(findings, values, code, path2, severity = "critical") {
  const seen = /* @__PURE__ */ new Set();
  for (const value of values) {
    if (seen.has(value))
      findings.push(simple(code, `Duplicate value: ${value}`, path2, severity));
    seen.add(value);
  }
}
function reachableNodes(graph) {
  const reachable = new Set(
    graph.nodes.filter((node) => node.kind === "trigger").map((node) => node.id)
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
function hasTaskCycle(graph) {
  const adjacency = /* @__PURE__ */ new Map();
  for (const edge of graph.edges) {
    if (edge.from.startsWith("task:") && edge.to.startsWith("task:")) {
      adjacency.set(edge.from, [...adjacency.get(edge.from) ?? [], edge.to]);
    }
  }
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const visit = (node) => {
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

// src/graph/resolve.ts
function resolveWorkflowGraph(workflow) {
  const triggers = workflow.triggers ?? [];
  const tasks = workflow.tasks ?? [];
  const nodes = [
    ...triggers.map((trigger) => {
      const label = trigger.name ?? trigger.type;
      return { id: `trigger:${label}`, kind: "trigger", label };
    }),
    ...tasks.map((task) => ({
      id: `task:${task.name}`,
      kind: "task",
      label: task.name
    }))
  ];
  if (Object.hasOwn(workflow, "edges")) {
    return {
      nodes,
      edges: (workflow.edges ?? []).map(
        (edge, index) => normalizeEdge(edge, index)
      ),
      edgeMode: "explicit"
    };
  }
  if (triggers.length === 0 || tasks.length === 0)
    return { nodes, edges: [], edgeMode: "none" };
  const edges = [];
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
      origin: "implicit"
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
      origin: "implicit"
    });
  }
  return { nodes, edges, edgeMode: "implicit" };
}
function normalizeEdge(edge, index) {
  return {
    id: `explicit-${index}`,
    from: edge.from,
    to: edge.to,
    sourcePort: edge.sourcePort ?? "default",
    targetPort: edge.targetPort ?? "input",
    origin: "explicit"
  };
}

// src/serv/map-findings.ts
var CATEGORY_MAP = {
  handoff_mismatch: {
    code: "SEMANTIC_HANDOFF_MISMATCH",
    title: "Semantic handoff mismatch",
    severity: "critical"
  },
  missing_prerequisite: {
    code: "MISSING_SEMANTIC_PREREQUISITE",
    title: "Required semantic prerequisite is missing",
    severity: "critical"
  },
  capability_mismatch: {
    code: "AGENT_CAPABILITY_MISMATCH",
    title: "Task and declared capability do not align",
    severity: "critical"
  },
  permission_risk: {
    code: "UNJUSTIFIED_PERMISSION_SCOPE",
    title: "Declared permission is not justified by the task",
    severity: "critical"
  },
  contradiction: {
    code: "CONTRADICTORY_INSTRUCTIONS",
    title: "Workflow instructions conflict",
    severity: "critical"
  },
  ambiguous_responsibility: {
    code: "AMBIGUOUS_RESPONSIBILITY",
    title: "Important responsibility has no clear owner",
    severity: "warning"
  },
  unsafe_escalation: {
    code: "UNSAFE_SEMANTIC_ESCALATION",
    title: "Workflow escalates authority without justification",
    severity: "critical"
  },
  insufficient_evidence: {
    code: "INSUFFICIENT_SEMANTIC_EVIDENCE",
    title: "Semantic evidence is incomplete",
    severity: "warning"
  }
};
function mapSemanticFindings(review) {
  return review.findings.map((finding2) => {
    const mapped = CATEGORY_MAP[finding2.category];
    return {
      id: `serv:${finding2.id}`,
      code: mapped.code,
      source: "serv",
      category: finding2.category,
      severity: mapped.severity,
      confidence: finding2.confidence,
      title: mapped.title,
      evidence: finding2.evidence,
      rationale: finding2.rationale,
      suggestedFix: finding2.suggestedFix
    };
  });
}

// src/serv/validate.ts
import Ajv20202 from "ajv/dist/2020.js";

// src/serv/semantic-review.schema.json
var semantic_review_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://agent-preflight.local/schemas/semantic-review-v1.json",
  type: "object",
  additionalProperties: false,
  required: ["status", "summary", "findings"],
  properties: {
    status: {
      enum: ["pass", "warning", "blocked", "insufficient_evidence"]
    },
    summary: { type: "string", minLength: 1, maxLength: 1600 },
    findings: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "category",
          "severity",
          "confidence",
          "evidence",
          "rationale",
          "suggestedFix"
        ],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 120 },
          category: {
            enum: [
              "handoff_mismatch",
              "missing_prerequisite",
              "capability_mismatch",
              "permission_risk",
              "contradiction",
              "ambiguous_responsibility",
              "unsafe_escalation",
              "insufficient_evidence"
            ]
          },
          severity: { enum: ["info", "warning", "critical"] },
          confidence: { enum: ["low", "medium", "high"] },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["identifier", "explanation"],
              properties: {
                identifier: {
                  type: "string",
                  minLength: 1,
                  maxLength: 180
                },
                explanation: {
                  type: "string",
                  minLength: 1,
                  maxLength: 800
                }
              }
            }
          },
          rationale: { type: "string", minLength: 1, maxLength: 1600 },
          suggestedFix: {
            anyOf: [
              { type: "string", minLength: 1, maxLength: 2e3 },
              { type: "null" }
            ]
          }
        }
      }
    }
  }
};

// src/serv/validate.ts
var ajv2 = new Ajv20202({ allErrors: true, strict: true });
var validateSchema = ajv2.compile(semantic_review_schema_default);
var UNSAFE_SUGGESTION = /\b(workflows?\.sync|deploy(?:ment)?|private key|seed phrase|api key|authorization header|bypass validation|already (?:applied|changed|updated)|send (?:funds|tokens)|sign (?:the )?transaction)\b/i;
var InvalidSemanticReviewError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidSemanticReviewError";
  }
};
function parseAndValidateSemanticReview(content, projection) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new InvalidSemanticReviewError("SERV returned malformed JSON.");
  }
  if (!validateSchema(parsed)) {
    throw new InvalidSemanticReviewError(
      "SERV returned a response that does not match the semantic result schema."
    );
  }
  const identifiers = allowedIdentifiers(projection);
  const findingIds = /* @__PURE__ */ new Set();
  for (const finding2 of parsed.findings) {
    if (findingIds.has(finding2.id))
      throw new InvalidSemanticReviewError(
        "SERV returned duplicate finding identifiers."
      );
    findingIds.add(finding2.id);
    for (const evidence of finding2.evidence) {
      if (!identifiers.has(evidence.identifier)) {
        throw new InvalidSemanticReviewError(
          "SERV cited evidence outside the submitted projection."
        );
      }
    }
    if (finding2.suggestedFix && (UNSAFE_SUGGESTION.test(finding2.suggestedFix) || findSecrets(finding2.suggestedFix).length > 0)) {
      throw new InvalidSemanticReviewError(
        "SERV returned an unsafe suggested correction."
      );
    }
  }
  return parsed;
}
function allowedIdentifiers(projection) {
  return /* @__PURE__ */ new Set([
    projection.workflow.identifier,
    ...projection.tasks.flatMap((task) => [
      task.identifier,
      `agent:${task.agentId}`
    ]),
    ...projection.handoffs.flatMap((handoff) => [
      handoff.identifier,
      handoff.from,
      handoff.to
    ]),
    ...projection.structuralFindings.flatMap((finding2) => finding2.identifiers)
  ]);
}

// src/server/scan-service.ts
async function runPreflight(workflow, context, config2, guard2, transport2) {
  const scanId = randomUUID();
  const graph = resolveWorkflowGraph(workflow);
  const structural = analyzeStructure(workflow, graph);
  const projection = createSemanticProjection(
    scanId,
    workflow,
    graph,
    structural
  );
  try {
    if (!config2.servApiKey) throw new Error("SERV_API_KEY is not configured.");
    guard2.reserve(context.sessionId, context.ip);
    const response = await transport2(projection);
    const review = parseAndValidateSemanticReview(response.content, projection);
    const semanticFindings = mapSemanticFindings(review);
    const findings = [...structural.findings, ...semanticFindings];
    const hasCritical = findings.some(
      (finding2) => finding2.severity === "critical"
    );
    const hasWarnings = findings.some(
      (finding2) => finding2.severity === "warning"
    );
    const status = hasCritical ? "blocked" : hasWarnings || review.status !== "pass" ? "warnings_found" : "ready_for_review";
    return {
      schemaVersion: "1",
      scanId,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      workflow: { name: workflow.name, goal: workflow.goal ?? "" },
      graph,
      status,
      statusLabel: status === "blocked" ? "BLOCKED" : status === "warnings_found" ? "WARNINGS FOUND" : "READY FOR REVIEW",
      structural,
      semantic: {
        completed: true,
        summary: review.summary,
        findings: semanticFindings,
        model: config2.servModel,
        reasoningEffort: "low",
        latencyMs: response.latencyMs,
        ...response.usage ? { usage: response.usage } : {}
      },
      findings,
      readOnlyDeclaration: "Decision support only. No live workflow was accessed, changed, deployed, or executed.",
      limitations: [
        "Reviews only the supplied local configuration and explicit declarations.",
        "Does not observe runtime behavior or prove that a workflow is safe.",
        "Suggested corrections require human review and affect only a local working copy."
      ]
    };
  } catch (error) {
    return incompleteReport(
      workflow,
      graph,
      structural,
      scanId,
      config2.servModel,
      safeErrorMessage(error)
    );
  }
}
function incompleteReport(workflow, graph, structural, scanId, model, summary) {
  return {
    schemaVersion: "1",
    scanId,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    workflow: { name: workflow.name, goal: workflow.goal ?? "" },
    graph,
    status: "serv_review_incomplete",
    statusLabel: "SERV REVIEW INCOMPLETE",
    structural,
    semantic: {
      completed: false,
      summary,
      findings: [],
      model,
      reasoningEffort: "low"
    },
    findings: structural.findings,
    readOnlyDeclaration: "Structural analysis only - SERV semantic review unavailable. No live workflow was changed.",
    limitations: [
      "This is not a completed preflight and must not be represented as passed or safe to execute."
    ]
  };
}
function safeErrorMessage(error) {
  if (error instanceof Error && error.name === "UsageLimitError")
    return error.message;
  if (error instanceof Error && error.name === "InvalidSemanticReviewError")
    return error.message;
  if (error instanceof Error && error.message === "SERV_API_KEY is not configured.")
    return "SERV semantic review is unavailable because the server is not configured. Structural findings are preserved; no request was sent.";
  if (error instanceof Error && /timeout|aborted/i.test(error.message))
    return "SERV semantic review timed out after 30 seconds. Structural findings are preserved.";
  return "SERV semantic review could not be completed. Structural findings are preserved; no passing result was issued.";
}

// src/server/serv-client.ts
import OpenAI from "openai";

// src/serv/prompt.ts
var SERV_SYSTEM_PROMPT = `You are the semantic review engine inside Agent Preflight. Review an agent workflow before execution.

Use only the supplied semantic projection. Distinguish observed evidence from inferred risk. Never claim knowledge that was not supplied. Use insufficient_evidence when a judgment cannot safely be made. Cite exact workflow node, agent, edge, task, capability, tool, or permission identifiers from the projection. Never request credentials, reveal or reconstruct secrets, call tools, mutate a workflow, claim a mutation occurred, or claim the workflow is safe merely because no issue was found.

Evaluate semantic handoff compatibility, missing prerequisites, task/capability mismatch, proportionality of explicitly declared permissions, contradictory instructions, ambiguous responsibility, unsafe escalation, and evidence insufficiency. Treat task body text as declarations only when explicit; do not infer unseen capabilities or permissions. Return suggested local corrections for human review only.

Return only JSON matching the supplied strict response schema.`;

// src/server/serv-client.ts
function createServTransport(apiKey, model) {
  if (!apiKey) throw new Error("SERV_API_KEY is not configured.");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://inference-api.openserv.ai/v1",
    maxRetries: 0,
    timeout: 3e4
  });
  return async (projection) => {
    const startedAt = performance.now();
    const completion = await client.chat.completions.create({
      model,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SERV_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(projection) }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "agent_preflight_semantic_review",
          strict: true,
          schema: semantic_review_schema_default
        }
      }
    });
    const content = completion.choices[0]?.message.content;
    if (!content) throw new Error("SERV returned no semantic review content.");
    const usage = completion.usage ? {
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens
    } : null;
    return {
      content,
      usage,
      latencyMs: Math.round(performance.now() - startedAt)
    };
  };
}

// src/server/usage-guard.ts
var UsageLimitError = class extends Error {
  constructor() {
    super(
      "Semantic review is temporarily unavailable because the public demo usage limit has been reached. Your workflow was not sent to SERV. Try again later."
    );
    this.name = "UsageLimitError";
  }
};
var UsageGuard = class {
  constructor(config2, now = Date.now) {
    this.config = config2;
    this.now = now;
  }
  config;
  now;
  sessions = /* @__PURE__ */ new Map();
  ips = /* @__PURE__ */ new Map();
  day = utcDay(Date.now());
  dailyRequests = 0;
  reservedSpend = 0;
  reserve(sessionId, ip) {
    const now = this.now();
    this.rollDay(now);
    const session = this.currentCounter(this.sessions, sessionId, now);
    const sourceIp = this.currentCounter(this.ips, ip, now);
    if (session.count >= this.config.sessionLimit || sourceIp.count >= this.config.ipLimit || this.dailyRequests >= this.config.globalRequestCap || this.reservedSpend + this.config.requestReservationUsd > this.config.globalSpendCapUsd)
      throw new UsageLimitError();
    session.count += 1;
    sourceIp.count += 1;
    this.dailyRequests += 1;
    this.reservedSpend += this.config.requestReservationUsd;
  }
  currentCounter(map, key, now) {
    const existing = map.get(key);
    if (existing && now - existing.startedAt < this.config.rateWindowMs)
      return existing;
    const next = { startedAt: now, count: 0 };
    map.set(key, next);
    return next;
  }
  rollDay(now) {
    const nextDay = utcDay(now);
    if (nextDay === this.day) return;
    this.day = nextDay;
    this.dailyRequests = 0;
    this.reservedSpend = 0;
  }
};
function utcDay(now) {
  return new Date(now).toISOString().slice(0, 10);
}

// src/server/index.ts
var config = loadServerConfig();
var app = express();
var guard = new UsageGuard(config);
var unavailableTransport = () => Promise.reject(new Error("SERV_API_KEY is not configured."));
var transport = config.servApiKey ? createServTransport(config.servApiKey, config.servModel) : unavailableTransport;
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "260kb", strict: true }));
app.post("/api/preflight", async (request, response) => {
  const sessionId = readSessionId(request.headers.cookie) ?? randomUUID2();
  response.cookie("agent_preflight_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1e3
  });
  const rawWorkflow = isRecord3(request.body) ? request.body.workflow : void 0;
  const parsed = parseWorkflowBytes(
    new TextEncoder().encode(JSON.stringify(rawWorkflow))
  );
  if (!parsed.ok) {
    response.status(400).json({ code: "INPUT_REJECTED", issues: parsed.issues });
    return;
  }
  try {
    const report = await runPreflight(
      parsed.workflow,
      { sessionId, ip: request.ip ?? "unknown" },
      config,
      guard,
      transport
    );
    response.status(200).json(report);
  } catch {
    response.status(422).json({
      code: "SEMANTIC_PROJECTION_REJECTED",
      message: "The workflow could not be safely prepared for semantic review. No SERV request was sent."
    });
  }
});
if (process.env.NODE_ENV === "production") {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const clientDir = path.resolve(root, "../dist");
  app.use(express.static(clientDir));
  app.get(
    "/{*path}",
    (_request, response) => response.sendFile(path.join(clientDir, "index.html"))
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}
app.listen(config.port, "127.0.0.1", () => {
  process.stdout.write(
    `Agent Preflight listening on http://127.0.0.1:${config.port}
`
  );
});
function readSessionId(cookieHeader) {
  const match = cookieHeader?.match(
    /(?:^|;\s*)agent_preflight_session=([A-Za-z0-9-]{20,80})(?:;|$)/
  );
  return match?.[1];
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
