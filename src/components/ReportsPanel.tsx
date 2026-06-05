import React, { useEffect, useState } from "react";
import { User, UserRole } from "../types";
import { getReports, generateReportNow, MEReport } from "../lib/db";
import { FileBarChart, RefreshCw, Download, Calendar, Clock } from "lucide-react";

interface Props {
  currentUser: User | null;
}

// Scheduled / on-demand national M&E digests (generated server-side by pg_cron).
export default function ReportsPanel({ currentUser }: Props) {
  const [reports, setReports] = useState<MEReport[]>([]);
  const [active, setActive] = useState<MEReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await getReports();
      setReports(r);
      setActive((prev) => prev ?? r[0] ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateReportNow(currentUser);
      setActive(null);
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadActive = () => {
    if (!active) return;
    const blob = new Blob([active.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.title.replace(/[^a-z0-9]+/gi, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm mt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Scheduled M&E Reports</h3>
          <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" /> Daily 06:00 UTC
          </span>
        </div>
        {currentUser?.role === UserRole.ADMIN && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-[11px] bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/30 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Generating…" : "Generate now"}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-500/40 text-red-300 p-2.5 rounded-lg text-[11px] mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-500 text-xs font-mono animate-pulse">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs font-mono">No reports generated yet.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* report list */}
          <div className="lg:col-span-4 space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  active?.id === r.id
                    ? "bg-emerald-950/20 border-emerald-500/30"
                    : "bg-slate-950/30 border-slate-900 hover:border-slate-800"
                }`}
              >
                <div className="text-xs font-bold text-slate-200">{r.title}</div>
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(r.generatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="flex gap-2 mt-1.5 text-[9px] font-mono">
                  <span className="text-red-400">{r.summary?.critical ?? 0} critical</span>
                  <span className="text-emerald-400">{r.summary?.avg_progress ?? 0}% avg</span>
                </div>
              </button>
            ))}
          </div>

          {/* active report detail */}
          <div className="lg:col-span-8 bg-slate-950/40 border border-slate-900 rounded-xl p-4">
            {active && (
              <>
                <div className="flex justify-between items-start gap-3 mb-3">
                  <h4 className="text-xs font-bold text-slate-100">{active.title}</h4>
                  <button
                    onClick={downloadActive}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Download className="w-3 h-3" /> .md
                  </button>
                </div>

                {/* headline KPI grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { l: "Total", v: active.summary?.total, c: "text-slate-200" },
                    { l: "On track", v: active.summary?.on_track, c: "text-emerald-400" },
                    { l: "Critical", v: active.summary?.critical, c: "text-red-400" },
                    { l: "Avg progress", v: `${active.summary?.avg_progress ?? 0}%`, c: "text-teal-400" },
                  ].map((k) => (
                    <div key={k.l} className="bg-slate-900/50 border border-slate-900 rounded-lg p-2.5">
                      <div className="text-[9px] font-mono uppercase text-slate-500">{k.l}</div>
                      <div className={`text-lg font-bold font-mono ${k.c}`}>{k.v ?? 0}</div>
                    </div>
                  ))}
                </div>

                {/* per-district table */}
                {Array.isArray(active.summary?.regions) && (
                  <div className="max-h-44 overflow-y-auto border border-slate-900 rounded-lg">
                    <table className="w-full text-[11px] font-mono">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0">
                        <tr>
                          <th className="text-left py-1.5 px-3 font-semibold">District</th>
                          <th className="text-right py-1.5 px-3 font-semibold">Avg progress</th>
                          <th className="text-right py-1.5 px-3 font-semibold">Critical</th>
                        </tr>
                      </thead>
                      <tbody>
                        {active.summary.regions.map((reg: any) => (
                          <tr key={reg.district} className="border-t border-slate-900 text-slate-300">
                            <td className="py-1.5 px-3">{reg.district}</td>
                            <td className="py-1.5 px-3 text-right">{reg.avg_progress}%</td>
                            <td className={`py-1.5 px-3 text-right ${reg.critical > 0 ? "text-red-400 font-bold" : "text-slate-500"}`}>
                              {reg.critical}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
