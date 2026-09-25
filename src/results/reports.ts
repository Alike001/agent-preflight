import type { PreflightReport } from "../shared/contracts";

export function serializeJsonReport(report: PreflightReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeMarkdownReport(report: PreflightReport): string {
  const findings = report.findings.length
    ? report.findings
        .map(
          (finding) => `### ${finding.code}: ${finding.title}

- Source: ${finding.source === "serv" ? "SERV Reasoning" : "Structural validator"}
- Severity: ${finding.severity}
- Confidence: ${finding.confidence}
- Evidence: ${finding.evidence.map((item) => `\`${escapeInline(item.identifier)}\``).join(", ")}
- Rationale: ${finding.rationale}
- Suggested local correction: ${finding.suggestedFix ?? "None"}`,
        )
        .join("\n\n")
    : "No findings were returned for the supported checks.";

  return `# Agent Preflight Report

## Combined status

**${report.statusLabel}**

${report.readOnlyDeclaration}

## Workflow overview

- Workflow: ${report.workflow.name}
- Goal: ${report.workflow.goal || "Not supplied"}
- Scan ID: ${report.scanId}
- Generated: ${report.generatedAt}
- Input SHA-256: \`${report.inputFingerprint}\`
- Effective graph: ${report.graph.nodes.length} nodes, ${report.graph.edges.length} edges (${report.graph.edgeMode})

## SERV Semantic Review

- Completed: ${report.semantic.completed ? "yes" : "no"}
- Model: ${report.semantic.model}
- Reasoning effort: ${report.semantic.reasoningEffort}
- Summary: ${report.semantic.summary}

## Findings

${findings}

## Limitations

${report.limitations.map((item) => `- ${item}`).join("\n")}
`;
}

function escapeInline(value: string): string {
  return value.replaceAll("`", "\\`");
}
