import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isDevUnlimitedEmail } from "@/lib/server/membership";
import DashboardClient from "./DashboardClient";
import type { DashboardData, SectionKey, SectionStat } from "./types";

const DAILY_FREE_LIMIT = 15;
const SECTION_ORDER: Array<{ exam: "GRE" | "GMAT"; section: "Quant" | "Verbal" }> = [
  { exam: "GRE", section: "Quant" },
  { exam: "GRE", section: "Verbal" },
  { exam: "GMAT", section: "Quant" },
  { exam: "GMAT", section: "Verbal" },
];

const MS_PER_DAY = 86_400_000;
const HISTORY_WINDOW_DAYS = 14;

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function differenceInDays(later: Date, earlier: Date) {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

function normalizeTopic(raw?: string | null, fallback = "Mixed practice") {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\s+/g, " ");
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    redirect("/signin?callbackUrl=/dashboard");
  }

  const userEmail = (session?.user as any)?.email as string | undefined;
  const emailVerified = Boolean((session?.user as any)?.emailVerified);
  const today = startOfTodayUTC();

  const [attempts, quotaToday, userRecord] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId },
      select: {
        createdAt: true,
        isCorrect: true,
        concept: true,
        question: {
          select: {
            exam: true,
            section: true,
            topic: true,
          },
        },
      },
    }),
    prisma.quotaLog.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { count: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { proExpiresAt: true, email: true },
    }),
  ]);

  const now = new Date();
  const proExpiresAt = userRecord?.proExpiresAt ?? null;
  const hasActivePro = !!(proExpiresAt && proExpiresAt > now);
  const unlimited =
    hasActivePro || isDevUnlimitedEmail(userEmail ?? userRecord?.email ?? null);

  let correctTotal = 0;
  const sectionBuckets = new Map<
    SectionKey,
    {
      exam: "GRE" | "GMAT";
      section: "Quant" | "Verbal";
      total: number;
      correct: number;
      topics: Map<string, { topic: string; total: number; correct: number }>;
    }
  >();
  const dailyTotals = new Map<
    string,
    {
      date: string;
      total: number;
      correct: number;
    }
  >();
  const sectionDailyTotals = new Map<SectionKey, Map<string, { total: number; correct: number }>>();
  for (const { exam, section } of SECTION_ORDER) {
    const key = `${exam}::${section}` as SectionKey;
    sectionDailyTotals.set(key, new Map());
  }

  for (const attempt of attempts) {
    if (attempt.isCorrect) correctTotal += 1;

    const exam = (attempt.question?.exam as "GRE" | "GMAT") || "GRE";
    const section = (attempt.question?.section as "Quant" | "Verbal") || "Quant";
    const key = `${exam}::${section}` as SectionKey;

    if (!sectionBuckets.has(key)) {
      sectionBuckets.set(key, {
        exam,
        section,
        total: 0,
        correct: 0,
        topics: new Map(),
      });
    }
    const bucket = sectionBuckets.get(key)!;
    bucket.total += 1;
    if (attempt.isCorrect) bucket.correct += 1;

    const topic = normalizeTopic(
      attempt.question?.topic || attempt.concept,
      section === "Quant" ? "Quant tactics" : "Reading skills"
    );
    if (!bucket.topics.has(topic)) {
      bucket.topics.set(topic, { topic, total: 0, correct: 0 });
    }
    const topicBucket = bucket.topics.get(topic)!;
    topicBucket.total += 1;
    if (attempt.isCorrect) topicBucket.correct += 1;

    const createdAt = attempt.createdAt ?? new Date();
    const dateKey = toDateKey(createdAt);
    if (!dailyTotals.has(dateKey)) {
      dailyTotals.set(dateKey, { date: dateKey, total: 0, correct: 0 });
    }
    const daily = dailyTotals.get(dateKey)!;
    daily.total += 1;
    if (attempt.isCorrect) daily.correct += 1;

    const sectionMap = sectionDailyTotals.get(key)!;
    if (!sectionMap.has(dateKey)) {
      sectionMap.set(dateKey, { total: 0, correct: 0 });
    }
    const sectionDaily = sectionMap.get(dateKey)!;
    sectionDaily.total += 1;
    if (attempt.isCorrect) sectionDaily.correct += 1;
  }

  const sections: SectionStat[] = SECTION_ORDER.map(({ exam, section }) => {
    const key = `${exam}::${section}` as SectionKey;
    const bucket = sectionBuckets.get(key);
    const total = bucket?.total ?? 0;
    const correct = bucket?.correct ?? 0;
    const topics =
      bucket
        ? Array.from(bucket.topics.values())
            .map(t => {
              const incorrect = Math.max(0, t.total - t.correct);
              return {
                ...t,
                incorrect,
                accuracy: t.total ? (t.correct / t.total) * 100 : 0,
              };
            })
            .sort((a, b) => {
              const diffIncorrect = b.incorrect - a.incorrect;
              if (diffIncorrect !== 0) return diffIncorrect;
              const diffAccuracy = a.accuracy - b.accuracy;
              if (diffAccuracy !== 0) return diffAccuracy;
              return b.total - a.total;
            })
        : [];

    return {
      key,
      label: `${exam} ${section}`,
      exam,
      section,
      total,
      correct,
      incorrect: Math.max(0, total - correct),
      accuracy: total ? (correct / total) * 100 : 0,
      topics,
    };
  });

  const sortedDays = Array.from(dailyTotals.keys()).sort();
  let runningStreak = 0;
  let longestStreak = 0;
  const streakByDate = new Map<string, number>();
  let previousDate: Date | null = null;

  for (const dateKey of sortedDays) {
    const dayDate = new Date(`${dateKey}T00:00:00.000Z`);
    if (!previousDate) {
      runningStreak = 1;
    } else {
      const diff = differenceInDays(dayDate, previousDate);
      runningStreak = diff === 1 ? runningStreak + 1 : 1;
    }
    streakByDate.set(dateKey, runningStreak);
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    previousDate = dayDate;
  }

  let currentStreak = 0;
  const lastActive = sortedDays.length ? sortedDays[sortedDays.length - 1] : null;
  if (lastActive) {
    const lastDate = new Date(`${lastActive}T00:00:00.000Z`);
    const diffToToday = differenceInDays(today, lastDate);
    const lastValue = streakByDate.get(lastActive) ?? 0;
    if (diffToToday <= 1) {
      currentStreak = lastValue;
    }
  }

  const history: DashboardData["history"] = [];
  const historyBySection: DashboardData["historyBySection"] = {
    "GRE::Quant": [],
    "GRE::Verbal": [],
    "GMAT::Quant": [],
    "GMAT::Verbal": [],
  };
  for (let i = HISTORY_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const day = subtractDays(today, i);
    const dateKey = toDateKey(day);
    const bucket = dailyTotals.get(dateKey);
    history.push({
      date: dateKey,
      total: bucket?.total ?? 0,
      correct: bucket?.correct ?? 0,
    });

    for (const { exam, section } of SECTION_ORDER) {
      const key = `${exam}::${section}` as SectionKey;
      const sectionBucket = sectionDailyTotals.get(key)?.get(dateKey);
      historyBySection[key].push({
        date: dateKey,
        total: sectionBucket?.total ?? 0,
        correct: sectionBucket?.correct ?? 0,
      });
    }
  }

  const data: DashboardData = {
    overallAccuracy: attempts.length ? (correctTotal / attempts.length) * 100 : 0,
    totalAttempts: attempts.length,
    dailyLimit: unlimited ? null : DAILY_FREE_LIMIT,
    dailyUsed: unlimited ? 0 : quotaToday?.count ?? 0,
    unlimited,
    sections,
    streak: {
      current: currentStreak,
      longest: longestStreak,
      lastActive,
    },
    history,
    historyBySection,
    isEmailVerified: emailVerified,
    email: userEmail ?? userRecord?.email ?? null,
  };

  return <DashboardClient data={data} />;
}
