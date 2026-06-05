import React, { useState, useRef, useMemo } from "react";
import { Indicator, User, UserRole } from "../types";
import {
  Download, FileSpreadsheet, FileText, Search, ArrowUpDown, Edit3,
  Check, Trash, Plus, Upload, FileUp, AlertTriangle, CheckCircle2, ChevronRight, X, History
} from "lucide-react";
import IndicatorSparkline from "./IndicatorSparkline";
import IndicatorHistoryModal from "./IndicatorHistoryModal";

interface IndicatorTableProps {
  indicators: Indicator[];
  currentUser: User | null;
  onUpdateIndicator: (id: string, baseline: number, achieved: number) => Promise<void>;
  onBatchSync: (data: Partial<Indicator>[]) => Promise<void>;
  selectedDistrict: string | null;
  onSelectDistrict: (dist: string | null) => void;
  isLowBandwidth: boolean;
}

export default function IndicatorTable({
  indicators,
  currentUser,
  onUpdateIndicator,
  onBatchSync,
  selectedDistrict,
  onSelectDistrict,
  isLowBandwidth
}: IndicatorTableProps) {
  // Filters & Searching parameters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCommodity, setSelectedCommodity] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [sortBy, setSortBy] = useState<keyof Indicator>("IndicatorID");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination parameters
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = isLowBandwidth ? 8 : 12;

  // History drill-down modal
  const [historyItem, setHistoryItem] = useState<Indicator | null>(null);

  // Editing state handles
  const [editingItem, setEditingItem] = useState<Indicator | null>(null);
  const [editBaseline, setEditBaseline] = useState<number>(0);
  const [editAchieved, setEditAchieved] = useState<number>(0);
  const [editingError, setEditingError] = useState<string | null>(null);
  const [editingSuccessMsg, setEditingSuccessMsg] = useState<string | null>(null);

  // CSV Drag-and-Drop and File Dialog file states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic values choices
  const uniqueDistricts = useMemo(() => {
    return Array.from(new Set(indicators.map(i => i.District))).sort();
  }, [indicators]);

  const uniqueCommodities = ["Rice", "Cocoa", "Coffee", "Oil Palm", "General"];
  const uniqueCategories = [
    "Yield Increase", "Gender Inclusion", "Farmer Income", 
    "Road Rehab", "Seedling Survival Rate", 
    "Processing Facilities Built", "Market Access Improvement"
  ];

  // Sorting helper
  const handleSort = (field: keyof Indicator) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Filter application pipeline
  const filteredAndSortedIndicators = useMemo(() => {
    let result = [...indicators];

    // Filter by Selected District (Map interaction)
    if (selectedDistrict) {
      result = result.filter(i => i.District === selectedDistrict);
    }

    // Search bar string matching
    if (searchTerm.trim() !== "") {
      const match = searchTerm.toLowerCase();
      result = result.filter(
        i => i.IndicatorID.toLowerCase().includes(match) || 
             i.IndicatorName.toLowerCase().includes(match) ||
             i.District.toLowerCase().includes(match)
      );
    }

    // Filter by commodity target
    if (selectedCommodity !== "All") {
      result = result.filter(i => i.Commodity === selectedCommodity);
    }

    // Filter by focal category
    if (selectedCategory !== "All") {
      result = result.filter(i => i.IndicatorName === selectedCategory);
    }

    // Filter by progress status
    if (selectedStatus !== "All") {
      result = result.filter(i => i.Status === selectedStatus);
    }

    // Apply Sorting logic
    result.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (typeof aVal === "string") {
        aVal = (aVal as string).toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [indicators, selectedDistrict, searchTerm, selectedCommodity, selectedCategory, selectedStatus, sortBy, sortOrder]);

  // Extract pagination indices
  const pageCount = Math.ceil(filteredAndSortedIndicators.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedIndicators.slice(start, start + itemsPerPage);
  }, [filteredAndSortedIndicators, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pageCount) {
      setCurrentPage(page);
    }
  };

  // Trigger editing authorization
  const handleStartEdit = (item: Indicator) => {
    // Role-based Access Control Check
    if (!currentUser) {
      setEditingError("Authentication required. Please 'Sign In' at the top-right to edit metrics.");
      setTimeout(() => setEditingError(null), 4000);
      return;
    }

    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.OFFICER) {
      setEditingError(`Role '${currentUser.role}' not authorized to adjust core baseline thresholds.`);
      setTimeout(() => setEditingError(null), 4000);
      return;
    }

    if (currentUser.role === UserRole.OFFICER && currentUser.district && currentUser.district !== item.District) {
      setEditingError(`Permission Denied. You are the Officer for ${currentUser.district}; you cannot modify ${item.District} indicators.`);
      setTimeout(() => setEditingError(null), 4000);
      return;
    }

    setEditingItem(item);
    setEditBaseline(item.BaselineValue);
    setEditAchieved(item.AchievedValue);
    setEditingError(null);
    setEditingSuccessMsg(null);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (editBaseline < 0 || editAchieved < 0) {
      setEditingError("Metric numerical values must be zero or positive.");
      return;
    }

    try {
      await onUpdateIndicator(editingItem.IndicatorID, editBaseline, editAchieved);
      setEditingSuccessMsg(`Successfully synchronized changes for ${editingItem.IndicatorID}!`);
      setTimeout(() => {
        setEditingItem(null);
        setEditingSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setEditingError(err.message || "Failed to finalize database adjustments.");
    }
  };

  // Client-Side CSV file writer downloader
  const handleExportCSV = () => {
    const headers = ["IndicatorID", "IndicatorName", "BaselineValue", "AchievedValue", "Target", "ProgressPercentage", "Status", "District", "Commodity", "Timestamp"];
    const csvRows = [headers.join(",")];

    filteredAndSortedIndicators.forEach(i => {
      const row = [
        `"${i.IndicatorID}"`,
        `"${i.IndicatorName}"`,
        i.BaselineValue,
        i.AchievedValue,
        i.Target ?? "",
        i.Progress,
        `"${i.Status}"`,
        `"${i.District}"`,
        `"${i.Commodity}"`,
        `"${i.LastUpdated}"`
      ];
      csvRows.push(row.join(","));
    });

    const csvBlob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const blobUrl = URL.createObjectURL(csvBlob);
    
    const clickLink = document.createElement("a");
    clickLink.href = blobUrl;
    clickLink.setAttribute("download", `AVDP_Agricultural_Metrics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(clickLink);
    clickLink.click();
    document.body.removeChild(clickLink);
  };

  // Export the filtered set as JSON (for programmatic / integration use)
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(filteredAndSortedIndicators, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `AVDP_Agricultural_Metrics_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prints the filtered database directly as high-fidelity PDF page
  const handlePrintPDF = () => {
    window.print();
  };

  // Drag over alerts
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // CSV Drag and Drop Parser
  const handleProcessCSVText = async (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error("CSV file lacks rows.");
      }

      const headers = lines[0].toLowerCase().split(",");
      const idIdx = headers.findIndex(h => h.includes("id") || h.includes("indicatorid"));
      const baselineIdx = headers.findIndex(h => h.includes("baseline"));
      const achievedIdx = headers.findIndex(h => h.includes("achieved") || h.includes("value"));

      if (idIdx === -1 || baselineIdx === -1 || achievedIdx === -1) {
        throw new Error("Unable to map headers. Make sure you match columns: 'IndicatorID', 'BaselineValue', 'AchievedValue'");
      }

      const parsedBatch: Partial<Indicator>[] = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = lines[i].split(",");
        if (columns.length <= Math.max(idIdx, baselineIdx, achievedIdx)) continue;

        const id = columns[idIdx].replace(/"/g, "").trim();
        const base = parseFloat(columns[baselineIdx]);
        const ach = parseFloat(columns[achievedIdx]);

        if (id && !isNaN(base) && !isNaN(ach)) {
          parsedBatch.push({
            IndicatorID: id,
            BaselineValue: base,
            AchievedValue: ach,
            Progress: base > 0 ? parseFloat(((ach / base) * 100).toFixed(1)) : 100
          });
        }
      }

      if (parsedBatch.length === 0) {
        throw new Error("Zero valid operational lines parsed from CSV parameters.");
      }

      await onBatchSync(parsedBatch);
      setUploadSuccess(`Successfully synchronized ${parsedBatch.length} indicators using CSV Stream!`);
      setUploadError(null);
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err: any) {
      setUploadError(err.message || "CSV parse error. Ensure standard plain text table format.");
      setUploadSuccess(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);

    // Security permission check
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      setUploadError("Security Guard denial: CSV bulk updates are restricted to authorized Admin credentials.");
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleProcessCSVText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    } else {
      setUploadError("Only standard .csv file uploads are accepted.");
    }
  };

  const handleFileClickSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      setUploadError("Security Guard denial: CSV imports are restricted to authorized Admin credentials.");
      return;
    }

    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleProcessCSVText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm relative" id="indicator-table-section">
      
      {/* Table Export Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            AVDP Real-Time Evaluation Index ({filteredAndSortedIndicators.length} matching)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Query and analyze agricultural progress indicators, modify field variables via RBAC credentials, or export reports.
          </p>
        </div>
        
        {/* Dynamic Buttons */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
            id="csv-export-btn"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
            id="json-export-btn"
          >
            <FileUp className="w-3.5 h-3.5" />
            Export JSON
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-3 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
            id="pdf-print-btn"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF (Report)
          </button>
        </div>
      </div>

      {/* CSV Drag-and-Drop Uploader (Always visible for quick Admin import) */}
      {currentUser?.role === UserRole.ADMIN && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-5 p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 bg-[#090d16]/30 ${
            isDragging 
              ? "border-emerald-500 bg-emerald-950/20" 
              : "border-slate-800 hover:border-slate-700 hover:bg-slate-900/10"
          }`}
          id="csv-drag-uploader"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileClickSelect}
            accept=".csv"
            className="hidden"
          />
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold">
            <Upload className="w-4 h-4" />
            CSV BULK UPDATE PORTAL
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 max-w-md">
            Drag & drop or <span className="text-emerald-400 font-medium underline">browse</span> to import index updates in standard CSV format.
          </p>
          {uploadError && (
            <span className="text-[10px] text-red-400 font-medium flex items-center gap-1 mt-1 leading-normal">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {uploadError}
            </span>
          )}
          {uploadSuccess && (
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-1 leading-normal">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {uploadSuccess}
            </span>
          )}
        </div>
      )}

      {/* Editing State Error Indicator */}
      {editingError && (
        <div className="bg-red-950/20 border border-red-500/40 text-red-300 p-3 rounded-lg text-xs flex items-center gap-2 mb-4 animate-shake">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{editingError}</span>
        </div>
      )}

      {/* Filter Pipeline Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5" id="pipeline-filter-controls">
        
        {/* Search Bar Input */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Search indicator or district..."
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-100 focus:outline-none focus:border-slate-700 font-mono"
          />
        </div>

        {/* Commodity select */}
        <div>
          <select
            value={selectedCommodity}
            onChange={(e) => { setSelectedCommodity(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-slate-700 font-medium"
          >
            <option value="All">All Commodities (Crops)</option>
            {uniqueCommodities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Categories select */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-slate-700 font-medium"
          >
            <option value="All">All Indicators Focus</option>
            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* Status select */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-900/60 border border-slate-800 text-slate-300 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-slate-700 font-medium"
          >
            <option value="All">All Warning Alerts</option>
            <option value="On Track">On Track</option>
            <option value="Need Attention">Need Attention</option>
            <option value="Critical">Critical Alert</option>
          </select>
        </div>

        {/* Map District context clear indicator */}
        <div className="flex items-center justify-between border border-slate-800 bg-slate-900/40 rounded-lg px-3 py-1 text-xs">
          <span className="text-slate-500">Region:</span>
          <span className="text-emerald-400 font-bold font-mono">
            {selectedDistrict ? selectedDistrict : "All Sierra Leone"}
          </span>
          {selectedDistrict && (
            <button 
              onClick={() => onSelectDistrict(null)}
              className="text-slate-400 hover:text-white ml-1 font-bold text-sm cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Main Table View */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#070b13]/60 relative z-10" id="main-data-table-container">
        <table className="w-full border-collapse text-left text-xs min-w-[720px]">
          <thead>
            <tr className="bg-slate-900 text-slate-400 font-mono border-b border-slate-800">
              <th className="py-3 px-4 font-semibold text-left select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("IndicatorID")}>
                ID <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-left select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("IndicatorName")}>
                Indicator Name <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-left select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("District")}>
                District <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-center select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("Commodity")}>
                Commodity <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-right select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("BaselineValue")}>
                Baseline <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-right select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("AchievedValue")}>
                Achieved <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-right select-none text-slate-400" title="Logframe end-of-project target">
                Target
              </th>
              <th className="py-3 px-4 font-semibold text-right select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("Progress")}>
                Progress <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-center select-none text-slate-400">
                30-Day D3 Trend
              </th>
              <th className="py-3 px-4 font-semibold text-center select-none cursor-pointer hover:text-emerald-300" onClick={() => handleSort("Status")}>
                Status <ArrowUpDown className="w-3 h-3 inline ml-1" />
              </th>
              <th className="py-3 px-4 font-semibold text-center z-20">Transaction Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr 
                key={item.IndicatorID} 
                className={`border-b border-slate-900 hover:bg-slate-900/30 transition-all ${
                  item.Status === "Critical" ? "bg-red-500/[0.01]" : ""
                }`}
              >
                <td className="py-2.5 px-4 font-mono text-slate-300 font-semibold">{item.IndicatorID}</td>
                <td className="py-2.5 px-4 text-slate-100 font-medium">
                  {item.IndicatorName}
                </td>
                <td className="py-2.5 px-4 text-slate-300 font-mono">{item.District}</td>
                <td className="py-2.5 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    item.Commodity === "Rice" ? "bg-sky-950/40 text-sky-400 border border-sky-900/30" : 
                    item.Commodity === "Cocoa" ? "bg-amber-950/40 text-amber-400 border border-amber-900/30" :
                    item.Commodity === "Coffee" ? "bg-orange-950/40 text-orange-400 border border-orange-900/30" : 
                    item.Commodity === "Oil Palm" ? "bg-yellow-950/40 text-yellow-500 border border-yellow-900/30" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {item.Commodity}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-400">{item.BaselineValue}</td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-200 font-semibold">{item.AchievedValue}</td>
                <td className="py-2.5 px-4 text-right font-mono">
                  {item.Target != null ? (
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-amber-400/90">{item.Target}</span>
                      <span className="text-[9px] text-slate-500">
                        {item.Target > 0 ? Math.round((item.AchievedValue / item.Target) * 100) : 0}% to tgt
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{item.Progress}%</span>
                    {!isLowBandwidth && (
                      <div className="w-12 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900 hidden md:block">
                        <div 
                          className={`h-full ${
                            item.Status === "Critical" ? "bg-red-500" : 
                            item.Status === "Need Attention" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, item.Progress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <IndicatorSparkline item={item} isLowBandwidth={isLowBandwidth} />
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase inline-block ${
                    item.Status === "Critical" ? "bg-red-950/40 text-red-400 border border-red-500/30" : 
                    item.Status === "Need Attention" ? "bg-amber-950/40 text-amber-400 border border-amber-900/30" : 
                    "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                  }`}>
                    {item.Status}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => setHistoryItem(item)}
                      className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-emerald-300 transition-all inline-flex items-center gap-1 cursor-pointer"
                      title="View progress history"
                    >
                      <History className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1 px-2.5 rounded bg-slate-800 hover:bg-emerald-900/40 border border-slate-700/60 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-300 transition-all inline-flex items-center gap-1 cursor-pointer font-medium"
                      title="Edit baseline achieved criteria"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Adjust</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredAndSortedIndicators.length === 0 && (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-500 text-xs">
                  No operational monitoring variables matched selected parameter limits. Try widening filtering scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination control buttons */}
      {pageCount > 1 && (
        <div className="flex justify-between items-center mt-4 text-xs font-mono border-t border-slate-900 pt-3" id="pagination-panel">
          <span className="text-slate-500">
            Showing Page {currentPage} of {pageCount} ({filteredAndSortedIndicators.length} indexes)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 mr-2 cursor-pointer"
            >
              &larr; Prev
            </button>
            {Array.from({ length: pageCount }).map((_, idx) => {
              const pNum = idx + 1;
              const isAround = Math.abs(currentPage - pNum) < 2 || pNum === 1 || pNum === pageCount;
              if (!isAround) return <span key={pNum} className="text-slate-600 px-1">.</span>;
              return (
                <button
                  key={pNum}
                  onClick={() => handlePageChange(pNum)}
                  className={`px-2.5 py-1 rounded ${
                    currentPage === pNum 
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold" 
                      : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800"
                  } cursor-pointer`}
                >
                  {pNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === pageCount}
              className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-800 ml-2 cursor-pointer"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}

      {/* RBAC Adjust Modal overlay */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl w-full max-w-md border border-slate-700/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Operational Adjustment Gate
                </span>
                <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                  Update Indicator {editingItem.IndicatorID}
                </h4>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-900 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Class Focus:</span>
                  <span className="text-slate-200 font-semibold">{editingItem.IndicatorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Regional District:</span>
                  <span className="text-slate-200 font-semibold">{editingItem.District}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Focal Crop:</span>
                  <span className="text-indigo-400 font-mono font-bold">{editingItem.Commodity}</span>
                </div>
              </div>

              {editingSuccessMsg && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{editingSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1 font-semibold">
                    Baseline Metric
                  </label>
                  <input
                    type="number"
                    value={editBaseline}
                    onChange={(e) => setEditBaseline(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1 font-semibold">
                    Achieved Metric
                  </label>
                  <input
                    type="number"
                    value={editAchieved}
                    onChange={(e) => setEditAchieved(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 text-xs">
                <button
                  onClick={() => setEditingItem(null)}
                  className="w-1/2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg py-2 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow shadow-emerald-950"
                >
                  <Check className="w-4 h-4" />
                  Commit Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indicator progress history drill-down */}
      {historyItem && (
        <IndicatorHistoryModal indicator={historyItem} onClose={() => setHistoryItem(null)} />
      )}

    </div>
  );
}
