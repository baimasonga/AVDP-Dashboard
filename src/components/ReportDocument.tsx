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

// McKinsey-style palette + type
const NAVY = "#051C2C";
const STEEL = "#2E4D6B";
const ACCENT = "#00A9CE";
const INK = "#1A2733";
const MUTE = "#6B7B8A";
const RULE = "#E2E7EC";
const SERIF = "'Georgia', 'Times New Roman', serif";

const th: React.CSSProperties = { textAlign: "left", fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.6, color: MUTE, padding: "5px 8px", borderBottom: `1.5px solid ${NAVY}`, fontWeight: 700 };
const td: React.CSSProperties = { fontSize: 10.5, color: INK, padding: "5px 8px", borderBottom: `1px solid ${RULE}` };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function Bar({ value, color = STEEL }: { value: number; color?: string }) {
  return (
    <div style={{ background: "#EEF1F4", height: 7, borderRadius: 1, width: "100%" }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: "100%", background: color, borderRadius: 1 }} />
    </div>
  );
}

function Exhibit({ kicker, title, source, children }: { kicker: string; title: string; source?: string; children: React.ReactNode }) {
  return (
    <section className="report-section" style={{ marginTop: 30 }}>
      <div style={{ fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase", color: ACCENT, fontWeight: 700 }}>{kicker}</div>
      <h2 style={{ fontFamily: SERIF, fontSize: 15.5, fontWeight: 700, color: NAVY, margin: "3px 0 9px", lineHeight: 1.3 }}>{title}</h2>
      <div style={{ height: 2, width: 40, background: NAVY, marginBottom: 14 }} />
      {children}
      {source && <div style={{ fontSize: 8.5, fontStyle: "italic", color: MUTE, marginTop: 9 }}>Source: {source}</div>}
    </section>
  );
}

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
  const g = fin.disbursement.grandTotal;

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-auto bg-slate-900/85 print:bg-white">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#051C2C] border-b border-slate-700 px-4 py-2.5">
        <div className="flex items-center gap-2 text-slate-100 text-sm font-bold"><FileText className="w-4 h-4" style={{ color: ACCENT }} /> AVDP Supervision Report — preview</div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: ACCENT }}><Printer className="w-3.5 h-3.5" /> Print / Save as PDF</button>
          <button onClick={onClose} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg cursor-pointer"><X className="w-3.5 h-3.5" /> Close</button>
        </div>
      </div>

      {/* Printable document */}
      <div id="print-report-root" className="mx-auto my-6 print:my-0 bg-white shadow-2xl" style={{ maxWidth: 860, fontFamily: "Inter, system-ui, sans-serif", color: INK }}>
        {/* Cover band */}
        <div style={{ background: NAVY, color: "white", padding: "34px 44px 26px" }}>
          <div style={{ height: 3, width: 56, background: ACCENT, marginBottom: 16 }} />
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#9FB3C2" }}>IFAD Supervision Mission · Progress Report</div>
          <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 700, lineHeight: 1.15, marginTop: 8 }}>Agricultural Value Chain<br />Development Project — Sierra Leone</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, fontSize: 10.5, color: "#B9C7D2" }}>
            <span>{R.meta.venue}</span>
            <span><strong style={{ color: "white" }}>{R.meta.date}</strong> · generated {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <div style={{ padding: "8px 44px 40px" }}>
          {/* Executive summary */}
          <Exhibit kicker="Project at a glance" title="AVDP is reaching 43,000 households — 40% women and 40% youth — across four value chains" source={`AVDP Supervision Mission, ${R.meta.date}`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, border: `1px solid ${RULE}`, borderRadius: 4, overflow: "hidden" }}>
              {[
                { l: "Target households", v: s.households.toLocaleString() },
                { l: "Direct beneficiaries", v: `≈${(s.beneficiaries / 1000).toFixed(0)}k` },
                { l: "Women", v: `${s.womenPct}%` },
                { l: "Youth", v: `${s.youthPct}%` },
              ].map((k, i) => (
                <div key={k.l} style={{ padding: "12px 14px", borderLeft: i ? `1px solid ${RULE}` : "none" }}>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5, color: MUTE }}>{k.l}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: NAVY }}>{k.v}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: "#33424F", margin: "12px 0 2px", lineHeight: 1.55 }}><strong style={{ color: NAVY }}>Goal.</strong> {s.goal}</p>
            <p style={{ fontSize: 10.5, color: "#33424F", margin: "2px 0", lineHeight: 1.55 }}><strong style={{ color: NAVY }}>Objective.</strong> {s.objective} <strong style={{ color: NAVY }}>Value chains:</strong> {s.valueChains.join(" · ")}.</p>
          </Exhibit>

          {/* Implementation */}
          <Exhibit kicker="Exhibit 1 · Implementation progress" title="Field delivery is largely on track — 851 of 936 FFS and 401 of 420 km of roads complete; cocoa out-planting is the main lag" source={`Component progress tables, ${R.meta.date}`}>
            {R.progress.map((grp) => (
              <div key={grp.id} className="report-section" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>{grp.title}</div>
                <div style={{ fontSize: 9.5, color: MUTE, marginBottom: 4 }}>{grp.summary}</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>Intervention</th><th style={{ ...th, textAlign: "right" }}>Achieved</th><th style={{ ...th, textAlign: "right" }}>Target</th><th style={{ ...th, width: 120 }}>Completion</th></tr></thead>
                  <tbody>
                    {grp.rows.map((r) => {
                      const p = pct(r.achieved, r.totalTarget); const u = r.unit || grp.unit;
                      return (
                        <tr key={r.label}>
                          <td style={td}>{r.label}</td>
                          <td style={tdNum}>{r.achieved.toLocaleString()} {u}</td>
                          <td style={tdNum}>{r.totalTarget.toLocaleString()} {u}</td>
                          <td style={td}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Bar value={p} color={p >= 100 ? ACCENT : STEEL} />
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: NAVY, width: 30, textAlign: "right" }}>{p}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </Exhibit>

          {/* Production */}
          <Exhibit kicker="Exhibit 2 · Production & sales" title="Production is rising year-on-year; AVDP-supported rice farms out-yield non-supported farms by ~47%" source={`Value-chain production & sales; 2025 yield studies (${R.yields.rice.farms} rice farms)`}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Value chain</th><th style={{ ...th, textAlign: "right" }}>2024 (MT)</th><th style={{ ...th, textAlign: "right" }}>2025 (MT)</th><th style={{ ...th, textAlign: "right" }}>2026 (MT)</th><th style={th}>Off-taker</th></tr></thead>
              <tbody>
                {R.production.map((p) => (
                  <tr key={p.valueChain}>
                    <td style={td}>{p.valueChain}</td>
                    <td style={tdNum}>{p.p2024.toLocaleString()}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: NAVY }}>{p.p2025.toLocaleString()}</td>
                    <td style={tdNum}>{p.p2026 == null ? "—" : p.p2026.toLocaleString()}</td>
                    <td style={{ ...td, fontSize: 9.5, color: MUTE }}>{p.partner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 9.5, color: "#33424F", marginTop: 7 }}>IVS rice yield rose to <strong>{R.yields.rice.supported2025} Mt/ha</strong> on supported farms (vs {R.yields.rice.non2025} on non-supported); oil palm {R.yields.others[1].value} Mt/ha; cocoa {R.yields.others[2].value} Mt/ha.</p>
          </Exhibit>

          {/* Outcomes */}
          <Exhibit kicker="Exhibit 3 · Outcomes & beneficiaries" title="Adoption and empowerment are high; the employment and water-supply targets require revision" source={`2025 Annual Outcome Survey; M&E beneficiary profiling`}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
              <ul style={{ margin: 0, paddingLeft: 15 }}>
                {R.aos.slice(0, 6).map((a, i) => <li key={i} style={{ fontSize: 10, color: "#33424F", marginBottom: 3, lineHeight: 1.4 }}>{a}</li>)}
              </ul>
              <div>
                <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5, color: MUTE, marginBottom: 3 }}>Jobs created — top districts ({R.jobsTotal} total)</div>
                {R.jobsByDistrict.slice(0, 6).map((j) => {
                  const max = R.jobsByDistrict[0].jobs;
                  return (
                    <div key={j.district} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9.5, color: INK, width: 78 }}>{j.district}</span>
                      <Bar value={(j.jobs / max) * 100} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: NAVY, width: 26, textAlign: "right" }}>{j.jobs}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ borderLeft: `3px solid ${ACCENT}`, background: "#F4F8FA", padding: "8px 12px", marginTop: 12 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, color: NAVY, fontWeight: 700, marginBottom: 3 }}>Targets under review (PMU requesting reduction)</div>
              {R.targetsUnderReview.map((t) => <p key={t.target} style={{ fontSize: 9.5, color: "#33424F", margin: "2px 0" }}><strong>{t.target}:</strong> {t.achieved != null ? t.achieved.toLocaleString() : "—"} / {t.planned.toLocaleString()} {t.unit} — {t.note}</p>)}
            </div>
          </Exhibit>

          {/* Finance */}
          <Exhibit kicker="Exhibit 4 · Financial performance" title={`80.4% of the $83.4M financing envelope is disbursed; FY2026 execution is early at 52.7% year-to-date`} source={`Disbursement as at ${fin.asOf}; FY2025 actuals; FY2026 Jan–May`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, border: `1px solid ${RULE}`, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
              {[
                { l: "Project cost", v: money(g.cost) },
                { l: "Total disbursed", v: `${money(g.disbursed)} · ${g.pct}%` },
                { l: "Balance", v: money(g.balance) },
              ].map((k, i) => (
                <div key={k.l} style={{ padding: "10px 14px", borderLeft: i ? `1px solid ${RULE}` : "none" }}>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", color: MUTE }}>{k.l}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: NAVY }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.5, color: MUTE, marginBottom: 4 }}>Disbursement by funding source</div>
            {fin.disbursement.bySource.map((b) => (
              <div key={b.source} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 9.5, color: INK, width: 150 }}>{b.source}</span>
                <Bar value={b.pct} color={b.pct >= 75 ? ACCENT : STEEL} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: NAVY, width: 92, textAlign: "right" }}>{money(b.disbursed)} · {b.pct}%</span>
              </div>
            ))}
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead><tr><th style={th}>FY2026 by component (Jan–May)</th><th style={{ ...th, textAlign: "right" }}>Budget</th><th style={{ ...th, textAlign: "right" }}>Expenditure</th><th style={{ ...th, textAlign: "right" }}>Exec</th></tr></thead>
              <tbody>
                {fin.fy2026.byComponent.map((c) => (
                  <tr key={c.name}><td style={td}>{c.name}</td><td style={tdNum}>{money(c.jmBudget)}</td><td style={tdNum}>{money(c.jmExp)}</td><td style={{ ...tdNum, fontWeight: 700, color: NAVY }}>{c.jmExec}%</td></tr>
                ))}
              </tbody>
            </table>
          </Exhibit>

          {/* Challenges */}
          <Exhibit kicker="Exhibit 5 · Challenges & recommendations" title="Logistics, climate, market access and sustainability are the binding constraints — with clear mitigations">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, width: "22%" }}>Theme</th><th style={th}>Challenges</th><th style={th}>Recommendations</th></tr></thead>
              <tbody>
                {R.challenges.map((c) => (
                  <tr key={c.category}>
                    <td style={{ ...td, fontWeight: 700, color: NAVY, verticalAlign: "top" }}>{c.category}</td>
                    <td style={{ ...td, fontSize: 9.5, verticalAlign: "top" }}>{c.challenges.join("; ")}</td>
                    <td style={{ ...td, fontSize: 9.5, verticalAlign: "top", color: "#1B5E4B" }}>{c.recommendations.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Exhibit>

          <div style={{ marginTop: 26, paddingTop: 10, borderTop: `2px solid ${NAVY}`, fontSize: 8.5, color: MUTE, display: "flex", justifyContent: "space-between" }}>
            <span>AVDP Monitoring &amp; Evaluation Platform · IFAD &amp; Ministry of Agriculture and Food Security, Sierra Leone</span>
            <span>Source: AVDP Supervision Mission deck, {R.meta.date}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
