import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import sleGeoRaw from "../data/sleDistricts.geo.json";
import { AVDP_SITES, AVDPSite, ValueChain } from "../data/avdpSites";
import { AVDP_PROJECT } from "../data/avdpProject";
import {
  Search, MapPin, X, Navigation, Locate, Calendar, Users, Layers,
  Sprout, Route, Building2, Coins, Wheat
} from "lucide-react";

interface Props {
  selectedDistrict: string | null;
  onSelectDistrict: (d: string | null) => void;
  isLowBandwidth: boolean;
}

type GeoFeature = { type: "Feature"; properties: { shapeName: string }; geometry: any };
const GEO = sleGeoRaw as { type: "FeatureCollection"; features: GeoFeature[] };
const MAP_W = 640;
const MAP_H = 540;
const projection = d3.geoIdentity().reflectY(true).fitExtent([[16, 16], [MAP_W - 16, MAP_H - 16]], GEO as any);
const geoPathGen = d3.geoPath(projection as any);

// Colour by AVDP value chain
const VC_HEX: Record<ValueChain, string> = {
  "Rice": "#38bdf8",
  "Oil Palm": "#eab308",
  "Cocoa": "#b45309",
  "Vegetables": "#22c55e",
  "General": "#94a3b8",
};
const VC_CHIP: Record<ValueChain, string> = {
  "Rice": "text-sky-400 border-sky-500/30 bg-sky-950/30",
  "Oil Palm": "text-yellow-400 border-yellow-500/30 bg-yellow-950/30",
  "Cocoa": "text-amber-500 border-amber-600/30 bg-amber-950/30",
  "Vegetables": "text-green-400 border-green-500/30 bg-green-950/30",
  "General": "text-slate-300 border-slate-600/40 bg-slate-900",
};
const VALUE_CHAINS: ValueChain[] = ["Rice", "Oil Palm", "Cocoa", "Vegetables", "General"];

const ACT_ICON = (act: string) => {
  if (act.includes("Road")) return Route;
  if (act.includes("Mill") || act.includes("Centre") || act.includes("Bulking")) return Building2;
  if (act.includes("Nursery") || act.includes("Plantation") || act.includes("Garden") || act.includes("Plot") || act.includes("Swamp")) return Sprout;
  if (act.includes("VSLA") || act.includes("FBO") || act.includes("Organisation")) return Coins;
  return Wheat;
};

