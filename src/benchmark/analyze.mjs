import path from 'node:path';
import fs from 'node:fs/promises';
import { scanViewport } from './browser-scan.mjs';
import { deriveAutomatedScores, deriveSignals, deriveIssues } from './rules.mjs';
import { weightedScore, applyGates, qualityTier, scoreDelta } from './scoring.mjs';
import { rankIssues } from './prioritize.mjs';
import { reviewWithAI, mergeAIReview } from './ai-review.mjs';

const timeoutSignal=ms=>AbortSignal.timeout(ms);
async function safeFetch(url,options={}){try{return await fetch(url,{redirect:'follow',signal:timeoutSignal(options.timeout||10000),...options});}catch{return null;}}
async function getHeaders(url){const res=await safeFetch(url,{timeout:12000});if(!res)return{httpOk:false,status:null,headers:{}};return{httpOk:res.ok,status:res.status,finalUrl:res.url,headers:Object.fromEntries(res.headers.entries())};}
async function checkEndpoint(origin,file){const res=await safeFetch(new URL(file,origin),{timeout:7000});return Boolean(res?.ok);}
async function brokenLinkRatio(urls){const sample=[...new Set(urls||[])].filter(u=>/^https?:/i.test(u)).slice(0,12);if(!sample.length)return{ratio:0,checked:0,broken:[]};const rows=await Promise.all(sample.map(async url=>{const res=await safeFetch(url,{method:'HEAD',timeout:6000});if(res&&res.status<400)return{url,ok:true};const retry=await safeFetch(url,{method:'GET',timeout:6000});return{url,ok:Boolean(retry&&retry.status<400)};}));const broken=rows.filter(r=>!r.ok).map(r=>r.url);return{ratio:broken.length/rows.length,checked:rows.length,broken};}
function headerSignals(headers){const get=key=>headers[key.toLowerCase()]||null;return{hsts:Boolean(get('strict-transport-security')),csp:Boolean(get('content-security-policy')),referrerPolicy:Boolean(get('referrer-policy')),permissionsPolicy:Boolean(get('permissions-policy')),xContentTypeOptions:Boolean(get('x-content-type-options')),frameProtection:Boolean(get('x-frame-options'))};}
async function safeViewportScan(url,options){try{return{scan:await scanViewport(url,options),error:null};}catch(error){return{scan:null,error:error?.message||String(error)};}}

