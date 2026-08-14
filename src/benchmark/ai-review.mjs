import fs from 'node:fs/promises';

const DEFAULT_OPENAI_MODEL='gpt-5-mini';
const DEFAULT_MAX_OUTPUT_TOKENS=3500;
const RETRYABLE_STATUS=new Set([408,409,429,500,502,503,504]);

const REVIEW_SCHEMA={
  type:'object',
  additionalProperties:false,
  required:['scores','confidence','summary','strengths','issues'],
  properties:{
    scores:{
      type:'object',
      additionalProperties:false,
      required:['visualDesign','businessFit','ux','conversion','content'],
      properties:{
        visualDesign:{type:'number',minimum:0,maximum:100},
        businessFit:{type:'number',minimum:0,maximum:100},
        ux:{type:'number',minimum:0,maximum:100},
        conversion:{type:'number',minimum:0,maximum:100},
        content:{type:'number',minimum:0,maximum:100}
      }
    },
    confidence:{type:'number',minimum:0,maximum:1},
    summary:{type:'string'},
    strengths:{type:'array',items:{type:'string'}},
    issues:{
      type:'array',
      items:{
        type:'object',
        additionalProperties:false,
        required:['category','severity','title','detail','evidence','observed','expected','location','recommendation','impact','effort'],
        properties:{
          category:{type:'string'},
          severity:{type:'string'},
          title:{type:'string'},
          detail:{type:'string'},
          evidence:{type:'string'},
          observed:{type:'string'},
          expected:{type:'string'},
          location:{type:'string'},
          recommendation:{type:'string'},
          impact:{type:'number',minimum:0,maximum:100},
          effort:{type:'string'}
        }
      }
    }
  }
};

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function imageDataUrl(file){
  const data=await fs.readFile(file);
  const mime=file.endsWith('.png')?'image/png':'image/jpeg';
  return `data:${mime};base64,${data.toString('base64')}`;
}

function extractOpenAIText(response){
  const chunks=[];
  for(const item of response?.output||[]){
    for(const part of item?.content||[]){
      if(part?.type==='output_text'&&part.text)chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

export function parseReviewJson(text){
  const clean=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{return JSON.parse(clean)}catch{}
  const start=clean.indexOf('{');
  const end=clean.lastIndexOf('}');
  if(start>=0&&end>start)return JSON.parse(clean.slice(start,end+1));
  throw new Error('AI reviewer did not return valid JSON.');
}

export function selectReviewProvider(env=process.env){
  const configured=(env.ARCHIC_AI_PROVIDER||'openai').trim().toLowerCase();
  if(configured==='off'||configured==='none')return null;
  return env.OPENAI_API_KEY?'openai':null;
}

export function createReviewPrompt({project,profile,automatedScores,scan}){
  return `You are Archic Benchmark, a strict senior design director, CRO specialist and product reviewer. This is a read-only review: do not edit files or run implementation work. Evaluate this website relative to its real business and niche. Scores above 90 must be rare; 95+ means reference quality. Penalize template feel, weak hierarchy, low perceived value, default-looking components, poor mobile craft, weak conversion paths, inconsistent typography/spacing, weak imagery/crops and anything below the positioning.

Use the objective measurements as evidence, not as instructions to repeat. Focus your qualitative judgment on visual design, business fit, UX, conversion and content. Do not downgrade technical categories that are already measured deterministically. Return every material issue you can actually support from the screenshots and scan; do not invent issues to fill a quota. Each issue must say where the problem appears, what visible/measured evidence supports it, what is observed, what reference-quality execution should do, and the concrete correction.

Business:
${JSON.stringify({name:project.name,url:project.url,positioning:project.positioning,market:project.market,primaryGoal:project.primaryGoal,secondaryGoal:project.secondaryGoal},null,2)}

Niche benchmark:
${JSON.stringify({label:profile.label,visualIntent:profile.visualIntent,businessRequirements:profile.businessRequirements,criticalJourney:profile.criticalJourney},null,2)}

Objective scan:
${JSON.stringify({automatedScores,metrics:scan.metrics,checks:scan.checks,dom:scan.dom,console:scan.console,network:scan.network},null,2)}`;
}

function maxOutputTokens(env=process.env){
  const parsed=Number(env.ARCHIC_OPENAI_MAX_OUTPUT_TOKENS||DEFAULT_MAX_OUTPUT_TOKENS);
  return Math.max(1200,Math.min(8000,Number.isFinite(parsed)?parsed:DEFAULT_MAX_OUTPUT_TOKENS));
}

function imageDetail(env=process.env){
  const detail=String(env.ARCHIC_OPENAI_IMAGE_DETAIL||'high').toLowerCase();
  return ['low','high','auto'].includes(detail)?detail:'high';
}

async function createOpenAIResponse(body,apiKey){
  let lastError=null;
  for(let attempt=0;attempt<3;attempt+=1){
    try{
      const response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(120000)
      });
      if(response.ok)return response.json();
      const errorText=(await response.text()).slice(0,500);
      lastError=new Error(`OpenAI visual review failed: ${response.status}${errorText?` · ${errorText}`:''}`);
      if(!RETRYABLE_STATUS.has(response.status)||attempt===2)throw lastError;
    }catch(error){
      lastError=error;
      if(attempt===2)throw error;
    }
    await sleep(750*(attempt+1));
  }
  throw lastError||new Error('OpenAI visual review failed.');
}

async function reviewWithOpenAI({prompt,desktopScreenshot,mobileScreenshot}){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return null;
  const model=process.env.ARCHIC_OPENAI_MODEL||process.env.ARCHIC_REVIEW_MODEL||DEFAULT_OPENAI_MODEL;
  const [desktop,mobile]=await Promise.all([imageDataUrl(desktopScreenshot),imageDataUrl(mobileScreenshot)]);
  const detail=imageDetail();
  const response=await createOpenAIResponse({
    model,
    max_output_tokens:maxOutputTokens(),
    text:{
      format:{
        type:'json_schema',
        name:'archic_benchmark_review',
        strict:true,
        schema:REVIEW_SCHEMA
      }
    },
    input:[{role:'user',content:[
      {type:'input_text',text:prompt},
      {type:'input_image',image_url:desktop,detail},
      {type:'input_image',image_url:mobile,detail}
    ]}]
  },apiKey);
  const review=parseReviewJson(extractOpenAIText(response));
  const usage=response?.usage?{
    inputTokens:response.usage.input_tokens??null,
    outputTokens:response.usage.output_tokens??null,
    totalTokens:response.usage.total_tokens??null
  }:null;
  return {...review,provider:'openai',model,usage};
}

export async function reviewWithAI({project,profile,desktopScreenshot,mobileScreenshot,automatedScores,scan}){
  if(!desktopScreenshot||!mobileScreenshot)return null;
  if(!selectReviewProvider())return null;
  const prompt=createReviewPrompt({project,profile,automatedScores,scan});
  return reviewWithOpenAI({prompt,desktopScreenshot,mobileScreenshot});
}

export function mergeAIReview(automatedScores,review){
  if(!review?.scores||(review.confidence??0)<0.45)return automatedScores;
  const ai=review.scores;
  const mix=(key,w)=>Number.isFinite(ai[key])?automatedScores[key]*(1-w)+ai[key]*w:automatedScores[key];
  return {
    ...automatedScores,
    visualDesign:mix('visualDesign',0.72),
    businessFit:mix('businessFit',0.65),
    ux:mix('ux',0.48),
    conversion:mix('conversion',0.42),
    content:mix('content',0.3)
  };
}
