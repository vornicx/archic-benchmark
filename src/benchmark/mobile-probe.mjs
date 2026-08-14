export const MOBILE_PROBE = `(() => {
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'};
  const describe=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName.toLowerCase(),id:el.id||null,className:typeof el.className==='string'?el.className.slice(0,120):null,text:(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,90),width:Number(r.width.toFixed(1)),height:Number(r.height.toFixed(1)),fontSize:Number((parseFloat(s.fontSize||'0')).toFixed(1))}};
  const all=[...document.querySelectorAll('*')].filter(visible);
  const buttons=[...document.querySelectorAll('button,[role="button"],a[href],input[type="submit"]')].filter(visible);
  const fields=[...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(visible);
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const styles=all.slice(0,500).map(el=>getComputedStyle(el));
  const smallTargets=buttons.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44});
  const smallText=all.filter(el=>parseFloat(getComputedStyle(el).fontSize||'16')<12);
  const unnamed=buttons.filter(el=>!((el.innerText||'').trim()||el.getAttribute('aria-label')||el.getAttribute('title')));
  const unlabelled=fields.filter(el=>!(el.closest('label')||el.getAttribute('aria-label')||el.getAttribute('placeholder')||(el.id&&document.querySelector('label[for="'+CSS.escape(el.id)+'"]'))));
  const fonts=[...new Set(styles.map(s=>s.fontFamily).filter(Boolean))];
  const colors=[...new Set(styles.flatMap(s=>[s.color,s.backgroundColor]).filter(Boolean))];
  const signatures=[...new Set(buttons.map(el=>{const s=getComputedStyle(el);return [s.fontSize,s.fontWeight,s.borderRadius,s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].join('|')}))];
  const levels=headings.map(h=>Number(h.tagName[1]));let jump=0;for(let i=1;i<levels.length;i++)jump=Math.max(jump,levels[i]-levels[i-1]);
  const headingText=headings.map(h=>(h.innerText||'').trim()).filter(Boolean);
  return {
    tinyTapTargetRatio:buttons.length?smallTargets.length/buttons.length:0,
    tinyTapTargetCount:smallTargets.length,
    interactiveTargetCount:buttons.length,
    tinyTapTargetSamples:smallTargets.slice(0,12).map(describe),
    tinyTextRatio:all.length?smallText.length/all.length:0,
    tinyTextCount:smallText.length,
    visibleElementCount:all.length,
    tinyTextSamples:smallText.slice(0,16).map(describe),
    unnamedButtonRatio:buttons.length?unnamed.length/buttons.length:0,
    unlabelledFormControlRatio:fields.length?unlabelled.length/fields.length:0,
    formsHaveAction:[...document.forms].every(f=>Boolean(f.action)||Boolean(f.querySelector('button[type="submit"],input[type="submit"]'))),
    fontFamilyCount:fonts.length,
    colorCount:colors.length,
    inconsistentButtonRatio:buttons.length>2?Math.max(0,signatures.length-1)/buttons.length:0,
    maxHeadingJump:jump,
    documentOutlineOk:jump<=1&&document.querySelectorAll('h1').length===1,
    uniqueHeadingRatio:headingText.length?new Set(headingText.map(x=>x.toLowerCase())).size/headingText.length:1,
    trustSignalCount:/(reviews?|reseñas?|testimonials?|clientes?|verified|certified|award|premio)/i.test(document.body?.innerText||'')?1:0
  };
})()`;
