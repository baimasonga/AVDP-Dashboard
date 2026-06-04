// Central data-access layer backed by Supabase (Postgres + RLS + Auth).
// Components call these helpers instead of hitting REST endpoints; row-level
// security enforces RBAC on the server side, so the client cannot bypass it.

import { supabase } from "./supabase";
import {
  Indicator,
  IndicatorCategory,
  IndicatorHistoryPoint,
  ThresholdAlert,
  SurveyRecord,
  SurveyResponse,
  SurveyType,
  User,
  UserRole,
} from "../types";

type ActivityLog = { timestamp: string; user: string; role: string; action: string };

// ---------- row mappers (snake_case DB -> app PascalCase) ----------
const mapIndicator = (r: any): Indicator => ({
  IndicatorID: r.id,
  IndicatorName: r.name as IndicatorCategory,
  BaselineValue: Number(r.baseline),
  AchievedValue: Number(r.achieved),
  Target: r.target != null ? Number(r.target) : undefined,
  Progress: Number(r.progress),
  Status: r.status,
  District: r.district,
  Commodity: r.commodity,
  LastUpdated: r.last_updated,
});

const mapAlert = (r: any): ThresholdAlert => ({
  id: r.id,
  indicatorId: r.indicator_id,
  indicatorName: r.indicator_name,
  district: r.district,
  thresholdValue: Number(r.threshold_value),
  currentValue: Number(r.current_value),
  condition: r.condition,
  triggeredAt: r.triggered_at,
  recipientEmail: r.recipient_email,
  status: r.status,
  enabled: r.enabled,
});

const mapSurvey = (r: any): SurveyRecord => ({
  id: r.id,
  title: r.title,
  description: r.description,
  type: r.type as SurveyType,
  status: r.status,
  district: r.district,
  respondentsCount: r.respondents_count,
  targetCount: r.target_count,
  focalCommodity: r.focal_commodity,
  lastConducted: r.last_conducted,
  indicatorsAffected: r.indicators_affected ?? [],
  keyFindings: r.key_findings ?? undefined,
});

const mapResponse = (r: any): SurveyResponse => ({
  id: r.id,
  surveyId: r.survey_id,
  respondentName: r.respondent_name,
  respondentType: r.respondent_type,
  district: r.district,
  commodity: r.commodity,
  gender: r.gender ?? undefined,
  ageGroup: r.age_group ?? undefined,
  answers: r.answers ?? [],
  submittedAt: r.submitted_at,
});

const mapLog = (r: any): ActivityLog => ({
  timestamp: r.ts,
  user: r.user_email,
  role: r.role,
  action: r.action,
});

// ---------- auth / profiles ----------
export async function getCurrentUser(): Promise<User | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData.user;
  if (!authUser) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!profile) {
    return {
      id: authUser.id,
      email: authUser.email ?? "",
      name: authUser.email?.split("@")[0]?.toUpperCase() ?? "User",
      role: UserRole.PUBLIC,
    };
  }
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as UserRole,
    district: profile.district ?? undefined,
  };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  role: UserRole,
  district?: string
): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role, district: district ?? null } },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ---------- logging ----------
async function logActivity(action: string, user: User | null) {
  // Best-effort; RLS requires an authenticated session.
  await supabase.from("activity_logs").insert({
    user_email: user?.email ?? "system",
    role: user?.role ?? "System",
    action,
  });
}

export async function getLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("ts", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLog);
}

// ---------- indicators ----------
export async function getIndicators(): Promise<Indicator[]> {
  const { data, error } = await supabase.from("indicators").select("*").order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIndicator);
}

export async function getIndicatorHistory(id: string): Promise<IndicatorHistoryPoint[]> {
  const { data, error } = await supabase
    .from("indicator_history")
    .select("*")
    .eq("indicator_id", id)
    .order("recorded_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    baseline: Number(r.baseline),
    achieved: Number(r.achieved),
    progress: Number(r.progress),
    status: r.status,
    changedBy: r.changed_by,
    recordedAt: r.recorded_at,
  }));
}

export async function updateIndicator(
  id: string,
  baseline: number,
  achieved: number,
  user: User | null
): Promise<Indicator> {
  const { data, error } = await supabase
    .from("indicators")
    .update({ baseline, achieved })
    .eq("id", id)
    .select();
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      "Permission denied: your role/district does not allow editing this indicator."
    );
  }
  const updated = mapIndicator(data[0]);
  await logActivity(
    `Modified indicator ${id}: Baseline ${baseline}, Achieved ${achieved} (Progress ${updated.Progress}%)`,
    user
  );
  await autoAssessAlert(updated, user);
  return updated;
}

export async function batchImportIndicators(
  rows: { IndicatorID: string; BaselineValue: number; AchievedValue: number }[],
  user: User | null
): Promise<void> {
  // Update existing rows one by one (progress/status are generated in the DB).
  for (const row of rows) {
    const { error } = await supabase
      .from("indicators")
      .update({ baseline: row.BaselineValue, achieved: row.AchievedValue })
      .eq("id", row.IndicatorID);
    if (error) throw new Error(error.message);
  }
  await logActivity(`Imported and synchronized ${rows.length} indicators via CSV bulk stream.`, user);
}

// ---------- alerts ----------
export async function getAlerts(): Promise<ThresholdAlert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("triggered_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAlert);
}

