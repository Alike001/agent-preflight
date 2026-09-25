import { useRef, useState, type ChangeEvent } from "react";
import correctedControl from "../../fixtures/mvp/corrected-control.json";
import semanticMismatch from "../../fixtures/mvp/semantic-mismatch.json";
import { analyzeStructure } from "../analysis/structural";
import { resolveWorkflowGraph } from "../graph/resolve";
import { parseWorkflowBytes } from "../input/parse-workflow";
import type {
  PreflightReport,
  ResolvedGraph,
  StructuralAnalysis,
  ValidationIssue,
  WorkflowConfig,
} from "../shared/contracts";
import { PreflightReportView } from "./PreflightReportView";
import { CorrectionWorkspace } from "./CorrectionWorkspace";
import { WorkflowGraph } from "./WorkflowGraph";

type ViewState =
  | { kind: "empty" }
  | { kind: "error"; fileName: string; issues: ValidationIssue[] }
  | {
      kind: "success";
      fileName: string;
      workflow: WorkflowConfig;
      graph: ResolvedGraph;
      structural: StructuralAnalysis;
      report?: PreflightReport;
      scanPhase?: string;
      scanError?: string;
    };

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ViewState>({ kind: "empty" });
  const [busy, setBusy] = useState(false);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      loadBytes(new Uint8Array(await file.arrayBuffer()), file.name);
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function loadBytes(bytes: Uint8Array, fileName: string) {
    const result = parseWorkflowBytes(bytes);
    if (!result.ok) {
      setState({ kind: "error", fileName, issues: result.issues });
      return;
    }
    const graph = resolveWorkflowGraph(result.workflow);
    setState({
      kind: "success",
      fileName,
      workflow: result.workflow,
      graph,
      structural: analyzeStructure(result.workflow, graph),
    });
  }

  function loadFixture(fixture: unknown, fileName: string) {
    loadBytes(new TextEncoder().encode(JSON.stringify(fixture)), fileName);
  }

  async function runServPreflight() {
    if (state.kind !== "success") return;
    setState({
      ...state,
      scanPhase: "Preparing safe workflow projection…",
      scanError: undefined,
    });
    await Promise.resolve();
    setState((current) =>
      current.kind === "success"
        ? { ...current, scanPhase: "Running SERV semantic review…" }
        : current,
    );
    try {
      const response = await fetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: state.workflow }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isPreflightReport(payload))
        throw new Error(readSafeApiMessage(payload));
      setState((current) =>
        current.kind === "success"
          ? { ...current, report: payload, scanPhase: undefined }
          : current,
      );
    } catch (error) {
      setState((current) =>
        current.kind === "success"
          ? {
              ...current,
              scanPhase: undefined,
              scanError:
                error instanceof Error
                  ? error.message
                  : "SERV semantic review could not be completed.",
            }
          : current,
      );
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Agent Preflight home">
          <span className="brand-mark">AP</span>
          <span>Agent Preflight</span>
        </a>
        <span className="read-only-badge">Read-only preflight</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">SERV Reasoning-powered workflow review</div>
        <h1>Know whether your agents make sense together.</h1>
        <p className="lede">
          Agent Preflight combines exact structural checks with semantic
          reasoning before execution. Start with one local{" "}
          <code>WorkflowConfig</code> JSON file.
        </p>

        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void onFileChange(event)}
        />
        <button
          className="upload-button"
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Checking…" : "Choose workflow JSON"}
        </button>
        <p className="limits">
          256 KiB maximum · No upload storage · No live workflow access · No
          mutation
        </p>
        <div className="demo-row" aria-label="Synthetic demo workflows">
          <span>Synthetic demos:</span>
          <button
            type="button"
            onClick={() =>
              loadFixture(semanticMismatch, "semantic-mismatch.demo.json")
            }
          >
            Semantic mismatch
          </button>
          <button
            type="button"
            onClick={() =>
              loadFixture(correctedControl, "corrected-control.demo.json")
            }
          >
            Corrected control
          </button>
        </div>
      </section>

      <section className="workspace" aria-live="polite">
        {state.kind === "empty" && <EmptyState />}
        {state.kind === "error" && (
          <ErrorState fileName={state.fileName} issues={state.issues} />
        )}
        {state.kind === "success" && (
          <SuccessState
            fileName={state.fileName}
            workflow={state.workflow}
            graph={state.graph}
            structural={state.structural}
            report={state.report}
            scanPhase={state.scanPhase}
            scanError={state.scanError}
            onRun={() => void runServPreflight()}
            onLocalCopy={(draft) =>
              loadBytes(
                new TextEncoder().encode(draft),
                "local-working-copy.json",
              )
            }
          />
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <span className="empty-icon">⌁</span>
      <h2>Your effective graph will appear here</h2>
      <p>
        Omitted edges become the client’s sequential route. An explicit empty
        edge list stays empty.
      </p>
    </div>
  );
}

