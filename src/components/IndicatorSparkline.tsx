import React, { useMemo, useState } from "react";
import { Indicator } from "../types";
import * as d3 from "d3";

interface IndicatorSparklineProps {
  item: Indicator;
  width?: number;
  height?: number;
  isLowBandwidth?: boolean;
}

export default function IndicatorSparkline({
  item,
  width = 120,
  height = 36,
  isLowBandwidth = false
}: IndicatorSparklineProps) {
  // Safe margins for the sparkline path
  const padding = { top: 4, right: 6, bottom: 4, left: 6 };

  // Calculate 30-day trend deterministically
  const trendData = useMemo(() => {
    const finalVal = item.Progress;
    // Extract a numeric seed from the ID for distinct organic variations
    const seed = item.IndicatorID.split("-")[1] 
      ? parseInt(item.IndicatorID.split("-")[1].replace(/\D/g, "")) || 0
      : 0;

    const count = 30;
    const startVal = finalVal * (0.65 + (seed % 20) / 100); 

    return Array.from({ length: count }, (_, i) => {
      const ratio = i / (count - 1); // 0 to 1
      // Add a stable, wavy noise pattern in the middle of progression
      const sineNoise = Math.sin((i + seed) * 0.4) * (2 + (seed % 4));
      const baseValue = startVal + (finalVal - startVal) * ratio;
      // Zero noise at both ends to ensure exact starting and current values
      const noiseFactor = Math.sin(ratio * Math.PI); 
      const value = baseValue + sineNoise * noiseFactor;
      
      return {
        day: i,
        value: parseFloat(value.toFixed(1))
      };
    });
  }, [item.Progress, item.IndicatorID]);

  // Handle active interactive index on hover
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Status mapping
  const strokeColor = useMemo(() => {
    if (item.Status === "Critical") return "#ef4444"; // red-500
    if (item.Status === "Need Attention") return "#f59e0b"; // amber-500
    return "#10b981"; // emerald-500
  }, [item.Status]);

  const gradientId = `spark-gradient-${item.IndicatorID}`;

  // Process coordinates with D3
  const { pathData, areaData, points, xScale, yScale } = useMemo(() => {
    const minVal = Math.min(...trendData.map(d => d.value));
    const maxVal = Math.max(...trendData.map(d => d.value));

    // Build the D3 Scales
    const xScale = d3.scaleLinear()
      .domain([0, 29])
      .range([padding.left, width - padding.right]);

    const yScale = d3.scaleLinear()
      .domain([Math.min(minVal * 0.9, maxVal * 0.5), maxVal * 1.05])
      .range([height - padding.bottom, padding.top]);

    // Build line generator
    const lineGenerator = d3.line<{ day: number; value: number }>()
      .x(d => xScale(d.day))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX); // Smooth interpolation curve

    // Build area generator for shaded region under the path
    const areaGenerator = d3.area<{ day: number; value: number }>()
      .x(d => xScale(d.day))
      .y0(height - padding.bottom)
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const pathData = lineGenerator(trendData) || "";
    const areaData = areaGenerator(trendData) || "";

    const points = trendData.map(d => ({
      x: xScale(d.day),
      y: yScale(d.value),
      day: d.day,
      value: d.value
    }));

    return { pathData, areaData, points, xScale, yScale };
  }, [trendData, width, height, padding.left, padding.right, padding.top, padding.bottom]);

  const latestPoint = points[points.length - 1];

  // Mouse interactivity to detect closest point on the sparkline
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    
    // Find closest day index (0 to 29) based on mouse X coordinate
    const dayFloat = xScale.invert(mouseX);
    const day = Math.min(29, Math.max(0, Math.round(dayFloat)));
    setHoverIndex(day);
  };

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="flex items-center gap-1.5" id={`sparkline-holder-${item.IndicatorID}`}>
      <div className="relative group/spark inline-block">
        <svg
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          className="overflow-visible select-none cursor-crosshair"
          id={`sparkline-svg-${item.IndicatorID}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Area under curve - skip for ultra low bandwidth */}
          {!isLowBandwidth && (
            <path
              d={areaData}
              fill={`url(#${gradientId})`}
              className="transition-all duration-300 pointer-events-none"
            />
          )}

          {/* Sparkline Path Line */}
          <path
            d={pathData}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300 pointer-events-none"
          />

          {/* Pulse animation dot at the latest point (Day 29) */}
          {latestPoint && !isLowBandwidth && (
            <>
              <circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r={3.5}
                fill={strokeColor}
                className="pointer-events-none"
              />
              <circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r={6}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.2}
                className="animate-ping opacity-60 pointer-events-none"
              />
            </>
          )}

          {/* User Interactivity Indicator Dot */}
          {activePoint && (
            <g className="pointer-events-none">
              {/* Highlight helper line (Vertical grid cross) */}
              <line
                x1={activePoint.x}
                y1={padding.top}
                x2={activePoint.x}
                y2={height - padding.bottom}
                stroke="#475569"
                strokeWidth={0.8}
                strokeDasharray="2,2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={4}
                fill={strokeColor}
                stroke="#ffffff"
                strokeWidth={1}
                className="shadow-sm"
              />
            </g>
          )}
        </svg>

        {/* Floating miniature tooltip directly above or below sparkline container */}
        <div 
          className={`absolute ${
            activePoint ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          } transition-all duration-150 z-30 bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-950/85 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] font-mono whitespace-nowrap text-slate-100 shadow-md`}
        >
          {activePoint ? (
            <span className="flex items-center gap-1.5">
              <span>Day {activePoint.day + 1}:</span>
              <span className="font-bold" style={{ color: strokeColor }}>
                {activePoint.value}%
              </span>
            </span>
          ) : (
            <span>Trend View</span>
          )}
        </div>
      </div>

      <div className="hidden sm:flex flex-col text-[10px] text-left leading-normal justify-center min-w-[28px] font-mono text-slate-500">
        <span className="text-[8px] font-mono text-slate-600 block uppercase leading-none">Day 1</span>
        <span>{trendData[0].value.toFixed(0)}%</span>
      </div>
      <div className="text-slate-700 font-mono text-[9px] select-none">&bull;</div>
      <div className="hidden sm:flex flex-col text-[10px] text-left leading-normal justify-center min-w-[28px] font-mono">
        <span className="text-[8px] color-slate-600 font-mono text-slate-600 block uppercase leading-none">Day 30</span>
        <span className="font-bold" style={{ color: strokeColor }}>{item.Progress}%</span>
      </div>
    </div>
  );
}
