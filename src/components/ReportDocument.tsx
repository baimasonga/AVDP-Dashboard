import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AVDP_REPORT } from "../data/avdpReport";
import { Printer, X, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const R = AVDP_REPORT;
const money = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`);
const pct = (a: number, t: number) => (t > 0 ? Math.round((a / t) * 100) : 0);
const pctColor = (p: number) => (p >= 100 ? "#047857" : p >= 60 ? "#b45309" : "#b91c1c");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section" style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", borderBottom: "2px solid #10b981", paddingBottom: 4, marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}

const th: React.CSSProperties = { textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "#64748b", padding: "5px 8px", borderBottom: "1px solid #cbd5e1", fontWeight: 700 };
const td: React.CSSProperties = { fontSize: 11, color: "#1e293b", padding: "5px 8px", borderBottom: "1px solid #e2e8f0" };

export default function ReportDocument({ open, onClose }: Props) {
  useEffect(() => {
    const after = () => document.body.classList.remove("printing-report");
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, []);

  if (!open) return null;

  const handlePrint = () => {
    document.body.classList.add("printing-report");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-report"), 800);
  };

  const s = R.summary;
  const fin = R.financials;

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-auto bg-slate-900/85 print:bg-white">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#0f172a] border-b border-slate-700 px-4 py-2.5">
        <div className="flex items-center gap-2 text-slate-200 text-sm font-bold"><FileText className="w-4 h-4 text-emerald-400" /> AVDP Supervision Report — preview</div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"><Printer className="w-3.5 h-3.5" /> Print / Save as PDF</button>
          <button onClick={onClose} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg cursor-pointer"><X className="w-3.5 h-3.5" /> Close</button>
        </div>
      </div>

      {/* The printable document */}
      <div id="print-report-root" className="mx-auto my-6 print:my-0 bg-white text-slate-800 shadow-2xl" style={{ maxWidth: 840, padding: 40, fontFamily: "Inter, system-ui, sans-serif" }}>
        {/* Cover header */}
        <div style={{ borderBottom: "3px solid #0f172a", paddingBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Agricultural Value Chain Development Project (AVDP)</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Sierra Leone · {R.meta.title}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#64748b" }}>
              <div><strong>{R.meta.date}</strong></div>
              <div>{R.meta.venue}</div>
              <div style={{ marginTop: 4 }}>Generated {new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Executive summary */}
        <Section title="1 · Executive Summary">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
            {[
              { l: "Target households", v: s.households.toLocaleString() },
              { l: "Direct beneficiaries", v: `≈${s.beneficiaries.toLocaleString()}` },
              { l: "Women", v: `${s.womenPct}%` },
              { l: "Youth", v: `${s.youthPct}%` },
            ].map((k) => (
              <div key={k.l} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", color: "#64748b" }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{k.v}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#334155", margin: "4px 0" }}><strong>Goal:</strong> {s.goal}</p>
          <p style={{ fontSize: 11, color: "#334155", margin: "4px 0" }}><strong>Development objective:</strong> {s.objective}</p>
          <p style={{ fontSize: 11, color: "#334155", margin: "4px 0" }}><strong>Value chains:</strong> {s.valueChains.join(" · ")}</p>
        </Section>

        {/* Implementation progress */}
        <Section title="2 · Implementation Progress (cumulative achieved vs target)">
          {R.progress.map((g) => (
            <div key={g.id} style={{ marginBottom: 12 }} className="report-section">
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{g.title}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{g.summary}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Intervention</th><th style={{ ...th, textAlign: "right" }}>Achieved</th><th style={{ ...th, textAlign: "right" }}>Target</th><th style={{ ...th, textAlign: "right" }}>%</th></tr></thead>
                <tbody>
                  {g.rows.map((r) => {
                    const p = pct(r.achieved, r.totalTarget); const u = r.unit || g.unit;
                    return (
                      <tr key={r.label}>
                        <td style={td}>{r.label}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.achieved.toLocaleString()} {u}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.totalTarget.toLocaleString()} {u}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: pctColor(p) }}>{p}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </Section>

        {/* Production & sales */}
        <Section title="3 · Value Chain Production & Sales (MT)">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Value chain</th><th style={{ ...th, textAlign: "right" }}>2024</th><th style={{ ...th, textAlign: "right" }}>2025</th><th style={{ ...th, textAlign: "right" }}>2026</th><th style={th}>Partner</th></tr></thead>
            <tbody>
              {R.production.map((p) => (
                <tr key={p.valueChain}>
                  <td style={td}>{p.valueChain}</td>
                  <td style={{ ...td, textAlign: "right" }}>{p.p2024.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{p.p2025.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{p.p2026 == null ? "—" : p.p2026.toLocaleString()}</td>
                  <td style={{ ...td, fontSize: 10 }}>{p.partner}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>IVS rice yield: AVDP-supported {R.yields.rice.supported2025} Mt/ha vs non-supported {R.yields.rice.non2025} Mt/ha ({R.yields.rice.farms} farms). Oil palm {R.yields.others[1].value} Mt/ha · Cocoa {R.yields.others[2].value} Mt/ha.</p>
        </Section>

        {/* Outcomes */}
        <Section title="4 · Outcomes & Beneficiaries (2025 AOS)">
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {R.aos.map((a, i) => <li key={i} style={{ fontSize: 11, color: "#334155", marginBottom: 2 }}>{a}</li>)}
          </ul>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Jobs created by district ({R.jobsTotal})</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                {R.jobsByDistrict.map((j) => <tr key={j.district}><td style={td}>{j.district}</td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{j.jobs}</td></tr>)}
              </tbody></table>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>PwDA beneficiaries ({R.pwdaTotal})</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
                {R.pwdaByDistrict.slice(0, 9).map((p) => <tr key={p.district}><td style={td}>{p.district}</td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{p.count}</td></tr>)}
              </tbody></table>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", marginBottom: 4 }}>Targets under review (PMU requesting reduction)</div>
            {R.targetsUnderReview.map((t) => <p key={t.target} style={{ fontSize: 10, color: "#475569", margin: "2px 0" }}><strong>{t.target}:</strong> {t.achieved != null ? t.achieved.toLocaleString() : "—"} / {t.planned.toLocaleString()} {t.unit} — {t.note}</p>)}
          </div>
        </Section>

        {/* Finance */}
        <Section title="5 · Financial Performance & Disbursement (as at 31 May 2026)">
          <p style={{ fontSize: 11, color: "#334155", marginBottom: 8 }}>
            Project cost <strong>{money(fin.disbursement.grandTotal.cost)}</strong> · Total disbursed <strong style={{ color: "#047857" }}>{money(fin.disbursement.grandTotal.disbursed)} ({fin.disbursement.grandTotal.pct}%)</strong> · Balance {money(fin.disbursement.grandTotal.balance)}.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
            <thead><tr><th style={th}>Funding source</th><th style={{ ...th, textAlign: "right" }}>Cost</th><th style={{ ...th, textAlign: "right" }}>Disbursed</th><th style={{ ...th, textAlign: "right" }}>%</th><th style={{ ...th, textAlign: "right" }}>Balance</th></tr></thead>
            <tbody>
              {fin.disbursement.bySource.map((b) => (
                <tr key={b.source}>
                  <td style={td}>{b.source}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(b.cost)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{money(b.disbursed)}</td>
                  <td style={{ ...td, textAlign: "right", color: pctColor(b.pct) }}>{b.pct}%</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(b.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>FY2026 budget execution by component (Jan–May)</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Component</th><th style={{ ...th, textAlign: "right" }}>Budget</th><th style={{ ...th, textAlign: "right" }}>Expenditure</th><th style={{ ...th, textAlign: "right" }}>Exec %</th></tr></thead>
            <tbody>
              {fin.fy2026.byComponent.map((c) => (
                <tr key={c.name}><td style={td}>{c.name}</td><td style={{ ...td, textAlign: "right" }}>{money(c.jmBudget)}</td><td style={{ ...td, textAlign: "right" }}>{money(c.jmExp)}</td><td style={{ ...td, textAlign: "right", fontWeight: 700, color: pctColor(c.jmExec) }}>{c.jmExec}%</td></tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Challenges */}
        <Section title="6 · Field Challenges & Recommendations">
          {R.challenges.map((c) => (
            <div key={c.category} style={{ marginBottom: 8 }} className="report-section">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{c.category}</div>
              <div style={{ fontSize: 10, color: "#b45309" }}>Challenges: {c.challenges.join("; ")}.</div>
              <div style={{ fontSize: 10, color: "#047857" }}>Recommendations: {c.recommendations.join("; ")}.</div>
            </div>
          ))}
        </Section>

        <div style={{ marginTop: 24, paddingTop: 10, borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
          AVDP Monitoring & Evaluation Platform · IFAD & Ministry of Agriculture of Sierra Leone · Source: AVDP Supervision Mission deck ({R.meta.date})
        </div>
      </div>
    </div>,
    document.body
  );
}
