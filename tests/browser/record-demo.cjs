// Record actual QueryTrace interactions and derive captions from their responses.
// The only intercepted routes are a guard that aborts paid Ask and ingestion.
const {chromium, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');
const baseURL = process.env.QUERYTRACE_SMOKE_BASE_URL || 'http://localhost:8035';
const out = path.resolve(process.env.QUERYTRACE_VIDEO_OUTPUT_DIR || 'docs/media/demo');
const rehearsal = process.env.QUERYTRACE_DEMO_REHEARSAL === '1';
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const captionFont = process.env.QUERYTRACE_VIDEO_FONT || '/System/Library/Fonts/Supplemental/Arial.ttf';
const titleFont = process.env.QUERYTRACE_VIDEO_TITLE_FONT || '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const viewport = {width:1600, height:800};
const outputSize = {width:1920, height:1080};
const query = "What is Meridian's ARR growth rate and net revenue retention?";
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const timecode = (seconds, separator='.') => new Date(Math.round(seconds*1000)).toISOString().slice(11,23).replace('.',separator);
const wrap = (text, limit) => text.split(/\s+/).reduce((lines,word) => {
  if ((lines.at(-1).length + word.length + 1) > limit) lines.push(word);
  else lines[lines.length-1] += (lines.at(-1) ? ' ' : '') + word;
  return lines;
}, ['']).join('\n');
function encode(args, label) {
  const result = spawnSync(ffmpeg, ['-hide_banner','-loglevel','warning','-y',...args], {cwd:out,encoding:'utf8'});
  if (result.error || result.status !== 0) throw Error(`${label}: ${result.error?.message || result.stderr}`);
}

(async () => {
  fs.mkdirSync(out,{recursive:true});
  const browser = await chromium.launch();
  let context;
  const errors = [], blockedRequests = [], scenes = [], exports = [];
  try {
    context = await browser.newContext({baseURL,viewport,locale:'en-US',timezoneId:'UTC',reducedMotion:'reduce',
      ...(rehearsal ? {} : {recordVideo:{dir:path.join(out,'raw'),size:viewport}})});
    await context.route(/\/(ask|ingest)(?:\?.*)?$/, route => {
      blockedRequests.push(new URL(route.request().url()).pathname);
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(() => {
      localStorage.setItem('qt_theme','light');
      localStorage.setItem('qt_tutorial_v1',JSON.stringify({status:'skipped',step:0}));
      if (!sessionStorage.getItem('qt_workspace')) sessionStorage.setItem('qt_workspace','pe-deal');
    });
    const page = await context.newPage(), video = rehearsal ? null : page.video(), recordingStarted = Date.now();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
    page.on('requestfailed', r => errors.push(`${new URL(r.url()).pathname}: ${r.failure()?.errorText}`));
    await page.goto('/app/');
    await expect(page.locator('#identity-context')).toContainText('Guest · Simulated Analyst');
    await page.evaluate(() => document.fonts.ready);
    const health = await (await page.request.get('/health')).json();
    const assets = {};
    for (const name of ['index.html','styles.css','app.js','favicon.svg','icons.svg']) {
      const served = await (await page.request.get(`/app/${name}`)).body();
      assets[name] = hash(served);
      expect(assets[name]).toBe(hash(fs.readFileSync(`frontend/${name}`)));
    }
    const ready = (Date.now()-recordingStarted)/1000;
    const elapsed = () => (Date.now()-recordingStarted)/1000-ready;
    const hold = ms => page.waitForTimeout(rehearsal ? 40 : ms);
    const mark = (chapter, text) => { scenes.push({at:elapsed(),chapter,text}); console.log(`Scene ${scenes.length}: ${chapter}`); };
    const show = async (selector, offset=128) => {
      await page.locator(selector).first().evaluate((e,offset) => window.scrollTo({top:e.getBoundingClientRect().top+scrollY-offset,behavior:'instant'}),offset);
      await page.mouse.move(viewport.width-22,viewport.height-22);
    };
    const nav = mode => page.locator(`.mode-btn[data-mode="${mode}"]`);
    const run = async endpoint => {
      const event = page.waitForResponse(r => new URL(r.url()).pathname===`/${endpoint}` && r.request().method()==='POST');
      await page.locator('#submit-btn').click();
      const response = await event; expect(response.status()).toBe(200);
      return response.json();
    };

    mark('01  Start with a question','QueryTrace shows which source fragments can enter a model context — and why.');
    await hold(4500);
    mark('01  Start with a question','Atlas Capital is a fictional workspace. Here, the guest is simulating an Analyst.');
    await page.locator('#query-input').pressSequentially(query,{delay:rehearsal ? 0 : 40});
    await hold(2200);
    const result = await run('query');
    await expect(page.locator('#executed-query')).toHaveText(query);
    const docCount = new Set(result.context.map(d=>d.doc_id)).size;
    expect(result.context.length).toBeGreaterThan(0);
    await show('.result-heading');
    mark('02  Inspect the context',`Run returns ${docCount} documents and ${result.context.length} fragments. It retrieves context; it does not generate an answer.`);
    await hold(5000);
    mark('02  Inspect the context',`${result.total_tokens.toLocaleString('en-US')} estimated context tokens fit within the ${result.decision_trace.policy_config.token_budget.toLocaleString('en-US')}-token budget.`);
    await hold(5000);

    await page.locator('.result-card[data-doc-id="doc_001"] .card-expand-btn').click();
    await show('.result-card[data-doc-id="doc_001"]',135);
    mark('03  Read the evidence','Open the actual source. The fictional Form 10-K reports 34.2% ARR growth and 118% net revenue retention.');
    await expect(page.locator('.result-card[data-doc-id="doc_001"]')).toContainText('34.2%');
    await expect(page.locator('.result-card[data-doc-id="doc_001"]')).toContainText('118%');
    await hold(8500);

    await page.locator('.trace-toggle').click();
    await show('.trace-panel');
    mark('04  Follow the decision','Decision Trace separates included, excluded and blocked fragments. A document can be partially included.');
    await hold(5500);
    const blocked = result.decision_trace.blocked_by_permission[0]; expect(blocked).toBeTruthy();
    const decision = page.locator('.record-table tbody tr').filter({hasText:blocked.chunk_id || blocked.doc_id}).filter({hasText:'Blocked'}).first();
    await decision.evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-230,behavior:'instant'}));
    await page.mouse.move(viewport.width-22,viewport.height-22);
    mark('04  Follow the decision',`This fragment requires ${blocked.required_role.toUpperCase()} access. The simulated Analyst cannot include it under Full Policy.`);
    await hold(8000);

    await nav('compare').click();
    const comparison = await run('compare');
    await expect(page.locator('.compare-col')).toHaveCount(3);
    await show('#compare-banner',125);
    const blockedIds = new Set(comparison.results.full_policy.decision_trace.blocked_by_permission.map(d=>d.doc_id));
    const leaks = new Set(comparison.results.naive_top_k.context.filter(d=>blockedIds.has(d.doc_id)).map(d=>d.doc_id)).size;
    expect(leaks).toBeGreaterThan(0);
    mark('05  Compare the policies',`Same question, same role: the unfiltered Top-k baseline includes ${leaks} documents that Full Policy blocks.`);
    await hold(6500);
    mark('05  Compare the policies',`Top-k uses ${comparison.results.naive_top_k.total_tokens.toLocaleString('en-US')} estimated tokens; Full Policy uses ${comparison.results.full_policy.total_tokens.toLocaleString('en-US')}. Their selection limits differ.`);
    await hold(5500);
    await page.screenshot({path:path.join(out,'cover-source.png')});
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#export-compare').click();
    const download = await downloadEvent;
    const exported = JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    expect(exported).toEqual(comparison);
    exports.push({kind:'comparison',matchesResponse:true});
    mark('05  Compare the policies','Export JSON preserves the executed query, role, metrics and decisions for inspection outside the interface.');
    await hold(4000);

    await nav('evals').click();
    await expect(page.locator('#evals-content')).toContainText('12 / 12');
    await show('#evals-section',130);
    mark('06  Check the benchmark','All 12 configured PE queries completed. This benchmark reports no unauthorized returns; it is not a production guarantee.');
    await hold(8500);
    await nav('audit').click();
    await expect(page.locator('#session-audit-content')).toContainText('pe-deal');
    await show('#audit-title',130);
    mark('07  Keep the execution record','Audit records the workspace, identity, effective role and policy. These local records reset when the server restarts.');
    await hold(7500);

    await nav('single').click();
    await page.locator('#signin-btn').click();
    await expect(page.locator('#login-title')).toBeVisible();
    mark('08  Enforce an actual identity','The demo accounts have different access. Sign in as Julia to use an authenticated Analyst role.');
    await hold(4500);
    await page.locator('[data-username="julia"]').click();
    await expect(page.locator('#identity-context')).toContainText('Signed in: Julia Ferreyra · Analyst');
    await page.locator('#query-input').fill(query);
    const authenticated = await run('query');
    expect(authenticated.execution.effective_role).toBe('analyst');
    expect(authenticated.execution.simulated).toBe(false);
    await show('.result-heading');
    mark('08  Enforce an actual identity','Julia’s document role is enforced by the server. It is no longer a guest simulation.');
    await hold(6500);
    await nav('documents').click();
    await expect(page.locator('#documents-content')).toContainText('6 accessible documents of 16');
    await show('#documents-section',130);
    mark('08  Enforce an actual identity','Documents exposes the six sources Julia may read. The other ten documents are withheld from this account.');
    await hold(7000);

    await page.locator('#logout-btn').click();
    await expect(page.locator('#identity-context')).toContainText('Guest · Simulated Analyst');
    await page.locator('#workspace-picker').selectOption('saas-internal');
    await expect(page.locator('#identity-context')).toContainText('Guest · Simulated Employee');
    await expect(page.locator('#executed-query')).toHaveCount(0);
    await show('#query-form',140);
    mark('09  Bring another workspace','Nimbus has its own corpus, roles and scenarios. Switching workspaces clears the previous result.');
    await hold(7500);
    await page.locator('#guide-button').click();
    await expect(page.locator('#tour-panel')).toBeVisible();
    mark('09  Bring another workspace','Guide walks through the same real workflow. Optional Ask can generate an answer when a provider is configured.');
    await hold(6500);

    const duration = elapsed();
    expect(errors).toEqual([]); expect(blockedRequests).toEqual([]);
    if (!rehearsal) { expect(duration).toBeGreaterThan(95); expect(duration).toBeLessThan(150); }
    const evidence = {sourceCommit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),baseURL,viewport,outputSize,health,assets,
      modelRequests:0,ingestionRequests:0,blockedRequests,errors,exports,query:result,comparison,authenticated,blockedDecision:blocked,scenes,duration};
    await context.close(); context = null;
    if (rehearsal) {
      fs.writeFileSync(path.join(out,'rehearsal.json'),JSON.stringify(evidence,null,2)+'\n');
      console.log('Rehearsal passed: actual endpoints, matched export, enforced identity, no model or ingestion requests.');
      return;
    }
    const raw = await video.path();
    const intro = 3, outro = 4, total = intro + duration + outro;
    const finalScenes = [
      {at:0,chapter:'QueryTrace',text:'Which evidence reaches the model?'},
      ...scenes.map(s=>({...s,at:s.at+intro})),
      {at:intro+duration,chapter:'Inspect. Compare. Trace.',text:'An auditable context gateway · Fictional demo data'}
    ];
    const chapters = finalScenes.filter((s,i)=>!i || finalScenes[i-1].chapter!==s.chapter);
    fs.writeFileSync(path.join(out,'captions.srt'),finalScenes.map((s,i)=>`${i+1}\n${timecode(s.at,',')} --> ${timecode(finalScenes[i+1]?.at ?? total,',')}\n${wrap(s.text,86)}\n`).join('\n'));
    fs.writeFileSync(path.join(out,'captions.vtt'),'WEBVTT\n\n'+finalScenes.map((s,i)=>`${timecode(s.at)} --> ${timecode(finalScenes[i+1]?.at ?? total)}\n${wrap(s.text,86)}\n`).join('\n'));
    fs.writeFileSync(path.join(out,'chapters.json'),JSON.stringify(chapters.map((s,i)=>({start:s.at,end:chapters[i+1]?.at ?? total,title:s.chapter})),null,2)+'\n');
    const safeFont = file => file.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
    const textFile = (name,text) => { fs.writeFileSync(path.join(out,name),text); return name; };
    const filters = ['scale=1920:960:flags=lanczos','pad=1920:1080:0:0:color=0x2b2627','drawbox=x=0:y=960:w=iw:h=3:color=0xd2e2c4:t=fill'];
    scenes.forEach((s,i) => {
      const enable = `between(t,${s.at.toFixed(3)},${(scenes[i+1]?.at ?? duration).toFixed(3)})`;
      textFile(`scene-${i}.txt`,wrap(s.text,109));
      textFile(`chapter-${i}.txt`,s.chapter.toUpperCase());
      filters.push(`drawtext=fontfile='${safeFont(titleFont)}':textfile='chapter-${i}.txt':expansion=none:fontsize=18:fontcolor=0xd2e2c4:x=48:y=977:enable='${enable}'`);
      filters.push(`drawtext=fontfile='${safeFont(captionFont)}':textfile='scene-${i}.txt':expansion=none:fontsize=27:fontcolor=0xfcfbf7:line_spacing=6:x=48:y=1007:enable='${enable}'`);
    });
    const codec = ['-c:v','libx264','-preset','slow','-crf','20','-pix_fmt','yuv420p','-r','25','-an'];
    encode(['-ss',ready.toFixed(3),'-i',raw,'-t',duration.toFixed(3),'-vf',filters.join(','),...codec,'body.mp4'],'recording encode');
    for (const [name,length,title,subtitle] of [
      ['intro',intro,'QueryTrace','Which evidence reaches the model?'],
      ['outro',outro,'Inspect. Compare. Trace.','An auditable context gateway · Fictional demo data']
    ]) {
      textFile(`${name}-title.txt`,title); textFile(`${name}-subtitle.txt`,subtitle);
      const vf = `drawbox=x=112:y=340:w=80:h=5:color=0xd2e2c4:t=fill,drawtext=fontfile='${safeFont(titleFont)}':textfile='${name}-title.txt':expansion=none:fontsize=94:fontcolor=0xfcfbf7:x=112:y=405,drawtext=fontfile='${safeFont(captionFont)}':textfile='${name}-subtitle.txt':expansion=none:fontsize=36:fontcolor=0xd6d3cf:x=116:y=540`;
      encode(['-f','lavfi','-i',`color=c=0x2b2627:s=1920x1080:r=25:d=${length}`,'-vf',vf,...codec,`${name}.mp4`],`${name} card`);
    }
    fs.writeFileSync(path.join(out,'concat.txt'),"file 'intro.mp4'\nfile 'body.mp4'\nfile 'outro.mp4'\n");
    const metadata = ';FFMETADATA1\ntitle=QueryTrace — inspect the evidence\ncomment=Real local application recording; fictional corpus; no model calls.\n' + chapters.map((s,i)=>`[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s.at*1000)}\nEND=${Math.round((chapters[i+1]?.at ?? total)*1000)}\ntitle=${s.chapter}\n`).join('');
    fs.writeFileSync(path.join(out,'chapters.ffmeta'),metadata);
    encode(['-f','concat','-safe','0','-i','concat.txt','-i','chapters.ffmeta','-map','0:v','-map_metadata','1','-map_chapters','1','-c','copy','-movflags','+faststart','querytrace-demo.mp4'],'final chaptered export');
    const compareTime = finalScenes.find(s=>s.chapter==='05  Compare the policies').at + 3;
    encode(['-ss',String(compareTime),'-i','querytrace-demo.mp4','-frames:v','1','cover.png'],'poster');
    const previewChapters = ['02  Inspect the context','03  Read the evidence','04  Follow the decision','05  Compare the policies','08  Enforce an actual identity'];
    evidence.previewSegments = previewChapters.map(title=>({start:finalScenes.find(s=>s.chapter===title).at+1,duration:5}));
    evidence.finalScenes = finalScenes; evidence.totalDuration = total; evidence.introDuration = intro;
    evidence.bytes = fs.statSync(path.join(out,'querytrace-demo.mp4')).size;
    evidence.sha256 = hash(fs.readFileSync(path.join(out,'querytrace-demo.mp4')));
    fs.writeFileSync(path.join(out,'demo-run.json'),JSON.stringify(evidence,null,2)+'\n');
    fs.writeFileSync(path.join(out,'transcript.md'),'# QueryTrace demo transcript\n\nSilent demonstration with burned-in English captions. The application footage is continuous; the opening/closing cards and caption band are editorial additions.\n\n'+finalScenes.map(s=>`## ${timecode(s.at).slice(0,8)} · ${s.chapter}\n\n${s.text}\n`).join('\n'));
    fs.rmSync(path.join(out,'raw'),{recursive:true});
    for (const name of fs.readdirSync(out)) if (/^(scene-|chapter-\d|intro-|outro-)/.test(name) || ['body.mp4','intro.mp4','outro.mp4','concat.txt','chapters.ffmeta','cover-source.png'].includes(name)) fs.unlinkSync(path.join(out,name));
    console.log(`Recorded ${(total).toFixed(2)}s, 1920×1080, ${chapters.length} chapters, ${(evidence.bytes/1024/1024).toFixed(2)} MiB. No model or ingestion requests.`);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exit(1);});
