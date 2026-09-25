import OpenAI from "openai";
import semanticReviewSchema from "../serv/semantic-review.schema.json";
import { SERV_SYSTEM_PROMPT } from "../serv/prompt";
import type { SemanticProjection } from "../shared/contracts";

export const SERV_BASE_URL = "https://inference-api.openserv.ai/v1";

export interface ServUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
export interface ServResponse {
  content: string;
  usage: ServUsage | null;
  latencyMs: number;
}
export type ServTransport = (
  projection: SemanticProjection,
) => Promise<ServResponse>;

export function createServTransport(
  apiKey: string,
  model: string,
): ServTransport {
  if (!apiKey) throw new Error("SERV_API_KEY is not configured.");
  const client = new OpenAI({
    apiKey,
    baseURL: SERV_BASE_URL,
    maxRetries: 0,
    timeout: 30_000,
  });
  return async (projection) => {
    const startedAt = performance.now();
    const completion = await client.chat.completions.create(
      buildServRequest(model, projection),
    );
    const content = completion.choices[0]?.message.content;
    if (!content) throw new Error("SERV returned no semantic review content.");
    const usage = completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : null;
    return {
      content,
      usage,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  };
}

export function buildServRequest(
  model: string,
  projection: SemanticProjection,
) {
  return {
    model,
    reasoning_effort: "low" as const,
    messages: [
      { role: "system" as const, content: SERV_SYSTEM_PROMPT },
      { role: "user" as const, content: JSON.stringify(projection) },
    ],
    response_format: {
      type: "json_schema" as const,
      json_schema: {
        name: "agent_preflight_semantic_review",
        strict: true,
        schema: semanticReviewSchema,
      },
    },
  };
}
