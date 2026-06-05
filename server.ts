// Local development + optional self-hosted production server.
// NOTE: For the recommended Cloudflare Pages deployment this file is NOT used —
// the app is a static build and the AI advisor runs as a Supabase Edge Function.
// This server only serves the SPA (with Vite middleware in dev) and a health check.

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

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
    console.log(`AVDP host bound on http://localhost:${PORT}`);
  });
}

startServer();
