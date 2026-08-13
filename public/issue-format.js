export function issueDetailText(issue){
  return [
    issue.detail,
    issue.evidence ? `Evidence: ${issue.evidence}` : null,
    issue.observed ? `Observed: ${issue.observed}` : null,
    issue.expected ? `Expected: ${issue.expected}` : null,
    issue.location ? `Location: ${issue.location}` : null,
    issue.recommendation ? `Recommended fix: ${issue.recommendation}` : null
  ].filter(Boolean).join('\n');
}
