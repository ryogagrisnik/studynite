import prisma from "../lib/prisma";

async function main() {
  // Add any corrupted substrings you want to purge here.
  const patterns = [
    "an d er a sers", // from "3 for 1.20 an d er a sers a t 2 f or 0"
  ];

  for (const pattern of patterns) {
    const bad = await prisma.question.findMany({
      where: {
        stem: {
          contains: pattern,
          mode: "insensitive",
        },
      },
      select: { id: true, stem: true },
    });

    if (!bad.length) {
      console.log(`No questions found with stem containing "${pattern}".`);
      continue;
    }

    console.log(`Deleting ${bad.length} question(s) containing "${pattern}":`);
    for (const q of bad) {
      console.log(`- ${q.id}: ${q.stem.slice(0, 120)}${q.stem.length > 120 ? "..." : ""}`);
    }

    const result = await prisma.question.deleteMany({
      where: {
        stem: {
          contains: pattern,
          mode: "insensitive",
        },
      },
    });
    console.log(`Deleted ${result.count} question(s) for pattern "${pattern}".`);
  }

  console.log("Bad question cleanup complete.");
}

main()
  .catch((err) => {
    console.error("delete-bad-questions failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

