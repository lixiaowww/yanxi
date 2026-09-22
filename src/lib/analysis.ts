/**
 * Domain content analysis + forward scenarios for the offline briefing path.
 *
 * This is the reader-facing analysis layer. It answers "what would this
 * action change, who is affected, what does the chosen instrument imply, and
 * what may happen next" — using the facts extracted in `facts.ts` plus the
 * public-policy background carried by the context cards.
 *
 * Deliberately NOT here: substance bands, corroboration counts, source tiers,
 * formula-language notes or any other pipeline QA. Those stay in their own
 * structured fields and in the collapsed analyst-detail panel.
 *
 * Civilian public-source research aid. Scenarios are hypotheses with explicit
 * triggers, never predictions, and defense topics stay at public-policy level.
 */

import type { ExtractedFact, FactSet } from "./facts.js";

export type ForecastScenario = {
  /** Concrete outcome that may follow. */
  label: string;
  likelihood: "low" | "medium" | "high";
  /** Time horizon where inferable from the paste. */
  horizon?: string;
  /** Causal reasoning tied to facts in this paste. */
  basis: string;
  /** Observable condition that would confirm this path. */
  trigger?: string;
  /** Competing reading of the same excerpt (hypothesis). */
  alternative?: string;
  /** Public observation that would invalidate this path (hypothesis). */
  falsifier?: string;
  tag: "hypothesis";
};

export type ContentAnalysis = {
  framing: "civilian-content-analysis";
  domain: string;
  domain_label_en: string;
  /** Background the analysis leans on, content-level only. */
  background: string;
  so_what: string;
  scenarios: ForecastScenario[];
  watchpoints: string[];
  open_questions: string[];
  tag: "hypothesis";
};

/* ------------------------------------------------------- fact convenience */

type View = {
  set: FactSet;
  /** Named institution or spokesperson, article included. */
  actorEn: string | null;
  /** Institution only (no role), for "which body" phrasing. */
  bodyEn: string | null;
  namedBody: boolean;
  /** Placeholder the text delegates to, e.g. unnamed "relevant departments". */
  delegatedEn: string | null;
  instrEn: string | null;
  instrTypeEn: string | null;
  instrIssued: boolean;
  deadlineEn: string | null;
  amountEn: string | null;
  vehicleEn: string | null;
  floor: boolean;
  scopeEn: string | null;
  isPilot: boolean;
  prohibitionEn: string | null;
  quantitiesEn: string[];
  subjectsEn: string[];
  sourceCount: number;
};

function stripArticle(en: string): string {
  return en.replace(/^(a|an|the)\s+/i, "");
}

function buildView(set: FactSet, sourceCount: number): View {
  const named = set.actor.filter((a) => a.actor_form !== "unnamed");
  const person = named.find((a) => a.actor_form === "person");
  const body = named.find((a) => a.actor_form === "body") || person || named[0] || null;
  const delegated = set.actor.find((a) => a.actor_form === "unnamed") || null;
  const instrument: ExtractedFact | undefined = set.instrument[0];
  const money = set.money.find((f) => f.has_amount) || set.money[0];
  const scope = set.scope[0];

  return {
    set,
    actorEn: (person || named[0])?.value_en ?? null,
    bodyEn: body ? body.value_en.replace(/\s+(spokesperson|official|senior official|minister|regular press conference)$/i, "") : null,
    namedBody: named.length > 0,
    delegatedEn: delegated?.value_en ?? null,
    instrEn: instrument ? stripArticle(instrument.value_en) : null,
    instrTypeEn: instrument?.type_en ?? null,
    instrIssued: Boolean(instrument?.issued),
    deadlineEn: set.deadline[0]?.value_en ?? null,
    amountEn: money?.has_amount ? (money.amount_en ?? null) : null,
    vehicleEn: money?.vehicle_en ?? null,
    floor: money?.qualifier === "at_least",
    scopeEn: scope ? scope.value_en : null,
    isPilot: Boolean(scope && /pilot/i.test(scope.value_en)),
    prohibitionEn: set.prohibition[0]?.value_en ?? null,
    quantitiesEn: set.quantity.map((f) => f.value_en),
    subjectsEn: set.subject.map((f) => f.value_en),
    sourceCount,
  };
}

/* ------------------------------------------------- shared analysis pieces */

/** What the choice of instrument + timing says about the implementation stage. */
function stagePiece(v: View): string | null {
  if (v.instrEn && !v.instrIssued && v.deadlineEn) {
    return `Committing to ${v.instrEn} ${v.deadlineEn} places this at the drafting stage rather than in force: the operative rules — eligibility, allocation and reporting — are still unwritten, so the substantive decisions are deferred to the document itself.`;
  }
  if (v.instrEn && v.instrIssued) {
    return `An issued ${v.instrEn} moves this from intent to an administrative instrument, so the binding questions become scope and enforcement rather than whether a document exists.`;
  }
  if (v.instrEn) {
    return `${capitalise(v.instrEn)} is promised without a date, which leaves the timetable to administrative discretion.`;
  }
  return null;
}

/** What attaching (or not attaching) money implies. */
function fundingPiece(v: View): string | null {
  if (v.amountEn && v.vehicleEn) {
    return v.floor
      ? `Earmarking ${v.amountEn} in ${v.vehicleEn} makes delivery materially more credible than a directive with no money behind it, though a floor figure sets a minimum draw rather than a programme budget, and says nothing about the disbursement period.`
      : `Earmarking ${v.amountEn} in ${v.vehicleEn} gives the commitment a budget line, which makes delivery more credible than an unfunded directive.`;
  }
  if (v.amountEn) {
    return `The stated ${v.amountEn} gives the commitment a size, but with no funding channel identified the money's origin — central transfer, local budget or state-owned capital — stays open.`;
  }
  if (v.instrEn) {
    return `No money is attached, so implementation would depend on existing budgets and on how much priority subordinate units give it.`;
  }
  return null;
}

