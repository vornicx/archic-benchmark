import { average, scoreFromThreshold } from './scoring.mjs';

const issue=(id,category,severity,title,detail,impact,effort='s')=>({id,category,severity,title,detail,impact,effort});

export function deriveAutomatedScores(scan){
  const m=scan.metrics||{},d=scan.dom||{},h=scan.headers||{},c=scan.checks||{};
  const performance=average([scoreFromThreshold(m.lcpMs,2500,6000),scoreFromThreshold(m.cls,0.1,0.35),scoreFromThreshold(m.ttfbMs,800,2000)],55);
  const mobile=average([c.viewportMeta?100:20,c.horizontalOverflow?25:100,scoreFromThreshold(d.tinyTapTargetRatio??0,0.05,0.35),scoreFromThreshold(m.mobileLcpMs??m.lcpMs,2500,6000)],55);
  const seoGeo=average([d.titleLength?90:10,d.metaDescriptionLength?90:10,d.canonical?100:45,d.h1Count===1?100:55,d.lang?100:45,d.jsonLdCount>0?100:48,c.robots?100:55,c.sitemap?100:50],55);
  const accessibility=average([scoreFromThreshold(d.imagesMissingAltRatio??0,0.02,0.45),scoreFromThreshold(d.unlabelledFormControlRatio??0,0.01,0.4),scoreFromThreshold(d.unnamedButtonRatio??0,0.01,0.3)],55);
  const securityTrust=average([scan.url?.startsWith('https://')?100:10,h.hsts?100:55,h.csp?100:60,d.hasPrivacyLink?100:55,d.hasLegalLink?100:62],55);
  const robustness=average([c.httpOk?100:5,scoreFromThreshold(scan.console?.errorCount??0,0,8),scoreFromThreshold(scan.network?.failedRequestCount??0,0,10)],55);
  const ux=average([c.horizontalOverflow?35:95,d.navLinkCount>=3?95:70,d.primaryCtaCount>=1?95:52],60);
  const conversion=average([d.primaryCtaCount>=1?96:45,d.contactSignalCount>=1?92:55,d.formCount>0||d.bookingSignalCount>0?93:60,mobile],60);
  const content=average([d.wordCount>=180?92:d.wordCount>=80?75:52,d.h1Count===1?95:60,d.imagesMissingAltRatio<0.1?88:58],60);
  return {businessFit:average([conversion,ux,content],60),visualDesign:average([c.horizontalOverflow?30:95,scoreFromThreshold(d.tinyTextRatio??0,0.02,0.22)],65),ux,conversion,mobile,performance,seoGeo,content,accessibility,securityTrust,robustness};
}

export function deriveSignals(scan){
  const d=scan.dom||{},m=scan.metrics||{},c=scan.checks||{};
  return {siteUnreachable:!c.httpOk,noHttps:!scan.url?.startsWith('https://'),criticalJourneyFailure:Boolean(c.criticalJourneyFailure),mobileHorizontalOverflow:Boolean(c.horizontalOverflow),severeTinyTargets:(d.tinyTapTargetRatio||0)>0.35,verySlowLcp:(m.mobileLcpMs??m.lcpMs??0)>6000,severeCls:(m.cls??0)>0.35,missingPrimaryMeta:!d.titleLength||!d.metaDescriptionLength};
}

export function deriveIssues(scan){
  const out=[];const d=scan.dom||{},m=scan.metrics||{},c=scan.checks||{};
  if(!c.httpOk)out.push(issue('site-unreachable','robustness','critical','Site unreachable','The primary page did not return a successful response.',100,'xs'));
  if(c.horizontalOverflow)out.push(issue('mobile-overflow','mobile','high','Fix horizontal overflow','The mobile viewport can scroll sideways.',92,'s'));
  if((m.mobileLcpMs??m.lcpMs??0)>4000)out.push(issue('slow-lcp','performance','high','Reduce LCP','Largest Contentful Paint is above target.',84,'m'));
  if(!d.metaDescriptionLength)out.push(issue('meta-description','seoGeo','medium','Add meta description','The page is missing a meta description.',62,'xs'));
  if(!d.jsonLdCount)out.push(issue('structured-data','seoGeo','medium','Add structured data','No JSON-LD was detected.',64,'s'));
  if((scan.console?.errorCount??0)>0)out.push(issue('console-errors','robustness','high','Resolve console errors','Browser console errors were observed.',78,'m'));
  if(!d.primaryCtaCount)out.push(issue('primary-cta','conversion','high','Clarify the primary CTA','The page does not expose a clear primary action.',86,'m'));
  return out;
}
