import React, { useState, useEffect } from "react";
import { User, UserRole, Indicator, ThresholdAlert, SyncStatus } from "./types";
import { getEnrichedIndicators } from "./data";
import { supabase } from "./lib/supabase";
import * as db from "./lib/db";
import { getQueue, enqueue, removeFromQueue } from "./lib/offlineQueue";
import AuthModal from "./components/AuthModal";
import MapSection from "./components/MapSection";
import IndicatorTable from "./components/IndicatorTable";
import AlertManager from "./components/AlertManager";
import AdviserChat from "./components/AdviserChat";
import SurveyRegistry from "./components/SurveyRegistry";
import ExecutiveAnalytics from "./components/ExecutiveAnalytics";
import YieldForecasting from "./components/YieldForecasting";
import MarketInformation from "./components/MarketInformation";
import CropCalendar from "./components/CropCalendar";
import ProactiveInsights from "./components/ProactiveInsights";
import GenderAnalytics from "./components/GenderAnalytics";
import ReportsPanel from "./components/ReportsPanel";
import {
  Building2, Globe, Shield, RefreshCw, Radio, HardDrive,
  Wifi, WifiOff, FileSpreadsheet, Layers, Bell, Bot, History,
  Info, TrendingUp, Sparkles, Sliders, LogIn, ChevronRight, AlertTriangle
} from "lucide-react";

