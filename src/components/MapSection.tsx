import React, { useState, useMemo } from "react";
import { SIERRA_LEONE_DISTRICTS, getDistrictSummaries } from "../data";
import { Indicator, DistrictMetricSummary } from "../types";
import {
  MapPin, TrendingUp, Layers, RefreshCw,
  Compass, Navigation, Route, AlertTriangle,
  Activity, GitCompare, Search, Server,
  LocateFixed, X
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

// ── GeoJSON → SVG projection ─────────────────────────────────────────────────
// Source: geoBoundaries SLE-ADM2 (commit 9469f09, gbHumanitarian = OCHA COD-AB source)
//   + 2017 district splits for Karene / Falaba (OCHA COD-AB itself only carries 14 districts;
//     Karene & Falaba are derived by Sutherland-Hodgman clipping of their parent polygons at
//     the known administrative thresholds documented in sleDistricts.geo.json metadata)
// Projection: Web Mercator (EPSG:3857) Y — ln(tan(π/4 + φ/2)) — normalised to 760×620 viewport
const GEO_LON_MIN = -13.389, GEO_LON_MAX = -10.191;
const GEO_LAT_MIN =  6.843,  GEO_LAT_MAX = 10.079;
// Pre-compute Mercator northings for the bbox extremes (avoids per-vertex recomputation)
const MERC_MAX = Math.log(Math.tan(Math.PI / 4 + (GEO_LAT_MAX * Math.PI) / 360));
const MERC_MIN = Math.log(Math.tan(Math.PI / 4 + (GEO_LAT_MIN * Math.PI) / 360));

function geoToSvg(lon: number, lat: number): [number, number] {
  const x = Math.round(((lon - GEO_LON_MIN) / (GEO_LON_MAX - GEO_LON_MIN)) * MAP_W);
  const mercY = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const y = Math.round(((MERC_MAX - mercY) / (MERC_MAX - MERC_MIN)) * MAP_H);
  return [x, y];
}

function ringToPoints(ring: number[][]): string {
  return ring
    .slice(0, -1) // remove closing vertex (SVG polygon closes automatically)
    .map(([lon, lat]) => geoToSvg(lon, lat).join(","))
    .join(" ");
}

function getLargestRing(geometry: { type: string; coordinates: number[][][][] | number[][][] }): number[][] {
  if (geometry.type === "Polygon") {
    return (geometry as { type: string; coordinates: number[][][] }).coordinates[0];
  }
  // MultiPolygon – use the largest outer ring
  const mp = (geometry as { type: string; coordinates: number[][][][] }).coordinates;
  return mp.reduce((best: number[][], poly: number[][][]) =>
    poly[0].length > best.length ? poly[0] : best, [] as number[][]);
}

/**
 * Area-weighted geometric centroid of a GeoJSON ring in SVG space.
 * Uses the standard shoelace formula  cx = (1/6A)·Σ(x_i+x_{i+1})·cross_i
 * which is exact for simple polygons and guaranteed to lie inside convex
 * shapes. For concave/tiny districts we fall back on the vertex average
 * if the computed area is near-zero (degenerate ring guard).
 */
function svgCentroid(ring: number[][]): [number, number] {
  const pts = ring.slice(0, -1).map(([lon, lat]) => geoToSvg(lon, lat));
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area  += cross;
    cx    += (x0 + x1) * cross;
    cy    += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    // degenerate: fall back to vertex average
    const sx = Math.round(pts.reduce((s, [x]) => s + x, 0) / pts.length);
    const sy = Math.round(pts.reduce((s, [, y]) => s + y, 0) / pts.length);
    return [sx, sy];
  }
  return [Math.round(cx / (6 * area)), Math.round(cy / (6 * area))];
}

