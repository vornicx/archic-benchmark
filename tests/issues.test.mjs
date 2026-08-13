import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDetailedIssues } from '../src/benchmark/issue-details.mjs';

test('issues include evidence and a concrete recommendation',()=>{
  const issues=deriveDetailedIssues({
    url:'https://example.com',
    metrics:{lcpMs:5100,mobileLcpMs:6200,cls:0.18,ttfbMs:1100},
    dom:{titleLength:0,metaDescriptionLength:0,h1Count:0,jsonLdCount:0,imagesMissingAltRatio:0.5,unlabelledFormControlRatio:0.2,unnamedButtonRatio:0.1,tinyTapTargetRatio:0.4,tinyTextRatio:0.1,primaryCtaCount:0,contactSignalCount:0,formCount:0,bookingSignalCount:0},
    headers:{hsts:false,csp:false},
    checks:{httpOk:true,status:200,viewportMeta:true,horizontalOverflow:true,robots:false,sitemap:false,formsHaveAction:true},
    console:{errorCount:1,errors:['ReferenceError: x is not defined']},
    network:{failedRequestCount:1,failures:['/missing.jpg — net::ERR_FAILED']}
  });
  assert.ok(issues.length>10);
  assert.ok(issues.every(i=>i.detail&&i.evidence&&i.recommendation));
  assert.ok(issues.some(i=>i.id==='console-errors'&&i.evidence.includes('ReferenceError')));
  assert.ok(issues.some(i=>i.id==='mobile-overflow'));
});
