import React, { useState, useMemo } from "react";
import { SIERRA_LEONE_DISTRICTS, getDistrictSummaries } from "../data";
import { Indicator, DistrictMetricSummary } from "../types";
import {
  MapPin, TrendingUp, Layers, RefreshCw,
  Navigation, Route, AlertTriangle,
  Activity, GitCompare, Search, Server,
  LocateFixed, X, ChevronRight, ChevronLeft
} from "lucide-react";
import sleGeoJson from "../data/sleDistricts.geo.json";

interface MapSectionProps {
  indicators: Indicator[];
  selectedDistrict: string | null;
  onSelectDistrict: (district: string | null) => void;
  isLowBandwidth: boolean;
}

const MAP_W = 760;
const MAP_H = 620;

type DistrictMapShape = {
  name: string;
  points: string;
  label: { x: number; y: number; size?: number; lines?: string[] };
};

// ── GeoJSON → SVG projection ──────────────────────────────────────────────────
const GEO_LON_MIN = -13.389, GEO_LON_MAX = -10.191;
const GEO_LAT_MIN =  6.843,  GEO_LAT_MAX = 10.079;
const MERC_MAX = Math.log(Math.tan(Math.PI / 4 + (GEO_LAT_MAX * Math.PI) / 360));
const MERC_MIN = Math.log(Math.tan(Math.PI / 4 + (GEO_LAT_MIN * Math.PI) / 360));

function geoToSvg(lon: number, lat: number): [number, number] {
  const x = Math.round(((lon - GEO_LON_MIN) / (GEO_LON_MAX - GEO_LON_MIN)) * MAP_W);
  const mercY = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const y = Math.round(((MERC_MAX - mercY) / (MERC_MAX - MERC_MIN)) * MAP_H);
  return [x, y];
}

function ringToPoints(ring: number[][]): string {
  return ring.slice(0, -1).map(([lon, lat]) => geoToSvg(lon, lat).join(",")).join(" ");
}

function getLargestRing(geometry: { type: string; coordinates: number[][][][] | number[][][] }): number[][] {
  if (geometry.type === "Polygon") {
    return (geometry as { type: string; coordinates: number[][][] }).coordinates[0];
  }
  const mp = (geometry as { type: string; coordinates: number[][][][] }).coordinates;
  return mp.reduce((best: number[][], poly: number[][][]) =>
    poly[0].length > best.length ? poly[0] : best, [] as number[][]);
}

