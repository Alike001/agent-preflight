# Agent Preflight

Day 1 of the approved local-only MVP: validate a local OpenServ `WorkflowConfig` JSON file and preview its effective graph without accessing OpenServ or SERV.

## Requirements

- Linux or another Node-compatible platform
- Node.js 22.12.0 or newer
- npm 11 or newer

## Commands

```bash
npm install
npm run dev
npm run format:check
npm run typecheck
npm test
npm run build
```

Open the local URL printed by Vite, then upload one JSON file. Files are processed in browser memory only. Day 1 has no network integration, persistence, workflow mutation, or SERV request path.

## Supported input

The accepted subset and safety limits are defined in `../openserv-labs-context/BUILD_SPEC.md`. The canonical machine-readable schema is `src/input/workflow-config.schema.json`.
