import { describe, expect, it } from "vitest";
import {
  serializeJsonReport,
  serializeMarkdownReport,
} from "../src/results/reports";
import type { PreflightReport } from "../src/shared/contracts";

const report: PreflightReport = {
  schemaVersion: "1",
  scanId: "scan-1",
  generatedAt: "2026-09-25T00:00:00.000Z",
  inputFingerprint: "a".repeat(64),
  workflow: { name: "Fixture", goal: "Review a fixture." },
  graph: { nodes: [], edges: [], edgeMode: "none" },
  status: "serv_review_incomplete",
  statusLabel: "SERV REVIEW INCOMPLETE",
  structural: { findings: [], passed: true },
  semantic: {
    completed: false,
    summary: "Provider unavailable.",
    findings: [],
    model: "gpt-5.4-mini",
    reasoningEffort: "low",
  },
  findings: [],
  readOnlyDeclaration: "Structural analysis only.",
  limitations: ["Not a completed preflight."],
};

describe("report serialization", () => {
  it("exports valid JSON without raw workflow content", () => {
    const serialized = serializeJsonReport(report);
    expect(JSON.parse(serialized)).toMatchObject({
      statusLabel: "SERV REVIEW INCOMPLETE",
    });
    expect(serialized).not.toContain("SERV_API_KEY");
  });

  it("exports a human-readable Markdown report", () => {
    const markdown = serializeMarkdownReport(report);
    expect(markdown).toContain("# Agent Preflight Report");
    expect(markdown).toContain("SERV REVIEW INCOMPLETE");
    expect(markdown).toContain("Input SHA-256");
  });
});
