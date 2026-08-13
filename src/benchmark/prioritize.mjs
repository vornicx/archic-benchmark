const severityFactor = { critical: 1.5, high: 1.2, medium: 0.9, low: 0.55 };
const effortFactor = { xs: 1.25, s: 1.12, m: 1, l: 0.82, xl: 0.68 };

export function priorityScore(issue, categoryWeight = 8) {
  const impact = Number(issue.impact ?? 50);
  const severity = severityFactor[issue.severity] || 0.8;
  const effort = effortFactor[issue.effort] || 1;
  return Math.min(100, Math.round(impact * severity * (0.72 + categoryWeight / 100 * 2.6) * effort));
}

export function rankIssues(issues, weights) {
  return issues.map(issue => ({ ...issue, priority: priorityScore(issue, weights[issue.category] || 8) })).sort((a,b) => b.priority - a.priority);
}

export function portfolioQueue(projectReports, max = 8) {
  return projectReports.flatMap(project => (project.issues || []).map(issue => ({...issue, projectId:project.id, projectName:project.name, projectScore:project.score}))).sort((a,b) => b.priority - a.priority).slice(0,max);
}
