import { useEffect, useMemo, useState } from "react";

const SAMPLE = `据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展，因地制宜发展新质生产力，继续推进改革开放，在发展中保障和改善民生，维护社会和谐稳定。会议指出，当前外部环境复杂多变，要增强忧患意识，同时坚定信心，推动经济持续回升向好。`;

type DigestRow = { point?: string; quote?: string; source_label?: string };
type Briefing = {
  source_digest_zh?: DigestRow[];
  context_notes?: { card?: string; note?: string; tag?: string }[];
  info_triage?: {
    primary_kind?: string;
    kinds?: { kind?: string; label_zh?: string; score?: number; evidence?: string }[];
    importance?: {
      grade?: string;
      label_zh?: string;
      score_0_to_1?: number;
      drivers?: string[];
    };
  };
  canada_nexus?: {
    level?: string;
    label_zh?: string;
    label_en?: string;
    rationale?: string;
    hits?: { level?: string; cue?: string; evidence?: string }[];
  };
  substance_cut?: {
    band?: string;
    label_zh?: string;
    boilerplate_ratio_0_to_1?: number;
    substance_score_0_to_1?: number;
    nuggets?: { kind?: string; label_zh?: string; evidence?: string }[];
    boilerplate_hits?: { cue?: string; evidence?: string }[];
    empty_calories?: string[];
    analyst_prompt_zh?: string;
    calibration?: string;
  };
  desk_section?: {
    primary?: string;
    label_zh?: string;
    label_en?: string;
    secondary?: string[];
    evidence?: string[];
    rationale?: string;
  };
  ontology_lite?: {
    framing?: string;
    desk_primary?: string;
    calibration?: string;
    hits?: {
      id?: string;
      type?: string;
      desk?: string[];
      tag?: string;
      score?: number;
      matched_keywords?: string[];
      updated?: string;
      sources?: string;
    }[];
  };
  source_class?: {
    class?: string;
    label_zh?: string;
    evidence?: string[];
    rules?: string[];
  };
  corroboration?: {
    score_0_to_3?: number;
    label_zh?: string;
    missing?: string[];
    drivers?: string[];
  };
  confidence_factors?: {
    level?: string;
    score_0_to_1?: number;
    caps_applied?: string[];
    rationale?: string;
    factors?: {
      signaling_band?: string;
      substance_band?: string;
      corroboration_0_to_3?: number;
      provenance?: string;
      source_class?: string;
      source_tier?: string;
      source_tier_weight_0_to_1?: number;
    };
    source_tier?: {
      tier?: string;
      weight_0_to_1?: number;
      label_zh?: string;
      max_confidence?: string;
      rationale_zh?: string;
    };
  };
  canada_policy_link?: {
    level?: string;
    label_zh?: string;
    disclaimer_zh?: string;
    hits?: {
      theme_zh?: string;
      theme_en?: string;
      public_refs?: { title?: string; url?: string; publisher?: string }[];
      evidence?: string;
      level?: string;
    }[];
  };
  signaling_scorecard?: { weighted_total?: number; band?: string; rules?: unknown[] };
  signaling_valves?: {
    sequence?: { status?: string; observation?: string };
    implementing_detail?: { status?: string; observation?: string };
    press_placement?: { status?: string; observation?: string };
    calibration?: string;
  };
  briefing_en?: {
    what?: string;
    context?: string;
    so_what?: string;
    confidence?: string;
    sources_used?: string[];
  };
  policy_outlook?: {
    horizon?: string;
    scenarios?: { label?: string; likelihood?: string; basis?: string }[];
    watchpoints?: string[];
  };
  open_questions?: string[];
};

type ApiResult = {
  mode: string;
  offlineReason?: string;
  llmConfigured?: boolean;
  infoValue?: {
    level: string;
    label_zh: string;
    next_zh: string[];
  };
  matchedCards: string[];
  briefing: Briefing;
  gate: { passed: boolean; findings: { severity: string; message: string; evidence: string }[] };
  systemPromptChars: number;
};

