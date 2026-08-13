import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../src/storage.mjs';
import { analyzeProject } from '../src/benchmark/analyze.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [,, url, profileId, ...nameParts] = process.argv;
if (!url || !profileId) {
  console.error('Usage: node scripts/add-reference.mjs <url> <profile> [name]');
  process.exit(1);
}
const benchmarks = await readJson(path.join(root,'config/benchmarks.json'));
const gates = await readJson(path.join(root,'config/gates.json'),{gates:[]});
const refs = await readJson(path.join(root,'data/reference-benchmarks.json'),{profiles:{}});
const profile=benchmarks.profiles[profileId];
if(!profile){console.error(`Unknown profile: ${profileId}`);process.exit(1)}
const project={id:`reference-${Date.now()}`,name:nameParts.join(' ')||new URL(url).hostname,url,profile:profileId,positioning:'Reference site',market:'Benchmark dataset',primaryGoal:profile.criticalJourney};
const report=await analyzeProject({project,profile,gates:gates.gates,rootDir:root,previous:null});
refs.profiles ||= {}; refs.profiles[profileId] ||= [];
const key=new URL(url).hostname;
refs.profiles[profileId]=[{name:project.name,url,host:key,score:report.score,categoryScores:report.categoryScores,reviewedAt:report.reviewedAt},...refs.profiles[profileId].filter(x=>x.host!==key)].slice(0,200);
refs.updatedAt=new Date().toISOString();
await writeJson(path.join(root,'data/reference-benchmarks.json'),refs);
console.log(`${project.name}: ${report.score}/100 added to ${profile.label} benchmark (${refs.profiles[profileId].length} samples).`);
