import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAIReview, parseReviewJson, selectReviewProvider } from '../src/benchmark/ai-review.mjs';

test('Cursor is preferred in auto mode when configured',()=>{
  assert.equal(selectReviewProvider({ARCHIC_AI_PROVIDER:'auto',CURSOR_API_KEY:'cursor'}),'cursor');
});

test('OpenAI is the fallback provider in auto mode',()=>{
  assert.equal(selectReviewProvider({ARCHIC_AI_PROVIDER:'auto',OPENAI_API_KEY:'openai',ARCHIC_OPENAI_MODEL:'model'}),'openai');
});

test('AI review can be disabled explicitly',()=>{
  assert.equal(selectReviewProvider({ARCHIC_AI_PROVIDER:'off',CURSOR_API_KEY:'cursor'}),null);
});

test('review JSON parser tolerates fenced output',()=>{
  assert.deepEqual(parseReviewJson('```json\n{"confidence":0.8}\n```'),{confidence:0.8});
});

test('low-confidence review never changes deterministic scores',()=>{
  const base={visualDesign:80,businessFit:80,ux:80,conversion:80,content:80,performance:70};
  assert.deepEqual(mergeAIReview(base,{confidence:0.2,scores:{visualDesign:10}}),base);
});

test('high-confidence review only blends qualitative categories',()=>{
  const base={visualDesign:80,businessFit:80,ux:80,conversion:80,content:80,performance:70};
  const mixed=mergeAIReview(base,{confidence:0.9,scores:{visualDesign:100,businessFit:100,ux:100,conversion:100,content:100}});
  assert.equal(mixed.performance,70);
  assert.ok(mixed.visualDesign>80&&mixed.visualDesign<100);
  assert.ok(mixed.businessFit>80&&mixed.businessFit<100);
});
