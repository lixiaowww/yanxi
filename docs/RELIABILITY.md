# Confidence, corroboration, Canada policy link, social class

## What these bands are — and what they are not

Everything on this page is produced by **hand-written rules with hand-set thresholds**. There is no
labelled corpus in this repo, no fitted parameters, and no held-out evaluation. None of it is a
measurement of reliability, and none of it is a probability.

What the bands do: **order and flag** pastes so a human reviewer knows what to read first and what
still needs a second public source. What they do not do: tell you how trustworthy a source is, or
how likely a policy is to land.

Because a decimal invites trust it has not earned, every human-facing surface — UI chips and panels,
the portfolio page, generated Markdown briefs and desk reports — prints an **ordinal band plus a
short basis clause** (which cue types were detected, how many sources were compared). No decimals,
no `x/3` figures.

The internal numbers still exist, because ordering and thresholding need them:

| Internal field | Used for |
|----------------|----------|
| `substance_cut.substance_score_0_to_1` · `boilerplate_ratio_0_to_1` | thin / mixed / dense thresholds |
| `corroboration.score_0_to_3` | corroboration band + confidence caps |
| `confidence_factors.score_0_to_1` | debug blend only |
| `source_tier.weight_0_to_1` | one small term in that blend |
| `signaling_scorecard.weighted_total` · `weight_sum` | low / medium / high band |

They stay visible in the **Raw JSON** toggle, which is an inspection surface, not a claim.
Band-and-basis rendering helpers live in `src/lib/score-bands.ts`.

## Factorized confidence

Field: `confidence_factors` (also mirrors to `briefing_en.confidence`).

| Factor | Cap rule |
|--------|----------|
| signaling band | baseline |
| substance `thin` | ≤ medium |
| single source, not cross-checked | ≤ low |
| no shared subject across sources | ≤ medium |
| `social_commentary` | **hard low** |
| weak provenance + would-be high | ≤ medium |
| **source_tier** (stated prior) | A/B ≤ high · C/U ≤ medium · D ≤ low |

Confidence = evidence quality for the **draft**, not P(event). The UI prints the level with the
bands and caps that produced it, e.g. *"Confidence medium — from verifiable detail dense,
corroboration minimal, signaling cues high, source tier U (stated editorial prior); weak provenance
holds it at medium."*

## Source tiers = stated editorial priors

Field: `confidence_factors.source_tier` · code `src/lib/source-tier.ts`.

The tier letter, the ordering A > B > C > U > D, and the confidence cap are **stated editorial
priors**: one analyst's ranking of how citable a kind of public source is. They are not fitted
weights, and there is no validation set behind them. They are defensible as editorial judgement —
and only as that.

| Tier | Max conf | Stated prior | Typical sources |
|------|----------|--------------|-----------------|
| A | high | most citable public record | 通知/办法/细则 (`policy_instrument`) |
| B | high | attributable, but not the instrument itself | 官方/通稿 (`official_or_wire`) |
| C | medium | interprets a decision rather than recording it | 报刊评论；公开智库线索 |
| D | **low** | cannot alone corroborate an official claim | 社交转述 (`social_commentary`) |
| U | medium | readable, not enough on its own to reach high | 未分类公开文本 |

Each tier carries `prior_basis_en` (the clause a reader sees) and `prior_kind:
"stated-editorial-prior"`. `weight_0_to_1` stays in the JSON as the internal ordering number for the
confidence blend; it is never rendered. The **caps** are what actually constrain output.

## Corroboration (band)

`corroboration` answers one question: do distinct public sources cross-check each other on the same
subject? The reader sees a band plus what produced it, and `missing[]` (缺什么源/工具).

| Band | Meaning |
|------|---------|
| minimal | nothing compared — single source, or no shared subject |
| weak | one source naming a traceable public record, or wording overlap only |
| moderate | two sources share a named subject (same issuer family) |
| strong | independent issuers agree on the subject |

Within-passage wording cues (instrument vocabulary, meeting+instrument sequence, numbers) are
substance density, reported separately under `single_source_cues` — a rich single passage is still
not corroborated.

## Brief quality (complete / partial / rejected)

Field: `brief_quality` · code `src/lib/brief-quality.ts` · design [DP-brief-quality.md](./DP-brief-quality.md).

This gate answers a different question from corroboration: **is this draft thick enough to call a
complete research brief?** It is still not P(event).

| Level | Rule (summary) |
|-------|----------------|
| complete | adopted ∧ ≥2 distinct sources ∧ dated `source_as_of` (or operator-provided date) |
| partial | adopted but missing second source and/or as-of |
| rejected | not adopted (no hard detail) / intake defer path |

Freshness also **caps Outlook likelihoods** (`unknown` → low；`aging`/`stale` → medium). Scenarios
should carry `alternative` and `falsifier` (offline fills them；gate warns soft if LLM omits).

UI chip: Complete brief / Partial brief. Markdown header mirrors `brief_quality.level` + `missing[]`.

## Clickable public refs

`canada_policy_link.hits[].public_refs` are `{ title, url, publisher }` objects
pointing at Justice Laws / GAC / CBSA / Canada.ca entry points. UI renders them as links.
Still **not legal advice** — human verifies current consolidated text.

Catalog helper: `listCanadaPolicyCatalog()` (also on Portfolio page).

## Social commentary

Detected cues: 李老师、twitter/x、微博、网传、自媒体…
Or API `sourceClass: "social_commentary"`.

- **Not** added to whitelist auto-collect
- Paste-only; confidence hard-capped
- Open question forces primary-source check

## What a real calibration would require

If the owner later wants measured confidence rather than editorial ordering, the bands cannot simply
be relabelled — the work is:

1. **A labelled corpus.** Several hundred public Mandarin pastes, each annotated by a human with the
   outcome we actually care about (e.g. "an implementing instrument matching this text was published
   within N months", or "a second independent public source confirmed the named subject").
2. **A written label definition.** What counts as confirmation, who adjudicates disagreement, and
   the inter-annotator agreement achieved. Without this, later numbers are just this heuristic with
   extra decimals.
3. **A held-out split.** Fit thresholds (and any weights) on train, report on test. Report
   discrimination (ranking quality) and calibration (do predicted rates match observed rates)
   separately — a good ranker is often badly calibrated.
4. **A dated, versioned report** checked in next to this file, and re-run when rules change.

Until all four exist, keep publishing bands. A band that admits it is an editorial ordering is more
useful to a reviewer than a decimal that quietly claims to be a measurement.

Code: `src/lib/confidence.ts`, `source-tier.ts`, `score-bands.ts`, `canada-policy-link.ts`, `source-class.ts`
