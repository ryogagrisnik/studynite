'use client';

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData, HistoryPoint, SectionKey, SectionStat, TopicStat } from "./types";

type DashboardClientProps = {
  data: DashboardData;
};

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function buildOverallLabel(section: SectionStat) {
  return section.label;
}

type MessageState = { type: "success" | "error"; text: string } | null;

const MS_PER_DAY = 86_400_000;

function formatShortDate(dateStr: string | null) {
  if (!dateStr) return "No attempts yet";
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHistoryLabel(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function differenceInDays(later: Date, earlier: Date) {
  return Math.round((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function computeStreak(points: HistoryPoint[]) {
  const sorted = points
    .filter(point => point.total > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let current = 0;
  let longest = 0;
  let prevDate: Date | null = null;
  let lastActive: string | null = null;

  for (const entry of sorted) {
    const date = new Date(`${entry.date}T00:00:00.000Z`);
    if (!prevDate) {
      current = 1;
    } else {
      const diff = differenceInDays(date, prevDate);
      current = diff === 1 ? current + 1 : 1;
    }
    if (current > longest) longest = current;
    prevDate = date;
    lastActive = entry.date;
  }

  if (lastActive) {
    const lastDate = new Date(`${lastActive}T00:00:00.000Z`);
    const diffToToday = differenceInDays(new Date(), lastDate);
    if (diffToToday > 1) {
      current = 0;
    }
  }

  return { current, longest, lastActive };
}

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: "#FCEBD7",
  color: "#4A2E1C",
  borderRadius: 999,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const progressTrack: CSSProperties = {
  width: "100%",
  height: 10,
  borderRadius: 999,
  background: "#FCEBD7",
  overflow: "hidden",
};

const progressThumbBase: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "#F77F00",
  transition: "width 0.3s ease",
};

export default function DashboardClient({ data }: DashboardClientProps) {
  const router = useRouter();
  const [actionMessage, setActionMessage] = useState<MessageState>(null);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<MessageState>(null);
  const [activeKey, setActiveKey] = useState(data.sections[0]?.key ?? "GRE::Quant");
  const activeSection = data.sections.find(s => s.key === activeKey) ?? data.sections[0] ?? null;

  const remainingFree = data.unlimited
    ? null
    : Math.max((data.dailyLimit ?? 0) - data.dailyUsed, 0);

  const weakTopicsRaw = activeSection?.topics ?? [];
  const weakTopicsPool = weakTopicsRaw.filter(topic => topic.incorrect > 0);
  const weakTopics: TopicStat[] = (weakTopicsPool.length ? weakTopicsPool : weakTopicsRaw).slice(
    0,
    3
  );

  const activeExam = activeSection?.exam;
  const activeHistory = activeSection
    ? data.historyBySection[activeSection.key as SectionKey] ?? []
    : data.history;
  const activeStreak = activeSection ? computeStreak(activeHistory) : data.streak;

  const streakGoal = Math.max(activeStreak.longest || 1, 1);
  const streakProgress = activeStreak.current
    ? Math.min(100, Math.round((activeStreak.current / streakGoal) * 100))
    : 0;
  const currentStreakLabel = activeStreak.current
    ? `${formatCount(activeStreak.current)} day${activeStreak.current === 1 ? "" : "s"}`
    : "No streak yet";
  const lastActiveLabel = formatShortDate(activeStreak.lastActive);

  const HISTORY_BAR_HEIGHT = 120;

  const activeAccuracy = activeSection ? activeSection.accuracy : data.overallAccuracy;
  const activeTotalAttempts = activeSection ? activeSection.total : data.totalAttempts;
  const activeCorrectAttempts = activeSection ? activeSection.correct : 0;

  const quantSectionsForExam = useMemo(
    () =>
      data.sections.filter(
        section => section.section === "Quant" && (!activeExam || section.exam === activeExam)
      ),
    [data.sections, activeExam]
  );
  const verbalSectionsForExam = useMemo(
    () =>
      data.sections.filter(
        section => section.section === "Verbal" && (!activeExam || section.exam === activeExam)
      ),
    [data.sections, activeExam]
  );

  async function handleResendVerification() {
    if (resending) return;
    if (!data.email) {
      setResendStatus({
        type: "error",
        text: "No email associated with this account. Contact support.",
      });
      return;
    }

    setResending(true);
    setResendStatus(null);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      if (!response.ok) throw new Error("RESEND_FAILED");
      setResendStatus({
        type: "success",
        text: "Verification email sent! Check your inbox.",
      });
    } catch (error) {
      console.error(error);
      setResendStatus({
        type: "error",
        text: "We couldn't send the verification email. Try again soon.",
      });
    } finally {
      setResending(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setActionMessage(null);
    try {
      const response = await fetch("/api/dashboard/export");
      if (!response.ok) throw new Error("EXPORT_FAILED");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "blobprep-progress.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      setActionMessage({ type: "success", text: "Progress exported. Check your downloads." });
    } catch (error) {
      console.error(error);
      setActionMessage({ type: "error", text: "Unable to export progress right now." });
    } finally {
      setExporting(false);
    }
  }

  async function handleReset() {
    if (resetting || data.totalAttempts === 0) return;
    const confirmed = window.confirm(
      "This will clear all attempts, streaks, and missed questions for your account. Continue?"
    );
    if (!confirmed) return;

    setResetting(true);
    setActionMessage(null);
    try {
      const response = await fetch("/api/dashboard/reset", { method: "POST" });
      if (!response.ok) throw new Error("RESET_FAILED");
      setActionMessage({ type: "success", text: "Progress cleared. Refreshing stats…" });
      setTimeout(() => {
        router.refresh();
      }, 600);
    } catch (error) {
      console.error(error);
      setActionMessage({ type: "error", text: "Could not reset your progress. Try again." });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="section" style={{ paddingTop: 48 }}>
      <h1 style={{ marginBottom: 12 }}>Dashboard</h1>

      {!data.isEmailVerified && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            border: "1px solid #F9B154",
            background: "#FFF7EE",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>Verify your email</div>
          <p style={{ margin: 0, fontSize: 14, color: "#4A2E1C" }}>
            Confirm your email to secure your account and keep progress backed up across devices.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
            >
              {resending ? "Sending…" : "Send verification link"}
            </button>
            <Link className="btn btn-outline" href="/resend-verification">
              Update email
            </Link>
          </div>
          {resendStatus && (
            <div
              style={{
                fontSize: 13,
                color: resendStatus.type === "success" ? "#027A48" : "#B42318",
              }}
            >
              {resendStatus.text}
            </div>
          )}
        </div>
      )}

      <div
        className="row"
        style={{
          justifyContent: "flex-start",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {data.sections.map(section => {
          const isActive = section.key === activeKey;
          return (
            <button
              key={section.key}
              className={`btn ${isActive ? "btn-primary" : "btn-outline"}`}
              onClick={() => setActiveKey(section.key)}
              aria-pressed={isActive}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: "flex-start" }}>
        <div className="card" style={{ flex: "1 1 240px", minWidth: 220 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#F77F00" }}>
            {formatPercent(activeAccuracy)}
          </div>
          <div>{activeSection ? `${activeSection.label} Accuracy` : "Overall Accuracy"}</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
            {activeTotalAttempts
              ? `${formatCount(activeTotalAttempts)} attempts tracked`
              : "Solve a question in this mode to populate stats."}
          </div>
        </div>

        <div className="card" style={{ flex: "1 1 240px", minWidth: 220 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#F77F00" }}>
            {formatCount(activeTotalAttempts)}
          </div>
          <div>Questions Completed</div>
          {activeSection && (
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              {formatCount(activeCorrectAttempts)} correct out of{" "}
              {formatCount(activeTotalAttempts)} in {buildOverallLabel(activeSection)}
            </div>
          )}
        </div>

        <div className="card" style={{ flex: "1 1 240px", minWidth: 220 }}>
          {data.unlimited ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#F77F00" }}>
                Unlimited
              </div>
              <div>Remaining Free</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                Practice without a daily cap.
              </div>
            </>
          ) : (
            <>
              <span style={badgeStyle}>{remainingFree} left today</span>
              <div style={{ marginTop: 10 }}>Remaining Free</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                Used {formatCount(data.dailyUsed)} of {data.dailyLimit}
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ flex: "1 1 240px", minWidth: 220 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#F77F00" }}>
            {currentStreakLabel}
          </div>
          <div>Streak</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Best {formatCount(activeStreak.longest || 0)} days • Last active {lastActiveLabel}
          </div>
          <div style={{ ...progressTrack, marginTop: 12 }}>
            <div
              style={{
                ...progressThumbBase,
                width: `${Math.max(0, streakProgress)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 24, justifyContent: "flex-start" }}>
        <div className="card" style={{ flex: "1 1 360px", minWidth: 320 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Last 14 days</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>
            Tracking {activeSection ? activeSection.label : "all practice"} attempts.
          </div>
          <HistoryChart
            label={activeSection ? activeSection.label : "All practice"}
            points={activeHistory}
            barHeight={HISTORY_BAR_HEIGHT}
          />
        </div>

        {activeSection?.section === "Quant" && (
          <div className="card" style={{ flex: "1 1 340px", minWidth: 300 }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Quant Accuracy</div>
            {quantSectionsForExam.length === 0 ? (
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                Work through a few Quant questions in this exam to unlock this view.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {quantSectionsForExam.map(section => (
                  <AccuracyRow
                    key={section.key}
                    label={section.label}
                    accuracy={section.accuracy}
                    correct={section.correct}
                    total={section.total}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection?.section === "Verbal" && (
          <div className="card" style={{ flex: "1 1 340px", minWidth: 300 }}>
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Verbal Accuracy</div>
            {verbalSectionsForExam.length === 0 ? (
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                Solve Verbal prompts in this exam to see accuracy trends.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {verbalSectionsForExam.map(section => (
                  <AccuracyRow
                    key={section.key}
                    label={section.label}
                    accuracy={section.accuracy}
                    correct={section.correct}
                    total={section.total}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          Weak Areas —{" "}
          {activeSection ? `${activeSection.label} (most missed concepts)` : "Select a section"}
        </div>
        {weakTopics.length === 0 ? (
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Put in a few reps in {activeSection ? activeSection.label : "your chosen section"} to
            surface targeted review topics.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {weakTopics.map(topic => (
              <div
                key={topic.topic}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid #F4D8BE",
                  borderRadius: 14,
                  padding: "12px 16px",
                  background: "#FFF7EE",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{topic.topic}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                    {formatCount(topic.incorrect)} wrong • {formatCount(topic.correct)} correct of{" "}
                    {formatCount(topic.total)}
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "#D65A31" }}>
                  {formatPercent(topic.accuracy)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Data & recovery</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-outline" type="button" onClick={handleExport} disabled={exporting}>
            {exporting ? "Preparing export…" : "Download CSV"}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={handleReset}
            disabled={resetting || data.totalAttempts === 0}
            style={{ borderColor: "#F9B154", color: "#B54708" }}
          >
            {resetting ? "Clearing…" : "Reset progress"}
          </button>
        </div>
        {actionMessage && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              color: actionMessage.type === "success" ? "#027A48" : "#B42318",
            }}
          >
            {actionMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}

type AccuracyRowProps = {
  label: string;
  accuracy: number;
  correct: number;
  total: number;
};

function AccuracyRow({ label, accuracy, correct, total }: AccuracyRowProps) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          fontSize: 13,
          marginBottom: 6,
        }}
      >
        <span>{label}</span>
        <span>{formatPercent(accuracy)}</span>
      </div>
      <div style={progressTrack}>
        <div style={{ ...progressThumbBase, width: `${Math.round(accuracy)}%` }} />
      </div>
      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
        {formatCount(correct)} / {formatCount(total)} correct
      </div>
    </div>
  );
}

type HistoryChartProps = {
  label: string;
  points: HistoryPoint[];
  barHeight: number;
};

function HistoryChart({ label, points, barHeight }: HistoryChartProps) {
  const maxTotal = points.reduce((max, point) => (point.total > max ? point.total : max), 0);
  const hasAttempts = maxTotal > 0;
  const scale = maxTotal || 1;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${points.length || 1}, minmax(8px, 1fr))`,
          gap: 4,
          alignItems: "end",
          height: barHeight,
        }}
      >
        {points.length === 0 ? (
          <div
            style={{
              background: "#FCEBD7",
              borderRadius: 999,
              height: barHeight,
            }}
          />
        ) : (
          points.map(point => {
            const totalHeight = point.total
              ? Math.max(6, Math.round((point.total / scale) * barHeight))
              : 4;
            const correctHeight =
              point.total && point.correct
                ? Math.max(
                    2,
                    Math.min(
                      totalHeight,
                      Math.round((point.correct / Math.max(point.total, 1)) * totalHeight)
                    )
                  )
                : 0;

            return (
              <div
                key={point.date}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
                title={`${point.date}: ${point.correct}/${point.total} correct`}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: barHeight,
                    background: "#FCEBD7",
                    borderRadius: 999,
                  }}
                >
                  {point.total > 0 && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: totalHeight,
                          background: "#FBC78D",
                          borderRadius: 999,
                        }}
                      />
                      {correctHeight > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: correctHeight,
                            background: "#F77F00",
                            borderRadius: 999,
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
                <div style={{ fontSize: 9, color: "#4A2E1C", opacity: 0.65 }}>
                  {formatHistoryLabel(point.date)}
                </div>
              </div>
            );
          })
        )}
      </div>
      {!hasAttempts && (
        <div style={{ fontSize: 11, color: "#4A2E1C", opacity: 0.6 }}>
          No attempts in the last two weeks.
        </div>
      )}
    </div>
  );
}
