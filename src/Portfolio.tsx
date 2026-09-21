import { useEffect, useState } from "react";

type PublicRef = { title?: string; url?: string; publisher?: string };
type DeskItem = {
  fixtureId: string;
  kind?: string;
  importance?: string;
  substance?: string;
  corr: number;
  conf: string;
  what?: string;
  soWhat?: string;
  canada?: string;
  outlook: { label?: string; likelihood?: string }[];
};
type Column = {
  id: string;
  label_zh: string;
  label_en: string;
  blurb_zh: string;
  blurb_en?: string;
  itemCount: number;
  maxCorr: number;
  items: DeskItem[];
  next_steps_zh: string[];
  next_steps_en?: string[];
};
type PortfolioData = {
  title: string;
  tagline_zh: string;
  tagline_en: string;
  not_zh: string;
  not_en?: string;
  method: Record<string, string>;
  columns: Column[];
  regress: {
    ok: boolean;
    cases: number;
    stages: number;
    failed: number;
    stamp?: string;
    highlights: string[];
  };
  canada_policy_catalog: {
    id: string;
    theme_zh: string;
    theme_en: string;
    public_refs: PublicRef[];
  }[];
  ontology_catalog: {
    id: string;
    type: string;
    desk: string[];
    tag: string;
    description: string;
    updated: string;
    sources: string;
  }[];
  ethics: string[];
  generatedAt?: string;
};

export function Portfolio() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/portfolio")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || r.statusText);
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="portfolio-page">
        <p className="bad">{error}</p>
        <p className="meta">
          Run <code>npm run portfolio</code> to generate data first.
        </p>
        <p>
          <a href="/">← Back to briefing desk</a>
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="portfolio-page">
        <p className="meta">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      <header className="portfolio-hero">
        <p className="portfolio-kicker">Civilian open-source research</p>
        <h1>{data.title}</h1>
        <p className="portfolio-tagline">{data.tagline_en || data.tagline_zh}</p>
        <p className="portfolio-not">{data.not_en || data.not_zh}</p>
        <p className="portfolio-nav">
          <a href="/">Briefing desk</a>
          <span className="meta"> · </span>
          <a href="/outbox/portfolio.md" target="_blank" rel="noreferrer">
            Markdown
          </a>
        </p>
      </header>

      <section className="portfolio-section">
        <h2>Method pillars</h2>
        <ol className="portfolio-pillars">
          <li>{data.method.pillar1_en || data.method.pillar1_zh}</li>
          <li>{data.method.pillar2_en || data.method.pillar2_zh}</li>
        </ol>
        <ul className="plain-list">
          <li>{data.method.confidence_en || data.method.confidence_zh}</li>
          <li>{data.method.substance_en || data.method.substance_zh}</li>
          <li>{data.method.canada_en || data.method.canada_zh}</li>
          {data.method.ontology_en || data.method.ontology_zh ? (
            <li>{data.method.ontology_en || data.method.ontology_zh}</li>
          ) : null}
        </ul>
      </section>

      <section className="portfolio-section">
        <h2>Desk columns</h2>
        <div className="portfolio-columns">
          {data.columns.map((col) => (
            <article key={col.id} className="portfolio-col">
              <h3>{col.label_en || col.label_zh}</h3>
              <p className="meta">{col.blurb_en || col.blurb_zh}</p>
              <p className="meta">
                Items {col.itemCount} · max corroboration <strong>{col.maxCorr}/3</strong>
              </p>
              <ul className="plain-list">
                {col.items.slice(0, 2).map((it) => (
                  <li key={it.fixtureId}>
                    <code>{it.fixtureId}</code> · {it.kind}/{it.importance} · corr=
                    {it.corr} · conf={it.conf}
                    {it.what ? <div className="meta">{it.what.slice(0, 140)}…</div> : null}
                  </li>
                ))}
              </ul>
              {(col.next_steps_en?.[0] || col.next_steps_zh[0]) ? (
                <p className="meta">Next: {col.next_steps_en?.[0] || col.next_steps_zh[0]}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="portfolio-section">
        <h2>Regression</h2>
        <p className={data.regress.ok ? "ok" : "bad"}>
          {data.regress.ok ? "PASS" : "CHECK"} · {data.regress.cases} cases /{" "}
          {data.regress.stages} stages · failed={data.regress.failed}
          {data.regress.stamp ? ` · ${data.regress.stamp}` : ""}
        </p>
        <ul className="plain-list">
          {data.regress.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </section>

      <section className="portfolio-section">
        <h2>Civic Ontology Lite (context cards)</h2>
        <p className="meta">
          Desk-first cards · background/hypothesis only · not OWL/knowledge-graph · see{" "}
          <code>docs/ONTOLOGY-LITE.md</code>
        </p>
        <ul className="plain-list ontology-catalog-list">
          {(data.ontology_catalog || []).map((c) => (
            <li key={c.id}>
              <code>{c.id}</code> · {c.type}/{c.tag} · desk={(c.desk || []).join("|")}
              <div className="meta">{c.description}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="portfolio-section">
        <h2>Canada public-policy overlay (not legal advice)</h2>
        <p className="meta">
          Links point to Justice Laws / GAC / CBSA public pages; verify current consolidated text.
        </p>
        <div className="portfolio-policy-grid">
          {data.canada_policy_catalog.map((th) => (
            <article key={th.id} className="portfolio-policy-card">
              <h3>{th.theme_en || th.theme_zh}</h3>
              <ul className="ref-links">
                {th.public_refs.map((ref, j) =>
                  ref.url ? (
                    <li key={j}>
                      <a href={ref.url} target="_blank" rel="noreferrer noopener">
                        {ref.title}
                      </a>
                      <span className="meta"> · {ref.publisher}</span>
                    </li>
                  ) : null
                )}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="portfolio-section">
        <h2>Honesty constraints</h2>
        <ul className="plain-list">
          {data.ethics.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </section>

      <footer className="portfolio-footer">
        Generated {data.generatedAt || "—"} · Draft for human review · Not an intelligence product
      </footer>
    </div>
  );
}
