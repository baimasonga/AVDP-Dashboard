import React, { useState } from "react";
import { ThresholdAlert, Indicator, User } from "../types";
import { Mail, AlertTriangle, Plus, BellRing, Sparkles, Send, CheckCircle2, UserCheck, ShieldClose, Pause, Play, Trash2 } from "lucide-react";

interface AlertManagerProps {
  alerts: ThresholdAlert[];
  indicators: Indicator[];
  currentUser: User | null;
  onCreateAlertRule: (rule: Partial<ThresholdAlert>) => Promise<void>;
  onTriggerAlertDispatch: (id: string) => Promise<void>;
  onToggleAlert: (id: string, enabled: boolean) => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
  isLowBandwidth: boolean;
}

export default function AlertManager({
  alerts,
  indicators,
  currentUser,
  onCreateAlertRule,
  onTriggerAlertDispatch,
  onToggleAlert,
  onDeleteAlert,
  isLowBandwidth
}: AlertManagerProps) {
  // Subscribers parameters
  const [targetIndicatorId, setTargetIndicatorId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [thresholdVal, setThresholdVal] = useState<number>(110);
  const [condition, setCondition] = useState<"below" | "above">("below");

  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dispatchLoadingMap, setDispatchLoadingMap] = useState<Record<string, boolean>>({});

  // Lookup indicator name for display
  const targetIndicatorName = indicators.find(i => i.IndicatorID === targetIndicatorId)?.IndicatorName || "N/A";

  const handleSubmitRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!targetIndicatorId) {
      setFormError("Please select a target indicator index ID.");
      return;
    }
    if (!recipientEmail || !recipientEmail.includes("@")) {
      setFormError("Please state a valid recipient email address.");
      return;
    }

    try {
      await onCreateAlertRule({
        indicatorId: targetIndicatorId,
        recipientEmail,
        thresholdValue: thresholdVal,
        condition
      });
      setFormSuccess("Custom threshold alarm successfully registered! Live checking initiated.");
      setTargetIndicatorId("");
      setRecipientEmail("");
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err.message || "Failed to submit subscription.");
    }
  };

  const handleDispatchSimulation = async (id: string) => {
    setDispatchLoadingMap(prev => ({ ...prev, [id]: true }));
    try {
      await onTriggerAlertDispatch(id);
      // Wait small time for tactile realism
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err) {
      console.error(err);
    } finally {
      setDispatchLoadingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm relative" id="alert-manager-component-root">
      
      {/* Alert Header */}
      <div className="border-b border-slate-800 pb-4 mb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-400" />
            AVDP Automated Threshold Alerts & Mail Gateway
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure dynamic warning subscriptions that send real-time situational brief summaries when crop parameters deviate from goals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column: Subscribe Threshold Form */}
        <div className="lg:col-span-5 bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <form onSubmit={handleSubmitRule} className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase border-b border-slate-900 pb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Subscribe Email Notification Rule
            </div>

            {formError && (
              <div className="bg-red-950/20 border border-red-500/40 text-red-300 p-2.5 rounded-lg text-[11px]">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 p-2.5 rounded-lg text-[11px] font-semibold">
                {formSuccess}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                Focal Target Indicator (ID)
              </label>
              <select
                value={targetIndicatorId}
                onChange={(e) => setTargetIndicatorId(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="">Select ID...</option>
                {indicators.slice(0, 40).map(i => (
                  <option key={i.IndicatorID} value={i.IndicatorID}>
                    {i.IndicatorID} - {i.IndicatorName.slice(0, 22)}... ({i.District})
                  </option>
                ))}
              </select>
              {targetIndicatorId && (
                <div className="text-[10px] text-slate-500 mt-1 font-medium font-mono">
                  Full category: {targetIndicatorName}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                  Trigger Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as "below" | "above")}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-medium"
                >
                  <option value="below">Falls Below (&lt;)</option>
                  <option value="above">Exceeds (&gt;)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                  Threshold Progress %
                </label>
                <input
                  type="number"
                  value={thresholdVal}
                  onChange={(e) => setThresholdVal(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 110"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1 font-semibold">
                Officer Email to Alert
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="officer.moyamba@avdp.org.sl"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2 rounded-lg text-xs tracking-wider uppercase transition-all shadow-md shadow-emerald-950/20 cursor-pointer"
            >
              Commit Threshold Monitor
            </button>
          </form>

          <p className="text-[10px] text-slate-500 leading-normal mt-3.5 border-t border-slate-900 pt-2.5">
            Note: Threshold alerts process asynchronously inside the Express container daemon. Upon trigger satisfaction, automated headers configure transactional emails sent directly to designated focal point.
          </p>
        </div>

        {/* Right column: Dynamic Alerts Log Feed */}
        <div className="lg:col-span-7 bg-[#070b13]/45 border border-slate-900 p-4 rounded-xl">
          <div className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase mb-3 flex items-center justify-between border-b border-slate-900 pb-2">
            <span>Critical Alarm triggers Queue ({alerts.length})</span>
            <span className="text-[10px] text-slate-500 normal-case font-normal">Mail status: Verified</span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const isLoading = dispatchLoadingMap[alert.id] || false;
              return (
                <div 
                  key={alert.id}
                  className={`border p-3 rounded-lg text-xs relative flex flex-col md:flex-row justify-between md:items-center gap-3 transition-all ${
                    alert.status === "Sent" 
                      ? "border-emerald-500/20 bg-emerald-950/[0.04]" 
                      : "border-slate-800 bg-slate-950/20"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-200">
                      <span className="text-amber-500 bg-amber-950/30 px-1 py-0.5 rounded font-mono text-[9px]">
                        {alert.indicatorId}
                      </span>
                      <span>{alert.indicatorName} alert</span>
                    </div>
                    
                    <div className="text-slate-400 text-[11px] leading-relaxed font-mono">
                      Target: {alert.district} &bull; Alert if progress {alert.condition === "below" ? "<" : ">"} {alert.thresholdValue}%
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-600" />
                      <span>To: &lt;{alert.recipientEmail}&gt;</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 md:flex-col justify-between align-end">
                    {!alert.enabled ? (
                      <span className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1 border border-slate-600/30 bg-slate-800/40 px-2 py-0.5 rounded uppercase">
                        <Pause className="w-3.5 h-3.5" />
                        Paused
                      </span>
                    ) : alert.status === "Sent" ? (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1 border border-emerald-500/20 bg-emerald-950/30 px-2 py-0.5 rounded uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Dispatched
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1 border border-amber-500/20 bg-amber-950/30 px-2 py-0.5 rounded uppercase">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Armed / Idle
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDispatchSimulation(alert.id)}
                        disabled={isLoading || !alert.enabled}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700/60 font-mono py-1 px-2.5 rounded text-slate-300 font-medium cursor-pointer flex items-center gap-1 text-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Run simulated dispatch testing"
                      >
                        <Send className="w-2.5 h-2.5" />
                        {isLoading ? "Sending..." : "Test"}
                      </button>

                      {currentUser && (
                        <>
                          <button
                            onClick={() => onToggleAlert(alert.id, !alert.enabled)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700/60 p-1.5 rounded text-slate-300 cursor-pointer"
                            title={alert.enabled ? "Pause this alert rule" : "Resume this alert rule"}
                          >
                            {alert.enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => onDeleteAlert(alert.id)}
                            className="text-[10px] bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 p-1.5 rounded text-red-300 cursor-pointer"
                            title="Delete this alert rule"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {alerts.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                No threat triggers listed in monitor database.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
