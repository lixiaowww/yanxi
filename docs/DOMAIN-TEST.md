# Job-fit domain testing

Civilian Mandarin fixtures covering FLIA-relevant **topic areas** (public-style language only).

## Run

```bash
npm run test:domains   # per-domain briefings + macro merge report
npm test               # lint + demo + domains
npm run collect        # subscriptions incl. job-fit-domain-battery
```

Reports: `outbox/test-reports/job-domains-*.md` and `job-domains-latest.json`.

## Domains covered

| Fixture | Focus |
|---------|--------|
| macro-cewc | Central Economic Work Conference language |
| macro-instrument | Implementing notice / 办法 |
| foreign-affairs | BRI / MFA-style discourse |
| industrial-tech | chips / AI / supply chain |
| finance-risk | local debt / property / systemic risk |
| rural-food | rural revitalization / food security |
| ideology-party | theme education / Party building |
| dual-circulation | dual circulation / unified market |
| social-governance | social governance / stability |

## UI

`npm run dev` → **Job-fit domain fixture** dropdown loads each pack into the paste box.

## Gaps closed in this pass

- Expanded `info_triage` kinds (finance/rural/ideology/dual/five-year)
- Cross-source soft overlap check
- Domain API + UI selector
- Battery subscription `job-fit-domain-battery`
- Domain-aware offline `so_what` + outlook scenarios / watchpoints
- Test report includes per-domain analysis & prediction sections
- Short fixtures lengthened past excerpt-penalty threshold (≥80 chars)
- UI shows triage kinds + importance drivers
