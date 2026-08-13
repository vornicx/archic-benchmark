# Archic Benchmark

Internal website quality operating system for Archic.

The goal is not to produce another generic website score. Archic Benchmark answers a more useful question:

> How good is this website for the specific business it is supposed to win for, what regressed, and what should we improve today?

## What V1 does

- Scores each website against a niche-specific profile.
- Uses different category weights for restaurants, luxury car rental, premium real estate, yacht charter, luxury e-commerce, SaaS and professional services.
- Runs a real Chromium browser for desktop and mobile captures.
- Measures lab signals such as LCP, CLS, TTFB, transfer weight and long tasks.
- Checks SEO/GEO foundations, metadata, canonical, headings, structured data, robots and sitemap.
- Checks mobile overflow, target sizing, text sizing, form labelling and basic accessibility hygiene.
- Checks HTTPS/security headers and legal/privacy discoverability.
- Detects console errors, failed requests and sampled broken internal links.
- Applies hard quality gates so a broken commercial journey cannot hide behind a high design score.
- Optionally sends desktop + mobile screenshots to an OpenAI vision-capable model for a strict business/design review.
- Merges qualitative review with objective measurements rather than replacing them.
- Builds a portfolio-wide priority queue using business impact, severity, niche weight and effort.
- Stores daily history and score deltas.
- Supports reference-site datasets and only exposes percentiles after the sample is meaningful.
- Includes a responsive Command Center dashboard.
- Includes a GitHub Actions schedule designed to run once each morning around 07:00 Europe/Madrid while surviving CET/CEST changes and moderate scheduler delay.

## Quick start

```bash
npm run benchmark:demo
npm run build
npm run dev
```

Open `http://localhost:4173`.

The demo dataset is intentionally labelled as demo data. Replace it with measured data by running:

```bash
npm run benchmark
```

## Configure projects

Edit `config/projects.json`.

Each project has:

- `id`
- `name`
- `url`
- `profile`
- `positioning`
- `market`
- `primaryGoal`
- `secondaryGoal`
- `criticalPaths`
- `enabled`

Do not enable a project until its live URL is correct.

## Niche profiles

Defined in `config/benchmarks.json`.

Current profiles:

- Premium Restaurant
- Luxury Car Rental
- Premium Real Estate
- Luxury Yacht Charter
- Luxury E-commerce
- SaaS
- Professional Services

Every profile contains:

- category weights summing to 100;
- visual intent;
- business requirements;
- the critical commercial journey.

This is the foundation of `quality relative to purpose`.

## Score model

The eleven scoring dimensions are:

1. Business fit
2. Visual design
3. UX & architecture
4. Conversion
5. Mobile
6. Performance
7. SEO + GEO
8. Content & copy
9. Accessibility
10. Security & trust
11. Robustness

The final score is a weighted average and can then be capped by quality gates.

Tiers:

- `< 60` Needs work
- `60–69.9` Acceptable
- `70–79.9` Good
- `80–89.9` Premium
- `90–94.9` Exceptional
- `95–100` Reference Quality

`95+` is deliberately difficult.

See `docs/scoring-model.md` for the full philosophy.

## Optional AI visual/business reviewer

The objective scanner works without an AI API.

To add multimodal review, set:

```bash
OPENAI_API_KEY=...
ARCHIC_REVIEW_MODEL=...
```

The model is asked to judge the website relative to its business positioning and niche, with explicit penalties for template feel, AI-slop, weak perceived value, default-looking components, poor mobile craft and weak conversion paths.

The AI score cannot overwrite the technical categories. It only blends into visual design, business fit, UX, conversion and content with controlled weights.

## Reference benchmark dataset

To add a strong external reference website to a niche:

```bash
npm run benchmark:add-reference -- https://example.com premium-real-estate "Example Brand"
```

Reference results are stored in `data/reference-benchmarks.json`.

A project does not receive a percentile until the niche has at least 10 reference samples. This prevents fake precision from tiny datasets.

## Daily 07:00 run

`.github/workflows/daily-benchmark.yml` runs hourly but contains a Madrid-time and idempotency guard. It only performs the benchmark once per day in the 07:00–09:59 Europe/Madrid window, or whenever manually dispatched.

This avoids the one-hour CET/CEST error that a fixed UTC cron would introduce.

The workflow:

1. validates the benchmark configuration;
2. discovers Chrome;
3. scans enabled projects;
4. writes `data/latest.json` and history;
5. replaces latest screenshots;
6. commits the result back to the repository.

If the repository is connected to Vercel, the data commit can trigger a fresh static deployment of the Command Center.

### GitHub settings

For AI review, add:

- Repository secret: `OPENAI_API_KEY`
- Repository variable: `ARCHIC_REVIEW_MODEL`

The workflow already requests `contents: write` so the benchmark bot can persist daily results.

## Vercel

The project is configured as a static deployment:

- build: `npm run build`
- output: `public`

`npm run build` copies the latest benchmark payload and scoring-profile data into `public/api/`.

## Current V1 limitation

The generic scanner can verify routes, runtime health and many conversion signals, but true end-to-end business flows such as a complete reservation, payment, login or multi-step enquiry still need project-specific journey definitions.

That is the next meaningful layer: declarative Playwright/CDP journeys per project with assertions such as:

`Reservation CTA → date → party size → details → successful inquiry confirmation`.

Those journey failures should activate a hard quality gate.

## Commands

```bash
npm run dev                 # local dashboard
npm run benchmark:demo      # demo dashboard data
npm run benchmark           # live daily scan
npm run benchmark:add-reference -- <url> <profile> [name]
npm run build               # static deployment payload
npm run validate            # validate profiles/projects
npm test                    # engine + Chromium extraction tests
```

## Architecture

```text
Projects + niche profiles
        │
        ▼
Chromium scanner ── HTTP/security checks ── link checks
        │
        ├── desktop capture
        ├── mobile capture
        ├── performance signals
        ├── DOM/UX/accessibility signals
        └── runtime failures
        │
        ▼
Objective category scores
        │
        ├──── optional multimodal business/design review
        │
        ▼
Weighted scoring engine
        │
        ▼
Quality gates
        │
        ├── final score + tier
        ├── regression delta
        ├── niche percentile (when dataset is large enough)
        └── ranked issues
        │
        ▼
Portfolio priority queue
        │
        ▼
07:00 Command Center
```