export async function analyzeProject({project,profile,gates,rootDir,previous=null}){
  const startedAt=new Date();
  if(!project.url)return{id:project.id,name:project.name,profile:project.profile,status:'not-configured',score:null,tier:'Not configured',issues:[]};
  const shotDir=path.join(rootDir,'public','screenshots',project.id);const desktopPath=path.join(shotDir,'desktop.jpg');const mobilePath=path.join(shotDir,'mobile.jpg');await fs.mkdir(shotDir,{recursive:true});
  const response=await getHeaders(project.url);
  const [desktopResult,mobileResult]=await Promise.all([
    safeViewportScan(project.url,{width:1440,height:1000,screenshotPath:desktopPath}),
    safeViewportScan(project.url,{width:390,height:844,mobile:true,screenshotPath:mobilePath})
  ]);
  const desktop=desktopResult.scan,mobile=mobileResult.scan;
  const browserErrors=[desktopResult.error&&`desktop: ${desktopResult.error}`,mobileResult.error&&`mobile: ${mobileResult.error}`].filter(Boolean);
  const screenshotErrors=[desktop?.screenshotError&&`desktop: ${desktop.screenshotError}`,mobile?.screenshotError&&`mobile: ${mobile.screenshotError}`].filter(Boolean);
  const scanDiagnostics={browserErrors,screenshotErrors};
  const origin=(()=>{try{return new URL(project.url).origin}catch{return project.url}})();
  const [robots,sitemap]=await Promise.all([checkEndpoint(origin,'/robots.txt'),checkEndpoint(origin,'/sitemap.xml')]);

  if(!desktop||!mobile){
    return{id:project.id,name:project.name,url:project.url,finalUrl:response.finalUrl||project.url,repository:project.repository||null,profile:project.profile,profileLabel:profile.label,positioning:project.positioning,market:project.market,primaryGoal:project.primaryGoal,status:response.httpOk?'scan-failed':'critical',score:null,rawScore:null,cap:null,tier:response.httpOk?'Scan incomplete':'Unavailable',delta:null,categoryScores:{},gates:[],issues:[],topPriority:null,aiReview:null,metrics:{lcpMs:null,mobileLcpMs:null,cls:null,ttfbMs:null,totalBlockingMs:null,transferKb:null,resourceCount:null},checks:{httpOk:response.httpOk,status:response.status,horizontalOverflow:null,robots,sitemap,brokenInternalLinks:null,consoleErrors:null,failedRequests:null},screenshots:null,scanDiagnostics,reviewedAt:new Date().toISOString(),durationMs:Date.now()-startedAt.getTime()};
  }

  const dom=desktop.dom||{};const mobileDom=mobile.dom||{};const linkCheck=await brokenLinkRatio(dom.internalLinks);
  const metrics={...(desktop.metrics||{}),mobileLcpMs:mobile.metrics?.lcpMs??null,mobileCls:mobile.metrics?.cls??null,mobileTotalBlockingMs:mobile.metrics?.totalBlockingMs??null};
  const combinedDom={
    ...dom,
    tinyTapTargetRatio:mobileDom.tinyTapTargetRatio??dom.tinyTapTargetRatio,
    tinyTextRatio:mobileDom.tinyTextRatio??dom.tinyTextRatio,
    unnamedButtonRatio:mobileDom.unnamedButtonRatio??dom.unnamedButtonRatio,
    unlabelledFormControlRatio:mobileDom.unlabelledFormControlRatio??dom.unlabelledFormControlRatio,
    brokenInternalLinkRatio:linkCheck.ratio,
    brokenInternalLinks:linkCheck.broken
  };
  const checks={httpOk:response.httpOk,status:response.status,viewportMeta:Boolean(dom.viewportMeta),horizontalOverflow:Boolean(mobileDom.horizontalOverflow),formsHaveAction:mobileDom.formsHaveAction!==false,robots,sitemap,criticalJourneyFailure:false};
  const scan={url:response.finalUrl||project.url,metrics,dom:combinedDom,headers:headerSignals(response.headers),checks,console:{errorCount:(desktop.console?.errorCount||0)+(mobile.console?.errorCount||0),errors:[...(desktop.console?.errors||[]),...(mobile.console?.errors||[])].slice(0,12)},network:{failedRequestCount:(desktop.network?.failedRequestCount||0)+(mobile.network?.failedRequestCount||0),failures:[...(desktop.network?.failures||[]),...(mobile.network?.failures||[])].slice(0,12),canceledRequestCount:(desktop.network?.canceledRequestCount||0)+(mobile.network?.canceledRequestCount||0)}};
  const automatedScores=deriveAutomatedScores(scan,profile);
  let aiReview=null;
  try{
    aiReview=await reviewWithAI({project,profile,desktopScreenshot:desktop.screenshotCaptured?desktopPath:null,mobileScreenshot:mobile.screenshotCaptured?mobilePath:null,automatedScores,scan});
  }catch(e){
    aiReview={error:e.message,provider:'openai'};
  }
  const categoryScores=mergeAIReview(automatedScores,aiReview);const rawScore=weightedScore(categoryScores,profile.weights);const gated=applyGates(rawScore,deriveSignals(scan),gates);const automatedIssues=deriveIssues(scan);const aiIssues=Array.isArray(aiReview?.issues)?aiReview.issues.map((x,i)=>({id:`ai-${i}`,...x})):[];const gateIssues=gated.active.map(g=>({id:`gate-${g.id}`,category:'robustness',severity:g.severity,title:g.label,detail:`Quality gate caps the project at ${g.cap}/100 until resolved.`,impact:95,effort:'m',gate:true}));const issues=rankIssues([...gateIssues,...aiIssues,...automatedIssues],profile.weights);const score=Number(gated.score.toFixed(1));
  const status=response.httpOk?(screenshotErrors.length?'partial':'ok'):'critical';
  return{id:project.id,name:project.name,url:project.url,finalUrl:scan.url,repository:project.repository||null,profile:project.profile,profileLabel:profile.label,positioning:project.positioning,market:project.market,primaryGoal:project.primaryGoal,status,score,rawScore:Number(rawScore.toFixed(1)),cap:gated.cap,tier:qualityTier(score),delta:scoreDelta(score,previous?.score),categoryScores:Object.fromEntries(Object.entries(categoryScores).map(([k,v])=>[k,Number(v.toFixed(1))])),gates:gated.active,issues,topPriority:issues[0]||null,aiReview:aiReview?{provider:aiReview.provider||null,model:aiReview.model||null,summary:aiReview.summary||null,strengths:aiReview.strengths||[],confidence:aiReview.confidence??null,error:aiReview.error||null,usage:aiReview.usage||null}:null,metrics:{lcpMs:metrics.lcpMs??null,mobileLcpMs:metrics.mobileLcpMs??null,cls:metrics.cls??null,ttfbMs:metrics.ttfbMs??null,totalBlockingMs:metrics.totalBlockingMs??null,transferKb:metrics.transferKb??null,resourceCount:metrics.resourceCount??null},checks:{httpOk:checks.httpOk,status:checks.status,horizontalOverflow:checks.horizontalOverflow,robots:checks.robots,sitemap:checks.sitemap,brokenInternalLinks:linkCheck.broken.length,consoleErrors:scan.console.errorCount,failedRequests:scan.network.failedRequestCount},screenshots:desktop.screenshotCaptured&&mobile.screenshotCaptured?{desktop:`/screenshots/${project.id}/desktop.jpg`,mobile:`/screenshots/${project.id}/mobile.jpg`}:null,scanDiagnostics,reviewedAt:new Date().toISOString(),durationMs:Date.now()-startedAt.getTime()};
}
