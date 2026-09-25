import { describe, expect, it, vi } from "vitest";
import corrected from "../fixtures/mvp/corrected-control.json";
import { loadServerConfig } from "../src/server/config";
import { runPreflight } from "../src/server/scan-service";
import type { ServTransport } from "../src/server/serv-client";
import { UsageGuard } from "../src/server/usage-guard";
import type { WorkflowConfig } from "../src/shared/contracts";

const config = loadServerConfig({
  SERV_API_KEY: "test-only",
  SERV_SESSION_REQUEST_LIMIT: "1",
});

describe("preflight service", () => {
  it("makes exactly one transport call and completes a passing review", async () => {
    const transport = vi.fn<ServTransport>().mockResolvedValue({
      content: JSON.stringify({
        status: "pass",
        summary: "No semantic defect found in supplied evidence.",
        findings: [],
      }),
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      latencyMs: 12,
    });
    const report = await runPreflight(
      corrected as WorkflowConfig,
      { sessionId: "session-a", ip: "127.0.0.1" },
      config,
      new UsageGuard(config),
      transport,
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect(report.status).toBe("ready_for_review");
    expect(report.semantic.completed).toBe(true);
  });

  it("preserves structural findings and fails closed on API failure", async () => {
    const transport: ServTransport = () =>
      Promise.reject(new Error("provider unavailable"));
    const report = await runPreflight(
      corrected as WorkflowConfig,
      { sessionId: "session-b", ip: "127.0.0.2" },
      config,
      new UsageGuard(config),
      transport,
    );
    expect(report.status).toBe("serv_review_incomplete");
    expect(report.statusLabel).toBe("SERV REVIEW INCOMPLETE");
    expect(report.readOnlyDeclaration).toContain("Structural analysis only");
  });

  it("rate limits a new scan without calling the transport", async () => {
    const guard = new UsageGuard(config);
    const transport = vi.fn<ServTransport>().mockResolvedValue({
      content: JSON.stringify({
        status: "pass",
        summary: "Complete.",
        findings: [],
      }),
      usage: null,
      latencyMs: 1,
    });
    await runPreflight(
      corrected as WorkflowConfig,
      { sessionId: "session-c", ip: "127.0.0.3" },
      config,
      guard,
      transport,
    );
    const second = await runPreflight(
      corrected as WorkflowConfig,
      { sessionId: "session-c", ip: "127.0.0.3" },
      config,
      guard,
      transport,
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("serv_review_incomplete");
  });
});