export default function ValueChainMap({ selectedDistrict, onSelectDistrict, isLowBandwidth }: Props) {
  const [query, setQuery] = useState("");
  const [vcFilter, setVcFilter] = useState<string>("All");
  const [actFilter, setActFilter] = useState<string>("All");
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<AVDPSite | null>(null);

  const activityTypes = useMemo(
    () => Array.from(new Set(AVDP_SITES.map((s) => s.activityType))).sort(),
    []
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AVDP_SITES.filter((s) => {
      if (vcFilter !== "All" && s.valueChain !== vcFilter) return false;
      if (actFilter !== "All" && s.activityType !== actFilter) return false;
      if (selectedDistrict && s.district !== selectedDistrict) return false;
      if (q) {
        const hay = `${s.id} ${s.name} ${s.community} ${s.district} ${s.valueChain} ${s.activityType} ${s.fbo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, vcFilter, actFilter, selectedDistrict]);

  // Headline KPIs from the sample sites vs the real AVDP targets
  const kpis = useMemo(() => {
    const sum = (f: (s: AVDPSite) => boolean) =>
      AVDP_SITES.filter(f).reduce((a, s) => a + s.metricValue, 0);
    return {
      sites: AVDP_SITES.length,
      ivsHa: Math.round(sum((s) => s.activityType.includes("Inland Valley Swamp"))),
      roadsKm: Math.round(sum((s) => s.metric === "km")),
      cocoaHa: Math.round(sum((s) => s.valueChain === "Cocoa" && s.metric === "ha")),
      palmHa: Math.round(sum((s) => s.valueChain === "Oil Palm" && s.metric === "ha")),
      beneficiaries: AVDP_SITES.reduce((a, s) => a + s.beneficiaries, 0),
    };
  }, []);

  const T = AVDP_PROJECT.targets;
  const kpiCards = [
    { label: "Inland Valley Swamp", value: `${kpis.ivsHa} ha`, target: T.inlandValleySwampHa, cur: kpis.ivsHa, unit: "ha" },
    { label: "Feeder Roads", value: `${kpis.roadsKm} km`, target: T.feederRoadsKm, cur: kpis.roadsKm, unit: "km" },
    { label: "Cocoa Established", value: `${kpis.cocoaHa} ha`, target: T.cocoaHa, cur: kpis.cocoaHa, unit: "ha" },
    { label: "Oil Palm Established", value: `${kpis.palmHa} ha`, target: T.oilPalmHa, cur: kpis.palmHa, unit: "ha" },
  ];

  const project = (s: AVDPSite) => projection([s.lng, s.lat]) as [number, number] | null;
  const statusBadge = (s: string) =>
    s === "Completed" ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/30"
    : s === "Active" ? "text-sky-400 border-sky-500/30 bg-sky-950/30"
    : "text-slate-400 border-slate-600/40 bg-slate-900";

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Locate className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100 tracking-tight">AVDP Activity Sites — Value Chain Locator</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
            {AVDP_SITES.length} sites
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Rice, Oil Palm, Cocoa &amp; Vegetable activities across Sierra Leone — IVS schemes, plantations &amp; nurseries,
          feeder roads, agri-business centres, processing, FBOs &amp; VSLAs.
        </p>
      </div>

      {/* KPI strip (sample vs AVDP targets) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {kpiCards.map((k) => {
          const pct = Math.min(100, Math.round((k.cur / k.target) * 100));
          return (
            <div key={k.label} className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
              <div className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">{k.label}</div>
              <div className="text-base font-bold font-mono text-slate-100 mt-0.5">{k.value}</div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[8px] font-mono text-slate-500 mt-1">{pct}% of {k.target.toLocaleString()} {k.unit} target</div>
            </div>
          );
        })}
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3">
          <div className="text-[9px] font-mono uppercase text-emerald-400 tracking-wider">Beneficiaries (sample)</div>
          <div className="text-base font-bold font-mono text-emerald-300 mt-0.5">{kpis.beneficiaries.toLocaleString()}</div>
          <div className="text-[8px] font-mono text-slate-500 mt-1.5">of {T.people.toLocaleString()} people target</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search community, value chain, activity, FBO…"
          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 font-mono"
        />
        {query && <button onClick={() => setQuery("")} className="absolute right-3 top-3 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>}
      </div>

      {/* Value-chain chips + activity filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => setVcFilter("All")} className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border cursor-pointer ${vcFilter === "All" ? "bg-slate-800 border-slate-600 text-slate-100 font-bold" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"}`}>All chains</button>
        {VALUE_CHAINS.map((vc) => (
          <button key={vc} onClick={() => setVcFilter(vcFilter === vc ? "All" : vc)} className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border cursor-pointer flex items-center gap-1.5 ${vcFilter === vc ? VC_CHIP[vc] + " font-bold" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: VC_HEX[vc] }} />{vc}
          </button>
        ))}
        <select value={actFilter} onChange={(e) => setActFilter(e.target.value)} className="text-[11px] font-mono bg-slate-950/60 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 ml-1">
          <option value="All">All activities</option>
          {activityTypes.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between mb-4 text-xs font-mono">
        <span className="text-slate-400"><strong className="text-emerald-400">{matches.length}</strong> sites{selectedDistrict && <span className="text-slate-500"> · {selectedDistrict}</span>}</span>
        {selectedDistrict && <button onClick={() => { onSelectDistrict(null); setSelected(null); }} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"><X className="w-3 h-3" /> Clear district</button>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: detail + results */}
        <div className="xl:col-span-5 order-2 xl:order-1 space-y-3">
          {selected && (
            <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: VC_HEX[selected.valueChain] + "22", border: `1px solid ${VC_HEX[selected.valueChain]}55` }}>
                    {React.createElement(ACT_ICON(selected.activityType), { className: "w-3.5 h-3.5", style: { color: VC_HEX[selected.valueChain] } })}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-100 leading-tight">{selected.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.community}, {selected.district} · {selected.region}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center">
                {[
                  { l: selected.metric, v: `${selected.metricValue.toLocaleString()}` },
                  { l: "Beneficiaries", v: selected.beneficiaries.toLocaleString() },
                  { l: "Female", v: `${selected.femaleShare}%` },
                  { l: "Youth", v: `${selected.youthShare}%` },
                ].map((k) => (
                  <div key={k.l} className="bg-slate-900/60 border border-slate-900 rounded-lg p-2">
                    <div className="text-[8px] font-mono uppercase text-slate-500 truncate">{k.l}</div>
                    <div className="text-sm font-bold font-mono text-slate-100">{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[10px] font-mono text-slate-400">
                <span className={`px-1.5 py-0.5 rounded border font-bold uppercase ${statusBadge(selected.status)}`}>{selected.status}</span>
                <span className={`px-1.5 py-0.5 rounded border ${VC_CHIP[selected.valueChain]}`}>{selected.valueChain}</span>
                <span>Comp. {selected.component}: {selected.componentLabel}</span>
                <span>· {selected.financier}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {selected.lastVisited}</span>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {matches.length === 0 && <div className="text-center py-12 bg-slate-950/30 border border-slate-900 rounded-xl text-slate-500 text-xs font-mono">No sites matched. Widen the filters.</div>}
            {matches.map((s) => {
              const Icon = ACT_ICON(s.activityType); const active = selected?.id === s.id;
              return (
                <button key={s.id} onClick={() => { setSelected(s); onSelectDistrict(s.district); }} className={`w-full text-left rounded-xl p-3 border cursor-pointer transition-all group ${active ? "bg-emerald-950/20 border-emerald-500/30" : "bg-slate-950/40 hover:bg-slate-900/60 border-slate-900 hover:border-slate-700"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: VC_HEX[s.valueChain] + "22", border: `1px solid ${VC_HEX[s.valueChain]}55` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: VC_HEX[s.valueChain] }} />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-300">{s.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{s.district}<span className="text-slate-600">·</span>{s.metricValue.toLocaleString()} {s.metric}</div>
                      </div>
                    </div>
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${statusBadge(s.status)}`}>{s.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: map */}
        <div className="xl:col-span-7 order-1 xl:order-2">
          <div className="bg-[#020617] rounded-2xl border border-slate-900 p-3 relative">
            <div className="absolute top-3 left-3 z-10 pointer-events-none font-mono text-[9px] text-slate-400 bg-slate-950/80 border border-slate-800 p-2 rounded-lg flex items-center gap-1">
              <Navigation className="w-3 h-3 text-emerald-400" /> Tap a pin for details · a district to filter
            </div>
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full max-w-[860px] mx-auto h-auto">
              {GEO.features.map((f) => {
                const name = f.properties.shapeName;
                const d = geoPathGen(f as any) || "";
                const isSel = selectedDistrict === name;
                const isHover = hovered === name;
                return (
                  <path key={name} d={d} fill={isSel ? "#0c2a22" : "#0c1424"} stroke={isSel ? "#5eead4" : isHover ? "#34d399" : "#1e293b"} strokeWidth={isSel ? 1.6 : 0.7}
                    className="cursor-pointer transition-colors"
                    onClick={() => { onSelectDistrict(isSel ? null : name); setSelected(null); }}
                    onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)} />
                );
              })}
              {/* District name labels at polygon centroids */}
              {GEO.features.map((f) => {
                const name = f.properties.shapeName;
                const [cxL, cyL] = geoPathGen.centroid(f as any);
                if (!Number.isFinite(cxL) || !Number.isFinite(cyL)) return null;
                const isSel = selectedDistrict === name;
                const isHover = hovered === name;
                return (
                  <text key={`lbl-${name}`} x={cxL} y={cyL}
                    textAnchor="middle" dominantBaseline="middle"
                    className="pointer-events-none font-mono font-semibold select-none"
                    style={{ fontSize: 8.5, paintOrder: "stroke", stroke: "#020617", strokeWidth: 2.4, strokeLinejoin: "round" }}
                    fill={isSel ? "#5eead4" : isHover ? "#a7f3d0" : "#cbd5e1"}>
                    {name}
                  </text>
                );
              })}
              {matches.map((s) => {
                const p = project(s); if (!p) return null;
                const active = selected?.id === s.id;
                const r = active ? 6 : isLowBandwidth ? 3 : 4;
                return (
                  <g key={s.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelected(s); onSelectDistrict(s.district); }}>
                    {active && <circle cx={p[0]} cy={p[1]} r={11} fill={VC_HEX[s.valueChain]} opacity={0.25} />}
                    <circle cx={p[0]} cy={p[1]} r={r} fill={VC_HEX[s.valueChain]} stroke="#020617" strokeWidth="1">
                      <title>{`${s.name} — ${s.district} (${s.metricValue} ${s.metric})`}</title>
                    </circle>
                  </g>
                );
              })}
              <text x={MAP_W * 0.08} y={MAP_H * 0.84} className="fill-slate-500/60 font-mono text-[8px] italic pointer-events-none">ATLANTIC OCEAN</text>
              <text x={MAP_W * 0.68} y={MAP_H * 0.1} className="fill-slate-500/50 font-mono text-[8px] pointer-events-none">GUINEA</text>
            </svg>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t border-slate-900 pt-2.5 mt-1 text-[9px] font-mono text-slate-400">
              {VALUE_CHAINS.map((vc) => (
                <span key={vc} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: VC_HEX[vc] }} /> {vc}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
