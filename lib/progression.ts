export type BonusType = "none" | "xp" | "boost" | "cosmetic" | "badge";

export type SessionBonus = {
  type: BonusType;
  label: string;
  detail: string;
  xpBonus?: number;
  boostMultiplier?: number;
  cosmetic?: string;
  badge?: string;
};

export type ProgressState = {
  xp: number;
  level: number;
  streak: {
    days: number;
    multiplier: number;
    lastDay: string | null;
  };
  boost: {
    multiplier: number;
    remaining: number;
  };
  cosmetics: string[];
  badges: string[];
  equippedCosmetic: string | null;
  equippedBadge: string | null;
  sessionsCompleted: number;
  monthly: {
    month: string;
    sessions: number;
    deckIds: string[];
    partiesHosted: number;
    partiesJoined: number;
  };
};

export type SessionInput = {
  mode: "quiz" | "flashcards" | "learn" | "party";
  correct: number;
  total: number;
  deckId?: string;
  hosted?: boolean;
  joined?: boolean;
};

export type SessionOutcome = {
  baseXp: number;
  xpGained: number;
  totalXp: number;
  levelBefore: number;
  levelAfter: number;
  xpInLevel: number;
  xpForLevel: number;
  streakMultiplier: number;
  streakDays: number;
  nearMiss: string | null;
  sessionNearMiss: string | null;
  bonus: SessionBonus;
};

export const COSMETICS = [
  "Gilded Frame",
  "Neon Outline",
  "Emerald Spark",
  "Starburst Trim",
  "Velvet Edge",
  "Sapphire Pulse",
  "Crimson Halo",
  "Amber Drift",
  "Arctic Gleam",
  "Violet Prism",
];

export const BADGES = [
  "Lucky Seven",
  "Golden Run",
  "High Roller",
  "Midnight Ace",
];

const FULL_ACCESS_EMAILS = new Set(["rgrisnik@ucsd.edu"]);

function getCatalogWithExtras(catalog: string[], current: string[]) {
  const extras = current.filter((item) => !catalog.includes(item));
  return [...catalog, ...extras];
}

export function grantFullAccess(progress: ProgressState, email?: string | null) {
  if (!email) return { next: progress, changed: false };
  const normalizedEmail = email.trim().toLowerCase();
  if (!FULL_ACCESS_EMAILS.has(normalizedEmail)) {
    return { next: progress, changed: false };
  }
  const cosmetics = getCatalogWithExtras(COSMETICS, progress.cosmetics);
  const badges = getCatalogWithExtras(BADGES, progress.badges);
  const equippedCosmetic = progress.equippedCosmetic ?? COSMETICS[0] ?? null;
  const equippedBadge = progress.equippedBadge ?? BADGES[0] ?? null;
  const changed =
    cosmetics.length !== progress.cosmetics.length ||
    badges.length !== progress.badges.length ||
    equippedCosmetic !== progress.equippedCosmetic ||
    equippedBadge !== progress.equippedBadge;
  if (!changed) return { next: progress, changed: false };
  return {
    next: {
      ...progress,
      cosmetics,
      badges,
      equippedCosmetic,
      equippedBadge,
    },
    changed: true,
  };
}