function svgCentroid(ring: number[][]): [number, number] {
  const pts = ring.slice(0, -1).map(([lon, lat]) => geoToSvg(lon, lat));
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    const sx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const sy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return [sx, sy];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

const LABEL_OVERRIDES: Record<string, { x: number; y: number; lines?: string[] }> = {
  "Western Area Urban": { x: 67, y: 390, lines: ["W.Urban"] },
  "Western Area Rural": { x: 67, y: 430, lines: ["W.Rural"] },
};

const DISTRICT_MAP_SHAPES: DistrictMapShape[] = (() => {
  const features = (sleGeoJson as { features: Array<{ properties: { shapeName: string }; geometry: { type: string; coordinates: number[][][][] | number[][][] } }> }).features;
  return features.map(f => {
    const name = f.properties.shapeName;
    const ring = getLargestRing(f.geometry);
    const [cx, cy] = svgCentroid(ring);
    const override = LABEL_OVERRIDES[name];
    return {
      name,
      points: ringToPoints(ring),
      label: override
        ? { x: override.x, y: override.y, size: name.startsWith("Western") ? 11 : 20, lines: override.lines }
        : { x: Math.round(cx), y: Math.round(cy), size: 20 },
    };
  });
})();

type GISLayer = "yield" | "infra" | "climate";

// Value-chain to commodity mapping for search
const VALUE_CHAIN_KEYWORDS: Record<string, string> = {
  "rice": "Rice", "cocoa": "Cocoa", "coffee": "Coffee",
  "oil palm": "Oil Palm", "palm": "Oil Palm", "palm oil": "Oil Palm",
  "oilpalm": "Oil Palm", "general": "General"
};

// District → commodities map
const DISTRICT_COMMODITIES: Record<string, string[]> = {
  "Kailahun": ["Cocoa","Coffee","Oil Palm","Rice"],
  "Kenema": ["Cocoa","Coffee","Oil Palm","Rice"],
  "Kono": ["Cocoa","Coffee","Oil Palm","Rice"],
  "Bombali": ["Rice","Oil Palm"],
  "Falaba": ["Rice","Oil Palm"],
  "Koinadugu": ["Rice","Oil Palm"],
  "Tonkolili": ["Rice","Oil Palm"],
  "Karene": ["Rice","Oil Palm"],
  "Bo": ["Oil Palm","Rice","Cocoa"],
  "Bonthe": ["Oil Palm","Rice","Cocoa"],
  "Moyamba": ["Oil Palm","Rice","Cocoa"],
  "Pujehun": ["Oil Palm","Rice","Cocoa"],
  "Western Area Urban": ["General"],
  "Western Area Rural": ["General"],
  "Port Loko": ["Rice","Oil Palm"],
  "Kambia": ["Rice","Oil Palm"],
};

export default function MapSection({
  indicators,
  selectedDistrict,
  onSelectDistrict,
  isLowBandwidth
}: MapSectionProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<DistrictMetricSummary | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeLayer, setActiveLayer] = useState<GISLayer>("yield");
  const [districtSearchQuery, setDistrictSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"telemetry" | "compare">("telemetry");
  const [districtAlpha, setDistrictAlpha] = useState<string>("Bo");
  const [districtBeta, setDistrictBeta] = useState<string>("Kenema");

  const districtSummaries = useMemo(() => getDistrictSummaries(indicators), [indicators]);

  const nationalAverages = useMemo(() => {
    const total = indicators.length;
    if (total === 0) return { progress: 0, critical: 0 };
    return {
      progress: Math.round(indicators.reduce((s, i) => s + i.Progress, 0) / total),
      critical: indicators.filter(i => i.Status === "Critical").length,
    };
  }, [indicators]);

  // Search includes district name, code, region AND value chains / commodities
  const filteredDistrictResults = useMemo(() => {
    const query = districtSearchQuery.trim().toLowerCase();
    if (!query) return [];

    // Check if query matches a value chain keyword
    const matchedCommodity = Object.entries(VALUE_CHAIN_KEYWORDS).find(([kw]) => query.includes(kw))?.[1];

    return districtSummaries
      .map(summary => {
        const districtIndicators = indicators.filter(ind => ind.District === summary.name);
        const criticalCount = districtIndicators.filter(ind => ind.Status === "Critical").length;
        const avgProgress = districtIndicators.length > 0
          ? Math.round(districtIndicators.reduce((sum, ind) => sum + ind.Progress, 0) / districtIndicators.length)
          : 0;
        const commodities = DISTRICT_COMMODITIES[summary.name] || [];
        return { ...summary, criticalCount, avgProgress, commodities };
      })
      .filter(s => {
        // Match by name, code, region
        const textMatch = [s.name, s.code, s.region].some(v => v.toLowerCase().includes(query));
        // Match by value chain / commodity
        const commodityMatch = matchedCommodity
          ? s.commodities.includes(matchedCommodity)
          : s.commodities.some(c => c.toLowerCase().includes(query));
        return textMatch || commodityMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [districtSearchQuery, districtSummaries, indicators]);

  const getDistrictFill = (name: string): string => {
    const districtIndicators = indicators.filter(i => i.District === name);
    if (activeLayer === "infra") {
      const summary = districtSummaries.find(d => d.name === name);
      const isHub = (summary?.roadsRehabbed || 0) >= 20 || ["Kenema","Moyamba","Port Loko","Bo","Tonkolili","Kambia"].includes(name);
      return isHub ? "#0ea5e9" : "#0e7490";
    }
    if (activeLayer === "climate") {
      const coastal = ["Bonthe","Pujehun","Moyamba","Western Area Rural","Western Area Urban","Port Loko","Kambia"];
      return coastal.includes(name) ? "#8b5cf6" : "#10b981";
    }
    if (districtIndicators.length === 0) return "#10b981";
    const critical = districtIndicators.filter(i => i.Status === "Critical").length;
    const onTrack  = districtIndicators.filter(i => i.Status === "On Track").length;
    const ratio    = onTrack / districtIndicators.length;
    if (critical > 0)  return "#0d9488";
    if (ratio >= 0.8)  return "#34d399";
    if (ratio >= 0.5)  return "#10b981";
    return "#059669";
  };

  const getDistrictStroke = (name: string) => {
    if (selectedDistrict === name) return { stroke: "#f0fdf4", strokeWidth: 3 };
    if (hoveredDistrict?.name === name) return { stroke: "#a7f3d0", strokeWidth: 2 };
    return { stroke: "#064e3b", strokeWidth: 1 };
  };

  const getIndicatorCount = (name: string) => indicators.filter(i => i.District === name).length;

  const handleMouseMove = (e: React.MouseEvent, districtName: string) => {
    const rect = (e.currentTarget as SVGElement).closest("svg")!.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left + 15, y: e.clientY - rect.top + 10 });
    const summary = districtSummaries.find(d => d.name === districtName);
    if (summary) setHoveredDistrict(summary);
  };
  const handleMouseLeave = () => setHoveredDistrict(null);

  // Radar helpers
  const cx = 140, cy = 125, rMax = 70, N = 5;
  const getNormalizeMetrics = (distName: string) => {
    const sum = districtSummaries.find(d => d.name === distName);
    if (!sum) return Array(5).fill(0).map((_, i) => ({ label: ["Rice","Tree Crops","Roads","Processing","Income"][i], val: 50 }));
    return [
      { label: "Rice Index",      val: Math.min(Math.round(((sum.riceYieldAchieved||65)/(sum.riceYieldBaseline||40))*100), 150) },
      { label: "Tree Crops",      val: Math.min(Math.round((((sum.cocoaYieldAchieved||48)+(sum.coffeeYieldAchieved||32)+(sum.palmYieldAchieved||24))/((sum.cocoaYieldBaseline||30)+(sum.coffeeYieldBaseline||20)+(sum.palmYieldBaseline||15)))*100), 150) },
      { label: "Feeder Roads",    val: Math.min(Math.round((sum.roadsRehabbed/25)*100), 150) },
      { label: "Agri-Processing", val: Math.min(Math.round((sum.facilitiesBuilt/3)*100), 150) },
      { label: "Farmer Income",   val: Math.min(Math.round((sum.farmerIncomeAverage/200)*100), 150) },
    ];
  };
  const metricsAlpha = useMemo(() => getNormalizeMetrics(districtAlpha), [districtAlpha, indicators]);
  const metricsBeta  = useMemo(() => getNormalizeMetrics(districtBeta),  [districtBeta, indicators]);
  const radarPt   = (idx: number, val: number) => { const r=(Math.min(val,150)/150)*rMax, a=(2*Math.PI*idx)/N-Math.PI/2; return { x:+(cx+r*Math.cos(a)).toFixed(1), y:+(cy+r*Math.sin(a)).toFixed(1) }; };
  const toPoints  = (ms: {val:number}[]) => ms.map((m,i)=>{ const p=radarPt(i,m.val); return `${p.x},${p.y}`; }).join(" ");
  const gridPts   = (s: number) => Array.from({length:N},(_,i)=>{ const a=(2*Math.PI*i)/N-Math.PI/2; return `${+(cx+(s/150)*rMax*Math.cos(a)).toFixed(0)},${+(cy+(s/150)*rMax*Math.sin(a)).toFixed(0)}`; }).join(" ");
  const spokes    = Array.from({length:N},(_,i)=>{ const a=(2*Math.PI*i)/N-Math.PI/2; return { x2:+(cx+rMax*Math.cos(a)).toFixed(1), y2:+(cy+rMax*Math.sin(a)).toFixed(1) }; });
  const labelCoord = (i: number) => { const r=rMax+14, a=(2*Math.PI*i)/N-Math.PI/2; return { x:+(cx+r*Math.cos(a)).toFixed(1), y:+(cy+r*Math.sin(a)).toFixed(1), anchor:(cx+r*Math.cos(a)>cx+8?"start":cx+r*Math.cos(a)<cx-8?"end":"middle") as "start"|"middle"|"end" }; };

  return (
    <div className="relative bg-[#020617]" style={{ minHeight: "calc(100vh - 220px)" }}>

      {/* ── Floating search bar (top-left) ── */}
      <div className="absolute top-4 left-4 z-30 w-72">
        <div className="bg-white rounded-xl shadow-2xl overflow-visible">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={districtSearchQuery}
              onChange={e => { setDistrictSearchQuery(e.target.value); setSearchOpen(!!e.target.value); }}
              onFocus={() => districtSearchQuery && setSearchOpen(true)}
              onKeyDown={e => {
                if (e.key === "Enter" && filteredDistrictResults[0]) {
                  onSelectDistrict(filteredDistrictResults[0].name);
                  setDistrictSearchQuery(""); setSearchOpen(false);
                }
                if (e.key === "Escape") { setSearchOpen(false); setDistrictSearchQuery(""); }
              }}
              placeholder="District, region, or value chain…"
              className="flex-1 text-xs text-slate-900 outline-none placeholder-slate-400 bg-transparent"
            />
            {districtSearchQuery && (
              <button onClick={() => { setDistrictSearchQuery(""); setSearchOpen(false); }} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchOpen && filteredDistrictResults.length > 0 && (
            <div className="border-t border-slate-100 max-h-64 overflow-y-auto divide-y divide-slate-50 rounded-b-xl shadow-xl">
              {filteredDistrictResults.map(d => (
                <button
                  key={d.name}
                  onClick={() => { onSelectDistrict(d.name); setDistrictSearchQuery(""); setSearchOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs hover:bg-emerald-50 transition-colors ${selectedDistrict === d.name ? "bg-emerald-50" : "bg-white"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{d.name}</span>
                    {d.criticalCount > 0 && <span className="text-[9px] text-red-600 font-bold">{d.criticalCount} critical</span>}
                  </div>
                  <div className="text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{d.code} · {d.region}</span>
                    {d.commodities?.length > 0 && (
                      <span className="text-emerald-700 font-medium">{d.commodities.slice(0,2).join(", ")}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchOpen && districtSearchQuery && filteredDistrictResults.length === 0 && (
            <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 bg-white rounded-b-xl">
              No match. Try "Bo", "Eastern", "Rice", or "Cocoa".
            </div>
          )}

          <div className="border-t border-slate-100 px-3 py-2">
            <button
              onClick={() => { onSelectDistrict("Western Area Urban"); setDistrictSearchQuery(""); setSearchOpen(false); }}
              className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
            >
              <LocateFixed className="w-3 h-3" /> Use My Location
            </button>
          </div>
        </div>
      </div>

      {/* ── Coordinate badge (top-right of map) ── */}
      <div className="absolute top-4 right-4 z-20 font-mono text-[9px] text-slate-400 bg-slate-950/80 border border-slate-800/40 px-2.5 py-2 rounded-lg pointer-events-none">
        <div className="flex items-center gap-1 mb-0.5">
          <Navigation className="w-3 h-3 text-emerald-400" />
          <span>WGS 84 / UTM ZONE 29N</span>
        </div>
        <div>8.4606° N, 11.7799° W</div>
      </div>

      {/* ── Panel toggle button (mid-right) ── */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className="absolute top-1/2 -translate-y-1/2 right-0 z-40 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-l-xl px-2 py-4 cursor-pointer transition-colors flex flex-col items-center gap-1.5 text-slate-400 hover:text-emerald-400"
        title={panelOpen ? "Hide panel" : "GIS Telemetry / Radar"}
      >
        {panelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        <span className="text-[8px] font-mono uppercase tracking-wider" style={{ writingMode: "vertical-rl" }}>
          {panelOpen ? "Hide" : "Layers"}
        </span>
      </button>

      {/* ── Reset lens (bottom-left) ── */}
      {selectedDistrict && (
        <button
          onClick={() => onSelectDistrict(null)}
          className="absolute bottom-16 left-4 z-20 text-[10px] font-mono flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-700 cursor-pointer transition-colors shadow"
        >
          <RefreshCw className="w-3 h-3" /> Reset Lens
        </button>
      )}

      {/* ── Legend (bottom-center) ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-slate-950/80 border border-slate-800/40 rounded-xl px-4 py-2 pointer-events-none">
        {activeLayer === "yield" && <>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#34d399]" /> On Track</div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#10b981]" /> Developing</div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#0d9488]" /> Critical</div>
        </>}
        {activeLayer === "infra" && <>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#0ea5e9]" /> Major Corridor</div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#0e7490]" /> Minor Routes</div>
        </>}
        {activeLayer === "climate" && <>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#8b5cf6]" /> Coastal Flood Risk</div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400"><span className="w-2 h-2 rounded-sm bg-[#10b981]" /> Low Risk</div>
        </>}
        <span className="text-slate-600 text-[9px] font-mono ml-3">50 KM</span>
      </div>

      {/* ── Main content row: Map + optional panel ── */}
      <div className="flex h-full">

        {/* MAP */}
        <div className="flex-1 relative flex justify-center">
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ display: "block", width: "100%", maxWidth: "820px", height: "auto", margin: "0 auto" }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="glow-sel">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="map-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* Country drop shadow */}
            <g filter="url(#map-shadow)" opacity="0.5">
              {DISTRICT_MAP_SHAPES.map(d => <polygon key={`sh-${d.name}`} points={d.points} fill="#000" />)}
            </g>

            {/* Districts */}
            <g>
              {DISTRICT_MAP_SHAPES.map(district => {
                const { name } = district;
                const fill = getDistrictFill(name);
                const stroke = getDistrictStroke(name);
                const isSelected = selectedDistrict === name;
                const count = getIndicatorCount(name);
                const hasCritical = indicators.some(i => i.District === name && i.Status === "Critical");
                const labelLines = district.label.lines || [name];

                return (
                  <g
                    key={name}
                    className="cursor-pointer select-none"
                    onClick={() => onSelectDistrict(isSelected ? null : name)}
                    onMouseMove={e => handleMouseMove(e, name)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <polygon
                      points={district.points}
                      fill={fill}
                      stroke={stroke.stroke}
                      strokeWidth={stroke.strokeWidth}
                      opacity={hoveredDistrict?.name === name && !isSelected ? 0.82 : 1}
                      style={{ filter: isSelected ? "url(#glow-sel)" : undefined, transition: "opacity 0.15s" }}
                    />

                    <text
                      x={district.label.x}
                      y={district.label.y}
                      textAnchor="middle"
                      fill={isSelected ? "#f0fdf4" : "#042f2e"}
                      fontWeight="700"
                      pointerEvents="none"
                      style={{ fontSize: district.label.size || 20, userSelect: "none" }}
                    >
                      {labelLines.map((line, idx) => (
                        <tspan key={idx} x={district.label.x} dy={idx === 0 ? 0 : (district.label.size || 20) * 1.1}>
                          {line}
                        </tspan>
                      ))}
                    </text>

                    {count > 0 && (
                      <g transform={`translate(${district.label.x}, ${district.label.y - (district.label.size || 20) - 8})`}>
                        <circle r="11" fill="#0f172a" stroke="#1e293b" strokeWidth="1.5" />
                        {!isLowBandwidth && hasCritical && (
                          <circle r="11" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.5" className="animate-ping" />
                        )}
                        <text textAnchor="middle" dy="0.35em" fill="#e2e8f0" fontWeight="800" style={{ fontSize: 9, userSelect: "none" }}>
                          {count}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            <text x={MAP_W*0.07} y={MAP_H*0.82} fill="rgba(148,163,184,0.45)" fontFamily="monospace" fontSize="11" fontWeight="700" fontStyle="italic" pointerEvents="none" style={{letterSpacing:2}}>ATLANTIC OCEAN</text>
            <text x={MAP_W*0.64} y={MAP_H*0.05} fill="rgba(148,163,184,0.35)" fontFamily="monospace" fontSize="9"  fontWeight="700" pointerEvents="none" style={{letterSpacing:3}}>GUINEA</text>
            <text x={MAP_W*0.78} y={MAP_H*0.94} fill="rgba(148,163,184,0.35)" fontFamily="monospace" fontSize="9"  fontWeight="700" pointerEvents="none" style={{letterSpacing:3}}>LIBERIA</text>
          </svg>

          {/* Hover tooltip */}
          {hoveredDistrict && (
            <div
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
              className="absolute z-40 bg-[#070d19]/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl w-56 pointer-events-none backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {hoveredDistrict.name}
                </span>
                <span className="text-[8px] font-mono uppercase text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {hoveredDistrict.region}
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between"><span className="text-slate-400">Rice:</span><span className="text-emerald-400 font-bold">{hoveredDistrict.riceYieldAchieved} MT</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cocoa:</span><span className="text-amber-500 font-bold">{hoveredDistrict.cocoaYieldAchieved || 12} MT</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Roads:</span><span className="text-teal-400 font-bold">{hoveredDistrict.roadsRehabbed} km</span></div>
                <div className="flex justify-between border-t border-slate-900/60 pt-1 mt-1">
                  <span className="text-slate-400 font-bold">Income:</span>
                  <span className="text-emerald-400 font-bold">${hoveredDistrict.farmerIncomeAverage}/mo</span>
                </div>
              </div>
              {hoveredDistrict.historicalTrend && (
                <div className="mt-2 border-t border-slate-900/60 pt-1.5">
                  <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" /> Yield trend 23–26
                  </span>
                  <svg className="w-full h-6" viewBox="0 0 100 24" preserveAspectRatio="none">
                    <line x1="0" y1="12" x2="100" y2="12" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 6" />
                    <polyline points={hoveredDistrict.historicalTrend.map((t,i)=>`${i*(100/3)},${24-(t.yieldIndex*0.13)}`).join(" ")} fill="none" stroke="#10b981" strokeWidth="1.5" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════ RIGHT PANEL (slide-in) ════ */}
        {panelOpen && (
          <div className="w-72 bg-[#060d1e] border-l border-slate-800 flex flex-col overflow-y-auto shrink-0">

            {/* Tab switcher */}
            <div className="p-3 border-b border-slate-800 flex gap-1.5">
              <button onClick={() => setRightPanelTab("telemetry")}
                className={`flex-1 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all cursor-pointer ${rightPanelTab === "telemetry" ? "bg-slate-900 border-emerald-500/30 text-emerald-400" : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"}`}>
                <Layers className="w-3.5 h-3.5" /> GIS Telemetry
              </button>
              <button onClick={() => setRightPanelTab("compare")}
                className={`flex-1 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all cursor-pointer ${rightPanelTab === "compare" ? "bg-slate-900 border-cyan-500/30 text-cyan-400" : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"}`}>
                <GitCompare className="w-3.5 h-3.5" /> Radar
              </button>
            </div>

            {rightPanelTab === "telemetry" ? (
              <div className="flex-1 flex flex-col gap-4 p-4">

                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">Thematic Overlay</span>
                  {(["yield","infra","climate"] as GISLayer[]).map(layer => (
                    <button key={layer} onClick={() => setActiveLayer(layer)}
                      className={`w-full text-xs font-mono font-bold flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        activeLayer === layer
                          ? layer==="yield" ? "bg-slate-950 border-emerald-500/30 text-emerald-400"
                          : layer==="infra" ? "bg-slate-950 border-teal-500/30 text-teal-400"
                          : "bg-slate-950 border-indigo-500/30 text-indigo-400"
                          : "bg-slate-950/30 border-slate-900 text-slate-500 hover:text-slate-300"
                      }`}>
                      <span className="flex items-center gap-2">
                        {layer==="yield" && <Activity className="w-3.5 h-3.5" />}
                        {layer==="infra" && <Route className="w-3.5 h-3.5" />}
                        {layer==="climate" && <AlertTriangle className="w-3.5 h-3.5" />}
                        {layer==="yield" ? "Yield Progress" : layer==="infra" ? "Feeder Road Density" : "Climate Hazard"}
                      </span>
                      <span className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded uppercase">
                        {layer==="yield"?"On Track":layer==="infra"?"KM":"Wet Risk"}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-4">
                  <h5 className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" /> Live Telemetry
                  </h5>
                  <div className="bg-slate-950 border border-slate-900 p-3 rounded-xl space-y-1.5">
                    <div className="text-[9px] font-mono uppercase text-slate-500 tracking-widest">Selected Region</div>
                    <div className="text-slate-100 font-bold text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      {selectedDistrict ? `${selectedDistrict} District` : "All Districts"}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                      {selectedDistrict ? "District polygon active." : "Click any district to inspect sub-metrics."}
                    </p>
                  </div>
                  {selectedDistrict && (
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-slate-900/50"><span className="text-slate-500">M&E Hub:</span><span className="text-slate-300 font-bold">{selectedDistrict} Central</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-900/50"><span className="text-slate-500">Swamp Index:</span><span className="text-emerald-400 font-bold">14.6 ppm</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-900/50"><span className="text-slate-500">Feeder Access:</span><span className="text-teal-400 font-bold">0.86 (High)</span></div>
                    </div>
                  )}
                  <div className="space-y-1.5 font-mono border-t border-slate-900 pt-3">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Targets:</span><span className="text-slate-300 font-bold">{indicators.length} channels</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Avg Progress:</span><span className="text-emerald-400 font-bold">{nationalAverages.progress}%</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Critical:</span><span className="text-red-400 font-bold">{nationalAverages.critical} metrics</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-4 p-4">
                <h5 className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-cyan-400" /> District Radar
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  {([{label:"Alpha",val:districtAlpha,set:setDistrictAlpha,cls:"emerald"},{label:"Beta",val:districtBeta,set:setDistrictBeta,cls:"cyan"}] as const).map(({label,val,set}) => (
                    <div key={label} className="space-y-1">
                      <label className={`text-[9px] font-mono uppercase font-bold ${label==="Alpha"?"text-emerald-400":"text-cyan-400"}`}>{label}</label>
                      <select value={val} onChange={e => set(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 border border-slate-900 rounded-lg p-1.5 text-xs font-mono focus:outline-none cursor-pointer">
                        {SIERRA_LEONE_DISTRICTS.map(d => <option key={d.code} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {selectedDistrict && (
                  <div className="flex gap-1.5 text-[9px] font-mono">
                    <button onClick={() => setDistrictAlpha(selectedDistrict)} className="flex-1 bg-emerald-950/40 border border-emerald-900 text-emerald-400 py-1.5 rounded-lg hover:bg-emerald-950/70 cursor-pointer text-center">A = {selectedDistrict}</button>
                    <button onClick={() => setDistrictBeta(selectedDistrict)}  className="flex-1 bg-cyan-950/40 border border-cyan-900 text-cyan-400 py-1.5 rounded-lg hover:bg-cyan-950/70 cursor-pointer text-center">B = {selectedDistrict}</button>
                  </div>
                )}
                <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-2 flex justify-center">
                  <svg width="220" height="200" viewBox="35 30 210 200" className="overflow-visible">
                    {[50,100,150].map(s => <polygon key={s} points={gridPts(s)} fill="none" stroke={s===100?"#334155":"#1e293b"} strokeWidth="1" />)}
                    {spokes.map((sp,i) => <line key={i} x1={cx} y1={cy} x2={sp.x2} y2={sp.y2} stroke="#1e293b" strokeWidth="1" />)}
                    <polygon points={toPoints(metricsAlpha)} fill="rgba(52,211,153,0.15)" stroke="#34d399" strokeWidth="2" />
                    <polygon points={toPoints(metricsBeta)}  fill="rgba(34,211,238,0.15)"  stroke="#22d3ee"  strokeWidth="2" />
                    {metricsAlpha.map((m,i)=>{ const p=radarPt(i,m.val); return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#34d399" stroke="#0f172a" strokeWidth="1.5" />; })}
                    {metricsBeta.map((m,i) =>{ const p=radarPt(i,m.val); return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#22d3ee" stroke="#0f172a" strokeWidth="1.5" />; })}
                    {metricsAlpha.map((m,i)=>{ const lc=labelCoord(i); return <text key={i} x={lc.x} y={lc.y} textAnchor={lc.anchor} fill="#94a3b8" fontSize="7.5" fontFamily="monospace">{m.label}</text>; })}
                  </svg>
                </div>
                <div className="flex gap-4 text-[10px] font-mono justify-center">
                  <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-3 h-px bg-emerald-400 inline-block" /> {districtAlpha}</span>
                  <span className="flex items-center gap-1.5 text-cyan-400"><span className="w-3 h-px bg-cyan-400 inline-block" /> {districtBeta}</span>
                </div>
                <div className="space-y-1.5 text-[11px] font-mono border-t border-slate-900 pt-3">
                  {metricsAlpha.map((ma, i) => {
                    const mb = metricsBeta[i]; const diff = ma.val - mb.val;
                    return (
                      <div key={ma.label} className="flex justify-between items-center">
                        <span className="text-slate-500 truncate mr-2 text-xs">{ma.label}</span>
                        <span className="flex items-center gap-2 shrink-0 text-xs">
                          <span className="text-emerald-400 w-8 text-right">{ma.val}%</span>
                          <span className={`w-8 text-right font-bold ${diff>0?"text-emerald-400":diff<0?"text-red-400":"text-slate-500"}`}>{diff>0?"+":""}{diff}</span>
                          <span className="text-cyan-400 w-8 text-right">{mb.val}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
