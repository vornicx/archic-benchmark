const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));

export const CATEGORY_LABELS = {
  businessFit: 'Business fit', visualDesign: 'Visual design', ux: 'UX & architecture', conversion: 'Conversion', mobile: 'Mobile', performance: 'Performance', seoGeo: 'SEO + GEO', content: 'Content & copy', accessibility: 'Accessibility', securityTrust: 'Security & trust', robustness: 'Robustness'
};

export function weightedScore(scores, weights) {
  let total = 0, weightTotal = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (!Number.isFinite(scores[key])) continue;
    total += clamp(scores[key]) * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : 0;
}

export function applyGates(rawScore, signals, gates) {
  const active = gates.filter(g => Boolean(signals[g.when])).map(g => ({ ...g }));
  const cap = active.reduce((lowest, gate) => Math.min(lowest, gate.cap), 100);
  return { score: Math.min(rawScore, cap), cap, active };
}

export function qualityTier(score) {
  if (score >= 95) return 'Reference Quality';
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Premium';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Acceptable';
  return 'Needs work';
}

export function scoreDelta(current, previous) {
  if (!Number.isFinite(previous)) return null;
  return Number((current - previous).toFixed(1));
}

export function percentile(score, samples, minSamples = 10) {
  const clean = (samples || []).filter(Number.isFinite).sort((a,b) => a-b);
  if (clean.length < minSamples) return null;
  const below = clean.filter(v => v < score).length;
  const equal = clean.filter(v => v === score).length;
  return Math.round(((below + 0.5 * equal) / clean.length) * 100);
}

export function scoreFromThreshold(value, good, poor, higherIsBetter = false) {
  if (!Number.isFinite(value)) return 55;
  if (higherIsBetter) {
    if (value >= good) return 100;
    if (value <= poor) return 20;
    return clamp(20 + ((value - poor) / (good - poor)) * 80);
  }
  if (value <= good) return 100;
  if (value >= poor) return 20;
  return clamp(100 - ((value - good) / (poor - good)) * 80);
}

export function average(items, fallback = 0) {
  const clean = items.filter(Number.isFinite);
  return clean.length ? clean.reduce((a,b) => a+b, 0) / clean.length : fallback;
}
