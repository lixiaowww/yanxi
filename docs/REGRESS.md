# Public-style chain regression

Prove the two pillars with **assertions**, not vibes:

1. Meeting-only / formula-only → thin or weak corroboration  
2. Add instrument / nuggets → corroboration and/or substance **rises**  
3. Social commentary → confidence hard-capped `low`  
4. Desk routing + Canada nexus/policy overlays stay stable  

## Run

```bash
npm run test:regress
# included in:
npm test
```

Cases: `examples/regress/*.json`  
Reports: `outbox/test-reports/regress-*.md` + `regress-latest.json`

## Case shape

```json
{
  "id": "cewc-to-instrument",
  "title_zh": "...",
  "framing": "civilian-public-style-chain",
  "stages": [
    {
      "id": "t0_meeting_only",
      "sources": [{ "label": "...", "text": "..." }],
      "expect": {
        "gate": true,
        "substance_band_in": ["thin", "mixed"],
        "corroboration_max": 1,
        "confidence_max": "medium",
        "desk_primary_in": ["overall_goals"]
      }
    },
    {
      "id": "t1_merged",
      "sources": ["...", "..."],
      "expect": {
        "corroboration_min": 2,
        "corroboration_gt_stage": "t0_meeting_only"
      }
    }
  ]
}
```

Texts are **synthetic public-style** Mandarin for regression — not classified archives.

## Expect keys

`gate` · `substance_band(_in)` · `corroboration_min/max` · `confidence_eq/min/max` · `desk_primary_in` · `primary_kind_in` · `source_class(_not)` · `canada_nexus_in` · `canada_policy_in` · `caps_include_any` · `missing_includes_any` · `corroboration_gt_stage` · `substance_gt_stage`
