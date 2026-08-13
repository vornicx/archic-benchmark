import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../src/storage.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const projects=await readJson(path.join(root,'config/projects.json'));
const benchmarks=await readJson(path.join(root,'config/benchmarks.json'));
for(const [id,p] of Object.entries(benchmarks.profiles)){
  const sum=Object.values(p.weights).reduce((a,b)=>a+b,0);
  if(sum!==100) throw new Error(`${id}: weights sum to ${sum}`);
}
for(const p of projects.projects){if(!benchmarks.profiles[p.profile]) throw new Error(`${p.name}: unknown profile ${p.profile}`);}
console.log(`Configuration valid · ${Object.keys(benchmarks.profiles).length} benchmark profiles · ${projects.projects.length} projects`);
