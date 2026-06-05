import React, { useState } from "react";
import { AVDP_REPORT, ProgressGroup, ProgressRow } from "../data/avdpReport";
import { ClipboardList, CheckCircle2, Target, Sparkles, ChevronRight } from "lucide-react";

const pctOf = (r: ProgressRow) => (r.totalTarget > 0 ? Math.round((r.achieved / r.totalTarget) * 100) : 0);
const barColor = (p: number) => (p >= 100 ? "bg-emerald-500" : p >= 60 ? "bg-amber-500" : "bg-red-500");

function GroupCard({ g }: { g: ProgressGroup }) {
  const overall = Math.round((g.rows.reduce((a, r) => a + Math.min(1, r.achieved / (r.totalTarget || 1)), 0) / g.rows.length) * 100);
  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-emerald-400" />{g.title}</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">{g.summary}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold font-mono text-emerald-400">{overall}%</div>
          <div className="text-[8px] font-mono uppercase text-slate-500">avg complete</div>
        </div>
      </div>
      <div className="space-y-3">
        {g.rows.map((r) => {
          const p = pctOf(r);
          const unit = r.unit || g.unit;
          return (
            <div key={r.label}>
              <div className="flex justify-between items-baseline text-xs font-mono mb-1">
                <span className="text-slate-300">{r.label}</span>
                <span className="text-slate-400">
                  <strong className="text-slate-100">{r.achieved.toLocaleString()}</strong> / {r.totalTarget.toLocaleString()} {unit}
                  <span className={`ml-2 font-bold ${p >= 100 ? "text-emerald-400" : p >= 60 ? "text-amber-400" : "text-red-400"}`}>{p}%</span>
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${barColor(p)}`} style={{ width: `${Math.min(100, p)}%` }} />
              </div>
              {r.status && <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><ChevronRight className="w-2.5 h-2.5" />{r.status}{r.plan2026 ? <span className="ml-1 text-slate-600">· 2026 plan: {r.plan2026.toLocaleString()} {unit}</span> : null}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ImplementationTab() {
  const s = AVDP_REPORT.summary;
  const [filter, setFilter] = useState<string>("All");
  const groups = filter === "All" ? AVDP_REPORT.progress : AVDP_REPORT.progress.filter((g) => g.id === filter);

  return (
    <div className="space-y-5">
      {/* Project summary header */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <Target className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Implementation Progress — IFAD Supervision Mission</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">{AVDP_REPORT.meta.date}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Target households", v: s.households.toLocaleString() },
            { l: "Direct beneficiaries", v: `≈${s.beneficiaries.toLocaleString()}` },
            { l: "Women participation", v: `${s.womenPct}%` },
            { l: "Youth participation", v: `${s.youthPct}%` },
          ].map((k) => (
            <div key={k.l} className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
              <div className="text-[9px] font-mono uppercase text-slate-500">{k.l}</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-[11px] text-slate-400 font-mono">
          <div className="bg-slate-950/30 border border-slate-900 rounded-lg p-3"><span className="text-emerald-400 font-bold uppercase text-[9px]">Goal</span><p className="mt-1 leading-relaxed">{s.goal}</p></div>
          <div className="bg-slate-950/30 border border-slate-900 rounded-lg p-3"><span className="text-emerald-400 font-bold uppercase text-[9px]">Development objective</span><p className="mt-1 leading-relaxed">{s.objective}</p></div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {s.valueChains.map((vc) => <span key={vc} className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-950/20 text-emerald-400">{vc}</span>)}
        </div>
      </div>

      {/* AOS adoption band */}
      <div className="bg-emerald-950/15 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
          {[
            { l: "Adopted improved practices", v: "95.6%" },
            { l: "Climate-resilient practices", v: "78.5%" },
            { l: "FBOs ↑ production", v: "56%" },
            { l: "HHs ↑ production", v: "64.1%" },
          ].map((k) => (
            <div key={k.l}><div className="text-lg font-bold font-mono text-emerald-300">{k.v}</div><div className="text-[9px] font-mono uppercase text-slate-400">{k.l}</div></div>
          ))}
        </div>
      </div>

      {/* Group filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("All")} className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border cursor-pointer ${filter === "All" ? "bg-slate-800 border-slate-600 text-slate-100 font-bold" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"}`}>All components</button>
        {AVDP_REPORT.progress.map((g) => (
          <button key={g.id} onClick={() => setFilter(g.id)} className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border cursor-pointer ${filter === g.id ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400 font-bold" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"}`}>{g.title.split(" ").slice(0, 2).join(" ")}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {groups.map((g) => <GroupCard key={g.id} g={g} />)}
      </div>
    </div>
  );
}
