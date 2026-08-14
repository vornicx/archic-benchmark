import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAIReview, parseReviewJson, selectReviewProvider } from '../src/benchmark/ai-review.mjs';

test('OpenAI review is enabled when an API key exists',()=>{
  assert.equal(selectReviewProvider({OPENAI_API_KEY:'openai'}),'openai');
});

test('AI review is disabled without an OpenAI API key',()=>{
  assert.equal(selectReviewProvider({}),null);
});

test('AI review can be disabled explicitly',()=>{
  assert.equal(selectReviewProvider({ARCHIC_AI_PROVIDER:'off',OPENAI_API_KEY:'openai'}),null);
});

test('legacy provider settings migrate safely to OpenAI when configured',()=>{
  assert.equal(selectReviewProvider({ARCHIC_AI_PROVIDER:'cursor',OPENAI_API_KEY:'openai'}),'openai');
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
