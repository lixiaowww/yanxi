/**
 * Reader settings — per-viewer localStorage preference, not shared state.
 * "Show analyst details" defaults to OFF: the reading flow (category →
 * list → brief) shows only the briefing itself by default; the
 * mode/triage/confidence-factor internals are opt-in, not something every
 * reader sees on every brief.
 */
const SHOW_ANALYST_DETAILS_KEY = "yanxi:showAnalystDetails";

export function getShowAnalystDetails(): boolean {
  try {
    return localStorage.getItem(SHOW_ANALYST_DETAILS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setShowAnalystDetails(value: boolean): void {
  try {
    localStorage.setItem(SHOW_ANALYST_DETAILS_KEY, value ? "1" : "0");
  } catch {
    /* best-effort only — private browsing / blocked storage */
  }
}
