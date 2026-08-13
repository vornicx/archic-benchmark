import fs from 'node:fs/promises';
import path from 'node:path';

export async function readJson(file, fallback=null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

export function madridDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const get = type => parts.find(x => x.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function getPreviousProject(rootDir, projectId) {
  const latest = await readJson(path.join(rootDir, 'data', 'latest.json'), null);
  return latest?.projects?.find(p => p.id === projectId) || null;
}

export async function appendHistory(rootDir, report) {
  const file = path.join(rootDir, 'data', 'history', `${report.date}.json`);
  await writeJson(file, report);

  const indexFile = path.join(rootDir, 'data', 'history-index.json');
  const index = await readJson(indexFile, { dates: [] });
  const dates = [report.date, ...(index.dates || []).filter(d => d !== report.date)].slice(0, 180);
  await writeJson(indexFile, { dates });

  const files = await fs.readdir(path.join(rootDir, 'data', 'history')).catch(() => []);
  for (const name of files.filter(n => n.endsWith('.json'))) {
    const date = name.replace('.json','');
    if (!dates.includes(date)) await fs.rm(path.join(rootDir, 'data', 'history', name), { force: true });
  }
}
