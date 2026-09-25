import { useRef, useState, type ChangeEvent } from "react";
import { analyzeStructure } from "../analysis/structural";
import { resolveWorkflowGraph } from "../graph/resolve";
import { parseWorkflowBytes } from "../input/parse-workflow";
import type {
  ResolvedGraph,
  StructuralAnalysis,
  ValidationIssue,
  WorkflowConfig,
} from "../shared/contracts";
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
      const result = parseWorkflowBytes(
        new Uint8Array(await file.arrayBuffer()),
      );
      if (!result.ok) {
        setState({ kind: "error", fileName: file.name, issues: result.issues });
        return;
      }
      const graph = resolveWorkflowGraph(result.workflow);
      setState({
        kind: "success",
        fileName: file.name,
        workflow: result.workflow,
        graph,
        structural: analyzeStructure(result.workflow, graph),
      });
    } finally {
      setBusy(false);
      event.target.value = "";
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
}: {
  fileName: string;
  workflow: WorkflowConfig;
  graph: ResolvedGraph;
  structural: StructuralAnalysis;
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
        <button type="button" disabled>
          Run SERV Preflight
        </button>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
