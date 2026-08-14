import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../src/storage.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [projectId,maxIssuesRaw='3']=process.argv.slice(2);
const maxIssues=Math.max(1,Math.min(8,Number(maxIssuesRaw)||3));

if(!projectId){
  console.error('Usage: npm run benchmark:autofix -- <project-id> [max-issues]');
  process.exit(2);
}
if(!process.env.CURSOR_API_KEY){
  console.error('CURSOR_API_KEY is required for Cursor autofix.');
  process.exit(2);
}

const [config,latest]=await Promise.all([
  readJson(path.join(root,'config/projects.json'),{projects:[]}),
  readJson(path.join(root,'data/latest.json'),{projects:[]})
]);

const project=config.projects.find(item=>item.id===projectId);
const report=latest.projects?.find(item=>item.id===projectId);
if(!project)throw new Error(`Unknown project: ${projectId}`);
if(!project.repository)throw new Error(`Project ${projectId} has no repository mapping.`);
if(!report||!Number.isFinite(report.score))throw new Error(`No live benchmark result exists for ${projectId}.`);

const issues=(report.issues||[])
  .filter(issue=>!issue.gate||issue.recommendation||issue.detail)
  .slice(0,maxIssues);

if(!issues.length){
  console.log(`${project.name}: no actionable benchmark issues.`);
  process.exit(0);
}

const prompt=`You are the implementation agent for Archic's website quality system.

Fix the selected benchmark issues in ${project.name}. Work conservatively and at production quality.

Business context:
${JSON.stringify({
  name:project.name,
  liveUrl:project.url,
  positioning:project.positioning,
  market:project.market,
  primaryGoal:project.primaryGoal,
  secondaryGoal:project.secondaryGoal,
  benchmarkScore:report.score,
  benchmarkTier:report.tier
},null,2)}

Selected issues:
${JSON.stringify(issues.map(issue=>({
  category:issue.category,
  severity:issue.severity,
  title:issue.title,
  location:issue.location,
  evidence:issue.evidence,
  observed:issue.observed,
  expected:issue.expected,
  recommendation:issue.recommendation,
  detail:issue.detail
})),null,2)}

Rules:
- Fix only issues supported by the benchmark evidence or directly verified in the repository.
- Preserve the project's existing visual identity; do not redesign unrelated areas.
- No placeholder/fake content, fake images, invented listings, invented business facts or AI-slop.
- Keep desktop and mobile quality equally high.
- Preserve accessibility, SEO, security, performance and existing business flows.
- Inspect existing conventions and reuse the project's components/design tokens.
- Run the relevant tests, lint and build commands available in the repository.
- If an issue cannot be safely fixed without missing business input, document it instead of guessing.
- Make the smallest coherent production-quality change set.
- Before finishing, review the diff for regressions and remove accidental/debug changes.

Return a concise summary of what changed, what you verified, and anything intentionally left unresolved.`;

const {Agent}=await import('@cursor/sdk');
const model=process.env.ARCHIC_CURSOR_FIX_MODEL||process.env.ARCHIC_CURSOR_MODEL||'composer-2.5';
const agent=await Agent.create({
  apiKey:process.env.CURSOR_API_KEY,
  model:{id:model},
  cloud:{
    repos:[{
      url:`https://github.com/${project.repository}`,
      startingRef:project.startingRef||'main'
    }],
    autoCreatePR:true,
    skipReviewerRequest:true
  }
});

try{
  console.log(`Cursor autofix · ${project.name} · ${issues.length} issues · ${model}`);
  const run=await agent.send({text:prompt});
  const result=await run.wait();
  if(String(result?.status||'').toLowerCase()==='error')throw new Error('Cursor autofix failed.');
  const prUrl=result?.git?.branches?.find(branch=>branch?.prUrl)?.prUrl;
  if(prUrl)console.log(`PR: ${prUrl}`);
  console.log(result?.result||result?.text||'Cursor agent completed.');
}finally{
  if(agent?.[Symbol.asyncDispose])await agent[Symbol.asyncDispose]();
}
