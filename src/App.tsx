import { useMemo, useState } from "react";

const SAMPLE = `据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展，因地制宜发展新质生产力，继续推进改革开放，在发展中保障和改善民生，维护社会和谐稳定。会议指出，当前外部环境复杂多变，要增强忧患意识，同时坚定信心，推动经济持续回升向好。`;

type ApiResult = {
  mode: string;
  matchedCards: string[];
  briefing: unknown;
  gate: { passed: boolean; findings: { severity: string; message: string; evidence: string }[] };
  systemPromptChars: number;
  error?: string;
};

export function App() {
  const [sourceText, setSourceText] = useState(SAMPLE);
  const [label, setLabel] = useState("sample-xinhua-style-excerpt");
  const [forceOffline, setForceOffline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");

  const gateClass = useMemo(() => {
    if (!result) return "";
    return result.gate.passed ? "ok" : "bad";
  }, [result]);

  async function run() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, sourceLabel: label, forceOffline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setResult(data);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>研析 Yanxi</h1>
        <p>
          Civilian open-source research: public Mandarin text → Chinese digest + China
          history/politics/culture context cards → English briefing note with cautious
          policy scenarios, guarded by claim gates. Draft for human review only.
        </p>
        <span className="badge">Not an intelligence product · Public sources only · Human review required</span>
      </header>

      <div className="grid">
        <section className="panel">
          <label htmlFor="src">Public Mandarin source (paste)</label>
          <textarea id="src" value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
          <label htmlFor="label" style={{ marginTop: "0.75rem" }}>
            Source label
          </label>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="row">
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={forceOffline}
                onChange={(e) => setForceOffline(e.target.checked)}
              />
              Force offline engine
            </label>
            <button type="button" onClick={run} disabled={loading}>
              {loading ? "Running…" : "Generate briefing"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSourceText(SAMPLE);
                setLabel("sample-xinhua-style-excerpt");
              }}
            >
              Reset sample
            </button>
          </div>
          {error ? <p className="bad">{error}</p> : null}
        </section>

        <section className="panel">
          {!result ? (
            <p className="meta">Output appears here after a run.</p>
          ) : (
            <>
              <p className="meta">
                mode=<strong>{result.mode}</strong> · cards=
                <strong>{result.matchedCards.join(", ") || "(none)"}</strong> · prompt≈
                {result.systemPromptChars} chars · gate=
                <strong className={gateClass}>{result.gate.passed ? "PASS" : "FAIL"}</strong>
              </p>
              {result.gate.findings.length > 0 ? (
                <pre>
                  {result.gate.findings
                    .map((f) => `[${f.severity}] ${f.message} :: ${f.evidence}`)
                    .join("\n")}
                </pre>
              ) : (
                <p className="ok meta">No gate findings.</p>
              )}
              <pre>{JSON.stringify(result.briefing, null, 2)}</pre>
            </>
          )}
        </section>
      </div>

      <p className="footer">
        Skills live in <code>skills/</code> (briefing-writer, ethics-sandbox, context-cards).
        Edit markdown to train the system. See <code>docs/ETHICS.md</code> and{" "}
        <code>docs/JOB-FIT.md</code> (internal scope).
      </p>
    </div>
  );
}
