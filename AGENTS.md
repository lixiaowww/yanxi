# AGENTS.md — Yanxi

Civilian open-source Mandarin → English contextual briefing. Not an intelligence product.

## Before any change

1. Read `docs/ETHICS.md`. Never add SIGINT / espionage / classified-capability framing.
2. Prefer editing Markdown skills under `skills/` over hard-coding domain prose in TypeScript.
3. Keep default path **offline**; LLM and Cursor SDK are optional (`LLM_API_KEY` / `CURSOR_API_KEY`).
4. Quotes in `source_digest_zh` must be substrings of the user paste or gate hard-fails.

## Product invariants

- Input: public Mandarin text the user is allowed to use.
- Output: draft briefing for **human review** — `background` / `hypothesis` tags required on context notes.
- Policy outlook is **scenario + watchpoints**, never “will definitely happen”.
- UI / README / demo copy: no Command Center, Upload Intelligence, or spy-tool language.

## Where to work

| Change type | Location |
|-------------|----------|
| Domain vocabulary / China context | `skills/context-cards/*.md` |
| Briefing method / honesty | `skills/briefing-writer/SKILL.md` |
| Hard redlines | `skills/ethics-sandbox/SKILL.md` + `src/lib/gate.ts` |
| Pipeline orchestration | `src/lib/pipeline.ts` |
| Cursor agent rules | `.cursor/rules/*.mdc` |
| Programmatic Cursor agent | `scripts/cursor-harness-brief.ts` |

## Verify

```bash
npm run lint && npm run demo
```

## Docs root

Product narrative lives in `docs/`. Scope is constrained by `docs/JOB-FIT.md` (civilian mapping only). Update PRD/ROADMAP when scope changes.
