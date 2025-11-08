import OpenAI from "openai";

export const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // set in .env.local
});

export function compactJSON(v: any) {
  try { return JSON.stringify(v, null, 0); } catch { return ""; }
}
