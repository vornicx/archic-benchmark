# Archic Benchmark

Internal website quality operating system for Archic.

The goal is not to produce another generic website score. Archic Benchmark answers a more useful question:

> How good is this website for the specific business it is supposed to win for, what regressed, and what should we improve today?

## V2

Archic Benchmark V2 closes the loop from measurement to controlled implementation:

- niche-specific scoring for every enabled project;
- real Chromium desktop and mobile scans;
- performance, SEO/GEO, accessibility, security, runtime and conversion checks;
- hard quality gates for commercially broken experiences;
- desktop and mobile screenshots;
- an AI layer that is optional rather than required;
- Cursor as the preferred qualitative reviewer, with optional OpenAI fallback;
- AI blending only into qualitative categories, never directly into technical categories;
- portfolio-wide prioritisation and daily history;
- project-to-GitHub repository mapping;
- manual Cursor Cloud Agent autofix that opens a separate PR in the target project.

The core rule is simple: **measurement must remain trustworthy even when AI is unavailable**.

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
        ├──── optional Cursor/OpenAI qualitative review
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
Portfolio daily queue
        │
        ├── 07:00 report + history
        │
        └── manual Cursor Cloud Agent
                    │
                    ▼
              target-repo PR
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

`repository` and `startingRef` are used for the optional Cursor autofix path. They do not affect deterministic website scoring.

## AI qualitative review

AI review is optional. A missing key, provider error or low-confidence review does not invalidate the deterministic benchmark.

Provider selection:

```env
ARCHIC_AI_PROVIDER=auto
```

Supported modes:

- `auto`: prefer Cursor and fall back to OpenAI when configured;
- `cursor`: Cursor only;
- `openai`: OpenAI only;
- `off`: deterministic benchmark only.

### Cursor

```env
CURSOR_API_KEY=...
ARCHIC_CURSOR_MODEL=composer-2.5
```

The reviewer receives the objective scan plus desktop/mobile screenshots and is instructed to perform a read-only design/business critique relative to the actual niche and positioning.

### Optional OpenAI fallback

```env
OPENAI_API_KEY=...
ARCHIC_OPENAI_MODEL=...
```

`ARCHIC_REVIEW_MODEL` is still accepted for backwards compatibility.

AI can influence only visual design, business fit, UX, conversion and content/copy. Performance, mobile, SEO/GEO, accessibility, security and robustness remain driven by deterministic checks and gates. Reviews below the confidence threshold are ignored.

## Daily 07:00 run

`.github/workflows/daily-benchmark.yml` contains two UTC cron entries plus a Madrid-time/idempotency guard. This avoids the CET/CEST one-hour drift and still runs the benchmark once each morning.

The workflow:

1. checks out the repository;
2. installs dependencies;
3. discovers Chrome;
4. validates configuration;
5. runs tests;
6. scans enabled projects;
7. optionally adds a Cursor/OpenAI qualitative review;
8. writes latest/history/screenshots;
9. commits only benchmark artifacts back to this repository.

### GitHub configuration

For Cursor review and autofix add:

- secret `CURSOR_API_KEY`;
- variable `ARCHIC_AI_PROVIDER=auto` (optional; `auto` is the code default);
- variable `ARCHIC_CURSOR_MODEL=composer-2.5` (optional; this is the code default);
- variable `ARCHIC_CURSOR_FIX_MODEL` if the implementation agent should use a different model.

For optional OpenAI fallback add:

- secret `OPENAI_API_KEY`;
- variable `ARCHIC_OPENAI_MODEL`.

## Cursor Benchmark Autofix

Autofix is deliberately **not scheduled** and never auto-merges.

Run the GitHub Actions workflow **Cursor Benchmark Autofix**, choose the project and choose how many top issues to address.

Local equivalent:

```bash
CURSOR_API_KEY=... npm run benchmark:autofix -- marbella-for-sale 3
```

The script reads the latest measured report, takes the selected high-priority issues, supplies the evidence and business context to a Cursor Cloud Agent, and works against the mapped source repository.

The implementation prompt explicitly requires the agent to:

- verify issues in the real repository instead of guessing;
- preserve the existing visual identity;
- avoid placeholder content, fake imagery, invented listings and invented business facts;
- protect desktop and mobile quality;
- reuse existing design tokens/components;
- run the repository's available tests/lint/build checks;
- leave an issue unresolved rather than invent missing business input;
- review its own diff for regressions.

With `autoCreatePR` enabled, the Cursor Cloud Agent performs the work on its own branch and opens a PR in the target project.

The operating loop becomes:

```text
Measure → diagnose → rank → select → implement in PR → review → merge → measure again
```

## Current project mappings

- `mfinity` → `vornicx/mfinity-premium`
- `trenes-y-tranvias` → `vornicx/trenesytranvias`
- `marbella-boat-charter` → `vornicx/marbellaboatcharter`
- `marbella-for-sale` → `vornicx/marbellaforsale`
- `la-bocana` → `vornicx/la-bocana-web-v8-mobile`
- `noguera` → `vornicx/Inmobiliaria-Noguera`

## Reference benchmark dataset

Add an external reference website with:

```bash
npm run benchmark:add-reference -- https://example.com premium-real-estate "Example Brand"
```

A project does not receive a niche percentile until the reference set has at least 10 samples, avoiding fake precision from tiny datasets.

## Next meaningful layer

V2 now connects measurement to a controlled implementation PR. The next major upgrade is project-specific browser journeys with real assertions, for example:

```text
Reservation CTA
→ date
→ party size
→ details
→ successful inquiry confirmation
```

Journey failures should activate hard quality gates and provide reproducible evidence to the implementation agent.

## Commands

```bash
npm run dev
npm run benchmark:demo
npm run benchmark
npm run benchmark:autofix -- <project-id> [max-issues]
npm run benchmark:add-reference -- <url> <profile> [name]
npm run build
npm run validate
npm test
```
