import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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

test('scanViewport keeps DOM signals and safely caps tall screenshots', { timeout: 30000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'archic-scan-test-'));
  const screenshotPath = path.join(dir, 'tall.jpg');
  const html = '<!doctype html><html lang="es"><head><title>La Bocana test</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;height:50000px"><h1>Benchmark</h1><a href="/reservar">Reservar mesa</a></body></html>';
  try {
    const scan = await scanViewport(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, { width: 390, height: 844, mobile: true, screenshotPath });
    assert.equal(scan.dom.titleLength, 'La Bocana test'.length);
    assert.equal(scan.dom.viewportMeta, true);
    assert.equal(scan.dom.h1Count, 1);
    assert.ok(scan.dom.primaryCtaCount >= 1);
    assert.equal(scan.screenshotCaptured, true);
    const stat = await fs.stat(screenshotPath);
    assert.ok(stat.size > 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
