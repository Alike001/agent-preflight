# SERV Incident Lab

**A read-only incident investigation desk where AI hypotheses remain separate from source evidence and verified service recovery.**

## How to test — start here

1. Open the deployment URL and select one of the two incident scenarios.
2. Check the source evidence cards and their IDs.
3. Observe that the initial report is explicitly labeled a prewritten synthetic demonstration: it DOES NOT call SERV.
4. The recovery status must say not verified, even when the model's hypothesis is persuasive.
5. To demonstrate a REAL SERV inference, the operator must configure SERV_API_KEY and STAGING_ACCESS_TOKEN as secret Render environment variables.
6. Enter only the staging access token (NOT your SERV API key) in the browser. Click Run SERV investigation.
7. Inspect the returned model, completion IDs, diagnostic gateway_call selection, source count, and evidence-linked report.
8. Invalid credentials, an unavailable SERV API, a fabricated evidence ID, or a tool outside the allowlist must fail visibly.

**No user account, wallet, faucet, or customer infrastructure is needed for the controlled lab demo.**

## Honest project status

This is an original companion proof-of-concept inspired by the existing Akmatori incident workflow. It is NOT an Akmatori fork, and does not currently call Akmatori's actual MCP Gateway, Grafana, Prometheus, or Loki. Everything in the incident queue is synthetic and labeled as such.

The fully integrated Akmatori/SERV incident workflow and independently observed recovery remain separate unfinished milestones. We will not claim them prematurely.

## What is real here?

- Real server-side OpenServ Chat Completions API support.
- Automatic tool selection using the same generic gateway_call shape used by Akmatori.
- A real application-side tool execution loop, but the tool implementations search synthetic local lab data.
- A second SERV request uses the actual returned local tool results.
- Deterministic schema and evidence-ID validation.
- Explicit refusal to accept an AI declaration of service recovery.
- Read-only allowlist that excludes SSH, Kubernetes, shell commands, transfers, and remediation.
- Browser dashboard with incident selection, evidence detail, model report, and trace.
- Automated tests and a Render-compatible Node server.

Prompt Guard, Shadow Agent, persistent incident storage, production alert ingestion, and real metrics/log connectors have NOT yet been implemented.

## Local use (Node 22 or newer)

Run these commands in the project folder:

    npm run check
    npm test
    npm start

Then visit http://localhost:3000.

No third-party npm runtime dependencies, Docker daemon, database, payments, or wallet are necessary for this lab slice.

## Render deployment

- Runtime: Node
- Free plan is sufficient for the controlled lab
- Build: npm run check && npm test
- Start: npm start
- Health endpoint: /healthz

Server-only secrets:

- SERV_API_KEY: your real SERV Reasoning API key (do not put it in Git, HTML, JavaScript, or chat).
- STAGING_ACCESS_TOKEN: a separate long random access token the operator controls.
- SERV_MODEL (optional): gpt-5.4-mini.

Without BOTH secrets, live inference remains disabled. The public view-only demo still works, so nobody can spend your credits anonymously.

Live calls are limited to four authorized requests per ten minutes per server-process IP; this is a staging safeguard, not production multi-tenant abuse protection. The application does not store tokens in the browser or return them from APIs.

## Engineering boundaries

Every record includes a synthetic source label. We only accept one tool call per live request: runbooks.search or evidence.search against known lab records. A model response is rejected if it references nonexistent evidence or claims independently verified recovery. A zero-execution model response is treated as failure, not substituted with a demo completion.

There is no untrusted customer data ingestion, access to production environments, automatic remediation, or status certification.

## Source / attribution

The original open-source incident platform is [Akmatori](https://github.com/akmatori/akmatori), Apache-2.0. No Akmatori application code is copied into this staging demo.

SERV API: https://docs.openserv.ai/serv-reasoning/api/chat-completions

This temporary private research branch is not the final hackathon submission. We need a dedicated public repo, a meaningful full integration, source-of-truth monitoring proof, and the organizer's eligibility/entry confirmation before claiming that status.

## Progress

- M0: isolated temporary branch and scope — complete.
- M1: controlled synthetic incident desk + SERV connector + tests — implementation committed, live platform deployment to be verified.
- M2: actual Akmatori Gateway/Grafana integration and durable incident record — pending.
- M3: Prompt Guard, Shadow Agent, benchmarks, final demo and public submission — pending.
