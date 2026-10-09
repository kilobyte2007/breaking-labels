# Breaker Labels

Design, auto-map and print labels for the paper windows on DIN-rail breakers.

- **Editor** – rows of breakers drawn to scale, drag to reorder, icons + text + circuit numbers, colour accents, auto-fit text.
- **Label sizes** – defaults 14×10, 32×10, 50×10 mm; add your own in Settings.
- **Import** – drop a photo of the panel and/or the electrician's circuit list (photo, scan, PDF, Word, text). Simple
  "1 – Fridge" lists are parsed offline; everything else goes through Claude (`claude-opus-5-5`). Review, then
  replace the layout, fill labels by number, or append rows.
- **Print** – exact-size sheets (A4/Letter/A5/custom) with cut marks, outlines, bleed, row captions, an optional overview
  page, and printer calibration rulers. Print directly, or download a PDF. Always print at **100% / Actual size**.

Data stays in the browser (localStorage + IndexedDB for photos). Export/import a panel as JSON from the ⋯ menu.

## Develop

```sh
npm install
npm run build          # wrangler dev serves ./dist, so build once first
npx wrangler dev       # API worker on :8787 (put ANTHROPIC_API_KEY in .dev.vars for AI import)
npm run dev            # Vite on :5173 with /api proxied to :8787
```

Without a server key, AI import still works with **Settings → AI → Use my own API key**: the key is kept in that
browser and requests go straight to api.anthropic.com.

## Deploy (Cloudflare Workers + static assets)

```sh
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # enables server-side AI import
npx wrangler secret put ACCESS_CODE         # optional: require a passphrase for AI requests
npm run deploy
```

`ACCESS_CODE` is strongly recommended on a public URL, otherwise anyone can spend your API credits.
Users enter it in Settings → AI.

## Structure

- `src/lib/layout.ts` – label geometry (fit text, icon, number badge, accent) shared by editor, print and PDF
- `src/lib/sheet.ts` – packs labels onto pages
- `src/lib/pdf.ts` – rasterises the sheets at 450 dpi with embedded fonts into an exact-size PDF
- `src/lib/analyze.ts`, `src/lib/ai-schema.ts` – Claude call + structured output schema (used by worker and browser)
- `src/lib/parseMap.ts` – offline parser for simple circuit lists (EN/RO/RU keywords for icon matching)
- `worker/index.ts` – `/api/health`, `/api/analyze`; everything else is served from `dist`
- `scripts/build-icons.mjs` – regenerates the curated icon set (`npm run icons`)
