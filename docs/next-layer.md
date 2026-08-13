# Next layer after V1

The next development work should deepen the same goal rather than expand into unrelated features.

## 1. Project-specific critical journeys

Add declarative browser journeys and hard assertions for each project.

Examples:

- La Bocana: reservation CTA → date → service/time → party → details → inquiry success.
- Mfinity: vehicle → booking → calendar → details → successful enquiry.
- Noguera: property discovery → property detail → enquiry with property context preserved.

## 2. Visual regression diff

Keep latest/baseline screenshots and calculate visual changes. Flag large unexplained diffs and changed critical components.

## 3. Real niche reference dataset

Curate 20–50 strong websites per important Archic niche and periodically rescan them. Use category-level percentiles, not only a total percentile.

## 4. Historical cause/effect

Associate score changes with commits so the system can answer:

- what changed;
- which change caused the regression;
- which fixes historically produce the most quality improvement.

## 5. Storage migration only when justified

The repository-backed JSON history is deliberately simple for V1. Move reports/screenshots to Supabase/Postgres + object storage when the dataset or concurrent usage makes Git-backed storage inconvenient.
