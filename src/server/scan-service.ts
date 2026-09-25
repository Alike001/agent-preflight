import { randomUUID } from "node:crypto";
import { createSemanticProjection } from "../analysis/projection";
import { analyzeStructure } from "../analysis/structural";
import { resolveWorkflowGraph } from "../graph/resolve";
import { mapSemanticFindings } from "../serv/map-findings";
import { parseAndValidateSemanticReview } from "../serv/validate";
import type { PreflightReport, WorkflowConfig } from "../shared/contracts";
import type { ServerConfig } from "./config";
import type { ServTransport } from "./serv-client";
import { UsageGuard } from "./usage-guard";

export interface ScanContext {
  sessionId: string;
  ip: string;
}

export async function runPreflight(
  workflow: WorkflowConfig,
  context: ScanContext,
  config: ServerConfig,
  guard: UsageGuard,
  transport: ServTransport,
): Promise<PreflightReport> {
  const scanId = randomUUID();
  const graph = resolveWorkflowGraph(workflow);
  const structural = analyzeStructure(workflow, graph);
  const projection = createSemanticProjection(
    scanId,
    workflow,
    graph,
    structural,
  );
  try {
    if (!config.servApiKey) throw new Error("SERV_API_KEY is not configured.");
    guard.reserve(context.sessionId, context.ip);
    const response = await transport(projection);
    const review = parseAndValidateSemanticReview(response.content, projection);
    const semanticFindings = mapSemanticFindings(review);
    const findings = [...structural.findings, ...semanticFindings];
    const hasCritical = findings.some(
      (finding) => finding.severity === "critical",
    );
    const hasWarnings = findings.some(
      (finding) => finding.severity === "warning",
    );
    const status = hasCritical
      ? "blocked"
      : hasWarnings || review.status !== "pass"
        ? "warnings_found"
        : "ready_for_review";
    return {
      schemaVersion: "1",
      scanId,
      generatedAt: new Date().toISOString(),
      workflow: { name: workflow.name, goal: workflow.goal ?? "" },
      graph,
      status,
      statusLabel:
        status === "blocked"
          ? "BLOCKED"
          : status === "warnings_found"
            ? "WARNINGS FOUND"
            : "READY FOR REVIEW",
      structural,
      semantic: {
        completed: true,
        summary: review.summary,
        findings: semanticFindings,
        model: config.servModel,
        reasoningEffort: "low",
        latencyMs: response.latencyMs,
        ...(response.usage ? { usage: response.usage } : {}),
      },
      findings,
      readOnlyDeclaration:
        "Decision support only. No live workflow was accessed, changed, deployed, or executed.",
      limitations: [
        "Reviews only the supplied local configuration and explicit declarations.",
        "Does not observe runtime behavior or prove that a workflow is safe.",
        "Suggested corrections require human review and affect only a local working copy.",
      ],
    };
  } catch (error) {
    return incompleteReport(
      workflow,
      graph,
      structural,
      scanId,
      config.servModel,
      safeErrorMessage(error),
    );
  }
}

function incompleteReport(
  workflow: WorkflowConfig,
  graph: ReturnType<typeof resolveWorkflowGraph>,
  structural: ReturnType<typeof analyzeStructure>,
  scanId: string,
  model: string,
  summary: string,
): PreflightReport {
  return {
    schemaVersion: "1",
    scanId,
    generatedAt: new Date().toISOString(),
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
      reasoningEffort: "low",
    },
    findings: structural.findings,
    readOnlyDeclaration:
      "Structural analysis only - SERV semantic review unavailable. No live workflow was changed.",
    limitations: [
      "This is not a completed preflight and must not be represented as passed or safe to execute.",
    ],
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "UsageLimitError")
    return error.message;
  if (error instanceof Error && error.name === "InvalidSemanticReviewError")
    return error.message;
  if (
    error instanceof Error &&
    error.message === "SERV_API_KEY is not configured."
  )
    return "SERV semantic review is unavailable because the server is not configured. Structural findings are preserved; no request was sent.";
  if (error instanceof Error && /timeout|aborted/i.test(error.message))
    return "SERV semantic review timed out after 30 seconds. Structural findings are preserved.";
  return "SERV semantic review could not be completed. Structural findings are preserved; no passing result was issued.";
}
