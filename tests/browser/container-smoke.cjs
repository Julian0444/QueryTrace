// Run only against a disposable, labeled Docker container. Uploads to its copy
// of the PE corpus and restarts that container; never bind-mount a user's corpus.
const {chromium,expect}=require('@playwright/test');
const {execFileSync}=require('child_process');
const fs=require('fs');
const path=require('path');
const container=process.env.QUERYTRACE_SMOKE_CONTAINER;
const baseURL=process.env.QUERYTRACE_SMOKE_BASE_URL||'http://localhost:8002';
const outputDir=process.env.QUERYTRACE_SMOKE_OUTPUT_DIR||'docs/evidence/docker';
const peQuery="What is Meridian's ARR growth rate and net revenue retention?";
const saasQuery='What is the current on-call escalation process and database failover procedure?';
const pageErrors=[];
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:60000});
const nav=(page,mode)=>page.locator(`.mode-btn[data-mode="${mode}"]`);
async function boot(browser,url,workspace='pe-deal') {
 const page=await browser.newPage({baseURL:url,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>pageErrors.push(e.message));
 await page.addInitScript(ws=>{
   localStorage.setItem('qt_tutorial_v1',JSON.stringify({status:'skipped',step:0}));
   if(!sessionStorage.getItem('qt_workspace'))sessionStorage.setItem('qt_workspace',ws);
 },workspace);
 await page.goto(`${url}/app/`);
 await expect(page.locator('#workspace-picker')).toHaveValue(workspace);
 return page;
}
async function login(page,username) {
 await page.locator('#signin-btn').click();
 await page.locator(`[data-username="${username}"]`).click();
 await expect(page.locator('#logout-btn')).toBeVisible();
}
async function run(page,query,endpoint='query') {
 await page.locator('#query-input').fill(query);
 const event=page.waitForResponse(r=>new URL(r.url()).pathname===`/${endpoint}`&&r.request().method()==='POST');
 await page.locator('#submit-btn').click();
 const response=await event;expect(response.status()).toBe(200);
 return response.json();
}
(async()=>{
 if(!container) throw new Error('Set QUERYTRACE_SMOKE_CONTAINER to a disposable validation container.');
 const info=JSON.parse(docker('inspect',container))[0];
 expect(info.Config.Labels?.['querytrace.validation']).toBe('true');
 expect(info.Mounts).toHaveLength(0);
 expect(info.Config.Env.some(v=>v.startsWith('QUERYTRACE_SECRET_KEY=')&&v.length>22)).toBe(true);
 const port=new URL(baseURL).port;
 const bound=Object.values(info.NetworkSettings.Ports).flat().filter(Boolean);
 expect(bound.some(b=>b.HostPort===port&&b.HostIp==='127.0.0.1')).toBe(true);
 fs.mkdirSync(outputDir,{recursive:true});
 const report={base_url:baseURL,container,sessions:[],page_errors:pageErrors};
 const browser=await chromium.launch();
 try {
   for(const host of ['localhost','127.0.0.1']) for(const [workspace,username,role] of [
     ['pe-deal','julia','analyst'],['pe-deal','patricia','partner'],
     ['saas-internal','sofia','employee'],['saas-internal','alex','exec'],
   ]) {
     const origin=`http://${host}:${port}`;
     const page=await boot(browser,origin,workspace);
     expect((await(await page.request.get('/health')).json()).ask_enabled).toBe(false);
     await login(page,username);
     const data=await run(page,workspace==='pe-deal'?peQuery:saasQuery);
     expect(data.execution.simulated).toBe(false);
     expect(data.execution.workspace).toBe(workspace);
     expect(data.decision_trace.user_context.role).toBe(role);
     expect(data.context.length).toBeGreaterThan(0);
     await page.reload();await expect(page.locator('#logout-btn')).toBeVisible();
     expect((await(await page.request.get('/me')).json()).username).toBe(username);
     const cookies=await page.context().cookies();
     const session=cookies.find(c=>c.name==='qt_session');
     expect(session.httpOnly).toBe(true);expect(session.sameSite).toBe('Lax');
     await page.locator('#logout-btn').click();
     await expect(page.locator('#logout-btn')).not.toBeVisible();
     expect((await page.request.get('/me')).status()).toBe(401);
     report.sessions.push({origin,workspace,username,role,fragments:data.context.length,reload:true,logout:true,http_only:true,same_site:'Lax'});
     await page.close();
   }
   const page=await boot(browser,baseURL);await login(page,'patricia');
   await nav(page,'compare').click();
   await page.locator('label:has(input[name="role"][value="analyst"])').click();
   const comparison=await run(page,peQuery,'compare');
   expect(comparison.role).toBe('analyst');
   expect(comparison.results.full_policy.execution.simulated).toBe(true);
   expect(comparison.results.full_policy.decision_trace.metrics.blocked_count).toBeGreaterThan(0);
   report.admin_comparison={effective_role:comparison.role,execution:comparison.results.full_policy.execution};
   const before=await(await page.request.get('/workspaces/pe-deal/meta')).json();
   await nav(page,'admin').click();
   await page.locator('#admin-file').setInputFiles('tests/browser/fixtures/meridian-table.docx');
   await page.locator('#admin-title').fill('Docker validation: Meridian ARR table');
   await page.locator('#admin-date').fill('2024-06-01');
   await page.locator('#admin-min-role').selectOption('analyst');
   await page.locator('#admin-doc-type').selectOption('research_note');
   const upload=page.waitForResponse(r=>new URL(r.url()).pathname==='/ingest'&&r.request().method()==='POST');
   await page.locator('#admin-submit').click();
   const accepted=await upload;expect(accepted.status()).toBe(202);
   const job=await accepted.json();
   await expect(page.locator('#admin-status')).toContainText('Indexed',{timeout:45000});
   const done=await(await page.request.get(`/ingest/jobs/${job.job_id}`)).json();
   expect(done.result.doc_id).toBeTruthy();
   await page.screenshot({path:path.join(outputDir,'container-upload.png'),animations:'disabled'});
   const after=await(await page.request.get('/workspaces/pe-deal/meta')).json();
   expect(after.total_docs).toBe(before.total_docs+1);
   await nav(page,'documents').click();
   await expect(page.locator('#documents-section')).toContainText('Docker validation: Meridian ARR table');
   await nav(page,'single').click();
   const selected=await run(page,peQuery);
   expect(selected.execution.corpus_version).not.toBe(comparison.results.full_policy.execution.corpus_version);
   expect(selected.context.some(d=>d.doc_id===done.result.doc_id)).toBe(true);
   // A stable, randomly generated test signing key keeps this browser's cookie
   // valid across restart. The key and cookie are deliberately absent from logs.
   const started=Date.now();docker('restart',container);
   await expect.poll(async()=>{
     try {return (await page.request.get('/health',{timeout:1000})).status();}catch{return 0;}
   },{timeout:45000}).toBe(200);
   expect((await(await page.request.get('/me')).json()).username).toBe('patricia');
   await page.reload();await expect(page.locator('#logout-btn')).toBeVisible();
   const restored=await run(page,peQuery);
   expect(restored.execution.corpus_version).toBe(selected.execution.corpus_version);
   expect(restored.context.some(d=>d.doc_id===done.result.doc_id)).toBe(true);
   expect((await(await page.request.get('/workspaces/pe-deal/meta')).json()).total_docs).toBe(after.total_docs);
   report.upload={job:done,documents_before:before.total_docs,documents_after:after.total_docs,corpus_version:selected.execution.corpus_version,retrievable_after_restart:true,session_preserved_after_restart:true,restart_ready_ms:Date.now()-started};
   await page.locator('#logout-btn').click();
   await expect(page.locator('#logout-btn')).not.toBeVisible();
   expect((await page.request.get('/me')).status()).toBe(401);
   expect(report.page_errors).toEqual([]);
   fs.writeFileSync(path.join(outputDir,'container-smoke.json'),JSON.stringify(report,null,2)+'\n');
   console.log('Container smoke passed: eight real browser sessions, manual admin role, DOCX publication, retrieval and session/corpus persistence after restart. No model calls.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
