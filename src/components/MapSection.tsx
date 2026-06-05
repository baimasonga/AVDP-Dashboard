import React, { useState, useMemo } from "react";
import * as d3 from "d3";
import { SIERRA_LEONE_DISTRICTS, getDistrictSummaries } from "../data";
import { Indicator, DistrictMetricSummary } from "../types";
import sleGeoRaw from "../sleDistricts.geo.json";
import { 
  MapPin, TrendingUp, HelpCircle, Eye, Info, Layers, RefreshCw, 
  Compass, Navigation, Route, AlertTriangle, ShieldAlert, CheckCircle2,
  Calendar, Award, Server, Activity, GitCompare
} from "lucide-react";

interface MapSectionProps {
  indicators: Indicator[];
  selectedDistrict: string | null;
  onSelectDistrict: (district: string | null) => void;
  isLowBandwidth: boolean;
}

// Real Sierra Leone district boundaries (geoBoundaries ADM2), rendered via d3-geo.
// The dataset uses the pre-2017 14-district division, so the two newer districts
// are folded into their parent ADM2 polygon for map aggregation/selection.
type GeoFeature = { type: "Feature"; properties: { shapeName: string }; geometry: any };
const GEO = sleGeoRaw as { type: "FeatureCollection"; features: GeoFeature[] };

const MAP_W = 600;
const MAP_H = 470;
const projection = d3.geoIdentity().reflectY(true).fitExtent(
  [[14, 14], [MAP_W - 14, MAP_H - 14]],
  GEO as any
);
const geoPathGen = d3.geoPath(projection as any);

