# Confidence, corroboration, Canada policy link, social class

## Factorized confidence

Field: `confidence_factors` (also mirrors to `briefing_en.confidence`).

| Factor | Cap rule |
|--------|----------|
| signaling band | baseline |
| substance `thin` | ≤ medium |
| corroboration &lt; 2 | ≤ medium |
| corroboration = 0 | ≤ low |
| `social_commentary` | **hard low** |
| weak provenance + would-be high | ≤ medium |
| **source_tier** (curated) | A/B ≤ high · C/U ≤ medium · D ≤ low |

Confidence = evidence quality for the **draft**, not P(event).

## Curated source tiers (hypothesis priors)

Field: `confidence_factors.source_tier` · code `src/lib/source-tier.ts`.

**Not** ML-fitted from scrape/engagement history — ordinal research weights only.

| Tier | Weight | Max conf | Typical sources |
|------|--------|----------|-----------------|
| A | 1.0 | high | 通知/办法/细则 (`policy_instrument`) |
| B | 0.75 | high | 官方/通稿 (`official_or_wire`) |
| C | 0.45 | medium | 报刊评论；公开智库线索 |
| D | 0.1 | **low** | 社交转述 (`social_commentary`) |
| U | 0.35 | medium | 未分类公开文本 |

Weight contributes a small blend term to `score_0_to_1`; **caps** enforce tier max.

## Corroboration (0–3)

`corroboration.score_0_to_3` + `missing[]` (缺什么源/工具)。

- 0–1: single-source / thin  
- 2: meeting+instrument or dual source  
- 3: strong cross-cues (numeric/dense + sequence)

## Clickable public refs

`canada_policy_link.hits[].public_refs` are now `{ title, url, publisher }` objects
pointing at Justice Laws / GAC / CBSA / Canada.ca entry points. UI renders them as links.
Still **not legal advice** — human verifies current consolidated text.

Catalog helper: `listCanadaPolicyCatalog()` (also on Portfolio page).

## Social commentary

Detected cues: 李老师、twitter/x、微博、网传、自媒体…  
Or API `sourceClass: "social_commentary"`.

- **Not** added to whitelist auto-collect  
- Paste-only; confidence hard-capped  
- Open question forces primary-source check  

Code: `src/lib/confidence.ts`, `source-tier.ts`, `canada-policy-link.ts`, `source-class.ts`
