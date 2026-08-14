import fs from 'node:fs/promises';
import path from 'node:path';
import { withBrowser } from './cdp.mjs';
import { VITALS_SCRIPT, METRICS_SCRIPT } from './vitals.mjs';
import { MOBILE_PROBE } from './mobile-probe.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDocumentReady(client, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let last = { href: 'about:blank', readyState: 'loading' };
  while (Date.now() < deadline) {
    const result = await client.send('Runtime.evaluate', {
      expression: '({href: location.href, readyState: document.readyState})',
      returnByValue: true
    });
    last = result.result?.value || last;
    if (/^chrome-error:/i.test(last.href || '')) throw new Error(`Chrome rendered an error page for ${last.href}`);
    if (last.href && last.href !== 'about:blank' && (last.readyState === 'interactive' || last.readyState === 'complete')) return last;
    await wait(100);
  }
  throw new Error(`Navigation did not become ready within ${timeoutMs} ms (href=${last.href}, readyState=${last.readyState})`);
}

async function captureScreenshotSafe(client, screenshotPath) {
  if (!screenshotPath) return { captured: false, error: null };
  try {
    const shot = await client.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 76,
      fromSurface: true,
      captureBeyondViewport: false
    });
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
    return { captured: true, error: null };
  } catch (error) {
    return { captured: false, error: `Viewport screenshot failed: ${error?.message || error}` };
  }
}

export async function scanViewport(url,{width,height,mobile=false,screenshotPath=null}){
  return withBrowser(async client=>{
    const errors=[];
    const failures=[];
    const canceledRequests=[];
    const requests=new Map();
    client.on('Runtime.exceptionThrown',p=>errors.push(p?.exceptionDetails?.exception?.description||p?.exceptionDetails?.text||'Runtime exception'));
    client.on('Network.requestWillBeSent',p=>{if(p?.requestId&&p?.request?.url)requests.set(p.requestId,p.request.url)});
    client.on('Network.loadingFailed',p=>{
      const message=`${requests.get(p.requestId)||p.requestId||'request'} — ${p.errorText||'Network failure'}`;
      if(p?.canceled){canceledRequests.push(message);return;}
      failures.push(message);
    });
    await Promise.all([client.send('Page.enable'),client.send('Runtime.enable'),client.send('Network.enable'),client.send('Performance.enable')]);
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:mobile?2:1,mobile,screenWidth:width,screenHeight:height});
    await client.send('Page.addScriptToEvaluateOnNewDocument',{source:VITALS_SCRIPT});
    const navigation=await client.send('Page.navigate',{url});
    const navigationError=navigation?.errorText||null;
    if(navigationError&&navigationError!=='net::ERR_ABORTED') throw new Error(`Navigation failed for ${url}: ${navigationError}`);
    const ready=await waitForDocumentReady(client);
    await wait(500);
    const result=await client.send('Runtime.evaluate',{expression:`(() => ({
      documentUrl:location.href,
      titleLength:(document.title||'').trim().length,
      metaDescriptionLength:(document.querySelector('meta[name="description"]')?.content||'').trim().length,
      canonical:document.querySelector('link[rel="canonical"]')?.href||null,
      lang:document.documentElement.lang||null,
      viewportMeta:Boolean(document.querySelector('meta[name="viewport"]')),
      h1Count:document.querySelectorAll('h1').length,
      headingSamples:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].slice(0,6).map(h=>h.tagName+' “'+(h.innerText||'').trim().replace(/\\s+/g,' ').slice(0,70)+'”'),
      jsonLdCount:document.querySelectorAll('script[type="application/ld+json"]').length,
      wordCount:(document.body?.innerText||'').trim().split(/\\s+/).filter(Boolean).length,
      imageCount:document.images.length,
      imagesMissingAltRatio:document.images.length?[...document.images].filter(i=>!i.hasAttribute('alt')||!i.alt.trim()).length/document.images.length:0,
      imagesMissingAltSamples:[...document.images].filter(i=>!i.hasAttribute('alt')||!i.alt.trim()).slice(0,5).map(i=>(i.currentSrc||i.src||'<img>').split('?')[0]),
      navLinkCount:document.querySelectorAll('nav a[href],header a[href]').length,
      formCount:document.forms.length,
      primaryCtaCount:[...document.querySelectorAll('a,button')].filter(el=>/(book|reserve|reservar|contact|enquire|consulta|buy|comprar)/i.test(el.textContent||'')).length,
      bookingSignalCount:[...document.querySelectorAll('a')].filter(el=>/(book|reserve|reservar|disponibilidad)/i.test((el.textContent||'')+' '+el.href)).length,
      contactSignalCount:document.querySelectorAll('a[href^="tel:"],a[href^="mailto:"]').length,
      hasPrivacyLink:[...document.querySelectorAll('a')].some(a=>/(privacy|privacidad)/i.test((a.textContent||'')+' '+a.href)),
      hasLegalLink:[...document.querySelectorAll('a')].some(a=>/(legal|terms|cookies)/i.test((a.textContent||'')+' '+a.href)),
      horizontalOverflow:Math.max(document.body?.scrollWidth||0,document.documentElement.scrollWidth||0)>innerWidth+3,
      fontFamilyCount:2,colorCount:8,inconsistentButtonRatio:0,maxHeadingJump:0,documentOutlineOk:document.querySelectorAll('h1').length===1,uniqueHeadingRatio:1,trustSignalCount:0,
      internalLinks:[...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>{try{return new URL(h).origin===location.origin}catch{return false}}))].slice(0,24)
    }))()`,returnByValue:true});
    const mobileProbe=await client.send('Runtime.evaluate',{expression:MOBILE_PROBE,returnByValue:true});
    const perf=await client.send('Runtime.evaluate',{expression:METRICS_SCRIPT,returnByValue:true});
    const dom={...(result.result?.value||{}),...(mobileProbe.result?.value||{})};
    const metrics=perf.result?.value||{};
    const screenshot=await captureScreenshotSafe(client,screenshotPath);
    return {dom,metrics,navigation:{errorText:navigationError,recovered:Boolean(navigationError),finalUrl:ready.href},console:{errorCount:errors.length,errors:errors.slice(0,12)},network:{failedRequestCount:failures.length,failures:failures.slice(0,12),canceledRequestCount:canceledRequests.length,canceledRequests:canceledRequests.slice(0,12)},screenshotCaptured:screenshot.captured,screenshotError:screenshot.error};
  });
}
