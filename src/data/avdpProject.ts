// Real AVDP project facts (for headline KPIs, legends, about panels).
// Sources: www.avdp.org.sl and IFAD project 2000001544.

export const AVDP_PROJECT = {
  name: "Agricultural Value Chain Development Project (AVDP)",
  country: "Sierra Leone",
  funders: ["IFAD", "Adaptation Fund", "OFID", "Government of Sierra Leone", "Private sector", "Beneficiaries"],
  districtsCovered: 15,
  valueChains: ["Rice", "Oil Palm", "Cocoa", "Vegetables"] as const,
  components: [
    { id: 1, name: "Climate-Resilient & Smart Agricultural Production" },
    { id: 2, name: "Agricultural Market Development" },
    { id: 3, name: "Project Coordination & Management" },
  ],
  targets: {
    households: 43000,
    people: 258000,
    feederRoadsKm: 420,
    inlandValleySwampHa: 2300,
    oilPalmHa: 5000,
    oilPalmBeneficiaries: 5000,
    cocoaHa: 6000,
    cocoaBeneficiaries: 6000,
  },
};
