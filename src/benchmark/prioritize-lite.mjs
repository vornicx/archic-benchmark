export function priorityScore(issue, weight = 8) {
  const severity = issue.severity === 'high' ? 1.2 : issue.severity === 'medium' ? 0.9 : issue.severity === 'low' ? 0.55 : 1.5;
  const effort = { xs:1.25, s:1.12, m:1, l:0.82, xl:0.68 }[issue.effort] || 1;
  return Math.min(100, Math.round((issue.impact ?? 50) * severity * (0.72 + weight / 100 * 2.6) * effort));
}
