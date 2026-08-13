export const MOBILE_PROBE = `(() => {
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
  const all=[...document.querySelectorAll('*')].filter(visible);
  const buttons=[...document.querySelectorAll('button,[role="button"],a[href],input[type="submit"]')].filter(visible);
  const fields=[...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(visible);
  const smallTargets=buttons.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44});
  const smallText=all.filter(el=>parseFloat(getComputedStyle(el).fontSize||'16')<12);
  const unnamed=buttons.filter(el=>!((el.innerText||'').trim()||el.getAttribute('aria-label')||el.getAttribute('title')));
  const unlabelled=fields.filter(el=>!(el.closest('label')||el.getAttribute('aria-label')||el.getAttribute('placeholder')||(el.id&&document.querySelector('label[for="'+CSS.escape(el.id)+'"]'))));
  return {
    tinyTapTargetRatio:buttons.length?smallTargets.length/buttons.length:0,
    tinyTextRatio:all.length?smallText.length/all.length:0,
    unnamedButtonRatio:buttons.length?unnamed.length/buttons.length:0,
    unlabelledFormControlRatio:fields.length?unlabelled.length/fields.length:0,
    formsHaveAction:[...document.forms].every(f=>Boolean(f.action)||Boolean(f.querySelector('button[type="submit"],input[type="submit"]')))
  };
})()`;
