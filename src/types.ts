export enum UserRole {
  ADMIN = "Admin",
  OFFICER = "Officer",
  STAKEHOLDER = "Stakeholder",
  PUBLIC = "Public"
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  district?: string; // Some officers are tied to specific districts
}

export type IndicatorCategory = 
  | "Yield Increase"
  | "Gender Inclusion"
  | "Farmer Income"
  | "Road Rehab"
  | "Seedling Survival Rate"
  | "Processing Facilities Built"
  | "Market Access Improvement";

export interface Indicator {
  IndicatorID: string;
  IndicatorName: IndicatorCategory;
  BaselineValue: number;
  AchievedValue: number;
  Target?: number; // logframe end-of-project target
  Progress: number; // percentage (Achieved / Baseline * 100)
  Status: "On Track" | "Need Attention" | "Critical";
  District: string;
  Commodity: "Rice" | "Cocoa" | "Coffee" | "Oil Palm" | "General";
  LastUpdated: string; // ISO String
}

export interface IndicatorHistoryPoint {
  baseline: number;
  achieved: number;
  progress: number;
  status: string;
  changedBy: string;
  recordedAt: string; // ISO String
}

export interface DistrictMetricSummary {
  name: string;
  code: string;
  region: "Eastern" | "Southern" | "Northern" | "North West" | "Western";
  riceYieldBaseline: number;
  riceYieldAchieved: number;
  cocoaYieldBaseline: number;
  cocoaYieldAchieved: number;
  coffeeYieldBaseline: number;
  coffeeYieldAchieved: number;
  palmYieldBaseline: number;
  palmYieldAchieved: number;
  roadsRehabbed: number;
  facilitiesBuilt: number;
  farmerIncomeAverage: number;
  historicalTrend: { year: number; yieldIndex: number; progress: number }[];
}

export interface ThresholdAlert {
  id: string;
  indicatorId: string;
  indicatorName: string;
  district: string;
  thresholdValue: number;
  currentValue: number;
  condition: "below" | "above";
  triggeredAt: string;
  recipientEmail: string;
  status: "Sent" | "Pending" | "Failed";
  enabled: boolean;
}

export interface SyncStatus {
  lastSyncTime: string | null;
  isOnline: boolean;
  pendingChangesCount: number;
}

export type SurveyType =
  | "Baseline Survey"
  | "Annual Outcome Survey"
  | "Seedling Survival Assessment"
  | "Road Impact Evaluation"
  | "Market Access & Marketing"
  | "Gender & Youth Inclusion Survey";

export interface SurveyRecord {
  id: string;
  title: string;
  description: string;
  type: SurveyType;
  status: "Active" | "Completed" | "Scheduled";
  district: string;
  respondentsCount: number;
  targetCount: number;
  focalCommodity: "Rice" | "Cocoa" | "Coffee" | "Oil Palm" | "General";
  lastConducted: string; // ISO string
  indicatorsAffected: string[]; // Associated indicator keys like LGF-001
  keyFindings?: string;
}

export type Gender = "Female" | "Male" | "Other";
export type AgeGroup = "Youth (18-35)" | "Adult (36-59)" | "Senior (60+)";

export interface SurveyResponse {
  id: string;
  surveyId: string;
  respondentName: string;
  respondentType: "Smallholder Farmer" | "Youth Co-op Member" | "Transport Operator" | "Local Offtaker" | "Swamp Cultivator";
  district: string;
  commodity: "Rice" | "Cocoa" | "Coffee" | "Oil Palm" | "General";
  gender?: Gender;
  ageGroup?: AgeGroup;
  answers: {
    question: string;
    answer: string | number;
  }[];
  submittedAt: string;
}

