# Vendored GrantWright slices

Source checkout (private, sibling): `/mnt/external_storage/File/grantwright`

| File | Upstream |
|------|----------|
| `urlSafety.ts` | `grantwright/src/lib/urlSafety.ts` (full, dependency-free) |
| `htmlToText.ts` | extracted from `grantwright/src/lib/collect.ts` |

**Not vendored** (grant-domain coupled): `programs.ts`, `digestCompose.ts`, full `llm.ts`, full `skills.ts`, `LoginGate`.

Yanxi keeps China-specific compose/gate/heuristics locally. Re-sync these files when GW fixes SSRF/fetch bugs.
