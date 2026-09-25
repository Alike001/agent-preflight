import { useMemo, useState } from "react";
import type { WorkflowConfig } from "../shared/contracts";
import { lineChanges } from "./correction-diff";

export function CorrectionWorkspace({
  original,
  onRescan,
}: {
  original: WorkflowConfig;
  onRescan: (draft: string) => void;
}) {
  const originalText = useMemo(
    () => JSON.stringify(original, null, 2),
    [original],
  );
  const [draft, setDraft] = useState(originalText);
  const changes = lineChanges(originalText, draft);

  return (
    <section
      className="review-section correction-workspace"
      aria-labelledby="working-copy-title"
    >
      <div className="graph-title-row">
        <div>
          <span className="result-kicker">Local working copy</span>
          <h3 id="working-copy-title">Review, edit, then rescan</h3>
        </div>
        <span className="status status-warning">
          {changes.length} changed lines
        </span>
      </div>
      <p className="review-summary">
        Suggestions are never applied automatically. Edit this in-memory copy
        only after reviewing the evidence.
      </p>
      <label className="editor-label" htmlFor="local-workflow-copy">
        Local JSON working copy
      </label>
      <textarea
        id="local-workflow-copy"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
      />
      {changes.length > 0 && (
        <details className="diff-preview">
          <summary>Review before/after differences</summary>
          <div>
            {changes.slice(0, 40).map((change) => (
              <p key={`${change.line}-${change.before}-${change.after}`}>
                <strong>Line {change.line}</strong>
                <del>{change.before || "(empty)"}</del>
                <ins>{change.after || "(empty)"}</ins>
              </p>
            ))}
          </div>
        </details>
      )}
      <div className="action-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setDraft(originalText)}
        >
          Reset local copy
        </button>
        <button
          type="button"
          className="upload-button compact-button"
          onClick={() => onRescan(draft)}
        >
          Validate local copy
        </button>
      </div>
    </section>
  );
}
