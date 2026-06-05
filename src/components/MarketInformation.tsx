import React, { useState, useMemo } from "react";
import { Indicator } from "../types";
import { SIERRA_LEONE_DISTRICTS } from "../data";
import { 
  DollarSign, TrendingUp, ShoppingBag, ArrowUpRight, Award, 
  MapPin, Settings2, Sparkles, Building2, HelpCircle, Eye, 
  Layers, CheckCircle, Scale, ShieldAlert, BookOpen
} from "lucide-react";

interface MarketInformationProps {
  indicators: Indicator[];
  selectedDistrict: string | null;
  isLowBandwidth: boolean;
}

// Fixed real-world parameters representing AVDP value-chain dynamics in Sierra Leone
const AVDP_VALUE_CHAINS = [
  {
    commodity: "Rice" as const,
    description: "Inland Valley Swamps (IVS) rehabilitation & custom concrete bund systems. Rice parboiling and milling cooperative hubs reduce post-harvest moisture ruins.",
    hubs: ["Kambia", "Moyamba", "Port Loko", "Bonthe"],
    units: "bag (50kg)",
    farmgateSll: 380000,   // SLL per 50kg bag
    fairTradeSll: 510000,  // AVDP certified offtaker price
    middlemanSll: 290000,  // Open market trader without infrastructure
    processingPremiumPct: 35,
    spillageReductionPct: 18, // lower post-harvest loss due to feeder roads
  },
  {
    commodity: "Cocoa" as const,
    description: "High-grade organic beans with cooperative sun-dry beds & raised fermentation boxes. Certified shade-grown estates earn fairtrade export premium slots.",
    hubs: ["Kailahun", "Kenema", "Kono"],
    units: "bag (64kg)",
    farmgateSll: 950000,
    fairTradeSll: 1350000,
    middlemanSll: 700000,
    processingPremiumPct: 45,
    spillageReductionPct: 12,
  },
  {
    commodity: "Vegetables" as const,
    description: "Onion, pepper and Irish-potato production in inland valley swamps and the Koinadugu/Falaba highlands. Aggregation through agri-business centres with ventilated storage cuts dry-season gluts and spoilage.",
    hubs: ["Koinadugu", "Falaba", "Port Loko", "Bombali"],
    units: "bag (50kg)",
    farmgateSll: 300000,
    fairTradeSll: 460000,
    middlemanSll: 220000,
    processingPremiumPct: 30,
    spillageReductionPct: 22,
  },
  {
    commodity: "Oil Palm" as const,
    description: "Hybrid Tenera seedlings supply chains coupled with mini mechanical palm oil digestors. Clean palm kernel extraction yields industrial-grade olein.",
    hubs: ["Bonthe", "Pujehun", "Bo", "Tonkolili"],
    units: "gallon (20L)",
    farmgateSll: 240000,
    fairTradeSll: 340000,
    middlemanSll: 180000,
    processingPremiumPct: 42,
    spillageReductionPct: 20,
  }
];

// Offtakers Registered Database
const OFFTAKER_DIRECTORY = [
  {
    id: "OT-001",
    name: "Sierra Coast Rice Mill Syndicate",
    commodity: "Rice",
    districts: ["Kambia", "Port Loko"],
    yearlyQuotaMetricTons: 1500,
    filledPct: 68,
    status: "Active Quota",
    unitPriceSll: "10,200,000 per MT"
  },
  {
    id: "OT-002",
    name: "Kailahun Rainforest Cocoa Export Union",
    commodity: "Cocoa",
    districts: ["Kailahun", "Kenema"],
    yearlyQuotaMetricTons: 850,
    filledPct: 82,
    status: "Active Quota",
    unitPriceSll: "21,090,000 per MT"
  },
  {
    id: "OT-003",
    name: "Njala Bio-Palm Logistics",
    commodity: "Oil Palm",
    districts: ["Bonthe", "Pujehun", "Bo"],
    yearlyQuotaMetricTons: 2000,
    filledPct: 45,
    status: "Active Quota",
    unitPriceSll: "17,000,000 per MT"
  },
  {
    id: "OT-004",
    name: "Highland Fresh Produce Aggregators",
    commodity: "Vegetables",
    districts: ["Koinadugu", "Falaba", "Bombali"],
    yearlyQuotaMetricTons: 600,
    filledPct: 91,
    status: "Capacity Reached",
    unitPriceSll: "18,330,000 per MT"
  }
];

