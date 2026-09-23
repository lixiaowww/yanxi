/** Shared client-side types for a BriefResponse, used by App.tsx and the presentational components. */

export type DigestRow = { point?: string; quote?: string; source_label?: string; source_url?: string };

export type Briefing = {
  source_digest_zh?: DigestRow[];
  context_notes?: { card?: string; note?: string; tag?: string }[];
  adoption?: {
    adopted?: boolean;
    label_zh?: string;
    reason_zh?: string;
    hard_nuggets?: { kind?: string; label_zh?: string; evidence?: string }[];
  };
  intake?: {
    label?: string;
    first_cut?: string;
    second_cut?: string | null;
    second_cut_engine?: string;
    reason_en?: string;
  };
  temporal?: {
    briefed_at?: string;
    collected_at?: string;
    source_as_of?: string;
    source_as_of_precision?: string;
    source_as_of_evidence?: string;
    freshness?: {
      band?: string;
      label_en?: string;
      age_days?: number;
      basis_en?: string;
    };
    forward_deadlines_en?: string[];
  };
  brief_quality?: {
    level?: string;
    label_en?: string;
    missing?: string[];
  };
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
    nuggets?: { kind?: string; label_zh?: string; evidence?: string; value_en?: string }[];
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
    hot_themes?: { id?: string; label_en?: string; evidence?: string }[];
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
    label_en?: string;
    missing?: string[];
    drivers?: string[];
    shared_subjects?: string[];
    cross_checked?: boolean;
    distinct_source_count?: number;
    channel_tier_spread?: {
      tiers?: string[];
      cross_tier?: boolean;
      note_en?: string;
    };
  };
  absence_signal?: {
    hits?: {
      subject_label?: string;
      prior_coverage_count?: number;
      last_prior_at?: string;
      gap_days?: number;
      pattern_match?: boolean;
    }[];
    note_en?: string;
  };
  source_credibility?: {
    level?: string;
    score_0_to_1?: number;
    caps_applied?: string[];
    rationale?: string;
    factors?: {
      provenance?: string;
      source_class?: string;
      source_tier?: string;
      source_tier_weight_0_to_1?: number;
      channel_tier?: string;
      channel_authority_weight?: number;
    };
    source_tier?: {
      tier?: string;
      weight_0_to_1?: number;
      label_zh?: string;
      max_confidence?: string;
      rationale_zh?: string;
    };
    channel_tier?: { tier?: string; label_en?: string; authority_weight?: number; basis_en?: string };
  };
  analysis_confidence?: {
    level?: string;
    score_0_to_1?: number;
    caps_applied?: string[];
    rationale?: string;
    factors?: {
      signaling_band?: string;
      substance_band?: string;
      corroboration_0_to_3?: number;
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
  signaling_scorecard?: {
    weighted_total?: number;
    band?: string;
    rules?: { category?: string; status?: string }[];
  };
  signaling_valves?: {
    sequence?: { status?: string; observation?: string };
    implementing_detail?: { status?: string; observation?: string };
    press_placement?: { status?: string; observation?: string };
    calibration?: string;
  };
  briefing_en?: {
    headline?: string;
    what?: string;
    context?: string;
    so_what?: string;
    confidence?: string;
    sources_used?: string[];
  };
  policy_outlook?: {
    horizon?: string;
    scenarios?: {
      label?: string;
      likelihood?: string;
      basis?: string;
      trigger?: string;
      horizon?: string;
      alternative?: string;
      falsifier?: string;
    }[];
    watchpoints?: string[];
  };
  open_questions?: string[];
  content_analysis?: {
    domain?: string;
    domain_label_en?: string;
    background?: string;
    so_what?: string;
    scenarios?: {
      label?: string;
      likelihood?: string;
      basis?: string;
      horizon?: string;
      trigger?: string;
      alternative?: string;
      falsifier?: string;
    }[];
    watchpoints?: string[];
    open_questions?: string[];
  };
  human_review?: {
    id: "source_class" | "intake_gray" | "domain_profile";
    question_en: string;
    options: { value: string; label_en: string }[];
    system_pick: string;
    system_pick_label_en: string;
    status: "open" | "resolved";
    resolved_value?: string;
  }[];
};

export type RelatedBriefRow = {
  id: string;
  label: string;
  createdAt: string;
  jsonFile: string;
  shared_keys: string[];
  desk?: string;
  what_preview?: string;
  corroboration_band?: string;
  canada_nexus?: string;
  note_en: string;
};

export type ApiResult = {
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
  sourceCount?: number;
  relatedBriefs?: RelatedBriefRow[];
};

/** A saved outbox brief as listed by /api/outbox — the Reader's list view row. */
export type OutboxListRow = {
  id: string;
  subscriptionId: string;
  createdAt: string;
  sourceLabel: string;
  gatePassed: boolean;
  triage?: { primary_kind?: string; importance?: { grade?: string; label_zh?: string } };
  headline?: string;
  what?: string;
  desk?: { id: string; label_en?: string };
  briefQuality?: string;
  analysisConfidence?: string;
  sourceCredibility?: string;
  adopted?: boolean;
  deferred?: boolean;
  canadaNexus?: string;
  provenance?: "live" | "fixture_demo";
  jsonUrl: string;
  mdUrl: string;
};

/** A saved outbox record's full JSON shape — what jsonUrl points to. */
export type OutboxRecordJson = {
  id: string;
  createdAt: string;
  source: { label: string; sourceText?: string; url?: string };
  result: ApiResult;
};

export type DeskCatalogRow = {
  id: string;
  label_zh?: string;
  label_en?: string;
  blurb_zh?: string;
};
