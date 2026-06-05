import React from "react";
import { AVDP_REPORT } from "../data/avdpReport";
import { Users, Accessibility, Briefcase, ShoppingCart, Banknote, AlertTriangle, CheckCircle2, Lightbulb, Flag, GitBranch } from "lucide-react";

const usd = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function DistrictBars({ data, max, color, unit }: { data: { district: string; v: number }[]; max: number; color: string; unit: string }) {
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.district} className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 w-24 truncate">{d.district}</span>
          <div className="flex-1 bg-slate-900 h-3.5 rounded overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.max(3, (d.v / max) * 100)}%` }} /></div>
          <span className="text-[11px] font-mono font-bold text-slate-200 w-8 text-right">{d.v}</span>
        </div>
      ))}
      <div className="text-[9px] font-mono text-slate-500 text-right pt-1">{unit}</div>
    </div>
  );
}

export default function OutcomesTab() {
  const R = AVDP_REPORT;
  const jobs = R.jobsByDistrict.map((j) => ({ district: j.district, v: j.jobs }));
  const pwda = R.pwdaByDistrict.map((p) => ({ district: p.district, v: p.count }));

  return (
    <div className="space-y-5">
      {/* AOS highlights */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <Users className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">2025 Annual Outcome Survey — Key Highlights</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {R.aos.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-slate-300 font-mono bg-slate-950/30 border border-slate-900 rounded-lg p-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /> {a}
            </div>
          ))}
        </div>
      </div>

      {/* Jobs + PwDA by district */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-emerald-400" /> Jobs Created by District</span>
            <span className="text-emerald-400 font-mono">{R.jobsTotal} total</span>
          </h4>
          <DistrictBars data={jobs} max={Math.max(...jobs.map((j) => j.v))} color="bg-emerald-500" unit="jobs created (846 = 11.5% of overall target)" />
        </div>
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="flex items-center gap-2"><Accessibility className="w-4 h-4 text-sky-400" /> Persons with Disabilities (PwDA)</span>
            <span className="text-sky-400 font-mono">{R.pwdaTotal} total</span>
          </h4>
          <DistrictBars data={pwda} max={Math.max(...pwda.map((p) => p.v))} color="bg-sky-500" unit="beneficiaries profiled across 15 districts" />
        </div>
      </div>

      {/* Targets under review */}
      <div className="bg-amber-950/15 border border-amber-500/25 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-amber-500/20 pb-3 mb-4">
          <Flag className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Targets Under Review</h3>
          <span className="text-[9px] bg-amber-950/40 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">PMU requesting reduction</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {R.targetsUnderReview.map((t) => {
            const pct = t.achieved != null ? Math.round((t.achieved / t.planned) * 100) : null;
            return (
              <div key={t.target} className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-100">{t.target}</span>
                  <span className="text-[11px] font-mono text-amber-300 shrink-0">{t.achieved != null ? t.achieved.toLocaleString() : "—"} / {t.planned.toLocaleString()} {t.unit}{pct != null ? ` · ${pct}%` : ""}</span>
                </div>
                {pct != null && <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-2"><div className="h-full bg-amber-500" style={{ width: `${Math.min(100, pct)}%` }} /></div>}
                <p className="text-[11px] text-slate-400 font-mono mt-2 leading-relaxed">{t.note}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial execution pipeline */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <span className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-emerald-400" /> 2026 Financial Execution Pipeline</span>
          <span className="text-emerald-400 font-mono text-xs">{R.procurementPipeline.total.count} activities · {usd(R.procurementPipeline.total.value)}</span>
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {R.procurementPipeline.stages.map((s) => {
            const pct = Math.round((s.value / R.procurementPipeline.total.value) * 100);
            return (
              <div key={s.stage} className="bg-slate-950/40 border border-slate-900 rounded-lg p-3">
                <div className="text-[9px] font-mono uppercase text-slate-500">{s.stage}</div>
                <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">{usd(s.value)}</div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                <div className="text-[9px] font-mono text-slate-500 mt-1">{s.count} activities · {pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Procurement + Finance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4"><ShoppingCart className="w-4 h-4 text-emerald-400" /> Procurement</h4>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-3"><div className="text-[9px] font-mono uppercase text-slate-500">2025 procured</div><div className="text-base font-bold font-mono text-slate-100">{usd(R.procurement.y2025Total)}</div></div>
            <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-3"><div className="text-[9px] font-mono uppercase text-slate-500">2026 portfolio</div><div className="text-base font-bold font-mono text-slate-100">{usd(R.procurement.portfolioTotal)}</div></div>
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5">2026 portfolio by review type</div>
          <div className="space-y-1.5 mb-4">
            {R.procurement.portfolio.map((p) => (
              <div key={p.category} className="flex justify-between text-[11px] font-mono"><span className="text-slate-400">{p.category}</span><span className="text-slate-200 font-bold">{usd(p.total)}</span></div>
            ))}
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5">Major procurements</div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {R.procurement.major.map((m, i) => (
              <div key={i} className="flex justify-between gap-2 text-[10px] font-mono bg-slate-950/30 border border-slate-900 rounded px-2 py-1">
                <span className="text-slate-300 truncate"><span className="text-emerald-400">[{m.phase}]</span> {m.activity}</span>
                <span className="text-slate-200 shrink-0">{usd(m.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4"><Banknote className="w-4 h-4 text-emerald-400" /> Finance</h4>
          <div className="space-y-2 mb-5">
            {R.finance.map((f, i) => <div key={i} className="text-[11px] text-slate-300 font-mono bg-slate-950/30 border border-slate-900 rounded-lg p-2.5">{f}</div>)}
          </div>
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1.5">2025 procurement methods</div>
          <div className="space-y-1.5">
            {R.procurement.y2025.map((m) => (
              <div key={m.method} className="flex justify-between text-[11px] font-mono"><span className="text-slate-400">{m.method}</span><span className="text-slate-200 font-bold">{usd(m.value)}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Challenges & recommendations */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Field Challenges &amp; Recommendations</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {R.challenges.map((c) => (
            <div key={c.category} className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-100 mb-2">{c.category}</div>
              <div className="space-y-1 mb-2.5">
                {c.challenges.map((x, i) => <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-300/90 font-mono"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{x}</div>)}
              </div>
              <div className="space-y-1 border-t border-slate-900 pt-2.5">
                {c.recommendations.map((x, i) => <div key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-300/90 font-mono"><Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />{x}</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
