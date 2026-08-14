# Archic Benchmark

Internal website quality operating system for Archic.

The goal is not to produce another generic website score. Archic Benchmark answers a more useful question:

> How good is this website for the specific business it is supposed to win for, what regressed, and what should we improve today?

## V3 · OpenAI-first

The benchmark is now designed around a simple rule: **measurement must remain trustworthy even when AI is unavailable**.

- niche-specific scoring for every enabled project;
- real Chromium desktop and mobile scans;
- performance, SEO/GEO, accessibility, security, runtime and conversion checks;
- hard quality gates for commercially broken experiences;
- desktop and mobile screenshots;
- OpenAI as the optional qualitative reviewer;
- AI blending only into qualitative categories, never directly into technical categories;
- strict structured JSON output for more reliable reviews;
- retry/timeout protection around API calls;
- portfolio-wide prioritisation and daily history;
- per-project and portfolio token usage recorded in the report so API spend can be monitored;
- no Cursor, Grok or other paid agent subscription required.

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

## Architecture

```text
Projects + niche profiles
        │
        ▼
Chromium scanner ── HTTP/security ── link/runtime checks
        │
        ├── desktop screenshot
        ├── mobile screenshot
        ├── performance signals
        ├── DOM/UX/accessibility signals
        └── runtime failures
        │
        ▼
Deterministic category scores
        │
        ├──── optional OpenAI qualitative review
        │                  │
        │                  └── design / business fit / UX / conversion / copy
        ▼
Controlled score blend
        │
        ▼
Quality gates
        │
        ├── final score + tier
        ├── regression delta
        └── ranked issues
        │
        ▼
Portfolio daily queue + API usage
        │
        ▼
07:00 report + history
```

## Quick start

```bash
npm install
npm run benchmark:demo
npm run build
npm run dev
```

Run a live scan with:

```bash
npm run benchmark
```

## Configure projects

Projects live in `config/projects.json`.

Each project can include:

- `id`
- `name`
- `url`
- `repository`
- `startingRef`
- `profile`
- `positioning`
- `market`
- `primaryGoal`
- `secondaryGoal`
- `criticalPaths`
- `enabled`

Repository metadata is retained for future implementation tooling, but it does not affect benchmark scoring.

## OpenAI qualitative review

OpenAI review is optional. A missing API key, API failure or low-confidence review does not invalidate the deterministic benchmark.

Minimum configuration:

```env
OPENAI_API_KEY=...
```

Cost-aware defaults are built in:

```env
ARCHIC_OPENAI_MODEL=gpt-5-mini
ARCHIC_OPENAI_IMAGE_DETAIL=high
ARCHIC_OPENAI_MAX_OUTPUT_TOKENS=3500
```

`ARCHIC_REVIEW_MODEL` is still accepted for backwards compatibility. `ARCHIC_OPENAI_MODEL` takes precedence.

To run fully deterministic with no AI calls:

```env
ARCHIC_AI_PROVIDER=off
```

The reviewer receives the objective scan plus desktop/mobile screenshots and is instructed to perform a read-only design/business critique relative to the actual niche and positioning.

AI can influence only visual design, business fit, UX, conversion and content/copy. Performance, mobile, SEO/GEO, accessibility, security and robustness remain driven by deterministic checks and gates. Reviews below the confidence threshold are ignored.

The Responses API request uses structured JSON output, a bounded output-token budget, a two-minute request timeout and retries for transient/rate-limit/server errors.

## API usage tracking

Every successful OpenAI review stores its token usage under the project's `aiReview.usage` object.

The daily report also aggregates usage at:

```text
portfolio.aiUsage
```

with:

- completed reviews;
- review errors;
- input tokens;
- output tokens;
- total tokens.

This makes it possible to measure real benchmark consumption before increasing API credit or model quality.

## Daily 07:00 run

`.github/workflows/daily-benchmark.yml` contains two UTC cron entries plus a Madrid-time/idempotency guard. This avoids CET/CEST drift and still runs the benchmark once each morning.

The workflow:

1. checks out the repository;
2. installs dependencies;
3. discovers Chrome;
4. validates configuration;
5. runs tests;
6. scans enabled projects;
7. optionally adds an OpenAI qualitative review;
8. records OpenAI token usage;
9. writes latest/history/screenshots;
10. commits only benchmark artifacts back to this repository.

### GitHub configuration

Add one repository secret:

- `OPENAI_API_KEY`

Optional repository variables:

- `ARCHIC_OPENAI_MODEL` — defaults in code to `gpt-5-mini`;
- `ARCHIC_OPENAI_IMAGE_DETAIL` — defaults to `high`;
- `ARCHIC_OPENAI_MAX_OUTPUT_TOKENS` — defaults to `3500`.

No Cursor API key or Cursor subscription is required.

## Reference benchmark dataset

Add an external reference website with:

```bash
npm run benchmark:add-reference -- https://example.com premium-real-estate "Example Brand"
```

A project does not receive a niche percentile until the reference set has at least 10 samples, avoiding fake precision from tiny datasets.

## Next meaningful layer

The next major upgrade is project-specific browser journeys with real assertions, for example:

```text
Reservation CTA
→ date
→ party size
→ details
→ successful inquiry confirmation
```

Journey failures should activate hard quality gates and provide reproducible evidence for the implementation work.

## Commands

```bash
npm run dev
npm run benchmark:demo
npm run benchmark
npm run benchmark:add-reference -- <url> <profile> [name]
npm run build
npm run validate
npm test
```