// Post-2017 districts folded into the parent ADM2 polygon present in the data.
const POLY_MEMBERS: Record<string, string[]> = {
  Koinadugu: ["Koinadugu", "Falaba"],
  Bombali: ["Bombali", "Karene"],
};
const membersFor = (name: string): string[] => POLY_MEMBERS[name] || [name];

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

  // Calculate live summaries based on current state of indicators
  const districtSummaries = useMemo(() => {
    return getDistrictSummaries(indicators);
  }, [indicators]);

  const [rightPanelTab, setRightPanelTab] = useState<"telemetry" | "compare">("telemetry");
  const [districtAlpha, setDistrictAlpha] = useState<string>("Bo");
  const [districtBeta, setDistrictBeta] = useState<string>("Kenema");

  // Geoinformatics math configuration for the Radar polygon overlay
  const cx = 140;
  const cy = 125;
  const rMax = 70;
  const N_VERTICES = 5;

  const getNormalizeMetrics = (distName: string) => {
    const sum = districtSummaries.find(d => d.name === distName);
    if (!sum) {
      return [
        { label: "Rice Index", val: 50 },
        { label: "Tree Crops Index", val: 50 },
        { label: "Feeder Roads", val: 50 },
        { label: "Agri-Processing", val: 50 },
        { label: "Farmer Income", val: 50 }
      ];
    }

    const riceBase = sum.riceYieldBaseline || 40;
    const riceAch = sum.riceYieldAchieved || 65;
    const riceScore = Math.min((riceAch / riceBase) * 100, 150);

    const treeBase = (sum.cocoaYieldBaseline || 30) + (sum.coffeeYieldBaseline || 20) + (sum.palmYieldBaseline || 15);
    const treeAch = (sum.cocoaYieldAchieved || 48) + (sum.coffeeYieldAchieved || 32) + (sum.palmYieldAchieved || 24);
    const treeScore = Math.min((treeAch / treeBase) * 100, 150);

    const roadScore = Math.min((sum.roadsRehabbed / 25) * 100, 150);
    const infraScore = Math.min((sum.facilitiesBuilt / 3) * 100, 150);
    const incomeScore = Math.min((sum.farmerIncomeAverage / 200) * 100, 150);

    return [
      { label: "Rice Index", val: Math.round(riceScore) },
      { label: "Tree Crops Index", val: Math.round(treeScore) },
      { label: "Feeder Roads", val: Math.round(roadScore) },
      { label: "Agri-Processing", val: Math.round(infraScore) },
      { label: "Farmer Income", val: Math.round(incomeScore) }
    ];
  };

  const metricsAlpha = useMemo(() => {
    return getNormalizeMetrics(districtAlpha);
  }, [districtAlpha, indicators]);

  const metricsBeta = useMemo(() => {
    return getNormalizeMetrics(districtBeta);
  }, [districtBeta, indicators]);

  const getPointsString = (metrics: { label: string; val: number }[]) => {
    return metrics.map((m, idx) => {
      const currentR = (m.val / 150) * rMax;
      const angle = (2 * Math.PI * idx) / N_VERTICES - Math.PI / 2;
      const x = cx + currentR * Math.cos(angle);
      const y = cy + currentR * Math.sin(angle);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    }).join(" ");
  };

  const getRadarPoint = (index: number, value: number) => {
    const normVal = Math.min(value, 150);
    const currentR = (normVal / 150) * rMax;
    const angle = (2 * Math.PI * index) / N_VERTICES - Math.PI / 2;
    const x = cx + currentR * Math.cos(angle);
    const y = cy + currentR * Math.sin(angle);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  const getGridPolygonPoints = (scaleVal: number) => {
    const currentR = (scaleVal / 150) * rMax;
    return Array.from({ length: N_VERTICES }).map((_, idx) => {
      const angle = (2 * Math.PI * idx) / N_VERTICES - Math.PI / 2;
      const x = cx + currentR * Math.cos(angle);
      const y = cy + currentR * Math.sin(angle);
      return `${Math.round(x)},${Math.round(y)}`;
    }).join(" ");
  };

  const getLabelCoords = (index: number) => {
    const rLabel = rMax + 14;
    const angle = (2 * Math.PI * index) / N_VERTICES - Math.PI / 2;
    const x = cx + rLabel * Math.cos(angle);
    const y = cy + rLabel * Math.sin(angle);
    
    let anchor: "start" | "middle" | "end" = "middle";
    if (x > cx + 8) anchor = "start";
    else if (x < cx - 8) anchor = "end";
    
    let dy = "0.33em";
    if (index === 0) dy = "-0.28em";
    else if (index === 2 || index === 3) dy = "0.9em";

    return { x, y, anchor, dy };
  };

  const gridLines = useMemo(() => {
    return Array.from({ length: N_VERTICES }).map((_, idx) => {
      const angle = (2 * Math.PI * idx) / N_VERTICES - Math.PI / 2;
      const x = cx + rMax * Math.cos(angle);
      const y = cy + rMax * Math.sin(angle);
      return { x1: cx, y1: cy, x2: x, y2: y };
    });
  }, [cx, cy, rMax]);

  const nationalAverages = useMemo(() => {
    const total = indicators.length;
    if (total === 0) return { progress: 0, critical: 0 };
    const avgProgress = indicators.reduce((s, i) => s + i.Progress, 0) / total;
    const critical = indicators.filter(i => i.Status === "Critical").length;
    return {
      progress: Math.round(avgProgress),
      critical
    };
  }, [indicators]);

  // Handle map interaction
  const handleMouseMove = (e: React.MouseEvent, districtName: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Offset relative to containing coordinate element
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top + 10
    });

    const summary = districtSummaries.find(d => d.name === districtName);
    if (summary) {
      setHoveredDistrict(summary);
    }
  };

  const handleMouseLeave = () => {
    setHoveredDistrict(null);
  };

  // Advanced GIS Thematic layer styling, keyed by ADM2 polygon name.
  const getThematicStyle = (name: string) => {
    const members = membersFor(name);
    const inDist = (i: Indicator) => members.includes(i.District);
    const isSelected = members.includes(selectedDistrict || "");
    const isHovered = hoveredDistrict ? members.includes(hoveredDistrict.name) : false;

    let baseClass = "transition-all duration-300 stroke-[0.6] cursor-pointer fill-slate-900 stroke-slate-700";

    if (activeLayer === "yield") {
      const countCritical = indicators.filter(i => inDist(i) && i.Status === "Critical").length;
      const countOnTrack = indicators.filter(i => inDist(i) && i.Status === "On Track").length;
      const total = indicators.filter(inDist).length;
      const ratio = total > 0 ? countOnTrack / total : 0.8;

      if (countCritical >= 2) {
        baseClass = isSelected
          ? "fill-red-900/60 stroke-red-400 stroke-[1.4]"
          : "fill-red-950/40 stroke-red-700 hover:fill-red-900/40 hover:stroke-red-500 stroke-[0.6]";
      } else if (ratio < 0.6) {
        baseClass = isSelected
          ? "fill-amber-900/60 stroke-amber-400 stroke-[1.4]"
          : "fill-amber-950/40 stroke-amber-700 hover:fill-amber-900/40 hover:stroke-amber-500 stroke-[0.6]";
      } else {
        baseClass = isSelected
          ? "fill-emerald-900/70 stroke-emerald-400 stroke-[1.4]"
          : "fill-slate-900 hover:fill-emerald-950/50 stroke-slate-700 hover:stroke-emerald-600 stroke-[0.6]";
      }
    } else if (activeLayer === "infra") {
      const majorRoadHubs = ["Kenema", "Moyamba", "Port Loko", "Bo", "Tonkolili", "Kambia"];
      const isRoadDensityHub = members.some(m => majorRoadHubs.includes(m));
      baseClass = isRoadDensityHub
        ? (isSelected
            ? "fill-teal-900/60 stroke-teal-400 stroke-[1.4]"
            : "fill-teal-950/30 stroke-teal-800 hover:fill-teal-900/40 hover:stroke-teal-500 stroke-[0.6]")
        : (isSelected
            ? "fill-slate-800 stroke-teal-500 stroke-[1.2]"
            : "fill-slate-950/80 stroke-slate-800 hover:fill-slate-800 hover:stroke-teal-700 stroke-[0.6]");
    } else {
      const criticalCoastalFloodZones = ["Bonthe", "Pujehun", "Moyamba", "Western Area Rural", "Port Loko", "Kambia"];
      const isHighFloodRisk = members.some(m => criticalCoastalFloodZones.includes(m));
      baseClass = isHighFloodRisk
        ? (isSelected
            ? "fill-indigo-900/60 stroke-indigo-400 stroke-[1.4]"
            : "fill-indigo-950/40 stroke-indigo-800/80 hover:fill-indigo-900/40 hover:stroke-indigo-500 stroke-[0.6]")
        : (isSelected
            ? "fill-emerald-950/20 stroke-emerald-500 stroke-[1.2]"
            : "fill-slate-950/90 stroke-slate-800 hover:fill-slate-900 hover:stroke-emerald-800/85 stroke-[0.6]");
    }

    if (isHovered && !isSelected) {
      baseClass += " brightness-125";
    }

    return baseClass;
  };

  // Detailed layer info
  const activeLayerMeta = useMemo(() => {
    switch (activeLayer) {
      case "yield":
        return {
          title: "Thematic Map: Average Smallholder Yield Target Index",
          indicatorName: "On-site Target Performance",
          legend: [
            { label: "Optimal Output (>130% target)", color: "bg-emerald-500" },
            { label: "Stable Development (100% - 130%)", color: "bg-amber-500" },
            { label: "Sub-Baseline Interventions Area", color: "bg-red-500" }
          ]
        };
      case "infra":
        return {
          title: "GIS Overlay: Feeder Road & Infrastructure Network Density",
          indicatorName: "Rehabilitated Road Connections",
          legend: [
            { label: "Major Corridor Corridors (>25 km)", color: "bg-teal-500" },
            { label: "Sub-Baseline Corridors (Minor)", color: "bg-slate-700" }
          ]
        };
      case "climate":
        return {
          title: "GIS Risk Matrix: Climate Monsoon Hazard Zones",
          indicatorName: "Flood & Wet Swamp Indexations",
          legend: [
            { label: "Extreme Coastal Drainage Risk", color: "bg-indigo-500" },
            { label: "Low Highland Risk Gradient", color: "bg-emerald-500/50" }
          ]
        };
    }
  }, [activeLayer]);

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-visible" id="avdp-geodata-map-root">
      
      {/* McKinsey GIS Outer Header Decoration */}
      <div className="border-b border-slate-800 pb-5 mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400 animate-spin-slow" />
            <h3 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
              IFAD-AVDP Geoinformatics Information System (GIS)
            </h3>
            <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              McKinsey GIS v2.4
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real contiguous district coordinates, bathymetric maritime shelf wave contours, and regional agricultural compliance overlays.
          </p>
        </div>

        {/* Global Reset actions */}
        <div className="flex gap-2 shrink-0 select-none">
          {selectedDistrict && (
            <button
              onClick={() => onSelectDistrict(null)}
              className="text-[10px] bg-slate-900 hover:bg-slate-800 hover:text-emerald-300 text-slate-300 font-mono flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reset GIS Lens
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative overflow-visible">
        
        {/* Main Interactive Geographic Canvas (Left Panel) */}
        <div className="xl:col-span-8 bg-[#020617] rounded-2xl border border-slate-900 p-4 flex flex-col justify-between min-h-[440px] relative overflow-hidden">
          
          {/* Subtle GIS Topographic Scale Rule & Navigation Overlay */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none font-mono text-[9px] text-slate-400 bg-slate-950/80 border border-slate-920/40 p-2.5 rounded-lg">
            <div className="flex items-center gap-1">
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>BEARING: <strong>WGS 84 / UTM ZONE 29N</strong></span>
            </div>
            <div>COORDINATES: <strong className="text-slate-200">8.4606° N, 11.7799° W</strong></div>
            <div>ALTITUDE REF: <strong className="text-emerald-400">Guinean Highlands Basin</strong></div>
          </div>

          {/* Compass Rose graphics decoration */}
          {!isLowBandwidth && (
            <div className="absolute top-3 right-3 pointer-events-none opacity-30 flex flex-col items-center">
              <Compass className="w-10 h-10 text-slate-400" />
              <span className="text-[7px] font-mono mt-0.5 text-slate-400">TRUE N</span>
            </div>
          )}

          {/* Real District Contour map SVG Viewport */}
          <div className="w-full flex items-center justify-center py-4 relative">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="w-full max-w-[520px] h-auto drop-shadow-3xl transition-all"
              id="sl-district-svg-map"
            >
              <defs>
                <pattern id="grid-dots" width="15" height="15" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="0.5" fill="#1e293b" />
                </pattern>
              </defs>

              {/* Background dots grid */}
              <rect width={MAP_W} height={MAP_H} fill="url(#grid-dots)" />

              {/* Real Sierra Leone district boundaries (geoBoundaries ADM2 via d3-geo) */}
              <g id="regions-layout">
                {GEO.features.map((feature) => {
                  const name = feature.properties.shapeName;
                  const members = membersFor(name);
                  const d = geoPathGen(feature as any) || "";
                  const [cx0, cy0] = geoPathGen.centroid(feature as any);
                  const classColors = getThematicStyle(name);
                  const isSelected = members.includes(selectedDistrict || "");
                  const hasCritical = indicators.some(
                    (i) => members.includes(i.District) && i.Status === "Critical"
                  );

                  return (
                    <g
                      key={name}
                      className="group select-none"
                      onClick={() => onSelectDistrict(isSelected ? null : name)}
                      onMouseMove={(e) => handleMouseMove(e, name)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <path d={d} className={classColors} />

                      {/* Live blinking critical beacon at the polygon centroid */}
                      {!isLowBandwidth && hasCritical && activeLayer === "yield" && (
                        <circle
                          cx={cx0}
                          cy={cy0}
                          r="4"
                          className="fill-red-500 opacity-65 animate-ping pointer-events-none"
                        />
                      )}

                      {/* District label at centroid */}
                      <text
                        x={cx0}
                        y={cy0 + 1}
                        textAnchor="middle"
                        className="fill-slate-200 font-mono group-hover:fill-white font-black text-[8px] pointer-events-none select-none tracking-tight"
                      >
                        {name.length > 12 ? name.slice(0, 3).toUpperCase() : name}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Neighbour / ocean reference labels */}
              <text x={MAP_W * 0.1} y={MAP_H * 0.72} className="fill-slate-500/70 font-mono font-bold text-[9px] tracking-wider pointer-events-none select-none italic">ATLANTIC OCEAN</text>
              <text x={MAP_W * 0.6} y={MAP_H * 0.08} className="fill-slate-500/50 font-mono font-bold text-[9px] tracking-widest pointer-events-none select-none">GUINEA</text>
            </svg>

            {/* Custom Interactive Tooltip */}
            {hoveredDistrict && (
              <div
                style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
                className="absolute z-40 bg-[#070d19]/95 border border-slate-700/80 rounded-xl p-4 shadow-2xl w-64 pointer-events-none animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
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

                {/* Performance stats by layer relevance */}
                <div className="space-y-2 text-[11px] font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Rice Achieved:</span>
                    <span className="text-emerald-400 font-bold">{hoveredDistrict.riceYieldAchieved} MT</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Cocoa Organic:</span>
                    <span className="text-amber-500">{hoveredDistrict.cocoaYieldAchieved || 12} MT</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Roads Rehab:</span>
                    <span className="text-teal-400">{hoveredDistrict.roadsRehabbed} Km</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">M&E Facilities:</span>
                    <span className="text-slate-200">{hoveredDistrict.facilitiesBuilt} Hubs</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-900 pt-2 mt-2">
                    <span className="text-slate-400 font-bold">Farmer Revenue:</span>
                    <span className="text-emerald-400 font-bold">${hoveredDistrict.farmerIncomeAverage}/Mo</span>
                  </div>
                </div>

                {/* Yield historical trend vector map */}
                <div className="mt-3 border-t border-slate-900 pt-2">
                  <span className="text-[9px] font-mono text-slate-500 uppercase flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Interactive Trajectory (23-26)
                  </span>
                  <div className="h-10 w-full mt-2 flex items-end justify-between relative bg-slate-950 p-1 rounded border border-slate-900/50">
                    <svg className="absolute inset-0 w-full h-full p-1" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <path
                        d={`M 0 ${40 - (hoveredDistrict.historicalTrend[0].yieldIndex * 0.22)} 
                            L 33 ${40 - (hoveredDistrict.historicalTrend[1].yieldIndex * 0.22)} 
                            L 66 ${40 - (hoveredDistrict.historicalTrend[2].yieldIndex * 0.22)} 
                            L 100 ${40 - (hoveredDistrict.historicalTrend[3].yieldIndex * 0.22)}`}
                        className="fill-none stroke-emerald-400 stroke-[1.5]"
                      />
                      <line x1="0" y1="20" x2="100" y2="20" className="stroke-slate-800 stroke-1" strokeDasharray="2 15" />
                    </svg>
                    {hoveredDistrict.historicalTrend.map((t, idx) => (
                      <div key={idx} className="flex flex-col items-center justify-end z-10 w-full">
                        <span className="text-[7.5px] text-slate-500 font-mono">{t.year}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floater overlay legend & meta details */}
          <div className="border-t border-slate-900 pt-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <span className="text-[10px] font-mono text-slate-500 uppercase block tracking-wider">
                {activeLayerMeta.title}
              </span>
              <div className="flex flex-wrap items-center gap-4 mt-2 select-none">
                {activeLayerMeta.legend.map((leg, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className={`w-2.5 h-2.5 rounded-sm ${leg.color}`} />
                    <span>{leg.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GIS Scale Yard widget */}
            <div className="flex flex-col items-end shrink-0 font-mono text-[9px] text-slate-500">
              <span className="mb-1 text-slate-400">GIS GRAPHIC SCALE</span>
              <div className="flex items-center gap-1.5 bh-slate-950 px-2 py-0.5 rounded border border-slate-900">
                <span>0 Km</span>
                <span className="w-12 h-1 bg-slate-800 flex items-center justify-between"><span className="w-0.5 h-2 bg-slate-400" /><span className="w-0.5 h-2 bg-slate-400" /></span>
                <span>50 Km</span>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Info & Active Selection Panel (Right Panel) */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          
          {/* Tab selectors for GIS Telemetry vs Side-by-Side Radar comparison */}
          <div className="bg-[#050914] border border-slate-900 rounded-2xl p-1.5 flex gap-1.5 shrink-0 select-none">
            <button
              onClick={() => setRightPanelTab("telemetry")}
              className={`flex-1 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all cursor-pointer ${
                rightPanelTab === "telemetry"
                  ? "bg-slate-950 border-emerald-550/30 text-emerald-400 font-bold shadow-md"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-950/40"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              GIS Telemetry
            </button>
            <button
              onClick={() => setRightPanelTab("compare")}
              className={`flex-1 text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all cursor-pointer ${
                rightPanelTab === "compare"
                  ? "bg-slate-950 border-cyan-550/30 text-cyan-400 font-bold shadow-md"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-950/40"
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 animate-pulse" />
              Radar Comparer
            </button>
          </div>

          {rightPanelTab === "telemetry" ? (
            <>
              {/* McKinsey GIS Overlays selectors */}
              <div className="bg-[#050914] border border-slate-900 rounded-2xl p-4 space-y-3 shrink-0">
                <span className="text-[10px] font-mono uppercase text-slate-500 font-bold block pb-2 border-b border-slate-900">
                  Thematic Overlay Layers Settings
                </span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setActiveLayer("yield")}
                    className={`text-xs font-mono font-bold flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      activeLayer === "yield"
                        ? "bg-slate-950 border-emerald-500/30 text-emerald-400 font-bold shadow-lg"
                        : "bg-slate-950/30 border-slate-950 text-slate-500 hover:text-slate-300 hover:bg-slate-950/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Yield Progress Heatmap
                    </span>
                    <span className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded uppercase">On track</span>
                  </button>

                  <button
                    onClick={() => setActiveLayer("infra")}
                    className={`text-xs font-mono font-bold flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      activeLayer === "infra"
                        ? "bg-slate-950 border-teal-500/30 text-teal-400 font-bold shadow-lg"
                        : "bg-slate-950/30 border-slate-950 text-slate-500 hover:text-slate-300 hover:bg-slate-950/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Route className="w-4 h-4" />
                      Feeder Road Density
                    </span>
                    <span className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded uppercase">KM index</span>
                  </button>

                  <button
                    onClick={() => setActiveLayer("climate")}
                    className={`text-xs font-mono font-bold flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      activeLayer === "climate"
                        ? "bg-slate-950 border-indigo-500/30 text-indigo-400 font-bold shadow-lg"
                        : "bg-slate-950/30 border-slate-950 text-slate-500 hover:text-slate-300 hover:bg-slate-950/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Climate Monsoon Hazard
                    </span>
                    <span className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded uppercase">Wet risk</span>
                  </button>
                </div>
              </div>

              {/* Regional Context information board */}
              <div className="bg-[#050914] border border-slate-900 rounded-2xl p-4 flex-grow flex flex-col justify-between">
                <div className="space-y-4">
                  <h5 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300 border-b border-slate-900 pb-2.5 flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    Live GIS Spatial Database Telemetry
                  </h5>

                  <div className="bg-slate-950 border border-slate-900 p-3.5 rounded-xl space-y-2">
                    <div className="text-[9px] font-mono tracking-widest uppercase text-slate-500">Selected Spatial Region</div>
                    <div className="text-slate-100 font-bold text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      {selectedDistrict ? `${selectedDistrict} District` : "All Regional Districts Linked"}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                      {selectedDistrict 
                        ? `Operations mapped to custom district polygon ${selectedDistrict}. Tracking feeder road buffers and swamp water management bounds.` 
                        : "Viewing composite national telemetry indices. Click on any contiguous map boundary to inspect regional sub-metrics."}
                    </p>
                  </div>

                  {/* District detailed dynamic parameters */}
                  {selectedDistrict ? (
                    <div className="space-y-2 pt-2 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-slate-900/45">
                        <span className="text-slate-500">M&E Regional Hub:</span>
                        <span className="text-slate-300 font-bold">{selectedDistrict} Central</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900/45">
                        <span className="text-slate-500">Methane Swamp Index:</span>
                        <span className="text-emerald-400 font-bold">14.6 ppm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-900/45">
                        <span className="text-slate-500">Feeder Access Ratio:</span>
                        <span className="text-teal-400 font-bold">0.86 (High)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-2 text-xs font-mono text-slate-500">
                      <p className="text-[11px] leading-relaxed italic">
                        Note: Complete GIS boundaries are compiled based on IFAD G-100 indicators schemas, integrating land use buffers and regional direct offtaker quotas verification.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-900 space-y-2.5 font-mono">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Connected Targets:</span>
                    <span className="text-slate-300 font-bold">{indicators.length} channels</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Averages Progress:</span>
                    <span className="text-emerald-400 font-bold">{nationalAverages.progress}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Critical Alarms Raised:</span>
                    <span className="text-red-400 font-bold">{nationalAverages.critical} metrics</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Radar Comparison Section styled to McKinsey geographics guidelines */
            <div className="bg-[#050914] border border-slate-900 rounded-2xl p-4 flex-grow flex flex-col justify-between" id="gis-radar-comparator-pane">
              <div className="space-y-4">
                <h5 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300 border-b border-slate-900 pb-2.5 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-cyan-400" />
                  Dual-District Radar Lexicon
                </h5>

                {/* Styled Dropdowns for targets choice */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-emerald-400 block font-bold">District Alpha (A)</label>
                    <select
                      value={districtAlpha}
                      onChange={(e) => setDistrictAlpha(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 border border-slate-900 rounded-lg p-2 text-xs font-mono focus:border-emerald-500 focus:outline-none cursor-pointer"
                    >
                      {SIERRA_LEONE_DISTRICTS.map(d => (
                        <option key={d.code} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-cyan-400 block font-bold">District Beta (B)</label>
                    <select
                      value={districtBeta}
                      onChange={(e) => setDistrictBeta(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 border border-slate-900 rounded-lg p-2 text-xs font-mono focus:border-cyan-500 focus:outline-none cursor-pointer"
                    >
                      {SIERRA_LEONE_DISTRICTS.map(d => (
                        <option key={d.code} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Anchor live map selections */}
                {selectedDistrict && (
                  <div className="flex gap-2 text-[9px] font-mono select-none">
                    <button
                      onClick={() => setDistrictAlpha(selectedDistrict)}
                      className="flex-grow bg-emerald-950/40 border border-emerald-900 text-emerald-400 py-1.5 px-2 rounded-lg hover:bg-emerald-950/70 transition-colors cursor-pointer text-center"
                    >
                      Set Alpha A = {selectedDistrict}
                    </button>
                    <button
                      onClick={() => setDistrictBeta(selectedDistrict)}
                      className="flex-grow bg-cyan-950/40 border border-cyan-900 text-cyan-400 py-1.5 px-2 rounded-lg hover:bg-cyan-950/70 transition-colors cursor-pointer text-center"
                    >
                      Set Beta B = {selectedDistrict}
                    </button>
                  </div>
                )}

                {/* SVG Radar Chart Display with glowing rings and ticks */}
                <div className="flex flex-col items-center justify-center py-2.5 bg-slate-950/50 border border-slate-900/60 rounded-xl relative select-none">
                  <svg
                    width="260"
                    height="230"
                    viewBox="35 30 210 200"
                    className="overflow-visible"
                  >
                    {/* Concentric pentagons */}
                    <polygon points={getGridPolygonPoints(50)} className="fill-none stroke-slate-800/60 stroke-[1]" />
                    <polygon points={getGridPolygonPoints(100)} className="fill-none stroke-slate-800 stroke-[1] stroke-dasharray-[2 2]" />
                    <polygon points={getGridPolygonPoints(150)} className="fill-none stroke-slate-700/80 stroke-[1]" />

                    {/* Scale tick notations */}
                    <text x={cx + 10} y={cy - (50/150)*rMax + 3} className="fill-slate-650 font-mono text-[7px] text-slate-500">50%</text>
                    <text x={cx + 10} y={cy - (100/150)*rMax + 3} className="fill-slate-500 font-mono text-[7px] text-slate-400">100%</text>
                    <text x={cx + 10} y={cy - (150/150)*rMax + 3} className="fill-slate-450 font-mono text-[7px] text-slate-300">150%</text>

                    {/* Radial spokes axis grids */}
                    {gridLines.map((line, idx) => (
                      <line
                        key={idx}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        className="stroke-slate-800/80 stroke-[1]"
                      />
                    ))}

                    {/* Alpha Layer Polygon (Emerald) */}
                    <polygon
                      points={getPointsString(metricsAlpha)}
                      className="fill-emerald-500/25 stroke-emerald-400 stroke-[2] transition-all duration-300"
                    />

                    {/* Beta Layer Polygon (Cyan) */}
                    <polygon
                      points={getPointsString(metricsBeta)}
                      className="fill-cyan-500/25 stroke-cyan-400 stroke-[2] transition-all duration-300"
                    />

                    {/* Markers on Alpha Vertices */}
                    {metricsAlpha.map((m, idx) => {
                      const pt = getRadarPoint(idx, m.val);
                      return (
                        <circle
                          key={`pa-${idx}`}
                          cx={pt.x}
                          cy={pt.y}
                          r="3"
                          className="fill-emerald-400 stroke-slate-950 stroke-[1.2]"
                        />
                      );
                    })}

                    {/* Markers on Beta Vertices */}
                    {metricsBeta.map((m, idx) => {
                      const pt = getRadarPoint(idx, m.val);
                      return (
                        <circle
                          key={`pb-${idx}`}
                          cx={pt.x}
                          cy={pt.y}
                          r="3"
                          className="fill-cyan-400 stroke-slate-950 stroke-[1.2]"
                        />
                      );
                    })}

                    {/* Outer Label text mappings */}
                    {metricsAlpha.map((m, idx) => {
                      const lc = getLabelCoords(idx);
                      return (
                        <text
                          key={`lbl-${idx}`}
                          x={lc.x}
                          y={lc.y}
                          dy={lc.dy}
                          textAnchor={lc.anchor}
                          className="fill-slate-400 font-mono text-[8px] font-bold uppercase tracking-tight"
                        >
                          {m.label}
                        </text>
                      );
                    })}
                  </svg>

                  {/* High Contrast Legends */}
                  <div className="flex gap-4 border-t border-slate-900/60 pt-2 w-full justify-center px-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      <span className="w-2.5 h-1.5 bg-emerald-500 rounded-sm inline-block" />
                      <span className="text-slate-200 font-bold">{districtAlpha} (A)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      <span className="w-2.5 h-1.5 bg-cyan-400 rounded-sm inline-block" />
                      <span className="text-slate-200 font-bold">{districtBeta} (B)</span>
                    </div>
                  </div>
                </div>

                {/* side-by-side exact delta computations table list */}
                <div className="space-y-1.5 text-[11px] font-mono bg-slate-950/30 border border-slate-900 rounded-xl p-3">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block border-b border-slate-900 pb-1.5 mb-2">Metrics comparison delta</span>
                  
                  {metricsAlpha.map((m, idx) => {
                    const valueB = metricsBeta[idx].val;
                    const delta = m.val - valueB;
                    let deltaColor = "text-slate-405";
                    let deltaSymbol = "±0";

                    if (delta > 0) {
                      deltaColor = "text-emerald-400";
                      deltaSymbol = `+${delta}`;
                    } else if (delta < 0) {
                      deltaColor = "text-rose-400";
                      deltaSymbol = `${delta}`;
                    }

                    return (
                      <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-950 last:border-0 pb-1">
                        <span className="text-slate-400">{m.label}:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">{m.val}%</span>
                          <span className="text-slate-600">vs</span>
                          <span className="text-cyan-400 font-bold">{valueB}%</span>
                          <span className={`${deltaColor} font-bold text-[10px] ml-1`}>({deltaSymbol}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reset to GIS indicators */}
              <div className="pt-3 border-t border-slate-900 flex justify-center">
                <button
                  onClick={() => setRightPanelTab("telemetry")}
                  className="text-[10px] text-slate-400 hover:text-emerald-400 font-mono flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Observe GIS Thematic Layers
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
