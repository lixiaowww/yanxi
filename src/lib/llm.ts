import type { BriefingJson } from "./gate.js";

type ProviderConfig = { baseUrl: string; model: string; apiKey: string };

function primaryProvider(): ProviderConfig | null {
  const { LLM_BASE_URL, LLM_MODEL, LLM_API_KEY } = process.env;
  if (!LLM_BASE_URL || !LLM_MODEL || !LLM_API_KEY) return null;
  return { baseUrl: LLM_BASE_URL, model: LLM_MODEL, apiKey: LLM_API_KEY };
}

function fallbackProvider(): ProviderConfig | null {
  const { LLM_FALLBACK_BASE_URL, LLM_FALLBACK_MODEL, LLM_FALLBACK_API_KEY } = process.env;
  if (!LLM_FALLBACK_BASE_URL || !LLM_FALLBACK_MODEL || !LLM_FALLBACK_API_KEY) return null;
  return { baseUrl: LLM_FALLBACK_BASE_URL, model: LLM_FALLBACK_MODEL, apiKey: LLM_FALLBACK_API_KEY };
}

export function llmConfigured(): boolean {
  return primaryProvider() !== null;
}

export function llmFallbackConfigured(): boolean {
  return fallbackProvider() !== null;
}

function extractJsonObject(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "{}";
  if (text.startsWith("{")) return text;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

async function callProvider<T>(
  provider: ProviderConfig,
  system: string,
  user: string,
  opts?: { timeoutMs?: number }
): Promise<T> {
  const base = provider.baseUrl.replace(/\/$/, "");
  const { model, apiKey: key } = provider;

  const messages = [
    {
      role: "system",
      content: `${system}\n\nCRITICAL: Return ONLY one valid JSON object. No markdown code fences. No prose before/after JSON.`,
    },
    { role: "user", content: user },
  ];

  async function once(withJsonFormat: boolean): Promise<string> {
    const payload: Record<string, unknown> = {
      model,
      temperature: 0.2,
      messages,
    };
    if (withJsonFormat) {
      payload.response_format = { type: "json_object" };
    }
    const ctrl = new AbortController();
    const timer = opts?.timeoutMs ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : undefined;
    let res: Response;
    let t: string;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      t = await res.text();
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res.ok) {
      throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 280)}`);
    }
    const data = JSON.parse(t) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content || "{}";
  }

  let content: string;
  try {
    content = await once(true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Some OpenAI-compatible providers (Groq especially) reject complex
    // schemas under response_format=json_object.
    if (/json_validat|Failed to validate JSON|response_format/i.test(msg)) {
      content = await once(false);
    } else {
      throw e;
    }
  }

  try {
    return JSON.parse(extractJsonObject(content)) as T;
  } catch {
    content = await once(false);
    return JSON.parse(extractJsonObject(content)) as T;
  }
}

/** Back-compat single-provider call — used by scenario-enrich.ts's optional pass. */
export async function callLlmJson<T = BriefingJson>(
  system: string,
  user: string,
  opts?: { timeoutMs?: number }
): Promise<T> {
  const provider = primaryProvider();
  if (!provider) throw new Error("LLM not configured");
  return callProvider<T>(provider, system, user, opts);
}

/**
 * Main briefing call: try the primary provider, and on ANY failure — a
 * rate limit is the one seen in practice on Groq's free/on-demand tier,
 * but network errors count too — fall through to an optional secondary
 * provider (e.g. DeepSeek) before the caller gives up to the offline
 * template path. Returns which provider actually answered so the response
 * can say so; throws only when neither provider works (or none configured).
 */
export async function callLlmJsonWithFallback<T = BriefingJson>(
  system: string,
  user: string,
  opts?: { timeoutMs?: number }
): Promise<{ data: T; provider: "primary" | "fallback" }> {
  const primary = primaryProvider();
  if (!primary) throw new Error("LLM not configured");
  try {
    return { data: await callProvider<T>(primary, system, user, opts), provider: "primary" };
  } catch (primaryError) {
    const fallback = fallbackProvider();
    if (!fallback) throw primaryError;
    try {
      return { data: await callProvider<T>(fallback, system, user, opts), provider: "fallback" };
    } catch {
      // Surface the primary's error — it's the one operators have a
      // dashboard/quota for and are most likely to act on.
      throw primaryError;
    }
  }
}
