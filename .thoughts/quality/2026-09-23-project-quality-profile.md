# Project Quality Profile: Agent Preflight

## Detected Stack

Vite 8, React 19, TypeScript 7, Ajv 8, and Vitest 5 on Node.js 22.12 or newer.

## Existing Commands

- `npm run format:check`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Required Local Checks

Run formatting, type checking, unit tests, and a production build before each handoff.

## Required CI Gates

The same four commands are the future minimum CI gate. CI configuration is outside Day 1.

## Suggested Hooks

No hooks in Day 1. Add a fast format and type-check hook only after the command set is stable.

## File Size Policy

- Target: at most 200 source lines.
- Warning: above 200 source lines.
- Hard cap: above 300 source lines.
- Exclusions: generated output, fixtures, lockfiles, schema files, and vendored code.
- Escape hatch: document the reason before exceeding the cap.

## Commit Policy

No repository-specific commit convention was found. Do not add enforcement during the MVP.

## AGENTS.md Notes

Follow the repository-level read-only, no-live-workflow, and day-by-day authorization boundaries.

## Open Questions

CI provider and deployment host remain intentionally undecided.
