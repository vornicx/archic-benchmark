import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson, madridDate, appendHistory } from '../src/storage.mjs';
import { analyzeProject } from '../src/benchmark/analyze.mjs';
import { portfolioQueue } from '../src/benchmark/prioritize.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=await readJson(path.join(root,'config/projects.json'),{projects:[]});
const benchmarks=await readJson(path.join(root,'config/benchmarks.json'));
const gates=await readJson(path.join(root,'config/gates.json'),{gates:[]});
const previous=await readJson(path.join(root,'data/latest.json'),{projects:[]});

if(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_EVENT_NAME==='schedule'){
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hour12:false}).format(new Date()));
  const today=madridDate();
  if(previous.date===today||hour<7||hour>=10){console.log(`Skipping scheduled scan · Madrid ${String(hour).padStart(2,'0')}:xx`);process.exit(0);}
}

const reports=[];
for(const project of config.projects){
  const profile=benchmarks.profiles[project.profile];
  if(!project.enabled||!project.url){reports.push({id:project.id,name:project.name,profile:project.profile,profileLabel:profile?.label,status:'not-configured',score:null,tier:'Not configured',issues:[]});continue;}
  console.log(`→ Scanning ${project.name} · ${project.url}`);
  const report=await analyzeProject({project,profile,gates:gates.gates,rootDir:root,previous:previous.projects?.find(p=>p.id===project.id)||null});
  reports.push(report);
  if(report.status==='scan-failed') console.warn(`  ! Browser scan failed · ${(report.scanDiagnostics?.browserErrors||[]).join(' | ')||'unknown error'}`);
  else if(report.scanDiagnostics?.screenshotErrors?.length) console.warn(`  ! Screenshot fallback · ${report.scanDiagnostics.screenshotErrors.join(' | ')}`);
  else console.log(`  ✓ ${Number.isFinite(report.score)?`${report.score}/100`:'not scored'} · ${report.status}`);
}
const scored=reports.filter(p=>Number.isFinite(p.score));
const score=scored.length?Number((scored.reduce((sum,p)=>sum+p.score,0)/scored.length).toFixed(1)):null;
const aiReviews=reports.filter(p=>String(p.aiReview?.provider||'').startsWith('openai'));
const aiUsage=aiReviews.reduce((acc,p)=>{
  const usage=p.aiReview?.usage||{};
  acc.inputTokens+=(usage.inputTokens||0);
  acc.outputTokens+=(usage.outputTokens||0);
  acc.totalTokens+=(usage.totalTokens||0);
  if(p.aiReview?.error)acc.errors+=1;
  else if(p.aiReview?.summary)acc.completed+=1;
  return acc;
},{provider:'openai-compatible',completed:0,errors:0,inputTokens:0,outputTokens:0,totalTokens:0});
const report={schemaVersion:2,mode:'live',date:madridDate(),generatedAt:new Date().toISOString(),portfolio:{score,delta:Number.isFinite(previous.portfolio?.score)&&Number.isFinite(score)?Number((score-previous.portfolio.score).toFixed(1)):null,projectsScored:scored.length,criticalProjects:scored.filter(p=>p.status==='critical').length,scanFailures:reports.filter(p=>p.status==='scan-failed').length,activeGates:scored.reduce((n,p)=>n+(p.gates?.length||0),0),aiUsage},dailyQueue:portfolioQueue(scored,8),projects:reports};
await writeJson(path.join(root,'data/latest.json'),report);
await writeJson(path.join(root,'public/api/latest.json'),report);
await appendHistory(root,report);
console.log(`Archic Benchmark ${report.date} · ${score??'—'}/100 · ${report.portfolio.scanFailures} scan failures · AI ${aiUsage.completed} reviews · ${aiUsage.totalTokens} tokens`);
