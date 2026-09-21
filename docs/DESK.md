# Briefing desk sections

Civilian public-source topic buckets — **not** an ops watch floor.

| id | Label | Notes |
|----|-------|-------|
| `hot_topics` | Hot topics | Aggregates recurring public themes: Taiwan Strait, EVs, China AI, semiconductors, critical minerals |
| `economy_investment` | Economy & investment | Fiscal/monetary, funds, property/debt, verifiable macro deployments (non-hot industrial) |
| `foreign_affairs` | Foreign affairs | Diplomatic discourse, bilateral, sanctions/cooperation |
| `defense_public` | Defense — public discourse only | Open reporting / white-paper style only |
| `social_governance` | Social governance | Livelihood, grassroots, public opinion, rural |

**Removed `overall_goals`** — direction-only slogans are not a desk.

## Hot themes (inside `hot_topics`)

| id | Label |
|----|-------|
| `taiwan_strait` | Taiwan Strait |
| `electric_vehicles` | Electric vehicles |
| `china_ai` | China AI |
| `semiconductors` | Semiconductors |
| `critical_minerals` | Critical minerals |

Matched themes appear as chips on the brief and in `desk_section.hot_themes`. Routing prefers `hot_topics` when a theme cue is present.

## Adoption rule

No hard detail (numbers / deadlines / named notice·measure / funding, or responsible-body + named sector) → **whole brief not adopted**. See `src/lib/adoption.ts`.
