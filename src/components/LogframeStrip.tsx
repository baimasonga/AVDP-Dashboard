import React from "react";
import { AVDP_REPORT } from "../data/avdpReport";
import { Target, ArrowRight } from "lucide-react";

interface Props {
  onOpenImplementation?: () => void;
}

const findRow = (gid: string, sub: string) => {
  const g = AVDP_REPORT.progress.find((x) => x.id === gid);
  return g?.rows.find((r) => r.label.includes(sub));
};
const sumGroup = (gid: string) => {
  const g = AVDP_REPORT.progress.find((x) => x.id === gid);
  if (!g) return { a: 0, t: 0 };
  return { a: g.rows.reduce((s, r) => s + r.achieved, 0), t: g.rows.reduce((s, r) => s + r.totalTarget, 0) };
};

// Compact "real AVDP logframe outputs vs target" band for the workspace header.
export default function LogframeStrip({ onOpenImplementation }: Props) {
  const ivs = findRow("infra", "IVS");
  const roads = findRow("climateinfra", "Feeder Road");
  const cocoa = findRow("treecrops", "New Cocoa");
  const palm = findRow("treecrops", "New Oil Palm");
  const onion = findRow("veg", "Bulb Onions");
  const ffs = sumGroup("ffs");

  const cards = [
    { label: "IVS (Rice)", cur: ivs?.achieved || 0, target: ivs?.totalTarget || 1, unit: "ha" },
    { label: "Feeder Roads", cur: roads?.achieved || 0, target: roads?.totalTarget || 1, unit: "km" },
    { label: "Cocoa Farms", cur: cocoa?.achieved || 0, target: cocoa?.totalTarget || 1, unit: "ha" },
    { label: "Oil Palm Farms", cur: palm?.achieved || 0, target: palm?.totalTarget || 1, unit: "ha" },
    { label: "Bulb Onions", cur: onion?.achieved || 0, target: onion?.totalTarget || 1, unit: "ha" },
    { label: "Farmer Field Schools", cur: ffs.a, target: ffs.t, unit: "FFS" },
  ];

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">AVDP Logframe — Key Outputs vs Target</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">IFAD Supervision · {AVDP_REPORT.meta.date}</span>
        </div>
        {onOpenImplementation && (
          <button onClick={onOpenImplementation} className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0">
            Full report <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((k) => {
          const pct = Math.min(100, Math.round((k.cur / k.target) * 100));
          return (
            <div key={k.label} className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
              <div className="text-[9px] font-mono uppercase text-slate-500 tracking-wider truncate">{k.label}</div>
              <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">{k.cur.toLocaleString()} <span className="text-[10px] text-slate-500">{k.unit}</span></div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5"><div className={`h-full ${pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} /></div>
              <div className="text-[8px] font-mono text-slate-500 mt-1">{pct}% of {k.target.toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
