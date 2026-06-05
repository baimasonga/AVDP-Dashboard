import { useState } from "react";
import { Indicator } from "../types";
import MapSection from "./MapSection";
import ValueChainMap from "./ValueChainMap";
import { Locate, Layers } from "lucide-react";

interface Props {
  indicators: Indicator[];
  selectedDistrict: string | null;
  onSelectDistrict: (d: string | null) => void;
  isLowBandwidth: boolean;
}

// GIS tab: switch between the AVDP activity-site locator and the thematic map.
export default function GisWorkspace({ indicators, selectedDistrict, onSelectDistrict, isLowBandwidth }: Props) {
  const [view, setView] = useState<"sites" | "thematic">("sites");

  const tab = (id: "sites" | "thematic", label: string, Icon: any) => (
    <button
      onClick={() => setView(id)}
      className={`flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg border transition-all cursor-pointer ${
        view === id
          ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {tab("sites", "Activity Sites", Locate)}
        {tab("thematic", "Thematic Map", Layers)}
      </div>

      {view === "sites" ? (
        <ValueChainMap
          selectedDistrict={selectedDistrict}
          onSelectDistrict={onSelectDistrict}
          isLowBandwidth={isLowBandwidth}
        />
      ) : (
        <MapSection
          indicators={indicators}
          selectedDistrict={selectedDistrict}
          onSelectDistrict={onSelectDistrict}
          isLowBandwidth={isLowBandwidth}
        />
      )}
    </div>
  );
}
