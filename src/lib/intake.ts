/**
 * First-cut intake label from whitelist-eligible paste + hard-nugget adoption.
 * Never emits `defer` — that label is reserved for the gray-zone second cut (Jev).
 */
export type IntakeLabel = "admit" | "defer" | "reject_thin" | "social_downweight";

export const INTAKE_LABELS: IntakeLabel[] = [
  "admit",
  "defer",
  "reject_thin",
  "social_downweight",
];

export function firstCutIntakeLabel(input: {
  adopted: boolean;
  sourceClass?: string | null;
}): IntakeLabel {
  if (input.sourceClass === "social_commentary") return "social_downweight";
  if (input.adopted) return "admit";
  return "reject_thin";
}
