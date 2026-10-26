// Play the complete export at normal speed; save frames for visual inspection.
const {chromium,expect}=require('@playwright/test');
const {AxeBuilder}=require('@axe-core/playwright');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const out=path.resolve(process.env.QUERYTRACE_VIDEO_OUTPUT_DIR||'docs/media/demo');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'demo-run.json'),'utf8'));
 const chapters=JSON.parse(fs.readFileSync(path.join(out,'chapters.json'),'utf8'));
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'querytrace-demo.mp4'))).digest('hex');
 expect(sha256).toBe(manifest.sha256);
 expect(chapters.length).toBeGreaterThan(2);
 for(let i=0;i<chapters.length;i++){
  expect(chapters[i].end).toBeGreaterThan(chapters[i].start);
  if(i)expect(chapters[i].start).toBe(chapters[i-1].end);
 }
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1150}});
  const page=await context.newPage();
  const errors=[],abortedMediaRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('requestfailed',r=>{
   const pathname=new URL(r.url()).pathname,failure=r.failure()?.errorText;
   // Seeking may cancel a superseded media range. Keep it in the report;
   // decoding, end-to-end playback and every other network failure still gate success.
   if(pathname==='/querytrace-demo.mp4'&&failure==='net::ERR_ABORTED')abortedMediaRequests.push({pathname,failure});
   else errors.push(`${pathname}: ${failure}`);
  });
  await page.goto(process.env.QUERYTRACE_VIDEO_PLAYER_URL||'http://localhost:8036/');
  await expect(page.locator('#chapters button')).toHaveCount(chapters.length);
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  // Check actual chapter navigation, then start the uninterrupted review at zero.
  await page.locator('#chapters button').nth(5).click();
  await expect.poll(()=>page.locator('video').evaluate(v=>Math.floor(v.currentTime))).toBe(Math.floor(chapters[5].start));
  await page.locator('#chapters button').first().click();
  const checkpoints=[];
  for(const [i,chapter] of chapters.entries()){
   const time=Math.min(chapter.start+1.5,chapter.end-.2);
   await page.waitForFunction(time=>document.querySelector('video').currentTime>=time,time,{timeout:60000});
   const state=await page.locator('video').evaluate(v=>({time:v.currentTime,paused:v.paused,width:v.videoWidth,height:v.videoHeight,readyState:v.readyState}));
   expect(state.paused).toBe(false);expect(state.width).toBe(manifest.outputSize.width);expect(state.height).toBe(manifest.outputSize.height);
   const file=`review-${String(i).padStart(2,'0')}.png`;
   checkpoints.push({chapter:chapter.title,file,...state});
   await page.locator('video').screenshot({path:path.join(out,file)});
   console.log(`Reviewed ${chapter.title} at ${state.time.toFixed(1)}s`);
  }
  await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:15000});
  const playback=await page.locator('video').evaluate(v=>({duration:v.duration,currentTime:v.currentTime,ended:v.ended,error:v.error,playbackRate:v.playbackRate,quality:{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames}}));
  expect(playback.ended).toBe(true);expect(playback.error).toBeNull();expect(playback.playbackRate).toBe(1);expect(errors).toEqual([]);
  expect(Math.abs(playback.duration-manifest.totalDuration)).toBeLessThan(.2);
  await page.setViewportSize({width:375,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const mobileAccessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(mobileAccessibility.violations).toEqual([]);
  fs.writeFileSync(path.join(out,'playback-review.json'),JSON.stringify({sha256,playback,checkpoints,errors,abortedMediaRequests,player:{chapters:chapters.length,chapterNavigation:true,mobileNoOverflow:true,desktopAxeViolations:accessibility.violations.length,mobileAxeViolations:mobileAccessibility.violations.length}},null,2)+'\n');
  console.log(`Played entire H.264 export at normal speed: ${playback.duration}s, ${playback.quality.totalVideoFrames} frames, ${playback.quality.droppedVideoFrames} dropped.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
