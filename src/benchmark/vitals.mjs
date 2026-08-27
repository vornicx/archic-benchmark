export const VITALS_SCRIPT = `(() => {
  const describeNode = node => {
    if (!node || node.nodeType !== 1) return null;
    const tag = (node.tagName || '').toLowerCase();
    const id = node.id ? '#' + node.id : '';
    const classes = [...(node.classList || [])].slice(0, 3).map(name => '.' + name).join('');
    return (tag + id + classes).slice(0, 140) || null;
  };
  const rect = value => value ? {
    x: Math.round(value.x || 0),
    y: Math.round(value.y || 0),
    width: Math.round(value.width || 0),
    height: Math.round(value.height || 0)
  } : null;

  window.__archicVitals = { cls: 0, lcp: 0, blocking: 0, longTasks: 0, clsSources: [] };
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        const value = entry.value || 0;
        window.__archicVitals.cls += value;
        const sources = [...(entry.sources || [])].slice(0, 5).map(source => ({
          node: describeNode(source.node),
          previousRect: rect(source.previousRect),
          currentRect: rect(source.currentRect)
        })).filter(source => source.node);
        if (value > 0 && sources.length) {
          window.__archicVitals.clsSources.push({
            value: Number(value.toFixed(4)),
            startTime: Math.round(entry.startTime || 0),
            sources
          });
          window.__archicVitals.clsSources.sort((a, b) => b.value - a.value);
          window.__archicVitals.clsSources = window.__archicVitals.clsSources.slice(0, 12);
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__archicVitals.lcp = last.startTime || last.renderTime || last.loadTime || 0;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__archicVitals.blocking += Math.max(0, (entry.duration || 0) - 50);
        window.__archicVitals.longTasks += 1;
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
})();`;

export const METRICS_SCRIPT = `(() => {
  const navigation = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');
  const transfer = resources.reduce((sum, item) => sum + (item.transferSize || 0), 0) + (navigation?.transferSize || 0);
  const vitals = window.__archicVitals || {};
  return {
    lcpMs: Math.round(vitals.lcp || 0),
    cls: Number((vitals.cls || 0).toFixed(4)),
    clsSources: Array.isArray(vitals.clsSources) ? vitals.clsSources : [],
    totalBlockingMs: Math.round(vitals.blocking || 0),
    longTaskCount: vitals.longTasks || 0,
    ttfbMs: navigation ? Math.round(navigation.responseStart - navigation.requestStart) : null,
    domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
    loadMs: navigation ? Math.round(navigation.loadEventEnd || performance.now()) : null,
    transferKb: Math.round(transfer / 1024),
    resourceCount: resources.length
  };
})()`;
