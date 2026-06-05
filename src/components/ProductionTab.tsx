import React from "react";
import { AVDP_REPORT } from "../data/avdpReport";
import { BarChart3, TrendingUp, Wheat, Sprout } from "lucide-react";

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 1 }));

export default function ProductionTab() {
  const prod = AVDP_REPORT.production;
  const maxProd = Math.max(...prod.flatMap((p) => [p.p2024, p.p2025, p.p2026 ?? 0]));
  const y = AVDP_REPORT.yields;
  const maxYield = Math.max(y.rice.supported2025, y.rice.supported2024, ...y.others.map((o) => o.value));

  return (
    <div className="space-y-5">
      {/* Production & sales */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Value Chain Production &amp; Sales Volumes</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">2024 → 2026 (MT)</span>
        </div>

        <div className="space-y-4">
          {prod.map((p) => {
            const bars = [
              { yr: "2024", v: p.p2024, c: "bg-slate-500" },
              { yr: "2025", v: p.p2025, c: "bg-emerald-500" },
              { yr: "2026", v: p.p2026, c: "bg-teal-400" },
            ];
            return (
              <div key={p.valueChain} className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="text-sm font-bold text-slate-100">{p.valueChain}</div>
                  <div className="text-[10px] font-mono text-slate-400">Partner: <span className="text-emerald-400">{p.partner}</span> · Sales ’25: {fmt(p.s2025)} · ’26: {fmt(p.s2026)} MT</div>
                </div>
                <div className="space-y-2">
                  {bars.map((b) => (
                    <div key={b.yr} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-500 w-9">{b.yr}</span>
                      <div className="flex-1 bg-slate-900 h-4 rounded overflow-hidden relative">
                        <div className={`h-full ${b.c}`} style={{ width: `${b.v == null ? 0 : Math.max(2, (b.v / maxProd) * 100)}%` }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-200 w-20 text-right">{fmt(b.v)} MT</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Yield studies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4"><Wheat className="w-4 h-4 text-emerald-400" /> IVS Rice Yield Study ({y.rice.farms} farms)</h4>
          {[
            { l: "AVDP-supported farms", a: y.rice.supported2024, b: y.rice.supported2025, c: "bg-emerald-500" },
            { l: "Non-supported farms", a: y.rice.non2024, b: y.rice.non2025, c: "bg-slate-500" },
          ].map((r) => (
            <div key={r.l} className="mb-4">
              <div className="flex justify-between text-xs font-mono mb-1"><span className="text-slate-300">{r.l}</span><span className="text-slate-400">{r.a} → <strong className="text-slate-100">{r.b}</strong> Mt/ha</span></div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900 h-3 rounded overflow-hidden"><div className={`h-full ${r.c}`} style={{ width: `${(r.b / maxYield) * 100}%` }} /></div>
                <span className="text-[10px] font-mono text-emerald-400">+{Math.round(((r.b - r.a) / r.a) * 100)}%</span>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-500 font-mono">Supported farms yield ~47% more than non-supported (2025).</p>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 mb-4"><Sprout className="w-4 h-4 text-emerald-400" /> Other Yield Studies</h4>
          <div className="space-y-3">
            {y.others.map((o) => (
              <div key={o.crop} className="bg-slate-950/40 border border-slate-900 rounded-lg p-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-100">{o.crop}</span>
                  <span className="text-base font-bold font-mono text-emerald-400">{o.value} <span className="text-[10px] text-slate-500">Mt/ha</span></span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{o.year} · {o.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
