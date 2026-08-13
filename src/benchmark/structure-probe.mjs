export const STRUCTURE_PROBE = `(() => {
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const all=[...document.querySelectorAll('*')].filter(visible).slice(0,500);
  const buttons=[...document.querySelectorAll('button,[role="button"],input[type="submit"],a[class*="btn" i],a[class*="button" i]')].filter(visible);
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const styles=all.map(el=>getComputedStyle(el));
  const fonts=[...new Set(styles.map(s=>s.fontFamily).filter(Boolean))];
  const colors=[...new Set(styles.flatMap(s=>[s.color,s.backgroundColor,s.borderTopColor]).filter(c=>c&&!/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)))];
  const signatures=[...new Set(buttons.map(el=>{const s=getComputedStyle(el);return [s.fontSize,s.fontWeight,s.borderRadius,s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].join('|')}))];
  const levels=headings.map(h=>Number(h.tagName[1]));let jump=0;for(let i=1;i<levels.length;i++)jump=Math.max(jump,levels[i]-levels[i-1]);
  const headingText=headings.map(h=>(h.innerText||'').trim()).filter(Boolean);
  const bodyText=document.body?.innerText||'';
  return {
    fontFamilyCount:fonts.length,
    colorCount:colors.length,
    inconsistentButtonRatio:buttons.length>2?Math.max(0,signatures.length-1)/buttons.length:0,
    maxHeadingJump:jump,
    documentOutlineOk:jump<=1&&document.querySelectorAll('h1').length===1,
    uniqueHeadingRatio:headingText.length?new Set(headingText.map(x=>x.toLowerCase())).size/headingText.length:1,
    trustSignalCount:/(reviews?|reseñas?|testimonials?|clientes?|years?|años|rating|valoración|verified|certified|award|premio|guarantee|garantía)/i.test(bodyText)?1:0
  };
})()`;
