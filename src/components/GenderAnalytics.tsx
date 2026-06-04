import React, { useEffect, useMemo, useState } from "react";
import { SurveyResponse } from "../types";
import { getSurveyResponses } from "../lib/db";
import { Users, UserCheck, Baby } from "lucide-react";

interface Props {
  selectedDistrict: string | null;
  isLowBandwidth: boolean;
}

// Gender & youth inclusion analytics derived from survey responses (IFAD reporting).
export default function GenderAnalytics({ selectedDistrict }: Props) {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSurveyResponses()
      .then((r) => active && setResponses(r))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const scoped = selectedDistrict
      ? responses.filter((r) => r.district === selectedDistrict)
      : responses;
    const total = scoped.length;
    const female = scoped.filter((r) => r.gender === "Female").length;
    const male = scoped.filter((r) => r.gender === "Male").length;
    const other = scoped.filter((r) => r.gender === "Other").length;
    const youth = scoped.filter((r) => r.ageGroup === "Youth (18-35)").length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return { total, female, male, other, youth, pct };
  }, [responses, selectedDistrict]);

  const bars = [
    { label: "Female", value: stats.female, pct: stats.pct(stats.female), color: "bg-fuchsia-500" },
    { label: "Male", value: stats.male, pct: stats.pct(stats.male), color: "bg-sky-500" },
    { label: "Other / NA", value: stats.other, pct: stats.pct(stats.other), color: "bg-slate-500" },
  ];

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm mt-6">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
        <Users className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-slate-100">
          Gender & Youth Inclusion Analytics
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">
          {selectedDistrict ? selectedDistrict : "All districts"} · {stats.total} responses
        </span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500 text-xs font-mono animate-pulse">
          Loading respondent demographics…
        </div>
      ) : stats.total === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs font-mono">
          No survey responses recorded for this scope yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* gender distribution bars */}
          <div className="md:col-span-2 space-y-3">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider">
              Respondents by gender
            </span>
            {bars.map((b) => (
              <div key={b.label} className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>{b.label}</span>
                  <span>
                    <strong className="text-slate-200">{b.value}</strong> ({b.pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${b.color}`} style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* headline ratios */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
            <div className="bg-fuchsia-950/20 border border-fuchsia-500/20 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-fuchsia-400">
                <UserCheck className="w-3.5 h-3.5" /> Female participation
              </div>
              <div className="text-2xl font-bold font-mono text-fuchsia-300 mt-1">
                {stats.pct(stats.female)}%
              </div>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold text-emerald-400">
                <Baby className="w-3.5 h-3.5" /> Youth (18-35)
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
                {stats.pct(stats.youth)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