type SubRow = {
  id: string;
  title: string;
  scheduleHuman?: string;
  keywords: string[];
  feedUrl: string;
  active: boolean;
};

type OutboxRow = {
  id: string;
  createdAt: string;
  sourceLabel: string;
  gatePassed: boolean;
  what?: string;
  jsonUrl: string;
  mdUrl: string;
};

function highlightSource(text: string, quote: string | null): { before: string; hit: string; after: string } | null {
  if (!quote) return null;
  const i = text.indexOf(quote);
  if (i < 0) return null;
  return {
    before: text.slice(0, i),
    hit: text.slice(i, i + quote.length),
    after: text.slice(i + quote.length),
  };
}

type DomainRow = {
  id: string;
  domain: string;
  sourceLabel: string;
  preview: string;
};

export function App() {
  const [sourceText, setSourceText] = useState(SAMPLE);
  const [label, setLabel] = useState("sample-xinhua-style-excerpt");
  const [forceOffline, setForceOffline] = useState(false);
  const [markSocial, setMarkSocial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [domainId, setDomainId] = useState("");
  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const gateClass = useMemo(() => {
    if (!result) return "";
    return result.gate.passed ? "ok" : "bad";
  }, [result]);

  const parts = useMemo(
    () => highlightSource(sourceText, activeQuote),
    [sourceText, activeQuote]
  );

  async function refreshSubs() {
    const [s, o, d] = await Promise.all([
      fetch("/api/subscriptions").then((r) => r.json()),
      fetch("/api/outbox").then((r) => r.json()),
      fetch("/api/domains").then((r) => r.json()),
    ]);
    setSubs(s.subscriptions || []);
    setOutbox(o.briefs || []);
    setDomains(d.domains || []);
  }

  async function loadDomain(id: string) {
    if (!id) return;
    const res = await fetch(`/api/domains/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    setDomainId(id);
    setSourceText(data.sourceText);
    setLabel(data.sourceLabel);
    setActiveQuote(null);
    setResult(null);
  }

  useEffect(() => {
    refreshSubs().catch(() => undefined);
  }, []);

  async function run() {
    setLoading(true);
    setError("");
    setActiveQuote(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          sourceLabel: label,
          forceOffline,
          sourceClass: markSocial ? "social_commentary" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setResult(data);
      const first = data.briefing?.source_digest_zh?.[0]?.quote;
      if (first && sourceText.includes(first)) setActiveQuote(first);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runCollect(subscriptionId?: string) {
    setCollecting(true);
    setError("");
    try {
      const res = await fetch("/api/collect/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionId ? { subscriptionId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      await refreshSubs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCollecting(false);
    }
  }

  const b = result?.briefing;

  return (
    <div className="wrap">
      <header>
        <h1>研析 Yanxi</h1>
        <p>
          Civilian open-source research: public Mandarin → English briefing with context cards,
          signaling scorecard, kinds/priority triage, claim gates, and whitelist collect/RSS.
          GrantWright urlSafety + htmlToText reused for fetch. Draft for human review only.
        </p>
        <span className="badge">Not an intelligence product · Public whitelist only · Human review required</span>
        <p className="meta" style={{ marginTop: "0.65rem" }}>
          <a href="/portfolio">Portfolio 一页</a>
          <span> · </span>
          <a href="/outbox/portfolio.md" target="_blank" rel="noreferrer">
            portfolio.md
          </a>
        </p>
      </header>

      <div className="grid">
        <section className="panel">
          <label htmlFor="domain">Job-fit domain fixture</label>
          <select
            id="domain"
            value={domainId}
            onChange={(e) => {
              loadDomain(e.target.value).catch((err) =>
                setError(err instanceof Error ? err.message : String(err))
              );
            }}
          >
            <option value="">— select domain pack —</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.domain} · {d.id}
              </option>
            ))}
          </select>
          <label htmlFor="src" style={{ marginTop: "0.75rem" }}>
            Public Mandarin source (paste)
          </label>
          {parts ? (
            <div className="source-view" aria-live="polite">
              <span>{parts.before}</span>
              <mark className="quote-hit">{parts.hit}</mark>
              <span>{parts.after}</span>
            </div>
          ) : null}
          <textarea
            id="src"
            value={sourceText}
            onChange={(e) => {
              setSourceText(e.target.value);
              setActiveQuote(null);
            }}
          />
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
              Force offline（跳过 LLM，只用模板）
            </label>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={markSocial}
                onChange={(e) => setMarkSocial(e.target.checked)}
              />
              Mark as social commentary（降权）
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
                setActiveQuote(null);
                setResult(null);
              }}
            >
              Reset sample
            </button>
          </div>
          {error ? <p className="bad">{error}</p> : null}
        </section>

        <section className="panel">
          {!result || !b ? (
            <p className="meta">Structured briefing appears here after a run. Click a digest quote to highlight the source.</p>
          ) : (
            <>
              {(result.mode === "offline" || result.infoValue?.level === "low") && (
                <div
                  className={`mode-banner ${
                    result.mode === "offline" ? "mode-offline" : ""
                  } value-${result.infoValue?.level || "medium"}`}
                >
                  {result.mode === "offline" ? (
                    <p>
                      <strong>当前为 offline 模板简报</strong>
                      {result.llmConfigured === false
                        ? "（未配置 LLM）"
                        : result.offlineReason?.startsWith("force_offline")
                          ? "（已勾选 Force offline）"
                          : result.offlineReason?.startsWith("llm_error")
                            ? "（LLM 调用失败，已回退）"
                            : ""}
                      。信息密度通常低于 LLM 路径；请先看下方「干货 / 缺什么」。
                    </p>
                  ) : null}
                  {result.offlineReason ? (
                    <p className="meta">原因: {result.offlineReason}</p>
                  ) : null}
                  {result.infoValue ? (
                    <p>
                      <strong>信息价值:</strong> {result.infoValue.label_zh}
                    </p>
                  ) : null}
                  {(result.infoValue?.next_zh || []).length ? (
                    <ul className="plain-list">
                      {result.infoValue!.next_zh.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}

              <p className="meta">
                mode=<strong>{result.mode}</strong>
                {result.llmConfigured != null
                  ? ` · llm=${result.llmConfigured ? "configured" : "off"}`
                  : ""}{" "}
                · gate=
                <strong className={gateClass}>{result.gate.passed ? "PASS" : "FAIL"}</strong>
                {result.infoValue ? (
                  <>
                    {" "}
                    · value=
                    <strong className={`value-${result.infoValue.level}`}>
                      {result.infoValue.level}
                    </strong>
                  </>
                ) : null}
                {b.confidence_factors?.level ? (
                  <>
                    {" "}
                    · conf=
                    <strong className={`conf-${b.confidence_factors.level}`}>
                      {b.confidence_factors.level}
                    </strong>
                    {b.corroboration?.score_0_to_3 != null
                      ? ` · corr=${b.corroboration.score_0_to_3}/3`
                      : ""}
                  </>
                ) : null}
                {b.desk_section?.label_zh ? (
                  <>
                    {" "}
                    · <span className="desk-badge">{b.desk_section.label_zh}</span>
                  </>
                ) : null}
                {b.canada_nexus && b.canada_nexus.level !== "none" ? (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      className={
                        b.canada_nexus.level === "direct"
                          ? "nexus-badge nexus-direct"
                          : "nexus-badge nexus-possible"
                      }
                    >
                      {b.canada_nexus.level === "direct" ? "CA" : "CA?"} {b.canada_nexus.label_zh}
                    </span>
                  </>
                ) : null}
              </p>

              {/* P1: lead with substance + briefing + next checks */}
              {b.substance_cut ? (
                <div className={`substance-panel substance-${b.substance_cut.band || "thin"}`}>
                  <h3 className="section-title">1. 干货（八股剥离）</h3>
                  <p className="meta">
                    <span className={`substance-badge substance-${b.substance_cut.band || "thin"}`}>
                      {b.substance_cut.band}
                    </span>{" "}
                    {b.substance_cut.label_zh} · boilerplate≈
                    {((b.substance_cut.boilerplate_ratio_0_to_1 || 0) * 100).toFixed(0)}%
                  </p>
                  <p className="meta">{b.substance_cut.analyst_prompt_zh}</p>
                  {(b.substance_cut.nuggets || []).length ? (
                    <ul className="plain-list">
                      {(b.substance_cut.nuggets || []).map((n, i) => (
                        <li key={i}>
                          <strong>{n.label_zh}</strong> · <code>{n.evidence}</code>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="meta">未检出数字/时限/工具/责任主体 — 本段信息价值通常偏低。</p>
                  )}
                  {(b.substance_cut.empty_calories || []).length ? (
                    <ul className="plain-list">
                      {(b.substance_cut.empty_calories || []).map((e, i) => (
                        <li key={i} className="meta">
                          {e}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="brief-lead">
                <h3 className="section-title">2. 英文简报</h3>
                <p>
                  <strong>What:</strong> {b.briefing_en?.what}
                </p>
                <p>
                  <strong>So what:</strong> {b.briefing_en?.so_what}
                </p>
                <p className="meta">
                  <strong>Context:</strong> {b.briefing_en?.context}
                </p>
              </div>

              <div className="next-panel">
                <h3 className="section-title">3. 缺什么 / 下一步核验</h3>
                {b.corroboration ? (
                  <p className="meta">
                    印证 <strong>{b.corroboration.score_0_to_3}/3</strong> · {b.corroboration.label_zh}
                  </p>
                ) : null}
                <ul className="plain-list">
                  {(b.corroboration?.missing || []).map((m, i) => (
                    <li key={`m-${i}`}>{m}</li>
                  ))}
                  {(b.open_questions || []).map((q, i) => (
                    <li key={`q-${i}`}>{q}</li>
                  ))}
                  {(result.infoValue?.next_zh || []).map((n, i) => (
                    <li key={`n-${i}`}>{n}</li>
                  ))}
                </ul>
                {(b.policy_outlook?.watchpoints || []).length ? (
                  <>
                    <p className="meta">
                      <strong>Watchpoints</strong>
                    </p>
                    <ul className="plain-list">
                      {(b.policy_outlook?.watchpoints || []).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>

              {b.canada_policy_link && b.canada_policy_link.level !== "none" ? (
                <div className="policy-link-panel">
                  <h3 className="section-title">加国公开政策对照（非法律意见）</h3>
                  <p className="meta">{b.canada_policy_link.label_zh}</p>
                  <ul className="plain-list">
                    {(b.canada_policy_link.hits || []).map((h, i) => (
                      <li key={i}>
                        <strong>{h.theme_zh}</strong> [{h.level}]
                        <ul className="ref-links">
                          {(h.public_refs || []).map((ref, j) =>
                            ref.url ? (
                              <li key={j}>
                                <a href={ref.url} target="_blank" rel="noreferrer noopener">
                                  {ref.title || ref.url}
                                </a>
                              </li>
                            ) : null
                          )}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <h3 className="section-title">原文摘录（点击高亮）</h3>
              <ul className="digest-list">
                {(b.source_digest_zh || []).map((row, idx) => {
                  const q = row.quote || "";
                  const ok = q && sourceText.includes(q);
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        className={`digest-btn ${activeQuote === q ? "active" : ""} ${ok ? "" : "missing"}`}
                        onClick={() => setActiveQuote(q || null)}
                      >
                        <span className="digest-point">{row.point}</span>
                        {q ? <code className="digest-quote">{q}</code> : null}
                        {!ok && q ? <span className="bad"> not in source</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {b.policy_outlook?.scenarios?.length ? (
                <>
                  <h3 className="section-title">Outlook（hypothesis）</h3>
                  <ul className="plain-list">
                    {b.policy_outlook.scenarios.map((s, i) => (
                      <li key={i}>
                        <strong>[{s.likelihood}]</strong> {s.label}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {result.gate.findings.length > 0 ? (
                <pre className="findings">
                  {result.gate.findings
                    .map((f) => `[${f.severity}] ${f.message} :: ${f.evidence}`)
                    .join("\n")}
                </pre>
              ) : (
                <p className="ok meta">No gate findings.</p>
              )}

              <details className="meta-fold">
                <summary>元数据（分诊 / 置信度 / 背景卡 / 调节阀）— 默认折叠</summary>
                {b.desk_section?.label_zh ? (
                  <p className="meta desk-line">
                    栏目: {b.desk_section.label_zh}
                    {b.desk_section.label_en ? ` · ${b.desk_section.label_en}` : ""}
                  </p>
                ) : null}
                {b.info_triage ? (
                  <p className="meta">
                    triage={b.info_triage.primary_kind}/{b.info_triage.importance?.grade} · band=
                    {b.signaling_scorecard?.band}
                  </p>
                ) : null}
                {b.confidence_factors ? (
                  <div className={`conf-panel conf-${b.confidence_factors.level || "low"}`}>
                    <p className="meta">{b.confidence_factors.rationale}</p>
                    <p className="meta">
                      caps={(b.confidence_factors.caps_applied || []).join(", ") || "none"}
                      {b.confidence_factors.source_tier
                        ? ` · tier=${b.confidence_factors.source_tier.tier}`
                        : ""}
                    </p>
                  </div>
                ) : null}
                {b.ontology_lite?.hits?.length ? (
                  <ul className="ontology-hits">
                    {b.ontology_lite.hits.map((h, i) => (
                      <li key={h.id || i}>
                        <span className="ontology-id">{h.id}</span>
                        <span className="meta">
                          {" "}
                          [{h.type}/{h.tag}]
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {b.canada_nexus && b.canada_nexus.level !== "none" ? (
                  <p className="meta">{b.canada_nexus.rationale}</p>
                ) : null}
                {b.signaling_valves ? (
                  <p className="meta">{b.signaling_valves.calibration}</p>
                ) : null}
                <p className="meta">cards={result.matchedCards.join(", ") || "(none)"}</p>
              </details>

              <button type="button" className="secondary" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "Hide raw JSON" : "Show raw JSON"}
              </button>
              {showRaw ? <pre>{JSON.stringify({ ...result, briefing: b }, null, 2)}</pre> : null}
            </>
          )}
        </section>
      </div>

      <section className="panel subs">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Subscriptions (whitelist collect → English brief → RSS)</h2>
          <button type="button" className="secondary" onClick={() => runCollect()} disabled={collecting}>
            {collecting ? "Collecting…" : "Run collect now"}
          </button>
        </div>
        <p className="meta">
          Configure <code>config/subscriptions.json</code>. Fetch SSRF via GrantWright{" "}
          <code>urlSafety</code>. See <code>docs/COLLECT.md</code>.
        </p>
        <ul className="sublist">
          {subs.map((s) => (
            <li key={s.id}>
              <strong>{s.title}</strong>
              <span className="meta"> · {s.scheduleHuman || "manual"}</span>
              <div className="row">
                <a href={s.feedUrl} target="_blank" rel="noreferrer">
                  RSS feed
                </a>
                <button type="button" className="secondary" onClick={() => runCollect(s.id)} disabled={collecting}>
                  Run
                </button>
              </div>
            </li>
          ))}
        </ul>
        {outbox.length > 0 ? (
          <>
            <h3>Recent outbox</h3>
            <ul className="sublist">
              {outbox.slice(0, 6).map((row) => (
                <li key={row.id}>
                  <span className={row.gatePassed ? "ok" : "bad"}>{row.gatePassed ? "PASS" : "FAIL"}</span>{" "}
                  <strong>{row.sourceLabel}</strong>
                  <span className="meta"> · {row.createdAt}</span>
                  <div className="row">
                    <a href={row.mdUrl} target="_blank" rel="noreferrer">
                      .md
                    </a>
                    <a href={row.jsonUrl} target="_blank" rel="noreferrer">
                      .json
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <p className="footer">
        Skills in <code>skills/</code>. Reuse notes in <code>vendor/grantwright/README.md</code>. Ethics:{" "}
        <code>docs/ETHICS.md</code>.
      </p>
    </div>
  );
}
