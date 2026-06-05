import React, { useEffect, useState } from "react";
import { Indicator, IndicatorHistoryPoint } from "../types";
import { getIndicatorHistory } from "../lib/db";
import { History, X, TrendingUp, Clock } from "lucide-react";

interface Props {
  indicator: Indicator;
  onClose: () => void;
}

// Drill-down chart of an indicator's real progress history (from indicator_history).
export default function IndicatorHistoryModal({ indicator, onClose }: Props) {
  const [points, setPoints] = useState<IndicatorHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getIndicatorHistory(indicator.IndicatorID)
      .then((p) => active && setPoints(p))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [indicator.IndicatorID]);

  // Build an SVG polyline of progress% over time.
  const W = 560;
  const H = 200;
  const padX = 44;
  const padY = 24;
  const vals = points.map((p) => p.progress);
  const maxV = Math.max(130, ...vals) * 1.1;
  const minV = Math.min(80, ...vals, 100) * 0.9;
  const x = (i: number) =>
    points.length <= 1 ? padX : padX + (i * (W - padX - 16)) / (points.length - 1);
  const y = (v: number) => H - padY - ((v - minV) / (maxV - minV)) * (H - padY - 16);
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.progress).toFixed(1)}`)
    .join(" ");
  const targetPctLine = indicator.Target && indicator.BaselineValue > 0
    ? (indicator.Target / indicator.BaselineValue) * 100
    : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] rounded-2xl w-full max-w-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Progress History — {indicator.IndicatorID}
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">
                {indicator.IndicatorName} · {indicator.District} · {indicator.Commodity}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {loading && (
            <div className="text-center py-12 text-slate-500 text-xs font-mono animate-pulse">
              Loading historical snapshots…
            </div>
          )}
          {error && (
            <div className="text-center py-12 text-red-400 text-xs font-mono">{error}</div>
          )}

          {!loading && !error && points.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              No history recorded yet. History is captured on every future edit.
            </div>
          )}

          {!loading && !error && points.length > 0 && (
            <>
              <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3 overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]">
                  {/* gridlines */}
                  {Array.from({ length: 4 }).map((_, i) => {
                    const v = minV + (i * (maxV - minV)) / 3;
                    return (
                      <g key={i}>
                        <line x1={padX} y1={y(v)} x2={W - 16} y2={y(v)} stroke="#1e293b" strokeWidth="0.8" />
                        <text x={padX - 6} y={y(v) + 3} textAnchor="end" className="fill-slate-500 font-mono text-[9px]">
                          {Math.round(v)}%
                        </text>
                      </g>
                    );
                  })}
                  {/* 100% baseline reference */}
                  <line x1={padX} y1={y(100)} x2={W - 16} y2={y(100)} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                  {/* target reference */}
                  {targetPctLine && (
                    <line x1={padX} y1={y(targetPctLine)} x2={W - 16} y2={y(targetPctLine)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="5 3" />
                  )}
                  {/* progress line */}
                  <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {points.map((p, i) => (
                    <circle key={i} cx={x(i)} cy={y(p.progress)} r="3.5" fill="#022c22" stroke="#10b981" strokeWidth="2" />
                  ))}
                </svg>
              </div>

              <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Progress %</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-500 inline-block" /> 100% baseline</span>
                {targetPctLine && (
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> Target ({Math.round(targetPctLine)}%)</span>
                )}
              </div>

              {/* recent entries table */}
              <div className="mt-4 max-h-40 overflow-y-auto border border-slate-900 rounded-lg">
                <table className="w-full text-[11px] font-mono">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="text-left py-1.5 px-3 font-semibold"><Clock className="w-3 h-3 inline mr-1" />When</th>
                      <th className="text-right py-1.5 px-3 font-semibold">Baseline</th>
                      <th className="text-right py-1.5 px-3 font-semibold">Achieved</th>
                      <th className="text-right py-1.5 px-3 font-semibold"><TrendingUp className="w-3 h-3 inline mr-1" />Progress</th>
                      <th className="text-left py-1.5 px-3 font-semibold">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p, i) => (
                      <tr key={i} className="border-t border-slate-900 text-slate-300">
                        <td className="py-1.5 px-3">{new Date(p.recordedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-1.5 px-3 text-right text-slate-400">{p.baseline}</td>
                        <td className="py-1.5 px-3 text-right">{p.achieved}</td>
                        <td className="py-1.5 px-3 text-right font-bold">{p.progress}%</td>
                        <td className="py-1.5 px-3 text-slate-500 truncate max-w-[140px]">{p.changedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
