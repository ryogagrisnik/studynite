import Link from "next/link";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_AVATAR_ID, getAvatarById } from "@/lib/studyhall/avatars";

export const revalidate = 60;

type LeaderboardRange = "all" | "weekly";

type LeaderboardRow = {
  userId: string;
  name: string;
  count: number;
  avatarSrc: string;
  avatarLabel: string;
};

const LEADERBOARD_LIMIT = 50;

const WEEKLY_LABEL = "Weekly resets every Monday (00:00 UTC).";

function startOfWeekUtc(now: Date) {
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utcMidnight.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + diff);
  return utcMidnight;
}

type RawLeaderboardRow = {
  userId: string;
  name: string | null;
  email: string | null;
  avatarId: string | null;
  total: bigint | number;
};

type RawRankRow = {
  rank: bigint | number;
};

function leaderboardCte(since: Date | null) {
  const attemptWhere = since ? Prisma.sql`WHERE "createdAt" >= ${since}` : Prisma.sql``;
  const studyWhere = since ? Prisma.sql`WHERE "createdAt" >= ${since}` : Prisma.sql``;
  const partyWhere = since
    ? Prisma.sql`WHERE ps."createdAt" >= ${since} AND pp."userId" IS NOT NULL`
    : Prisma.sql`WHERE pp."userId" IS NOT NULL`;

  return Prisma.sql`
    WITH attempt_counts AS (
      SELECT "userId", COUNT(*)::bigint AS cnt
      FROM "Attempt"
      ${attemptWhere}
      GROUP BY "userId"
    ),
    study_counts AS (
      SELECT "userId", COUNT(*)::bigint AS cnt
      FROM "StudyAttempt"
      ${studyWhere}
      GROUP BY "userId"
    ),
    party_counts AS (
      SELECT pp."userId" AS "userId", COUNT(*)::bigint AS cnt
      FROM "PartySubmission" ps
      JOIN "PartyPlayer" pp ON ps."partyPlayerId" = pp."id"
      ${partyWhere}
      GROUP BY pp."userId"
    ),
    combined AS (
      SELECT "userId", SUM(cnt)::bigint AS total
      FROM (
        SELECT * FROM attempt_counts
        UNION ALL
        SELECT * FROM study_counts
        UNION ALL
        SELECT * FROM party_counts
      ) counts
      GROUP BY "userId"
    )
  `;
}

async function getLeaderboard(range: LeaderboardRange): Promise<LeaderboardRow[]> {
  const since = range === "weekly" ? startOfWeekUtc(new Date()) : null;
  const cte = leaderboardCte(since);

  const rows = await prisma.$queryRaw<RawLeaderboardRow[]>(Prisma.sql`
    ${cte}
    SELECT u.id AS "userId", u.name, u.email, u."avatarId", c.total
    FROM combined c
    JOIN "User" u ON u.id = c."userId"
    ORDER BY c.total DESC, u.name ASC NULLS LAST
    LIMIT ${LEADERBOARD_LIMIT}
  `);

  return rows
    .map((row) => {
      const name = row.name?.trim() || row.email?.trim() || `Adventurer ${row.userId.slice(0, 6)}`;
      const avatar =
        getAvatarById(row.avatarId ?? DEFAULT_AVATAR_ID) ?? getAvatarById(DEFAULT_AVATAR_ID);
      const count = Number(row.total ?? 0);
      return {
        userId: row.userId,
        name,
        count,
        avatarSrc: avatar?.src ?? "/avatars/wizard.jpeg",
        avatarLabel: avatar?.label ?? "Wizard",
      };
    })
    .filter((row) => row.count > 0);
}

async function getUserRank(range: LeaderboardRange, userId: string): Promise<number> {
  const since = range === "weekly" ? startOfWeekUtc(new Date()) : null;
  const cte = leaderboardCte(since);

  const rows = await prisma.$queryRaw<RawRankRow[]>(Prisma.sql`
    ${cte}
    SELECT rank
    FROM (
      SELECT "userId", total, RANK() OVER (ORDER BY total DESC) AS rank
      FROM combined
    ) ranked
    WHERE "userId" = ${userId}
  `);

  if (rows.length === 0) {
    return 0;
  }

  return Number(rows[0]?.rank ?? 0);
}

export default async function HowItWorksPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const isAuthed = Boolean(userId);
  const range = searchParams?.range === "weekly" ? "weekly" : "all";
  const [leaderboard, userRank] = await Promise.all([
    getLeaderboard(range),
    userId ? getUserRank(range, userId) : Promise.resolve(0),
  ]);
  return (
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Global leaderboard</h1>
          <p className="page-sub">
            Questions answered across solo practice and multiplayer parties.
          </p>
        </div>
        <div className="row">
          <Link className={`btn ${range === "all" ? "btn-primary" : "btn-outline"}`} href="/how-it-works">
            All time
          </Link>
          <Link
            className={`btn ${range === "weekly" ? "btn-primary" : "btn-outline"}`}
            href="/how-it-works?range=weekly"
          >
            Weekly
          </Link>
        </div>
      </div>

      <section className="card leaderboard-card rpg-reveal">
        <div className="leaderboard-head">
          <div>
            <h2 className="card-title">Top adventurers</h2>
            <p className="card-sub">
              Counted from solo practice attempts plus party submissions.
            </p>
          </div>
          <div className="leaderboard-meta">
            <span className="leaderboard-badge">{range === "weekly" ? "Weekly" : "All time"}</span>
            {range === "weekly" ? (
              <span className="leaderboard-note">{WEEKLY_LABEL}</span>
            ) : null}
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="leaderboard-empty muted">
            No answers logged yet. Be the first to climb the ranks.
          </div>
        ) : (
          <div className="leaderboard-table">
            {leaderboard.map((row, index) => {
              const rankClass =
                index === 0 ? " is-top-1" : index === 1 ? " is-top-2" : index === 2 ? " is-top-3" : "";
              return (
              <div
                key={row.userId}
                className={`leaderboard-row${row.userId === userId ? " is-you" : ""}${rankClass}`}
              >
                <div className="leaderboard-rank">#{index + 1}</div>
                <div className="leaderboard-name">
                  <img
                    className="avatar leaderboard-avatar"
                    src={row.avatarSrc}
                    alt={row.avatarLabel}
                  />
                  <span className="leaderboard-name-text">{row.name}</span>
                  {row.userId === userId ? <span className="leaderboard-you">You</span> : null}
                </div>
                <div className="leaderboard-count">
                  {row.count.toLocaleString()}
                  <span className="leaderboard-count-label">answered</span>
                </div>
              </div>
            )})}
          </div>
        )}

        <div className="leaderboard-foot">
          {isAuthed && userRank > 0 ? (
            <p className="muted">
              Your current rank: <strong className="leaderboard-rank-number">#{userRank}</strong>
            </p>
          ) : null}
          {!isAuthed ? (
            <p className="muted">
              Sign in to track your personal rank across devices.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
