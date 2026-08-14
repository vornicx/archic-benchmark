import fs from 'node:fs/promises';

const DEFAULT_CURSOR_MODEL='composer-2.5';

async function imagePayload(file){
  const data=await fs.readFile(file);
  const mime=file.endsWith('.png')?'image/png':'image/jpeg';
  return {data:data.toString('base64'),mimeType:mime};
}

async function imageDataUrl(file){
  const {data,mimeType}=await imagePayload(file);
  return `data:${mimeType};base64,${data}`;
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
  const configured=(env.ARCHIC_AI_PROVIDER||'auto').trim().toLowerCase();
  if(configured==='off'||configured==='none')return null;
  if(configured==='cursor')return env.CURSOR_API_KEY?'cursor':null;
  if(configured==='openai')return env.OPENAI_API_KEY&&(env.ARCHIC_OPENAI_MODEL||env.ARCHIC_REVIEW_MODEL)?'openai':null;
  if(env.CURSOR_API_KEY)return 'cursor';
  if(env.OPENAI_API_KEY&&(env.ARCHIC_OPENAI_MODEL||env.ARCHIC_REVIEW_MODEL))return 'openai';
  return null;
}

export function createReviewPrompt({project,profile,automatedScores,scan}){
  return `You are Archic Benchmark, a strict senior design director, CRO specialist and product reviewer. This is a read-only review: do not edit files or run implementation work. Evaluate this website relative to its real business and niche. Scores above 90 must be rare; 95+ means reference quality. Penalize template feel, weak hierarchy, low perceived value, default-looking components, poor mobile craft, weak conversion paths, inconsistent typography/spacing, weak imagery/crops and anything below the positioning.

For issues, be diagnostic rather than vague. Return every material issue you can actually support from the screenshots and scan; do not invent issues to fill a quota. Each issue must say where the problem appears, what visible/measured evidence supports it, what is observed, what good looks like, and the concrete correction. Prefer specific statements such as “mobile hero CTA is visually lost below the image at 390px” over “improve CTA”.

Business:
${JSON.stringify({name:project.name,url:project.url,positioning:project.positioning,market:project.market,primaryGoal:project.primaryGoal,secondaryGoal:project.secondaryGoal},null,2)}

Niche benchmark:
${JSON.stringify({label:profile.label,visualIntent:profile.visualIntent,businessRequirements:profile.businessRequirements,criticalJourney:profile.criticalJourney},null,2)}

Objective scan:
${JSON.stringify({automatedScores,metrics:scan.metrics,checks:scan.checks,dom:scan.dom,console:scan.console,network:scan.network},null,2)}

Return only valid JSON: {"scores":{"visualDesign":0,"businessFit":0,"ux":0,"conversion":0,"content":0},"confidence":0,"summary":"","strengths":[],"issues":[{"category":"visualDesign","severity":"medium","title":"Specific problem","detail":"Why this is a problem in this business context","evidence":"What in the screenshot or scan proves it","observed":"What is currently happening","expected":"What reference-quality execution should do","location":"Desktop/mobile and the section or component","recommendation":"Concrete correction to implement","impact":0,"effort":"s"}]}`;
}

async function reviewWithCursor({prompt,desktopScreenshot,mobileScreenshot,rootDir}){
  const apiKey=process.env.CURSOR_API_KEY;
  if(!apiKey)return null;
  const model=process.env.ARCHIC_CURSOR_MODEL||DEFAULT_CURSOR_MODEL;
  const {Agent}=await import('@cursor/sdk');
  const agent=await Agent.create({
    apiKey,
    model:{id:model},
    local:{cwd:rootDir||process.cwd()}
  });
  try{
    const [desktop,mobile]=await Promise.all([imagePayload(desktopScreenshot),imagePayload(mobileScreenshot)]);
    const run=await agent.send({text:prompt,images:[desktop,mobile]});
    const result=await run.wait();
    if(result?.status&&result.status!=='finished')throw new Error(`Cursor review ended with status ${result.status}`);
    const review=parseReviewJson(result?.result||result?.text||'');
    return {...review,provider:'cursor',model};
  }finally{
    if(agent?.[Symbol.asyncDispose])await agent[Symbol.asyncDispose]();
  }
}

async function reviewWithOpenAI({prompt,desktopScreenshot,mobileScreenshot}){
  const apiKey=process.env.OPENAI_API_KEY;
  const model=process.env.ARCHIC_OPENAI_MODEL||process.env.ARCHIC_REVIEW_MODEL;
  if(!apiKey||!model)return null;
  const [desktop,mobile]=await Promise.all([imageDataUrl(desktopScreenshot),imageDataUrl(mobileScreenshot)]);
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
    body:JSON.stringify({
      model,
      input:[{role:'user',content:[
        {type:'input_text',text:prompt},
        {type:'input_image',image_url:desktop,detail:'high'},
        {type:'input_image',image_url:mobile,detail:'high'}
      ]}]
    })
  });
  if(!response.ok)throw new Error(`OpenAI visual review failed: ${response.status}`);
  const review=parseReviewJson(extractOpenAIText(await response.json()));
  return {...review,provider:'openai',model};
}

export async function reviewWithAI({project,profile,desktopScreenshot,mobileScreenshot,automatedScores,scan,rootDir}){
  if(!desktopScreenshot||!mobileScreenshot)return null;
  const provider=selectReviewProvider();
  if(!provider)return null;
  const prompt=createReviewPrompt({project,profile,automatedScores,scan});

  if(provider==='cursor'){
    try{
      return await reviewWithCursor({prompt,desktopScreenshot,mobileScreenshot,rootDir});
    }catch(error){
      const canFallback=(process.env.ARCHIC_AI_PROVIDER||'auto').toLowerCase()==='auto'
        &&process.env.OPENAI_API_KEY
        &&(process.env.ARCHIC_OPENAI_MODEL||process.env.ARCHIC_REVIEW_MODEL);
      if(!canFallback)throw error;
      const fallback=await reviewWithOpenAI({prompt,desktopScreenshot,mobileScreenshot});
      return {...fallback,fallbackFrom:'cursor',fallbackReason:error.message};
    }
  }

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
