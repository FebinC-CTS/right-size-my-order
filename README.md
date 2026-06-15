<div align="center">

# Right-Size MyOrder

### AI That Trims Waste From Every Subscription

A subscription feature that quietly watches what a customer actually consumes versus what their plan delivers — and, when a surplus builds up, uses Claude to recommend a smaller plan. The customer saves money, waste drops, and the brand earns trust by telling customers to spend *less*.

<p>
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Claude" src="https://img.shields.io/badge/AI-Claude_Sonnet_4.6-D97757" />
</p>

</div>

---

## Overview

Most subscription businesses quietly profit when customers over-order. **Right-Size MyOrder** flips that incentive.

When a customer's consumption trends below what their plan delivers — say, using ~12 gallons per cycle on a 15-gallon plan — the surplus quietly accumulates until they notice they're paying for product they never use. That realization usually ends in an angry cancellation, not a polite downsize.

This feature catches the surplus first. It visualizes the gap, benchmarks the customer against similar households, and uses **Claude** to write a warm, honest recommendation to right-size the plan. The customer adjusts with a single slider, sees the savings instantly, and stays — because the brand looked out for them.

## Key Features

| # | Feature | Description | AI |
|---|---------|-------------|:--:|
| 1 | **Smart Recommendation** | A warm, non-pushy downsize recommendation written from the customer's real usage data | ● |
| 2 | **Usage visualization** | Delivered vs. consumed over time, with a "gap growing" callout | ○ |
| 3 | **Interactive plan slider** | Adjust the plan and see monthly savings and new cost update live | ○ |
| 4 | **Peer cohort comparison** | Benchmarks the customer against similar households | ○ |
| 5 | **Trust timeline** | Frames the relationship as Observe → Suggest → You decide | ○ |
| 6 | **Act instantly** | Adjust, Keep Current, or Remind Me Later — the customer stays in control | ○ |

<sub>● AI-powered (Claude) &nbsp;·&nbsp; ○ Deterministic application logic</sub>

## How the AI Works

```
 Account + usage data       delivered vs. consumed · 12-cycle history · pricing
 (src/data/account.js)
        │
        ▼
 Right-size engine          recent-average consumption · surplus · cost ·
 (src/lib/calc.js)          savings · recommended plan  (one source of truth)
        │
        ▼
 React + Vite SPA           usage chart · peer cohort · plan slider ·
        │                   Smart Recommendation card
        ▼
 Claude client              complete()  ·  graceful fallback to static copy
 (src/lib/claude.js)
        │
        ▼
 Secure dev-server proxy    injects ANTHROPIC_API_KEY server-side —
 (vite.config.js)           the key never enters the browser bundle
        │
        ▼
 Anthropic Messages API     Claude Sonnet 4.6
```

- **Model:** Claude Sonnet 4.6 (`claude-sonnet-4-6`).
- **Grounded, not fabricated:** the prompt is built at runtime from the same derived figures the UI shows (`src/lib/calc.js`), so the AI copy, the stat cards, the chart, and the plan slider can never disagree. The model frames *only* those numbers — it never invents data.
- **Secure key handling:** all requests route through a server-side proxy; the API key is never shipped to the client.
- **Resilient:** if the key is missing or a call fails, the card falls back to the original static copy so the demo never breaks.

## Tech Stack

| Layer | Technology |
|-------|------------|
| AI / LLM | Claude (Anthropic) — Messages API |
| Framework | React 19 |
| Build | Vite 8 |
| Styling | Tailwind CSS, custom CSS, hand-built SVG charts & animations |

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- An **Anthropic API key** — create one at [console.anthropic.com](https://console.anthropic.com/settings/keys)

### Installation

```bash
git clone <your-repo-url>
cd Right-Size-MyOrder
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> `.env.local` is gitignored and read **server-side only** — it never reaches the browser bundle. Never commit it.

### Run

```bash
npm run dev
```

Open the URL Vite prints (e.g. `http://localhost:5173`). Without a key the app still runs and the Smart Recommendation falls back to static copy.

### Build for production

```bash
npm run build
npm run preview
```

## Project Structure

```
├── src/
│   ├── App.jsx          The single-page experience — charts, slider,
│   │                    recommendation card, trust timeline
│   ├── data/
│   │   └── account.js   Single source of truth — account, pricing, and the
│   │                    12-cycle delivered-vs-consumed usage history
│   ├── lib/
│   │   ├── calc.js      Pure right-size engine — averages, surplus, costs,
│   │   │                savings, recommended plan (every figure derives here)
│   │   └── claude.js    Anthropic client — complete() + tolerant JSON parser
│   └── main.jsx
├── vite.config.js       Vite config + server-side Anthropic proxy
└── .env.local           Your API key (gitignored)
```

## Security

The Anthropic API key lives only in `.env.local` and is injected server-side by the Vite proxy — it is never bundled into the client. For a production deployment, move the same proxy logic into a serverless function or backend service rather than the Vite dev server.

## Disclaimer

All usage figures, peer cohorts, and pricing in this repository are **illustrative and fabricated for demonstration purposes** — chosen to be realistic (≈ $1.99/gal water + a flat delivery fee, ReadyRefresh-style) but they are not real customer data. In production, `consumed` would come from the consumption signal (returned-bottle weight at pickup and/or smart-dispenser telemetry) and pricing from the billing platform; everything else in `src/lib/calc.js` is already derived.

---

<div align="center">
<sub>Prototype built for the Cognizant × Primo Brands hackathon.</sub>
</div>
