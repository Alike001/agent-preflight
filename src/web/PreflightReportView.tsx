import type { PreflightFinding, PreflightReport } from "../shared/contracts";
import {
  serializeJsonReport,
  serializeMarkdownReport,
} from "../results/reports";

export function PreflightReportView({ report }: { report: PreflightReport }) {
  return (
    <section className="preflight-report" aria-labelledby="combined-status">
      <div className={`decision-banner decision-${report.status}`}>
        <div>
          <span className="result-kicker">Combined preflight status</span>
          <h3 id="combined-status">{report.statusLabel}</h3>
        </div>
        <p>{report.readOnlyDeclaration}</p>
      </div>

      <section className="review-section" aria-labelledby="serv-review-title">
        <div className="graph-title-row">
          <div>
            <span className="finding-source serv-source">SERV REASONING</span>
            <h3 id="serv-review-title">SERV Semantic Review</h3>
          </div>
          <span
            className={`status ${report.semantic.completed ? "status-ok" : "status-error"}`}
          >
            {report.semantic.completed
              ? "Validated response"
              : "Review incomplete"}
          </span>
        </div>
        <p className="review-summary">{report.semantic.summary}</p>
        {report.semantic.findings.length > 0 && (
          <FindingList findings={report.semantic.findings} />
        )}
      </section>

      <section className="review-section" aria-labelledby="repair-title">
        <span className="result-kicker">Human-controlled next step</span>
        <h3 id="repair-title">Repair plan</h3>
        {report.findings.some((finding) => finding.suggestedFix) ? (
          <FindingList
            findings={report.findings.filter((finding) => finding.suggestedFix)}
            showFix
          />
        ) : (
          <p className="review-summary">
            No correction is proposed. Review the evidence before execution.
          </p>
        )}
        <p className="not-applied">
          Not applied · Suggestions affect no live workflow.
        </p>
      </section>
      <section className="review-section" aria-labelledby="export-title">
        <span className="result-kicker">Portable evidence</span>
        <h3 id="export-title">Export report</h3>
        <p className="review-summary">
          Reports contain the input fingerprint and reviewed evidence, never the
          original upload or credentials.
        </p>
        <div className="action-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              download(
                "agent-preflight-report.json",
                serializeJsonReport(report),
                "application/json",
              )
            }
          >
            Download JSON
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              download(
                "agent-preflight-report.md",
                serializeMarkdownReport(report),
                "text/markdown",
              )
            }
          >
            Download Markdown
          </button>
        </div>
      </section>
    </section>
  );
}

function download(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FindingList({
  findings,
  showFix = false,
}: {
  findings: PreflightFinding[];
  showFix?: boolean;
}) {
  return (
    <ul className="finding-list detailed-findings">
      {findings.map((finding) => (
        <li key={`${showFix ? "fix" : "finding"}-${finding.id}`}>
          <div className="finding-heading">
            <span className="finding-source serv-source">
              {finding.source === "serv" ? "SERV REASONING" : "STRUCTURAL"}
            </span>
            <code>{finding.code}</code>
            <span className={`severity severity-${finding.severity}`}>
              {finding.severity}
            </span>
          </div>
          <strong>{finding.title}</strong>
          <p>{showFix ? finding.suggestedFix : finding.rationale}</p>
          {!showFix && (
            <ul className="evidence-list">
              {finding.evidence.map((evidence) => (
                <li key={`${finding.id}-${evidence.identifier}`}>
                  <code>{evidence.identifier}</code> — {evidence.explanation}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
