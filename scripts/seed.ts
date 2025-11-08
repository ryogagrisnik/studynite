import prisma from "../lib/prisma";
import { redis } from "../lib/redis";

const TOPICS = [
  "Number Properties",
  "Algebra",
  "Word Problems & Arithmetic",
  "Set Theory",
  "Statistics & Average",
  "Ratio / Percent / Fractions",
  "Rates / Work / Speed",
  "Permutation & Probability",
  "Geometry / Solid Geometry",
  "Coordinate Geometry",
  "Quantitative Comparison",
] as const;

const DIFFS: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];

async function main() {
  const qkey = "queue:GRE:Quant:algebra:easy";
  for (let i = 0; i < 50; i++) {
    const topic = TOPICS[i % TOPICS.length];
    const difficulty = DIFFS[i % DIFFS.length];
    const saved = await generateQuestion("GRE", "Quant", topic, difficulty);
    await redis.rpush(qkey, saved.id);
  }

  await prisma.question.deleteMany({
    where: {
      exam: "GRE",
      section: "Quant",
      createdAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60) },
    },
  });

  console.log("Seeded 50 GRE Quant questions into", qkey);
}

main().then(() => process.exit(0));

async function generateQuestion(
  _exam: string,
  _section: string,
  _topic: string,
  _difficulty: "easy" | "medium" | "hard"
): Promise<{ id: string }> {
  throw new Error("Question generator is not available in this build.");
}
