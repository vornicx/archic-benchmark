import { issueDetailText } from './issue-format.js';

const categoryLabels = {
  businessFit:'Business fit', visualDesign:'Visual', ux:'UX', conversion:'Conversion', mobile:'Mobile', performance:'Performance', seoGeo:'SEO + GEO', content:'Content', accessibility:'A11y', securityTrust:'Trust', robustness:'Robustness'
};
let report = null, benchmarks = null, filter = 'all';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const delta = n => n == null ? '' : `<span class="delta ${n>=0?'up':'down'}">${n>=0?'↑':'↓'} ${Math.abs(n).toFixed(1)}</span>`;
const scoreClass = n => n>=90?'excellent':n>=80?'good':n>=70?'watch':'bad';
const categoryShort = k => categoryLabels[k] || k;
const fmtDate = iso => new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));

async function load() {
  const [latest, profiles] = await Promise.all([fetch('/api/latest.json',{cache:'no-store'}).then(r=>r.json()), fetch('/api/benchmarks.json',{cache:'no-store'}).then(r=>r.json())]);
  report = latest; benchmarks = profiles;
  render();
}

function render() {
  const mode = $('#modePill'); mode.textContent = report.mode === 'demo' ? 'Demo dataset' : 'Live benchmark'; mode.className = `mode-pill ${report.mode}`;
  $('#generatedText').textContent = report.mode === 'demo' ? 'Preview data is loaded. Run the benchmark to replace it with measured project data.' : `Generated ${fmtDate(report.generatedAt)}. Ranked by business impact, not cosmetic preference.`;
  renderHero(); renderKpis(); renderPriorities(); renderRanking(); renderHeatmap(); renderProjects(); renderQueue(); renderProfiles();
}

