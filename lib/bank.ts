// lib/bank.ts
import fs from "node:fs";
import path from "node:path";

export type BankItem = {
  id: string;
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  topic: string;
  type: "text_completion" | "sentence_equivalence" | "critical_reasoning" | "quant_mc";
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  choices?: string[];
  answer: string;      // for SE: "word1|word2"
  rationale?: string;
};

const BANK_PATH = path.join(process.cwd(), "content", "bank.json");
let CACHE: BankItem[] | null = null;

function loadBank(): BankItem[] {
  if (CACHE) return CACHE;
  const raw = fs.readFileSync(BANK_PATH, "utf8");
  CACHE = JSON.parse(raw) as BankItem[];
  return CACHE!;
}

export function topicsForSection(section: "Quant" | "Verbal"): string[] {
  const set = new Set<string>();
  for (const b of loadBank()) if (b.section === section) set.add(b.topic);
  return Array.from(set);
}

/** Sample up to k examples for (section, topic).
 *  If topic === "AUTO", sample from a random topic in the section.
 */
export function sampleByTopic(
  section: "Quant" | "Verbal",
  topic: string,
  k: number
): BankItem[] {
  const bank = loadBank();
  let pool: BankItem[];
  if (topic === "AUTO") {
    const topics = topicsForSection(section);
    const pick = topics[Math.floor(Math.random() * topics.length)];
    pool = bank.filter(b => b.section === section && b.topic === pick);
  } else {
    pool = bank.filter(b => b.section === section && b.topic === topic);
  }

  const out: BankItem[] = [];
  const used = new Set<number>();
  while (out.length < Math.min(k, pool.length)) {
    const i = Math.floor(Math.random() * pool.length);
    if (!used.has(i)) { used.add(i); out.push(pool[i]); }
  }
  return out;
}
