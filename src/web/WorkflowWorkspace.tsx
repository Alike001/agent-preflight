import type {
  PreflightReport,
  ResolvedGraph,
  StructuralAnalysis,
  ValidationIssue,
  WorkflowConfig,
} from "../shared/contracts";
import { CorrectionWorkspace } from "./CorrectionWorkspace";
import { PreflightReportView } from "./PreflightReportView";
import { WorkflowGraph } from "./WorkflowGraph";

export function EmptyState() {
  return (
    <div className="empty-state">
      <span className="empty-icon">⌁</span>
      <h2>A valid graph can still contain a broken workflow.</h2>
      <p>
        Try the broken example. Its nodes and connections pass structural
        checks, then SERV reviews whether the agents can actually work together.
      </p>
    </div>
  );
}

export function ErrorState({
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

export function WorkflowWorkspace({
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
          className={`status ${workflowStatusClass(structural, report, scanPhase, scanError)}`}
        >
          {workflowStatusLabel(structural, report, scanPhase, scanError)}
        </span>
      </div>
      <div className="summary-grid">
        <Metric label="Tasks" value={workflow.tasks?.length ?? 0} />
        <Metric label="Triggers" value={workflow.triggers?.length ?? 0} />
        <Metric label="Effective edges" value={graph.edges.length} />
        <Metric label="Edge mode" value={graph.edgeMode} />
      </div>
      <WorkflowGraph graph={graph} />
      <StructuralChecks structural={structural} />
      <section className="serv-gate">
        <div>
          <span className="result-kicker">Required semantic layer</span>
          <h3>Does this workflow actually make sense?</h3>
          <p>
            SERV checks whether each agent receives what it needs, hands off
            usable output, and has permissions justified by its task.
          </p>
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

function StructuralChecks({ structural }: { structural: StructuralAnalysis }) {
  return (
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
          Graph shape is valid. Semantic preflight is still required.
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
  );
}

function workflowStatusLabel(
  structural: StructuralAnalysis,
  report: PreflightReport | undefined,
  scanPhase: string | undefined,
  scanError: string | undefined,
): string {
  if (!structural.passed) return "STRUCTURE BLOCKED";
  if (scanPhase) return "SERV REVIEW RUNNING";
  if (report) return report.statusLabel;
  if (scanError) return "SERV REVIEW INCOMPLETE";
  return "STRUCTURE VALID · SERV REQUIRED";
}

function workflowStatusClass(
  structural: StructuralAnalysis,
  report: PreflightReport | undefined,
  scanPhase: string | undefined,
  scanError: string | undefined,
): string {
  if (!structural.passed) return "status-error";
  if (scanPhase) return "status-running";
  if (scanError) return "status-error";
  if (!report) return "status-pending";
  if (report.status === "ready_for_review") return "status-ok";
  if (report.status === "warnings_found") return "status-warning";
  return "status-error";
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
