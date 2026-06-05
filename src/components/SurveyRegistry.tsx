import React, { useState, useEffect, useMemo } from "react";
import { SurveyRecord, SurveyResponse, User, UserRole, Gender, AgeGroup } from "../types";
import * as db from "../lib/db";
import { 
  ClipboardCheck, Users, FileSpreadsheet, Plus, Filter, 
  CheckCircle2, Play, Calendar, MapPin, Database, Sparkles, 
  Send, AlertCircle, HelpCircle, Info, ArrowUpRight, TrendingUp, Search
} from "lucide-react";

interface SurveyRegistryProps {
  currentUser: User | null;
  indicators: any[];
  selectedDistrict: string | null;
  isLowBandwidth: boolean;
  onRefreshLogs?: () => void;
}

export default function SurveyRegistry({
  currentUser,
  indicators,
  selectedDistrict,
  isLowBandwidth,
  onRefreshLogs
}: SurveyRegistryProps) {
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter conditions
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [districtFilter, setDistrictFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Submitter state
  const [activeSurveyId, setActiveSurveyId] = useState<string>("");
  const [respondentName, setRespondentName] = useState("");
  const [respondentType, setRespondentType] = useState<SurveyResponse["respondentType"]>("Smallholder Farmer");
  const [gender, setGender] = useState<Gender>("Female");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("Youth (18-35)");
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Administrative Survey Creator state
  const [showCreator, setShowCreator] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<SurveyRecord["type"]>("Baseline Survey");
  const [newDistrict, setNewDistrict] = useState("Kailahun");
  const [newCommodity, setNewCommodity] = useState<SurveyRecord["focalCommodity"]>("Rice");
  const [newTarget, setNewTarget] = useState<number>(200);
  const [newIndicatorsAffected, setNewIndicatorsAffected] = useState<string>("");

  // Load surveys from Supabase
  const fetchSurveysAndResponses = async () => {
    try {
      setLoading(true);
      const [surveysData, responsesData] = await Promise.all([
        db.getSurveys(),
        db.getSurveyResponses(),
      ]);
      setSurveys(surveysData);
      setResponses(responsesData);
    } catch (err: any) {
      console.warn("Supabase unreachable for surveys.", err);
      setError("Database connection offline. Proceeding in dry-run buffer.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurveysAndResponses();
  }, []);

  // Update default filters when map selection changes
  useEffect(() => {
    if (selectedDistrict) {
      setDistrictFilter(selectedDistrict);
    }
  }, [selectedDistrict]);

  // Handle Dynamic Questions dependent on Focal Commodity
  const selectedSurveyDetails = useMemo(() => {
    return surveys.find(s => s.id === activeSurveyId);
  }, [activeSurveyId, surveys]);

  const surveyQuestions = useMemo(() => {
    if (!selectedSurveyDetails) return [];
    
    const comm = selectedSurveyDetails.focalCommodity;
    if (comm === "Rice") {
      return [
        { key: "q1", text: "Acres of Inland Valley Swamp (IVS) pre-cultivated", placeholder: "e.g. 2.5" },
        { key: "q2", text: "Estimated rice yield increase factor", placeholder: "e.g. 1.3x" },
        { key: "q3", text: "Fertilizer accessibility feedback", placeholder: "e.g. Received late / In time" }
      ];
    } else if (comm === "Cocoa") {
      return [
        { key: "q1", text: "Total seed heads or saplings received", placeholder: "e.g. 250" },
        { key: "q2", text: "Estimated sapling survival coefficient (%)", placeholder: "e.g. 85%" },
        { key: "q3", text: "Do shade tree companions cover the land parcel?", placeholder: "e.g. Yes / Partial" }
      ];
    } else if (comm === "Oil Palm") {
      return [
        { key: "q1", text: "Oil palm sprouts successfully transplanted", placeholder: "e.g. 120" },
        { key: "q2", text: "Nursery soil quality evaluation", placeholder: "e.g. Excellent / Fair / Substandard" }
      ];
    } else {
      return [
        { key: "q1", text: "Observed transit delay variation on finished feeder links", placeholder: "e.g. Reduced by 2 hours" },
        { key: "q2", text: "Market bulk purchaser price premium received (%)", placeholder: "e.g. 15%" }
      ];
    }
  }, [selectedSurveyDetails]);

  // Handle Response Submissions
  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setSubmitError("Please sign in to log field survey responses.");
      return;
    }
    if (!activeSurveyId || !respondentName.trim()) {
      setSubmitError("Please designate the focal survey project ID and respondent name.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    // Format structured answers array
    const formattedAnswers = surveyQuestions.map(q => ({
      question: q.text,
      answer: customAnswers[q.key] || "No response details"
    }));

    try {
      await db.submitSurveyResponse(
        {
          surveyId: activeSurveyId,
          respondentName,
          respondentType,
          district: selectedSurveyDetails?.district || "Kailahun",
          commodity: selectedSurveyDetails?.focalCommodity || "General",
          gender,
          ageGroup,
          answers: formattedAnswers,
        },
        currentUser
      );

      setSubmitSuccess("Stakeholder interview submitted successfully to national metrics logs.");
      setRespondentName("");
      setCustomAnswers({});
      setActiveSurveyId("");
      
      // Update data immediately
      await fetchSurveysAndResponses();
      if (onRefreshLogs) onRefreshLogs();

      setTimeout(() => setSubmitSuccess(null), 5000);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to commit questionnaire input. Cache scheduled.");
    } finally {
      setSubmitting(false);
    }
  };

  // Administrative Survey Creator handler
  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setSubmitError("Please fill out the survey title.");
      return;
    }

    try {
      const parsedIndicators = newIndicatorsAffected
        ? newIndicatorsAffected.split(",").map(id => id.trim().toUpperCase())
        : [];

      await db.createSurvey(
        {
          title: newTitle,
          description: newDescription,
          type: newType,
          district: newDistrict,
          focalCommodity: newCommodity,
          targetCount: newTarget,
          indicatorsAffected: parsedIndicators,
        },
        currentUser
      );

      setSubmitSuccess(`New scheduled M&E survey successfully configured for ${newDistrict}!`);
      setNewTitle("");
      setNewDescription("");
      setNewIndicatorsAffected("");
      setShowCreator(false);

      await fetchSurveysAndResponses();
      if (onRefreshLogs) onRefreshLogs();

      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err: any) {
      setSubmitError(err.message || "Verification failed during administrative planning.");
    }
  };

  // Filter logic
  const filteredSurveys = useMemo(() => {
    return surveys.filter(s => {
      const matchType = typeFilter === "All" || s.type === typeFilter;
      const matchStatus = statusFilter === "All" || s.status === statusFilter;
      const matchDistrict = districtFilter === "All" || s.district.toLowerCase() === districtFilter.toLowerCase();
      const matchQuery = searchQuery.trim() === "" || 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase());

      return matchType && matchStatus && matchDistrict && matchQuery;
    });
  }, [surveys, typeFilter, statusFilter, districtFilter, searchQuery]);

  // Summary widgets
  const stats = useMemo(() => {
    const totalCount = surveys.length;
    const completedCount = surveys.filter(s => s.status === "Completed").length;
    const activeCount = surveys.filter(s => s.status === "Active").length;
    const respondentsSum = surveys.reduce((sum, s) => sum + s.respondentsCount, 0);
    const targetSum = surveys.reduce((sum, s) => sum + s.targetCount, 0);

    return { totalCount, completedCount, activeCount, respondentsSum, targetSum };
  }, [surveys]);

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm relative mt-6" id="avdp-survey-registry-mount">
      
      {/* Container header banner */}
      <div className="border-b border-slate-800 pb-4 mb-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100 tracking-tight">
              AVDP Field Surveys & Outcomes Evaluations Hub
            </h3>
            <span className="text-[9px] bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              IFAD G-100 Standardized
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Examine current and planned field assessments. Log actual farmer interview responses safely with programmatic M&E validation codes.
          </p>
        </div>

        {/* Action Button for Admins */}
        {currentUser?.role === UserRole.ADMIN && (
          <button
            onClick={() => setShowCreator(!showCreator)}
            className="text-[11px] bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/30 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" />
            {showCreator ? "Dismiss Setup Form" : "Schedule New Survey"}
          </button>
        )}
      </div>

      {/* Stats KPI panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 leading-none">
            Planned & Administered
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-bold font-mono text-slate-100">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400 text-slate-400">assessments</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-500 leading-none">
            Active Collection Fields
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-bold font-mono text-amber-400">{stats.activeCount}</span>
            <span className="text-[10px] text-slate-400">surveys in work</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-emerald-400 leading-none">
            Completed Assessments
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-bold font-mono text-emerald-400">{stats.completedCount}</span>
            <span className="text-[10px] text-slate-400">finalized</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500 leading-none">
            Aggregated Respondent Base
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-bold font-mono text-slate-100">{stats.respondentsSum}</span>
            <span className="text-[10px] font-mono text-slate-400">/ {stats.targetSum} farmers</span>
          </div>
        </div>
      </div>

      {/* Errors & Success Toasts */}
      {submitError && (
        <div className="bg-red-950/30 border border-red-500/40 text-red-300 p-3 rounded-lg text-xs font-mono my-3 flex items-start gap-2 animate-pulse">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>Error details: {submitError}</span>
        </div>
      )}
      {submitSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 p-3 rounded-lg text-xs font-semibold my-2 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {/* Admin Creator Modal Block */}
      {showCreator && currentUser?.role === UserRole.ADMIN && (
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-5 mb-6 space-y-4">
          <h4 className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase border-b border-slate-900 pb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Configure & Schedule Dynamic Evaluation Survey
          </h4>

          <form onSubmit={handleCreateSurvey} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 space-y-1">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                Survey Title / Name
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Yield survival and post-harvest milling assessment"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                Evals Methodology Category
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-300"
              >
                <option value="Baseline Survey">Baseline Survey</option>
                <option value="Annual Outcome Survey">Annual Outcome Survey</option>
                <option value="Seedling Survival Assessment">Seedling Survival Assessment</option>
                <option value="Road Impact Evaluation">Road Impact Evaluation</option>
                <option value="Market Access & Marketing">Market Access & Marketing</option>
                <option value="Gender & Youth Inclusion Survey">Gender & Youth Inclusion Survey</option>
              </select>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                Focus Field District
              </label>
              <select
                value={newDistrict}
                onChange={(e) => setNewDistrict(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono text-slate-300"
              >
                {["Kailahun", "Kenema", "Kono", "Bo", "Bonthe", "Moyamba", "Pujehun", "Port Loko", "Kambia", "Bombali", "Tonkolili", "Koinadugu", "Falaba", "Karene", "Western Area Rural", "Western Area Urban"].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-12 space-y-1">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                Descriptive operational brief
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                placeholder="Briefly detail what field questions indicators this assessment is measuring in the communities..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                Focal Trade Commodity Focus
              </label>
              <select
                value={newCommodity}
                onChange={(e) => setNewCommodity(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-300 font-medium"
              >
                <option value="Rice">Rice</option>
                <option value="Cocoa">Cocoa</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Oil Palm">Oil Palm</option>
                <option value="General">General/Infrastructure</option>
              </select>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                Target Sample Hype (Count)
              </label>
              <input
                type="number"
                value={newTarget}
                onChange={(e) => setNewTarget(parseInt(e.target.value) || 100)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-6 space-y-1">
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-semibold tracking-wider">
                Linked Indicator Keys (comma separated)
              </label>
              <input
                type="text"
                value={newIndicatorsAffected}
                onChange={(e) => setNewIndicatorsAffected(e.target.value)}
                placeholder="e.g. LGF-001, LGF-002, LGF-025"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="md:col-span-12 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreator(false)}
                className="text-[10px] hover:bg-slate-900 border border-slate-800 text-slate-500 px-3 py-1.5 rounded cursor-pointer leading-tight font-bold uppercase transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-[10px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-1.5 rounded cursor-pointer leading-tight uppercase transition shadow"
              >
                Publish Survey Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Dynamic Pipeline Filters + Survey Cards List */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Dynamic Filter Controls Bar */}
          <div className="bg-[#070b13]/60 border border-slate-900 p-3.5 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Pipeline Filter Controls</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-mono uppercase text-slate-500 font-semibold mb-1">
                  Methodology Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-slate-950 text-slate-300 border border-slate-800 rounded-lg p-1.5 text-[11px] focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Categories</option>
                  <option value="Baseline Survey">Baseline Surveys</option>
                  <option value="Annual Outcome Survey">Annual Outcomes</option>
                  <option value="Seedling Survival Assessment">Seedling Survival</option>
                  <option value="Road Impact Evaluation">Road Impacts</option>
                  <option value="Market Access & Marketing">Market Access</option>
                  <option value="Gender & Youth Inclusion Survey">Gender & Youth</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-slate-500 font-semibold mb-1">
                  Field Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-950 text-slate-300 border border-slate-800 rounded-lg p-1.5 text-[11px] focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Scheduled">Scheduled</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase text-slate-500 font-semibold mb-1">
                  Filter District
                </label>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="w-full bg-slate-950 text-slate-300 border border-slate-800 rounded-lg p-1.5 text-[11px] focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Districts</option>
                  {["Kailahun", "Kenema", "Kono", "Bo", "Bonthe", "Moyamba", "Pujehun", "Port Loko", "Kambia", "Bombali", "Tonkolili", "Koinadugu", "Falaba", "Karene", "Western Area Rural", "Western Area Urban"].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Keyword Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search survey titles or key indicator codes..."
                className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2 pl-8 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Active Cards Grid Box */}
          <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredSurveys.map((survey) => {
              const progressPct = survey.targetCount > 0 
                ? Math.min(100, Math.round((survey.respondentsCount / survey.targetCount) * 100))
                : 0;

              return (
                <div 
                  key={survey.id}
                  className="bg-slate-950/20 border border-slate-900 rounded-xl p-4 hover:border-slate-800 transition-all duration-200 space-y-3"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {survey.id}
                        </span>
                        
                        <span className={`text-[9px] font-mono font-bold tracking-wide uppercase px-2 py-0.5 rounded border ${
                          survey.status === "Completed"
                            ? "bg-slate-950 text-slate-400 border-slate-800"
                            : survey.status === "Active"
                              ? "bg-amber-950/40 text-amber-400 border-amber-500/25"
                              : "bg-slate-950/60 text-indigo-400 border-indigo-500/20"
                        }`}>
                          {survey.status}
                        </span>

                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {survey.district}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-100 mt-1 flex items-center gap-1">
                        <span>{survey.title}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-600 hidden group-hover:inline" />
                      </h4>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1 font-mono text-[9px] text-slate-500">
                      <span>Crop: {survey.focalCommodity}</span>
                      <span>{new Date(survey.lastConducted).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-normal font-mono">
                    {survey.description}
                  </p>

                  {/* Impact findings summary fold */}
                  {survey.respondentsCount > 0 && (
                    <div className="bg-[#050912]/80 border border-slate-900/60 p-2.5 rounded-lg text-[11px]">
                      <span className="text-[9px] font-mono uppercase font-bold text-emerald-400 block tracking-wider mb-1">
                        Active Key Findings Report
                      </span>
                      <p className="text-slate-300 italic">
                        &ldquo;{survey.keyFindings}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Sample completion bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                      <span>Sample targeted completion progress</span>
                      <span>
                        <strong className="text-slate-300 font-semibold">{survey.respondentsCount}</strong>
                        / {survey.targetCount} ({progressPct}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          survey.status === "Completed" 
                            ? "bg-slate-500" 
                            : "bg-gradient-to-r from-emerald-500 to-teal-500"
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Linked indicators tags */}
                  {survey.indicatorsAffected.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[9px] font-mono text-slate-600 uppercase">Related M&E Index:</span>
                      {survey.indicatorsAffected.map(indId => (
                        <span 
                          key={indId}
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-500/10 cursor-help"
                          title="Clicking here tracks index metrics on general table."
                        >
                          {indId}
                        </span>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}

            {filteredSurveys.length === 0 && (
              <div className="text-center py-16 bg-slate-950/20 border border-slate-900 rounded-xl text-slate-500 text-xs font-mono">
                No scheduled survey project frameworks matched pipeline filter coordinates.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Field Collector Simulator Form */}
        <div className="lg:col-span-5 bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <form onSubmit={handleSubmitResponse} className="space-y-4">
            
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase border-b border-slate-900 pb-2">
              <Database className="w-3.5 h-3.5" />
              Log Field Stakeholder response
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              AVDP Field Managers can use this terminal to log direct household or cooperative interview responses to compile overall evaluation stats.
            </p>

            {submitError && (
              <div className="bg-red-950/20 border border-red-500/40 text-red-300 p-2.5 rounded-lg text-[11px]">
                {submitError}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                Target Active Assessment
              </label>
              <select
                value={activeSurveyId}
                onChange={(e) => {
                  setActiveSurveyId(e.target.value);
                  setCustomAnswers({});
                }}
                className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="">Choose survey...</option>
                {surveys.filter(s => s.status !== "Completed").map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id} - {s.title.slice(0, 32)}... ({s.district})
                  </option>
                ))}
              </select>
            </div>

            {selectedSurveyDetails && (
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2.5">
                <div className="text-[10px] font-mono flex justify-between text-slate-500">
                  <span>Category: {selectedSurveyDetails.type}</span>
                  <span>District: {selectedSurveyDetails.district}</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-300">
                  Focal Commodity focus: <span className="text-emerald-400">{selectedSurveyDetails.focalCommodity}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                Respondent / Farmer Name
              </label>
              <input
                type="text"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="e.g. Sheriff Sesay"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                  Respondent Type
                </label>
                <select
                  value={respondentType}
                  onChange={(e) => setRespondentType(e.target.value as any)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="Smallholder Farmer">Smallholder Farmer</option>
                  <option value="Youth Co-op Member">Youth Co-op Member</option>
                  <option value="Transport Operator">Transport Operator</option>
                  <option value="Local Offtaker">Local Offtaker</option>
                  <option value="Swamp Cultivator">Swamp Cultivator</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                  District Reference
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedSurveyDetails?.district || "N/A"}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-500 rounded-lg p-2 font-mono text-xs cursor-not-allowed"
                />
              </div>
            </div>

            {/* Gender & youth disaggregation (IFAD reporting requirement) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                  Respondent Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                  Age Bracket
                </label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="Youth (18-35)">Youth (18-35)</option>
                  <option value="Adult (36-59)">Adult (36-59)</option>
                  <option value="Senior (60+)">Senior (60+)</option>
                </select>
              </div>
            </div>

            {/* Questions list based on selected survey */}
            {selectedSurveyDetails && surveyQuestions.length > 0 && (
              <div className="space-y-3.5 border-t border-slate-900 pt-3">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block tracking-wider">
                  Questionnaire response data
                </span>

                {surveyQuestions.map((q) => (
                  <div key={q.key} className="space-y-1">
                    <label className="block text-[10px] text-slate-300 font-mono">
                      {q.text}
                    </label>
                    <input
                      type="text"
                      value={customAnswers[q.key] || ""}
                      onChange={(e) => setCustomAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                      placeholder={q.placeholder}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !activeSurveyId || !respondentName.trim()}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 rounded-lg text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Transmitting responses stream..." : "Transmit Field response"}
            </button>
          </form>

          <p className="text-[10px] text-slate-500 leading-normal mt-4 border-t border-slate-900 pt-3">
            Warning: Submitted evaluations update in-memory queues. To maintain low bandwidth constraints, local offline storage aggregates duplicates blockwise under weak cellular links.
          </p>
        </div>

      </div>

    </div>
  );
}
