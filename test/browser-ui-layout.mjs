import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {screens,viewports,prepareScreen,rectangles,activeButtons} from './ui-fixtures.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(
  'document.fonts.ready.then(()=>requestAnimationFrame(gameLoop));',
  'window.__testEvaluate = code => eval(code);');
const artifacts=new URL('../test-artifacts/ui/',import.meta.url);
mkdirSync(artifacts,{recursive:true});
// Known text-overlap findings (campaign map labels under overlays) live in
// ./ui-layout-baseline.json. The audit FAILS on any defect not in the baseline;
// shrink the baseline by fixing the UI, then re-run with --update-baseline.
const baselineFile=new URL('./ui-layout-baseline.json',import.meta.url);
const flatIssues=report=>report.samples.flatMap(s=>[
  ...s.outside.map(n=>`${s.width}x${s.height} ${s.screen} outside ${n}`),
  ...s.overlap.map(([a,b])=>`${s.width}x${s.height} ${s.screen} button-overlap ${a}|${b}`),
  ...s.clippedText.map(t=>`${s.width}x${s.height} ${s.screen} clipped ${t}`),
  ...s.textOverlap.map(([a,b])=>`${s.width}x${s.height} ${s.screen} text-overlap ${a}|${b}`),
]);

function inspectSample(sample,width,height,screen,scroll){
  const rects=rectangles(activeButtons(screen,sample.btns));
  const outside=rects.filter(b=>b.x<-.1||b.y<-.1||b.x+b.w>width+.1||b.y+b.h>height+.1).map(b=>b.name),overlap=[];
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    const a=rects[i],b=rects[j];
    if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.5)overlap.push([a.name,b.name]);
  }
  const texts=sample.texts.filter(t=>!t.clip||(t.y+t.h>t.clip.y&&t.y<t.clip.y+t.clip.h&&t.baseline<=t.clip.y+t.clip.h));
  const clippedText=texts.filter(t=>!t.rotated&&(t.x<(t.clip?.x||0)-.5||t.x+t.w>(t.clip?t.clip.x+t.clip.w:width)+.5)).map(t=>t.text),textOverlap=[];
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
    const a=texts[i],b=texts[j];
    if(a.text===b.text||a.plane!==b.plane||a.rotated||b.rotated||a.y<0||b.y<0||a.y>height||b.y>height)continue;
    if(screen.gameplay&&(!a.clip||!b.clip))continue;
    if(Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2)textOverlap.push([a.text,b.text]);
  }
  return {width,height,screen:screen.name,scroll,outside,overlap,clippedText,textOverlap};
}

