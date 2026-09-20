---
name: add-context-card
description: Add or revise a Yanxi China context card under skills/context-cards with correct frontmatter and background-only discipline.
---

# Add a context card

## When to use

User asks to teach Yanxi a new political / historical / cultural term set, or to expand policy analysis coverage.

## Steps

1. Create `skills/context-cards/<kebab-name>.md`.
2. Frontmatter must include (Civic Ontology Lite):
   - `name:` short id
   - `type:` one of `institution` | `lexicon` | `history_frame` | `intl_compare` | `method`
   - `desk:` `all` or comma-separated desk ids (`overall_goals`, `economy_investment`, `foreign_affairs`, `defense_public`, `social_governance`)
   - `match:` space-separated `"关键词"` quoted strings (Mandarin terms that trigger the card)
   - `description:` one line
   - `tag:` `background` or `hypothesis`
   - `updated:` YYYY-MM-DD
   - `sources:` short public provenance note (not classified claims)
3. Body: background glosses only. State **Discipline:** do not invent policy decisions.
4. If the card supports outlooks, remind that scenarios are `hypothesis`.
5. Run `npm run demo` (or a paste containing the new keywords) and confirm the card appears in `ontology_lite.hits` / `matchedCards`.
6. Mention the card in `docs/ROADMAP.md` only if it is a milestone deliverable.
7. See `docs/ONTOLOGY-LITE.md` for matching rules (desk affinity, max 8 cards).

## Template

```markdown
---
name: example-card
type: lexicon
desk: economy_investment
match: "关键词一" "关键词二"
description: Background gloss for …
tag: background
updated: 2026-09-20
sources: Public open vocabulary (unspecified official series)
---

# Context card: …

Use only when the source already uses these terms.

| Term | Plain English gloss (background) |
|------|----------------------------------|
| … | … |

**Discipline:** Gloss ≠ confirmation of intent. Outlooks stay tagged hypothesis.
```
