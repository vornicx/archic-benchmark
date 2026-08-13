import fs from 'node:fs/promises';

async function imageDataUrl(file){const data=await fs.readFile(file);const mime=file.endsWith('.png')?'image/png':'image/jpeg';return `data:${mime};base64,${data.toString('base64')}`;}
function extractText(response){const chunks=[];for(const item of response?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part.text)chunks.push(part.text);return chunks.join('\n').trim();}
function parseJson(text){const clean=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();try{return JSON.parse(clean)}catch{}const start=clean.indexOf('{'),end=clean.lastIndexOf('}');if(start>=0&&end>start)return JSON.parse(clean.slice(start,end+1));throw new Error('AI reviewer did not return valid JSON.');}

export async function reviewWithAI({project,profile,desktopScreenshot,mobileScreenshot,automatedScores,scan}){
  const apiKey=process.env.OPENAI_API_KEY;const model=process.env.ARCHIC_REVIEW_MODEL;if(!apiKey||!model||!desktopScreenshot||!mobileScreenshot)return null;
  const [desktop,mobile]=await Promise.all([imageDataUrl(desktopScreenshot),imageDataUrl(mobileScreenshot)]);
  const prompt=`You are Archic Benchmark, a strict senior design director, CRO specialist and product reviewer. Evaluate this website relative to its business. Scores above 90 must be rare; 95+ means reference quality for the niche. Penalize template feel, weak hierarchy, low perceived value, default-looking components, poor mobile craft, weak conversion paths, inconsistent typography/spacing, and anything below the positioning.\n\nBusiness:\n${JSON.stringify({name:project.name,url:project.url,positioning:project.positioning,market:project.market,primaryGoal:project.primaryGoal,secondaryGoal:project.secondaryGoal},null,2)}\n\nNiche benchmark:\n${JSON.stringify({label:profile.label,visualIntent:profile.visualIntent,businessRequirements:profile.businessRequirements,criticalJourney:profile.criticalJourney},null,2)}\n\nObjective scan:\n${JSON.stringify({automatedScores,metrics:scan.metrics},null,2)}\n\nReturn only valid JSON: {"scores":{"visualDesign":0,"businessFit":0,"ux":0,"conversion":0,"content":0},"confidence":0,"summary":"","strengths":[],"issues":[{"category":"visualDesign","severity":"medium","title":"","detail":"","impact":0,"effort":"s"}]}`;
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model,input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:desktop,detail:'high'},{type:'input_image',image_url:mobile,detail:'high'}]}]})});
  if(!response.ok)throw new Error(`OpenAI visual review failed: ${response.status}`);
  return parseJson(extractText(await response.json()));
}

export function mergeAIReview(automatedScores,review){
  if(!review?.scores||(review.confidence??0)<0.45)return automatedScores;const ai=review.scores;const mix=(key,w)=>Number.isFinite(ai[key])?automatedScores[key]*(1-w)+ai[key]*w:automatedScores[key];return{...automatedScores,visualDesign:mix('visualDesign',0.72),businessFit:mix('businessFit',0.65),ux:mix('ux',0.48),conversion:mix('conversion',0.42),content:mix('content',0.3)};
}
