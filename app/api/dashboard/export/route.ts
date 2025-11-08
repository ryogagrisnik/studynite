import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

function csvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return '""';
  if (typeof value === "boolean") return value ? '"true"' : '"false"';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attempts = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      isCorrect: true,
      userAnswer: true,
      concept: true,
      question: {
        select: {
          exam: true,
          section: true,
          topic: true,
          answer: true,
          difficulty: true,
        },
      },
    },
  });

  const rows = [
    [
      "timestamp",
      "exam",
      "section",
      "topic",
      "concept",
      "difficulty",
      "correct",
      "answer",
      "user_answer",
    ]
      .map(csvValue)
      .join(","),
    ...attempts.map(entry =>
      [
        entry.createdAt.toISOString(),
        entry.question?.exam ?? "",
        entry.question?.section ?? "",
        entry.question?.topic ?? "",
        entry.concept ?? "",
        entry.question?.difficulty ?? "",
        entry.isCorrect,
        entry.question?.answer ?? "",
        entry.userAnswer,
      ]
        .map(csvValue)
        .join(",")
    ),
  ];

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=blobprep-progress.csv",
    },
  });
}
