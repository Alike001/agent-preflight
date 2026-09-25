import type {
  PreflightFinding,
  SemanticCategory,
  SemanticReview,
} from "../shared/contracts";

const CATEGORY_MAP: Record<
  SemanticCategory,
  { code: string; title: string; severity: "info" | "warning" | "critical" }
> = {
  handoff_mismatch: {
    code: "SEMANTIC_HANDOFF_MISMATCH",
    title: "Semantic handoff mismatch",
    severity: "critical",
  },
  missing_prerequisite: {
    code: "MISSING_SEMANTIC_PREREQUISITE",
    title: "Required semantic prerequisite is missing",
    severity: "critical",
  },
  capability_mismatch: {
    code: "AGENT_CAPABILITY_MISMATCH",
    title: "Task and declared capability do not align",
    severity: "critical",
  },
  permission_risk: {
    code: "UNJUSTIFIED_PERMISSION_SCOPE",
    title: "Declared permission is not justified by the task",
    severity: "critical",
  },
  contradiction: {
    code: "CONTRADICTORY_INSTRUCTIONS",
    title: "Workflow instructions conflict",
    severity: "critical",
  },
  ambiguous_responsibility: {
    code: "AMBIGUOUS_RESPONSIBILITY",
    title: "Important responsibility has no clear owner",
    severity: "warning",
  },
  unsafe_escalation: {
    code: "UNSAFE_SEMANTIC_ESCALATION",
    title: "Workflow escalates authority without justification",
    severity: "critical",
  },
  insufficient_evidence: {
    code: "INSUFFICIENT_SEMANTIC_EVIDENCE",
    title: "Semantic evidence is incomplete",
    severity: "warning",
  },
};

export function mapSemanticFindings(
  review: SemanticReview,
): PreflightFinding[] {
  return review.findings.map((finding) => {
    const mapped = CATEGORY_MAP[finding.category];
    return {
      id: `serv:${finding.id}`,
      code: mapped.code,
      source: "serv",
      category: finding.category,
      severity: mapped.severity,
      confidence: finding.confidence,
      title: mapped.title,
      evidence: finding.evidence,
      rationale: finding.rationale,
      suggestedFix: finding.suggestedFix,
    };
  });
}