export default function App() {
  // Session Access Rules
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Core Data Visualizations Metrics States
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [alerts, setAlerts] = useState<ThresholdAlert[]>([]);
  const [logs, setLogs] = useState<{ timestamp: string; user: string; role: string; action: string }[]>([]);

  // Filtering Map Coordinates states
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  // Bandwidth & Readability Configurations
  const [isLowBandwidth, setIsLowBandwidth] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true); // default to true as per request

  // Synchronization status tracking
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTime: null,
    isOnline: navigator.onLine,
    pendingChangesCount: getQueue().length
  });

  // Optimistically apply an indicator edit to local state + cache.
  const applyLocalIndicatorEdit = (id: string, baseline: number, achieved: number) => {
    setIndicators(prev => {
      const next = prev.map(it => {
        if (it.IndicatorID !== id) return it;
        const progress = baseline > 0 ? parseFloat(((achieved / baseline) * 100).toFixed(1)) : 100;
        const status: Indicator["Status"] =
          progress < 100 ? "Critical" : progress < 130 ? "Need Attention" : "On Track";
        return { ...it, BaselineValue: baseline, AchievedValue: achieved, Progress: progress, Status: status, LastUpdated: new Date().toISOString() };
      });
      localStorage.setItem("avdp_cached_indicators", JSON.stringify(next));
      return next;
    });
  };

  // Replay any queued offline edits once connectivity returns.
  const flushOfflineQueue = async () => {
    const queue = getQueue();
    if (queue.length === 0 || !currentUser) return;
    for (const item of queue) {
      try {
        await db.updateIndicator(item.id, item.baseline, item.achieved, currentUser);
        removeFromQueue(item.id);
      } catch (err) {
        console.warn(`Failed to replay queued edit for ${item.id}; will retry later.`, err);
      }
    }
    setSyncStatus(prev => ({ ...prev, pendingChangesCount: getQueue().length }));
    await syncWithServer();
  };

  const [loading, setLoading] = useState<boolean>(true);
  const [syncingIndicator, setSyncingIndicator] = useState<boolean>(false);

  // Initialize tab + district from the URL so views are shareable/deep-linkable
  const initialParams = new URLSearchParams(window.location.search);
  const initialTab = initialParams.get("tab");
  const [activeTab, setActiveTab] = useState<"analytics" | "gis" | "forecasting" | "markets" | "calendar">(
    initialTab === "gis" || initialTab === "forecasting" || initialTab === "markets" || initialTab === "calendar" ? initialTab : "analytics"
  );

  // --- COMPREHENSIVE DATA SYNCHRONIZATION INTERFACE ---

  // Load initially from local storage FIRST for instantaneous offline rendering
  useEffect(() => {
    const cachedIndicators = localStorage.getItem("avdp_cached_indicators");
    const cachedAlerts = localStorage.getItem("avdp_cached_alerts");
    const cachedLogs = localStorage.getItem("avdp_cached_logs");

    if (cachedIndicators) {
      try {
        setIndicators(JSON.parse(cachedIndicators));
      } catch (e) {
        console.error("Failed to parse cached metrics", e);
      }
    } else {
      // Setup direct initial fallback indicators while fetching compiles
      setIndicators(getEnrichedIndicators());
    }

    if (cachedAlerts) setAlerts(JSON.parse(cachedAlerts));
    if (cachedLogs) setLogs(JSON.parse(cachedLogs));

    setLoading(false);

    // Initial query check
    syncWithServer();

    // Restore any existing Supabase auth session, and track auth changes
    db.getCurrentUser().then(setCurrentUser).catch(() => {});
    const { data: authSub } = supabase.auth.onAuthStateChange(async () => {
      const u = await db.getCurrentUser().catch(() => null);
      setCurrentUser(u);
      // Logs become readable/insertable once signed in — refresh.
      syncWithServer();
    });

    // Setup network status listeners
    const handleOnline = () => setSyncStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSyncStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      authSub.subscription.unsubscribe();
    };
  }, []);

  // Replay queued offline edits when we come back online or sign in.
  useEffect(() => {
    if (syncStatus.isOnline && currentUser && syncStatus.pendingChangesCount > 0) {
      flushOfflineQueue();
    }
    const onReconnect = () => flushOfflineQueue();
    window.addEventListener("online", onReconnect);
    return () => window.removeEventListener("online", onReconnect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus.isOnline, currentUser]);

  // Apply any ?district= from the URL on first load
  useEffect(() => {
    const d = initialParams.get("district");
    if (d) setSelectedDistrict(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with the active tab + selected district (shareable links)
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "analytics") params.set("tab", activeTab);
    if (selectedDistrict) params.set("district", selectedDistrict);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [activeTab, selectedDistrict]);

  // Pull the latest data from Supabase, caching it locally for offline use.
  const syncWithServer = async () => {
    setSyncingIndicator(true);
    try {
      const [freshInd, freshAlt, freshLogs] = await Promise.all([
        db.getIndicators(),
        db.getAlerts(),
        db.getLogs().catch(() => [] as typeof logs), // logs need auth; ignore if anon
      ]);

      setIndicators(freshInd);
      localStorage.setItem("avdp_cached_indicators", JSON.stringify(freshInd));

      setAlerts(freshAlt);
      localStorage.setItem("avdp_cached_alerts", JSON.stringify(freshAlt));

      if (freshLogs.length > 0) {
        setLogs(freshLogs);
        localStorage.setItem("avdp_cached_logs", JSON.stringify(freshLogs));
      }

      setSyncStatus({
        lastSyncTime: new Date().toLocaleTimeString(),
        isOnline: true,
        pendingChangesCount: getQueue().length
      });
    } catch (err) {
      console.warn("Supabase unreachable. Proceeding with stored offline dataset.", err);
      setSyncStatus(prev => ({
        ...prev,
        isOnline: false
      }));
    } finally {
      setSyncingIndicator(false);
    }
  };

  // Modify individual indicator values (CRUD under RBAC guard, enforced by RLS)
  const handleUpdateIndicator = async (id: string, baseline: number, achieved: number) => {
    if (!currentUser) throw new Error("Authentication required.");

    // Offline-first: if there's no connectivity, apply locally and queue for replay.
    if (!navigator.onLine) {
      applyLocalIndicatorEdit(id, baseline, achieved);
      enqueue({ id, baseline, achieved });
      setSyncStatus(prev => ({ ...prev, isOnline: false, pendingChangesCount: getQueue().length }));
      return;
    }

    try {
      await db.updateIndicator(id, baseline, achieved, currentUser);
      await syncWithServer();
    } catch (err: any) {
      console.error(err);
      await syncWithServer(); // Pull back authoritative state
      throw new Error(err.message || "Failed to commit metrics parameters changes.");
    }
  };

  // Bulk synchronizer for CSV Drag uploads
  const handleBatchImport = async (data: Partial<Indicator>[]) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new Error("Access Denied. Only administration accounts support CSV uploads.");
    }
    try {
      const rows = data
        .filter(d => d.IndicatorID != null && d.BaselineValue != null && d.AchievedValue != null)
        .map(d => ({
          IndicatorID: d.IndicatorID as string,
          BaselineValue: d.BaselineValue as number,
          AchievedValue: d.AchievedValue as number,
        }));
      await db.batchImportIndicators(rows, currentUser);
      await syncWithServer();
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || "Bulk CSV imports faced syncing obstacles.");
    }
  };

  // Subscribe dynamic thresholds warning
  const handleCreateAlertRule = async (rule: Partial<ThresholdAlert>) => {
    if (!currentUser) throw new Error("Sign in to manage alert rules.");
    try {
      await db.createAlert(
        {
          indicatorId: rule.indicatorId as string,
          recipientEmail: rule.recipientEmail as string,
          thresholdValue: rule.thresholdValue as number,
          condition: (rule.condition as "below" | "above") || "below",
        },
        currentUser
      );
      await syncWithServer();
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || "Failed to subscribe alert rule.");
    }
  };

  // Test send dispatch trigger alerts simulated email logs
  const handleTriggerAlertDispatch = async (id: string) => {
    try {
      await db.dispatchAlert(id, currentUser);
      await syncWithServer();
    } catch (err) {
      console.error(err);
    }
  };

  // Pause / resume / delete alert rules
  const handleToggleAlert = async (id: string, enabled: boolean) => {
    try {
      await db.updateAlert(id, { enabled }, currentUser);
      await syncWithServer();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await db.deleteAlert(id, currentUser);
      await syncWithServer();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={`min-h-screen ${
      isDarkMode ? "bg-[#020617] text-slate-100" : "bg-slate-50 text-slate-950"
    } transition-all duration-200 font-sans p-0 m-0`} id="avdp-applet-canvas">

      {/* Banner announcement top-rail */}
      <div className="bg-gradient-to-r from-emerald-900 to-[#0e2a47] py-2 px-4 border-b border-emerald-500/20 text-center flex flex-col md:flex-row items-center justify-between gap-2.5 z-20 relative">
        <div className="flex items-center gap-2 text-xs font-mono tracking-wide text-emerald-300">
          <Globe className="w-4 h-4 animate-spin text-emerald-400" />
          <span>AVDP-MNE Platform: Registered Sierra Leone District operations active offline.</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            {syncStatus.isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />
                Online Sync
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500">
                <WifiOff className="w-3.5 h-3.5" />
                Cache Only
              </span>
            )}
          </div>
          {syncStatus.lastSyncTime && (
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              Last Synced: {syncStatus.lastSyncTime}
            </span>
          )}
          {syncStatus.pendingChangesCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400 text-[11px] bg-amber-950/30 border border-amber-500/25 px-2 py-0.5 rounded font-mono">
              <HardDrive className="w-3 h-3" />
              {syncStatus.pendingChangesCount} pending sync
            </span>
          )}
          <button
            onClick={syncWithServer}
            disabled={syncingIndicator}
            className="text-[10px] bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-emerald-500/30 text-slate-300 px-2 py-1 rounded cursor-pointer transition-all flex items-center gap-1 font-medium disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${syncingIndicator ? "animate-spin text-emerald-400" : ""}`} />
            Sync Now
          </button>
        </div>
      </div>

      {/* Header operations bar */}
      <header className="border-b border-slate-800 bg-[#070b13]/85 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/20 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                AVDP Sierra Leone Monitoring & Evaluation Portal
              </h1>
              <span className="text-[10px] text-emerald-400 font-bold font-mono tracking-widest bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">
                www.avdp.org.sl
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              IFAD G-100 Agricultural Commodities & Infrastructure Evaluation Dashboard
            </p>
          </div>
        </div>

        {/* Global toggles and Auth gating */}
        <div className="flex items-center gap-3.5">
          {/* Low Bandwidth Mode Toggle */}
          <div className="flex items-center gap-2 border border-slate-800 bg-[#090d16]/30 py-1.5 px-3 rounded-lg text-xs" title="Reduces graphics overhead for 2G connections">
            <Radio className={`w-4 h-4 ${isLowBandwidth ? "text-emerald-400" : "text-slate-500"}`} />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 leading-none">
                Bandwidth Tier
              </span>
              <button
                onClick={() => setIsLowBandwidth(!isLowBandwidth)}
                className="text-slate-200 hover:text-emerald-400 font-bold text-left transition-all cursor-pointer leading-tight"
              >
                {isLowBandwidth ? "Low Bandwidth Active" : "Full Graphics (3G/4G)"}
              </button>
            </div>
          </div>

          {/* Secure Admin Gate modal toggles */}
          <AuthModal
            currentUser={currentUser}
            onLogout={async () => { await db.signOut(); setCurrentUser(null); }}
          />
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">

        {/* McKinsey Premium Portal Tabs Switcher */}
        <div className="flex border-b border-slate-800 pb-px mb-2 overflow-x-auto select-none gap-2" id="avdp-portal-tab-swapper">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`text-xs uppercase font-mono tracking-wider font-bold pb-3 px-4 border-b-2 transition-all cursor-pointer ${
              activeTab === "analytics"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📊 Strategic M&E Workspace
          </button>

          <button
            onClick={() => setActiveTab("gis")}
            className={`text-xs uppercase font-mono tracking-wider font-bold pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "gis"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🧭 GIS Informatics
            <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-normal leading-none">
              Map
            </span>
          </button>

          <button
            onClick={() => setActiveTab("forecasting")}
            className={`text-xs uppercase font-mono tracking-wider font-bold pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "forecasting"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📈 Yield Forecasting
            <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-normal leading-none">
              Model
            </span>
          </button>

          <button
            onClick={() => setActiveTab("markets")}
            className={`text-xs uppercase font-mono tracking-wider font-bold pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "markets"
                ? "border-teal-500 text-teal-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🌾 Market Value Chains
            <span className="text-[9px] bg-teal-950 border border-teal-500/25 text-teal-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-normal leading-none animate-pulse">
              New
            </span>
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`text-xs uppercase font-mono tracking-wider font-bold pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "calendar"
                ? "border-emerald-500 text-emerald-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📅 Seasonal Crop Calendar
          </button>
        </div>

        {activeTab === "analytics" && (
          <>
            {/* Dynamic Warning Alert Banner if any Critical warning exists */}
            {indicators.filter(i => i.Status === "Critical").length > 0 && !isLowBandwidth && (
              <div className="bg-red-950/30 border border-red-500/35 p-4 rounded-xl flex items-start gap-3.5 animate-pulse text-xs leading-normal text-red-300">
                <AlertTriangle className="w-5 h-5 mt-0.5 text-red-400 shrink-0" />
                <div>
                  <strong className="font-bold text-slate-100">Critical Crop/Infrastructure Warnings Triggered:</strong>
                  <p className="text-red-400 mt-1">
                    Currently, {indicators.filter(i => i.Status === "Critical").length} operational targets are registering sub-baseline parameters. Review indicators under districts table for remedial water swamps interventions or seed deliveries.
                  </p>
                </div>
              </div>
            )}

            {/* Auto-derived "what to watch" insight cards */}
            <ProactiveInsights
              indicators={indicators}
              onSelectDistrict={setSelectedDistrict}
              isLowBandwidth={isLowBandwidth}
            />

            {/* McKinsey-style Strategic Informatics & Charts Board */}
            <ExecutiveAnalytics
              indicators={indicators}
              selectedDistrict={selectedDistrict}
              onSelectDistrict={setSelectedDistrict}
              isLowBandwidth={isLowBandwidth}
            />

            {/* Decision-support advisor remains in the workspace; GIS and Yield Forecasting have their own portal tabs. */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative overflow-visible">
              <div className="xl:col-span-12 h-full flex flex-col justify-between">
                <AdviserChat
                  currentDistrict={selectedDistrict}
                  activeCommodity="Rice"
                  isLowBandwidth={isLowBandwidth}
                />
              </div>
            </div>

            {/* Analytical spreadsheet metrics grid component */}
            <div id="analytical-table-mount">
              <IndicatorTable
                indicators={indicators}
                currentUser={currentUser}
                onUpdateIndicator={handleUpdateIndicator}
                onBatchSync={handleBatchImport}
                selectedDistrict={selectedDistrict}
                onSelectDistrict={setSelectedDistrict}
                isLowBandwidth={isLowBandwidth}
              />
            </div>

            {/* AVDP Surveys & Field Evaluations Registry Hub */}
            <SurveyRegistry
              currentUser={currentUser}
              indicators={indicators}
              selectedDistrict={selectedDistrict}
              isLowBandwidth={isLowBandwidth}
              onRefreshLogs={syncWithServer}
            />

            {/* Gender & youth inclusion analytics (survey disaggregation) */}
            <GenderAnalytics selectedDistrict={selectedDistrict} isLowBandwidth={isLowBandwidth} />

            {/* Scheduled national M&E digest reports */}
            <ReportsPanel currentUser={currentUser} />

            {/* Subscription threshold rules + Automated email notifications mock simulator */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7">
                <AlertManager
                  alerts={alerts}
                  indicators={indicators}
                  currentUser={currentUser}
                  onCreateAlertRule={handleCreateAlertRule}
                  onTriggerAlertDispatch={handleTriggerAlertDispatch}
                  onToggleAlert={handleToggleAlert}
                  onDeleteAlert={handleDeleteAlert}
                  isLowBandwidth={isLowBandwidth}
                />
              </div>

              {/* Audit Logs Trail Tracker feed card */}
              <div className="xl:col-span-5 bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase border-b border-slate-800 pb-2.5 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-400" />
                    Security Audit Log trail ({logs.length} transactions)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">RBAC compliant</span>
                </div>

                <div className="space-y-3.5 max-h-[295px] overflow-y-auto pr-1">
                  {logs.map((log, idx) => (
                    <div key={idx} className="text-[11px] leading-relaxed border-b border-slate-900 pb-2.5 last:border-b-0">
                      <div className="flex justify-between font-mono text-[10px] text-slate-500 font-semibold">
                        <span>{log.user} ({log.role})</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-300 mt-1 font-mono">{log.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "gis" && (
          <MapSection
            indicators={indicators}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={setSelectedDistrict}
            isLowBandwidth={isLowBandwidth}
          />
        )}

        {activeTab === "forecasting" && (
          <YieldForecasting
            indicators={indicators}
            selectedDistrict={selectedDistrict}
            isLowBandwidth={isLowBandwidth}
          />
        )}

        {activeTab === "markets" && (
          <>
            <MarketInformation
              indicators={indicators}
              selectedDistrict={selectedDistrict}
              isLowBandwidth={isLowBandwidth}
            />

            {/* Cohesive, highly curated AVDP Value Chain Guidelines & Advisor board */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative overflow-visible">

              <div className="xl:col-span-8 bg-[#0b1329] border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 border-b border-slate-800 pb-3 mb-4">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  IFAD-AVDP Quality Standards & Processing Directives
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 leading-relaxed font-mono">

                  <div className="space-y-4">
                    <div className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-1">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">Rice Quality Thresholds</span>
                      <p className="text-slate-400 text-[11px]">
                        Maximum paddy moisture level set at <strong>14%</strong> before machine milling. Parboiled grains should undergo steam vacuum drying on cement platforms to avoid standard blemish residues.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-1">
                      <span className="text-[10px] text-teal-400 font-bold uppercase">Cocoa Moisture Compliance</span>
                      <p className="text-slate-400 text-[11px]">
                        Requires raw cocoa beans sweat-fermented in wooden cascade boxes for exactly <strong>6 days</strong>, with daily rotations. Certified moisture level for export stands below <strong>7.5%</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Coffee Hulling Benchmarks</span>
                      <p className="text-slate-400 text-[11px]">
                        Cherries must undergo clean drying until moisture content reaches <strong>11-12%</strong>. Hulling must be done within 6 weeks of harvest to lock in premium Highland Robusta flavor codes.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-1">
                      <span className="text-[10px] text-amber-500 font-bold uppercase">Oil Palm FFR Standby Limits</span>
                      <p className="text-slate-400 text-[11px]">
                        Fresh Fruit Bunches (FFB) must be processed within <strong>24 hours</strong> of harvest to keep Free Fatty Acids (FFA) indexation strictly below <strong>5%</strong> for industrial oleins.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Footnote warning details */}
                <div className="mt-5 p-3.5 bg-yellow-950/15 border border-yellow-500/10 rounded-xl text-[10px] text-yellow-300 flex items-start gap-2 font-mono">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
                  <span>
                    <strong>Certification Notice:</strong> Non-compliance with AVDP moisture limits degrades transaction grades from "Certified Link" price to "Middleman open crop" price automatically physically recorded by district scale officers.
                  </span>
                </div>
              </div>

              <div className="xl:col-span-4 h-full flex flex-col justify-between">
                <AdviserChat
                  currentDistrict={selectedDistrict}
                  activeCommodity="General"
                  isLowBandwidth={isLowBandwidth}
                />
              </div>

            </div>
          </>
        )}

        {activeTab === "calendar" && (
          <CropCalendar
            selectedDistrict={selectedDistrict}
            isLowBandwidth={isLowBandwidth}
          />
        )}

      </main>

      {/* Footer system attributes */}
      <footer className="border-t border-slate-800 bg-[#040810] py-6 px-4 text-center mt-12 text-slate-500 text-xs font-mono">
        <p>&copy; 2026 Ministry of Agriculture of Sierra Leone. Powered by IFAD Agricultural Value Chain Development Project (AVDP).</p>
        <p className="text-[10px] text-slate-600 mt-1 leading-normal max-w-2xl mx-auto">
          MNE Platform complies with low cellular bandwidth limits. Offline updates sync instantly with standard cloud datastores upon reconnecting.
        </p>
      </footer>

    </div>
  );
}