export default function MarketInformation({
  indicators,
  selectedDistrict,
  isLowBandwidth
}: MarketInformationProps) {
  // Config state
  const [activeChainComm, setActiveChainComm] = useState<"Rice" | "Cocoa" | "Vegetables" | "Oil Palm">("Rice");
  
  // Interactive Calculator Slider / Form State
  const [harvestInputQty, setHarvestInputQty] = useState<number>(50); // e.g. 50 bags/gallons
  const [isProcessingApplied, setIsProcessingApplied] = useState<boolean>(true); // AVDP assisted value addition
  const [useRehabilitatedRoad, setUseRehabilitatedRoad] = useState<boolean>(true); // lower transport spillage losses

  // Filter hubs based on district selections
  const chainInfo = useMemo(() => {
    return AVDP_VALUE_CHAINS.find(v => v.commodity === activeChainComm)!;
  }, [activeChainComm]);

  // Compute calculated metrics
  const calculatorResults = useMemo(() => {
    const rawQty = harvestInputQty;

    // 1. Compute physical volume retention
    // If not using rehabilitated roads, we lose weight due to transit delays, spillage, and moisture damage
    const transportLossPct = useRehabilitatedRoad ? 2 : (2 + chainInfo.spillageReductionPct);
    const retainedQty = parseFloat((rawQty * (1 - transportLossPct / 100)).toFixed(1));

    // 2. Pricing selection
    // Standard Middleman: low prices, no value addition
    // AVDP Cooperative / Offtaker: certified quality price or processing premium price
    const basePrice = isProcessingApplied ? chainInfo.fairTradeSll : chainInfo.farmgateSll;
    const middlemanPrice = chainInfo.middlemanSll;

    // Total earnings
    const totalAvdpEarningsSll = Math.round(retainedQty * basePrice);
    const totalMiddlemanEarningsSll = Math.round(rawQty * middlemanPrice);

    const netIncrementalRevenueSll = Math.max(0, totalAvdpEarningsSll - totalMiddlemanEarningsSll);
    const percentageGrowth = totalMiddlemanEarningsSll > 0 
      ? Math.round((netIncrementalRevenueSll / totalMiddlemanEarningsSll) * 100)
      : 0;

    return {
      retainedQty,
      transportLossPct,
      totalAvdpEarningsSll,
      totalMiddlemanEarningsSll,
      netIncrementalRevenueSll,
      percentageGrowth
    };
  }, [harvestInputQty, isProcessingApplied, useRehabilitatedRoad, chainInfo]);

  // Format Sierra Leone Leones beautifully
  const formatSLL = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num) + " SLL";
  };

  // Check if chosen district matches active chain hubs
  const isDistrictActiveForChain = useMemo(() => {
    if (!selectedDistrict) return true;
    return chainInfo.hubs.some(h => h.toLowerCase() === selectedDistrict.toLowerCase());
  }, [selectedDistrict, chainInfo]);

  return (
    <div className="bg-[#0b1329] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden" id="avdp-market-value-chains">
      {/* Background graphic flare */}
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="border-b border-slate-800 pb-5 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-teal-400" />
            <h3 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
              AVDP Value Chains & Market Access Intelligence Portal
            </h3>
            <span className="text-[9px] bg-teal-950 border border-teal-500/25 text-teal-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
              IFAD G-100 Standard
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time farmgate indexation, transport yield-spillage modeling, and export buyer direct offtaker quotas verification.
          </p>
        </div>

        {/* Value Chain selectors */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-900">
          {AVDP_VALUE_CHAINS.map(vc => (
            <button
              key={vc.commodity}
              onClick={() => setActiveChainComm(vc.commodity)}
              className={`text-[11px] font-mono px-3 py-1.5 rounded-lg cursor-pointer font-bold uppercase transition-all ${
                activeChainComm === vc.commodity
                  ? "bg-slate-900 border border-teal-500/20 text-teal-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {vc.commodity}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Workdesk */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left Hand: Core statistics feed card & details */}
        <div className="xl:col-span-5 space-y-4">
          
          {/* Main chain overview */}
          <div className="bg-slate-950/45 border border-slate-900 p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-5">
              <Layers className="w-24 h-24 text-slate-100" />
            </div>

            <span className="text-[10px] font-mono text-teal-400 font-bold uppercase tracking-widest block mb-1">
              Active Value Chain Framework
            </span>
            <h4 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
              AVDP Assisted {chainInfo.commodity} Chain
              <Award className="w-4 h-4 text-amber-400" />
            </h4>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              {chainInfo.description}
            </p>

            {/* Geographical verification info */}
            <div className="mt-4 pt-3 border-t border-slate-900/60 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase block">AVDP Infrastructure Hubs</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {chainInfo.hubs.map(h => (
                    <span 
                      key={h} 
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        selectedDistrict?.toLowerCase() === h.toLowerCase()
                          ? "bg-teal-950 border border-teal-500/30 text-teal-300 font-bold animate-pulse"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Focus Verification Status</span>
                {selectedDistrict ? (
                  <span className={`text-[10px] font-mono font-bold mt-1 block ${
                    isDistrictActiveForChain ? "text-emerald-400" : "text-amber-500"
                  }`}>
                    {isDistrictActiveForChain 
                      ? "✓ Active in selection" 
                      : "⚠ Region outside main hubs"}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                    All Districts Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Leone Index Pricing Grid Matrix */}
          <div className="bg-[#050914] border border-slate-900 p-4 rounded-xl space-y-3 font-mono">
            <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
              Leone Commodity Valuation Matrix (per {chainInfo.units})
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-900/40">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                  Local Open Market Middleman Price:
                </span>
                <span className="font-bold text-red-400">{formatSLL(chainInfo.middlemanSll)}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-900/40">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  AVDP Cooperative Raw Farmgate index:
                </span>
                <span className="font-bold text-blue-400">{formatSLL(chainInfo.farmgateSll)}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-900/40">
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  AVDP Value-Added Offtaker Price:
                </span>
                <span className="font-bold text-teal-400">{formatSLL(chainInfo.fairTradeSll)}</span>
              </div>

              <div className="bg-teal-950/20 border border-teal-500/10 p-2.5 rounded-lg flex items-center justify-between text-[11px] text-teal-300">
                <span className="flex items-center gap-1.5 font-bold">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                  Value addition gain:
                </span>
                <span className="font-mono font-bold">+{chainInfo.processingPremiumPct}% per unit SLL</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Hand: Margin Estimator Simulator & Offtaker directory */}
        <div className="xl:col-span-7 space-y-4">
          
          {/* Dynamic Smallholder Arbitrage Margin Calculator */}
          <div className="bg-[#050914] border border-slate-900 p-5 rounded-2xl space-y-4 relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                  Interactive Co-operative Margin Estimator
                </span>
                <h5 className="text-xs font-semibold text-slate-200">
                  Model profitability of processed yields against middlemen exploitation
                </h5>
              </div>
              <Scale className="w-5 h-5 text-teal-400 shrink-0" />
            </div>

            {/* Inputs Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Slider Input Quantity */}
              <div className="space-y-1.5 bg-slate-950/50 p-3 rounded-xl border border-slate-900">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-300 font-bold uppercase tracking-tight">Est. Harvest Volume</span>
                  <span className="text-teal-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {harvestInputQty} {chainInfo.units}s
                  </span>
                </div>
                <input 
                  type="range"
                  min="5"
                  max="200"
                  value={harvestInputQty}
                  onChange={(e) => setHarvestInputQty(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>5 units</span>
                  <span>100 units</span>
                  <span>200 units</span>
                </div>
              </div>

              {/* Toggles Group */}
              <div className="space-y-2.5 flex flex-col justify-center">
                
                {/* Toggle 1: Post harvest processing */}
                <label className="flex items-center gap-3 cursor-pointer group text-xs font-mono text-slate-300">
                  <input 
                    type="checkbox"
                    checked={isProcessingApplied}
                    onChange={(e) => setIsProcessingApplied(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-800 text-teal-500 focus:ring-opacity-0 bg-slate-950 accent-teal-500"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold group-hover:text-teal-400 transition-colors">Apply AVDP Processing</span>
                    <span className="text-[9px] text-slate-500">Fermentation boxes / parboiler hulling</span>
                  </div>
                </label>

                {/* Toggle 2: Road Rehabilitation */}
                <label className="flex items-center gap-3 cursor-pointer group text-xs font-mono text-slate-300">
                  <input 
                    type="checkbox"
                    checked={useRehabilitatedRoad}
                    onChange={(e) => setUseRehabilitatedRoad(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-800 text-teal-500 focus:ring-opacity-0 bg-slate-950 accent-emerald-500"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold group-hover:text-emerald-400 transition-colors">Climate-Resilient Roads</span>
                    <span className="text-[9px] text-slate-500">Less physical spillage during transit</span>
                  </div>
                </label>

              </div>

            </div>

            {/* Calculations comparative display ledger */}
            <div className="bg-slate-950 border border-slate-900/60 p-4 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
                
                {/* Traditional Middleman output parameters */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono text-slate-500 uppercase block tracking-wider">
                    Unassisted Trader Open-Market Route
                  </span>
                  <div className="text-lg font-bold text-slate-300">
                    {formatSLL(calculatorResults.totalMiddlemanEarningsSll)}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Full post-harvest moisture decays, uncooperative bulk weights, zero road transit mitigation offsets.
                  </p>
                </div>

                {/* AVDP Offtaker output parameters */}
                <div className="space-y-1.5 md:pl-4">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-mono text-teal-400 font-bold uppercase tracking-wider block">
                      AVDP Certified Link Outcomes
                    </span>
                    <span className="text-[9px] bg-teal-950 text-teal-400 px-1.5 rounded font-mono font-bold animate-pulse uppercase">
                      +{calculatorResults.percentageGrowth}% Return
                    </span>
                  </div>
                  <div className="text-lg font-bold text-teal-400">
                    {formatSLL(calculatorResults.totalAvdpEarningsSll)}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Includes road rehabilitation savings ({100 - calculatorResults.transportLossPct}% retained yield) and value-addition multiplier premiums.
                  </p>
                </div>

              </div>

              {/* Incremental Difference Banner */}
              <div className="mt-4 pt-3 border-t border-slate-900/60 flex flex-col sm:flex-row justify-between items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">
                  Incremental profit retained inside local cooperative:
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-500/25 px-3 py-1 rounded-lg">
                  +{formatSLL(calculatorResults.netIncrementalRevenueSll)} Net Gain
                </span>
              </div>
            </div>

          </div>

          {/* Offtakers Registry Contract Directory */}
          <div className="bg-[#050914] border border-slate-900 p-4 rounded-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-900 pb-2">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
                Certified AVDP Offtaker Partnerships & Quota Directory
              </span>
              <span className="text-[9px] font-mono text-slate-500">IFAD audit checked</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {OFFTAKER_DIRECTORY.map((ot) => {
                const isActiveCommodity = ot.commodity === activeChainComm;
                return (
                  <div 
                    key={ot.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isActiveCommodity 
                        ? "bg-slate-950/90 border-slate-800/80" 
                        : "bg-slate-950/30 border-slate-950/80 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <h6 className="text-xs font-bold text-slate-200 truncate max-w-[150px]" title={ot.name}>
                        {ot.name}
                      </h6>
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        ot.status === "Capacity Reached"
                          ? "bg-red-950/30 text-red-400 border border-red-500/10"
                          : "bg-emerald-950/30 text-emerald-400 border border-emerald-500/10"
                      }`}>
                        {ot.status}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-mono leading-tight text-slate-500">
                      <div>
                        <span>Commodity Focal</span>
                        <span className="block font-bold text-slate-300">{ot.commodity}</span>
                      </div>
                      <div>
                        <span>Agreement Price</span>
                        <span className="block font-bold text-teal-400">{ot.unitPriceSll}</span>
                      </div>
                    </div>

                    {/* Progress Fill bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-slate-500">Target Quota Fulfilled:</span>
                        <span className="text-slate-300 font-bold">{ot.filledPct}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            ot.filledPct > 80 ? "bg-amber-500" : "bg-teal-500"
                          }`}
                          style={{ width: `${ot.filledPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
