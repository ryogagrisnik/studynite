// app/api/explain/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import OpenAI from "openai";
import { sanitizeExplanation } from "@/lib/explainer";

const Classic = z.object({
  stem: z.string(),
  choices: z.array(z.string()).min(2),
  correctIndex: z.number().int().nonnegative().optional(),
  userIndex: z.number().int().nonnegative().optional(),
  questionId: z.string().optional(),
});
const SentenceEquivalence = z.object({
  kind: z.string().optional(),
  stem: z.string(),
  choices: z.array(z.string()).min(4),
  correctIndices: z.array(z.number().int().nonnegative()).length(2),
  questionId: z.string().optional(),
});
const TextCompletionMulti = z.object({
  kind: z.string().optional(),
  stem: z.string(),
  choices: z.array(z.array(z.string().min(1))).min(2),
  questionId: z.string().optional(),
});
const ReadingComp = z.object({
  kind: z.string().optional(),
  stem: z.string(),
  choices: z.array(z.string()).min(2),
  correctIndex: z.number().int().nonnegative().optional(),
  questionId: z.string().optional(),
});

const Input = z.union([Classic, SentenceEquivalence, TextCompletionMulti, ReadingComp]);

function json(x: any, status = 200) {
  return NextResponse.json(x, { status });
}
function letters(arr: string[]) {
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return arr.map((s, i) => `${ABC[i]}. ${s}`);
}
function promptFor(b: z.infer<typeof Input>) {
  if ("correctIndices" in b) {
    const pair = b.correctIndices.map(i => b.choices[i]).filter(Boolean).join(" + ");
    return [
      "Format: GRE Verbal — Sentence Equivalence",
      pair ? `Correct pair: ${pair}` : "",
      `Sentence:\n${b.stem}`,
      `Choices:\n${letters(b.choices).join("\n")}`,
      "Explain the shared idea, and why others fail. ≤ 180 words, inline $...$, no code fences."
    ].filter(Boolean).join("\n");
  }
  if (Array.isArray((b as any).choices?.[0])) {
    const blanks = (b.choices as string[][])
      .map((opts, i) => `Blank ${i + 1}: ${letters(opts).join("  ")}`).join("\n");
    return [
      "Format: GRE Verbal — Text Completion (multi-blank)",
      `Sentence:\n${b.stem}`,
      `Options:\n${blanks}`,
      "Give the correct choice for each blank with brief reasoning. ≤ 180 words, inline $...$."
    ].join("\n");
  }
  const correct =
    typeof (b as any).correctIndex === "number" ? (b as any).choices[(b as any).correctIndex] : undefined;
  return [
    "Format: GRE Verbal",
    correct ? `Correct: ${correct}` : "",
    `Text:\n${b.stem}`,
    `Choices:\n${letters((b as any).choices).join("\n")}`,
    "Short explanation (≤ 180 words). Inline $...$. No code fences."
  ].filter(Boolean).join("\n");
}
function fallback(b: z.infer<typeof Input>) {
  if ("correctIndices" in b) {
    return "Pick the two words producing the same meaning and tone; use context and signal words. Eliminate off-scope, extreme, or contradictory options.";
  }
  if (Array.isArray((b as any).choices?.[0])) {
    return "For each blank, use logical/tonal cues (contrast/continuation, cause/effect) to pick words that fit; avoid contradictions and redundancies.";
  }
  return "Choose the option best supported by the sentence’s logic and tone; eliminate choices that are off-topic, too strong, or that break key cues.";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return json({ error: "UNAUTHENTICATED" }, 401);

    const raw = await req.json().catch(() => ({}));
    const parsed = Input.safeParse(raw);

    // If payload doesn’t match any schema, return a safe fallback (do NOT 400)
    if (!parsed.success) {
      return json({ explanation: fallback({ stem: raw?.stem || "", choices: raw?.choices || [] } as any) }, 200);
    }

    const body = parsed.data;

    // DB cache (guarded so Prisma outages never 400)
    if ((body as any).questionId) {
      try {
        const q = await prisma.question.findUnique({
          where: { id: (body as any).questionId as string },
          select: { explanation: true },
        });
        if (q?.explanation) return json({ explanation: q.explanation });
      } catch { /* swallow prisma outage */ }
    }

    const useApi = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10;
    let text: string;

    if (useApi) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const out = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: "You are a concise GRE Verbal tutor. Explain in 4–8 sentences. Use inline $...$ for symbols. No markdown fences." },
            { role: "user", content: promptFor(body) },
          ],
        });
        text = out.choices?.[0]?.message?.content?.trim() || fallback(body);
      } catch {
        text = fallback(body);
      }
    } else {
      text = fallback(body);
    }

    const clean = sanitizeExplanation ? sanitizeExplanation(text) : text;

    if ((body as any).questionId) {
      try {
        await prisma.question.update({
          where: { id: (body as any).questionId as string },
          data: { explanation: clean },
        });
      } catch { /* ignore prisma hiccups */ }
    }

    return json({ explanation: clean });
  } catch (e) {
    // Never fail the UI
    return json({ explanation: "Explanation unavailable right now. Use the sentence’s logic and tone to eliminate off-scope/contradictory choices." }, 200);
  }
}
