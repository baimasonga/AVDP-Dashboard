import React from "react";
import { AVDP_REPORT } from "../data/avdpReport";
import { Banknote, PiggyBank, TrendingUp, Wallet, Layers, Tags } from "lucide-react";

const F = AVDP_REPORT.financials;
const fmt = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`);
const execColor = (p: number) => (p >= 75 ? "bg-emerald-500" : p >= 40 ? "bg-amber-500" : "bg-red-500");
const execText = (p: number) => (p >= 75 ? "text-emerald-400" : p >= 40 ? "text-amber-400" : "text-red-400");

function ExecRow({ label, budget, exp, exec, sub }: { label: string; budget: number; exp?: number; exec: number; sub?: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs font-mono mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">
          {exp != null ? <>{fmt(exp)} / </> : null}{fmt(budget)}
          <span className={`ml-2 font-bold ${execText(exec)}`}>{exec}%</span>
        </span>
      </div>
      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden"><div className={`h-full ${execColor(exec)}`} style={{ width: `${Math.min(100, exec)}%` }} /></div>
      {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function FinanceTab() {
  const g = F.disbursement.grandTotal;

  return (
    <div className="space-y-5">
      {/* Headline KPIs */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <Banknote className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Financial Performance &amp; Disbursement</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">as at {F.asOf}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { l: "Project cost", v: fmt(g.cost), i: PiggyBank },
            { l: "Total disbursed", v: fmt(g.disbursed), i: Wallet, accent: true },
            { l: "Balance", v: fmt(g.balance), i: TrendingUp },
            { l: "FY2025 execution", v: `${F.fy2025.exec}%`, i: Layers },
            { l: "FY2026 YTD (Jan–May)", v: `${F.fy2026.janMay.exec}%`, i: Tags },
          ].map((k) => (
            <div key={k.l} className={`rounded-xl p-3 border ${k.accent ? "bg-emerald-950/20 border-emerald-500/20" : "bg-slate-950/40 border-slate-900"}`}>
              <div className="text-[9px] font-mono uppercase text-slate-500 flex items-center gap-1"><k.i className="w-3 h-3" /> {k.l}</div>
              <div className={`text-lg font-bold font-mono mt-0.5 ${k.accent ? "text-emerald-300" : "text-slate-100"}`}>{k.v}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1"><span>Overall disbursement</span><span className="text-emerald-400 font-bold">{g.pct}% · {fmt(g.disbursed)} of {fmt(g.cost)}</span></div>
          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${g.pct}%` }} /></div>
        </div>
      </div>

      {/* Disbursement by funding source */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4"><Wallet className="w-4 h-4 text-emerald-400" /> Disbursement by Funding Source</h4>
        <div className="space-y-3">
          {F.disbursement.bySource.map((s) => (
            <div key={s.source}>
              <div className="flex justify-between items-baseline text-xs font-mono mb-1">
                <span className="text-slate-300">{s.source}</span>
                <span className="text-slate-400">{fmt(s.disbursed)} / {fmt(s.cost)} <span className={`ml-1 font-bold ${execText(s.pct)}`}>{s.pct}%</span></span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden"><div className={`h-full ${execColor(s.pct)}`} style={{ width: `${Math.min(100, s.pct)}%` }} /></div>
              <div className="text-[10px] text-slate-500 mt-1">Balance: {fmt(s.balance)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FY2026 by component + category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4"><Layers className="w-4 h-4 text-emerald-400" /> FY2026 Execution by Component <span className="text-[10px] text-slate-500 font-normal ml-auto">Jan–May</span></h4>
          <div className="space-y-3.5">
            {F.fy2026.byComponent.map((c) => (
              <ExecRow key={c.name} label={c.name} budget={c.jmBudget} exp={c.jmExp} exec={c.jmExec} sub={`Year-end budget ${fmt(c.yeBudget)} · YE exec ${c.yeExec}%`} />
            ))}
          </div>
        </div>
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4"><Tags className="w-4 h-4 text-emerald-400" /> FY2026 Execution by Category <span className="text-[10px] text-slate-500 font-normal ml-auto">Jan–May</span></h4>
          <div className="space-y-3.5">
            {F.fy2026.byCategory.map((c) => (
              <ExecRow key={c.name} label={c.name} budget={c.jmBudget} exp={c.jmExp} exec={c.jmExec} sub={`Year-end budget ${fmt(c.yeBudget)} · YE exec ${c.yeExec}%`} />
            ))}
          </div>
        </div>
      </div>

      {/* FY2025 actuals by financier */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <span className="flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-400" /> FY2025 Actuals by Financier</span>
          <span className="text-emerald-400 font-mono text-xs">{fmt(F.fy2025.expenditure)} / {fmt(F.fy2025.budget)} · {F.fy2025.exec}%</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {F.fy2025.byFinancier.map((r) => (
            <ExecRow key={r.name} label={r.name} budget={r.budget} exp={r.expenditure} exec={r.exec} />
          ))}
        </div>
      </div>
    </div>
  );
}
