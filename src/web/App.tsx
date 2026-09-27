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
import { EmptyState, ErrorState, WorkflowWorkspace } from "./WorkflowWorkspace";

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
      setState((current) =>
        current.kind === "success"
          ? { ...current, scanPhase: "Validating SERV response…" }
          : current,
      );
      const payload: unknown = await response.json();
      if (!response.ok || !isPreflightReport(payload))
        throw new Error(readSafeApiMessage(payload));
      setState((current) =>
        current.kind === "success"
          ? { ...current, scanPhase: "Building preflight report…" }
          : current,
      );
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
        <h1>Catch broken agent handoffs before they run.</h1>
        <p className="lede">
          Upload an OpenServ workflow. Agent Preflight checks its structure,
          then uses SERV Reasoning to catch mismatched handoffs, missing
          prerequisites, and unjustified permissions before execution.
        </p>

        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void onFileChange(event)}
        />
        <div className="hero-actions">
          <button
            className="upload-button"
            type="button"
            onClick={() =>
              loadFixture(semanticMismatch, "semantic-mismatch.demo.json")
            }
          >
            Try broken workflow
          </button>
          <button
            className="secondary-button hero-upload-button"
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Checking…" : "Upload workflow JSON"}
          </button>
        </div>
        <p className="limits">
          256 KiB maximum · No upload storage · No live workflow access · No
          mutation
        </p>
        <div className="demo-row" aria-label="Synthetic demo workflows">
          <span>After the broken example:</span>
          <button
            type="button"
            onClick={() =>
              loadFixture(correctedControl, "corrected-control.demo.json")
            }
          >
            View corrected workflow
          </button>
        </div>
        <ol className="product-steps" aria-label="How Agent Preflight works">
          <li>
            <span>1</span>
            <strong>Check structure</strong>
          </li>
          <li>
            <span>2</span>
            <strong>SERV checks meaning</strong>
          </li>
          <li>
            <span>3</span>
            <strong>Review and repair</strong>
          </li>
        </ol>
      </section>

      <section className="workspace" aria-live="polite">
        {state.kind === "empty" && <EmptyState />}
        {state.kind === "error" && (
          <ErrorState fileName={state.fileName} issues={state.issues} />
        )}
        {state.kind === "success" && (
          <WorkflowWorkspace
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
