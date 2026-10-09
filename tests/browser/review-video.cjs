// Playback validation, alongside manual review of the saved video frames.
const {chromium,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const out=path.resolve('docs/evidence/ui-polish/video');
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1500,height:1150}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.QUERYTRACE_VIDEO_PLAYER_URL||'http://localhost:8016/');
 await page.locator('video').evaluate(video=>video.play());
 const checkpoints=[];
 for(const time of [3,13,21,28,35,42,48,55]){
  await page.waitForFunction(time=>document.querySelector('video').currentTime>=time,time,{timeout:20000});
  const state=await page.locator('video').evaluate(v=>({time:v.currentTime,paused:v.paused,width:v.videoWidth,height:v.videoHeight,readyState:v.readyState}));
  expect(state.paused).toBe(false);expect(state.width).toBe(1440);expect(state.height).toBe(996);
  checkpoints.push(state);await page.locator('video').screenshot({path:path.join(out,`review-${time.toString().padStart(2,'0')}.png`)});
 }
 await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:15000});
 const playback=await page.locator('video').evaluate(v=>({duration:v.duration,currentTime:v.currentTime,ended:v.ended,error:v.error,quality:v.getVideoPlaybackQuality().toJSON?.()||{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames}}));
 expect(playback.ended).toBe(true);expect(playback.error).toBeNull();expect(errors).toEqual([]);
 fs.writeFileSync(path.join(out,'playback-review.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'querytrace-demo.mp4'))).digest('hex'),playback,checkpoints,errors},null,2));
 console.log(`Played entire H.264 export at normal speed: ${playback.duration}s, ${playback.quality.totalVideoFrames} frames, ${playback.quality.droppedVideoFrames} dropped.`);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
