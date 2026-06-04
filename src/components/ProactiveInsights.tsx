import React, { useMemo } from "react";
import { Indicator } from "../types";
import { Lightbulb, AlertTriangle, TrendingDown, Target, MapPin, Sparkles } from "lucide-react";

interface Props {
  indicators: Indicator[];
  onSelectDistrict: (d: string | null) => void;
  isLowBandwidth: boolean;
}

type Insight = {
  tone: "danger" | "warn" | "good" | "info";
  icon: React.ReactNode;
  title: string;
  detail: string;
  district?: string;
};

// Rule-based anomaly surfacing — reliable, deterministic "what to watch" cards.
export default function ProactiveInsights({ indicators, onSelectDistrict, isLowBandwidth }: Props) {
  const insights = useMemo<Insight[]>(() => {
    if (indicators.length === 0) return [];
    const out: Insight[] = [];

    // 1) Districts with 2+ critical indicators
    const byDistrict: Record<string, Indicator[]> = {};
    indicators.forEach((i) => {
      (byDistrict[i.District] ||= []).push(i);
    });
    const hotspots = Object.entries(byDistrict)
      .map(([d, list]) => ({ d, crit: list.filter((i) => i.Status === "Critical").length }))
      .filter((x) => x.crit >= 2)
      .sort((a, b) => b.crit - a.crit);
    hotspots.slice(0, 2).forEach((h) =>
      out.push({
        tone: "danger",
        icon: <AlertTriangle className="w-4 h-4" />,
        title: `${h.d}: ${h.crit} critical indicators`,
        detail: "Cluster of sub-baseline metrics — prioritise remedial interventions here.",
        district: h.d,
      })
    );

    // 2) Single worst-performing indicator
    const worst = [...indicators].sort((a, b) => a.Progress - b.Progress)[0];
    if (worst) {
      out.push({
        tone: "warn",
        icon: <TrendingDown className="w-4 h-4" />,
        title: `Lowest progress: ${worst.IndicatorID} (${worst.Progress}%)`,
        detail: `${worst.IndicatorName} in ${worst.District}. Furthest below its baseline target.`,
        district: worst.District,
      });
    }

    // 3) Commodity carrying the most critical indicators
    const byCommodity: Record<string, number> = {};
    indicators.filter((i) => i.Status === "Critical").forEach((i) => {
      byCommodity[i.Commodity] = (byCommodity[i.Commodity] || 0) + 1;
    });
    const worstComm = Object.entries(byCommodity).sort((a, b) => b[1] - a[1])[0];
    if (worstComm && worstComm[0] !== "General") {
      out.push({
        tone: "warn",
        icon: <Sparkles className="w-4 h-4" />,
        title: `${worstComm[0]} value chain under strain`,
        detail: `${worstComm[1]} critical indicator(s) tagged to ${worstComm[0]} — review inputs & extension support.`,
      });
    }

    // 4) Logframe target attainment
    const withTarget = indicators.filter((i) => i.Target != null && i.Target > 0);
    if (withTarget.length > 0) {
      const met = withTarget.filter((i) => i.AchievedValue >= (i.Target as number)).length;
      const pct = Math.round((met / withTarget.length) * 100);
      out.push({
        tone: pct >= 50 ? "good" : "info",
        icon: <Target className="w-4 h-4" />,
        title: `${pct}% of indicators have met their end-of-project target`,
        detail: `${met} of ${withTarget.length} indicators are at or above their logframe target value.`,
      });
    }

    return out;
  }, [indicators]);

  if (insights.length === 0) return null;

  const toneClass: Record<Insight["tone"], string> = {
    danger: "border-red-500/30 bg-red-950/20 text-red-300",
    warn: "border-amber-500/25 bg-amber-950/15 text-amber-300",
    good: "border-emerald-500/25 bg-emerald-950/20 text-emerald-300",
    info: "border-slate-700/50 bg-slate-900/40 text-slate-300",
  };

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
        <Lightbulb className={`w-4 h-4 text-emerald-400 ${isLowBandwidth ? "" : "animate-pulse"}`} />
        <h3 className="text-sm font-bold text-slate-100">Proactive Insights — What to Watch</h3>
        <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
          Auto-derived
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {insights.map((ins, idx) => (
          <button
            key={idx}
            onClick={() => ins.district && onSelectDistrict(ins.district)}
            className={`text-left border rounded-xl p-3.5 transition-all ${toneClass[ins.tone]} ${
              ins.district ? "cursor-pointer hover:brightness-125" : "cursor-default"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-100">
              {ins.icon}
              <span>{ins.title}</span>
            </div>
            <p className="text-[11px] mt-1.5 leading-relaxed opacity-90">{ins.detail}</p>
            {ins.district && (
              <span className="text-[9px] font-mono mt-2 inline-flex items-center gap-1 opacity-70">
                <MapPin className="w-2.5 h-2.5" /> Click to focus {ins.district}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
