import React, { useState, useMemo } from "react";
import { SIERRA_LEONE_DISTRICTS } from "../data";
import { 
  Calendar, Info, CloudRain, Sun, ChevronRight, Settings, 
  MapPin, RefreshCw, Layers, Clock, AlertCircle, ArrowUpRight
} from "lucide-react";

interface CropCalendarProps {
  selectedDistrict: string | null;
  isLowBandwidth: boolean;
}

type CropActivity = "Land Preparation" | "Nursery / Sowing" | "Weeding & Maintenance" | "Harvesting" | "Off-season / Transit";

interface SeasonalSchedule {
  month: string;
  activity: CropActivity;
  workload: "High" | "Medium" | "Low";
  desc: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

// Standard AVDP farming schedule matrices by crop and region context
const CROP_CALENDAR_DATA = {
  "Rice": {
    schedule: [
      { month: "Jan", activity: "Off-season / Transit", workload: "Low", desc: "Milling, packing, and warehouse storage. Transporting yields to regional Kambia/Moyamba hubs." },
      { month: "Feb", activity: "Off-season / Transit", workload: "Low", desc: "Inland valley swamp (IVS) site surveying, canal dredging, and bund repairs." },
      { month: "Mar", activity: "Land Preparation", workload: "Medium", desc: "Brushing, clearing, and initial harrowing of fields ahead of early rain showers." },
      { month: "Apr", activity: "Land Preparation", workload: "High", desc: "Tilling soil, final puddling of swamplands, and configuring organic boundary channels." },
      { month: "May", activity: "Nursery / Sowing", workload: "High", desc: "Seed preparation, nursing seedlings, and broad broadcasting across pre-flooded nurseries." },
      { month: "Jun", activity: "Nursery / Sowing", workload: "High", desc: "Transplanting tender 21-day nursery shoots systematically into central wet paddies." },
      { month: "Jul", activity: "Weeding & Maintenance", workload: "Medium", desc: "First weeding rotation and application of integrated organic fertilizers." },
      { month: "Aug", activity: "Weeding & Maintenance", workload: "Medium", desc: "Canal clearing, maintaining water levels to prevent dry spots, and second weeding loop." },
      { month: "Sep", activity: "Weeding & Maintenance", workload: "Low", desc: "Pest control monitoring. Safeguarding birds from feeding on early head grains." },
      { month: "Oct", activity: "Harvesting", workload: "High", desc: "Early harvest of swamp rice panels. Hand-reaping and piling bundles to sun-dry." },
      { month: "Nov", activity: "Harvesting", workload: "High", desc: "Peak harvest period. Threshing, winnowing in regional fields, and parboiling operations." },
      { month: "Dec", activity: "Harvesting", workload: "Medium", desc: "Concluding harvesting processes, mechanical hulling, and delivering raw bags to trade scales." }
    ] as SeasonalSchedule[],
    bgGrad: "from-emerald-950/20 to-lime-950/20",
    colorTheme: "emerald"
  },
  "Cocoa": {
    schedule: [
      { month: "Jan", activity: "Weeding & Maintenance", workload: "Medium", desc: "Pruning old branches, clearing secondary undergrowth, and shade tree trimming." },
      { month: "Feb", activity: "Land Preparation", workload: "Medium", desc: "Land layouts, soil enrichment, and preparing shaded holes for new sapling lines." },
      { month: "Mar", activity: "Nursery / Sowing", workload: "High", desc: "Seed selection, bagging premium hybrid beans, and establishing shaded nursery shelters." },
      { month: "Apr", activity: "Nursery / Sowing", workload: "High", desc: "Moistening plastic growing pots and monitoring seedlings for insects." },
      { month: "May", activity: "Nursery / Sowing", workload: "High", desc: "Transplanting mature healthy cocoa saplings under canopy shadows during early rains." },
      { month: "Jun", activity: "Weeding & Maintenance", workload: "Medium", desc: "General weeding around young plants. Establishing shade companion banana trees." },
      { month: "Jul", activity: "Weeding & Maintenance", workload: "Low", desc: "Fungal disease inspections (Black Pod mitigation) due to heavy moisture." },
      { month: "Aug", activity: "Weeding & Maintenance", workload: "Low", desc: "Spraying organic compounds on tree stems and confirming drainage slopes." },
      { month: "Sep", activity: "Harvesting", workload: "Medium", desc: "Early pod plucking. Carefully harvesting ripe yellow pods without damaging tree wood." },
      { month: "Oct", activity: "Harvesting", workload: "High", desc: "Main harvest peak. Plucking, splitting pods, and piling wet bean pulp." },
      { month: "Nov", activity: "Harvesting", workload: "High", desc: "Fermenting beans in sweat-boxes (6-day cascade cycles) and spreading on sun-drying trays." },
      { month: "Dec", activity: "Harvesting", workload: "Medium", desc: "Packing dried premium export-grade beans into jute sacks. Delivering to Kailahun offtakers." }
    ] as SeasonalSchedule[],
    bgGrad: "from-amber-950/20 to-orange-950/20",
    colorTheme: "amber"
  },
  "Vegetables": {
    schedule: [
      { month: "Jan", activity: "Harvesting", workload: "High", desc: "Dry-season harvest peak — onion bulbs, peppers and Irish potato lifted from IVS gardens and highland plots." },
      { month: "Feb", activity: "Harvesting", workload: "High", desc: "Continued harvesting and grading. Curing onions under shade before bagging for market." },
      { month: "Mar", activity: "Off-season / Transit", workload: "Medium", desc: "Bulking and transport to Bo/Makeni markets. Ventilated storage to limit pepper spoilage." },
      { month: "Apr", activity: "Land Preparation", workload: "Medium", desc: "Clearing and bed-forming ahead of the rains; compost incorporation in valley-bottom gardens." },
      { month: "May", activity: "Nursery / Sowing", workload: "High", desc: "Raising pepper and onion seedlings in shaded nurseries; seed-potato sprouting in the highlands." },
      { month: "Jun", activity: "Weeding & Maintenance", workload: "Medium", desc: "Transplanting seedlings to beds; first weeding and staking of pepper plants." },
      { month: "Jul", activity: "Weeding & Maintenance", workload: "Medium", desc: "Drainage management during peak rains to prevent waterlogging and fungal blight." },
      { month: "Aug", activity: "Weeding & Maintenance", workload: "Low", desc: "Integrated pest management — monitoring aphids and leaf miners; organic sprays." },
      { month: "Sep", activity: "Land Preparation", workload: "Medium", desc: "Preparing dry-season IVS plots; repairing irrigation channels and water-lifting points." },
      { month: "Oct", activity: "Nursery / Sowing", workload: "High", desc: "Main dry-season sowing — onion sets, pepper transplants and Irish potato in Koinadugu/Falaba highlands." },
      { month: "Nov", activity: "Weeding & Maintenance", workload: "Medium", desc: "Irrigation scheduling, fertiliser top-dressing and earthing-up of potato ridges." },
      { month: "Dec", activity: "Harvesting", workload: "Medium", desc: "Early pepper and leafy harvests begin; first onion bulbs sized for festive markets." }
    ] as SeasonalSchedule[],
    bgGrad: "from-green-950/20 to-emerald-950/10",
    colorTheme: "emerald"
  },
  "Oil Palm": {
    schedule: [
      { month: "Jan", activity: "Weeding & Maintenance", workload: "Medium", desc: "Pruning dry leaves, preparing orchard lanes to access palms, and weeding tree rings." },
      { month: "Feb", activity: "Nursery / Sowing", workload: "High", desc: "Nursing sprouted Tenera palm seeds under controlled polythene shade bags." },
      { month: "Mar", activity: "Harvesting", workload: "High", desc: "Harvest peak. Cutting heavy Fresh Fruit Bunches (FFB) using special harvesting chisels." },
      { month: "Apr", activity: "Harvesting", workload: "High", desc: "Transporting fresh bunches to expeller units immediately to avoid fatty acid spikes." },
      { month: "May", activity: "Harvesting", workload: "Medium", desc: "Continued harvest. Hulling kernels, extracting industrial olein oils." },
      { month: "Jun", activity: "Nursery / Sowing", workload: "High", desc: "Field transplanting. Sowing 12-month pre-potted young palms into final grid positions." },
      { month: "Jul", activity: "Weeding & Maintenance", workload: "Medium", desc: "Eradicating climbers and managing cover crop fields to retain nitrogen ratios." },
      { month: "Aug", activity: "Weeding & Maintenance", workload: "Low", desc: "Clearing rain drainage networks around high waterlogged palm clusters." },
      { month: "Sep", activity: "Weeding & Maintenance", workload: "Low", desc: "Applying potassium-rich organic fertilizers under palm tree circles." },
      { month: "Oct", activity: "Weeding & Maintenance", workload: "Medium", desc: "Pruning spent palm leaves to redirect nutrients into new fruiting heads." },
      { month: "Nov", activity: "Harvesting", workload: "Medium", desc: "Dry period harvesting. Gathering ripe fallen loose auxiliary palm nuts." },
      { month: "Dec", activity: "Harvesting", workload: "Medium", desc: "Pressing nuts to compile structural cooking oils. Delivering kernels to downstream millers." }
    ] as SeasonalSchedule[],
    bgGrad: "from-teal-950/20 to-emerald-950/10",
    colorTheme: "teal"
  }
};

const ACTIVITY_COLORS: Record<CropActivity, { bg: string; text: string; border: string }> = {
  "Land Preparation": { bg: "bg-slate-900", text: "text-slate-300", border: "border-slate-700/80" },
  "Nursery / Sowing": { bg: "bg-blue-950/40", text: "text-blue-400", border: "border-blue-500/20" },
  "Weeding & Maintenance": { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/20" },
  "Harvesting": { bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-500/20" },
  "Off-season / Transit": { bg: "bg-slate-950/60", text: "text-slate-500", border: "border-slate-900" }
};

export default function CropCalendar({
  selectedDistrict,
  isLowBandwidth
}: CropCalendarProps) {
  const [selectedCrop, setSelectedCrop] = useState<"Rice" | "Cocoa" | "Vegetables" | "Oil Palm">("Rice");
  const [activeMonth, setActiveMonth] = useState<string>("Oct"); // default crop indicator peak
  const [districtFilter, setDistrictFilter] = useState<string>("All");

  const resolvedDistrict = useMemo(() => {
    return selectedDistrict || districtFilter;
  }, [selectedDistrict, districtFilter]);

  // Retrieve current active crop data
  const cropData = useMemo(() => {
    return CROP_CALENDAR_DATA[selectedCrop];
  }, [selectedCrop]);

  // Find detailed description for selected month activity
  const activeMonthDetail = useMemo(() => {
    return cropData.schedule.find(s => s.month === activeMonth)!;
  }, [cropData, activeMonth]);

  // Adjust timing or notes based on the Selected District
  // Sierra Leone has rainfall gradients: South/East (Kailahun/Kenema) has earlier rains, North (Kambia) has drier winters
  const regionalAdjustmentNotes = useMemo(() => {
    if (resolvedDistrict === "All") {
      return "Viewing national aggregate calendar guidelines. General weather offsets apply universally.";
    }

    const rainGradientEast = ["Kailahun", "Kenema", "Kono"];
    const rainGradientNorth = ["Kambia", "Port Loko", "Bombali", "Karene"];

    if (rainGradientEast.includes(resolvedDistrict)) {
      return `Eastern Belt Alert: ${resolvedDistrict} receives early tropical rainfall patterns. Planting and nursery transplanting can shift up to 10 days earlier than general guidelines. Ensure sun-drying yards have protective tarp covers ready.`;
    } else if (rainGradientNorth.includes(resolvedDistrict)) {
      return `Northern District parameters: ${resolvedDistrict} experiences prolonged dry harmattan conditions. Land preparation may require additional mechanical harrowing to break baked clay soils. Retain wetland hydrology carefully.`;
    } else {
      return `Southern/Coastal conditions verified for ${resolvedDistrict}. Keep drainage channel bunds clear of sludge to bypass sudden flash flood spillage.`;
    }
  }, [resolvedDistrict]);

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden mt-6" id="avdp-crop-seasonal-calendar">
      {/* Decorative background visual glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="border-b border-slate-800 pb-5 mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-100 tracking-tight">
              AVDP Climate & Crop Cycles Seasonal Scheduler
            </h3>
            <span className="text-[9px] bg-emerald-950 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              12-Month Agronomy Tracker
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronizing local planting schedules, weeding rotations, and optimum drying/harvesting moisture windows across the value chains.
          </p>
        </div>

        {/* Commodity selectors switcher */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-900">
          {(["Rice", "Cocoa", "Vegetables", "Oil Palm"] as const).map(crop => (
            <button
              key={crop}
              onClick={() => {
                setSelectedCrop(crop);
                // Adjust active month to suitable peak months for better initial user details
                if (crop === "Rice") setActiveMonth("Nov");
                else if (crop === "Cocoa") setActiveMonth("Oct");
                else if (crop === "Vegetables") setActiveMonth("Jan");
                else setActiveMonth("Mar");
              }}
              className={`text-[11px] font-mono px-3 py-1.5 rounded-lg cursor-pointer font-bold uppercase transition-all ${
                selectedCrop === crop
                  ? "bg-slate-900 border border-emerald-500/20 text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {crop}
            </button>
          ))}
        </div>
      </div>

      {/* Main Gantt Grid and Focus Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: 12-Month Visual Grid Tracker */}
        <div className="xl:col-span-8 space-y-4">
          
          <div className="bg-slate-950/45 border border-slate-900 rounded-2xl p-5 relative">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Active Crop Season Timeline Grid ({selectedCrop})
              </span>
              
              <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] text-slate-500 select-none">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-slate-900 rounded-sm border border-slate-700" /> Prep
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-blue-900/50 rounded-sm border border-blue-500/20" /> Seed / Nurse
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-amber-900/50 rounded-sm border border-amber-500/20" /> Maintenance
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-emerald-950/50 rounded-sm border border-emerald-500/20" /> Harvest
                </span>
              </div>
            </div>

            {/* Interactive Gantt Chart mapping */}
            {!isLowBandwidth ? (
              <div className="grid grid-cols-12 gap-2">
                {cropData.schedule.map((slot) => {
                  const colors = ACTIVITY_COLORS[slot.activity];
                  const isActive = slot.month === activeMonth;

                  return (
                    <div 
                      key={slot.month}
                      onClick={() => setActiveMonth(slot.month)}
                      className={`hover:-translate-y-1 cursor-pointer transition-all duration-200 text-center flex flex-col justify-between min-h-[140px] rounded-xl border p-2.5 ${colors.bg} ${colors.border} ${
                        isActive 
                          ? "ring-2 ring-emerald-400 border-transparent shadow shadow-emerald-500/20 -translate-y-1" 
                          : "opacity-85 hover:opacity-100"
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-200 block font-mono">
                        {slot.month}
                      </span>

                      {/* Workload Pill Indicator */}
                      <div className="my-2 select-none">
                        <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded ${
                          slot.workload === "High"
                            ? "bg-red-950/40 text-red-400 border border-red-500/10"
                            : slot.workload === "Medium"
                              ? "bg-amber-950/40 text-amber-400 border border-amber-500/10"
                              : "bg-slate-900 text-slate-500"
                        }`}>
                          {slot.workload}
                        </span>
                      </div>

                      {/* Micro Icon visualizer */}
                      <div className="text-[10px] truncate uppercase font-bold tracking-wider font-mono scale-[0.8] leading-none">
                        {slot.activity.split(" ").slice(0, 1).join("")}
                      </div>

                      <div className="mt-1 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            slot.activity === "Harvesting" ? "bg-emerald-500" :
                            slot.activity === "Nursery / Sowing" ? "bg-blue-500" :
                            slot.activity === "Weeding & Maintenance" ? "bg-amber-500" : "bg-slate-700"
                          }`}
                          style={{
                            width: slot.workload === "High" ? "100%" :
                                   slot.workload === "Medium" ? "65%" : "30%"
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Simple text-based layout for Low Bandwidth parameters
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {cropData.schedule.map(slot => (
                  <div 
                    key={slot.month}
                    onClick={() => setActiveMonth(slot.month)}
                    className="flex justify-between items-center text-xs font-mono p-2 border-b border-slate-900 hover:bg-slate-905 cursor-pointer"
                  >
                    <span className="font-bold text-slate-200">{slot.month} - {slot.activity}</span>
                    <span className="text-slate-500">Workload: {slot.workload}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Climate indices warnings overlay */}
            <div className="mt-4 pt-3.5 border-t border-slate-900/60 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-2.5 text-xs font-mono text-slate-400">
                <Sun className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Dry Harmattan Index:</strong> Dry northeast wind triggers peak cocoa seed-sweating conditions during Dec-Feb. Shield fragile outdoor seedlings.
                </p>
              </div>

              <div className="flex items-start gap-2.5 text-xs font-mono text-slate-400">
                <CloudRain className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Heavy Monsoon Flash:</strong> Rain coefficient peaks in Jul-Aug. Swamp Rice parboiling operators must lock vacuum covers to protect dried grains.
                </p>
              </div>
            </div>

          </div>

          {/* Regional adaptation note banner */}
          <div className="bg-[#050914] border border-slate-900 p-4 rounded-xl flex items-start gap-3 text-xs font-mono text-slate-300 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-400 block mb-0.5 uppercase tracking-wider text-[10px]">
                Adaptive Regional Calibration Info Card
              </span>
              <p>{regionalAdjustmentNotes}</p>
            </div>
          </div>

        </div>

        {/* Right Side: Selected Activity details spotlight */}
        <div className="xl:col-span-4 bg-slate-9s0 p-1 rounded-2xl">
          
          <div className="bg-[#050914] border border-slate-900 rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-900 pb-2.5 flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider">
                Monthly Activity Spotlight
              </span>
              <span className="text-xs font-bold text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/10 px-2 py-0.5 rounded">
                {activeMonthDetail.month} Focus
              </span>
            </div>

            {/* Current Activity and Work level */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Farmed Action Pipeline</span>
              <div className="text-sm font-bold text-slate-200">
                {activeMonthDetail.activity}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[9px] font-mono text-slate-500">Workload coefficient:</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded leading-none ${
                  activeMonthDetail.workload === "High"
                    ? "bg-red-950/40 text-red-400 border border-red-500/15"
                    : activeMonthDetail.workload === "Medium"
                      ? "bg-amber-950/40 text-amber-400 border border-amber-500/15"
                      : "bg-slate-900 text-slate-400"
                }`}>
                  {activeMonthDetail.workload} Intensity
                </span>
              </div>
            </div>

            {/* Operational directives explanation */}
            <div className="space-y-1.5 bg-slate-950 p-4 border border-slate-900 rounded-xl">
              <span className="text-[9px] font-mono text-slate-500 block uppercase tracking-wider">
                AVDP Field Coordinator Directive
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {activeMonthDetail.desc}
              </p>
            </div>

            {/* Interactive District calibrated filter selector */}
            {!selectedDistrict && (
              <div className="border-t border-slate-900 pt-3.5 space-y-2">
                <label className="block text-[10px] font-mono uppercase text-slate-500">
                  Calibrate layout by District:
                </label>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="w-full bg-slate-950 text-slate-300 border border-slate-850 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="All">All Regions (Standard baseline)</option>
                  {SIERRA_LEONE_DISTRICTS.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Warning tag */}
            <div className="pt-2 border-t border-slate-900 text-[10px] leading-relaxed text-slate-500 flex items-start gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 mt-0.5" />
              <span>
                Note: Interventions timelines are tracked under IFAD strategic metrics frameworks automatically synced with central ground teams.
              </span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
