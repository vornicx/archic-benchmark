import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await fs.access(candidate); return candidate; } catch {}
  }
  return null;
}

export class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP websocket timeout')), 5000);
      this.ws.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.ws.addEventListener('error', (e) => { clearTimeout(timeout); reject(e.error || new Error('CDP websocket error')); }, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
        return;
      }
      if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params || {});
      }
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(fn);
    return () => this.listeners.get(method)?.delete(fn);
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000).unref?.();
    });
  }

  close() { try { this.ws?.close(); } catch {} }
}

export async function withBrowser(fn) {
  const chrome = await findChrome();
  if (!chrome) throw new Error('Chromium/Chrome not found. Set CHROME_PATH.');

  const port = await getFreePort();
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archic-benchmark-'));
  let stderr = '';

  const child = spawn(chrome, [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', chunk => {
    stderr += chunk;
    if (stderr.length > 12000) stderr = stderr.slice(-12000);
  });

  let exited = false;
  let exitCode = null;
  child.once('exit', code => {
    exited = true;
    exitCode = code;
  });

  let client;
  try {
    let pages = null;
    for (let i = 0; i < 100; i++) {
      if (exited) {
        throw new Error(`Chromium exited before DevTools became ready (code ${exitCode}).${stderr ? `\n${stderr.trim()}` : ''}`);
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (res.ok) {
          pages = await res.json();
          if (pages?.[0]?.webSocketDebuggerUrl) break;
        }
      } catch {}
      await sleep(100);
    }

    if (!pages?.[0]?.webSocketDebuggerUrl) {
      throw new Error(`Could not connect to Chromium DevTools at 127.0.0.1:${port}.${stderr ? `\n${stderr.trim()}` : ''}`);
    }

    client = new CDPClient(pages[0].webSocketDebuggerUrl);
    await client.connect();
    return await fn(client);
  } finally {
    client?.close();
    if (!child.killed) child.kill('SIGKILL');
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}
