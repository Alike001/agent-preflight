# Opsra — verified research, product scope and release gates

Research reviewed: **12 November 2026**. Working title Opsra. Public proof-of-concept: https://serv-incident-lab-staging.onrender.com.

## Customer and problem

Primary user: on-call engineers at small software teams running production APIs, especially teams already using Grafana. Their work involves detecting 5xx errors, correlating logs and metrics, forming hypotheses, finding a safe next diagnostic check and validating recovery.

This is a real category, but demand, willingness to pay, reduction in time-to-diagnosis and differentiation for this specific product have **not been validated with users**. We must not claim them.

## Existing product archaeology

Akmatori (Apache-2.0): https://github.com/akmatori/akmatori . It already offers alert intake, agent investigation, runbook search, a gateway, persistence, dashboards and approval-gated remediation. Do **not** recreate or rebrand its entire feature set; build a narrowly differentiated read-only, evidence-grounded extension and attribute ideas/source.

Other existing products include incident.io, Rootly and PagerDuty. Root-cause suggestions and incident timelines themselves are NOT novel. Our testable hypothesis: stricter source-citation enforcement, explicit uncertain/verified states, and safe operator-directed diagnostics yield a more trustworthy workflow.

## Architecture decision

Long-term targeted flow:
1. Genuine monitoring alert from a controlled, running service.
2. Read-only monitoring queries with a fixed allowlist.
3. SERV selects relevant tool using its real function-calling API.
4. Authorized gateway executes the selected tool and records exact result and timestamp.
5. SERV drafts an explanation.
6. Deterministic verifier rejects fake citations and unauthorized/unsupported conclusions.
7. Operator reviews the next action; external health/recovery signal determines recovery.
8. Durable trace allows a judge to replay the evidence.

**Current milestone:** only a synthetic lab desk and real-compatible SERV backend are implemented. The real SERV API has been exercised successfully from a local terminal (HTTP 200, forced/automatic tool selection). The deployed server's real SERV path is still unverified because credentials are not set. The published GitHub tests use a stub transport.

## Source-code integration preflight

- Akmatori's custom provider can target OpenAI-compatible Chat Completions, but its pi-agent *runtime* and exact tool schemas remain to be tested end to end. Source: agent-worker/src/agent-runner.ts and gateway-tools.ts at upstream SHA 452cc454799351a335e07cc5953a2686e31ce134.
- Alert extraction currently passes an empty system prompt to OneShotLLM. SERV requires a non-empty system/developer prompt. Source: internal/alerts/extraction/extractor.go line 182; https://docs.openserv.ai/serv-reasoning/introduction . This requires a code fix plus regression test before calling Akmatori integrated.
- The built-in runbooks.search uses a query. Logical instance should be omitted for built-in tools; any instance must be configured/grounded.
- SERV Prompt Guard and Shadow Agent are opt-in SERV tool declarations intercepted on the server. These features have **not** been implemented here, and neither substitutes independent evidence checks. Docs: https://docs.openserv.ai/serv-reasoning/tools .
- Grafana read-only querying and webhook ingestion are plausible as existing Akmatori connector features but have **not** been executed in our hosted application. The current registry includes Grafana writes; they must be disabled/denied.
- Full Akmatori requires PostgreSQL, Go API, Node agent, gateway, frontend, proxy and init. A single free Render web service cannot host the unmodified stack. We need an explicit split deployment or a narrower original companion app. Do not call the Node-only proof an Akmatori deployment.

## Near-term implementation gates

| Gate | Acceptance | Today |
|---|---|---|
| G0 Clean isolated cloud staging | Separate Git branch and URL, tests running | PASS: 17 automated tests and live Render deployment |
| G1 SERV request from cloud | Real SERV key set as secret, real tool call and final response recorded | PENDING (server key not configured) |
| G2 Genuine observable controlled fault | Actual HTTP failure observed with timestamp/status/duration, clearly labeled lab | IN PROGRESS |
| G3 Independent evidence read | Real monitoring source (e.g., Grafana metrics/logs) accessible through read-only integration | NOT DONE |
| G4 End-to-end original gateway | Akmatori gateway call via real worker and durable case result | NOT DONE |
| G5 Security | No write tools, SSRF, prompt-injection privilege escalation or credential exposure | Partial tests only |
| G6 Meaningful SERV performance | Baseline vs SERV correctness/time/tool calls, same held-out scenarios | NOT DONE |
| G7 Product-readiness | Working UI paths, single URL, persistence, user testing and mobile review | NOT DONE |
| G8 Submission | Public dedicated repository, video, README, X post, eligibility check | NOT DONE |

## UI/UX requirements

- Operator workspace before landing-page marketing.
- Visible source labels (fixture, live lab probe, actual monitored signal) on every card.
- Every user-visible control must do something, not just look clickable.
- Clear lifecycle: Alerted -> Investigating -> Awaiting operator -> Monitoring recovery -> Recovered (only on independent proof).
- Actual query inputs, timestamps, trace IDs and individual source evidence are inspectable.
- Loading, timeout, error, unauthenticated and no-data states are designed, not hidden.
- Read-only first; no SSH, Kubernetes or automated remediation in version one.
- Keyboard usability, mobile widths 320–768, sufficient contrast and no simulated payment/transaction claims.

## Research risks still unproven

- Customer interview demand and willingness to pay.
- Actual Grafana connection and full upstream Gateway hosting cost.
- SERV inference cost, operational limits, retry rules and total demo budget.
- Official eligibility details (Nigeria/team/AI assistance) and submission form availability.
- Name: Opsra is already used for a Framer AI operating-system template, so a full branding clearance is outstanding.
- Storage durability and authentication for a multi-user production service.

## Hard release conditions

- No marketing of synthetic inputs as production telemetry.
- No claim of actual Grafana or Akmatori connection until a real integration test runs.
- No claim that service recovery happened unless supported by an independent signal.
- No secret keys in public source, environment dumps, logs or screenshots.
- No copy of unlicensed third-party code. Preserve Apache-2.0 attribution if including Akmatori source.
- No deployment of public paid SERV endpoint without private access control.
- No promise that all blockers are eliminated; provide measured outcomes and explicit open risks.

## References
- https://github.com/akmatori/akmatori
- https://github.com/akmatori/akmatori/blob/452cc454799351a335e07cc5953a2686e31ce134/internal/alerts/extraction/extractor.go
- https://docs.openserv.ai/serv-reasoning/introduction
- https://docs.openserv.ai/serv-reasoning/tools
- https://www.openserv.ai/hackathon-2
- https://www.framer.com/marketplace/templates/opsra/