export async function createAlert(
  rule: { indicatorId: string; recipientEmail: string; thresholdValue: number; condition: "below" | "above" },
  user: User | null
): Promise<void> {
  const { data: ind } = await supabase
    .from("indicators")
    .select("name,district,progress")
    .eq("id", rule.indicatorId)
    .maybeSingle();
  if (!ind) throw new Error("Associated target indicator not found.");
  const { error } = await supabase.from("alerts").insert({
    indicator_id: rule.indicatorId,
    indicator_name: ind.name,
    district: ind.district,
    threshold_value: rule.thresholdValue,
    current_value: ind.progress,
    condition: rule.condition,
    recipient_email: rule.recipientEmail,
    status: "Pending",
    enabled: true,
  });
  if (error) throw new Error(error.message);
  await logActivity(`Registered threshold alert for ${rule.indicatorId} (${rule.condition} ${rule.thresholdValue}%)`, user);
}

export async function updateAlert(
  id: string,
  patch: Partial<{ enabled: boolean; thresholdValue: number; recipientEmail: string; condition: "below" | "above" }>,
  user: User | null
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.thresholdValue !== undefined) dbPatch.threshold_value = patch.thresholdValue;
  if (patch.recipientEmail !== undefined) dbPatch.recipient_email = patch.recipientEmail;
  if (patch.condition !== undefined) dbPatch.condition = patch.condition;
  const { error } = await supabase.from("alerts").update(dbPatch).eq("id", id);
  if (error) throw new Error(error.message);
  if (patch.enabled !== undefined) {
    await logActivity(`${patch.enabled ? "Resumed" : "Paused"} alert rule ${id}`, user);
  }
}

export async function deleteAlert(id: string, user: User | null): Promise<void> {
  const { error } = await supabase.from("alerts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity(`Deleted alert rule ${id}`, user);
}

export async function dispatchAlert(id: string, user: User | null): Promise<void> {
  const { data, error } = await supabase
    .from("alerts")
    .update({ status: "Sent", triggered_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    await logActivity(
      `Email alert simulated & sent to <${data.recipient_email}>: ${data.indicator_id} at ${data.current_value}%`,
      user
    );
  }
}

// Auto-create a single alert when an indicator slips below 110% progress.
async function autoAssessAlert(ind: Indicator, user: User | null) {
  if (ind.Progress >= 110) return;
  const { data: existing } = await supabase
    .from("alerts")
    .select("id")
    .eq("indicator_id", ind.IndicatorID)
    .limit(1);
  if (existing && existing.length > 0) return;
  await supabase.from("alerts").insert({
    indicator_id: ind.IndicatorID,
    indicator_name: ind.IndicatorName,
    district: ind.District,
    threshold_value: 110,
    current_value: ind.Progress,
    condition: "below",
    recipient_email: `${ind.District.toLowerCase().replace(/\s+/g, "")}.officer@avdp.gov.sl`,
    status: "Sent",
    enabled: true,
  });
  await logActivity(
    `Automated alert triggered: ${ind.IndicatorID} (${ind.IndicatorName}) in ${ind.District} fell to ${ind.Progress}% progress.`,
    user
  );
}

// ---------- surveys ----------
export async function getSurveys(): Promise<SurveyRecord[]> {
  const { data, error } = await supabase.from("surveys").select("*").order("id");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSurvey);
}

export async function getSurveyResponses(): Promise<SurveyResponse[]> {
  const { data, error } = await supabase
    .from("survey_responses")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapResponse);
}

export async function submitSurveyResponse(
  payload: {
    surveyId: string;
    respondentName: string;
    respondentType: string;
    district: string;
    commodity: string;
    gender?: string;
    ageGroup?: string;
    answers: { question: string; answer: string | number }[];
  },
  user: User | null
): Promise<void> {
  const { error } = await supabase.from("survey_responses").insert({
    survey_id: payload.surveyId,
    respondent_name: payload.respondentName,
    respondent_type: payload.respondentType,
    district: payload.district,
    commodity: payload.commodity,
    gender: payload.gender ?? null,
    age_group: payload.ageGroup ?? null,
    answers: payload.answers,
  });
  if (error) throw new Error(error.message);

  // Increment the survey's respondent count + refresh last_conducted.
  const { data: survey } = await supabase
    .from("surveys")
    .select("respondents_count,title")
    .eq("id", payload.surveyId)
    .maybeSingle();
  if (survey) {
    await supabase
      .from("surveys")
      .update({
        respondents_count: (survey.respondents_count ?? 0) + 1,
        last_conducted: new Date().toISOString(),
      })
      .eq("id", payload.surveyId);
    await logActivity(`Submitted evaluation questionnaire for "${survey.title}" in ${payload.district}`, user);
  }
}

export async function createSurvey(
  payload: {
    title: string;
    description: string;
    type: string;
    district: string;
    focalCommodity: string;
    targetCount: number;
    indicatorsAffected: string[];
  },
  user: User | null
): Promise<void> {
  const id = `LGF-SUR-${Date.now().toString().slice(-6)}`;
  const { error } = await supabase.from("surveys").insert({
    id,
    title: payload.title,
    description: payload.description,
    type: payload.type,
    status: "Scheduled",
    district: payload.district,
    respondents_count: 0,
    target_count: payload.targetCount,
    focal_commodity: payload.focalCommodity,
    last_conducted: new Date().toISOString(),
    indicators_affected: payload.indicatorsAffected,
    key_findings: "Awaiting field data collections.",
  });
  if (error) throw new Error(error.message);
  await logActivity(`Scheduled new evaluation survey: "${payload.title}" (${payload.type}) for ${payload.district}`, user);
}
