import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJson, madridDate } from '../src/storage.mjs';
import { portfolioQueue } from '../src/benchmark/prioritize.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const project=(id,name,profileLabel,score,delta,categories,issues,status='ok')=>({id,name,profileLabel,score,delta,status,rawScore:score+1.8,cap:100,tier:score>=90?'Exceptional':score>=80?'Premium':'Good',categoryScores:categories,issues:issues.map((x,i)=>({id:`${id}-${i}`,effort:x.effort||'s',priority:x.priority||80,...x})),topPriority:issues[0]||null,metrics:{lcpMs:1820+Math.round((100-score)*45),mobileLcpMs:2180+Math.round((100-score)*58),cls:0.04,ttfbMs:310,totalBlockingMs:140,transferKb:1880,resourceCount:74},checks:{httpOk:true,status:200,horizontalOverflow:false,robots:true,sitemap:true,brokenInternalLinks:0,consoleErrors:0,failedRequests:0},reviewedAt:new Date().toISOString(),screenshots:null});
const base={businessFit:88,visualDesign:90,ux:86,conversion:84,mobile:82,performance:79,seoGeo:86,content:85,accessibility:84,securityTrust:90,robustness:92};
const projects=[
  project('la-bocana','La Bocana','Premium Restaurant',91.2,-0.4,{...base,visualDesign:94,businessFit:94,conversion:92,mobile:87},[{category:'robustness',severity:'critical',title:'Verify reservation enquiry end-to-end',detail:'The reservation path is the critical revenue journey and must stay regression-free.',impact:98,effort:'m',priority:100},{category:'performance',severity:'medium',title:'Reduce mobile hero cost',detail:'Hero media remains the largest mobile performance opportunity.',impact:62,effort:'m',priority:68}]),
  project('mfinity','Mfinity','Luxury Car Rental',86.4,1.8,{...base,visualDesign:91,conversion:79,mobile:74,robustness:86},[{category:'mobile',severity:'high',title:'Refine mobile booking flow',detail:'The booking experience feels less considered than the vehicle discovery experience.',impact:91,effort:'m',priority:96},{category:'conversion',severity:'high',title:'Clarify availability and next step',detail:'Make the transition from vehicle interest to enquiry feel immediate and premium.',impact:84,effort:'s',priority:90}]),
  project('noguera','Inmobiliaria Noguera','Premium Real Estate',88.7,0.2,{...base,visualDesign:93,ux:89,performance:77,robustness:89},[{category:'performance',severity:'high',title:'Optimize property gallery loading',detail:'Large property imagery is the main opportunity without reducing perceived quality.',impact:80,effort:'m',priority:88},{category:'conversion',severity:'medium',title:'Strengthen property enquiry continuity',detail:'Keep the selected property context visible throughout the enquiry flow.',impact:66,effort:'s',priority:74}]),
  {id:'trenes-y-tranvias',name:'Trenes y Tranvías',profileLabel:'Professional Services',status:'not-configured',score:null,tier:'Not configured',issues:[]}
];
const scored=projects.filter(p=>Number.isFinite(p.score));
const report={schemaVersion:1,mode:'demo',date:madridDate(),generatedAt:new Date().toISOString(),portfolio:{score:Number((scored.reduce((s,p)=>s+p.score,0)/scored.length).toFixed(1)),delta:0.7,projectsScored:3,criticalProjects:0,activeGates:1},dailyQueue:portfolioQueue(scored,8),projects};
await writeJson(path.join(root,'data','latest.json'),report);
console.log('Demo dataset generated.');
