import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import type {
  ParseResult,
  ValidationIssue,
  WorkflowConfig,
} from "../shared/contracts";
import workflowSchema from "./workflow-config.schema.json";
import { INPUT_LIMITS, measureJsonComplexity } from "./limits";
import { findSecrets, redactDefensively } from "./secrets";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateWorkflow = ajv.compile<WorkflowConfig>(workflowSchema);
const decoder = new TextDecoder("utf-8", { fatal: true });

export function parseWorkflowBytes(bytes: Uint8Array): ParseResult {
  if (bytes.byteLength > INPUT_LIMITS.maxBytes) {
    return failure(
      "INPUT_TOO_LARGE",
      "$",
      `File exceeds the ${INPUT_LIMITS.maxBytes}-byte limit.`,
    );
  }

  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    return failure(
      "INPUT_INVALID_UTF8",
      "$",
      "File must contain valid UTF-8 text.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure(
      "INPUT_INVALID_JSON",
      "$",
      "File must contain one valid JSON object.",
    );
  }

  const complexity = measureJsonComplexity(parsed);
  if (
    complexity.depth > INPUT_LIMITS.maxDepth ||
    complexity.values > INPUT_LIMITS.maxValues
  ) {
    return failure(
      "INPUT_COMPLEXITY_EXCEEDED",
      "$",
      `JSON exceeds depth ${INPUT_LIMITS.maxDepth} or ${INPUT_LIMITS.maxValues} total values.`,
    );
  }

  const secrets = findSecrets(parsed);
  if (secrets.length > 0) {
    return {
      ok: false,
      issues: secrets.slice(0, 20).map((secret) => ({
        code: "SECRET_MATERIAL_DETECTED",
        path: secret.path,
        message: `${secret.kind} detected; the value was not retained or displayed.`,
      })),
    };
  }

  if (!validateWorkflow(parsed)) {
    return { ok: false, issues: schemaIssues(validateWorkflow.errors ?? []) };
  }

  return { ok: true, workflow: redactDefensively(parsed) };
}

function schemaIssues(errors: ErrorObject[]): ValidationIssue[] {
  return errors.slice(0, 20).map((error) => ({
    code: "INPUT_SCHEMA_INVALID",
    path: error.instancePath || "$",
    message: error.message
      ? `Schema ${error.message}.`
      : "Input does not match the schema.",
  }));
}

function failure(
  code: ValidationIssue["code"],
  path: string,
  message: string,
): ParseResult {
  return { ok: false, issues: [{ code, path, message }] };
}