export async function auditLayouts(engineName,engine,{baseline=false}={}) {
  const browser=await engine.launch();
  const report={engine:engineName,screens:screens.length,viewports:viewports.length,samples:[],errors:[]};
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
    page.on('pageerror',e=>report.errors.push(String(e)));
    await page.route('https://fonts.googleapis.com/**',route=>route.abort());
    await page.route('https://fonts.gstatic.com/**',route=>route.abort());
    await page.setContent(html,{waitUntil:'domcontentloaded'});
    const fixture=code=>page.evaluate(code=>window.__testEvaluate(code),code);
    await fixture(`window.__uiTexts=[];window.__uiPlane='screen';const originalFillText=ctx.fillText.bind(ctx);
      const originalDrawToasts=drawToasts;
      drawToasts=function(){window.__uiPlane='notification';originalDrawToasts();window.__uiPlane='screen';};
      const originalFillRect=ctx.fillRect.bind(ctx);
      ctx.fillRect=function(x,y,w,h){if(x===0&&y===0&&w===W&&h===H)window.__uiTexts=[];originalFillRect(x,y,w,h);};
      ctx.fillText=function(text,x,y,maxWidth){
        const m=ctx.measureText(String(text)),t=ctx.getTransform();
        const w=Math.min(m.width,maxWidth||Infinity);
        const left=x-(ctx.textAlign==='center'?w/2:ctx.textAlign==='right'?w:0);
        const fs=parseFloat(ctx.font.match(/([\\d.]+)px/)[1]);
        const middle=ctx.textBaseline==='middle';
        const top=y-(middle?fs/2:m.actualBoundingBoxAscent||fs*.8);
        const clip=typeof uiState!=='undefined'&&uiState.drawing?{x:uiState.frame.x,y:uiState.frame.y,w:uiState.frame.w,h:uiState.frame.viewH}:null;
        window.__uiTexts.push({text:String(text),x:t.a*left+t.e,y:t.d*top+t.f,clip,plane:window.__uiPlane,
          w:w*t.a,h:((m.actualBoundingBoxAscent||fs*.8)+(m.actualBoundingBoxDescent||fs*.2))*t.d,
          baseline:t.d*y+t.f,font:fs,rotated:Math.abs(t.b)+Math.abs(t.c)>.01});
        originalFillText(text,x,y,...(maxWidth?[maxWidth]:[]));
      };`);
    for(const [width,height] of viewports){
      await page.setViewportSize({width,height});
      for(const screen of screens){
        const sample=await fixture(`window.__uiTexts=[];${prepareScreen(screen)}
          ({texts:window.__uiTexts,btns:G._btns})`);
        const rects=rectangles(activeButtons(screen,sample.btns));
        const outside=rects.filter(b=>b.x<-.1||b.y<-.1||b.x+b.w>width+.1||b.y+b.h>height+.1).map(b=>b.name);
        const overlap=[];
        for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
          const a=rects[i],b=rects[j];
          if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.5)overlap.push([a.name,b.name]);
        }
        const visible=t=>!t.clip||(t.y+t.h>t.clip.y&&t.y<t.clip.y+t.clip.h&&t.baseline<=t.clip.y+t.clip.h);
        const texts=sample.texts.filter(visible);
        const clippedText=texts.filter(t=>!t.rotated&&(t.x<(t.clip?.x||0)-.5||t.x+t.w>(t.clip?t.clip.x+t.clip.w:width)+.5)).map(t=>t.text);
        const textOverlap=[];
        if(!screen.gameplay)for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
          const a=texts[i],b=texts[j];
          if(a.text===b.text||a.plane!==b.plane||a.rotated||b.rotated||a.y<0||b.y<0||a.y>height||b.y>height)continue;
          if(Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2)textOverlap.push([a.text,b.text]);
        }
        report.samples.push({width,height,screen:screen.name,outside,overlap,clippedText,textOverlap});
        if([[320,568],[844,390],[1920,1080]].some(v=>v[0]===width&&v[1]===height)&&
          ['menu-new','instructions','hero-roster','campaign-build','battle-hero-0','clash-attack','store-0','loadout'].includes(screen.name))
          await page.screenshot({path:new URL(`${baseline?'before':'after'}-${engineName}-${width}x${height}-${screen.name}.png`,artifacts).pathname});
      }
    }
    writeFileSync(new URL(`${baseline?'before':'after'}-${engineName}.json`,artifacts),JSON.stringify(report,null,2));
    const failed=report.samples.filter(s=>s.outside.length||s.overlap.length||s.clippedText.length||s.textOverlap.length);
    console.log(`${engineName}: ${report.samples.length} screen/viewport checks, ${failed.length} layouts need attention, ${report.errors.length} browser errors`);
    console.log(JSON.stringify(failed.slice(0,12),null,2));
    assert.deepEqual(report.errors,[],`${engineName}: browser errors during layout audit`);
    const current=flatIssues(report);
    if(process.argv.includes('--update-baseline')){
      const b=JSON.parse(readFileSync(baselineFile,'utf8'));
      b[engineName]=[...new Set(current)].sort();
      writeFileSync(baselineFile,JSON.stringify(b,null,2)+'\n');
      console.log(`${engineName}: baseline updated to ${b[engineName].length} known issues`);
      return report;
    }
    const known=JSON.parse(readFileSync(baselineFile,'utf8'))[engineName]||[];
    const fresh=current.filter(i=>!known.includes(i));
    assert.deepEqual(fresh,[],`${engineName}: new UI layout defects (fix them; only pre-existing baseline entries are tolerated)`);
    const fixed=known.filter(i=>!current.includes(i));
    if(fixed.length)console.log(`${engineName}: ${fixed.length} baseline entries no longer reproduce — shrink the baseline with --update-baseline`);
    return report;
  } finally {await browser.close();}
}

if(process.argv[1]===new URL(import.meta.url).pathname){
  await auditLayouts('chromium',chromium,{baseline:process.argv.includes('--baseline')});
  if(!process.argv.includes('--baseline'))await auditLayouts('webkit',webkit);
}
