/**
 * Regression test for the six signaling-scorecard rules added in DP-V3 §4
 * (潜规则 research pass): pen-name byline ladder, personal-leadership
 * framing, minimize/resolve tone axis, diplomatic severity + outcome
 * ladders, and the enhanced protocol-precedence rule. Each rule is sourced
 * — see skills/context-cards/policy-signaling-valves.md and docs/DP-V3.md §4.
 */
import { buildSignalingScorecard } from "../src/lib/media-heuristics.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const cases: [string, string][] = [
  ["press-authoritative-byline", "人民日报今日刊发任仲平文章，深入阐述改革方向。"],
  ["attr-personal-leadership", "习主席亲自谋划、亲自部署、亲自推动这一重大国家战略。"],
  ["tone-minimize-language", "个别地方出现问题，极少数人借机炒作，不代表整体情况。"],
  ["tone-resolve-language", "要坚决维护国家安全，严厉打击违法犯罪行为，高度重视风险防范。"],
  ["diplo-severity-ladder", "中方对此提出严重抗议，表示强烈谴责。"],
  ["diplo-outcome-euphemism", "双方进行了建设性对话，气氛亲切友好。"],
  ["seq-leader-title-order", "总书记、总理共同出席会议，人大常委会委员长发表讲话。"],
];

for (const [id, text] of cases) {
  const sc = buildSignalingScorecard(text);
  const rule = sc.rules.find((r) => r.id === id);
  assert(rule, `rule ${id} must exist in the catalog`);
  assert(rule.status === "hit", `${id} should hit on its trigger text, got ${rule.status}`);
}

// Absence must not false-positive: plain unrelated text should leave all six unclear/miss, never hit.
const plain = buildSignalingScorecard("今天天气晴朗，适合出行。");
for (const [id] of cases) {
  const rule = plain.rules.find((r) => r.id === id);
  assert(rule && rule.status !== "hit", `${id} must not hit on unrelated text`);
}

// Weight normalization still holds with 23 rules (up from 17) — the band
// calculation divides by the dynamic weight_sum, so adding rules must not
// require rebalancing the old ones.
const sc = buildSignalingScorecard("据新华社电，中央经济工作会议强调高质量发展。");
assert(sc.rules.length === 23, `expected 23 total heuristics, got ${sc.rules.length}`);
assert(
  Math.abs(sc.weight_sum - sc.rules.reduce((a, r) => a + r.weight, 0)) < 1e-6,
  "weight_sum must equal the sum of individual rule weights"
);

console.log("✅ test:signaling-heuristics-v3 OK");
