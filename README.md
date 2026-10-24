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
npx wrangler dev       # API worker on :8787 (copy .dev.vars.example to .dev.vars and add your key)
npm run dev            # Vite on :5173 with /api proxied to :8787
```

Without a server key, AI import still works with **Settings → AI → Use my own API key**: the key is kept in that
browser and requests go straight to api.anthropic.com.

## Deploy (Cloudflare Workers + static assets)

One Worker serves the built app from `dist/` and handles `/api/*`. No other Cloudflare resources are needed.

### From Git (Workers Builds)

1. Push this repo to GitHub or GitLab.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository**, pick the repo.
3. Settings:
   - **Project / Worker name:** `breaker-labels`. It must match `name` in `wrangler.jsonc`; change both if you want another name.
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy` (the default)
   - **Root directory:** leave empty
   - Node version comes from `.node-version` (24).
4. After the first deploy: Worker → **Settings → Variables and Secrets** → add, as type **Secret**:
   - `ANTHROPIC_API_KEY` – enables the AI import.
   - `ACCESS_CODE` – a passphrase users enter in Settings → AI. **Strongly recommended:** without it anyone who finds
     the URL can spend your API credits.

   Secrets live on the Worker, not in the repo, and survive later deploys. (Build variables are *not* visible at
   runtime, so don't put the key there.)
5. Every push to the production branch redeploys. Pushes to other branches create preview builds; their URLs are
   public, so keep `ACCESS_CODE` set.

Without `ANTHROPIC_API_KEY` the app still works; AI import is then only available with **Settings → AI → Use my own
API key**.

### From your machine

```sh
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ACCESS_CODE
npm run deploy
```

## Structure

- `src/lib/layout.ts` – label geometry (fit text, icon, number badge, accent) shared by editor, print and PDF
- `src/lib/sheet.ts` – packs labels onto pages
- `src/lib/pdf.ts` – rasterises the sheets at 450 dpi with embedded fonts into an exact-size PDF
- `src/lib/analyze.ts`, `src/lib/ai-schema.ts` – Claude call + structured output schema (used by worker and browser)
- `src/lib/parseMap.ts` – offline parser for simple circuit lists (EN/RO/RU keywords for icon matching)
- `worker/index.ts` – `/api/health`, `/api/analyze`; everything else is served from `dist`
- `scripts/build-icons.mjs` – regenerates the curated icon set (`npm run icons`)