export function mergeProgress(primary: ProgressState, secondary: ProgressState): ProgressState {
  const basePrimary = normalizeProgress(primary);
  const baseSecondary = normalizeProgress(secondary);
  const totalXp = basePrimary.xp + baseSecondary.xp;
  const { levelAfter } = getLevelProgress(totalXp);
  const mergedCosmetics = Array.from(
    new Set([...basePrimary.cosmetics, ...baseSecondary.cosmetics])
  );
  const mergedBadges = Array.from(new Set([...basePrimary.badges, ...baseSecondary.badges]));
  const equippedCosmetic =
    basePrimary.equippedCosmetic ?? baseSecondary.equippedCosmetic ?? null;
  const equippedBadge = basePrimary.equippedBadge ?? baseSecondary.equippedBadge ?? null;
  const streak =
    basePrimary.streak.lastDay && baseSecondary.streak.lastDay
      ? basePrimary.streak.lastDay >= baseSecondary.streak.lastDay
        ? basePrimary.streak
        : baseSecondary.streak
      : basePrimary.streak.lastDay
        ? basePrimary.streak
        : baseSecondary.streak;
  const boost =
    basePrimary.boost.remaining >= baseSecondary.boost.remaining
      ? basePrimary.boost
      : baseSecondary.boost;
  const monthly =
    basePrimary.monthly.month === baseSecondary.monthly.month
      ? {
          month: basePrimary.monthly.month,
          sessions: basePrimary.monthly.sessions + baseSecondary.monthly.sessions,
          deckIds: Array.from(
            new Set([...basePrimary.monthly.deckIds, ...baseSecondary.monthly.deckIds])
          ),
          partiesHosted: basePrimary.monthly.partiesHosted + baseSecondary.monthly.partiesHosted,
          partiesJoined: basePrimary.monthly.partiesJoined + baseSecondary.monthly.partiesJoined,
        }
      : basePrimary.monthly.month >= baseSecondary.monthly.month
        ? basePrimary.monthly
        : baseSecondary.monthly;

  return {
    ...basePrimary,
    xp: totalXp,
    level: levelAfter,
    streak,
    boost,
    cosmetics: mergedCosmetics,
    badges: mergedBadges,
    equippedCosmetic,
    equippedBadge,
    sessionsCompleted: basePrimary.sessionsCompleted + baseSecondary.sessionsCompleted,
    monthly,
  };
}

export function getProgressKey(userId?: string | null) {
  return `studynite:progress:${userId ?? "guest"}`;
}

export function loadProgress(key: string): ProgressState {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as ProgressState;
    return normalizeProgress(parsed);
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(key: string, next: ProgressState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event("studynite:progress-updated"));
  } catch {
    return;
  }
}

export function applySessionProgress(
  current: ProgressState,
  input: SessionInput
): { next: ProgressState; outcome: SessionOutcome } {
  const now = new Date();
  const normalized = normalizeProgress(current);
  const updatedStreak = updateStreak(normalized.streak, now);
  const monthly = updateMonthly(normalized.monthly, input, now);
  const isFirstSession = normalized.sessionsCompleted === 0;

  const baseXp = Math.max(0, Math.round(calculateBaseXp(input)));
  const boostMultiplier = normalized.boost.remaining > 0 ? normalized.boost.multiplier : 1;
  const totalMultiplier = updatedStreak.multiplier * boostMultiplier;
  let xpGained = Math.max(0, Math.round(baseXp * totalMultiplier));

  const availableCosmetics = COSMETICS.filter(
    (cosmetic) => !normalized.cosmetics.includes(cosmetic)
  );
  const bonus =
    isFirstSession && availableCosmetics.length > 0
      ? (() => {
          const cosmetic = availableCosmetics[Math.floor(Math.random() * availableCosmetics.length)];
          return {
            type: "cosmetic",
            label: "Cosmetic unlocked",
            detail: cosmetic,
            cosmetic,
          } satisfies SessionBonus;
        })()
      : rollSessionBonus();
  const next: ProgressState = {
    ...normalized,
    streak: updatedStreak,
    monthly,
    sessionsCompleted: normalized.sessionsCompleted + 1,
  };

  if (normalized.boost.remaining > 0) {
    next.boost = {
      multiplier: normalized.boost.multiplier,
      remaining: Math.max(0, normalized.boost.remaining - 1),
    };
  }

  if (bonus.type === "xp" && bonus.xpBonus) {
    xpGained += bonus.xpBonus;
  }

  if (bonus.type === "boost" && bonus.boostMultiplier) {
    next.boost = { multiplier: bonus.boostMultiplier, remaining: 1 };
  }

  if (bonus.type === "cosmetic" && bonus.cosmetic) {
    if (!next.cosmetics.includes(bonus.cosmetic)) next.cosmetics.push(bonus.cosmetic);
    if (!next.equippedCosmetic) next.equippedCosmetic = bonus.cosmetic;
  }

  if (bonus.type === "badge" && bonus.badge) {
    if (!next.badges.includes(bonus.badge)) next.badges.push(bonus.badge);
  }

  const levelBefore = next.level;
  const totalXp = next.xp + xpGained;
  const { levelAfter, xpInLevel, xpForLevel } = applyLevelProgress(levelBefore, totalXp);

  next.xp = totalXp;
  next.level = levelAfter;

  const nearMiss = buildNearMissMessage(xpInLevel, xpForLevel);
  const sessionNearMiss = buildSessionNearMiss(input);

  return {
    next,
    outcome: {
      baseXp,
      xpGained,
      totalXp,
      levelBefore,
      levelAfter,
      xpInLevel,
      xpForLevel,
      streakMultiplier: updatedStreak.multiplier,
      streakDays: updatedStreak.days,
      nearMiss,
      sessionNearMiss,
      bonus,
    },
  };
}

