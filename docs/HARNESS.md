# Yanxi — Cursor Harness

Yanxi uses Cursor’s agent harness in two layers: **in-repo** constraints and an optional **programmatic** SDK path.

## Layer 1 — Repository harness

| Artifact | Role |
|----------|------|
| `AGENTS.md` | Always-on agent entry: ethics, where to edit, verify commands |
| `.cursor/rules/*.mdc` | Soft constraints (civilian framing, skills-first, pipeline) |
| `.cursor/skills/` | Project skills for recurring agent tasks (e.g. add context card) |
| `.cursor/hooks.json` | Hook stub for future hard denies (permissions/hooks) |
| `skills/` | **Runtime** product skills composed into the briefing prompt (not Cursor-only) |

Hard guarantees still live in code: `src/lib/gate.ts` (quote substring, forbidden framing).

## Layer 2 — Programmatic harness (`@cursor/sdk`)

Optional. Requires `CURSOR_API_KEY`.

```bash
# Uses local Cursor agent against this repo to draft/refine a briefing from examples/sample-input.json
npm run harness:brief
```

Script: `scripts/cursor-harness-brief.ts`

- Runtime: **local** (`local: { cwd }`) — never silently assume cloud.
- Pattern: `Agent.prompt` one-shot for CI-like runs.
- Failure modes: distinguish `CursorAgentError` (did not start) vs `result.status === "error"` (run failed).
- Does **not** replace the Express `/api/brief` offline path; it is an alternate research loop for authors with Cursor access.

## Env summary

| Var | Purpose |
|-----|---------|
| _(none)_ | Offline briefing demo |
| `LLM_API_KEY` | Optional OpenAI-compatible chat for `/api/brief` |
| `CURSOR_API_KEY` | Optional Cursor SDK harness script |

## Ethics

Same redlines as `docs/ETHICS.md`. SDK agents inherit `AGENTS.md` + rules when running in this cwd.
