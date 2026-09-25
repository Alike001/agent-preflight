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

export type FindingSeverity = "info" | "warning" | "critical";
export type FindingSource = "structural" | "serv";

export interface FindingEvidence {
  identifier: string;
  explanation: string;
}

export interface PreflightFinding {
  id: string;
  code: string;
  source: FindingSource;
  category: string;
  severity: FindingSeverity;
  confidence: "deterministic" | "low" | "medium" | "high";
  title: string;
  evidence: FindingEvidence[];
  rationale: string;
  suggestedFix: string | null;
}

export type CombinedPreflightStatus =
  "ready_for_review" | "warnings_found" | "blocked" | "serv_review_incomplete";

export interface StructuralAnalysis {
  findings: PreflightFinding[];
  passed: boolean;
}

export interface SemanticEvidence {
  identifier: string;
  explanation: string;
}

export type SemanticCategory =
  | "handoff_mismatch"
  | "missing_prerequisite"
  | "capability_mismatch"
  | "permission_risk"
  | "contradiction"
  | "ambiguous_responsibility"
  | "unsafe_escalation"
  | "insufficient_evidence";

export interface SemanticFinding {
  id: string;
  category: SemanticCategory;
  severity: FindingSeverity;
  confidence: "low" | "medium" | "high";
  evidence: SemanticEvidence[];
  rationale: string;
  suggestedFix: string | null;
}

export interface SemanticReview {
  status: "pass" | "warning" | "blocked" | "insufficient_evidence";
  summary: string;
  findings: SemanticFinding[];
}

export interface SemanticTaskProjection {
  identifier: string;
  agentId: string;
  description: string;
  body?: string;
  inputExpectation?: string;
  outputExpectations: Array<{
    port: string;
    name: string;
    type: OutputOption["type"];
    instructions: string;
  }>;
  dependencies: string[];
}

export interface SemanticProjection {
  projectionVersion: "1";
  reviewId: string;
  workflow: { identifier: string; objective: string };
  tasks: SemanticTaskProjection[];
  handoffs: Array<{
    identifier: string;
    from: string;
    to: string;
    sourcePort: string;
    targetPort: string;
    origin: EdgeOrigin;
  }>;
  structuralFindings: Array<{
    code: string;
    severity: FindingSeverity;
    identifiers: string[];
  }>;
}

export interface PreflightReport {
  schemaVersion: "1";
  scanId: string;
  generatedAt: string;
  inputFingerprint: string;
  workflow: { name: string; goal: string };
  graph: ResolvedGraph;
  status: CombinedPreflightStatus;
  statusLabel:
    | "READY FOR REVIEW"
    | "WARNINGS FOUND"
    | "BLOCKED"
    | "SERV REVIEW INCOMPLETE";
  structural: StructuralAnalysis;
  semantic: {
    completed: boolean;
    summary: string;
    findings: PreflightFinding[];
    model: string;
    reasoningEffort: "low";
    latencyMs?: number;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  findings: PreflightFinding[];
  readOnlyDeclaration: string;
  limitations: string[];
}

export type ParseResult =
  | { ok: true; workflow: WorkflowConfig }
  | { ok: false; issues: ValidationIssue[] };