/** Who carries delivery when the text names no implementing body. */
function capacityPiece(v: View): string | null {
  if (v.namedBody && v.delegatedEn) {
    return `Delivery is delegated to ${v.delegatedEn} rather than to the speaking institution, so administrative capacity and geographic coverage depend on units the excerpt does not identify.`;
  }
  if (!v.namedBody) {
    return `No institution is named as responsible, which leaves both delivery capacity and accountability for the timetable unresolved.`;
  }
  return null;
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Rough subject–verb agreement for English instrument labels. */
function isPluralEn(s: string): boolean {
  return /\b(measures|rules|regulations|guidelines|provisions|bodies|departments|targets|quotas)\b/i.test(s)
    || (/\w{3,}s$/i.test(s) && !/(ss|us|is|ysis|news)$/i.test(s));
}

function compose(parts: (string | null | undefined)[], max = 5): string {
  return [...new Set(parts.filter((p): p is string => Boolean(p)))].slice(0, max).join(" ");
}

/** Base scenario: the promised document actually lands. */
function publicationScenario(v: View, detail: string): ForecastScenario {
  const be = v.instrEn && isPluralEn(v.instrEn) ? "are" : "is";
  return {
    label: v.instrEn
      ? `${capitalise(v.instrEn)} ${be} published ${detail}`
      : `An implementing document is published covering ${v.subjectsEn[0] || "the stated priorities"}`,
    likelihood: v.amountEn && v.deadlineEn ? "medium" : "low",
    horizon: v.deadlineEn ?? undefined,
    basis: `The excerpt already commits to ${v.instrEn || "an instrument"}${v.deadlineEn ? ` ${v.deadlineEn}` : ""}${v.amountEn ? ` with ${v.amountEn} attached` : ""}, and funded commitments in public texts are usually followed by an administrative document (hypothesis).`,
    trigger: v.instrEn
      ? "A named issuing body, a draft circulated for public comment, or a document number appearing in an official gazette."
      : "A named issuing body or a draft circulated for public comment.",
    alternative:
      "Competing reading: the commitment stays rhetorical and no administrative text is issued in the stated window (hypothesis).",
    falsifier: v.deadlineEn
      ? `No draft, document number, or named issuer appears before ${v.deadlineEn.replace(/^by /, "")}, or a published text omits the funded/pilot element named here.`
      : "No draft, document number, or named issuer appears, or a published text omits the funded/pilot element named here.",
    tag: "hypothesis",
  };
}

/** Downside scenario: the commitment thins out or slips. */
function slippageScenario(v: View, narrowing: string): ForecastScenario {
  return {
    label: v.deadlineEn
      ? `The document slips past ${v.deadlineEn.replace(/^by /, "")} or arrives narrowed to ${narrowing}`
      : `The commitment narrows to ${narrowing}`,
    likelihood: v.namedBody ? "low" : "medium",
    horizon: v.deadlineEn ?? undefined,
    basis: `${v.delegatedEn || "The unidentified implementing side"} carries delivery and no body is publicly accountable for the date, so a quiet timetable slip carries little cost (hypothesis).`,
    trigger: v.deadlineEn
      ? `No named implementing body or published draft before ${v.deadlineEn.replace(/^by /, "")}, or a published text that omits the funded element.`
      : "No named implementing body or published draft, or a text that omits the funded element.",
    alternative:
      "Competing reading: a named body takes ownership and the document lands on time with the funded element intact (hypothesis).",
    falsifier: v.deadlineEn
      ? `A dated implementing document naming the body and retaining the funded element appears before ${v.deadlineEn.replace(/^by /, "")}.`
      : "A dated implementing document naming the body and retaining the funded element is published.",
    tag: "hypothesis",
  };
}

/** Fill alternative/falsifier when a domain profile omitted them (DP F13). */
function ensureFourPiece(s: ForecastScenario): ForecastScenario {
  return {
    ...s,
    alternative:
      s.alternative ||
      "Competing reading: the excerpt is signalling without near-term delivery, and priorities shift elsewhere (hypothesis).",
    falsifier:
      s.falsifier ||
      (s.trigger
        ? `Public observation opposite to the trigger: ${s.trigger}`
        : "A clear public text on the same subject that contradicts this outcome."),
  };
}

/* ------------------------------------------------------- domain profiles */

type Profile = {
  id: string;
  label_en: string;
  background: string;
  match: (ctx: MatchCtx) => boolean;
  soWhat: (v: View) => string;
  scenarios: (v: View) => ForecastScenario[];
  watchpoints: (v: View) => string[];
  questions: (v: View) => string[];
};

type MatchCtx = {
  text: string;
  hotThemes: string[];
  deskPrimary?: string;
  primaryKind?: string;
  cards: string[];
};

const PROFILES: Profile[] = [
  /* ------------------------------------------------------- Taiwan Strait */
  {
    id: "taiwan_strait",
    label_en: "Taiwan Strait",
    background:
      "Cross-Strait exchange policy is run as administrative programme management: eligibility, approved organisers and permissible themes are set by measure rather than by open access, and central framing is delivered through provincial Taiwan-affairs offices.",
    match: (c) => c.hotThemes.includes("taiwan_strait"),
    soWhat: (v) =>
      compose([
        v.instrEn && v.amountEn
          ? `This would move cross-Strait policy from general messaging toward a funded, administratively managed exchange programme: the money makes delivery credible while ${v.instrEn} implies eligibility rules, approved organisers and bounded content rather than open access.`
          : v.amountEn
            ? `Putting ${v.amountEn} behind cross-Strait exchange work shifts it from declaratory framing toward a budgeted programme, but with no document named the administrative terms stay open.`
            : `The excerpt keeps cross-Strait exchange work at the level of declared intent, so the operative question is which administrative terms follow.`,
        v.isPilot
          ? `Pilot design points to controlled expansion rather than a broad reopening — participant numbers, approved counterparts and permissible themes would be set by the forthcoming measure rather than by demand.`
          : null,
        `Mainland exchange organisers, universities and youth associations are the likely beneficiaries; Taiwan-side participation depends on counterpart authorities that this text cannot bind, so uptake may fall short of the funded capacity.`,
        `The trade-off is contact versus control: wider youth exchange supports the stated peace-and-stability framing, while an administrative measure preserves the ability to gate who takes part and on what terms.`,
        capacityPiece(v),
      ]),
    scenarios: (v) => [
      {
        label: v.deadlineEn
          ? `A measure defines eligible organisers, funding channels and pilot locations for cross-Strait youth exchanges`
          : `A measure defines eligible organisers and funding channels for cross-Strait youth exchanges`,
        likelihood: v.amountEn ? "medium" : "low",
        horizon: v.deadlineEn ?? undefined,
        basis: `A funded pilot needs allocation rules before money can move, so the administrative text normally precedes disbursement (hypothesis).`,
        trigger:
          "A named implementing body, a draft measure for comment, or a published list of pilot provinces and approved organisers.",
        alternative:
          "The commitment stays declaratory and no measure is drafted, with cross-Strait messaging continuing to substitute for an administrative document (hypothesis).",
        falsifier:
          "No draft measure, comment period, or named implementing office appears within the stated window, and existing exchange programmes continue unchanged.",
        tag: "hypothesis",
      },
      {
        label: `Pilot exchanges widen to further provinces or participant categories after the first cohorts run`,
        likelihood: "low",
        horizon: v.deadlineEn ? `12-24 months after ${v.deadlineEn.replace(/^by /, "")}` : "12-24 months",
        basis: `Pilot framing and a floor-style funding figure both leave room to scale if early cohorts are judged administratively and politically manageable (hypothesis).`,
        trigger:
          "First-round funding awards, published participant quotas, or a second pilot batch naming additional provinces.",
        alternative:
          "The pilot stays capped at its original scope, with no expansion signal even after the first cohorts complete (hypothesis).",
        falsifier:
          "No second batch, quota increase, or additional pilot province is announced within 24 months of the first cohort's completion.",
        tag: "hypothesis",
      },
      {
        label: `The programme narrows to symbolic showcase events, or the measure is delayed`,
        likelihood: "medium",
        horizon: v.deadlineEn ?? undefined,
        basis: `Exchange programmes are sensitive to the wider cross-Strait climate, and with no named implementing body a quiet narrowing carries little institutional cost (hypothesis).`,
        trigger:
          "Sharper official cross-Strait rhetoric, suspension of existing exchange programmes, or no implementing body named before the stated deadline.",
        alternative:
          "The programme launches at its stated scope on schedule, with a named implementing body and published eligibility criteria (hypothesis).",
        falsifier:
          "A named implementing body and eligibility criteria are published before the stated deadline, and first-round participants are announced on schedule.",
        tag: "hypothesis",
      },
    ],
    watchpoints: (v) => [
      `Which body publishes ${v.instrEn || "the measure"} — the Taiwan Affairs Office, a ministry, or a joint issuance — and whether provincial offices receive delegated approval authority`,
      "Named pilot provinces or cities, and the eligibility rules for exchange organisers",
      v.amountEn
        ? `Disbursement rules for the ${v.amountEn}: allocation across years, per-organiser caps, and annual participant quotas`
        : "Whether any funding channel is identified for exchange programmes",
      "Whether reciprocal Taiwan-side participation or a counterpart programme is announced",
      v.deadlineEn
        ? `Whether first project awards appear before ${v.deadlineEn.replace(/^by /, "")} or the timetable slips`
        : "Whether first project awards are announced",
    ],
    questions: (v) => [
      `Which authority approves organisers and participants, and at what administrative level?`,
      "Which provinces or cities host the pilot, and may Taiwan-side institutions apply directly?",
      v.amountEn
        ? `How is the ${v.amountEn} allocated across years, organisers and participant numbers?`
        : "What funding channel would carry an exchange programme of this kind?",
      "What content, reporting or vetting conditions attach to funded exchanges?",
      "How would a deterioration in cross-Strait relations affect programmes already funded?",
    ],
  },

  /* ------------------------------------------------------- Critical minerals */
  {
    id: "critical_minerals",
    label_en: "Critical minerals",
    background:
      "Critical-mineral policy operates through export licensing, quota and processing controls, where China's leverage sits in midstream refining rather than in ore reserves, and partner responses run to stockpiling and substitution programmes.",
    match: (c) => c.hotThemes.includes("critical_minerals"),
    soWhat: (v) =>
      compose([
        v.prohibitionEn || /管制|禁止|不得/.test("")
          ? `Controls on this segment bite downstream rather than at the mine: buyers in magnets, batteries and defence-adjacent manufacturing face licensing delay and price risk well before any physical shortage appears.`
          : `The measure sits in the midstream processing layer, where licensing and quota decisions transmit to downstream buyers faster than to mining output.`,
        v.instrEn
          ? `${capitalise(v.instrEn)} would convert discretionary handling into published criteria, which cuts both ways: it gives exporters predictability while making the licensing decision an explicit policy instrument.`
          : null,
        v.amountEn
          ? `The ${v.amountEn} commitment points at capacity or processing investment rather than restriction alone, suggesting an industrial-upgrading aim alongside the control aim.`
          : null,
        `Domestic refiners and integrated processors gain from tighter administrative control of flows; foreign downstream manufacturers carry the cost, and their most likely response is qualifying alternative suppliers and accelerating substitution research.`,
        `The trade-off is leverage versus durability: restricting supply raises near-term influence but accelerates exactly the diversification that erodes it over a multi-year horizon.`,
      ]),
    scenarios: (v) => [
      publicationScenario(v, "with published licensing or quota criteria for the named segment"),
      {
        label: `Downstream buyers announce qualification of non-Chinese processing capacity or substitution programmes`,
        likelihood: "medium",
        horizon: "6-24 months",
        basis: `Administrative control of a midstream chokepoint historically prompts buyers to fund alternative refining and substitution rather than absorb licensing risk (hypothesis).`,
        trigger:
          "Offtake agreements with non-Chinese refiners, government stockpile announcements, or substitution results published by major downstream users.",
        alternative:
          "Buyers absorb the licensing delay without funding alternative supply, judging the control temporary or narrow enough to wait out (hypothesis).",
        falsifier:
          "No offtake agreement, stockpile announcement, or substitution result is disclosed by major downstream buyers within 24 months.",
        tag: "hypothesis",
      },
      {
        label: `Partner governments open trade-remedy, WTO or export-control countermeasures citing the named segment`,
        likelihood: "low",
        horizon: "6-18 months",
        basis: `Mineral supply measures have repeatedly drawn reciprocal control or consultation steps from affected economies (hypothesis).`,
        trigger: "A WTO consultation request, a reciprocal control list, or a coordinated partner statement naming the same materials.",
        alternative:
          "Partner governments respond through diplomatic consultation rather than formal trade-remedy action, judging the measure within existing WTO commitments (hypothesis).",
        falsifier:
          "No WTO consultation request, reciprocal control list, or coordinated partner statement naming the same materials appears within 18 months.",
        tag: "hypothesis",
      },
    ],
    watchpoints: () => [
      "Whether licence criteria and processing times are published, and whether end-use certification is required",
      "Export volumes and price spreads between domestic and offshore delivery for the named materials",
      "Downstream buyer announcements on qualifying alternative refiners or substitution",
      "Partner-government stockpile, subsidy or reciprocal-control decisions",
      "Whether domestic processing capacity additions are announced alongside the controls",
    ],
    questions: () => [
      "Which specific products and processing stages fall inside the control, and which are exempt?",
      "What licence criteria and decision timelines apply, and is end-use certification required?",
      "Which domestic processors gain allocation, and on what basis?",
      "How exposed are the largest downstream buyers, and what substitution options do they hold?",
      "What reciprocal measures have affected partners signalled?",
    ],
  },

  /* ---------------------------------------------------------- Semiconductors */
  {
    id: "semiconductors",
    label_en: "Semiconductors",
    background:
      "Chip policy runs through targeted funds, localisation targets and enterprise-support programmes, with the binding constraints sitting in advanced lithography access, EDA tooling and yield rather than in capital availability.",
    match: (c) => c.hotThemes.includes("semiconductors"),
    soWhat: (v) =>
      compose([
        v.amountEn && v.scopeEn
          ? `Directing ${v.amountEn} at ${v.scopeEn} spreads support across suppliers rather than concentrating it in a single fab, which favours breadth of domestic supply chain over leading-edge capability.`
          : v.amountEn
            ? `The ${v.amountEn} commitment adds capital to a sector whose binding constraint is tooling access and yield rather than funding, so the marginal effect depends heavily on where in the chain it lands.`
            : `Support language without an allocation leaves open the question that matters most: which layer of the chain — design, equipment, materials or packaging — actually receives help.`,
        stagePiece(v),
        `Established domestic foundries, equipment and materials suppliers are best placed to absorb the funds; smaller design houses gain only if eligibility is drawn widely, and foreign toolmakers face further substitution pressure in mature-node segments.`,
        `The trade-off is capacity versus efficiency: subsidising breadth builds resilience at mature nodes while risking duplicated capacity and margin compression, and it does not relieve the advanced-node constraint that export controls impose.`,
        v.prohibitionEn
          ? `The stated prohibition implies audit and clawback conditions on disbursement, which slows deployment but reduces the misallocation seen in earlier chip-fund rounds.`
          : null,
      ]),
    scenarios: (v) => [
      publicationScenario(v, "naming eligible enterprise categories and allocation criteria"),
      {
        label: `Mature-node capacity or domestic equipment qualification announcements follow the funding`,
        likelihood: "medium",
        horizon: "12-24 months",
        basis: `Funding aimed at supply-chain breadth transmits fastest to mature-node capacity and tool qualification, where technology barriers are lowest (hypothesis).`,
        trigger: "Award lists, new fab or packaging-line announcements, or domestic tool qualification disclosures.",
        alternative:
          "Funding is absorbed into existing operating budgets without new capacity or qualification announcements, and no award list is published (hypothesis).",
        falsifier:
          "No award list, new fab or packaging-line announcement, or domestic tool qualification disclosure appears within 24 months.",
        tag: "hypothesis",
      },
      {
        label: `Advanced-node progress stays constrained despite the funding, and support is redirected to packaging and materials`,
        likelihood: "medium",
        horizon: "18-36 months",
        basis: `Capital does not substitute for lithography and EDA access, so a funded programme can still stall at the advanced-node frontier (hypothesis).`,
        trigger: "Absence of leading-edge yield disclosures, or later measures re-weighting toward advanced packaging and materials.",
        alternative:
          "Advanced-node yield improves faster than expected despite the funding gap, narrowing rather than widening the gap with leading-edge competitors (hypothesis).",
        falsifier:
          "Leading-edge yield disclosures or advanced-node capacity announcements appear within 36 months, with no re-weighting toward packaging and materials.",
        tag: "hypothesis",
      },
    ],
    watchpoints: (v) => [
      `Which layer of the chain ${v.amountEn ? `the ${v.amountEn} reaches` : "receives support"} — design, equipment, materials, fabrication or packaging`,
      "Award lists and whether eligibility favours incumbents or smaller design and equipment firms",
      "Mature-node capacity additions and domestic tool qualification announcements",
      "Any change in export-control exposure for lithography, EDA or high-end accelerators",
      v.prohibitionEn ? "Audit, clawback and enforcement terms attached to disbursement" : "Whether audit conditions attach to disbursement",
    ],
    questions: (v) => [
      "Which enterprise categories and chain layers are eligible, and who decides?",
      v.amountEn ? `How is the ${v.amountEn} split between capacity, tooling and R&D?` : "What allocation would accompany this support language?",
      "What localisation or yield milestones condition continued funding?",
      "How much of the targeted capability depends on currently controlled foreign tooling?",
      "What happens to funded projects that miss their milestones?",
    ],
  },

  /* ----------------------------------------------------------------- China AI */
  {
    id: "china_ai",
    label_en: "China AI",
    background:
      "China's AI policy couples a governance track — model filing and algorithm registration before public deployment — with a capacity track of state-supported computing hubs, while advanced accelerator supply remains subject to external export controls.",
    match: (c) => c.hotThemes.includes("china_ai"),
    soWhat: (v) =>
      compose([
        v.instrEn && /filing|registration|备案/i.test(v.instrEn)
          ? `Pairing a model-filing measure with compute funding ties market access to registration: the governance track — who may deploy a model — and the capacity track — who gets compute — would move together, so approval throughput becomes as commercially decisive as hardware.`
          : v.instrEn
            ? `${capitalise(v.instrEn)} would set the terms on which models reach the public market, making the approval process itself a competitive variable.`
            : `Without a named governance document the excerpt leaves the deployment gate undefined, which is the variable that most affects commercial release timing.`,
        v.amountEn && v.scopeEn
          ? `Directing ${v.amountEn} at ${v.scopeEn} concentrates support in infrastructure rather than model development, favouring operators able to host hub-scale capacity over application developers.`
          : fundingPiece(v),
        v.prohibitionEn && /data/i.test(v.prohibitionEn)
          ? `The cross-border data restriction constrains multinationals and joint training arrangements, pushing data localisation and raising compliance cost for foreign-linked AI services, while giving domestic providers a structural advantage in regulated sectors.`
          : null,
        `Compute funding does not resolve access to advanced accelerators, so hub build-out stays exposed to export-control conditions and to domestic chip yield — capacity targets may be met on paper with lower-performance silicon.`,
        `The trade-off is capability versus control: filing gives regulators visibility and a gate, at the cost of a delay between model readiness and commercial release that compounds against faster-moving markets.`,
      ]),
    scenarios: (v) => [
      {
        label: v.instrEn
          ? `Filing rules for large models are published with defined scope, review timelines and operator obligations`
          : `Model governance rules are published with defined scope and review timelines`,
        likelihood: v.deadlineEn ? "medium" : "low",
        horizon: v.deadlineEn ?? undefined,
        basis: `A filing requirement cannot operate without published scope and review procedure, and the excerpt already commits to the document (hypothesis).`,
        trigger: "A draft measure for public comment, a named review body, or the first published filing decisions.",
        alternative:
          "Filing stays an internal administrative practice with no published scope or review timeline, and enforcement remains discretionary case-by-case (hypothesis).",
        falsifier:
          "No draft measure, named review body, or published filing decision appears within the stated window.",
        tag: "hypothesis",
      },
      {
        label: `Compute-hub awards concentrate in a few provinces with existing data-centre clusters, with published capacity or utilisation targets`,
        likelihood: "medium",
        horizon: v.deadlineEn ? `within 12 months of ${v.deadlineEn.replace(/^by /, "")}` : "12 months",
        basis: `Hub-scale funding follows existing power, land and network endowments, which are concentrated in a small number of provinces (hypothesis).`,
        trigger: "Award lists, provincial matching funds, or disclosed hub capacity and utilisation figures.",
        alternative:
          "Compute support is spread thinly across many provinces for political balance rather than concentrated where infrastructure already exists (hypothesis).",
        falsifier:
          "No award list, provincial matching fund, or disclosed hub capacity figure appears within 12 months of the stated deadline.",
        tag: "hypothesis",
      },
      {
        label: `Filing review or accelerator supply becomes the binding constraint, slowing commercial launches despite available funding`,
        likelihood: "medium",
        horizon: "12-24 months",
        basis: `Funding addresses capacity, not approval throughput or chip access, so either can bind first and neither is resolved by this text (hypothesis).`,
        trigger:
          "Lengthening approval queues, hub utilisation shortfalls, or tighter external controls on high-end accelerators.",
        alternative:
          "Filing throughput and accelerator supply both keep pace with funded capacity, and commercial launches proceed on the stated timeline (hypothesis).",
        falsifier:
          "Approval queues and hub utilisation stay stable and export-control conditions on high-end accelerators do not tighten within 24 months.",
        tag: "hypothesis",
      },
    ],
    watchpoints: (v) => [
      `Scope of the filing requirement — all large models, public-facing services only, or above a capability threshold`,
      "Whether filing operates as approval or notification, and the stated review timeline",
      v.amountEn
        ? `Which provinces and operators receive the ${v.amountEn}, and what capacity is disclosed`
        : "Which provinces and operators receive compute support",
      v.prohibitionEn ? "Enforcement of the cross-border data restriction against foreign-linked services" : "Data-handling conditions imposed on funded operators",
      "Domestic accelerator supply and any change in external export-control exposure",
    ],
    questions: (v) => [
      "Which models and services fall inside the filing requirement, and what is the review timeline?",
      v.amountEn ? `How is the ${v.amountEn} allocated between compute hubs, and on what capacity criteria?` : "What funding channel supports compute build-out?",
      "Which body adjudicates filings, and is there an appeal route?",
      "How do the data restrictions apply to joint ventures and foreign-linked services?",
      "What accelerator supply underpins the planned capacity, and is it domestically sourced?",
    ],
  },

  /* ------------------------------------------------------- Electric vehicles */
  {
    id: "electric_vehicles",
    label_en: "Electric vehicles",
    background:
      "EV policy has shifted from purchase subsidies toward supply-chain and infrastructure support, against a backdrop of domestic price competition, export growth and active anti-subsidy investigations in major export markets.",
    match: (c) => c.hotThemes.includes("electric_vehicles"),
    soWhat: (v) =>
      compose([
        v.amountEn && v.scopeEn
          ? `Directing ${v.amountEn} at ${v.scopeEn} keeps support in the battery and charging layer rather than in vehicle purchase incentives, which points to a shift from demand stimulus toward infrastructure and supply-chain build-out.`
          : v.amountEn
            ? `The ${v.amountEn} commitment adds state support to a sector already competing hard on price, so the effect depends on whether it lands on capacity or on utilisation.`
            : `Consolidation language without an allocation leaves open whether support goes to capacity, infrastructure or demand.`,
        `Incumbent battery makers and charging-network operators with existing pilot footprints are best placed to capture the funds; smaller entrants depend on how broadly eligibility is drawn, and the charging layer is where utilisation rather than capacity is the live constraint.`,
        v.prohibitionEn
          ? `The explicit anti-fraud line signals audit and clawback conditions on disbursement, which slows deployment but responds directly to the subsidy-fraud episodes that discredited earlier EV support rounds.`
          : null,
        `The trade-off is industrial support versus trade exposure: further state funding strengthens cost leadership in batteries and charging, while giving anti-subsidy investigations in the EU and other markets additional material to cite.`,
        stagePiece(v),
      ]),
    scenarios: (v) => [
      publicationScenario(v, "setting technical and eligibility conditions for battery and charging pilot funding"),
      {
        label: `Pilot funding is followed by capacity, utilisation or export announcements in the battery and charging segment`,
        likelihood: "medium",
        horizon: v.deadlineEn ? `12-18 months after ${v.deadlineEn.replace(/^by /, "")}` : "12-18 months",
        basis: `Infrastructure and cell support transmits to announced capacity faster than to end-demand, and provincial matching funds usually follow central pilot designation (hypothesis).`,
        trigger: "Award lists, provincial matching funds, new plant or charging-network targets.",
        alternative:
          "Funded capacity sits idle or under-utilised, with no matching export or utilisation announcements even after the pilot is designated (hypothesis).",
        falsifier:
          "No award list, provincial matching fund, or new plant/charging-network target is announced within 18 months of the stated deadline.",
        tag: "hypothesis",
      },
      {
        label: `Additional state support draws fresh trade-remedy action or tariff escalation in export markets`,
        likelihood: "medium",
        horizon: "6-18 months",
        basis: `Documented public support for the EV chain is the evidentiary basis anti-subsidy investigations rely on, and the named funding is publicly stated (hypothesis).`,
        trigger:
          "New anti-subsidy or countervailing filings citing Chinese EV-chain support, or tariff decisions in the EU or other major markets.",
        alternative:
          "Export markets treat the funding as consistent with existing trade commitments and take no new action, judging it below the threshold that triggers a case (hypothesis).",
        falsifier:
          "No new anti-subsidy filing, countervailing case, or tariff decision citing Chinese EV-chain support appears within 18 months.",
        tag: "hypothesis",
      },
    ],
    watchpoints: (v) => [
      "Whether the measure funds charging infrastructure, battery cells, or both, and the split between them",
      "Award lists, and whether they favour incumbent battery makers or new entrants",
      v.prohibitionEn ? "Audit and clawback conditions attached to the anti-fraud language" : "Whether audit conditions attach to disbursement",
      "Export volumes and any new anti-subsidy or tariff action in the EU, US or other markets",
      "Provincial matching funds and local charging-pile or utilisation targets",
    ],
    questions: (v) => [
      "Does the funding target battery cells, charging infrastructure, or both, and in what proportion?",
      v.amountEn ? `Over how many years is the ${v.amountEn} disbursed, and who administers it?` : "What allocation would accompany this support language?",
      "Which firms and provinces are eligible, and are new entrants included?",
      "What audit and clawback terms apply, and who enforces them?",
      "How would further trade-remedy action in export markets change the domestic support mix?",
    ],
  },

  /* ------------------------------------------------- Canada / bilateral trade */
  {
    id: "canada_trade",
    label_en: "Bilateral trade and diplomacy",
    background:
      "Bilateral trade friction runs through formal channels — anti-dumping and countervailing cases, WTO consultation requests, customs clearance practice — with dialogue-and-consultation language typically preceding or substituting for a procedural step.",
    match: (c) =>
      /中加|加方|加拿大/.test(c.text) ||
      c.deskPrimary === "foreign_affairs" ||
      c.primaryKind === "foreign_affairs",
    soWhat: (v) =>
      compose([
        v.instrEn
          ? `${capitalise(v.instrEn)} moves this from statement to procedure, which matters more than the tone: a named instrument creates a timetable and a record that a press formulation does not.`
          : `Naming the affected products while stopping short of a remedy step keeps this inside a consultation frame: it preserves negotiating room while leaving countermeasures available, so the signal here is the product list rather than any new instrument.`,
        v.subjectsEn.length
          ? `Exporters in ${v.subjectsEn.slice(0, 3).join(", ")} carry the near-term commercial exposure, while domestic processors and buyers of those inputs face cost risk if flows are disrupted — which is the constituency that argues against escalation.`
          : null,
        `Against the standing bilateral position, dialogue-and-consultation language is continuity rather than change; what would be new is a case number, a customs-practice change, or a scheduled consultation.`,
        `The trade-off is leverage versus supply: pressure on named agricultural and forestry products is politically legible and reversible, but it raises input costs domestically and invites reciprocal action on exposed export lines.`,
        v.deadlineEn ? `The stated timing gives the process a marker that can be checked against actual procedural steps.` : null,
      ]),
    scenarios: (v) => [
      {
        label: `Working-level consultations or a technical delegation on the named products are announced`,
        likelihood: "medium",
        horizon: "3-12 months",
        basis: `The excerpt leads with dialogue and consultation and names products without a remedy step, which is the pattern that normally precedes a scheduled bilateral channel (hypothesis).`,
        trigger: "An announced bilateral meeting or joint economic commission date, or a technical delegation visit.",
        alternative:
          "No bilateral channel is scheduled and the named products stay a recurring rhetorical point rather than the basis for a meeting (hypothesis).",
        falsifier:
          "No announced bilateral meeting, joint economic commission date, or technical delegation visit appears within 12 months.",
        tag: "hypothesis",
      },
      {
        label: `A formal trade-remedy step is opened on one of the named products`,
        likelihood: "low",
        horizon: "6-18 months",
        basis: `Naming specific products in an official statement establishes the public record that a subsequent anti-dumping, countervailing or WTO step would cite (hypothesis).`,
        trigger: "A ministry case notice with a docket number, a WTO consultation request, or a customs clearance change on those product lines.",
        alternative:
          "Both sides prefer to keep the issue at the consultation level indefinitely, judging a formal case too costly to the broader relationship (hypothesis).",
        falsifier:
          "No ministry case notice, WTO consultation request, or customs clearance change on the named product lines appears within 18 months.",
        tag: "hypothesis",
      },
      {
        label: `No procedural step follows and the named products remain a recurring press-conference item`,
        likelihood: "medium",
        horizon: "6-12 months",
        basis: `Consultation formulations frequently recur without an instrument attached, particularly where domestic buyers of the same inputs would absorb the cost of restriction (hypothesis).`,
        trigger: "Repeat statements with no case number, and stable customs clearance and shipment volumes.",
        alternative:
          "A procedural step follows relatively quickly, driven by domestic pressure from an affected industry rather than by the diplomatic cycle (hypothesis).",
        falsifier:
          "A case number, WTO filing, or customs clearance change appears within 12 months, or shipment volumes on the named products drop sharply.",
        tag: "hypothesis",
      },
    ],
    watchpoints: (v) => [
      v.subjectsEn.length
        ? `Whether a trade-remedy case is opened or concluded on ${v.subjectsEn.slice(0, 2).join(" or ")}, and the docket number`
        : "Whether a trade-remedy case is opened on the named products, and the docket number",
      "Shipment and customs-clearance volumes for the named product lines",
      "Any announced bilateral consultation date, delegation or joint commission session",
      "Whether the counterpart measures referenced in the excerpt are extended, narrowed or allowed to lapse",
      "Whether other export lines are drawn in as reciprocal pressure",
    ],
    questions: (v) => [
      v.subjectsEn.length
        ? `Which specific tariff lines within ${v.subjectsEn.slice(0, 2).join(" and ")} are affected, and what volumes do they carry?`
        : "Which specific tariff lines are affected, and what volumes do they carry?",
      "Is a formal consultation or remedy process already open, and at what stage?",
      "Which domestic industries depend on the same imports, and what is their exposure?",
      "What has the counterpart government signalled about the measures named here?",
      "What would each side need in order to de-escalate?",
    ],
  },

  /* -------------------------------------------------------- Macro / finance */
  {
    id: "macro_finance",
    label_en: "Economy and finance",
    background:
      "Macro-financial policy is transmitted through implementation vehicles — special-purpose bonds, refinancing programmes, delivery guarantees — whose effect depends on local fiscal capacity, and where debt and property risk are managed by reallocating burden rather than removing it.",
    match: (c) =>
      /地方债|隐性债务|房地产|保交楼|化债|财政政策|货币政策|扩大内需|稳增长|专项债/.test(c.text) ||
      c.deskPrimary === "economy_investment" ||
      ["finance_risk", "macro_policy", "economic_data", "leadership_meeting", "five_year_plan", "dual_circulation"].includes(
        c.primaryKind || ""
      ),
    soWhat: (v) =>
      compose([
        v.instrEn && v.amountEn
          ? `Pairing ${v.instrEn} with ${v.amountEn} identifies both a transmission vehicle and a size, which is what determines whether the commitment reaches balance sheets or stops at the provincial level.`
          : v.amountEn
            ? `The ${v.amountEn} commitment gives a size without naming the vehicle that carries it, and in this area the vehicle — transfer, bond quota or bank credit — decides who ultimately bears the cost.`
            : `Without a named vehicle or allocation, the burden question stays open: central transfer, local bond quota and bank credit distribute the same nominal support very differently.`,
        v.subjectsEn.some((s) => /debt|real estate|housing/i.test(s))
          ? `Local governments and developer creditors are the immediate beneficiaries of risk absorption; households gain indirectly through delivery of pre-sold housing, while banks and local fiscal capacity carry the residual exposure.`
          : `Recipients gain a funded channel while the financing side absorbs the residual risk, so the distribution of burden matters more than the headline figure.`,
        `The trade-off is stabilisation versus moral hazard: absorbing risk protects near-term delivery and confidence, while weakening the incentive for local authorities and developers to price risk in future.`,
        capacityPiece(v),
        stagePiece(v),
      ]),
    scenarios: (v) => [
      publicationScenario(v, "naming the transmission vehicle, quota allocation and eligibility"),
      {
        label: `Support is routed through local budgets and bond quotas, concentrating delivery in fiscally stronger provinces`,
        likelihood: "medium",
        horizon: "6-18 months",
        basis: `Where the excerpt names no central transfer mechanism, delivery historically depends on local fiscal capacity, which widens regional divergence (hypothesis).`,
        trigger: "Provincial bond issuance volumes, quota allocations, or published project lists skewed by region.",
        alternative:
          "A central transfer mechanism is named later, reducing regional divergence rather than leaving delivery to local fiscal capacity alone (hypothesis).",
        falsifier:
          "A named central transfer channel is published, or provincial bond issuance and project lists show even distribution rather than concentration in fiscally stronger provinces.",
        tag: "hypothesis",
      },
      {
        label: `Headline commitments are restated without a matching implementation vehicle, and transmission stays limited`,
        likelihood: v.instrEn ? "low" : "medium",
        horizon: "6-12 months",
        basis: `Direction-level commitments in this area repeatedly recur before an operative vehicle appears, and transmission requires the vehicle rather than the statement (hypothesis).`,
        trigger: "Repeat statements with no bond quota, refinancing programme or allocation rule attached.",
        alternative:
          "An implementation vehicle is published promptly, converting the commitment into an operative programme within a near-term window (hypothesis).",
        falsifier:
          "A bond quota, refinancing programme, or allocation rule is published within 12 months of this excerpt.",
        tag: "hypothesis",
      },
    ],
    watchpoints: (v) => [
      v.instrEn ? `Which vehicle carries ${v.instrEn} — central transfer, special-purpose bond quota, or bank credit` : "Which implementation vehicle is named: transfer, bond quota, or bank credit",
      v.amountEn ? `How the ${v.amountEn} is allocated across provinces and over what period` : "Whether an allocation figure is attached",
      "Provincial bond issuance and refinancing volumes, and regional skew in project lists",
      "Housing-delivery completion rates and developer refinancing outcomes",
      "Whether burden falls on central transfers, local budgets or bank balance sheets",
    ],
    questions: (v) => [
      "Which implementation vehicle carries this, and who bears the residual credit risk?",
      v.amountEn ? `How is the ${v.amountEn} allocated across provinces and years?` : "What allocation would accompany this commitment?",
      "Which provinces have the fiscal capacity to co-fund, and which do not?",
      "What eligibility conditions apply to developers or local financing vehicles?",
      "What measurable milestone would show transmission to households or balance sheets?",
    ],
  },

  /* ------------------------------------------------- Defense, public policy */
  {
    id: "defense_public",
    label_en: "Defense — public policy discourse",
    background:
      "Public defense discourse communicates policy posture, budget framing and industrial-base priorities. Yanxi reads it at public-policy level only: no readiness, order-of-battle or operational assessment.",
    match: (c) => c.deskPrimary === "defense_public" || c.primaryKind === "defense_public",
    soWhat: (v) =>
      compose([
        v.instrEn
          ? `${capitalise(v.instrEn)} would put public policy commitments into an administrative form, which is where budget and industrial-base consequences become checkable in open sources.`
          : `The excerpt stays at the level of declared policy posture, so the open-source consequence is industrial and budgetary rather than operational.`,
        `Domestic defence-industrial suppliers and their civilian technology partners are the identifiable beneficiaries of self-controllable-supply language; the cost side falls on procurement timelines and on civilian programmes competing for the same engineering capacity.`,
        `The trade-off is autonomy versus cost: localising critical inputs reduces external dependency while accepting higher unit cost and slower qualification than imported alternatives.`,
        `What is new versus continuity is best judged on the industrial clauses rather than the posture language, since defensive-policy formulations are highly stable in public texts.`,
        stagePiece(v),
      ]),
    scenarios: (v) => [
      {
        label: `Public industrial-base measures or self-controllable-supply programmes are named in follow-on open documents`,
        likelihood: "medium",
        horizon: v.deadlineEn ?? "12-24 months",
        basis: `Industrial-base language in public defense discourse is typically followed by open procurement or localisation programmes rather than by operational disclosure (hypothesis).`,
        trigger: "Published procurement catalogues, localisation targets, or named civil-military technology programmes.",
        alternative:
          "Industrial-base language stays at the posture level with no procurement catalogue or localisation programme published, consistent with how such formulations often recur without administrative follow-through (hypothesis).",
        falsifier:
          "No published procurement catalogue, localisation target, or named civil-military technology programme appears within the stated horizon.",
        tag: "hypothesis",
      },
      {
        label: `International military-exchange activity is announced consistent with the stated cooperation framing`,
        likelihood: "low",
        horizon: "6-18 months",
        basis: `Cooperation formulations in public statements sometimes precede announced exchanges, though the link is weak and frequently unrealised (hypothesis).`,
        trigger: "Announced bilateral defence dialogues, port visits, or joint exercise notifications in official releases.",
        alternative:
          "Cooperation language stays rhetorical, with no bilateral dialogue, visit, or exercise notification scheduled (hypothesis).",
        falsifier:
          "No announced bilateral defence dialogue, port visit, or joint exercise notification appears within 18 months.",
        tag: "hypothesis",
      },
      {
        label: `Public framing remains stable with no open industrial or exchange follow-through`,
        likelihood: "medium",
        horizon: "12 months",
        basis: `Public defense discourse is designed for continuity, so the absence of follow-through is the common outcome (hypothesis).`,
        trigger: "Repeat press-conference formulations without new procurement, localisation or exchange announcements.",
        alternative:
          "A concrete industrial or exchange announcement follows relatively quickly, breaking from the usual pattern of continuity-only public defense discourse (hypothesis).",
        falsifier:
          "A new procurement, localisation, or exchange announcement appears within 12 months that goes beyond repeat press-conference formulations.",
        tag: "hypothesis",
      },
    ],
    watchpoints: () => [
      "Published white papers or budget documents that quantify the stated priorities",
      "Open procurement catalogues, localisation targets and named industrial-base programmes",
      "Announced international defence dialogues, exchanges or exercise notifications",
      "Civil-military technology programmes drawing on the same engineering capacity",
      "Whether cooperation language is matched by specific announced activity",
    ],
    questions: () => [
      "Which open industrial or procurement programmes would carry these priorities?",
      "What budget framing accompanies the stated policy in public documents?",
      "Which named international exchanges, if any, follow the cooperation language?",
      "Which civilian sectors supply the same capabilities, and what is the capacity trade-off?",
      "What in this text differs from the standing public formulation?",
    ],
  },

  /* ----------------------------------------------------- Social governance */
  {
    id: "social_governance",
    label_en: "Social governance",
    background:
      "Social-governance policy is delivered by local administration, where livelihood commitments and stability-management commitments compete for the same grassroots staffing and budget, and central direction is mediated by county-level capacity.",
    match: (c) =>
      c.deskPrimary === "social_governance" ||
      ["social_governance", "ideology_party", "rural_revitalization"].includes(c.primaryKind || ""),
    soWhat: (v) =>
      compose([
        v.instrEn && v.amountEn
          ? `Pairing ${v.instrEn} with ${v.amountEn} turns a governance commitment into a funded local programme, which is the point at which grassroots staffing becomes the binding constraint rather than policy intent.`
          : `Governance commitments of this kind are delivered by county and township administration, so the operative variable is local staffing and budget rather than the wording of the direction.`,
        `Residents gain where dispute resolution and livelihood services are actually staffed; the cost falls on grassroots personnel who absorb both service delivery and stability-management duties from the same headcount.`,
        `The trade-off is service versus control: livelihood and mediation work builds local legitimacy, while public-opinion management competes for the same capacity and can displace it when priorities tighten.`,
        `What would be genuinely new is a staffing, funding or performance-assessment change, since governance-innovation language itself recurs continuously in local texts.`,
        capacityPiece(v),
      ]),
    scenarios: (v) => [
      {
        label: `Local implementation rules assign staffing, budget or performance-assessment weight to the stated priorities`,
        likelihood: "medium",
        horizon: v.deadlineEn ?? "6-18 months",
        basis: `Governance directions change behaviour only when they enter cadre performance assessment or local budgets, which is the usual next step (hypothesis).`,
        trigger: "Published local implementation rules, staffing allocations, or assessment criteria naming these priorities.",
        alternative:
          "The direction is absorbed into existing local work plans without a distinct staffing, budget, or assessment change, consistent with how governance language often recurs without administrative follow-through (hypothesis).",
        falsifier:
          "No published local implementation rule, staffing allocation, or assessment criterion naming these priorities appears within a near-term window.",
        tag: "hypothesis",
      },
      {
        label: `Livelihood and mediation commitments are delivered unevenly, concentrated in better-resourced districts`,
        likelihood: "medium",
        horizon: "12 months",
        basis: `Grassroots delivery depends on county fiscal capacity, which varies widely and is not addressed in this text (hypothesis).`,
        trigger: "Divergent district-level service statistics, or complaint and mediation caseload data.",
        alternative:
          "Delivery is more even than fiscal capacity would predict, because central transfers or provincial equalisation funding offset the county-level gap (hypothesis).",
        falsifier:
          "District-level service and mediation statistics show comparable delivery across better- and worse-resourced counties within 12 months.",
        tag: "hypothesis",
      },
      {
        label: `Stability-management work crowds out livelihood service delivery at the grassroots level`,
        likelihood: "low",
        horizon: "12-24 months",
        basis: `The same personnel carry both functions, so a tightening of public-opinion priorities reallocates capacity away from services (hypothesis).`,
        trigger: "Local reporting that reweights toward public-opinion tasks, or reduced mediation and service throughput.",
        alternative:
          "Livelihood service delivery holds steady even as stability-management demands rise, because the two functions draw on separate budget lines or personnel (hypothesis).",
        falsifier:
          "Local reporting and service throughput show no reallocation toward public-opinion tasks within 12-24 months.",
        tag: "hypothesis",
      },
    ],
    watchpoints: () => [
      "Local implementation rules that assign staffing, budget or assessment weight",
      "District-level service, complaint and mediation caseload statistics",
      "Whether dispute-resolution mechanisms receive dedicated personnel or are added to existing duties",
      "Livelihood spending lines in local budgets",
      "Balance between public-opinion tasks and service delivery in local reporting",
    ],
    questions: () => [
      "Which administrative level funds and staffs this, and from which budget line?",
      "What measurable service outcome would show delivery rather than restatement?",
      "Which populations are intended beneficiaries, and which are likely to be missed?",
      "How is performance assessed, and what weight does it carry for local cadres?",
      "What happens to service capacity when stability-management demands rise?",
    ],
  },
];

/** Generic content analysis when no domain profile matches. */
const GENERIC: Profile = {
  id: "general_policy",
  label_en: "Public policy",
  background:
    "Public policy commitments become checkable when an issuing body, an instrument, an allocation and a timetable are all identified; where one is missing, that gap usually decides the outcome.",
  match: () => true,
  soWhat: (v) =>
    compose([
      stagePiece(v),
      fundingPiece(v),
      v.scopeEn
        ? `Scope is bounded to ${v.scopeEn}, so the effect would be limited to the named perimeter rather than applying generally.`
        : null,
      v.subjectsEn.length
        ? `The identifiable interests are in ${v.subjectsEn.slice(0, 3).join(", ")}, where recipients of support gain and competing claims on the same budget lose.`
        : null,
      capacityPiece(v),
      v.prohibitionEn
        ? `The stated prohibition implies enforcement and audit conditions, which is where compliance cost falls.`
        : null,
    ]),
  scenarios: (v) => [
    publicationScenario(v, "naming the issuing body, eligibility and allocation"),
    {
      label: `Implementation concentrates where administrative capacity already exists, leaving coverage uneven`,
      likelihood: "medium",
      horizon: v.deadlineEn ? `12 months after ${v.deadlineEn.replace(/^by /, "")}` : "12 months",
      basis: `Delivery of a commitment with no named implementing body follows existing administrative capacity rather than stated intent (hypothesis).`,
      trigger: "Award or project lists showing regional concentration, or provincial matching commitments.",
      alternative:
        "Implementation is spread deliberately across weaker-capacity regions as a matter of equity policy, rather than following existing administrative strength (hypothesis).",
      falsifier:
        "Award or project lists show even geographic distribution rather than concentration in higher-capacity regions.",
      tag: "hypothesis",
    },
    slippageScenario(v, "a narrower version of the stated commitment"),
  ],
  watchpoints: (v) => [
    v.instrEn ? `Which body issues ${v.instrEn}, and whether the published text keeps the funded element` : "Which body issues the implementing document",
    v.amountEn ? `Allocation rules for the ${v.amountEn}: recipients, period and per-recipient caps` : "Whether an allocation figure is attached",
    v.scopeEn ? `Named locations and participants inside ${v.scopeEn}` : "The geographic and sectoral perimeter",
    v.deadlineEn ? `Whether the first concrete decisions land before ${v.deadlineEn.replace(/^by /, "")}` : "Whether a timetable is published",
    v.prohibitionEn ? "Enforcement and penalty terms behind the stated prohibition" : "Enforcement terms attached to the commitment",
  ],
  questions: (v) => [
    v.instrEn ? `Which authority issues ${v.instrEn}, and under what document number?` : "Which authority would issue the implementing document?",
    v.amountEn ? `How is the ${v.amountEn} allocated, over what period, and to whom?` : "What allocation would accompany this commitment?",
    v.scopeEn ? `Which locations and participants fall inside ${v.scopeEn}?` : "What is the geographic and sectoral perimeter?",
    "Who gains and who bears the cost of this allocation?",
    "What enforcement or reporting obligations apply?",
  ],
};

/** All domain profile ids + labels, for the human-review domain-picker (UI/API). */
export function listProfileOptions(): { value: string; label_en: string }[] {
  return [...PROFILES, GENERIC].map((p) => ({ value: p.id, label_en: p.label_en }));
}

/**
 * `forcedId` bypasses keyword matching entirely — used when a human review
 * override picks a specific domain instead of the general_policy fallback.
 * Falls back to normal matching when the id is unknown.
 */
export function pickProfile(ctx: MatchCtx, forcedId?: string): Profile {
  if (forcedId) {
    const forced = [...PROFILES, GENERIC].find((p) => p.id === forcedId);
    if (forced) return forced;
  }
  for (const p of PROFILES) {
    if (p.match(ctx)) return p;
  }
  return GENERIC;
}

export function buildContentAnalysis(
  facts: FactSet,
  ctx: MatchCtx & { sourceCount?: number; forcedProfileId?: string }
): ContentAnalysis {
  const v = buildView(facts, ctx.sourceCount ?? 1);
  const profile = pickProfile(ctx, ctx.forcedProfileId);

  const so_what = profile.soWhat(v).trim();
  const scenarios = profile
    .scenarios(v)
    .filter((s) => s.label && s.basis)
    .map(ensureFourPiece);
  const watchpoints = [...new Set(profile.watchpoints(v).filter(Boolean))].slice(0, 6);
  const open_questions = [...new Set(profile.questions(v).filter(Boolean))].slice(0, 5);

  return {
    framing: "civilian-content-analysis",
    domain: profile.id,
    domain_label_en: profile.label_en,
    background: profile.background,
    so_what:
      so_what ||
      "The excerpt does not carry enough substantive detail to support impact analysis.",
    scenarios: scenarios.slice(0, 3),
    watchpoints,
    open_questions,
    tag: "hypothesis",
  };
}
