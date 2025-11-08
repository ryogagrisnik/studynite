// /lib/openai.ts
import OpenAI from "openai";

type GptArgs = {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  model?: string; // optional override
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Simple wrapper for Chat Completions.
 * - If json=true, expects a JSON object and returns parsed JSON.
 * - Otherwise returns the assistant text string.
 */
export async function gpt({ system, user, json = false, temperature = 0.2, model }: GptArgs): Promise<any> {
  const res = await client.chat.completions.create({
    model: model || process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(json
      ? { response_format: { type: "json_object" as const } }
      : {}),
  });

  const content = res.choices?.[0]?.message?.content ?? "";

  if (json) {
    try {
      return JSON.parse(content);
    } catch {
      // If the model returns code-fences, strip and retry
      const cleaned = content.replace(/^```json\s*|\s*```$/g, "");
      return JSON.parse(cleaned);
    }
  }

  return content;
}
