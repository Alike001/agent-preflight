import { describe, expect, it } from "vitest";
import { findSecrets, redactDefensively } from "../src/input/secrets";

describe("secret handling", () => {
  it("allows credential field descriptions inside inputSchema", () => {
    const value = {
      triggers: [
        {
          inputSchema: {
            properties: {
              apiKey: { type: "string", description: "Supplied at runtime." },
            },
          },
        },
      ],
    };

    expect(findSecrets(value)).toEqual([]);
    expect(redactDefensively(value)).toEqual(value);
  });

  it("rejects secret-like defaults inside inputSchema", () => {
    const value = {
      inputSchema: {
        properties: {
          token: {
            type: "string",
            default: "Bearer abcdefghijklmnopqrstuvwxyz",
          },
        },
      },
    };

    expect(findSecrets(value)).toContainEqual({
      path: "$.inputSchema.properties.token.default",
      kind: "authorization header",
    });
  });

  it("accepts unresolved environment references", () => {
    expect(findSecrets({ apiKey: "${SERV_API_KEY}" })).toEqual([]);
  });

  it("redacts credential fields, secret substrings, and URL credentials and queries", () => {
    const redacted = redactDefensively({
      password: "correct horse battery staple",
      note: "Use Bearer abcdefghijklmnopqrstuvwxyz for the call",
      endpoint: "https://person:pass@example.com/path?token=secret#section",
    });

    expect(redacted).toEqual({
      password: "[REDACTED]",
      note: "Use [REDACTED] for the call",
      endpoint: "https://example.com/path#section",
    });
  });
});
