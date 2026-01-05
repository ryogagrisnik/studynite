"use client";

import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  getProgressKey,
  grantFullAccess,
  loadProgress,
  mergeProgress,
  saveProgress,
} from "@/lib/progression";

function toCosmeticSlug(value: string | null) {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CosmeticSync() {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? ((session?.user as any)?.id as string) : null;
  const userEmail =
    status === "authenticated" ? ((session?.user as any)?.email as string | undefined) : undefined;
  const progressKey = useMemo(() => getProgressKey(userId), [userId]);

  useEffect(() => {
    const applyCosmetic = () => {
      let progress = loadProgress(progressKey);
      if (userId) {
        const guestKey = getProgressKey(null);
        if (guestKey !== progressKey) {
          const rawGuest = window.localStorage.getItem(guestKey);
          if (rawGuest) {
            const guestProgress = loadProgress(guestKey);
            const merged = mergeProgress(progress, guestProgress);
            saveProgress(progressKey, merged);
            window.localStorage.removeItem(guestKey);
            progress = merged;
          }
        }
      }
      const { next, changed } = grantFullAccess(progress, userEmail);
      if (changed) saveProgress(progressKey, next);
      const slug = toCosmeticSlug(next.equippedCosmetic);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.cosmetic = slug || "";
      }
    };
    applyCosmetic();
    window.addEventListener("studynite:progress-updated", applyCosmetic);
    return () => window.removeEventListener("studynite:progress-updated", applyCosmetic);
  }, [progressKey, userEmail, userId]);

  return null;
}
