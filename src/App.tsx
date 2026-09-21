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

        <section className="panel result-panel">
          {!result || !b ? (
            <p className="meta">生成后这里显示可读简报。点击摘录可在左侧高亮原文。</p>
          ) : (
            <article className="brief-reader">
              <header className="brief-status">
                <div className="status-chips">
                  <span className={`chip ${result.mode === "llm" ? "chip-ok" : "chip-warn"}`}>
                    {result.mode === "llm" ? "LLM 简报" : "模板简报"}
                  </span>
                  <span className={`chip ${result.gate.passed ? "chip-ok" : "chip-bad"}`}>
                    门禁 {result.gate.passed ? "通过" : "未通过"}
                  </span>
                  {result.infoValue ? (
                    <span className={`chip value-${result.infoValue.level}`}>
                      信息量 {result.infoValue.level === "high" ? "较高" : result.infoValue.level === "low" ? "偏低" : "中等"}
                    </span>
                  ) : null}
                  {b.confidence_factors?.level ? (
                    <span className={`chip conf-${b.confidence_factors.level}`}>
                      证据置信 {b.confidence_factors.level}
                    </span>
                  ) : null}
                  {b.desk_section?.label_zh ? (
                    <span className="chip desk-badge">{b.desk_section.label_zh}</span>
                  ) : null}
                  {b.canada_nexus && b.canada_nexus.level !== "none" ? (
                    <span
                      className={
                        b.canada_nexus.level === "direct"
                          ? "chip nexus-badge nexus-direct"
                          : "chip nexus-badge nexus-possible"
                      }
                    >
                      {b.canada_nexus.level === "direct" ? "涉加（明示）" : "涉加（可能）"}
                    </span>
                  ) : null}
                </div>
                {result.mode === "offline" ? (
                  <p className="status-note">
                    当前为模板输出
                    {result.offlineReason?.startsWith("llm_error")
                      ? "（LLM 暂不可用已回退）"
                      : result.offlineReason?.startsWith("force_offline")
                        ? "（已勾选跳过 LLM）"
                        : result.llmConfigured
                          ? ""
                          : "（未配置 LLM）"}
                    。先看「这是什么 / 意味着什么 / 还缺什么」。
                  </p>
                ) : null}
                {result.infoValue?.level === "low" ? (
                  <p className="status-note warn">{result.infoValue.label_zh}</p>
                ) : null}
              </header>

              <section className="read-block">
                <h2>这是什么</h2>
                <p className="prose">{b.briefing_en?.what || "—"}</p>
              </section>

              <section className="read-block">
                <h2>意味着什么</h2>
                <p className="prose">{b.briefing_en?.so_what || "—"}</p>
              </section>

              {b.substance_cut ? (
                <section className={`read-block substance-panel substance-${b.substance_cut.band || "thin"}`}>
                  <h2>
                    可核验干货
                    <span className={`substance-badge substance-${b.substance_cut.band || "thin"}`}>
                      {b.substance_cut.band === "dense"
                        ? "较实"
                        : b.substance_cut.band === "mixed"
                          ? "混杂"
                          : "偏虚"}
                    </span>
                  </h2>
                  <p className="meta">{b.substance_cut.label_zh}</p>
                  {(b.substance_cut.nuggets || []).length ? (
                    <ul className="nugget-list">
                      {(b.substance_cut.nuggets || []).slice(0, 8).map((n, i) => (
                        <li key={i}>
                          <span className="nugget-kind">{n.label_zh}</span>
                          <span className="nugget-ev">{n.evidence}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="prose muted">没有检出数字、时限、具名通知或责任主体——本段多半是方向/套话。</p>
                  )}
                  {(b.substance_cut.empty_calories || []).length ? (
                    <p className="meta">空热量提示：{(b.substance_cut.empty_calories || []).slice(0, 2).join("；")}</p>
                  ) : null}
                </section>
              ) : null}

              <section className="read-block next-panel">
                <h2>还缺什么 · 下一步</h2>
                <ul className="action-list">
                  {Array.from(
                    new Set([
                      ...(b.corroboration?.missing || []),
                      ...(result.infoValue?.next_zh || []),
                      ...(b.open_questions || []).slice(0, 3),
                      ...(b.policy_outlook?.watchpoints || []).slice(0, 3),
                    ])
                  )
                    .slice(0, 6)
                    .map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                </ul>
                {b.corroboration ? (
                  <p className="meta">
                    印证强度：{b.corroboration.score_0_to_3}/3（{b.corroboration.label_zh}）
                  </p>
                ) : null}
              </section>

              {(b.policy_outlook?.scenarios || []).length ? (
                <section className="read-block">
                  <h2>可能情景（假设，非预测定论）</h2>
                  <ol className="scenario-list">
                    {(b.policy_outlook?.scenarios || []).map((s, i) => (
                      <li key={i}>
                        <span className={`likelihood likelihood-${s.likelihood || "low"}`}>
                          {s.likelihood === "high" ? "较可能" : s.likelihood === "medium" ? "或然" : "较低可能"}
                        </span>
                        <span className="prose">{s.label}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {b.canada_policy_link && b.canada_policy_link.level !== "none" ? (
                <section className="read-block policy-link-panel">
                  <h2>加国公开政策入口（非法律意见）</h2>
                  <ul className="action-list">
                    {(b.canada_policy_link.hits || []).map((h, i) => (
                      <li key={i}>
                        <strong>{h.theme_zh}</strong>
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
                </section>
              ) : null}

              {(b.source_digest_zh || []).length ? (
                <section className="read-block">
                  <h2>原文要点（点击可高亮左侧）</h2>
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
                            {q ? <span className="digest-quote">「{q}」</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {result.gate.findings.length > 0 ? (
                <pre className="findings">
                  {result.gate.findings
                    .map((f) => `[${f.severity}] ${f.message}`)
                    .join("\n")}
                </pre>
              ) : null}

              <details className="meta-fold">
                <summary>分析员细节（背景、分诊、记分卡等）</summary>
                <p className="meta">{b.briefing_en?.context}</p>
                {b.info_triage ? (
                  <p className="meta">
                    种类 {b.info_triage.primary_kind} · 研究优先级{" "}
                    {b.info_triage.importance?.grade} · 信号档 {b.signaling_scorecard?.band}
                  </p>
                ) : null}
                {b.confidence_factors ? (
                  <p className="meta">{b.confidence_factors.rationale}</p>
                ) : null}
                {b.ontology_lite?.hits?.length ? (
                  <p className="meta">
                    背景卡：{b.ontology_lite.hits.map((h) => h.id).join("、")}
                  </p>
                ) : null}
                {result.offlineReason ? <p className="meta">offline：{result.offlineReason}</p> : null}
                <p className="meta">cards={result.matchedCards.join(", ") || "(none)"}</p>
              </details>

              <button type="button" className="secondary" onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "收起 JSON" : "原始 JSON"}
              </button>
              {showRaw ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
            </article>
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