function renderHero(){
  const p=report.portfolio; const gated=p.activeGates||0;
  $('#heroStatus').innerHTML=`<strong>${gated ? `${gated} active gate${gated===1?'':'s'}` : 'No critical gates'}</strong><span>${gated?'Resolve gates before polishing lower-impact areas.':'Portfolio is clear for quality optimization.'}</span>`;
}
function renderKpis(){
  const p=report.portfolio; const queue=report.dailyQueue||[]; const critical=queue.filter(x=>x.severity==='critical').length;
  $('#kpiGrid').innerHTML=`
    <article class="kpi primary"><span class="kpi-label">Portfolio quality</span><div class="kpi-value">${p.score ?? '—'}<small>/100</small>${delta(p.delta)}</div><div class="kpi-sub">${p.projectsScored} projects measured</div></article>
    <article class="kpi"><span class="kpi-label">Priority actions</span><div class="kpi-value">${queue.length}</div><div class="kpi-sub">Highest-ROI work today</div></article>
    <article class="kpi"><span class="kpi-label">Quality gates</span><div class="kpi-value">${p.activeGates||0}</div><div class="kpi-sub">${p.activeGates?'Blocking higher scores':'No hard blockers'}</div></article>
    <article class="kpi"><span class="kpi-label">Critical</span><div class="kpi-value">${critical}</div><div class="kpi-sub">Commercial or functional risk</div></article>`;
}
function renderPriorities(){
  const q=(report.dailyQueue||[]).slice(0,5); $('#queueCount').textContent=`${q.length} item${q.length===1?'':'s'}`;
  $('#priorityList').innerHTML=q.length?q.map((x,i)=>`<article class="priority-item" data-project="${esc(x.projectId)}"><span class="priority-rank">0${i+1}</span><div><div class="priority-title">${esc(x.title)}</div><div class="priority-meta"><i class="severity-dot ${esc(x.severity)}"></i>${esc(x.projectName)} · ${esc(categoryShort(x.category))} · ${esc((x.effort||'m').toUpperCase())}</div></div><div class="priority-score"><strong>${x.priority}</strong><span>priority</span></div></article>`).join(''):'<div class="empty">No priorities detected.</div>';
  $$('#priorityList [data-project]').forEach(el=>el.onclick=()=>openProject(el.dataset.project));
}
function renderRanking(){
  const rows=[...(report.projects||[])].filter(p=>Number.isFinite(p.score)).sort((a,b)=>b.score-a.score);
  $('#rankingList').innerHTML=rows.map(p=>`<article class="ranking-item" data-project="${esc(p.id)}"><div><div class="ranking-name">${esc(p.name)}</div><div class="ranking-profile">${esc(p.profileLabel||p.profile)}</div><div class="score-line"><i style="width:${p.score}%"></i></div></div><div class="ranking-score">${p.score}<small>/100</small>${delta(p.delta)}</div></article>`).join('') || '<div class="empty">No scored projects.</div>';
  $$('#rankingList [data-project]').forEach(el=>el.onclick=()=>openProject(el.dataset.project));
}
function renderHeatmap(){
  const projects=(report.projects||[]).filter(p=>Number.isFinite(p.score)); const cats=Object.keys(categoryLabels);
  $('#heatmap').innerHTML=`<table class="heatmap"><thead><tr><th>Project</th>${cats.map(c=>`<th>${esc(categoryShort(c))}</th>`).join('')}</tr></thead><tbody>${projects.map(p=>`<tr><td>${esc(p.name)}</td>${cats.map(c=>{const n=p.categoryScores?.[c];return `<td>${n==null?'—':`<span class="heat ${scoreClass(n)}">${Math.round(n)}</span>`}</td>`}).join('')}</tr>`).join('')}</tbody></table>`;
}
function renderProjects(){
  const projects=(report.projects||[]).filter(p=>filter==='all'||(filter==='attention'&&Number.isFinite(p.score)&&p.score<90)||(filter==='gated'&&p.gates?.length));
  $('#projectGrid').innerHTML=projects.map(p=>{
    if(!Number.isFinite(p.score)) return `<article class="project-card disabled"><div class="project-card-top"><div><div class="project-name">${esc(p.name)}</div><div class="project-profile">${esc(p.profileLabel||p.profile||'')}</div></div><div class="project-score">—</div></div><span class="tier">Not configured</span><div class="project-priority"><span>NEXT STEP</span><p>Add the live URL and enable this project.</p></div></article>`;
    const cats=Object.values(p.categoryScores||{}).slice(0,4);
    return `<article class="project-card" data-project="${esc(p.id)}"><div class="project-card-top"><div><div class="project-name">${esc(p.name)}</div><div class="project-profile">${esc(p.profileLabel||p.profile)}</div></div><div class="project-score">${p.score}<small>/100</small>${delta(p.delta)}</div></div><span class="tier ${p.tier.toLowerCase().replace(/\s+/g,'-')}">${esc(p.tier)}</span><div class="mini-categories">${cats.map(n=>`<span class="mini-cat"><i style="width:${n}%"></i></span>`).join('')}</div><div class="project-priority"><span>TOP PRIORITY</span><p>${esc(p.topPriority?.title||p.issues?.[0]?.title||'No material issue detected')}</p></div></article>`;
  }).join('') || '<div class="empty">No projects match this filter.</div>';
  $$('#projectGrid [data-project]').forEach(el=>el.onclick=()=>openProject(el.dataset.project));
}
function renderQueue(){
  const q=report.dailyQueue||[];
  $('#queueTable').innerHTML=`<div class="queue-row header"><div>#</div><div>Project</div><div>Action</div><div>Area</div><div>Severity</div><div>Priority</div></div>${q.map((x,i)=>`<div class="queue-row"><div class="q-rank">0${i+1}</div><div>${esc(x.projectName)}</div><div><div class="q-title">${esc(x.title)}</div><div class="q-detail">${esc(x.detail)}</div></div><div>${esc(categoryShort(x.category))}</div><div><span class="priority-pill ${esc(x.severity)}">${esc(x.severity)}</span></div><div>${x.priority}</div></div>`).join('')}`;
}
function renderProfiles(){
  const profiles=benchmarks?.profiles||{};
  $('#profileList').innerHTML=Object.entries(profiles).map(([id,p])=>`<div class="profile-row"><div><div class="profile-name">${esc(p.label)}</div><div class="profile-intent">${esc(p.visualIntent.join(' · '))}</div></div><div class="weight-bars" title="${esc(Object.entries(p.weights).map(([k,v])=>`${categoryShort(k)} ${v}%`).join(' · '))}">${Object.entries(p.weights).map(([k,v])=>`<i style="width:${v}%" aria-label="${esc(categoryShort(k))} ${v}%"></i>`).join('')}</div></div>`).join('');
}
function openProject(id){
  const p=report.projects.find(x=>x.id===id); if(!p||!Number.isFinite(p.score)) return;
  const metrics=p.metrics||{}; const cats=Object.entries(p.categoryScores||{}); const issues=p.issues||[];
  $('#projectDetail').innerHTML=`
    <div class="detail-head"><div><p class="eyebrow">${esc(p.profileLabel||p.profile)}</p><h2>${esc(p.name)}</h2><p>${esc(p.positioning||'')} ${p.market?`· ${esc(p.market)}`:''} ${p.primaryGoal?`· Goal: ${esc(p.primaryGoal)}`:''}</p></div><div class="detail-big-score">${p.score}<small>${esc(p.tier)} · raw ${p.rawScore ?? p.score}${p.cap<100?` · cap ${p.cap}`:''}${p.percentile!=null?` · ${p.percentile}th percentile`:''}</small></div></div>
    <div class="detail-grid">
      <section class="detail-panel"><div class="detail-title">Category score</div><div class="category-list">${cats.map(([k,n])=>`<div class="category-row"><span>${esc(categoryShort(k))}</span><div class="cat-track"><i style="width:${n}%"></i></div><strong>${Math.round(n)}</strong></div>`).join('')}</div></section>
      <section class="detail-panel"><div class="detail-title">Detected issues · ${issues.length}</div><div class="issue-stack">${issues.length?issues.map(i=>`<div class="detail-issue"><strong><i class="severity-dot ${esc(i.severity)}"></i> ${esc(i.title)}</strong><p style="white-space:pre-line">${esc(issueDetailText(i))}</p></div>`).join(''):'<div class="empty">No issues detected in the latest scan.</div>'}</div></section>
      <section class="detail-panel"><div class="detail-title">Measured performance</div><div class="metrics-row"><div class="metric-box"><span>Desktop LCP</span><strong>${metricMs(metrics.lcpMs)}</strong></div><div class="metric-box"><span>Mobile LCP</span><strong>${metricMs(metrics.mobileLcpMs)}</strong></div><div class="metric-box"><span>CLS</span><strong>${metrics.cls??'—'}</strong></div><div class="metric-box"><span>Transfer</span><strong>${metrics.transferKb?`${metrics.transferKb} KB`:'—'}</strong></div></div></section>
      <section class="detail-panel"><div class="detail-title">Visual capture</div>${p.screenshots?`<div class="screens"><div class="screen"><img src="${esc(p.screenshots.desktop)}?v=${Date.now()}" alt="Desktop benchmark capture"></div><div class="screen mobile"><img src="${esc(p.screenshots.mobile)}?v=${Date.now()}" alt="Mobile benchmark capture"></div></div>`:'<div class="empty">Screenshots appear after a live benchmark run.</div>'}</section>
    </div>`;
  $('#projectDialog').showModal();
}
const metricMs=n=>Number.isFinite(n)?(n>=1000?`${(n/1000).toFixed(1)}s`:`${n}ms`):'—';

function route(){
  const view=location.hash.replace('#','')||'overview'; const valid=['overview','projects','queue','standards'].includes(view)?view:'overview';
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${valid}`)); $$('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.view===valid));
  $('#viewLabel').textContent={overview:'Command center',projects:'Projects',queue:'Daily queue',standards:'Standards'}[valid]; window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route); route();
$$('[data-jump]').forEach(b=>b.onclick=()=>location.hash=b.dataset.jump);
$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;renderProjects()});
$('#dialogClose').onclick=()=>$('#projectDialog').close(); $('#projectDialog').addEventListener('click',e=>{if(e.target===$('#projectDialog'))$('#projectDialog').close()});
$('#refreshButton').onclick=async()=>{ $('#refreshButton').textContent='…'; try{await load()}finally{$('#refreshButton').textContent='↻'} };
load().catch(err=>{console.error(err);$('#generatedText').textContent='Could not load benchmark data. Run npm run benchmark:demo first.'});
