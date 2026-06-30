# Countertop Estimator

Upload cabinet shop drawing PDFs, auto-extract dimensions with Claude, calculate square footage, slab count, and cost allocation per unit.

---

## Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
cp .env.local.example .env.local
# then open .env.local and paste your key:
# ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the dev server
npm run dev
```

Open http://localhost:3000 — you're live.

---

## Deploy to Vercel (recommended, free tier works)

### Option A — GitHub (easiest)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project → import the repo
3. Add environment variable: `ANTHROPIC_API_KEY` = your key
4. Click Deploy — done. Vercel auto-deploys on every push.

### Option B — Vercel CLI
```bash
npm install -g vercel
vercel         # follow the prompts
# when asked for env vars, add ANTHROPIC_API_KEY
```

### Option C — Any Node server
```bash
npm run build
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Runs on port 3000 by default. Put Nginx or Caddy in front for HTTPS.

---

## How the API key stays safe

The browser never sees your Anthropic key. PDF data is posted to `/api/extract` (a Next.js server route), which adds the key from the server environment and calls Anthropic. The key never leaves the server.

---

## Folder structure

```
countertop-estimator/
├── app/
│   ├── layout.js            — HTML shell, loads Tabler icons font
│   ├── page.js              — renders CountertopApp
│   ├── globals.css          — CSS design tokens (colors, spacing)
│   └── api/extract/
│       └── route.js         — server route: receives PDF → calls Claude → returns JSON
└── components/
    └── CountertopApp.jsx    — all UI and calculation logic
```

---

## Customizing defaults

Open `components/CountertopApp.jsx` and edit `DEF_SETTINGS` near the top:

```js
const DEF_SETTINGS = {
  slabW:        79,    // slab width in inches
  slabL:       138,    // slab length in inches
  kitchenDepth: 25.5,  // counter depth (cabinet + front overhang)
  vanityDepth:  21,    // vanity top depth
  laborRate:    25,    // $/SF labor
  slabCost:      0,    // total project slab cost (filled in per project)
};
```

All settings are also editable in the Settings tab at runtime.

---

## Changing the extraction prompt

If you work with a cabinet shop whose drawings use unusual conventions, edit the `PROMPT` constant in `app/api/extract/route.js`. The prompt tells Claude what to extract and how to handle exclusions (fridge panels, pantry towers, etc.).

---

## Getting an Anthropic API key

1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to API Keys → Create Key
4. Paste it in `.env.local` as `ANTHROPIC_API_KEY=sk-ant-...`

Each extraction call uses roughly 1,000–3,000 input tokens + ~500 output tokens depending on PDF length. At current Sonnet pricing that's fractions of a cent per drawing batch.
