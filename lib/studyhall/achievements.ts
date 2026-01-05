import prisma from "@/lib/prisma";

export type AchievementMetrics = {
  deckCount: number;
  questionCount: number;
  partyHostedCount: number;
  partyCompletedCount: number;
  quizPartiesHosted: number;
  maxPartySize: number;
  joinedPartyCount: number;
  quizSubmissionCount: number;
  quizCorrectCount: number;
  soloAttemptCount: number;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  rank: string;
  earned: boolean;
};

export const emptyAchievementMetrics: AchievementMetrics = {
  deckCount: 0,
  questionCount: 0,
  partyHostedCount: 0,
  partyCompletedCount: 0,
  quizPartiesHosted: 0,
  maxPartySize: 0,
  joinedPartyCount: 0,
  quizSubmissionCount: 0,
  quizCorrectCount: 0,
  soloAttemptCount: 0,
};

export async function getAchievementMetrics(userId: string): Promise<AchievementMetrics> {
  const [
    deckCount,
    questionCount,
    partyHostedCount,
    partyCompletedCount,
    quizPartiesHosted,
    joinedParties,
    quizSubmissionCount,
    quizCorrectCount,
    soloAttemptCount,
    hostedParties,
  ] = await Promise.all([
    prisma.studyDeck.count({ where: { userId } }),
    prisma.studyQuestion.count({ where: { deck: { userId } } }),
    prisma.party.count({ where: { hostUserId: userId } }),
    prisma.party.count({ where: { hostUserId: userId, status: "COMPLETE" } }),
    prisma.party.count({ where: { hostUserId: userId, mode: "QUIZ" } }),
    prisma.partyPlayer.findMany({
      where: { userId },
      select: { partyId: true },
      distinct: ["partyId"],
    }),
    prisma.partySubmission.count({ where: { player: { userId } } }),
    prisma.partySubmission.count({ where: { player: { userId }, isCorrect: true } }),
    prisma.studyAttempt.count({ where: { userId } }),
    prisma.party.findMany({
      where: { hostUserId: userId },
      select: { _count: { select: { players: true } } },
    }),
  ]);

  const maxPartySize = hostedParties.reduce(
    (max, party) => Math.max(max, party._count.players),
    0
  );
  const joinedPartyCount = joinedParties.length;

  return {
    deckCount,
    questionCount,
    partyHostedCount,
    partyCompletedCount,
    quizPartiesHosted,
    maxPartySize,
    joinedPartyCount,
    quizSubmissionCount,
    quizCorrectCount,
    soloAttemptCount,
  };
}

export function buildAchievements(metrics: AchievementMetrics): Achievement[] {
  const quizAccuracy =
    metrics.quizSubmissionCount > 0
      ? metrics.quizCorrectCount / metrics.quizSubmissionCount
      : 0;
  return [
    {
      id: "first-deck",
      title: "First Deck",
      description: "Create your first study deck.",
      rank: "I",
      earned: metrics.deckCount >= 1,
    },
    {
      id: "decksmith",
      title: "Decksmith",
      description: "Craft 5 decks from your notes.",
      rank: "II",
      earned: metrics.deckCount >= 5,
    },
    {
      id: "quizstarter",
      title: "Quizstarter",
      description: "Generate 25 quiz questions.",
      rank: "I",
      earned: metrics.questionCount >= 25,
    },
    {
      id: "quiz-captain",
      title: "Quiz Captain",
      description: "Generate 100 quiz questions.",
      rank: "II",
      earned: metrics.questionCount >= 100,
    },
    {
      id: "first-host",
      title: "First Host",
      description: "Host your first live party.",
      rank: "I",
      earned: metrics.partyHostedCount >= 1,
    },
    {
      id: "table-master",
      title: "Table Master",
      description: "Host 5 parties.",
      rank: "II",
      earned: metrics.partyHostedCount >= 5,
    },
    {
      id: "guild-organizer",
      title: "Guild Organizer",
      description: "Host 15 parties.",
      rank: "III",
      earned: metrics.partyHostedCount >= 15,
    },
    {
      id: "quest-finisher",
      title: "Quest Finisher",
      description: "Complete 3 hosted parties.",
      rank: "I",
      earned: metrics.partyCompletedCount >= 3,
    },
    {
      id: "legendary-run",
      title: "Legendary Run",
      description: "Complete 10 hosted parties.",
      rank: "III",
      earned: metrics.partyCompletedCount >= 10,
    },
    {
      id: "open-hall",
      title: "Open Hall",
      description: "Host a party with at least 2 players.",
      rank: "I",
      earned: metrics.maxPartySize >= 2,
    },
    {
      id: "small-party",
      title: "Small Party",
      description: "Host a party with 4 players.",
      rank: "I",
      earned: metrics.maxPartySize >= 4,
    },
    {
      id: "full-party",
      title: "Full Party",
      description: "Host a party with 8 players.",
      rank: "II",
      earned: metrics.maxPartySize >= 8,
    },
    {
      id: "raid-leader",
      title: "Raid Leader",
      description: "Host a party with 12 players.",
      rank: "III",
      earned: metrics.maxPartySize >= 12,
    },
    {
      id: "party-hopper",
      title: "Party Hopper",
      description: "Join your first party.",
      rank: "I",
      earned: metrics.joinedPartyCount >= 1,
    },
    {
      id: "guild-regular",
      title: "Guild Regular",
      description: "Join 5 parties.",
      rank: "II",
      earned: metrics.joinedPartyCount >= 5,
    },
    {
      id: "guild-socialite",
      title: "Guild Socialite",
      description: "Join 15 parties.",
      rank: "III",
      earned: metrics.joinedPartyCount >= 15,
    },
    {
      id: "quiz-sprinter",
      title: "Quiz Sprinter",
      description: "Answer 50 party quiz questions.",
      rank: "I",
      earned: metrics.quizSubmissionCount >= 50,
    },
    {
      id: "quiz-veteran",
      title: "Quiz Veteran",
      description: "Answer 200 party quiz questions.",
      rank: "II",
      earned: metrics.quizSubmissionCount >= 200,
    },
    {
      id: "quiz-legend",
      title: "Quiz Legend",
      description: "Answer 500 party quiz questions.",
      rank: "III",
      earned: metrics.quizSubmissionCount >= 500,
    },
    {
      id: "sharpshooter",
      title: "Sharpshooter",
      description: "Hit 80% accuracy across 50 party answers.",
      rank: "II",
      earned: metrics.quizSubmissionCount >= 50 && quizAccuracy >= 0.8,
    },
    {
      id: "deadeye",
      title: "Deadeye",
      description: "Hit 90% accuracy across 100 party answers.",
      rank: "III",
      earned: metrics.quizSubmissionCount >= 100 && quizAccuracy >= 0.9,
    },
    {
      id: "solo-warmup",
      title: "Solo Warmup",
      description: "Finish 50 solo quiz attempts.",
      rank: "I",
      earned: metrics.soloAttemptCount >= 50,
    },
    {
      id: "solo-sage",
      title: "Solo Sage",
      description: "Finish 200 solo quiz attempts.",
      rank: "III",
      earned: metrics.soloAttemptCount >= 200,
    },
    {
      id: "dual-host",
      title: "Dual Host",
      description: "Host a quiz party and build 3 decks.",
      rank: "II",
      earned: metrics.partyHostedCount >= 1 && metrics.deckCount >= 3,
    },
  ];
}
