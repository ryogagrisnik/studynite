import prisma from "../lib/prisma";

async function main() {
  const patterns = [
    "spanclass",
    "katex",
    "mathjax-pending",
    "data-mathjax",
    "vlist-",
    "pstrut",
  ];

  let touchedIds = new Set<string>();

  for (const pattern of patterns) {
    const updated = await prisma.question.updateMany({
      where: {
        explanation: {
          contains: pattern,
          mode: "insensitive",
        },
      },
      data: {
        explanation: null,
      },
    });
    if (updated.count > 0) {
      console.log(`Cleared ${updated.count} explanations containing "${pattern}"`);
    }
  }

  console.log("Cleanup complete. Any cleared explanations will be regenerated on demand.");
}

main()
  .catch((err) => {
    console.error("cleanup-explanations failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

