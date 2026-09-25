# Implementation contract

The implementation follows the approved research specification in `openserv-labs-context/BUILD_SPEC.md`, amended on 2026-09-25 so SERV Reasoning is the central product capability.

## Required flow

1. Parse and validate one local OpenServ `WorkflowConfig` JSON file.
2. Reject oversized, complex, malformed, unsupported, or secret-bearing input.
3. Resolve explicit edges or the client-compatible implicit sequential graph.
4. Produce deterministic structural findings with application-owned codes.
5. Build a bounded, redacted semantic projection.
6. Make one server-side SERV request with a required system prompt.
7. Validate the structured response and its cited identifiers.
8. Merge structural and semantic evidence into one fail-closed report.
9. Keep every suggested correction human-reviewed and local-only.

The canonical response categories are handoff mismatch, missing prerequisite, capability mismatch, permission risk, contradiction, ambiguous responsibility, unsafe escalation, and insufficient evidence. SERV does not own canonical application codes or final combined status.

The UI may show preliminary structural results when SERV is unavailable, but the combined status must remain `SERV REVIEW INCOMPLETE`.