function ErrorState({
  fileName,
  issues,
}: {
  fileName: string;
  issues: ValidationIssue[];
}) {
  return (
    <div className="result-panel error-panel">
      <div className="result-heading">
        <div>
          <span className="result-kicker">Input rejected</span>
          <h2>{fileName}</h2>
        </div>
        <span className="status status-error">Not scanned</span>
      </div>
      <ul className="issue-list">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.path}-${index}`}>
            <code>{issue.code}</code>
            <strong>{issue.path}</strong>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuccessState({
  fileName,
  workflow,
  graph,
  structural,
  report,
  scanPhase,
  scanError,
  onRun,
  onLocalCopy,
}: {
  fileName: string;
  workflow: WorkflowConfig;
  graph: ResolvedGraph;
  structural: StructuralAnalysis;
  report?: PreflightReport;
  scanPhase?: string;
  scanError?: string;
  onRun: () => void;
  onLocalCopy: (draft: string) => void;
}) {
  return (
    <div className="result-panel">
      <div className="result-heading">
        <div>
          <span className="result-kicker">Workflow overview</span>
          <h2>{workflow.name}</h2>
          <p>{fileName}</p>
        </div>
        <span
          className={`status ${structural.passed ? "status-ok" : "status-error"}`}
        >
          {structural.passed ? "Structure valid" : "Structure blocked"}
        </span>
      </div>
      <div className="summary-grid">
        <Metric label="Tasks" value={workflow.tasks?.length ?? 0} />
        <Metric label="Triggers" value={workflow.triggers?.length ?? 0} />
        <Metric label="Effective edges" value={graph.edges.length} />
        <Metric label="Edge mode" value={graph.edgeMode} />
      </div>
      <WorkflowGraph graph={graph} />
      <section className="checks-card" aria-labelledby="structural-title">
        <div className="graph-title-row">
          <div>
            <span className="result-kicker">Deterministic layer</span>
            <h3 id="structural-title">Structural checks</h3>
          </div>
          <strong>
            {structural.findings.length === 0
              ? "No structural blockers"
              : `${structural.findings.length} findings`}
          </strong>
        </div>
        {structural.findings.length === 0 ? (
          <p className="check-pass">
            The graph is structurally eligible for SERV semantic review.
          </p>
        ) : (
          <ul className="finding-list">
            {structural.findings.map((finding) => (
              <li key={finding.id}>
                <div>
                  <span className="finding-source">STRUCTURAL</span>
                  <code>{finding.code}</code>
                </div>
                <strong>{finding.title}</strong>
                <p>
                  {finding.evidence
                    .map((evidence) => evidence.identifier)
                    .join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="serv-gate">
        <div>
          <span className="result-kicker">Required semantic layer</span>
          <h3>SERV semantic review</h3>
          <p>A full preflight is never complete from graph validation alone.</p>
        </div>
        <button type="button" disabled={Boolean(scanPhase)} onClick={onRun}>
          {scanPhase ?? (report ? "Rescan with SERV" : "Run SERV Preflight")}
        </button>
      </section>
      {scanError && (
        <div className="scan-error" role="alert">
          <strong>SERV REVIEW INCOMPLETE</strong>
          <p>{scanError}</p>
          <p>Structural analysis only - SERV semantic review unavailable.</p>
        </div>
      )}
      {report && <PreflightReportView report={report} />}
      {report && (
        <CorrectionWorkspace original={workflow} onRescan={onLocalCopy} />
      )}
    </div>
  );
}

function isPreflightReport(value: unknown): value is PreflightReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    "statusLabel" in value
  );
}

function readSafeApiMessage(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  )
    return value.message;
  return "SERV semantic review could not be completed. Structural findings are preserved.";
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
