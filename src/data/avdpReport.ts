// AVDP June 2026 IFAD Supervision Mission data (from the official presentation deck).
// Structured for the dashboard's reporting tabs. Figures are cumulative-achieved
// vs total target unless noted.

export interface ProgressRow {
  label: string;
  unit?: string;
  totalTarget: number;
  achieved: number;      // cumulative achieved
  plan2026?: number;
  status?: string;
}
export interface ProgressGroup {
  id: string;
  title: string;
  summary: string;
  unit: string;
  rows: ProgressRow[];
}

export const AVDP_REPORT = {
  meta: {
    title: "AVDP Presentation to IFAD Supervision Mission",
    date: "3 June 2026",
    venue: "AVDP Conference Hall, Bo",
  },
  summary: {
    households: 43000,
    beneficiaries: 258000,
    womenPct: 40,
    youthPct: 40,
    valueChains: ["Rice", "Oil Palm", "Cocoa", "Vegetables"],
    goal: "Improve livelihoods, food security and climate-change resilience of rural farming households in Sierra Leone.",
    objective: "Increase incomes for smallholder farmers through the promotion of agriculture as a business.",
    components: [
      "C1 · Climate-Resilient & Smart Agricultural Production",
      "C2 · Agricultural Market Development",
      "C3 · Project Coordination & Management",
    ],
  },

  progress: [
    {
      id: "ffs", unit: "FFS",
      title: "Farmer Field Schools & Technical Support",
      summary: "851 of 936 target FFS completed across all value chains",
      rows: [
        { label: "Rice – New IVS", totalTarget: 255, achieved: 175, plan2026: 80, status: "80 FFS in first cycle; close by 2027" },
        { label: "Rice – Legacy IVS", totalTarget: 200, achieved: 200, status: "Target achieved" },
        { label: "Cocoa", totalTarget: 300, achieved: 300, plan2026: 140, status: "2 cycles complete; +40 FFS for fruiting farms" },
        { label: "Oil Palm", totalTarget: 166, achieved: 166, plan2026: 40, status: "2 cycles complete" },
        { label: "Vegetables (Onion, Tomato, Hot Pepper)", totalTarget: 15, achieved: 10, plan2026: 5, status: "5 FFS in first cycle → close 2027" },
      ],
    },
    {
      id: "infra", unit: "",
      title: "IVS Development, Irrigation, Dams & Grain Stores",
      summary: "4,500 ha IVS rehabilitated; 30 of 60 dams and 24 of 50 boreholes underway",
      rows: [
        { label: "IVS Rehabilitation / Development", unit: "ha", totalTarget: 5100, achieved: 4500, plan2026: 600, status: "Remaining 300 ha by May 2027" },
        { label: "Earth Dams / Fish Farms", unit: "units", totalTarget: 60, achieved: 30, plan2026: 17, status: "12 at various stages" },
        { label: "Borehole Irrigation Schemes", unit: "units", totalTarget: 50, achieved: 24, plan2026: 20, status: "Tower construction in progress" },
        { label: "Grain Stores / ABC Infrastructure", unit: "units", totalTarget: 40, achieved: 23, plan2026: 10, status: "2026 batch at 70%" },
      ],
    },
    {
      id: "treecrops", unit: "",
      title: "Cocoa & Oil Palm Farm Development + SLARI Seed Garden",
      summary: "Cocoa & oil-palm development largely achieved; clonal seed garden & processing nearing completion",
      rows: [
        { label: "New Cocoa Farms", unit: "ha", totalTarget: 9000, achieved: 6000, plan2026: 3000, status: "Outplanting of 3,000 ha Jun/Jul 2026" },
        { label: "25 ha Climate-Smart Model Cocoa Farms", unit: "ha", totalTarget: 25, achieved: 25, status: "Fruiting commenced" },
        { label: "5 ha Demo Farms – Oil Palm", unit: "ha", totalTarget: 5, achieved: 5, status: "Fruiting commenced" },
        { label: "New Oil Palm Farms", unit: "ha", totalTarget: 5000, achieved: 5000, status: "Target achieved" },
        { label: "SLARI Cocoa Clonal Seed Garden", unit: "ha", totalTarget: 15, achieved: 15, status: "Target achieved" },
        { label: "District Cocoa Seed Multiplication Farms", unit: "ha", totalTarget: 5, achieved: 4, plan2026: 1, status: "1 ha Kono in progress" },
        { label: "Oil Palm ABC Processing Infrastructure", unit: "units", totalTarget: 40, achieved: 10, plan2026: 10, status: "80% complete" },
      ],
    },
    {
      id: "veg", unit: "",
      title: "Vegetable Value Chains & Tubers",
      summary: "Model farms fully established; onion & tomato fields on track for Oct 2026 planting",
      rows: [
        { label: "Bulb Onions", unit: "ha", totalTarget: 1200, achieved: 840, plan2026: 160, status: "Inputs procured; planting Oct 2026" },
        { label: "Tomatoes & Hot Pepper", unit: "ha", totalTarget: 150, achieved: 100, plan2026: 50, status: "Field establishment Oct 2026" },
        { label: "Greenhouses for Vegetable Cultivation", unit: "units", totalTarget: 20, achieved: 18, plan2026: 2, status: "2 units under construction" },
        { label: "15 ha Vegetable Model Farms", unit: "ha", totalTarget: 15, achieved: 15, status: "Port Loko, Koinadugu, Falaba" },
        { label: "Cassava & OFSP", unit: "ha", totalTarget: 850, achieved: 600, plan2026: 250, status: "First weeding in progress" },
      ],
    },
    {
      id: "markets", unit: "",
      title: "Agricultural Markets Development",
      summary: "8 commodity platforms piloted, 16 B2B events held, 300 partnerships targeted",
      rows: [
        { label: "Commodity Platform / MSP Pilots", unit: "platforms", totalTarget: 12, achieved: 8, plan2026: 4 },
        { label: "Provincial B2B Platform Events", unit: "events", totalTarget: 24, achieved: 16, plan2026: 4 },
        { label: "Business Development & Leadership Training", unit: "courses", totalTarget: 3, achieved: 0 },
        { label: "Market Linkages – Private Sector Partnerships", unit: "partnerships", totalTarget: 300, achieved: 200, plan2026: 50 },
      ],
    },
    {
      id: "gender", unit: "HHs",
      title: "Gender Mainstreaming (GALS) & Nutrition Education",
      summary: "GALS & nutrition education embedded across all value chains; targeting 56,000+ households",
      rows: [
        { label: "Rice – IVS", totalTarget: 6375, achieved: 11567, status: "Integrated into all IVS FFS cycles" },
        { label: "Cocoa", totalTarget: 9000, achieved: 9076, status: "Operational across all 300 FFS" },
        { label: "Oil Palm", totalTarget: 5000, achieved: 4998, status: "VSLAs supporting women" },
        { label: "Vegetables", totalTarget: 36000, achieved: 9612, status: "Scale-up; nutrition education central" },
        { label: "Cassava & Sweet Potato", totalTarget: 2550, achieved: 2484, status: "Rolling out with farm establishment" },
      ],
    },
    {
      id: "climateinfra", unit: "",
      title: "Climate-Smart Rural Infrastructure",
      summary: "401 km of 420 km feeder roads rehabilitated; offices & sanitation largely complete",
      rows: [
        { label: "Feeder Road Rehabilitation", unit: "km", totalTarget: 420, achieved: 401, plan2026: 19, status: "401 km at 60% completion" },
        { label: "Farm Tracks", unit: "km", totalTarget: 150, achieved: 75, plan2026: 75, status: "75 km at 70%" },
        { label: "Warehouse Rehabilitation", unit: "units", totalTarget: 10, achieved: 2 },
        { label: "Structures / Road Crossings", unit: "units", totalTarget: 14, achieved: 8, plan2026: 6 },
        { label: "MAFS Agric. Offices / Regional HQ", unit: "units", totalTarget: 3, achieved: 2, plan2026: 1 },
        { label: "BES Compounds", unit: "units", totalTarget: 15, achieved: 5, plan2026: 3 },
        { label: "Water Points & VIP Latrines", unit: "units", totalTarget: 50, achieved: 45, status: "Complete" },
      ],
    },
  ] as ProgressGroup[],

  production: [
    { valueChain: "Rice", unit: "MT", p2024: 3621.4, p2025: 5126.5, p2026: null, partner: "WFP (5 aggregators)", s2025: 100, s2026: 160 },
    { valueChain: "Cocoa", unit: "MT", p2024: 1200, p2025: 1800, p2026: null, partner: "FT SAAD", s2025: 1800, s2026: null },
    { valueChain: "Oil Palm", unit: "MT", p2024: 1500, p2025: 10000, p2026: 3000, partner: "Traders", s2025: 10000, s2026: 3000 },
    { valueChain: "Vegetables (Onions)", unit: "MT", p2024: 5528, p2025: 9481.6, p2026: null, partner: "5 Cooperatives", s2025: 9481.6, s2026: 1790 },
    { valueChain: "Tomato & Hot Pepper", unit: "MT", p2024: 46.4, p2025: 93.6, p2026: null, partner: "5 Cooperatives", s2025: 93.6, s2026: 86.3 },
  ] as { valueChain: string; unit: string; p2024: number; p2025: number; p2026: number | null; partner: string; s2025: number | null; s2026: number | null }[],

  yields: {
    rice: { supported2024: 2.39, supported2025: 2.8, non2024: 1.74, non2025: 1.9, farms: 172 },
    others: [
      { crop: "Bulb Onions", value: 41.24, year: "2023 avg", note: "28.54 in 2024 (Port Loko, Falaba, Koinadugu)" },
      { crop: "Oil Palm", value: 3.44, year: "2025", note: "First yield study" },
      { crop: "Cocoa", value: 1.2, year: "2025", note: "First yield study" },
    ],
  },

  aos: [
    "56% of FBOs reported increased production vs 2024",
    "95.6% of households adopted new/improved inputs, technologies or practices",
    "78.5% adopted environmentally sustainable, climate-resilient practices",
    "93.3% put at least some land under climate-resilient practices",
    "64.1% of households reported an increase in production",
    "93% of IVS fields properly laid out with bunds & drainage; 83% suitable for double cropping",
    "Empowerment: Male-headed HHs 87.1%, Female-headed HHs 87.8%",
    "Women's minimum dietary diversity (≥5 groups): 97.7% (FHH), 95.9% (MHH)",
  ],

  jobsByDistrict: [
    { district: "Kono", jobs: 120 }, { district: "Koinadugu", jobs: 146 }, { district: "Bo", jobs: 116 },
    { district: "Port Loko", jobs: 109 }, { district: "Kenema", jobs: 89 }, { district: "Moyamba", jobs: 79 },
    { district: "Bonthe", jobs: 74 }, { district: "Pujehun", jobs: 64 }, { district: "Kailahun", jobs: 49 },
  ],
  jobsTotal: 846,

  pwdaByDistrict: [
    { district: "Port Loko", count: 80 }, { district: "Pujehun", count: 65 }, { district: "Koinadugu", count: 42 },
    { district: "Moyamba", count: 40 }, { district: "Kailahun", count: 38 }, { district: "Kenema", count: 30 },
    { district: "Kono", count: 25 }, { district: "Falaba", count: 24 }, { district: "Bo", count: 21 },
    { district: "Tonkolili", count: 21 }, { district: "Bonthe", count: 19 }, { district: "Bombali", count: 14 },
    { district: "Karene", count: 14 }, { district: "Kambia", count: 7 }, { district: "Western Area Rural", count: 4 },
  ],
  pwdaTotal: 444,

  procurement: {
    y2025: [
      { method: "ICB (Goods & Works)", value: 19114489 },
      { method: "NS (Goods & Works)", value: 471241.38 },
      { method: "QCBS", value: 345410.35 },
    ],
    y2025Total: 19931140.73,
    portfolio: [
      { category: "Goods", prior: 1769155.27, post: 203099.55, total: 1972254.82 },
      { category: "Works", prior: 2858534.18, post: 135451.0, total: 2993985.18 },
      { category: "Consulting Services", prior: 174740.0, post: 0, total: 174740.0 },
    ],
    portfolioTotal: 5140980.0,
    major: [
      { phase: "Bidding", activity: "Value Addition Equipment & Ancillary Materials", value: 566182.27 },
      { phase: "Bidding", activity: "Construction of 74.56 km Farm Tracks", value: 801000.0 },
      { phase: "Contract Mgmt", activity: "Rehabilitation of 6 Bridges", value: 717533.18 },
      { phase: "Contract Mgmt", activity: "20 Boreholes with Irrigation Systems", value: 770001.0 },
      { phase: "Contract Mgmt", activity: "19 km Additional Feeder Road", value: 570000.0 },
      { phase: "Contracting", activity: "Farm Tools for 2026", value: 324452.0 },
      { phase: "Contracting", activity: "Vegetable Seeds for 2026", value: 186182.0 },
      { phase: "Planning", activity: "Fish Feed & Fingerlings 2026", value: 163630.0 },
    ],
  },

  finance: [
    "FY2025 annual audit started April 2026; desk & field reviews complete; draft management letters issued and responded to.",
    "Q4 2025 IFRs submitted on time (Feb 2026); Q1 2026 IFRs submitted 13 May 2026 (before deadline).",
  ],

  // Procurement Plan implementation by stage (Jan–May 2026)
  procurementPipeline: {
    stages: [
      { stage: "Planning", count: 3, value: 176970.0 },
      { stage: "Bidding", count: 5, value: 1636622.27 },
      { stage: "Contracting", count: 2, value: 510634.0 },
      { stage: "Contract Management", count: 13, value: 2816753.73 },
    ],
    total: { count: 23, value: 5140980.0 },
  },

  // Targets the PMU has flagged as unrealistic and requested be reviewed/reduced
  targetsUnderReview: [
    {
      target: "Employment Creation",
      planned: 7360,
      achieved: 846,
      unit: "HHs",
      note: "846 jobs created (11.5%). Road-job beneficiaries show little interest; contractors use fixed external teams and machines, employing few community members.",
    },
    {
      target: "Potable Water & Sanitation",
      planned: 9000,
      achieved: null,
      unit: "HHs",
      note: "Services were complementary to existing beneficiaries; avoiding duplication means actual new beneficiaries are far fewer than the 9,000 HH target.",
    },
  ] as { target: string; planned: number; achieved: number | null; unit: string; note: string }[],

  challenges: [
    { category: "Logistics & Infrastructure", challenges: ["Poor rural roads limit site access", "High transport costs", "Inadequate storage & cold chain"], recommendations: ["Invest in feeder roads & aggregation centres", "Establish cold chains for perishables", "Strengthen post-harvest systems"] },
    { category: "Climate & Environment", challenges: ["Erratic rainfall & IVS flooding", "Soil degradation & erosion", "Rising pest/disease pressure"], recommendations: ["Scale solar & drip irrigation", "Promote composting & soil fertility", "Encourage agroforestry & crop rotation"] },
    { category: "Market Access & Value Chain", challenges: ["Limited reliable buyers", "Price volatility & middlemen", "Weak value-addition facilities"], recommendations: ["Link farmers to off-takers via contract farming", "Incentivise private processing", "Create MSP dialogue platforms"] },
    { category: "Sustainability & Exit", challenges: ["Over-reliance on subsidies", "Weak private sector continuity", "Limited local institutional ownership"], recommendations: ["Build VSLA & cooperative governance", "Align with national agri policy & budgets", "Transfer capacity to MAFS & districts"] },
  ],
};
