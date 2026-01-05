"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BADGES,
  COSMETICS,
  getProgressKey,
  grantFullAccess,
  loadProgress,
  saveProgress,
  type ProgressState,
} from "@/lib/progression";

type Achievement = {
  id: string;
  title: string;
  description: string;
  rank: string;
  earned: boolean;
};

type AchievementsGridProps = {
  achievements: Achievement[];
  userId?: string | null;
  userEmail?: string | null;
};

function buildCollectionAchievements(progress: ProgressState | null): Achievement[] {
  const hasAllCosmetics = progress ? COSMETICS.every((item) => progress.cosmetics.includes(item)) : false;
  const hasAllBadges = progress ? BADGES.every((item) => progress.badges.includes(item)) : false;
  return [
    {
      id: "cosmetic-collector",
      title: "Cosmetic Collector",
      description: "Collect every cosmetic.",
      rank: "II",
      earned: hasAllCosmetics,
    },
    {
      id: "badge-baron",
      title: "Badge Baron",
      description: "Collect every badge.",
      rank: "III",
      earned: hasAllBadges,
    },
  ];
}

export default function AchievementsGrid({
  achievements,
  userId,
  userEmail,
}: AchievementsGridProps) {
  const progressKey = useMemo(() => getProgressKey(userId ?? null), [userId]);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  useEffect(() => {
    const updateProgress = () => {
      const base = loadProgress(progressKey);
      const { next, changed } = grantFullAccess(base, userEmail ?? null);
      if (changed) saveProgress(progressKey, next);
      setProgress(next);
    };
    updateProgress();
    window.addEventListener("studynite:progress-updated", updateProgress);
    return () => window.removeEventListener("studynite:progress-updated", updateProgress);
  }, [progressKey, userEmail]);

  const collectionAchievements = useMemo(
    () => buildCollectionAchievements(progress),
    [progress]
  );
  const merged = useMemo(
    () => [...achievements, ...collectionAchievements],
    [achievements, collectionAchievements]
  );

  return (
    <div className="achievement-grid">
      {merged.map((achievement) => (
        <div
          key={achievement.id}
          className={`achievement-card quest-scroll ${
            achievement.earned ? "achievement-card--earned" : "achievement-card--locked"
          }`}
        >
          <span className="achievement-icon" aria-hidden="true" />
          <div>
            <span className="achievement-title">{achievement.title}</span>
            <p className="muted">{achievement.description}</p>
          </div>
          <span className="achievement-rank">{achievement.rank}</span>
        </div>
      ))}
    </div>
  );
}
