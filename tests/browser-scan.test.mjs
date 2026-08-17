import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { withBrowser } from '../src/benchmark/cdp.mjs';
import { scanViewport } from '../src/benchmark/browser-scan.mjs';

test('Chromium CDP boots and evaluates a document', { timeout: 30000 }, async () => {
  const value = await withBrowser(async client => {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    const tree = await client.send('Page.getFrameTree');
    await client.send('Page.setDocumentContent', {
      frameId: tree.frameTree.frame.id,
      html: '<!doctype html><title>Archic</title><h1>Benchmark</h1>'
    });
    const result = await client.send('Runtime.evaluate', {
      expression: 'document.querySelector("h1").textContent',
      returnByValue: true
    });
    return result.result.value;
  });
  assert.equal(value, 'Benchmark');
});

test('scanViewport keeps DOM signals and screenshots stable on extremely tall HTTP pages', { timeout: 30000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'archic-scan-test-'));
  const screenshotPath = path.join(dir, 'tall.jpg');
  const html = '<!doctype html><html lang="es"><head><title>La Bocana test</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;height:50000px"><h1>Benchmark</h1><a href="/reservar">Reservar mesa</a></body></html>';
  const server = http.createServer((req,res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve,reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  try {
    const scan = await scanViewport(`http://127.0.0.1:${address.port}/`, { width: 390, height: 844, mobile: true, screenshotPath });
    assert.equal(scan.dom.titleLength, 'La Bocana test'.length);
    assert.equal(scan.dom.viewportMeta, true);
    assert.equal(scan.dom.h1Count, 1);
    assert.ok(scan.dom.primaryCtaCount >= 1);
    assert.equal(scan.screenshotCaptured, true);
    const stat = await fs.stat(screenshotPath);
    assert.ok(stat.size > 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('scanViewport treats a visible same-origin contact journey as a contact signal', { timeout: 30000 }, async () => {
  const html = '<!doctype html><html lang="es"><head><title>Contact path</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Proyecto</h1><a href="/contacto.html">Solicitar presupuesto</a></body></html>';
  const server = http.createServer((req,res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve,reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  try {
    const scan = await scanViewport(`http://127.0.0.1:${address.port}/`, { width: 390, height: 844, mobile: true });
    assert.equal(scan.dom.contactSignalCount, 1);
    assert.equal(scan.dom.contactSignalSamples[0].text, 'Solicitar presupuesto');
    assert.match(scan.dom.contactSignalSamples[0].href, /\/contacto\.html$/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
