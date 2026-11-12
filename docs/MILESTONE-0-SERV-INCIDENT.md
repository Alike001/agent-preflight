# SERV Incident Lab — staged Akmatori integration

Date: 12 November 2026

This is a **temporary staging branch**, separate from the `hackathon-os` main branch.

## Scope of first vertical slice

- A read-only incident investigation desk with explicit **synthetic lab evidence**.
- Server-side SERV Reasoning used for consequential tool selection and an evidence-based report.
- A local **simulated** gateway (not Akmatori MCP Gateway): no SSH, Kubernetes, remediation, secrets, or customer data.
- Deterministic output validation: never present an unsupported evidence ID or model-declared recovery as verified.
- Public view-only demo; paid SERV requests disabled until dedicated server-side credentials and a test token are configured.
- HTTP health check, unit/integration tests, and one Render web service.

## No-go boundary

This milestone **does not** claim end-to-end Akmatori integration or real Grafana/Prometheus/Loki evidence. Those remain separate gates. The upstream Akmatori source and any Zcash containers are untouched.

## Hosting and secrets

- Temporary source location: GitHub `Alike001/hackathon-os` branch `serv-incident-lab-staging`.
- Target is a free Render Node web service with no database or payments.
- Do not put `SERV_API_KEY` in GitHub, frontend files or chat; supply it only through Render environment settings.
- `STAGING_ACCESS_TOKEN` additionally gates live inference to avoid public credit abuse.
- Later migrate into a dedicated **public** repository before competition submission.
