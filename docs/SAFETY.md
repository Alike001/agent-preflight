# Privacy and safety boundary

Agent Preflight is read-only decision support. It does not authenticate to OpenServ, inspect a live workflow, call `workflows.sync()`, deploy, execute agents, or perform onchain actions.

## Input boundary

- Uploads are limited to 256 KiB, valid UTF-8, nesting depth 12, and 5,000 JSON values.
- The strict JSON Schema rejects unknown workflow fields and unsupported shapes.
- High-confidence credentials, bearer tokens, private keys, seed phrases, passwords, cookies, JWTs, and credential-bearing URLs are rejected before SERV.
- Raw uploads, prompts, and model responses are not logged or persisted.

## SERV boundary

- Only the bounded semantic projection is sent.
- Projection fields have per-field limits and a 65,536-byte total limit.
- One user-initiated scan can make exactly one request; the SDK has `maxRetries: 0` and a 30-second timeout.
- The API key is read only from server-side `SERV_API_KEY`.
- Session, source-IP, global request, and conservative global spending caps fail closed.
- Structured output is validated against JSON Schema and evidence identifiers must match the submitted projection.
- Unsafe or mutating suggestions invalidate the complete SERV result.

## Human boundary

Suggested corrections are displayed as `Not applied`. A user may edit an in-memory working copy, inspect its line diff, and rescan it. No source file or live workflow is overwritten.

## Known limitations

- Reviews only supplied local configuration evidence.
- Task text may explicitly declare capabilities or permissions, but native `WorkflowConfig` does not provide a complete authority inventory.
- No runtime logs, remote metadata, deployed behavior, or hidden tools are observed.
- A clean review does not prove a workflow is safe.
- Rate and spending counters use an in-memory, single-instance store; multi-instance deployment requires a shared atomic implementation.
