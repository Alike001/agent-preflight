import type { ResolvedGraph } from "../shared/contracts";

export function WorkflowGraph({ graph }: { graph: ResolvedGraph }) {
  if (graph.nodes.length === 0) {
    return (
      <p className="graph-empty">
        The configuration contains no trigger or task nodes.
      </p>
    );
  }

  return (
    <section className="graph-card" aria-labelledby="graph-title">
      <div className="graph-title-row">
        <div>
          <span className="result-kicker">Effective route</span>
          <h3 id="graph-title">Resolved workflow graph</h3>
        </div>
        <span className={`mode mode-${graph.edgeMode}`}>
          {graph.edgeMode} edges
        </span>
      </div>

      <div className="node-grid">
        {graph.nodes.map((node) => (
          <article className={`node node-${node.kind}`} key={node.id}>
            <span>{node.kind}</span>
            <strong>{node.label}</strong>
            <code>{node.id}</code>
          </article>
        ))}
      </div>

      <div className="edge-list">
        <h4>Connections</h4>
        {graph.edges.length === 0 ? (
          <p className="graph-empty">
            No effective edges. An explicit <code>edges: []</code> is preserved.
          </p>
        ) : (
          graph.edges.map((edge) => (
            <div className="edge" key={edge.id}>
              <code>{edge.from}</code>
              <span className="edge-arrow">→</span>
              <code>{edge.to}</code>
              <span className="port">
                {edge.sourcePort} → {edge.targetPort}
              </span>
              <span className={`origin origin-${edge.origin}`}>
                {edge.origin}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
