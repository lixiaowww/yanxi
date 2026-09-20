/**
 * Optional Cursor SDK harness (local runtime).
 * Requires CURSOR_API_KEY. Does not replace the offline /api/brief path.
 *
 * Job-fit note: demonstrates IT tooling literacy for portfolio; still civilian research only.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Agent, CursorAgentError } from "@cursor/sdk";

const cwd = process.cwd();
const samplePath = path.join(cwd, "examples", "sample-input.json");

async function main() {
  if (!process.env.CURSOR_API_KEY) {
    console.error("CURSOR_API_KEY unset — skipping Cursor harness (offline demo still works via npm run demo).");
    process.exit(0);
  }

  const sample = JSON.parse(fs.readFileSync(samplePath, "utf8")) as {
    sourceText: string;
    sourceLabel?: string;
  };

  const prompt = [
    "You are helping author a civilian Yanxi research briefing draft.",
    "Read AGENTS.md and docs/ETHICS.md. Do not use intelligence/surveillance framing.",
    "Using the pasted public Mandarin text below, propose JSON matching the Yanxi briefing schema",
    "(source_digest_zh with verbatim quotes, context_notes, briefing_en, policy_outlook with hypothesis tags, open_questions).",
    "Prefer editing skills/context-cards if vocabulary is missing — do not invent classified facts.",
    `Source label: ${sample.sourceLabel || "sample"}`,
    "-----",
    sample.sourceText,
  ].join("\n");

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: process.env.CURSOR_API_KEY,
      model: { id: "composer-2.5" },
      local: { cwd },
    });

    if (result.status === "error") {
      console.error("Cursor harness run failed:", result.id);
      process.exit(2);
    }

    console.log("Cursor harness status:", result.status);
    console.log(result.result ?? "(no text result)");
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error("Cursor harness startup failed:", err.message, "retryable=", err.isRetryable);
      process.exit(1);
    }
    throw err;
  }
}

main();
