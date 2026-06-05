// AVDP Intelligent Decision Advisor — Supabase Edge Function (Deno).
// Replaces the Express /api/gemini/advisor route so the frontend can be hosted
// as a pure static site (Cloudflare Pages). Grounds the prompt in live indicator
// data and calls the Gemini REST API. Falls back gracefully without a key.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { question, currentDistrict, activeCommodity, activeMetric } = await req
    .json()
    .catch(() => ({}));

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  // Ground the prompt in a live snapshot of the indicators.
  let totalCount = 0, totalInTrack = 0, totalCritical = 0, criticalSummary = "";
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: inds } = await sb
      .from("indicators")
      .select("id,name,district,progress,status");
    if (inds) {
      totalCount = inds.length;
      totalInTrack = inds.filter((i: any) => i.status === "On Track").length;
      const critical = inds.filter((i: any) => i.status === "Critical");
      totalCritical = critical.length;
      criticalSummary = critical
        .slice(0, 10)
        .map((i: any) => `${i.id} (${i.name} in ${i.district} at ${i.progress}%)`)
        .join(", ");
    }
  } catch (_) {
    // proceed without live grounding
  }

  const prompt = `You are the AVDP Intelligent Decision Advisor, built for the Agriculture Value Chain Development Project (AVDP) in Sierra Leone.
The project is funded by IFAD and the Sierra Leone Ministry of Agriculture to promote Rice, Cocoa, Coffee, and Oil Palm value chains, and upgrade climate-resilient roads/infrastructure.

Here is the current state of agricultural operations in Sierra Leone:
- Total reporting metrics: ${totalCount} indexes
- Progress status: ${totalInTrack} metrics on track, ${totalCritical} critical alert fields.
- Some Critical fields facing low-progress thresholds: ${criticalSummary || "None"}
- User focal filters currently selected:
  * Current Regional District Focus: ${currentDistrict || "All Sierra Leone"}
  * Commodity Focus: ${activeCommodity || "All Crops"}
  * Metric Target Focus: ${activeMetric || "All Performance Categories"}

The user is asking: "${question || "What are the key policy and strategic suggestions based on today's reports?"}"

Provide a concise, direct, professional response with highly localized, actionable agricultural advice. Focus especially on constraints in Sierra Leone, e.g. inland valley swamps (IVS) development for Rice, Cocoa rehabilitation in Kailahun/Kenema, Coffee yields, value chain linkages, low-bandwidth context solutions, or climate-resilience infrastructure. Keep response structured with clean Markdown brief bullet points.`;

  if (!GEMINI_API_KEY) {
    return json({
      text: `### Agriculture Strategic Advisory (AVDP Decision Support Model)

*Notice: The AI Adviser is in fallback mode. Set the \`GEMINI_API_KEY\` function secret to enable live Gemini strategic planning.*

Here is your regional strategic forecast based on cached AVDP metrics${
        totalCount ? ` (${totalCritical} critical of ${totalCount} indicators)` : ""
      }:

1. **Inland Valley Swamps (IVS) Intensification**: For **${currentDistrict || "Sierra Leone districts"}**, prioritize Rice rehabilitation; sustainable fertilizer inputs can multiply rice harvest coefficients by up to 1.5x in low-lying swamp beds.
2. **Cocoa & Coffee Rehabilitation**: Seedling survival is highly responsive to shade-tree companion canopy across Eastern districts like Kailahun and Kono.
3. **Logistics & Road Reliability**: Direct surplus funding toward feeder roads and bridges in Bonthe and Moyamba during rainy transition months.
4. **Offline & Bandwidth Mitigation**: Field managers can export regional indices as CSV/JSON, work offline, and resync on reconnect.`,
    });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85 },
        }),
      }
    );
    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No insights could be produced by the strategic model at this moment.";
    return json({ text });
  } catch (err) {
    console.error("Gemini error:", err);
    return json(
      { error: "Strategic recommendation engine faced a processing error." },
      500
    );
  }
});
