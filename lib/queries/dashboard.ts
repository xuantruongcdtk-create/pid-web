import { startOfWeek, formatISO, subWeeks } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChildRow {
  id: string;
  full_name: string;
  grade: string;
  school_level: string | null;
  avatar_color: string | null;
  peak_study_hours: string | null;
  burnout_risk: "low" | "medium" | "high" | null;
  dna_profile: Record<string, number> | null;
}

export interface ScoreRow {
  id: string;
  child_id: string;
  subject: string;
  score: number;
  exam_type: string | null;
  exam_date: string;
  term: string | null;
  school_year: string | null;
  mood_rating: number | null;
  notes: string | null;
}

export interface WeeklySummary {
  id: string;
  child_id: string;
  week_start: string;
  study_hours: number | null;
  tasks_completed: number | null;
  avg_score: number | null;
  mood_avg: number | null;
  ai_analysis: {
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    burnoutRisk?: "low" | "medium" | "high";
    alerts?: Array<{ type: string; title: string; description?: string }>;
    dnaUpdate?: { visual: number; auditory: number; kinesthetic: number; reading: number };
  } | null;
}

export interface AlertRow {
  id: string;
  child_id: string;
  type: "warning" | "success" | "info";
  title: string;
  description: string | null;
  is_read: boolean | null;
  created_at: string;
}

/** Fetch the first child for the signed-in parent (most flows act on one child). */
export async function fetchPrimaryChild(supabase: SupabaseClient): Promise<ChildRow | null> {
  const { data, error } = await supabase
    .from("children")
    .select(
      "id, full_name, grade, school_level, avatar_color, peak_study_hours, burnout_risk, dna_profile",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ChildRow | null;
}

export async function fetchRecentScores(
  supabase: SupabaseClient,
  childId: string,
  days = 28,
): Promise<ScoreRow[]> {
  const since = formatISO(new Date(Date.now() - days * 86400_000), { representation: "date" });
  const { data, error } = await supabase
    .from("score_records")
    .select("id, child_id, subject, score, exam_type, exam_date, term, school_year, mood_rating, notes")
    .eq("child_id", childId)
    .gte("exam_date", since)
    .order("exam_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScoreRow[];
}

export async function fetchWeeklySummaries(
  supabase: SupabaseClient,
  childId: string,
  weeks = 4,
): Promise<WeeklySummary[]> {
  const since = formatISO(startOfWeek(subWeeks(new Date(), weeks), { weekStartsOn: 1 }), {
    representation: "date",
  });
  const { data, error } = await supabase
    .from("weekly_summaries")
    .select("id, child_id, week_start, study_hours, tasks_completed, avg_score, mood_avg, ai_analysis")
    .eq("child_id", childId)
    .gte("week_start", since)
    .order("week_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WeeklySummary[];
}

export async function fetchActiveAlerts(
  supabase: SupabaseClient,
  childId: string,
  limit = 6,
): Promise<AlertRow[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, child_id, type, title, description, is_read, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AlertRow[];
}

// ---- Aggregations ---------------------------------------------------------

export interface SubjectTrend {
  subject: string;
  current: number;
  previous: number | null;
  trend: "up" | "down" | "flat" | "new";
  delta: number;
}

/** Average per subject for the current period vs previous (same window length). */
export function computeSubjectTrends(scores: ScoreRow[]): SubjectTrend[] {
  if (scores.length === 0) return [];
  const sorted = [...scores].sort((a, b) => (a.exam_date < b.exam_date ? -1 : 1));
  const earliest = new Date(sorted[0].exam_date).getTime();
  const latest = new Date(sorted[sorted.length - 1].exam_date).getTime();
  const mid = (earliest + latest) / 2;

  const buckets = new Map<string, { recent: number[]; prior: number[] }>();
  for (const s of sorted) {
    const bucket = buckets.get(s.subject) ?? { recent: [], prior: [] };
    const t = new Date(s.exam_date).getTime();
    (t >= mid ? bucket.recent : bucket.prior).push(Number(s.score));
    buckets.set(s.subject, bucket);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return Array.from(buckets.entries())
    .map(([subject, b]) => {
      const cur = avg(b.recent);
      const prev = avg(b.prior);
      if (cur === null) return null;
      const trend: SubjectTrend["trend"] =
        prev === null ? "new" : cur - prev > 0.2 ? "up" : cur - prev < -0.2 ? "down" : "flat";
      return {
        subject,
        current: Number(cur.toFixed(2)),
        previous: prev !== null ? Number(prev.toFixed(2)) : null,
        trend,
        delta: prev !== null ? Number((cur - prev).toFixed(2)) : 0,
      } satisfies SubjectTrend;
    })
    .filter((x): x is SubjectTrend => x !== null)
    .sort((a, b) => b.current - a.current);
}

export function overallAverage(scores: ScoreRow[]): number | null {
  if (scores.length === 0) return null;
  return Number(
    (scores.reduce((a, s) => a + Number(s.score), 0) / scores.length).toFixed(2),
  );
}

export function overallMood(scores: ScoreRow[]): number | null {
  const xs = scores.filter((s) => typeof s.mood_rating === "number");
  if (xs.length === 0) return null;
  return Number((xs.reduce((a, s) => a + Number(s.mood_rating), 0) / xs.length).toFixed(1));
}
