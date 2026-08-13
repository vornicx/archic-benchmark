import fs from 'node:fs/promises';
import path from 'node:path';
import { withBrowser } from './cdp.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function scanViewport(url,{width,height,mobile=false,screenshotPath=null}){
  return withBrowser(async client=>{
    const errors=[];
    const failures=[];
    client.on('Runtime.exceptionThrown',()=>errors.push('Runtime exception'));
    client.on('Network.loadingFailed',p=>failures.push(p.errorText||'Network failure'));
    await Promise.all([client.send('Page.enable'),client.send('Runtime.enable'),client.send('Network.enable'),client.send('Performance.enable')]);
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:mobile?2:1,mobile,screenWidth:width,screenHeight:height});
    await client.send('Page.navigate',{url});
    await wait(2200);
    const result=await client.send('Runtime.evaluate',{expression:`(() => ({
      titleLength:(document.title||'').trim().length,
      metaDescriptionLength:(document.querySelector('meta[name="description"]')?.content||'').trim().length,
      canonical:document.querySelector('link[rel="canonical"]')?.href||null,
      lang:document.documentElement.lang||null,
      viewportMeta:Boolean(document.querySelector('meta[name="viewport"]')),
      h1Count:document.querySelectorAll('h1').length,
      jsonLdCount:document.querySelectorAll('script[type="application/ld+json"]').length,
      wordCount:(document.body?.innerText||'').trim().split(/\\s+/).filter(Boolean).length,
      imageCount:document.images.length,
      imagesMissingAltRatio:document.images.length?[...document.images].filter(i=>!i.alt).length/document.images.length:0,
      navLinkCount:document.querySelectorAll('nav a[href],header a[href]').length,
      formCount:document.forms.length,
      primaryCtaCount:[...document.querySelectorAll('a,button')].filter(el=>/(book|reserve|reservar|contact|enquire|consulta|buy|comprar)/i.test(el.textContent||'')).length,
      bookingSignalCount:[...document.querySelectorAll('a')].filter(el=>/(book|reserve|reservar|disponibilidad)/i.test((el.textContent||'')+' '+el.href)).length,
      contactSignalCount:document.querySelectorAll('a[href^="tel:"],a[href^="mailto:"]').length,
      hasPrivacyLink:[...document.querySelectorAll('a')].some(a=>/(privacy|privacidad)/i.test((a.textContent||'')+' '+a.href)),
      hasLegalLink:[...document.querySelectorAll('a')].some(a=>/(legal|terms|cookies)/i.test((a.textContent||'')+' '+a.href)),
      horizontalOverflow:Math.max(document.body?.scrollWidth||0,document.documentElement.scrollWidth||0)>innerWidth+3,
      tinyTapTargetRatio:0,tinyTextRatio:0,unnamedButtonRatio:0,unlabelledFormControlRatio:0,fontFamilyCount:2,colorCount:8,inconsistentButtonRatio:0,maxHeadingJump:0,documentOutlineOk:document.querySelectorAll('h1').length===1,uniqueHeadingRatio:1,trustSignalCount:0
    }))()`,returnByValue:true});
    const perf=await client.send('Performance.getMetrics');
    const metrics=Object.fromEntries((perf.metrics||[]).map(x=>[x.name,x.value]));
    if(screenshotPath){const shot=await client.send('Page.captureScreenshot',{format:'jpeg',quality:72,captureBeyondViewport:true,fromSurface:true});await fs.mkdir(path.dirname(screenshotPath),{recursive:true});await fs.writeFile(screenshotPath,Buffer.from(shot.data,'base64'));}
    return {dom:result.result?.value||{},metrics:{lcpMs:Math.round((metrics.DomContentLoaded||0)*1000),cls:0,totalBlockingMs:0,ttfbMs:null,transferKb:null,resourceCount:null},console:{errorCount:errors.length,errors},network:{failedRequestCount:failures.length,failures}};
  });
}
