import Ajv2020 from "ajv/dist/2020.js";
import { findSecrets } from "../input/secrets";
import type { SemanticProjection, SemanticReview } from "../shared/contracts";
import semanticReviewSchema from "./semantic-review.schema.json";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile<SemanticReview>(semanticReviewSchema);
const UNSAFE_SUGGESTION =
  /\b(workflows?\.sync|deploy(?:ment)?|private key|seed phrase|api key|authorization header|bypass validation|already (?:applied|changed|updated)|send (?:funds|tokens)|sign (?:the )?transaction)\b/i;

export class InvalidSemanticReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSemanticReviewError";
  }
}

export function parseAndValidateSemanticReview(
  content: string,
  projection: SemanticProjection,
): SemanticReview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new InvalidSemanticReviewError("SERV returned malformed JSON.");
  }
  if (!validateSchema(parsed)) {
    throw new InvalidSemanticReviewError(
      "SERV returned a response that does not match the semantic result schema.",
    );
  }

  const identifiers = allowedIdentifiers(projection);
  const findingIds = new Set<string>();
  for (const finding of parsed.findings) {
    if (findingIds.has(finding.id))
      throw new InvalidSemanticReviewError(
        "SERV returned duplicate finding identifiers.",
      );
    findingIds.add(finding.id);
    for (const evidence of finding.evidence) {
      if (!identifiers.has(evidence.identifier)) {
        throw new InvalidSemanticReviewError(
          "SERV cited evidence outside the submitted projection.",
        );
      }
    }
    if (
      finding.suggestedFix &&
      (UNSAFE_SUGGESTION.test(finding.suggestedFix) ||
        findSecrets(finding.suggestedFix).length > 0)
    ) {
      throw new InvalidSemanticReviewError(
        "SERV returned an unsafe suggested correction.",
      );
    }
  }
  if (parsed.status === "pass" && parsed.findings.length > 0)
    throw new InvalidSemanticReviewError(
      "SERV returned an inconsistent pass status.",
    );
  if (
    parsed.status === "blocked" &&
    !parsed.findings.some((finding) => finding.severity === "critical")
  )
    throw new InvalidSemanticReviewError(
      "SERV returned an inconsistent blocked status.",
    );
  if (
    parsed.status === "insufficient_evidence" &&
    !parsed.findings.some(
      (finding) => finding.category === "insufficient_evidence",
    )
  )
    throw new InvalidSemanticReviewError(
      "SERV returned an inconsistent evidence status.",
    );
  return parsed;
}

function allowedIdentifiers(projection: SemanticProjection): Set<string> {
  return new Set([
    projection.workflow.identifier,
    ...projection.tasks.flatMap((task) => [
      task.identifier,
      `agent:${task.agentId}`,
    ]),
    ...projection.handoffs.flatMap((handoff) => [
      handoff.identifier,
      handoff.from,
      handoff.to,
    ]),
    ...projection.structuralFindings.flatMap((finding) => finding.identifiers),
  ]);
}
