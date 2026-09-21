import type { BriefingJson } from "./gate.js";

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL && process.env.LLM_MODEL);
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

export async function callLlmJson(system: string, user: string): Promise<BriefingJson> {
  const base = process.env.LLM_BASE_URL!.replace(/\/$/, "");
  const model = process.env.LLM_MODEL!;
  const key = process.env.LLM_API_KEY!;

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
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const t = await res.text();
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
    // Groq often rejects complex schemas under response_format=json_object
    if (/json_validat|Failed to validate JSON|response_format/i.test(msg)) {
      content = await once(false);
    } else {
      throw e;
    }
  }

  try {
    return JSON.parse(extractJsonObject(content)) as BriefingJson;
  } catch {
    content = await once(false);
    return JSON.parse(extractJsonObject(content)) as BriefingJson;
  }
}
