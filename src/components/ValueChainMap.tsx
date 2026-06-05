import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import sleGeoRaw from "../data/sleDistricts.geo.json";
import { AVDP_SITES, AVDPSite, ValueChain } from "../data/avdpSites";
import { AVDP_REPORT } from "../data/avdpReport";
import {
  Search, MapPin, X, Navigation, Locate, Calendar, Users, Banknote,
  Sprout, Route, Building2, Coins, Wheat, Layers, TrendingUp
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

const VC_HEX: Record<ValueChain, string> = {
  "Rice": "#38bdf8", "Oil Palm": "#eab308", "Cocoa": "#b45309", "Vegetables": "#22c55e", "General": "#94a3b8",
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
  const [hoveredSite, setHoveredSite] = useState<AVDPSite | null>(null);
  const [selected, setSelected] = useState<AVDPSite | null>(null);

  const activityTypes = useMemo(() => Array.from(new Set(AVDP_SITES.map((s) => s.activityType))).sort(), []);

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

  // Real AVDP programme figures (IFAD Supervision Mission, Jun 2026) — so the
  // map KPIs match the Implementation tab exactly.
  const findRow = (gid: string, sub: string) => {
    const g = AVDP_REPORT.progress.find((x) => x.id === gid);
    return g?.rows.find((r) => r.label.includes(sub));
  };
  const ivs = findRow("infra", "IVS");
  const roads = findRow("climateinfra", "Feeder Road");
  const cocoa = findRow("treecrops", "New Cocoa");
  const palm = findRow("treecrops", "New Oil Palm");
  const genderReached = (AVDP_REPORT.progress.find((g) => g.id === "gender")?.rows || []).reduce((a, r) => a + r.achieved, 0);
  const kpiCards = [
    { label: "Inland Valley Swamp", cur: ivs?.achieved || 0, target: ivs?.totalTarget || 1, unit: "ha" },
    { label: "Feeder Roads", cur: roads?.achieved || 0, target: roads?.totalTarget || 1, unit: "km" },
    { label: "Cocoa Farms", cur: cocoa?.achieved || 0, target: cocoa?.totalTarget || 1, unit: "ha" },
    { label: "Oil Palm Farms", cur: palm?.achieved || 0, target: palm?.totalTarget || 1, unit: "ha" },
  ];

  // Breakdown of the current selection (for the default summary panel)
  const breakdown = useMemo(() => {
    const rows = VALUE_CHAINS.map((vc) => {
      const list = matches.filter((s) => s.valueChain === vc);
      const ha = Math.round(list.filter((s) => s.metric === "ha").reduce((a, s) => a + s.metricValue, 0));
      return { vc, count: list.length, ha };
    }).filter((r) => r.count > 0);
    const ben = matches.reduce((a, s) => a + s.beneficiaries, 0);
    const fAvg = matches.length ? Math.round(matches.reduce((a, s) => a + s.femaleShare, 0) / matches.length) : 0;
    const yAvg = matches.length ? Math.round(matches.reduce((a, s) => a + s.youthShare, 0) / matches.length) : 0;
    return { rows, ben, fAvg, yAvg };
  }, [matches]);

  const project = (s: AVDPSite) => projection([s.lng, s.lat]) as [number, number] | null;
  const statusBadge = (s: string) =>
    s === "Completed" ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/30"
    : s === "Active" ? "text-sky-400 border-sky-500/30 bg-sky-950/30"
    : "text-slate-400 border-slate-600/40 bg-slate-900";
  const InclusionBar = ({ label, pct, color }: { label: string; pct: number; color: string }) => (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-slate-400"><span>{label}</span><span>{pct}%</span></div>
      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-0.5"><div className="h-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );

  const select = (s: AVDPSite) => { setSelected(s); onSelectDistrict(s.district); };

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Locate className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100 tracking-tight">AVDP Activity Sites — Value Chain Locator</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">{AVDP_SITES.length} sites</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Rice, Oil Palm, Cocoa &amp; Vegetable activities across Sierra Leone — IVS schemes, plantations &amp; nurseries, feeder roads, agri-business centres, processing, FBOs &amp; VSLAs.</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {kpiCards.map((k) => {
          const pct = Math.min(100, Math.round((k.cur / k.target) * 100));
          return (
            <div key={k.label} className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
              <div className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">{k.label}</div>
              <div className="text-base font-bold font-mono text-slate-100 mt-0.5">{k.cur.toLocaleString()} {k.unit}</div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
              <div className="text-[8px] font-mono text-slate-500 mt-1">{pct}% of {k.target.toLocaleString()} {k.unit} target</div>
            </div>
          );
        })}
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3">
          <div className="text-[9px] font-mono uppercase text-emerald-400 tracking-wider">Households reached (GALS)</div>
          <div className="text-base font-bold font-mono text-emerald-300 mt-0.5">{genderReached.toLocaleString()}</div>
          <div className="text-[8px] font-mono text-slate-500 mt-1.5">of {AVDP_REPORT.summary.households.toLocaleString()} HH target</div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search community, value chain, activity, FBO…" className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 font-mono" />
        {query && <button onClick={() => setQuery("")} className="absolute right-3 top-3 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>}
      </div>
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

      <div className="flex items-center justify-between mb-4 text-xs font-mono">
        <span className="text-slate-400"><strong className="text-emerald-400">{matches.length}</strong> sites{selectedDistrict && <span className="text-slate-500"> · {selectedDistrict}</span>}</span>
        {selectedDistrict && <button onClick={() => { onSelectDistrict(null); setSelected(null); }} className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"><X className="w-3 h-3" /> Clear district</button>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: detail / summary + results */}
        <div className="xl:col-span-5 order-2 xl:order-1 space-y-3">
          {selected ? (
            /* ---- refined site detail card ---- */
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
              <div className="h-1" style={{ background: VC_HEX[selected.valueChain] }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: VC_HEX[selected.valueChain] + "22", border: `1px solid ${VC_HEX[selected.valueChain]}55` }}>
                      {React.createElement(ACT_ICON(selected.activityType), { className: "w-4 h-4", style: { color: VC_HEX[selected.valueChain] } })}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-slate-100 leading-tight">{selected.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {selected.community}, {selected.district} · {selected.region}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                {/* chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${VC_CHIP[selected.valueChain]}`}>{selected.valueChain}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300">{selected.activityType}</span>
                  <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${statusBadge(selected.status)}`}>{selected.status}</span>
                </div>

                {/* headline metric + beneficiaries */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-slate-900/60 border border-slate-900 rounded-lg p-2.5">
                    <div className="text-[8px] font-mono uppercase text-slate-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Output ({selected.metric})</div>
                    <div className="text-lg font-bold font-mono text-slate-100">{selected.metricValue.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-900 rounded-lg p-2.5">
                    <div className="text-[8px] font-mono uppercase text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> Beneficiaries</div>
                    <div className="text-lg font-bold font-mono text-slate-100">{selected.beneficiaries.toLocaleString()}</div>
                  </div>
                </div>

                {/* progress */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400"><span>Implementation progress</span><span>{selected.progress}%</span></div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-1"><div className="h-full" style={{ width: `${Math.min(100, selected.progress)}%`, background: VC_HEX[selected.valueChain] }} /></div>
                </div>

                {/* inclusion */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <InclusionBar label="Female" pct={selected.femaleShare} color="#e879f9" />
                  <InclusionBar label="Youth" pct={selected.youthShare} color="#34d399" />
                </div>

                {/* meta rows */}
                <div className="mt-3 pt-3 border-t border-slate-900 space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between"><span className="text-slate-500">Component</span><span className="text-slate-300">{selected.component} · {selected.componentLabel}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1"><Banknote className="w-3 h-3" /> Financier</span><span className="text-slate-300">{selected.financier}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">FBO / Group</span><span className="text-slate-300 truncate max-w-[180px]">{selected.fbo}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Last visited</span><span className="text-slate-300">{selected.lastVisited}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Coordinates</span><span className="text-slate-400">{selected.lat.toFixed(3)}, {selected.lng.toFixed(3)}</span></div>
                </div>
              </div>
            </div>
          ) : (
            /* ---- default summary panel ---- */
            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5 mb-3"><Layers className="w-3.5 h-3.5" /> Selection summary</div>
              <div className="space-y-2">
                {breakdown.rows.map((r) => (
                  <button key={r.vc} onClick={() => setVcFilter(vcFilter === r.vc ? "All" : r.vc)} className="w-full flex items-center justify-between text-[11px] font-mono cursor-pointer group">
                    <span className="flex items-center gap-1.5 text-slate-300 group-hover:text-white"><span className="w-2.5 h-2.5 rounded-full" style={{ background: VC_HEX[r.vc] }} />{r.vc}</span>
                    <span className="text-slate-400">{r.count} sites{r.ha > 0 ? ` · ${r.ha.toLocaleString()} ha` : ""}</span>
                  </button>
                ))}
                {breakdown.rows.length === 0 && <div className="text-slate-500 text-xs">No sites match the current filters.</div>}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-900 text-center">
                <div><div className="text-[8px] font-mono uppercase text-slate-500">Beneficiaries</div><div className="text-sm font-bold font-mono text-slate-100">{breakdown.ben.toLocaleString()}</div></div>
                <div><div className="text-[8px] font-mono uppercase text-fuchsia-400">Female avg</div><div className="text-sm font-bold font-mono text-fuchsia-300">{breakdown.fAvg}%</div></div>
                <div><div className="text-[8px] font-mono uppercase text-emerald-400">Youth avg</div><div className="text-sm font-bold font-mono text-emerald-300">{breakdown.yAvg}%</div></div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3">Tap a pin or a result below for full site details.</p>
            </div>
          )}

          {/* results list */}
          <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
            {matches.map((s) => {
              const Icon = ACT_ICON(s.activityType); const active = selected?.id === s.id;
              return (
                <button key={s.id} onClick={() => select(s)} onMouseEnter={() => setHoveredSite(s)} onMouseLeave={() => setHoveredSite(null)} className={`w-full text-left rounded-xl p-3 border cursor-pointer transition-all group ${active ? "bg-emerald-950/20 border-emerald-500/30" : "bg-slate-950/40 hover:bg-slate-900/60 border-slate-900 hover:border-slate-700"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: VC_HEX[s.valueChain] + "22", border: `1px solid ${VC_HEX[s.valueChain]}55` }}><Icon className="w-3.5 h-3.5" style={{ color: VC_HEX[s.valueChain] }} /></span>
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
            <div className="absolute top-3 left-3 z-10 pointer-events-none font-mono text-[9px] bg-slate-950/80 border border-slate-800 p-2 rounded-lg">
              <div className="text-slate-400 flex items-center gap-1"><Navigation className="w-3 h-3 text-emerald-400" /> Tap a pin for details · a district to filter</div>
              {hoveredSite && <div className="text-emerald-300 mt-1 truncate max-w-[220px]">{hoveredSite.name} — {hoveredSite.metricValue} {hoveredSite.metric}</div>}
            </div>
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full max-w-[860px] mx-auto h-auto">
              {GEO.features.map((f) => {
                const name = f.properties.shapeName;
                const isSel = selectedDistrict === name;
                const isHover = hovered === name;
                return (
                  <path key={name} d={geoPathGen(f as any) || ""} fill={isSel ? "#0c2a22" : "#0c1424"} stroke={isSel ? "#5eead4" : isHover ? "#34d399" : "#1e293b"} strokeWidth={isSel ? 1.6 : 0.7}
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
                const hov = hoveredSite?.id === s.id;
                const r = active ? 6.5 : hov ? 5.5 : isLowBandwidth ? 3 : 4;
                return (
                  <g key={s.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); select(s); }} onMouseEnter={() => setHoveredSite(s)} onMouseLeave={() => setHoveredSite(null)}>
                    {(active || hov) && <circle cx={p[0]} cy={p[1]} r={12} fill={VC_HEX[s.valueChain]} opacity={0.22} />}
                    <circle cx={p[0]} cy={p[1]} r={r} fill={VC_HEX[s.valueChain]} stroke={active || hov ? "#e2e8f0" : "#020617"} strokeWidth={active || hov ? 1.4 : 1}>
                      <title>{`${s.name} — ${s.district} (${s.metricValue} ${s.metric})`}</title>
                    </circle>
                  </g>
                );
              })}
              <text x={MAP_W * 0.08} y={MAP_H * 0.84} className="fill-slate-500/60 font-mono text-[8px] italic pointer-events-none">ATLANTIC OCEAN</text>
              <text x={MAP_W * 0.68} y={MAP_H * 0.1} className="fill-slate-500/50 font-mono text-[8px] pointer-events-none">GUINEA</text>
            </svg>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-t border-slate-900 pt-2.5 mt-1 text-[9px] font-mono text-slate-400">
              {VALUE_CHAINS.map((vc) => <span key={vc} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: VC_HEX[vc] }} /> {vc}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
