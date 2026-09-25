import { useRef, useState, type ChangeEvent } from "react";
import { resolveWorkflowGraph } from "../graph/resolve";
import { parseWorkflowBytes } from "../input/parse-workflow";
import type {
  ResolvedGraph,
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
      setState({
        kind: "success",
        fileName: file.name,
        workflow: result.workflow,
        graph: resolveWorkflowGraph(result.workflow),
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
        <span className="read-only-badge">Read-only · Day 1</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">OpenServ workflow review</div>
        <h1>See the route before your agents run it.</h1>
        <p className="lede">
          Upload one local <code>WorkflowConfig</code> JSON file. We validate it
          in memory and resolve the exact explicit or client-default
          graph—without connecting to OpenServ.
        </p>

        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
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
          256 KiB maximum · No upload storage · No SERV request · No mutation
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
}: {
  fileName: string;
  workflow: WorkflowConfig;
  graph: ResolvedGraph;
}) {
  return (
    <div className="result-panel">
      <div className="result-heading">
        <div>
          <span className="result-kicker">Local structure accepted</span>
          <h2>{workflow.name}</h2>
          <p>{fileName}</p>
        </div>
        <span className="status status-ok">Schema valid</span>
      </div>
      <div className="summary-grid">
        <Metric label="Tasks" value={workflow.tasks?.length ?? 0} />
        <Metric label="Triggers" value={workflow.triggers?.length ?? 0} />
        <Metric label="Effective edges" value={graph.edges.length} />
        <Metric label="Edge mode" value={graph.edgeMode} />
      </div>
      <WorkflowGraph graph={graph} />
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