export function getLevelProgress(totalXp: number) {
  return applyLevelProgress(1, Math.max(0, totalXp));
}

export function getMonthlyQuests(state: ProgressState) {
  const joined = state.monthly.partiesHosted + state.monthly.partiesJoined;
  const decks = state.monthly.deckIds.length;
  return [
    {
      id: "sessions",
      label: "Complete 6 study sessions",
      progress: state.monthly.sessions,
      target: 6,
    },
    {
      id: "decks",
      label: "Study 3 different decks",
      progress: decks,
      target: 3,
    },
    {
      id: "parties",
      label: "Join 2 quiz parties",
      progress: joined,
      target: 2,
    },
  ];
}

function defaultProgress(): ProgressState {
  return {
    xp: 0,
    level: 1,
    streak: { days: 0, multiplier: 1, lastDay: null },
    boost: { multiplier: 1.25, remaining: 0 },
    cosmetics: [],
    badges: [],
    equippedCosmetic: null,
    equippedBadge: null,
    sessionsCompleted: 0,
    monthly: {
      month: "",
      sessions: 0,
      deckIds: [],
      partiesHosted: 0,
      partiesJoined: 0,
    },
  };
}

function normalizeProgress(state: ProgressState): ProgressState {
  const base = defaultProgress();
  const hasHistory =
    typeof state.sessionsCompleted === "number"
      ? state.sessionsCompleted > 0
      : state.xp > 0 ||
        state.level > 1 ||
        (state.monthly?.sessions ?? 0) > 0 ||
        (Array.isArray(state.cosmetics) && state.cosmetics.length > 0) ||
        (Array.isArray(state.badges) && state.badges.length > 0);
  return {
    ...base,
    ...state,
    streak: { ...base.streak, ...(state.streak || {}) },
    boost: { ...base.boost, ...(state.boost || {}) },
    monthly: { ...base.monthly, ...(state.monthly || {}) },
    cosmetics: Array.isArray(state.cosmetics) ? state.cosmetics : [],
    badges: Array.isArray(state.badges) ? state.badges : [],
    equippedCosmetic: state.equippedCosmetic ?? base.equippedCosmetic,
    equippedBadge: state.equippedBadge ?? base.equippedBadge,
    sessionsCompleted:
      typeof state.sessionsCompleted === "number"
        ? state.sessionsCompleted
        : hasHistory
          ? 1
          : base.sessionsCompleted,
  };
}

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function updateStreak(
  streak: ProgressState["streak"],
  now: Date
): ProgressState["streak"] {
  const today = toDayKey(now);
  if (!streak.lastDay) {
    return { lastDay: today, days: 1, multiplier: 1.12 };
  }
  if (streak.lastDay === today) return streak;

  const last = new Date(streak.lastDay);
  const diffDays = Math.round((now.getTime() - last.getTime()) / 86400000);
  if (diffDays <= 0) return streak;

  if (diffDays === 1) {
    return {
      lastDay: today,
      days: streak.days + 1,
      multiplier: Math.min(2, Number((streak.multiplier + 0.12).toFixed(2))),
    };
  }
  const decay = 0.12 * (diffDays - 1);
  return {
    lastDay: today,
    days: Math.max(1, streak.days - (diffDays - 1)),
    multiplier: Math.max(1, Number((streak.multiplier - decay).toFixed(2))),
  };
}

