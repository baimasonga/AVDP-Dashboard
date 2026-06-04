import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { getEnrichedIndicators, SIERRA_LEONE_DISTRICTS, getDistrictSummaries } from "./src/data";
import { Indicator, UserRole, ThresholdAlert, SurveyRecord, SurveyResponse, SurveyType } from "./src/types";


// Initialize the GenAI SDK client
// Guard the initialization so it does not crash on startup if missing.
// We will retrieve the key inside the route handlers or fallback gracefully as instructed.
const getAIClient = (): GoogleGenAI | null => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (err) {
    console.error("Error instantiating GoogleGenAI:", err);
    return null;
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory indicators state initialized using enriched raw dataset
  let indicatorsStore: Indicator[] = getEnrichedIndicators();

  // In-memory threshold alerts store
  let alertsStore: ThresholdAlert[] = [
    {
      id: "alert-101",
      indicatorId: "LGF-001",
      indicatorName: "Yield Increase",
      district: "Kambia",
      thresholdValue: 120,
      currentValue: 155.0,
      condition: "below",
      triggeredAt: new Date(2026, 4, 28, 9, 30).toISOString(),
      recipientEmail: "district.officer.kambia@avdp.org.sl",
      status: "Sent"
    },
    {
      id: "alert-102",
      indicatorId: "LGF-017",
      indicatorName: "Road Rehab",
      district: "Bo",
      thresholdValue: 150,
      currentValue: 140.0,
      condition: "below",
      triggeredAt: new Date(2026, 5, 2, 14, 15).toISOString(),
      recipientEmail: "infrastructure.director@avdp.org.sl",
      status: "Sent"
    }
  ];
  
  // In-memory AVDP surveys registry database
  let surveysStore: SurveyRecord[] = [
    {
      id: "LGF-SUR-001",
      title: "Baseline Household Income & Crop Yields Survey",
      description: "Establishes baseline rice/cocoa/coffee yield metrics and household smallholder incomes before AVDP infrastructure upgrades.",
      type: "Baseline Survey",
      status: "Completed",
      district: "Kailahun",
      respondentsCount: 500,
      targetCount: 500,
      focalCommodity: "Cocoa",
      lastConducted: new Date(2025, 0, 15).toISOString(),
      indicatorsAffected: ["LGF-001", "LGF-004", "LGF-025"],
      keyFindings: "Baseline cocoa crop yields sat at ~280kg/ha. Smallholder farmer financial literacy averages were below 30% without savings group memberships."
    },
    {
      id: "LGF-SUR-002",
      title: "Annual Outcome Yield & Swamp Drainage Evaluation",
      description: "Measures outcomes for newly established rice swamps, assessing yield increments compared to primitive mountain terrains.",
      type: "Annual Outcome Survey",
      status: "Active",
      district: "Moyamba",
      respondentsCount: 240,
      targetCount: 350,
      focalCommodity: "Rice",
      lastConducted: new Date(2026, 4, 12).toISOString(),
      indicatorsAffected: ["LGF-009", "LGF-012", "LGF-045"],
      keyFindings: "Interim records registered 42% increased rice tons per hectare where custom concrete bund systems were fully completed in swamp margins."
    },
    {
      id: "LGF-SUR-003",
      title: "Post-Planting Seedling Survival Rate Assessment",
      description: "Monitors survival of oil palm, cocoa and coffee seedlings provided to smallholder farmer cooperatives under IFAD frameworks.",
      type: "Seedling Survival Assessment",
      status: "Active",
      district: "Kenema",
      respondentsCount: 185,
      targetCount: 400,
      focalCommodity: "Oil Palm",
      lastConducted: new Date(2026, 5, 1).toISOString(),
      indicatorsAffected: ["LGF-007", "LGF-010", "LGF-052"],
      keyFindings: "Soil composition reviews registered high nitrogen richness, but dry season moisture drop decreased overall bare-root survival coefficients."
    },
    {
      id: "LGF-SUR-004",
      title: "Climate-Resilient Roads Transit Impact Evaluation",
      description: "Conducts evaluations among transport contractors and farmer unions to measure transit time/crop spoilage reduction on rehabilitated feeder roads.",
      type: "Road Impact Evaluation",
      status: "Active",
      district: "Kambia",
      respondentsCount: 110,
      targetCount: 250,
      focalCommodity: "General",
      lastConducted: new Date(2026, 3, 20).toISOString(),
      indicatorsAffected: ["LGF-005", "LGF-014", "LGF-044"],
      keyFindings: "Transit periods between harvesting hubs and bulking collection centers shortened on average by 3.4 hours. Post-harvest spoilage lowered similarly."
    },
    {
      id: "LGF-SUR-005",
      title: "Cooperatives Gender & Youth Inclusion Assessment",
      description: "Audits overall participation index of women and rural youth in decision-making and operational committees of AVDP farming associations.",
      type: "Gender & Youth Inclusion Survey",
      status: "Scheduled",
      district: "Bo",
      respondentsCount: 0,
      targetCount: 300,
      focalCommodity: "General",
      lastConducted: new Date(2026, 6, 1).toISOString(),
      indicatorsAffected: ["LGF-003", "LGF-020", "LGF-035"],
      keyFindings: "Targeted to start next quarter. Evaluating female inclusion ratios in VSLA (Village Savings and Loans Associations) groups across three experimental zones."
    },
    {
      id: "LGF-SUR-006",
      title: "Marketing Contracts & Access Review",
      description: "Measures contract volumes, unit price parameters, and satisfaction levels of local farming networks transacting with bulking buyers.",
      type: "Market Access & Marketing",
      status: "Completed",
      district: "Port Loko",
      respondentsCount: 200,
      targetCount: 200,
      focalCommodity: "Rice",
      lastConducted: new Date(2026, 2, 28).toISOString(),
      indicatorsAffected: ["LGF-016", "LGF-037", "LGF-054"],
      keyFindings: "Signed offtaker contract arrangements secured up to 18% premiums over open-market pricing, substantially strengthening baseline income security codes."
    }
  ];

  // Specific user-submitted raw survey answers
  let surveyResponsesStore: SurveyResponse[] = [
    {
      id: "resp-1",
      surveyId: "LGF-SUR-002",
      respondentName: "Sorie Kamara",
      respondentType: "Swamp Cultivator",
      district: "Moyamba",
      commodity: "Rice",
      answers: [
        { question: "Total target land size pre-allocated (acres)", answer: "2.5" },
        { question: "Achieved yield increase multiplier under drainage system", answer: "1.4x" },
        { question: "Has household standard of living improved?", answer: "Significantly Improved" }
      ],
      submittedAt: new Date(2026, 4, 15).toISOString()
    },
    {
      id: "resp-2",
      surveyId: "LGF-SUR-003",
      respondentName: "Fatmata Koroma",
      respondentType: "Smallholder Farmer",
      district: "Kenema",
      commodity: "Oil Palm",
      answers: [
        { question: "Total oil palm seedlings distributed to farm", answer: "150" },
        { question: "Confirmed active survival rate of seedlings", answer: "88%" },
        { question: "Faced water shortage risks over dry season?", answer: "Yes - Moderate Drought" }
      ],
      submittedAt: new Date(2026, 5, 2).toISOString()
    }
  ];

  // System logs to show in dashboard activity tabs
  let activityLogsStore = [
    { timestamp: new Date(2026, 5, 3, 22, 15).toISOString(), user: "moh.bangura@avdp.gov.sl", role: "Admin", action: "Updated database schema for Western Area districts" },
    { timestamp: new Date(2026, 5, 3, 21, 30).toISOString(), user: "officer.kailahun@avdp.gov.sl", role: "Officer", action: "Logged new Coffee yield survey parameters for index LGF-025" },
    { timestamp: new Date(2026, 5, 3, 18, 45).toISOString(), user: "System Scheduler", role: "System", action: "Triggered email threshold warning alert for indicator LGF-017 below 150% target" },
    { timestamp: new Date(2026, 5, 3, 12, 0).toISOString(), user: "public.viewer@avdp.org.sl", role: "Stakeholder", action: "Exported national yield summary reports as CSV" }
  ];

  // Helper to re-assess trigger states
  const autoAssessAlerts = (ind: Indicator, lastUser: string) => {
    // If progress is subpar (< 110%) and indicates high risk, check if we need to auto-trigger alert
    if (ind.Progress < 110.0) {
      const alreadyTriggered = alertsStore.some(a => a.indicatorId === ind.IndicatorID);
      if (!alreadyTriggered) {
        const newAlert: ThresholdAlert = {
          id: `alert-${Date.now()}`,
          indicatorId: ind.IndicatorID,
          indicatorName: ind.IndicatorName,
          district: ind.District,
          thresholdValue: 110,
          currentValue: ind.Progress,
          condition: "below",
          triggeredAt: new Date().toISOString(),
          recipientEmail: `${ind.District.toLowerCase().replace(/\s+/g, "")}.officer@avdp.gov.sl`,
          status: "Sent" // Send right away in simulation
        };
        alertsStore.unshift(newAlert);
        
        activityLogsStore.unshift({
          timestamp: new Date().toISOString(),
          user: "System Trigger",
          role: "System",
          action: `Automated alert triggered: ${ind.IndicatorID} (${ind.IndicatorName}) in ${ind.District} fell to ${ind.Progress}% progress.`
        });
      }
    }
  };

  // --- API ROUTE HANDLERS ---

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString(), db: "In-memory / LocalStorage Sync Engine" });
  });

  // Get all agricultural indicators
  app.get("/api/indicators", (req, res) => {
    res.json(indicatorsStore);
  });

  // Update specific indicator (Requiring authenticated Roles)
  app.put("/api/indicators/:id", (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const userRole = req.headers["x-user-role"] || UserRole.STAKEHOLDER;
    const userEmail = req.headers["x-user-email"] || "unknown@avdp.gov.sl";

    // Role-based Access Control
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.OFFICER) {
      return res.status(403).json({ error: "Access denied. Only Admins and District Officers can submit adjustments." });
    }

    const index = indicatorsStore.findIndex(i => i.IndicatorID === id);
    if (index === -1) {
      return res.status(404).json({ error: `Indicator with ID ${id} not found.` });
    }

    const current = indicatorsStore[index];
    
    // Restrictions on District Officers edit (Can only edit if assigned to that district, or if not specified)
    const officerDistrict = req.headers["x-user-district"];
    if (userRole === UserRole.OFFICER && officerDistrict && officerDistrict !== current.District) {
      return res.status(403).json({ error: `Access denied. As an Officer for ${officerDistrict}, you cannot edit metrics for ${current.District}.` });
    }

    // Merge attributes
    const updatedIndicator: Indicator = {
      ...current,
      ...updateData,
      Progress: parseFloat((updateData.BaselineValue > 0 ? (updateData.AchievedValue / updateData.BaselineValue) * 100 : current.Progress).toFixed(1)),
      LastUpdated: new Date().toISOString()
    };

    // Calculate dynamic status indicators
    if (updatedIndicator.Progress < 100) {
      updatedIndicator.Status = "Critical";
    } else if (updatedIndicator.Progress >= 100 && updatedIndicator.Progress < 130) {
      updatedIndicator.Status = "Need Attention";
    } else {
      updatedIndicator.Status = "On Track";
    }

    indicatorsStore[index] = updatedIndicator;

    // Log the user action
    activityLogsStore.unshift({
      timestamp: new Date().toISOString(),
      user: String(userEmail),
      role: String(userRole),
      action: `Modified indicator ${id} values: Baseline ${updatedIndicator.BaselineValue}, Achieved ${updatedIndicator.AchievedValue}`
    });

    // Check potential trigger warnings
    autoAssessAlerts(updatedIndicator, String(userEmail));

    res.json({ message: "Indicator updated successfully.", data: updatedIndicator });
  });

  // Bulk overwrite / upload CSV interface
  app.post("/api/indicators/batch", (req, res) => {
    const userRole = req.headers["x-user-role"] || UserRole.STAKEHOLDER;
    const userEmail = req.headers["x-user-email"] || "unknown@avdp.gov.sl";

    if (userRole !== UserRole.ADMIN) {
      return res.status(403).json({ error: "Only admins can perform bulk import operations." });
    }

    const newIndicators = req.body;
    if (!Array.isArray(newIndicators)) {
      return res.status(400).json({ error: "Invalid layout data payload. Expected array of indicator structures." });
    }

    // Blend and update
    newIndicators.forEach((newIndInput) => {
      const index = indicatorsStore.findIndex(i => i.IndicatorID === newIndInput.IndicatorID);
      if (index !== -1) {
        const merged = {
          ...indicatorsStore[index],
          ...newIndInput,
          LastUpdated: new Date().toISOString()
        };

        // Recompute progress and status so they stay consistent with the imported values
        merged.Progress = parseFloat(
          (merged.BaselineValue > 0 ? (merged.AchievedValue / merged.BaselineValue) * 100 : 100).toFixed(1)
        );
        if (merged.Progress < 100) {
          merged.Status = "Critical";
        } else if (merged.Progress < 130) {
          merged.Status = "Need Attention";
        } else {
          merged.Status = "On Track";
        }

        indicatorsStore[index] = merged;
      }
    });

    activityLogsStore.unshift({
      timestamp: new Date().toISOString(),
      user: String(userEmail),
      role: String(userRole),
      action: `Imported and synchronized ${newIndicators.length} indicators via CSV Bulk Stream.`
    });

    res.json({ status: "success", count: newIndicators.length });
  });

  // Get active system logs
  app.get("/api/logs", (req, res) => {
    res.json(activityLogsStore);
  });

  // Get active warning threshold alerts
  app.get("/api/alerts", (req, res) => {
    res.json(alertsStore);
  });

  // Create customized user trigger alert rules
  app.post("/api/alerts", (req, res) => {
    const { indicatorId, recipientEmail, thresholdValue, condition } = req.body;
    const target = indicatorsStore.find(i => i.IndicatorID === indicatorId);

    if (!target) {
      return res.status(404).json({ error: "Associated target indicator index not found." });
    }

    const newAlert: ThresholdAlert = {
      id: `alert-${Date.now()}`,
      indicatorId,
      indicatorName: target.IndicatorName,
      district: target.District,
      thresholdValue: Number(thresholdValue),
      currentValue: target.Progress,
      condition: condition || "below",
      triggeredAt: new Date().toISOString(),
      recipientEmail: recipientEmail || "alert.stakeholder@avdp.org.sl",
      status: "Pending"
    };

    alertsStore.unshift(newAlert);
    res.json({ message: "Threshold subscription registered.", alert: newAlert });
  });

  // Simulate Triggering/Testing alert dispatch and simulated emails notifications
  app.post("/api/alerts/dispatch/:id", (req, res) => {
    const { id } = req.params;
    const alertIndex = alertsStore.findIndex(a => a.id === id);

    if (alertIndex === -1) {
      return res.status(404).json({ error: "Config alert identifier not found." });
    }

    alertsStore[alertIndex].status = "Sent";
    alertsStore[alertIndex].triggeredAt = new Date().toISOString();

    const loggedAlert = alertsStore[alertIndex];

    activityLogsStore.unshift({
      timestamp: new Date().toISOString(),
      user: "System Mailer",
      role: "System",
      action: `Email alert successfully simulated & sent to <${loggedAlert.recipientEmail}>: Indicator ${loggedAlert.indicatorId} has alert value ${loggedAlert.currentValue}%`
    });

    res.json({ message: "Automated alert dispatch simulation complete.", alert: loggedAlert });
  });

  // --- SURVEY REGISTRY ENDPOINTS ---

  // Get list of all surveys
  app.get("/api/surveys", (req, res) => {
    res.json(surveysStore);
  });

  // Get all survey response submissions
  app.get("/api/surveys/responses", (req, res) => {
    res.json(surveyResponsesStore);
  });

  // Submit a new evaluation survey response
  app.post("/api/surveys/responses", (req, res) => {
    const { surveyId, respondentName, respondentType, district, commodity, answers } = req.body;

    if (!surveyId || !respondentName || !respondentType || !district) {
      return res.status(400).json({ error: "Required fields missing for logging survey response." });
    }

    const linkedSurveyIndex = surveysStore.findIndex(s => s.id === surveyId);
    if (linkedSurveyIndex === -1) {
      return res.status(404).json({ error: `Associated Survey with ID ${surveyId} not found.` });
    }

    const newResponse: SurveyResponse = {
      id: `resp-${Date.now()}`,
      surveyId,
      respondentName,
      respondentType,
      district,
      commodity: commodity || "General",
      answers: answers || [],
      submittedAt: new Date().toISOString()
    };

    // Store response
    surveyResponsesStore.unshift(newResponse);

    // Increment count on survey record
    surveysStore[linkedSurveyIndex] = {
      ...surveysStore[linkedSurveyIndex],
      respondentsCount: surveysStore[linkedSurveyIndex].respondentsCount + 1,
      lastConducted: new Date().toISOString()
    };

    // Log the event under security audit logs
    activityLogsStore.unshift({
      timestamp: new Date().toISOString(),
      user: respondentName,
      role: "Stakeholder",
      action: `Submitted evaluation questionnaire for "${surveysStore[linkedSurveyIndex].title}" in ${district}`
    });

    res.json({ message: "Field survey logged and updated successfully.", response: newResponse, survey: surveysStore[linkedSurveyIndex] });
  });

  // Create a brand new Survey Record (e.g. for Admin planning new surveys)
  app.post("/api/surveys", (req, res) => {
    const { title, description, type, district, focalCommodity, targetCount, indicatorsAffected } = req.body;
    const userRole = req.headers["x-user-role"] || UserRole.STAKEHOLDER;
    const userEmail = req.headers["x-user-email"] || "unknown@avdp.gov.sl";

    if (userRole !== UserRole.ADMIN) {
      return res.status(403).json({ error: "Only M&E Administration can schedule new surveys." });
    }

    if (!title || !type || !district) {
      return res.status(400).json({ error: "Missing required survey parameters." });
    }

    const newSurvey: SurveyRecord = {
      id: `LGF-SUR-00${surveysStore.length + 1}`,
      title,
      description: description || "",
      type,
      status: "Scheduled",
      district,
      respondentsCount: 0,
      targetCount: Number(targetCount) || 100,
      focalCommodity: focalCommodity || "General",
      lastConducted: new Date().toISOString(),
      indicatorsAffected: indicatorsAffected || [],
      keyFindings: "Awaiting field data collections."
    };

    surveysStore.unshift(newSurvey);

    activityLogsStore.unshift({
      timestamp: new Date().toISOString(),
      user: String(userEmail),
      role: String(userRole),
      action: `Scheduled new evaluation survey: "${title}" (${type}) for ${district} targeting ${targetCount} respondents.`
    });

    res.json({ message: "New survey configured successfully.", survey: newSurvey });
  });

  // 3rd-Party developer rest standard API for open sync and programmatic access
  app.get("/api/v1/integration/metrics", (req, res) => {
    const filteredDistrict = req.query.district;
    const filteredCommodity = req.query.commodity;

    let result = indicatorsStore;
    if (filteredDistrict) {
      result = result.filter(r => r.District.toString().toLowerCase() === filteredDistrict.toString().toLowerCase());
    }
    if (filteredCommodity) {
      result = result.filter(r => r.Commodity.toString().toLowerCase() === filteredCommodity.toString().toLowerCase());
    }

    const summary = getDistrictSummaries(result);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    res.json({
      meta: {
        project: "Sierra Leone Agriculture Value Chain Development Project (AVDP)",
        source: "https://www.avdp.org.sl",
        endpointDescription: "Realtime Agricultural and Support Infrastructure indicators sync port",
        syncTime: new Date().toISOString(),
        bandwidthTier: "Optimized for 2G/Low-Power client contexts",
        authorizedPublisher: "IFAD, Ministry of Agriculture of Sierra Leone"
      },
      indicatorsCount: result.length,
      districtsReporting: SIERRA_LEONE_DISTRICTS.length,
      metrics: result,
      districtSummaries: summary
    });
  });

  // Strategic AI Support Advisor powered by Gemini Client
  app.post("/api/gemini/advisor", async (req, res) => {
    const { question, currentDistrict, activeCommodity, activeMetric } = req.body;
    
    // Check if user credentials or search factors are clean
    const aiClient = getAIClient();

    // Prepare robust summary constraints of indicators so the model can read real live data!
    const criticalIndicatorsSummary = indicatorsStore
      .filter(i => i.Status === "Critical")
      .slice(0, 10)
      .map(i => `${i.IndicatorID} (${i.IndicatorName} in ${i.District} with Progress: ${i.Progress}%)`)
      .join(", ");

    const totalIn_Track = indicatorsStore.filter(i => i.Status === "On Track").length;
    const totalCritical = indicatorsStore.filter(i => i.Status === "Critical").length;

    const systemicContextPrompt = `You are the AVDP Intelligent Decision Advisor, built for the Agriculture Value Chain Development Project (AVDP) in Sierra Leone.
The project is funded by IFAD and the Sierra Leone Ministry of Agriculture to promote Rice, Cocoa, Coffee, and Oil Palm value chains, and upgrade climate-resilient roads/infrastructure.

Here is the current state of agricultural operations in Sierra Leone:
- Total reporting metrics: ${indicatorsStore.length} indexes
- Progress status: ${totalIn_Track} metrics on track, ${totalCritical} critical alert fields.
- Some Critical fields facing low-progress thresholds: ${criticalIndicatorsSummary || "None"}
- User focal filters currently selected:
  * Current Regional District Focus: ${currentDistrict || "All Sierra Leone"}
  * Commodity Focus: ${activeCommodity || "All Crops"}
  * Metric Target Focus: ${activeMetric || "All Performance Categories"}

The user is asking: "${question || "What are the key policy and strategic suggestions based on today's reports?"}"

Provide a concise, direct, professional response with highly localized, actionable agricultural advice. Focus especially on constraints in Sierra Leone, e.g. inland valley swamps (IVS) development for Rice, Cocoa rehabilitation in Kailahun/Kenema, Coffee yields, value chain linkages, low-bandwidth context solutions, or climate-resilience infrastructure. Keep response structured with clean Markdown brief bullet points.`;

    if (!aiClient) {
      // Elegant, helpful fallback as per Gemini API guide (positive, proactive note)
      return res.json({
        text: `### Agriculture Strategic Advisory (AVDP Decision Support Model)

*Notice: Your system's AI Adviser is preparing localized feedback. To enjoy full server-side strategic planning forecasts with Gemini intelligence, please attach your valid Gemini API Key inside the **Settings > Secrets** panel in the AI Studio platform workspace.*

Here is your regional strategic forecast based on our cached AVDP metrics:

1. **Inland Valley Swamps (IVS) Intensification**:
   - For focus area **${currentDistrict || "Sierra Leone Districts"}**, prioritize Rice rehabilitation. Sustainable fertilizer inputs can multiply rice harvest coefficients by up to 1.5x in low-lying swamp beds.
   2. **Cocoa & Coffee Rehabilitation**:
   - Focus tree seedling distribution parameters carefully. Seedling survival rates are highly responsive to shade-tree companion plant canopy patterns across Eastern Sierra Leone districts like Kailahun and Kono.
3. **Logistics & Road Reliability**:
   - Infrastructure rehabilitation (Road Rehab parameters) are critical to alleviate market accessibility gaps. Direct surplus funding toward bridges in Bonthe and Moyamba during rainy transition months.
4. **Offline and Bandwidth Mitigation**:
   - To assist field managers in low-cellular signal environments, download full regional indices as CSV files. Complete key operations offline; they will automatically synch upon reconnecting.`
      });
    }

    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemicContextPrompt,
        config: {
          temperature: 0.85
        }
      });
      
      const advisingText = response.text || "No insights could be produced by the strategic model at this moment.";
      res.json({ text: advisingText });
    } catch (err: any) {
      console.error("Gemini prompt error description:", err.message);
      res.status(500).json({ error: "Strategic recommendation engine faced a processing error. Please double-check your Secrets and parameters." });
    }
  });

  // --- DEV / PRODUCTION BINDINGS FOR EXPRESS ---

  // Vite middleware installation in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    // Production statics serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log(`Standalone production node server binder initialized.`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AVDP Full-Stack Host bound successfully on port http://localhost:${PORT}`);
  });
}

startServer();
