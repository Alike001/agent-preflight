// All records here are synthetic controlled lab evidence, NOT real monitoring.
export const INCIDENTS = [
  {
    id: "LAB-502-001", title: "Checkout gateway returns 502 after deployment",
    service: "Checkout gateway", severity: "high", state: "investigating",
    source_label: "CONTROLLED SYNTHETIC LAB",
    description: "Checkout traffic began failing immediately after an upstream configuration change.",
    evidence: [
      {id:"ev-502",kind:"metric",time:"T+01",source:"Synthetic Prometheus",text:"gateway_http_requests_total{status=502} increased to 118 failures in 2 minutes."},
      {id:"ev-connection",kind:"log",time:"T+02",source:"Synthetic Loki",text:"connect() failed (111: Connection refused) while connecting to upstream checkout-api:3011."},
      {id:"ev-deploy",kind:"change",time:"T-03",source:"Synthetic deploy event",text:"Gateway upstream port changed from checkout-api:3001 to checkout-api:3011."},
      {id:"ev-health",kind:"metric",time:"T+03",source:"Synthetic Prometheus",text:"checkout-api:3001 readiness = 1; checkout-api:3011 TCP connection refused."}
    ],
    runbooks: [
      {id:"rb-502",title:"HTTP 502 after deployment",text:"Inspect upstream host and port, compare configuration changes, check proxy connection-refused logs, verify backend health. No autonomous remediation."},
      {id:"rb-recovery",title:"Verify recovery",text:"After operator-approved changes, check successful requests and healthy service metrics. An AI assertion is not recovery proof."}
    ]
  },
  {
    id: "LAB-DB-002", title: "Orders API times out during database fault",
    service: "Orders API", severity: "high", state: "investigating",
    source_label: "CONTROLLED SYNTHETIC LAB",
    description: "Order requests time out while the controlled database lab is unavailable.",
    evidence: [
      {id:"ev-latency",kind:"metric",time:"T+01",source:"Synthetic Prometheus",text:"orders_request_duration_seconds p95 rose from 0.18s to 9.2s."},
      {id:"ev-db-log",kind:"log",time:"T+02",source:"Synthetic Loki",text:"orders-api connect ECONNREFUSED db-lab:5432; connection pool exhausted."},
      {id:"ev-db-health",kind:"metric",time:"T+02",source:"Synthetic Prometheus",text:"pg_up{instance=db-lab:5432} = 0 during the incident."}
    ],
    runbooks: [
      {id:"rb-pg",title:"PostgreSQL connection triage",text:"Check db health, pool exhaustion, DNS and host reachability via read-only metrics. Do not restart services automatically."}
    ]
  }
];

export function getIncident(id) {
  return INCIDENTS.find((i) => i.id === id) ?? null;
}

function search(items, query, fields) {
  if (typeof query !== "string" || query.trim().length < 3 || query.length > 220)
    throw new Error("Query must contain 3 to 220 characters.");
  const terms = [...new Set(query.toLowerCase().replace(/[^a-z0-9.-]/g," ").split(/\s+/).filter((s) => s.length > 2))];
  return items.map((item) => ({
    item, matches: terms.filter((term) => fields.some((field) => String(item[field] ?? "").toLowerCase().includes(term))).length
  })).filter((x) => x.matches > 0).sort((a,b) => b.matches-a.matches).slice(0,5).map((x) => x.item);
}

export function labGatewayCall(input, incident) {
  if (!incident || !getIncident(incident.id)) throw new Error("Unknown lab incident.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid gateway call.");
  if (input.instance !== undefined) throw new Error("No instance may be set for built-in lab tools.");
  if (!input.args || typeof input.args !== "object" || Array.isArray(input.args)) throw new Error("Tool args must be an object.");
  const query = input.args.query;
  if (input.tool_name === "runbooks.search")
    return {source:"local-synthetic-runbooks", tool:"runbooks.search", results:search(incident.runbooks,query,["title","text"])};
  if (input.tool_name === "evidence.search")
    return {source:"local-synthetic-evidence", tool:"evidence.search", results:search(incident.evidence,query,["text","kind","source"])};
  throw new Error("Tool not on read-only allowlist.");
}

export function verifyReport(raw, incident) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Report JSON object required.");
  for (const f of ["summary","hypothesis","next_check"]) {
    if (typeof raw[f] !== "string" || raw[f].trim().length < 12 || raw[f].length > 1200)
      throw new Error("Invalid report field: " + f);
  }
  if (!Array.isArray(raw.evidence_ids) || raw.evidence_ids.length < 1 || raw.evidence_ids.length > 8)
    throw new Error("Report needs 1 to 8 evidence citations.");
  const ids = [...new Set(raw.evidence_ids)];
  if (ids.some((id) => typeof id !== "string" || !incident.evidence.some((e) => e.id === id)))
    throw new Error("Report cites nonexistent evidence.");
  if (raw.recovery_status !== "not_verified")
    throw new Error("AI cannot certify service recovery.");
  if (!["low","medium","high"].includes(raw.confidence))
    throw new Error("Invalid confidence label.");
  return {
    summary:raw.summary.trim(), hypothesis:raw.hypothesis.trim(), next_check:raw.next_check.trim(),
    confidence:raw.confidence, report_type:"hypothesis_not_confirmed",
    recovery_status:"not_verified", evidence_ids:ids,
    citations:incident.evidence.filter((e) => ids.includes(e.id)),
    warning:"Synthetic lab evidence. This is a hypothesis, not confirmed cause or recovery."
  };
}

export function demoReport(incident) {
  const checkout = incident.id === "LAB-502-001";
  return verifyReport({
    summary:checkout ? "Gateway connection refusals coincide with an upstream port change and HTTP 502 errors." : "Database connection failures coincide with a sharp increase in Order API latency.",
    hypothesis:checkout ? "The gateway may target port 3011 while the healthy backend is on port 3001." : "The order API may time out because its PostgreSQL dependency is unreachable.",
    next_check:checkout ? "Ask the operator to compare deployed upstream configuration against the service listener." : "Ask the operator to inspect independent database health checks and recent changes.",
    confidence:"medium",recovery_status:"not_verified",
    evidence_ids:checkout ? ["ev-connection","ev-deploy","ev-health"] : ["ev-db-log","ev-db-health","ev-latency"]
  },incident);
}
