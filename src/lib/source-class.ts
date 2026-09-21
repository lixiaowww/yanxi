/**
 * Source class for civilian research hierarchy.
 * Social commentary (Twitter influencers, 网传, etc.) is paste-only and hard-capped.
 */

export const SOURCE_CLASSES = [
  "official_or_wire",
  "policy_instrument",
  "press_commentary",
  "social_commentary",
  "unknown_public",
] as const;

export type SourceClass = (typeof SOURCE_CLASSES)[number];

export type SourceClassResult = {
  framing: "civilian-source-class";
  class: SourceClass;
  label_zh: string;
  evidence: string[];
  rules: string[];
  tag: "hypothesis";
};

const SOCIAL_CUES: { cue: string; rx: RegExp }[] = [
  { cue: "李老师不是你老师", rx: /李老师不是你老师|李老师/ },
  { cue: "twitter/x", rx: /twitter\.com|x\.com\/|推特|Tweet/i },
  { cue: "微博", rx: /微博|weibo/i },
  { cue: "网传/据说", rx: /网传|据传|据说有视频|有视频显示|未证实/ },
  { cue: "自媒体", rx: /自媒体|大V|博主称/ },
];

export function detectSourceClass(
  sourceText: string,
  opts?: { forced?: SourceClass; labels?: string[] }
): SourceClassResult {
  if (opts?.forced) {
    return finalize(opts.forced, [`forced:${opts.forced}`]);
  }

  const text = sourceText || "";
  const labels = (opts?.labels || []).join(" ");
  const hay = `${text}\n${labels}`;
  const evidence: string[] = [];

  for (const row of SOCIAL_CUES) {
    if (row.rx.test(hay)) {
      const m = hay.match(row.rx);
      evidence.push(`${row.cue}:${(m?.[0] || "").slice(0, 24)}`);
    }
  }
  if (evidence.length) {
    return finalize("social_commentary", evidence);
  }

  if (/实施细则|实施方案|管理办法|印发通知|条例/.test(text)) {
    return finalize("policy_instrument", ["instrument_lexicon"]);
  }
  if (/新华社|人民日报|外交部|国防部|国务院|工信部|商务部|例行记者会/.test(text)) {
    return finalize("official_or_wire", ["official_or_wire_lexicon"]);
  }
  if (/社论|评论员文章|仲音|观察者网评论/.test(text)) {
    return finalize("press_commentary", ["commentary_lexicon"]);
  }
  return finalize("unknown_public", []);
}

function finalize(cls: SourceClass, evidence: string[]): SourceClassResult {
  const label_zh =
    cls === "official_or_wire"
      ? "Official / wire"
      : cls === "policy_instrument"
        ? "Policy instrument file"
        : cls === "press_commentary"
          ? "Press commentary"
          : cls === "social_commentary"
            ? "Social commentary / self-media (down-weighted)"
            : "Unclassified public text";

  const rules =
    cls === "social_commentary"
      ? [
          "Must not alone raise confidence to high",
          "Must not alone corroborate an official claim",
          "Atmosphere memo only; main brief needs official/wire check",
          "Default: not in whitelist auto-collect (paste only)",
        ]
      : ["Participates in corroboration and confidence factors by public-source tier"];

  return {
    framing: "civilian-source-class",
    class: cls,
    label_zh,
    evidence: evidence.slice(0, 6),
    rules,
    tag: "hypothesis",
  };
}
