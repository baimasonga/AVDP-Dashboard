import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import { Indicator } from "../types";
import sleGeoRaw from "../sleDistricts.geo.json";
import {
  Search, MapPin, X, TrendingUp, Sprout, Building2, Route,
  ShoppingCart, Coins, Users, Navigation, Layers, Locate
} from "lucide-react";

interface Props {
  indicators: Indicator[];
  selectedDistrict: string | null;
  onSelectDistrict: (d: string | null) => void;
  isLowBandwidth: boolean;
}

type GeoFeature = { type: "Feature"; properties: { shapeName: string }; geometry: any };
const GEO = sleGeoRaw as { type: "FeatureCollection"; features: GeoFeature[] };
const MAP_W = 600;
const MAP_H = 470;
const projection = d3.geoIdentity().reflectY(true).fitExtent([[14, 14], [MAP_W - 14, MAP_H - 14]], GEO as any);
const geoPathGen = d3.geoPath(projection as any);
const POLY_MEMBERS: Record<string, string[]> = {
  Koinadugu: ["Koinadugu", "Falaba"],
  Bombali: ["Bombali", "Karene"],
};
const membersFor = (name: string): string[] => POLY_MEMBERS[name] || [name];

// AVDP activity taxonomy (indicator category -> locator metadata)
const ACTIVITY_TYPES: Record<string, { label: string; icon: any; group: string; dot: string; chip: string }> = {
  "Yield Increase": { label: "Crop Yield", icon: TrendingUp, group: "Value Chain", dot: "bg-emerald-400", chip: "text-emerald-400 border-emerald-500/30 bg-emerald-950/30" },
  "Seedling Survival Rate": { label: "Seedlings & Nurseries", icon: Sprout, group: "Value Chain", dot: "bg-green-400", chip: "text-green-400 border-green-500/30 bg-green-950/30" },
  "Market Access Improvement": { label: "Market Access", icon: ShoppingCart, group: "Value Chain", dot: "bg-sky-400", chip: "text-sky-400 border-sky-500/30 bg-sky-950/30" },
  "Farmer Income": { label: "Farmer Income", icon: Coins, group: "Livelihoods", dot: "bg-amber-400", chip: "text-amber-400 border-amber-500/30 bg-amber-950/30" },
  "Processing Facilities Built": { label: "Processing Facilities", icon: Building2, group: "Infrastructure", dot: "bg-teal-400", chip: "text-teal-400 border-teal-500/30 bg-teal-950/30" },
  "Road Rehab": { label: "Feeder Roads", icon: Route, group: "Infrastructure", dot: "bg-cyan-400", chip: "text-cyan-400 border-cyan-500/30 bg-cyan-950/30" },
  "Gender Inclusion": { label: "Gender & Youth", icon: Users, group: "Inclusion", dot: "bg-fuchsia-400", chip: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-950/30" },
};
const metaFor = (cat: string) => ACTIVITY_TYPES[cat] || { label: cat, icon: Layers, group: "Other", dot: "bg-slate-400", chip: "text-slate-400 border-slate-700 bg-slate-900" };

const COMMODITIES = ["Rice", "Cocoa", "Coffee", "Oil Palm", "General"];

export default function ValueChainLocator({ indicators, selectedDistrict, onSelectDistrict, isLowBandwidth }: Props) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [commodityFilter, setCommodityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [hovered, setHovered] = useState<string | null>(null);

  // Activities matching every filter except the selected-district narrowing.
  const baseMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return indicators.filter((i) => {
      if (typeFilter !== "All" && i.IndicatorName !== typeFilter) return false;
      if (commodityFilter !== "All" && i.Commodity !== commodityFilter) return false;
      if (statusFilter !== "All" && i.Status !== statusFilter) return false;
      if (q) {
        const hay = `${i.IndicatorID} ${i.District} ${i.Commodity} ${i.IndicatorName} ${metaFor(i.IndicatorName).label} ${metaFor(i.IndicatorName).group}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [indicators, query, typeFilter, commodityFilter, statusFilter]);

  // Per-polygon match counts (fold the post-2017 districts into their parent).
  const districtCounts = useMemo(() => {
    const counts = new Map<string, number>();
    GEO.features.forEach((f) => {
      const members = membersFor(f.properties.shapeName);
      counts.set(f.properties.shapeName, baseMatches.filter((i) => members.includes(i.District)).length);
    });
    return counts;
  }, [baseMatches]);
  const maxCount = Math.max(1, ...Array.from(districtCounts.values()));

  // The result list narrows further to the selected district.
  const results = useMemo(() => {
    let r = baseMatches;
    if (selectedDistrict) {
      const members = membersFor(selectedDistrict);
      r = r.filter((i) => members.includes(i.District));
    }
    const rank = (i: Indicator) => (i.Status === "Critical" ? 0 : i.Status === "Need Attention" ? 1 : 2);
    return [...r].sort((a, b) => rank(a) - rank(b) || a.Progress - b.Progress);
  }, [baseMatches, selectedDistrict]);

  const matchedDistricts = useMemo(
    () => Array.from(districtCounts.values()).filter((c) => c > 0).length,
    [districtCounts]
  );

  const fillFor = (name: string) => {
    const count = districtCounts.get(name) || 0;
    const isSel = membersFor(name).includes(selectedDistrict || "");
    const isHover = hovered === name;
    if (count === 0) {
      return { fill: "#0b1220", stroke: isHover ? "#475569" : "#1e293b" };
    }
    const t = count / maxCount; // 0..1
    const fill = d3.interpolate("#064e3b", "#10b981")(0.35 + t * 0.65);
    return { fill, stroke: isSel ? "#5eead4" : isHover ? "#34d399" : "#0f766e" };
  };

  const statusBadge = (s: string) =>
    s === "Critical"
      ? "text-red-400 border-red-500/30 bg-red-950/30"
      : s === "Need Attention"
      ? "text-amber-400 border-amber-500/30 bg-amber-950/30"
      : "text-emerald-400 border-emerald-500/30 bg-emerald-950/30";

  const activityTypeList = Object.keys(ACTIVITY_TYPES);

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <Locate className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100 tracking-tight">AVDP Value Chain & Activity Locator</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
            Find activities
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Search and locate AVDP activities across Sierra Leone — value chains, processing facilities, feeder roads,
          gender &amp; youth inclusion and farmer livelihoods — by community, district or commodity.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by district, value chain, infrastructure, gender activity…"
          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 font-mono"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-3 text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Activity-type chips */}
      <div className="flex flex-wrap gap-2 mb-2.5">
        <button
          onClick={() => setTypeFilter("All")}
          className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
            typeFilter === "All" ? "bg-slate-800 border-slate-600 text-slate-100 font-bold" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          All activities
        </button>
        {activityTypeList.map((cat) => {
          const m = metaFor(cat);
          const Icon = m.icon;
          const active = typeFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setTypeFilter(active ? "All" : cat)}
              className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                active ? m.chip + " font-bold" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Commodity + status filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Commodity:</span>
        <button
          onClick={() => setCommodityFilter("All")}
          className={`text-[10px] font-mono px-2.5 py-1 rounded-md border cursor-pointer ${commodityFilter === "All" ? "bg-slate-800 border-slate-600 text-slate-100" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"}`}
        >
          All
        </button>
        {COMMODITIES.map((c) => (
          <button
            key={c}
            onClick={() => setCommodityFilter(commodityFilter === c ? "All" : c)}
            className={`text-[10px] font-mono px-2.5 py-1 rounded-md border cursor-pointer ${commodityFilter === c ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"}`}
          >
            {c}
          </button>
        ))}
        <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider ml-2">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[10px] font-mono bg-slate-950/60 border border-slate-800 text-slate-300 rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500"
        >
          <option value="All">All</option>
          <option value="On Track">On Track</option>
          <option value="Need Attention">Need Attention</option>
          <option value="Critical">Critical</option>
        </select>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between mb-4 text-xs font-mono">
        <span className="text-slate-400">
          <strong className="text-emerald-400">{baseMatches.length}</strong> activities across{" "}
          <strong className="text-emerald-400">{matchedDistricts}</strong> districts
          {selectedDistrict && <span className="text-slate-500"> · showing {selectedDistrict}</span>}
        </span>
        {selectedDistrict && (
          <button
            onClick={() => onSelectDistrict(null)}
            className="text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear district
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Results list */}
        <div className="xl:col-span-5 order-2 xl:order-1">
          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {results.length === 0 && (
              <div className="text-center py-14 bg-slate-950/30 border border-slate-900 rounded-xl text-slate-500 text-xs font-mono">
                No activities matched your search. Try widening the filters.
              </div>
            )}
            {results.map((i) => {
              const m = metaFor(i.IndicatorName);
              const Icon = m.icon;
              return (
                <button
                  key={i.IndicatorID}
                  onClick={() => onSelectDistrict(i.District)}
                  className="w-full text-left bg-slate-950/40 hover:bg-slate-900/60 border border-slate-900 hover:border-slate-700 rounded-xl p-3.5 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center border ${m.chip}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">{m.label}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {i.District}
                          <span className="text-slate-600">·</span>
                          {i.Commodity}
                          <span className="text-slate-600">·</span>
                          {i.IndicatorID}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono text-slate-100">{i.Progress}%</div>
                      <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${statusBadge(i.Status)}`}>
                        {i.Status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map */}
        <div className="xl:col-span-7 order-1 xl:order-2">
          <div className="bg-[#020617] rounded-2xl border border-slate-900 p-3 relative">
            <div className="absolute top-3 left-3 z-10 pointer-events-none font-mono text-[9px] text-slate-400 bg-slate-950/80 border border-slate-800 p-2 rounded-lg flex items-center gap-1">
              <Navigation className="w-3 h-3 text-emerald-400" /> Tap a district to filter activities
            </div>
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full max-w-[760px] mx-auto h-auto">
              {GEO.features.map((f) => {
                const name = f.properties.shapeName;
                const d = geoPathGen(f as any) || "";
                const [cx, cy] = geoPathGen.centroid(f as any);
                const count = districtCounts.get(name) || 0;
                const { fill, stroke } = fillFor(name);
                const isSel = membersFor(name).includes(selectedDistrict || "");
                return (
                  <g
                    key={name}
                    className="cursor-pointer"
                    onClick={() => onSelectDistrict(isSel ? null : name)}
                    onMouseEnter={() => setHovered(name)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <path d={d} fill={fill} stroke={stroke} strokeWidth={isSel ? 2 : 0.7} />
                    {count > 0 && (
                      <>
                        <circle cx={cx} cy={cy} r={isLowBandwidth ? 8 : 9} fill="#020617" stroke="#34d399" strokeWidth="1.3" opacity={0.92} />
                        <text x={cx} y={cy + 3} textAnchor="middle" className="fill-emerald-300 font-mono font-bold text-[9px] pointer-events-none">
                          {count}
                        </text>
                      </>
                    )}
                    <text x={cx} y={cy + (count > 0 ? 18 : 2)} textAnchor="middle" className="fill-slate-300 font-mono font-bold text-[7px] pointer-events-none select-none">
                      {name.length > 12 ? name.slice(0, 3).toUpperCase() : name}
                    </text>
                  </g>
                );
              })}
              <text x={MAP_W * 0.1} y={MAP_H * 0.82} className="fill-slate-500/60 font-mono text-[8px] italic pointer-events-none">ATLANTIC OCEAN</text>
              <text x={MAP_W * 0.66} y={MAP_H * 0.1} className="fill-slate-500/50 font-mono text-[8px] pointer-events-none">GUINEA</text>
            </svg>

            <div className="flex items-center justify-center gap-4 border-t border-slate-900 pt-2.5 mt-1 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> activities present</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#0b1220", border: "1px solid #1e293b" }} /> none matching</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border border-emerald-400 flex items-center justify-center text-[7px] text-emerald-300">n</span> count</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
