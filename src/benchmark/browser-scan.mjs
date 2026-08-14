import fs from 'node:fs/promises';
import path from 'node:path';
import { withBrowser } from './cdp.mjs';
import { VITALS_SCRIPT, METRICS_SCRIPT } from './vitals.mjs';
import { MOBILE_PROBE } from './mobile-probe.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function waitForPageLoad(client, timeoutMs = 10000) {
  return new Promise(resolve => {
    let settled = false;
    let off = null;
    const finish = reason => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      off?.();
      resolve(reason);
    };
    off = client.on('Page.loadEventFired', () => finish('load'));
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    timer.unref?.();
  });
}

async function captureScreenshotSafe(client, screenshotPath, { width, height }) {
  if (!screenshotPath) return { captured: false, error: null };
  let firstError = null;
  try {
    const layout = await client.send('Page.getLayoutMetrics');
    const content = layout.cssContentSize || layout.contentSize || {};
    const clipWidth = Math.max(1, Math.min(Math.ceil(content.width || width), width));
    const clipHeight = Math.max(1, Math.min(Math.ceil(content.height || height), 12000));
    const shot = await client.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 72,
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: clipWidth, height: clipHeight, scale: 1 }
    });
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
    return { captured: true, error: null };
  } catch (error) {
    firstError = error;
  }

  try {
    const shot = await client.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 72,
      fromSurface: true,
      captureBeyondViewport: false
    });
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
    return { captured: true, error: `Full-page capture failed; viewport fallback used: ${firstError?.message || firstError}` };
  } catch (fallbackError) {
    return {
      captured: false,
      error: `Screenshot failed: ${firstError?.message || firstError}; fallback failed: ${fallbackError?.message || fallbackError}`
    };
  }
}

export async function scanViewport(url,{width,height,mobile=false,screenshotPath=null}){
  return withBrowser(async client=>{
    const errors=[];
    const failures=[];
    const requests=new Map();
    client.on('Runtime.exceptionThrown',p=>errors.push(p?.exceptionDetails?.exception?.description||p?.exceptionDetails?.text||'Runtime exception'));
    client.on('Network.requestWillBeSent',p=>{if(p?.requestId&&p?.request?.url)requests.set(p.requestId,p.request.url)});
    client.on('Network.loadingFailed',p=>failures.push(`${requests.get(p.requestId)||p.requestId||'request'} — ${p.errorText||'Network failure'}`));
    await Promise.all([client.send('Page.enable'),client.send('Runtime.enable'),client.send('Network.enable'),client.send('Performance.enable')]);
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:mobile?2:1,mobile,screenWidth:width,screenHeight:height});
    await client.send('Page.addScriptToEvaluateOnNewDocument',{source:VITALS_SCRIPT});
    const loaded=waitForPageLoad(client);
    await client.send('Page.navigate',{url});
    await loaded;
    await wait(700);
    const result=await client.send('Runtime.evaluate',{expression:`(() => ({
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
    const screenshot=await captureScreenshotSafe(client,screenshotPath,{width,height});
    return {dom,metrics,console:{errorCount:errors.length,errors:errors.slice(0,12)},network:{failedRequestCount:failures.length,failures:failures.slice(0,12)},screenshotCaptured:screenshot.captured,screenshotError:screenshot.error};
  });
}
