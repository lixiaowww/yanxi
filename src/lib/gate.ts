// Deterministic claim gate — Veragent/GrantWright-inspired L1 checks.
export type GateFinding = {
  id: string;
  severity: "hard" | "soft";
  message: string;
  evidence: string;
};

export type PolicyScenario = {
  label?: string;
  likelihood?: string;
  basis?: string;
  tag?: string;
};

export type BriefingJson = {
  source_digest_zh?: { point?: string; quote?: string }[];
  context_notes?: { card?: string; note?: string; tag?: string }[];
  briefing_en?: {
    what?: string;
    context?: string;
    so_what?: string;
    confidence?: string;
    sources_used?: string[];
  };
  /** Cautious open-source research scenarios — always hypothesis-tagged. */
  policy_outlook?: {
    horizon?: string;
    scenarios?: PolicyScenario[];
    watchpoints?: string[];
  };
  open_questions?: string[];
};

const FORBIDDEN = [
  /\bSIGINT\b/i,
  /\bCSE\b/,
  /\bCSIS\b/,
  /espionage/i,
  /spy\s*tool/i,
  /classified\s+access/i,
  /wiretap/i,
];

const OVERCLAIM = /\b(will definitely|guaranteed to|secretly plans|must happen|inevitable that)\b/i;

export function runClaimGate(briefing: BriefingJson, sourceText: string): GateFinding[] {
  const findings: GateFinding[] = [];
  const blob = JSON.stringify(briefing);

  for (const rx of FORBIDDEN) {
    const m = blob.match(rx);
    if (m) {
      findings.push({
        id: "ethics-forbidden-framing",
        severity: "hard",
        message: "Output uses forbidden intelligence/surveillance framing.",
        evidence: m[0],
      });
    }
  }

  for (const row of briefing.source_digest_zh || []) {
    const q = (row.quote || "").trim();
    if (!q) continue;
    if (!sourceText.includes(q)) {
      findings.push({
        id: "quote-not-in-source",
        severity: "hard",
        message: "Chinese quote is not a substring of the provided source text.",
        evidence: q.slice(0, 80),
      });
    }
  }

  for (const note of briefing.context_notes || []) {
    const tag = (note.tag || "").toLowerCase();
    if (tag && tag !== "background" && tag !== "hypothesis") {
      findings.push({
        id: "context-tag-invalid",
        severity: "soft",
        message: "Context note tag should be background or hypothesis.",
        evidence: tag,
      });
    }
  }

  const conf = (briefing.briefing_en?.confidence || "").toLowerCase();
  if (conf && !["low", "medium", "high"].includes(conf)) {
    findings.push({
      id: "confidence-invalid",
      severity: "soft",
      message: "confidence must be low|medium|high.",
      evidence: conf,
    });
  }

  const soWhat = briefing.briefing_en?.so_what || "";
  if (OVERCLAIM.test(soWhat)) {
    findings.push({
      id: "overclaim-forecast",
      severity: "soft",
      message: "so_what uses overconfident forecast language.",
      evidence: soWhat.slice(0, 120),
    });
  }

  for (const sc of briefing.policy_outlook?.scenarios || []) {
    const tag = (sc.tag || "").toLowerCase();
    if (tag && tag !== "hypothesis") {
      findings.push({
        id: "outlook-tag-invalid",
        severity: "soft",
        message: "policy_outlook scenarios must use tag hypothesis.",
        evidence: tag,
      });
    }
    const lik = (sc.likelihood || "").toLowerCase();
    if (lik && !["low", "medium", "high"].includes(lik)) {
      findings.push({
        id: "outlook-likelihood-invalid",
        severity: "soft",
        message: "scenario likelihood must be low|medium|high.",
        evidence: lik,
      });
    }
    const basis = sc.basis || "";
    if (OVERCLAIM.test(basis) || OVERCLAIM.test(sc.label || "")) {
      findings.push({
        id: "outlook-overclaim",
        severity: "soft",
        message: "policy_outlook uses overconfident language.",
        evidence: (sc.label || basis).slice(0, 120),
      });
    }
  }

  return findings;
}

export function gatePassed(findings: GateFinding[]): boolean {
  return !findings.some((f) => f.severity === "hard");
}
