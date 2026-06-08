import React from "react";
import { AVDP_REPORT } from "../data/avdpReport";
import { Handshake, DollarSign, Route, Building2, TrendingUp } from "lucide-react";

// Pull a single row out of a progress group by partial label match.
const rowOf = (groupId: string, labelIncludes: string) => {
  const grp = AVDP_REPORT.progress.find((g) => g.id === groupId);
  return grp?.rows.find((r) => r.label.toLowerCase().includes(labelIncludes.toLowerCase()));
};

const pct = (achieved: number, target: number) =>
  target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;

export default function ValueChainPillars() {
  // Market access — private-sector linkages & trading platforms
  const partnerships = rowOf("markets", "Market Linkages");
  const platforms = rowOf("markets", "Commodity Platform");
  const b2b = rowOf("markets", "B2B");

  // Access to roads — feeder roads & farm tracks
  const feederRoads = rowOf("climateinfra", "Feeder Road");
  const farmTracks = rowOf("climateinfra", "Farm Tracks");

  // Business centres operating — ABC grain stores & oil-palm processing hubs
  const abcStores = rowOf("infra", "Grain Stores");
  const palmHubs = rowOf("treecrops", "Oil Palm ABC");

  const pillars = [
    {
      icon: Handshake,
      accent: "text-teal-400",
      ring: "border-teal-500/25 bg-teal-950/15",
      label: "Market Access",
      value: `${platforms?.achieved ?? 0} / ${platforms?.totalTarget ?? 0}`,
      unit: "commodity platforms (MSP)",
      sub: `${b2b?.achieved ?? 0} of ${b2b?.totalTarget ?? 0} provincial B2B events held`,
      bar: pct(platforms?.achieved ?? 0, platforms?.totalTarget ?? 1),
    },
    {
      icon: DollarSign,
      accent: "text-emerald-400",
      ring: "border-emerald-500/25 bg-emerald-950/15",
      label: "Access to Finance",
      value: `${partnerships?.achieved ?? 0} / ${partnerships?.totalTarget ?? 0}`,
      unit: "private-sector partnerships",
      sub: "Offtaker contracts & VSLA/cooperative pre-financing linkages",
      bar: pct(partnerships?.achieved ?? 0, partnerships?.totalTarget ?? 1),
    },
    {
      icon: Route,
      accent: "text-amber-400",
      ring: "border-amber-500/25 bg-amber-950/15",
      label: "Access to Roads",
      value: `${feederRoads?.achieved ?? 0} / ${feederRoads?.totalTarget ?? 0} km`,
      unit: "feeder roads rehabilitated",
      sub: `+ ${farmTracks?.achieved ?? 0} km farm tracks linking farms to markets`,
      bar: pct(feederRoads?.achieved ?? 0, feederRoads?.totalTarget ?? 1),
    },
    {
      icon: Building2,
      accent: "text-sky-400",
      ring: "border-sky-500/25 bg-sky-950/15",
      label: "Business Centres Operating",
      value: `${abcStores?.achieved ?? 0} / ${abcStores?.totalTarget ?? 0}`,
      unit: "ABC grain stores",
      sub: `+ ${palmHubs?.achieved ?? 0} oil-palm processing hubs aggregating output`,
      bar: pct(abcStores?.achieved ?? 0, abcStores?.totalTarget ?? 1),
    },
  ];

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-bold text-slate-100">Value Chain Enablers &amp; Success</h3>
        </div>
        <span className="text-[9px] bg-teal-950 border border-teal-500/25 text-teal-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
          Market Access · Finance · Roads · Business Centres
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {pillars.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.label} className={`border ${p.ring} rounded-xl p-4 flex flex-col`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${p.accent}`} />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  {p.label}
                </span>
              </div>
              <div className={`text-xl font-bold font-mono ${p.accent}`}>{p.value}</div>
              <div className="text-[11px] text-slate-300 font-semibold">{p.unit}</div>
              <div className="mt-2.5 w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${p.accent.replace("text-", "bg-")}`} style={{ width: `${p.bar}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-2 leading-tight">{p.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Value-chain success highlight strip (field outcome study results) */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { stat: "56%", text: "of FBOs reported increased production vs 2024" },
          { stat: "+47%", text: "higher rice yields on AVDP-supported vs non-supported farms (2025)" },
          { stat: "64.1%", text: "of households reported an increase in production" },
        ].map((s) => (
          <div key={s.text} className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-emerald-400 shrink-0">{s.stat}</span>
            <span className="text-[11px] text-slate-400 leading-tight">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
