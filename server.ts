import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Load env (.env.local takes precedence, then .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

// Initialize the GenAI SDK client, guarded so a missing key never crashes boot.
const getAIClient = (): GoogleGenAI | null => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  } catch (err) {
    console.error("Error instantiating GoogleGenAI:", err);
    return null;
  }
};

// Read-only Supabase client for grounding the advisor in live data.
const getSupabase = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      db: getSupabase() ? "Supabase (Postgres + RLS)" : "unconfigured",
      ai: getAIClient() ? "Gemini configured" : "fallback mode",
    });
  });

  // Strategic AI Support Advisor powered by Gemini, grounded in live indicators.
  app.post("/api/gemini/advisor", async (req, res) => {
    const { question, currentDistrict, activeCommodity, activeMetric } = req.body || {};
    const aiClient = getAIClient();
    const sb = getSupabase();

    // Pull a live snapshot of the data so the model reasons over real numbers.
    let totalCount = 0;
    let totalInTrack = 0;
    let totalCritical = 0;
    let criticalIndicatorsSummary = "";
    if (sb) {
      try {
        const { data: inds } = await sb
          .from("indicators")
          .select("id,name,district,progress,status");
        if (inds) {
          totalCount = inds.length;
          totalInTrack = inds.filter((i: any) => i.status === "On Track").length;
          const critical = inds.filter((i: any) => i.status === "Critical");
          totalCritical = critical.length;
          criticalIndicatorsSummary = critical
            .slice(0, 10)
            .map((i: any) => `${i.id} (${i.name} in ${i.district} at ${i.progress}%)`)
            .join(", ");
        }
      } catch (err) {
        console.warn("Advisor grounding query failed; proceeding without live data.", err);
      }
    }

    const systemicContextPrompt = `You are the AVDP Intelligent Decision Advisor, built for the Agriculture Value Chain Development Project (AVDP) in Sierra Leone.
The project is funded by IFAD and the Sierra Leone Ministry of Agriculture to promote Rice, Cocoa, Coffee, and Oil Palm value chains, and upgrade climate-resilient roads/infrastructure.

Here is the current state of agricultural operations in Sierra Leone:
- Total reporting metrics: ${totalCount} indexes
- Progress status: ${totalInTrack} metrics on track, ${totalCritical} critical alert fields.
- Some Critical fields facing low-progress thresholds: ${criticalIndicatorsSummary || "None"}
- User focal filters currently selected:
  * Current Regional District Focus: ${currentDistrict || "All Sierra Leone"}
  * Commodity Focus: ${activeCommodity || "All Crops"}
  * Metric Target Focus: ${activeMetric || "All Performance Categories"}

The user is asking: "${question || "What are the key policy and strategic suggestions based on today's reports?"}"

Provide a concise, direct, professional response with highly localized, actionable agricultural advice. Focus especially on constraints in Sierra Leone, e.g. inland valley swamps (IVS) development for Rice, Cocoa rehabilitation in Kailahun/Kenema, Coffee yields, value chain linkages, low-bandwidth context solutions, or climate-resilience infrastructure. Keep response structured with clean Markdown brief bullet points.`;

    if (!aiClient) {
      return res.json({
        text: `### Agriculture Strategic Advisory (AVDP Decision Support Model)

*Notice: The AI Adviser is in fallback mode. Add a valid \`GEMINI_API_KEY\` to enable full server-side Gemini strategic planning.*

Here is your regional strategic forecast based on cached AVDP metrics${
          totalCount ? ` (${totalCritical} critical of ${totalCount} indicators)` : ""
        }:

1. **Inland Valley Swamps (IVS) Intensification**: For **${currentDistrict || "Sierra Leone districts"}**, prioritize Rice rehabilitation; sustainable fertilizer inputs can multiply rice harvest coefficients by up to 1.5x in low-lying swamp beds.
2. **Cocoa & Coffee Rehabilitation**: Seedling survival is highly responsive to shade-tree companion canopy across Eastern districts like Kailahun and Kono.
3. **Logistics & Road Reliability**: Direct surplus funding toward feeder roads and bridges in Bonthe and Moyamba during rainy transition months.
4. **Offline & Bandwidth Mitigation**: Field managers can export regional indices as CSV, work offline, and resync on reconnect.`,
      });
    }

    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemicContextPrompt,
        config: { temperature: 0.85 },
      });
      const advisingText =
        response.text || "No insights could be produced by the strategic model at this moment.";
      res.json({ text: advisingText });
    } catch (err: any) {
      console.error("Gemini prompt error:", err.message);
      res.status(500).json({
        error: "Strategic recommendation engine faced a processing error. Please check your configuration.",
      });
    }
  });

  // --- DEV / PRODUCTION BINDINGS FOR EXPRESS ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Standalone production node server binder initialized.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AVDP Full-Stack Host bound on http://localhost:${PORT}`);
  });
}

startServer();