// Per-district label overrides (size, display text, and/or pinned SVG anchor).
// x/y pins are used for districts whose polygon centroid may fall outside the
// shape (tiny or highly concave polygons). Values computed from GeoJSON centroid
// and verified against rendered output.
const LABEL_OVERRIDES: Record<string, Partial<DistrictMapShape["label"]>> = {
  // Western Area districts are tiny coastal polygons; centroid is pinned to a
  // known interior point so the label always sits inside the shape.
  "Western Area Urban": { x: 42, y: 312, size: 8,  lines: ["W.Urban"] },
  "Western Area Rural": { x: 69, y: 336, size: 9,  lines: ["W.Rural"] },
  "Kambia":    { size: 15 },
  "Port Loko": { size: 15 },
  "Karene":    { size: 15 },
  "Koinadugu": { size: 15 },
  "Falaba":    { size: 15 },
  "Bombali":   { size: 17 },
  "Tonkolili": { size: 17 },
  "Moyamba":   { size: 17 },
  "Kenema":    { size: 17 },
  "Kailahun":  { size: 17 },
  "Pujehun":   { size: 17 },
  "Bonthe":    { size: 15 },
  "Kono":      { size: 19 },
  "Bo":        { size: 21 },
};

// Build DISTRICT_MAP_SHAPES at module load time from the GeoJSON file
const DISTRICT_MAP_SHAPES: DistrictMapShape[] = (
  sleGeoJson as { features: { properties: { shapeName: string }; geometry: never }[] }
).features.map((feature) => {
  const name = feature.properties.shapeName;
  const ring = getLargestRing(feature.geometry);
  const points = ringToPoints(ring);
  const [cx, cy] = svgCentroid(ring);
  const overrides = LABEL_OVERRIDES[name] ?? { size: 17 };
  return { name, points, label: { x: cx, y: cy, ...overrides } };
});

