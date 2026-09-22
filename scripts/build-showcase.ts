import "dotenv/config";
import fs from "fs";
import path from "path";
import { runBriefingPipeline } from "../src/lib/pipeline.js";
import { formatBriefResponseMarkdown } from "../src/lib/brief-markdown.js";

/**
 * Curated, frozen showcase pair — P0-2 (docs/ROADMAP.md Next).
 *
 * Portfolio visitors default to seeing these static files, not a live paste
 * that may land on a thin/defer result by chance. One shows the complete
 * two-source LLM path; one shows the honest-decline path on the same kind
 * of input a casual visitor is likely to paste. Both outcomes are the
 * product working as designed — see docs/PRD.md §2.
 */

const outDir = path.join(process.cwd(), "examples", "showcase");
fs.mkdirSync(outDir, { recursive: true });

async function buildComplete() {
  const meeting = `据新华社北京电，近日召开的中央经济工作会议强调，要坚持高质量发展，因地制宜发展新质生产力，继续推进改革开放，在发展中保障和改善民生，维护社会和谐稳定。会议指出，当前外部环境复杂多变，要增强忧患意识，同时坚定信心，推动经济持续回升向好。会议要求实施积极的财政政策和稳健的货币政策，着力扩大内需，稳增长。`;
  const notice = `国务院办公厅近日印发通知，要求有关部门制定实施方案，因地制宜推进新质生产力相关试点，并强调在发展中保障和改善民生。通知指出，要做好政策解读，适时出台配套办法，确保中央经济工作会议部署落到实处。`;

  const r = await runBriefingPipeline({
    sources: [
      { label: "Xinhua — Central Economic Work Conference", text: meeting },
      { label: "State Council General Office — implementing notice", text: notice },
    ],
    sourcePublishedAt: "2026-09-15",
  });

  const md = formatBriefResponseMarkdown(r, {
    title: "Showcase — complete brief (two sources, dated)",
    id: "showcase-complete-macro-instrument",
    createdAt: new Date().toISOString(),
    sourceLabel: "Xinhua CEWC report + State Council General Office notice",
  });
  fs.writeFileSync(path.join(outDir, "complete-macro-instrument.md"), md, "utf8");
  fs.writeFileSync(
    path.join(outDir, "complete-macro-instrument.json"),
    JSON.stringify(r, null, 2),
    "utf8"
  );
  console.log(
    "complete example:",
    r.mode,
    r.llmProvider || "",
    "brief_quality =",
    r.briefing.brief_quality?.level
  );
}

async function buildDeferred() {
  const text = `有关会议强调，要统筹发展和安全，稳妥化解地方债与隐性债务风险，持续做好保交楼工作，促进房地产市场平稳健康发展，坚决守住不发生系统性金融风险的底线，同时防止资本无序扩张。`;

  const r = await runBriefingPipeline({
    sourceText: text,
    sourceLabel: "single-source-finance-risk",
    forceOffline: true, // deterministic — this outcome is a rule, not an LLM call away from complete
  });

  const md = formatBriefResponseMarkdown(r, {
    title: "Showcase — deferred (single source, no date, no named body)",
    id: "showcase-deferred-finance-risk",
    createdAt: new Date().toISOString(),
    sourceLabel: "single-source-finance-risk",
  });
  fs.writeFileSync(path.join(outDir, "deferred-finance-risk.md"), md, "utf8");
  fs.writeFileSync(
    path.join(outDir, "deferred-finance-risk.json"),
    JSON.stringify(r, null, 2),
    "utf8"
  );
  console.log("deferred example: intake =", r.briefing.intake?.label);
}

await buildComplete();
await buildDeferred();
