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
  ...s.occlusion.map(n=>`${s.width}x${s.height} ${s.screen} occluded ${n}`),
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
      // Painted-button tracker: hitboxes say where taps land, but paint order
      // decides what the player SEES. A button that paints over an active
      // hitbox without owning one is an occlusion defect. Capture is armed
      // before each fixture so the frame-start clear wipes stale rects but
      // later full-canvas fills (overlays) keep the buttons on record.
      const originalRoundRect=ctx.roundRect.bind(ctx);
      ctx.roundRect=function(x,y,w,h,r){const t=ctx.getTransform();window.__uiRects.push({x:t.a*x+t.e,y:t.d*y+t.f,w:w*t.a,h:h*t.d});return originalRoundRect(x,y,w,h,...(r!==undefined?[r]:[]));};
      ctx.fillRect=function(x,y,w,h){if(x===0&&y===0&&w===W&&h===H){window.__uiTexts=[];if(window.__uiRectsArmed){window.__uiRects=[];window.__uiRectsArmed=false;}}originalFillRect(x,y,w,h);};
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
        const sample=await fixture(`window.__uiTexts=[];window.__uiRects=[];window.__uiRectsArmed=true;${prepareScreen(screen)}
          ({texts:window.__uiTexts,rects:window.__uiRects,btns:G._btns})`);
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
        // Occlusion: a painted button-sized rect crossing an ACTIVE hitbox
        // without owning one covers a control the player sees. Later paint
        // wins the pixels, so a rect painted before the hitbox's own paint
        // call is underneath it. Glow rings, tutorial spotlights (symmetric
        // padding) and surface-clipped hitboxes (same button, taller paint)
        // are the control itself, not an occluder.
        const crosses=(p,h)=>Math.min(p.x+p.w,h.x+h.w)-Math.max(p.x,h.x)>2&&Math.min(p.y+p.h,h.y+h.h)-Math.max(p.y,h.y)>2;
        const exact=(p,h)=>Math.abs(p.x-h.x)<=1.5&&Math.abs(p.y-h.y)<=1.5&&Math.abs(p.w-h.w)<=1.5&&Math.abs(p.h-h.h)<=1.5;
        const occlusion=[];
        if(screen.gameplay){
          const painted=(sample.rects||[]).map((p,i)=>({...p,i})).filter(p=>p.w>=18&&p.h>=18&&p.w<=200&&p.h<=80);
          for(const h of rects){
            const painters=painted.filter(p=>crosses(p,h));
            const own=painters.filter(p=>exact(p,h));
            const ringOrClip=p=>{
              const padL=h.x-p.x,padR=p.x+p.w-(h.x+h.w),padT=h.y-p.y,padB=p.y+p.h-(h.y+h.h);
              const sym=padL>=-1&&padR>=-1&&padT>=-1&&padB>=-1&&Math.abs(padL-padR)<=2&&Math.abs(padT-padB)<=2&&Math.max(padL,padR,padT,padB)<=6;
              const clipped=Math.abs(p.x-h.x)<=2&&Math.abs(p.y-h.y)<=2&&Math.abs(p.w-h.w)<=2&&p.h>=h.h-1;
              return sym||clipped;
            };
            for(const p of painters){
              if(own.includes(p)||own.some(q=>q.i>p.i)||ringOrClip(p))continue;
              occlusion.push(h.name);
              break;
            }
          }
        }
        report.samples.push({width,height,screen:screen.name,outside,overlap,clippedText,textOverlap,occlusion:[...new Set(occlusion)]});
        if([[320,568],[844,390],[1920,1080]].some(v=>v[0]===width&&v[1]===height)&&
          ['menu-new','instructions','hero-roster','campaign-build','battle-hero-0','clash-attack','store-0','loadout'].includes(screen.name))
          await page.screenshot({path:new URL(`${baseline?'before':'after'}-${engineName}-${width}x${height}-${screen.name}.png`,artifacts).pathname});
      }
    }
    writeFileSync(new URL(`${baseline?'before':'after'}-${engineName}.json`,artifacts),JSON.stringify(report,null,2));
    const failed=report.samples.filter(s=>s.outside.length||s.overlap.length||s.clippedText.length||s.textOverlap.length||s.occlusion.length);
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
