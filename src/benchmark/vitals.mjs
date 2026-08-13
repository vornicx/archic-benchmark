export const VITALS_SCRIPT = `(() => {
  window.__archicVitals = { cls: 0, lcp: 0, blocking: 0, longTasks: 0 };
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__archicVitals.cls += entry.value || 0;
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
    totalBlockingMs: Math.round(vitals.blocking || 0),
    longTaskCount: vitals.longTasks || 0,
    ttfbMs: navigation ? Math.round(navigation.responseStart - navigation.requestStart) : null,
    domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
    loadMs: navigation ? Math.round(navigation.loadEventEnd || performance.now()) : null,
    transferKb: Math.round(transfer / 1024),
    resourceCount: resources.length
  };
})()`;
