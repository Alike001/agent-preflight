# Agent Preflight architecture

Agent Preflight is a SERV Reasoning-powered preflight reviewer for agent workflows. Deterministic validation protects the input boundary and proves graph facts; SERV supplies the central semantic judgment that graph validation cannot.

```mermaid
flowchart TD
  A[Workflow JSON] --> B[Parse and schema validation]
  B --> C[Deterministic structural checks]
  C --> D[Secret, size, and complexity safety]
  D --> E[Bounded semantic projection]
  E --> F[SERV Reasoning API]
  F --> G[Schema-validated semantic findings]
  G --> H[Combined human-reviewable report]
  H --> I[Local-only repair plan]
  I --> J[User-controlled rescan]
```

A completed preflight requires SERV. If SERV is unavailable, deterministic findings remain visible but the status is `SERV REVIEW INCOMPLETE`. The application never connects to or mutates a live OpenServ workflow.