function updateMonthly(
  monthly: ProgressState["monthly"],
  input: SessionInput,
  now: Date
): ProgressState["monthly"] {
  const month = toMonthKey(now);
  const next =
    monthly.month === month
      ? { ...monthly }
      : { month, sessions: 0, deckIds: [], partiesHosted: 0, partiesJoined: 0 };

  next.sessions += 1;
  if (input.deckId && !next.deckIds.includes(input.deckId)) {
    next.deckIds = [...next.deckIds, input.deckId];
  }
  if (input.hosted) next.partiesHosted += 1;
  if (input.joined) next.partiesJoined += 1;
  return next;
}

function calculateBaseXp(input: SessionInput) {
  const correct = Math.max(0, input.correct);
  const total = Math.max(1, input.total || 1);
  switch (input.mode) {
    case "quiz":
      return correct * 12 + total * 4;
    case "flashcards":
      return correct * 8 + total * 2;
    case "learn":
      return correct * 10 + total * 2;
    case "party":
      return correct * 14 + total * 3;
    default:
      return correct * 8 + total * 2;
  }
}

function applyLevelProgress(levelStart: number, totalXp: number) {
  let level = Math.max(1, levelStart);
  let remainingXp = totalXp;
  let xpForLevel = xpToLevel(level);
  while (remainingXp >= xpForLevel) {
    remainingXp -= xpForLevel;
    level += 1;
    xpForLevel = xpToLevel(level);
  }
  return {
    levelAfter: level,
    xpInLevel: remainingXp,
    xpForLevel,
  };
}

function xpToLevel(level: number) {
  return Math.round(280 + level * 160 + Math.pow(level, 1.2) * 12);
}

function buildNearMissMessage(xpInLevel: number, xpForLevel: number) {
  if (!xpForLevel) return null;
  const pct = Math.round((xpInLevel / xpForLevel) * 100);
  if (pct >= 90 && pct < 100) {
    return `${pct}% mastery — one more run to unlock.`;
  }
  return null;
}

function buildSessionNearMiss(input: SessionInput) {
  const total = Math.max(1, input.total || 1);
  const missed = total - input.correct;
  const accuracy = input.correct / total;
  if (missed > 0 && accuracy >= 0.9) {
    return `${missed} away from a perfect run.`;
  }
  return null;
}

function rollSessionBonus(): SessionBonus {
  const roll = Math.random();
  if (roll < 0.6) {
    return {
      type: "none",
      label: "No bonus this time",
      detail: "Keep the streak alive for bigger rewards.",
    };
  }
  if (roll < 0.86) {
    const xpBonus = 40 + Math.floor(Math.random() * 40);
    return {
      type: "xp",
      label: `+${xpBonus} XP boost`,
      detail: "A quick spark of extra progress.",
      xpBonus,
    };
  }
  if (roll < 0.94) {
    const cosmetic = COSMETICS[Math.floor(Math.random() * COSMETICS.length)];
    return {
      type: "cosmetic",
      label: "Cosmetic unlocked",
      detail: cosmetic,
      cosmetic,
    };
  }
  if (roll < 0.985) {
    const boostMultiplier = 1.35;
    return {
      type: "boost",
      label: `${boostMultiplier}x next-session boost`,
      detail: "Use it on your next run.",
      boostMultiplier,
    };
  }
  const badge = BADGES[Math.floor(Math.random() * BADGES.length)];
  return {
    type: "badge",
    label: "Rare badge found",
    detail: badge,
    badge,
  };
}
