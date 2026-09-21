/**
 * Two-cut intake: first cut = hard nuggets / social class; second cut = gray defer.
 * Jev (optional) may refine defer vs reject_thin only — never overrides admit/social,
 * never upgrades to admit, never writes briefing prose.
 */
import type { SubstanceCut } from "./substance.js";
import { isActionableCore } from "./adoption.js";
import { jevConfigured, jevIntakeChoice } from "./jev.js";

export type IntakeLabel = "admit" | "defer" | "reject_thin" | "social_downweight";

export const INTAKE_LABELS: IntakeLabel[] = [
  "admit",
  "defer",
  "reject_thin",
  "social_downweight",
];

export type IntakeDecision = {
  framing: "civilian-intake";
  label: IntakeLabel;
  first_cut: IntakeLabel;
  second_cut: IntakeLabel | null;
  second_cut_engine: "none" | "local_gray" | "jev" | "human_override";
  reason_en: string;
  jev?: {
    model: string;
    choice: string;
    confidence: number;
    probabilities?: Record<string, number>;
  };
  tag: "hypothesis";
};

export function firstCutIntakeLabel(input: {
  adopted: boolean;
  sourceClass?: string | null;
}): IntakeLabel {
  if (input.sourceClass === "social_commentary") return "social_downweight";
  if (input.adopted) return "admit";
  return "reject_thin";
}

/**
 * Local gray heuristic: promote reject_thin → defer for watch-worthy thin pastes.
 * Mirrors editorial gold in examples/intake-gold.json (Jev targets).
 */
export function localGrayShouldDefer(text: string, substance: SubstanceCut): boolean {
  const nuggets = substance.nuggets || [];
  const kinds = new Set(nuggets.map((n) => n.kind));
  const hasBody = kinds.has("responsible_body");
  const hasSector = kinds.has("named_sector_or_place");
  if (hasBody && hasSector) return true;
  if (kinds.has("constraint_or_ban") && hasSector) return true;

  // Thematic Canada / minerals / CPTPP hooks without hard detail.
  if (
    substance.band === "thin" &&
    /CPTPP|北极|极地|关键矿产|北美|双边投资|菜籽|软木/.test(text)
  ) {
    return true;
  }

  // Lone deadline / weak timeline with no actionable core.
  const strong = nuggets.filter(isActionableCore);
  const timelines = nuggets.filter((n) => n.kind === "timeline");
  if (timelines.length > 0 && strong.length === 0) return true;

  return false;
}

export async function resolveIntake(input: {
  adopted: boolean;
  sourceClass?: string | null;
  text: string;
  substance: SubstanceCut;
  /** When false, skip network Jev even if configured (tests / force local). */
  allowJev?: boolean;
}): Promise<IntakeDecision> {
  const first = firstCutIntakeLabel({
    adopted: input.adopted,
    sourceClass: input.sourceClass,
  });

  if (first === "admit" || first === "social_downweight") {
    return {
      framing: "civilian-intake",
      label: first,
      first_cut: first,
      second_cut: null,
      second_cut_engine: "none",
      reason_en:
        first === "admit"
          ? "First cut: actionable hard detail — admit."
          : "First cut: social commentary — down-weight, do not treat as primary source.",
      tag: "hypothesis",
    };
  }

  // Second cut only on first-cut reject_thin.
  const localDefer = localGrayShouldDefer(input.text, input.substance);
  let label: IntakeLabel = localDefer ? "defer" : "reject_thin";
  let engine: IntakeDecision["second_cut_engine"] = localDefer ? "local_gray" : "none";
  let reason_en = localDefer
    ? "Local gray heuristic: watch-worthy without actionable hard detail — defer."
    : "First cut reject_thin; no gray watch cues — discard for intake.";
  let jevMeta: IntakeDecision["jev"];

  const tryJev = input.allowJev !== false && jevConfigured();
  if (tryJev) {
    const jev = await jevIntakeChoice({
      excerpt: input.text,
      first_cut: first,
      substance_band: input.substance.band,
      nugget_kinds: [...new Set((input.substance.nuggets || []).map((n) => n.kind))],
      source_class: input.sourceClass || "unknown_public",
    });
    if (jev) {
      label = jev.choice;
      engine = "jev";
      reason_en = `Jev second cut chose ${jev.choice} (confidence ${jev.confidence.toFixed(2)}).`;
      jevMeta = {
        model: jev.model,
        choice: jev.choice,
        confidence: jev.confidence,
        probabilities: jev.probabilities,
      };
    }
  }

  return {
    framing: "civilian-intake",
    label,
    first_cut: first,
    second_cut: label,
    second_cut_engine: engine,
    reason_en,
    jev: jevMeta,
    tag: "hypothesis",
  };
}

/** True when a full LLM / content brief should run. */
export function intakeAllowsBrief(label: IntakeLabel): boolean {
  return label === "admit";
}
