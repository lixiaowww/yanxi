# Canada nexus（读者关注关联）

Civilian flag so analysts can **spot** public Mandarin items that name Canada or sit next to topics Canadians often track. **Not** personal targeting.

## Levels

| Level | Meaning | UI / outbox |
|-------|---------|-------------|
| `direct` | Paste names 加拿大 / 加方 / Ottawa / CUSMA… | Badge **CA**, title prefix `[CA]`, slight P-score bump |
| `possible` | Adjacency only (北极, 关键矿产, 菜籽, CPTPP, G7…) | Badge **CA?**, prefix `[CA?]`, tiny bump |
| `none` | No cue | Hidden |

## Where it shows

1. Briefing JSON field `canada_nexus` (deterministic, every run)
2. UI panel under triage when level ≠ none
3. Outbox markdown + RSS title sort (direct → possible → other)

## Lexicon

Maintained in `src/lib/canada-nexus.ts`. Expand cues there; keep framing `civilian-reader-interest-flag` + `tag: hypothesis`.

## Demo fixtures

- `examples/domains/canada-nexus.json` → direct  
- `examples/domains/canada-possible.json` → possible  
