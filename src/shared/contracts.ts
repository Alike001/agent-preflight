export type AgentId = number | string;
export type TriggerType = "webhook" | "x402" | "cron" | "manual";

export interface OutputOption {
  name: string;
  type: "text" | "file" | "json";
  instructions: string;
}

export interface TaskDefinition {
  id?: number;
  name: string;
  agentId: AgentId;
  description: string;
  body?: string;
  input?: string;
  dependencies?: string[];
  outputOptions?: Record<string, OutputOption>;
}

interface TriggerBase {
  id?: string;
  name?: string;
  description?: string;
}

export interface WebhookTrigger extends TriggerBase {
  type: "webhook";
  waitForCompletion?: boolean;
  timeout?: number;
  inputSchema?: Record<string, unknown>;
}

export interface X402Trigger extends TriggerBase {
  type: "x402";
  x402Pricing: string;
  x402WalletAddress?: string;
  timeout?: number;
  inputSchema?: Record<string, unknown>;
  waitForCompletion: true;
}

export interface CronTrigger extends TriggerBase {
  type: "cron";
  schedule: string;
  timezone: string;
}

export interface ManualTrigger extends TriggerBase {
  type: "manual";
}

export type TriggerConfig =
  WebhookTrigger | X402Trigger | CronTrigger | ManualTrigger;

export interface EdgeDefinition {
  from: string;
  to: string;
  sourcePort?: string;
  targetPort?: string;
}

export interface WorkflowConfig {
  name: string;
  goal?: string;
  agentIds?: AgentId[];
  triggers?: TriggerConfig[];
  tasks?: TaskDefinition[];
  edges?: EdgeDefinition[];
}

export type EdgeOrigin = "explicit" | "implicit";

export interface ResolvedNode {
  id: string;
  kind: "trigger" | "task";
  label: string;
}

export interface ResolvedEdge {
  id: string;
  from: string;
  to: string;
  sourcePort: string;
  targetPort: string;
  origin: EdgeOrigin;
}

export interface ResolvedGraph {
  nodes: ResolvedNode[];
  edges: ResolvedEdge[];
  edgeMode: "explicit" | "implicit" | "none";
}

export interface ValidationIssue {
  code:
    | "INPUT_TOO_LARGE"
    | "INPUT_INVALID_UTF8"
    | "INPUT_INVALID_JSON"
    | "INPUT_SCHEMA_INVALID"
    | "INPUT_COMPLEXITY_EXCEEDED"
    | "SECRET_MATERIAL_DETECTED";
  path: string;
  message: string;
}

export type ParseResult =
  | { ok: true; workflow: WorkflowConfig }
  | { ok: false; issues: ValidationIssue[] };
