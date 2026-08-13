import test from 'node:test';
import assert from 'node:assert/strict';
import { withBrowser } from '../src/benchmark/cdp.mjs';

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
