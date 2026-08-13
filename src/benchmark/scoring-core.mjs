export const clampScore = n => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
