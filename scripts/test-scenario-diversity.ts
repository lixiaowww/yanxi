/**
 * Every domain profile's hand-written scenarios must carry their OWN
 * alternative/falsifier — not the ensureFourPiece() generic fallback shared
 * across the whole rule engine. Found by hand-reviewing two live production
 * briefs (2026-09-21/22): taiwan_strait's 3 scenarios all shared the exact
 * same alternative text because none of them set the field. See
 * docs/DP-brief-quality.md §4.3a/§4.8.
 *
 * This doesn't need domain-accurate input text — pickProfile's forcedId
 * bypasses matching, so a single representative FactSet run through every
 * profile is enough to check each profile's OWN scenario set for internal
 * duplication and reliance on the shared fallback sentence.
 */
import { extractFacts } from "../src/lib/facts.js";
import { buildContentAnalysis } from "../src/lib/analysis.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const GENERIC_FALLBACK_ALTERNATIVE =
  "Competing reading: the excerpt is signalling without near-term delivery, and priorities shift elsewhere (hypothesis).";

const REPRESENTATIVE_TEXT =
  "有关部门于2026年底前出台配套办法，安排专项资金不少于10亿元支持相关领域试点，严禁骗补。";
const facts = extractFacts(REPRESENTATIVE_TEXT);

const PROFILE_IDS = [
  "taiwan_strait",
  "critical_minerals",
  "semiconductors",
  "china_ai",
  "electric_vehicles",
  "canada_trade",
  "macro_finance",
  "defense_public",
  "social_governance",
  "general_policy",
];

let checked = 0;
for (const id of PROFILE_IDS) {
  const analysis = buildContentAnalysis(facts, {
    text: REPRESENTATIVE_TEXT,
    hotThemes: [],
    cards: [],
    sourceCount: 1,
    forcedProfileId: id,
  });
  assert(analysis.domain === id, `forcedProfileId=${id} should select that exact profile`);
  const scenarios = analysis.scenarios;
  assert(scenarios.length >= 2, `${id}: expected at least 2 scenarios, got ${scenarios.length}`);

  const alternatives = scenarios.map((s) => s.alternative);
  const uniqueAlternatives = new Set(alternatives);
  assert(
    uniqueAlternatives.size === alternatives.length,
    `${id}: scenarios share a duplicate alternative — ${JSON.stringify(alternatives)}`
  );
  assert(
    !alternatives.includes(GENERIC_FALLBACK_ALTERNATIVE),
    `${id}: at least one scenario still relies on the generic ensureFourPiece() fallback text`
  );

  const falsifiers = scenarios.map((s) => s.falsifier);
  assert(
    new Set(falsifiers).size === falsifiers.length,
    `${id}: scenarios share a duplicate falsifier — ${JSON.stringify(falsifiers)}`
  );

  checked++;
}

assert(checked === PROFILE_IDS.length, "should have checked every listed profile");
console.log(`✅ ${checked} domain profiles: no shared/generic alternative or falsifier within a scenario set`);
console.log("✅ test:scenario-diversity OK");
