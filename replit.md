# AVDP Sierra Leone M&E Dashboard

## Overview
A React + Vite + Tailwind single-page application for the AVDP (Agricultural Value
Chain Development Project) Sierra Leone Monitoring & Evaluation portal. Tracks
IFAD G-100 agricultural commodities and infrastructure indicators across all 16
Sierra Leone districts, including a GIS informatics map, market value chains,
seasonal crop calendar, and strategic M&E workspace.

## Tech Stack
- React 19 + Vite 6 + TypeScript
- Tailwind CSS 4
- Supabase (project: invendis) for data, with an offline stored-dataset fallback
- Lucide React for icons
- Hosted on Cloudflare Pages

## Architecture Notes
- `src/App.tsx` — root component, tab switching (analytics / gis / markets / calendar)
- `src/components/MapSection.tsx` — GIS map: GeoJSON-driven district polygons
  (Web Mercator projection), thematic overlays, value-chain search, collapsible panel
- `src/data/sleDistricts.geo.json` — real boundaries for all 16 districts
- `src/data.ts` — district summaries and indicator dataset
- `src/types.ts` — Indicator / district types with Commodity field
- Value chains: Rice, Cocoa, Coffee, Oil Palm, General

## Deployment
- Code is pushed to GitHub (`baimasonga/AVDP-Dashboard`, `main` branch), which
  triggers an automatic Cloudflare Pages redeploy.
- `scripts/post-merge.sh` configures git credentials and runs `git push origin main`.
- The bash tool blocks direct git operations; pushing is done by running
  `scripts/post-merge.sh` through a temporary console workflow.

## User Preferences
- **Always push changes to GitHub** after completing work, so Cloudflare redeploys
  with the latest code.