type GISLayer = "yield" | "infra" | "climate";

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

  // Only show search results when the user has typed something
  const filteredDistrictResults = useMemo(() => {
    const query = districtSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const selectedGeo = SIERRA_LEONE_DISTRICTS.find(d => d.name === selectedDistrict);
    return districtSummaries
      .map(summary => {
        const geo = SIERRA_LEONE_DISTRICTS.find(d => d.name === summary.name);
        const districtIndicators = indicators.filter(ind => ind.District === summary.name);
        const criticalCount = districtIndicators.filter(ind => ind.Status === "Critical").length;
        const avgProgress = districtIndicators.length > 0
          ? Math.round(districtIndicators.reduce((sum, ind) => sum + ind.Progress, 0) / districtIndicators.length)
          : Math.round(summary.historicalTrend.at(-1)?.progress || 0);
        const distance = selectedGeo && geo
          ? Math.max(1, Math.round(Math.hypot(selectedGeo.x - geo.x, selectedGeo.y - geo.y) * 3.2))
          : Math.max(2, Math.round(((geo?.x || 10) + (geo?.y || 10)) / 4));
        return { ...summary, criticalCount, avgProgress, distance };
      })
      .filter(s => [s.name, s.code, s.region].some(v => v.toLowerCase().includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [districtSearchQuery, districtSummaries, indicators, selectedDistrict]);

  // Teal heatmap fill based on indicator performance
  const getDistrictFill = (name: string): string => {
    const districtIndicators = indicators.filter(i => i.District === name);
    if (districtIndicators.length === 0) {
      if (activeLayer === "infra") return "#0d9488";
      if (activeLayer === "climate") {
        const coastal = ["Bonthe","Pujehun","Moyamba","Western Area Rural","Western Area Urban","Port Loko","Kambia"];
        return coastal.includes(name) ? "#7c3aed" : "#059669";
      }
      return "#10b981";
    }
    if (activeLayer === "infra") {
      const summary = districtSummaries.find(d => d.name === name);
      const isHub = (summary?.roadsRehabbed || 0) >= 20 || ["Kenema","Moyamba","Port Loko","Bo","Tonkolili","Kambia"].includes(name);
      return isHub ? "#0ea5e9" : "#0e7490";
    }
    if (activeLayer === "climate") {
      const coastal = ["Bonthe","Pujehun","Moyamba","Western Area Rural","Western Area Urban","Port Loko","Kambia"];
      return coastal.includes(name) ? "#8b5cf6" : "#10b981";
    }
    // yield layer — teal shades by status ratio
    const critical = districtIndicators.filter(i => i.Status === "Critical").length;
    const onTrack  = districtIndicators.filter(i => i.Status === "On Track").length;
    const ratio    = onTrack / districtIndicators.length;
    if (critical > 0)  return "#0d9488"; // darker teal — needs attention
    if (ratio >= 0.8)  return "#34d399"; // bright emerald — great
    if (ratio >= 0.5)  return "#10b981"; // emerald — good
    return "#059669";                    // deeper green — ok
  };

  const getDistrictStroke = (name: string) => {
    const isSelected = selectedDistrict === name;
    const isHovered  = hoveredDistrict?.name === name;
    if (isSelected) return { stroke: "#f0fdf4", strokeWidth: 3 };
    if (isHovered)  return { stroke: "#a7f3d0", strokeWidth: 2 };
    return { stroke: "#064e3b", strokeWidth: 1 };
  };

  const getIndicatorCount = (name: string) =>
    indicators.filter(i => i.District === name).length;

  const handleMouseMove = (e: React.MouseEvent, districtName: string) => {
    const rect = (e.currentTarget as SVGElement).closest("svg")!.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left + 15, y: e.clientY - rect.top + 10 });
    const summary = districtSummaries.find(d => d.name === districtName);
    if (summary) setHoveredDistrict(summary);
  };

  const handleMouseLeave = () => setHoveredDistrict(null);

  // Radar chart helpers
  const cx = 140; const cy = 125; const rMax = 70; const N = 5;

  const getNormalizeMetrics = (distName: string) => {
    const sum = districtSummaries.find(d => d.name === distName);
    if (!sum) return Array(5).fill(0).map((_, i) => ({ label: ["Rice","Tree Crops","Roads","Processing","Income"][i], val: 50 }));
    const riceScore  = Math.min(((sum.riceYieldAchieved || 65) / (sum.riceYieldBaseline || 40)) * 100, 150);
    const treeBase   = (sum.cocoaYieldBaseline||30)+(sum.coffeeYieldBaseline||20)+(sum.palmYieldBaseline||15);
    const treeAch    = (sum.cocoaYieldAchieved||48)+(sum.coffeeYieldAchieved||32)+(sum.palmYieldAchieved||24);
    const treeScore  = Math.min((treeAch/treeBase)*100,150);
    return [
      { label: "Rice Index",      val: Math.round(riceScore) },
      { label: "Tree Crops",      val: Math.round(treeScore) },
      { label: "Feeder Roads",    val: Math.min(Math.round((sum.roadsRehabbed/25)*100),150) },
      { label: "Agri-Processing", val: Math.min(Math.round((sum.facilitiesBuilt/3)*100),150) },
      { label: "Farmer Income",   val: Math.min(Math.round((sum.farmerIncomeAverage/200)*100),150) },
    ];
  };

  const metricsAlpha = useMemo(() => getNormalizeMetrics(districtAlpha), [districtAlpha, indicators]);
  const metricsBeta  = useMemo(() => getNormalizeMetrics(districtBeta),  [districtBeta,  indicators]);

  const radarPoint = (idx: number, val: number) => {
    const r = (Math.min(val,150)/150) * rMax;
    const a = (2*Math.PI*idx)/N - Math.PI/2;
    return { x: +(cx+r*Math.cos(a)).toFixed(1), y: +(cy+r*Math.sin(a)).toFixed(1) };
  };
  const toPoints = (ms: {val:number}[]) => ms.map((m,i) => { const p=radarPoint(i,m.val); return `${p.x},${p.y}`; }).join(" ");
  const gridPts  = (s: number) => Array.from({length:N},(_,i)=>{ const a=(2*Math.PI*i)/N-Math.PI/2; return `${+(cx+(s/150)*rMax*Math.cos(a)).toFixed(0)},${+(cy+(s/150)*rMax*Math.sin(a)).toFixed(0)}`; }).join(" ");
  const spokes   = Array.from({length:N},(_,i)=>{ const a=(2*Math.PI*i)/N-Math.PI/2; return { x2:+(cx+rMax*Math.cos(a)).toFixed(1), y2:+(cy+rMax*Math.sin(a)).toFixed(1) }; });
  const labelCoords = (i: number) => {
    const r=rMax+14; const a=(2*Math.PI*i)/N-Math.PI/2;
    return { x:+(cx+r*Math.cos(a)).toFixed(1), y:+(cy+r*Math.sin(a)).toFixed(1), anchor: cx+r*Math.cos(a)>cx+8?"start":cx+r*Math.cos(a)<cx-8?"end":"middle" as "start"|"middle"|"end" };
  };

  return (
    <div className="bg-[#060d1e] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden" id="avdp-geodata-map-root">

      {/* ── Header ── */}
      <div className="border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <Compass className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-tight">
              IFAD-AVDP Geoinformatics Information System
              <span className="ml-2 text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider align-middle">
                GIS v2.4
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              16-district Sierra Leone · Live yield, roads &amp; climate overlays
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedDistrict && (
            <button onClick={() => onSelectDistrict(null)}
              className="text-[10px] font-mono flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-800 cursor-pointer transition-colors">
              <RefreshCw className="w-3 h-3" /> Reset GIS Lens
            </button>
          )}
        </div>
      </div>

      {/* ── Body: Map + Right Panel ── */}
      <div className="flex flex-col xl:flex-row">

        {/* ════ LEFT / MAP AREA ════ */}
        <div className="flex-1 relative bg-[#020617] flex flex-col">

          {/* Search bar — compact, floats over map */}
          <div className="absolute top-4 left-4 z-30 w-72">
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  value={districtSearchQuery}
                  onChange={e => { setDistrictSearchQuery(e.target.value); setSearchOpen(!!e.target.value); }}
                  onFocus={() => districtSearchQuery && setSearchOpen(true)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && filteredDistrictResults[0]) {
                      onSelectDistrict(filteredDistrictResults[0].name);
                      setDistrictSearchQuery("");
                      setSearchOpen(false);
                    }
                    if (e.key === "Escape") { setSearchOpen(false); setDistrictSearchQuery(""); }
                  }}
                  placeholder="Find a district, code, or region…"
                  className="flex-1 text-xs text-slate-900 outline-none placeholder-slate-400 bg-transparent"
                />
                {districtSearchQuery && (
                  <button onClick={() => { setDistrictSearchQuery(""); setSearchOpen(false); }}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Results — only when typing */}
              {searchOpen && filteredDistrictResults.length > 0 && (
                <div className="border-t border-slate-100 max-h-60 overflow-y-auto divide-y divide-slate-50">
                  {filteredDistrictResults.map(d => (
                    <button
                      key={d.name}
                      onClick={() => { onSelectDistrict(d.name); setDistrictSearchQuery(""); setSearchOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-xs hover:bg-emerald-50 transition-colors ${selectedDistrict===d.name?"bg-emerald-50":""}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-900">{d.name}</span>
                        {d.criticalCount > 0 && (
                          <span className="text-[9px] text-red-600 font-bold">{d.criticalCount} critical</span>
                        )}
                      </div>
                      <div className="text-slate-500 mt-0.5">{d.code} · {d.region} · {d.avgProgress}% avg</div>
                    </button>
                  ))}
                </div>
              )}

              {searchOpen && districtSearchQuery && filteredDistrictResults.length === 0 && (
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                  No districts matched. Try "Bo", "Eastern", or "SL-KN".
                </div>
              )}

              <div className="border-t border-slate-100 px-3 py-2">
                <button
                  onClick={() => { onSelectDistrict("Western Area Urban"); setDistrictSearchQuery(""); setSearchOpen(false); }}
                  className="text-[10px] font-bold text-slate-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer">
                  <LocateFixed className="w-3 h-3" /> Use My Location
                </button>
              </div>
            </div>
          </div>

          {/* Coordinate overlay */}
          <div className="absolute top-4 right-4 z-10 font-mono text-[9px] text-slate-400 bg-slate-950/80 border border-slate-800/40 px-2.5 py-2 rounded-lg pointer-events-none">
            <div className="flex items-center gap-1 mb-0.5">
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>WGS 84 / UTM ZONE 29N</span>
            </div>
            <div>8.4606° N, 11.7799° W</div>
          </div>

          {/* ── SVG Map ── */}
          <div className="relative flex-1 w-full flex items-start justify-center p-2">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              style={{ display: "block", width: "100%", maxHeight: "calc(100vh - 260px)", height: "auto" }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.5" />
                </filter>
              </defs>

              {/* Country shadow */}
              <g filter="url(#shadow)" opacity="0.6">
                {DISTRICT_MAP_SHAPES.map(d => (
                  <polygon key={`shadow-${d.name}`} points={d.points} fill="#000" />
                ))}
              </g>

              {/* Districts */}
              <g>
                {DISTRICT_MAP_SHAPES.map(district => {
                  const { name } = district;
                  const fill    = getDistrictFill(name);
                  const stroke  = getDistrictStroke(name);
                  const isSelected = selectedDistrict === name;
                  const count   = getIndicatorCount(name);
                  const hasCritical = indicators.some(i => i.District === name && i.Status === "Critical");
                  const labelLines  = district.label.lines || [name];

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
                        opacity={hoveredDistrict?.name === name && !isSelected ? 0.85 : 1}
                        style={{ filter: isSelected ? "url(#glow)" : undefined, transition: "all 0.2s" }}
                      />

                      {/* District label */}
                      <text
                        x={district.label.x}
                        y={district.label.y}
                        textAnchor="middle"
                        fill={isSelected ? "#f0fdf4" : "#042f2e"}
                        fontWeight="700"
                        pointerEvents="none"
                        style={{ fontSize: district.label.size || 22, userSelect: "none" }}
                      >
                        {labelLines.map((line, idx) => (
                          <tspan key={idx} x={district.label.x} dy={idx === 0 ? 0 : (district.label.size || 22) * 1}>
                            {line}
                          </tspan>
                        ))}
                      </text>

                      {/* Indicator count badge */}
                      {count > 0 && (
                        <g transform={`translate(${district.label.x}, ${district.label.y - (district.label.size || 22) - 6})`}>
                          <circle r="10" fill="#0f172a" stroke="#1e293b" strokeWidth="1.5" />
                          {!isLowBandwidth && hasCritical && (
                            <circle r="10" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
                          )}
                          <text
                            textAnchor="middle"
                            dy="0.35em"
                            fill="#e2e8f0"
                            fontWeight="800"
                            style={{ fontSize: 9, userSelect: "none" }}
                          >
                            {count}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Ocean / country labels */}
              <text x={MAP_W*0.07} y={MAP_H*0.82} fill="rgba(148,163,184,0.5)" fontFamily="monospace" fontSize="11" fontWeight="700" fontStyle="italic" pointerEvents="none" style={{letterSpacing:2}}>ATLANTIC OCEAN</text>
              <text x={MAP_W*0.64} y={MAP_H*0.06} fill="rgba(148,163,184,0.4)" fontFamily="monospace" fontSize="10" fontWeight="700" pointerEvents="none" style={{letterSpacing:3}}>GUINEA</text>
              <text x={MAP_W*0.78} y={MAP_H*0.93} fill="rgba(148,163,184,0.4)" fontFamily="monospace" fontSize="10" fontWeight="700" pointerEvents="none" style={{letterSpacing:3}}>LIBERIA</text>
            </svg>

            {/* Hover tooltip */}
            {hoveredDistrict && (
              <div
                style={{ left: tooltipPos.x, top: tooltipPos.y }}
                className="absolute z-40 bg-[#070d19]/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl w-60 pointer-events-none backdrop-blur-md"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                  <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    {hoveredDistrict.name}
                  </span>
                  <span className="text-[8px] font-mono font-bold tracking-wider uppercase text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {hoveredDistrict.region}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between"><span className="text-slate-400">Rice:</span><span className="text-emerald-400 font-bold">{hoveredDistrict.riceYieldAchieved} MT</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Cocoa:</span><span className="text-amber-500 font-bold">{hoveredDistrict.cocoaYieldAchieved || 12} MT</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Roads:</span><span className="text-teal-400 font-bold">{hoveredDistrict.roadsRehabbed} km</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Facilities:</span><span className="text-slate-200 font-bold">{hoveredDistrict.facilitiesBuilt} hubs</span></div>
                  <div className="flex justify-between border-t border-slate-900 pt-1.5 mt-1.5">
                    <span className="text-slate-400 font-bold">Income:</span>
                    <span className="text-emerald-400 font-bold">${hoveredDistrict.farmerIncomeAverage}/mo</span>
                  </div>
                </div>
                {hoveredDistrict.historicalTrend && (
                  <div className="mt-2.5 border-t border-slate-900 pt-2">
                    <span className="text-[9px] font-mono text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                      <TrendingUp className="w-3 h-3 text-emerald-400" /> Trend 23–26
                    </span>
                    <svg className="w-full h-8" viewBox="0 0 100 32" preserveAspectRatio="none">
                      <line x1="0" y1="16" x2="100" y2="16" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 6" />
                      <polyline
                        points={hoveredDistrict.historicalTrend.map((t,i)=>`${i*(100/3)},${32-(t.yieldIndex*0.17)}`).join(" ")}
                        fill="none" stroke="#10b981" strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend footer */}
          <div className="border-t border-slate-900 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4">
              {activeLayer === "yield" && <>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#34d399]" /> On Track (&gt;80%)</div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" /> Developing</div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#0d9488]" /> Critical Alert</div>
              </>}
              {activeLayer === "infra" && <>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#0ea5e9]" /> Major Corridor (&gt;25 km)</div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#0e7490]" /> Minor Routes</div>
              </>}
              {activeLayer === "climate" && <>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#8b5cf6]" /> Coastal Flood Risk</div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" /> Low Risk</div>
              </>}
            </div>
            <div className="font-mono text-[9px] text-slate-500 flex items-center gap-2">
              <span>GIS SCALE</span>
              <span className="w-10 h-px bg-slate-700 inline-block" />
              <span>50 Km</span>
            </div>
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="xl:w-72 border-t xl:border-t-0 xl:border-l border-slate-800 flex flex-col">

          {/* Tab switcher */}
          <div className="p-3 border-b border-slate-800 flex gap-1.5">
            <button onClick={() => setRightPanelTab("telemetry")}
              className={`flex-1 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all cursor-pointer ${
                rightPanelTab === "telemetry"
                  ? "bg-slate-900 border-emerald-500/30 text-emerald-400"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <Layers className="w-3.5 h-3.5" /> GIS Telemetry
            </button>
            <button onClick={() => setRightPanelTab("compare")}
              className={`flex-1 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all cursor-pointer ${
                rightPanelTab === "compare"
                  ? "bg-slate-900 border-cyan-500/30 text-cyan-400"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <GitCompare className="w-3.5 h-3.5" /> Radar
            </button>
          </div>

          {rightPanelTab === "telemetry" ? (
            <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">

              {/* Layer selectors */}
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

              {/* Telemetry data */}
              <div className="flex-1 bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-4">
                <h5 className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" /> Live Spatial Telemetry
                </h5>
                <div className="bg-slate-950 border border-slate-900 p-3 rounded-xl space-y-1.5">
                  <div className="text-[9px] font-mono uppercase text-slate-500 tracking-widest">Selected Region</div>
                  <div className="text-slate-100 font-bold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    {selectedDistrict ? `${selectedDistrict} District` : "All Districts"}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                    {selectedDistrict
                      ? `District polygon active. Tracking feeder road buffers and swamp management bounds.`
                      : "Composite national telemetry. Click any district to inspect sub-metrics."}
                  </p>
                </div>

                {selectedDistrict && (
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-900/50">
                      <span className="text-slate-500">M&E Hub:</span>
                      <span className="text-slate-300 font-bold">{selectedDistrict} Central</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900/50">
                      <span className="text-slate-500">Swamp Index:</span>
                      <span className="text-emerald-400 font-bold">14.6 ppm</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900/50">
                      <span className="text-slate-500">Feeder Access:</span>
                      <span className="text-teal-400 font-bold">0.86 (High)</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 font-mono pt-2 border-t border-slate-900">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Targets:</span>
                    <span className="text-slate-300 font-bold">{indicators.length} channels</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Avg Progress:</span>
                    <span className="text-emerald-400 font-bold">{nationalAverages.progress}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Critical:</span>
                    <span className="text-red-400 font-bold">{nationalAverages.critical} metrics</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Radar Comparison */
            <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
              <h5 className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-cyan-400" /> District Radar
              </h5>

              <div className="grid grid-cols-2 gap-2">
                {[{label:"Alpha",val:districtAlpha,set:setDistrictAlpha,cls:"emerald"},{label:"Beta",val:districtBeta,set:setDistrictBeta,cls:"cyan"}].map(({label,val,set,cls}) => (
                  <div key={label} className="space-y-1">
                    <label className={`text-[9px] font-mono uppercase font-bold text-${cls}-400`}>{label}</label>
                    <select value={val} onChange={e=>set(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 border border-slate-900 rounded-lg p-1.5 text-xs font-mono focus:outline-none cursor-pointer">
                      {SIERRA_LEONE_DISTRICTS.map(d => <option key={d.code} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {selectedDistrict && (
                <div className="flex gap-1.5 text-[9px] font-mono">
                  <button onClick={() => setDistrictAlpha(selectedDistrict)}
                    className="flex-1 bg-emerald-950/40 border border-emerald-900 text-emerald-400 py-1.5 rounded-lg hover:bg-emerald-950/70 cursor-pointer">
                    A = {selectedDistrict}
                  </button>
                  <button onClick={() => setDistrictBeta(selectedDistrict)}
                    className="flex-1 bg-cyan-950/40 border border-cyan-900 text-cyan-400 py-1.5 rounded-lg hover:bg-cyan-950/70 cursor-pointer">
                    B = {selectedDistrict}
                  </button>
                </div>
              )}

              <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-2 flex justify-center">
                <svg width="240" height="220" viewBox="35 30 210 200" className="overflow-visible">
                  {[50,100,150].map(s => <polygon key={s} points={gridPts(s)} fill="none" stroke={s===100?"#334155":"#1e293b"} strokeWidth="1" />)}
                  {spokes.map((sp,i) => <line key={i} x1={cx} y1={cy} x2={sp.x2} y2={sp.y2} stroke="#1e293b" strokeWidth="1" />)}

                  <polygon points={toPoints(metricsAlpha)} fill="rgba(52,211,153,0.15)" stroke="#34d399" strokeWidth="2" />
                  <polygon points={toPoints(metricsBeta)}  fill="rgba(34,211,238,0.15)"  stroke="#22d3ee"  strokeWidth="2" />

                  {metricsAlpha.map((m,i) => { const p=radarPoint(i,m.val); return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#34d399" stroke="#0f172a" strokeWidth="1.5" />; })}
                  {metricsBeta.map((m,i)  => { const p=radarPoint(i,m.val); return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#22d3ee"  stroke="#0f172a" strokeWidth="1.5" />; })}

                  {metricsAlpha.map((m,i) => {
                    const lc = labelCoords(i);
                    return (
                      <text key={i} x={lc.x} y={lc.y} textAnchor={lc.anchor} fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                        {m.label}
                      </text>
                    );
                  })}
                </svg>
              </div>

              <div className="flex gap-4 text-[10px] font-mono justify-center">
                <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-3 h-0.5 bg-emerald-400 inline-block" /> {districtAlpha}</span>
                <span className="flex items-center gap-1.5 text-cyan-400"><span className="w-3 h-0.5 bg-cyan-400 inline-block" /> {districtBeta}</span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono border-t border-slate-900 pt-3">
                {metricsAlpha.map((ma, i) => {
                  const mb = metricsBeta[i];
                  const diff = ma.val - mb.val;
                  return (
                    <div key={ma.label} className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 truncate mr-2">{ma.label}</span>
                      <span className="flex items-center gap-3 shrink-0">
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
      </div>
    </div>
  );
}
