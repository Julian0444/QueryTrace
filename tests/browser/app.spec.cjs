const {test, expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const OUT=path.resolve('docs/evidence/after');
fs.mkdirSync(OUT,{recursive:true});
const peQuery="What is Meridian's ARR growth rate and net revenue retention?";
const saasQuery='What is the current on-call escalation process and database failover procedure?';
const nav=(page,mode)=>page.locator(`.mode-btn[data-mode="${mode}"]`);

async function boot(page,{host='localhost',workspace='pe-deal',welcome=false}={}) {
  if(!welcome) await page.addInitScript(()=>localStorage.setItem('qt_tutorial_v1',JSON.stringify({status:'skipped',step:0})));
  await page.addInitScript(ws=>sessionStorage.setItem('qt_workspace',ws),workspace);
  await page.goto(`http://${host}:8011/app/`);
  await expect(page.locator('#workspace-picker')).toHaveValue(workspace);
  if(!welcome && await page.locator('#tour-explore').isVisible()) await page.locator('#tour-explore').click();
  if(!welcome && await page.locator('#guest-link').isVisible()) await page.locator('#guest-link').click();
}
async function run(page,query,endpoint='query') {
  await page.locator('#query-input').fill(query);
  const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/${endpoint}`&&r.request().method()==='POST');
  await page.locator(endpoint==='ask'?'#ask-btn':'#submit-btn').click();
  const r=await response; expect(r.status()).toBe(200);
  const data=await r.json();
  await expect(page.locator(endpoint==='compare'?'#compare-grid':'#results-section')).not.toContainText('Running comparison');
  return data;
}
async function login(page,username) {
  if(await page.locator('#signin-btn').isVisible()) await page.locator('#signin-btn').click();
  await page.locator(`[data-username="${username}"]`).click();
  await expect(page.locator('#logout-btn')).toBeVisible();
}
function account(data) {
  const t=data.decision_trace,m=t.metrics;
  expect(m.included_count).toBe(data.context.length);
  expect(t.included.reduce((n,d)=>n+d.token_count,0)).toBe(data.total_tokens);
  expect(t.total_tokens).toBe(data.total_tokens);
  expect(m.blocked_count+m.included_count+m.dropped_count+(m.irrelevant_count||0)).toBe(m.retrieved_count);
}
async function shot(page,name,fullPage=false) {
  await page.screenshot({path:path.join(OUT,name+'.png'),fullPage,animations:'disabled'});
}

test.beforeEach(async({request})=>{await request.post('/__test/control',{data:{}})});

test('new tutorial can be skipped, reopened, reset and keyboard dismissed without paid calls',async({page,request})=>{
 await boot(page,{welcome:true});
 await expect(page.locator('#welcome-dialog')).toBeVisible();
 await shot(page,'welcome');
 await page.locator('#tour-explore').click();
 await expect(page.locator('#welcome-dialog')).not.toBeVisible();
 await page.reload();
 await expect(page.locator('#welcome-dialog')).not.toBeVisible();
 await page.locator('#guide-button').click();
 await expect(page.locator('#tour-panel')).toBeVisible();
 await page.locator('#tour-next').click();
 await expect(page.locator('#tour-panel')).toContainText(/role|identity/i);
 await page.locator('#tour-back').click();
 await page.locator('#tour-close').click();
 await expect(page.locator('#tour-panel')).not.toBeVisible();
 expect((await(await request.get('/__test/state')).json()).calls).toHaveLength(0);
});

test('tutorial completes and preserves a query draft when navigating steps',async({page,request})=>{
 await boot(page); await page.locator('#query-input').fill('My unsent draft');
 await page.locator('#guide-button').click();
 await page.locator('#tour-reset').click();
 for(let step=0;step<6;step++){
   await expect(page.locator('#tour-panel')).toBeVisible();
   await shot(page,`tutorial-${step+1}`);
   await page.locator('#tour-next').click();
 }
 await expect(page.locator('#tour-panel')).not.toBeVisible();
 expect(await page.locator('#query-input').inputValue()).toBe('My unsent draft');
 await page.reload(); await expect(page.locator('#welcome-dialog')).not.toBeVisible();
 expect((await(await request.get('/__test/state')).json()).calls).toHaveLength(0);
});

for(const [workspace,roles,query] of [
 ['pe-deal',['analyst','vp','partner'],peQuery],
 ['saas-internal',['employee','manager','exec'],saasQuery],
]) test(`guest roles, Query, Compare, export and Documents in ${workspace}`,async({page})=>{
 await boot(page,{workspace});
 for(const role of roles){
   await page.locator(`input[name="role"][value="${role}"]`).check();
   const data=await run(page,query); account(data);
   expect(data.decision_trace.user_context.role).toBe(role);
   await expect(page.locator('#executed-query')).toContainText(query);
 }
 const before=await page.locator('#executed-query').innerText();
 await page.locator('#query-input').fill('Edited but not executed');
 await expect(page.locator('#executed-query')).toHaveText(before);
 await expect(page.locator('#results-section')).toContainText(/changed|not run|previous/i);
 await nav(page,'documents').click();
 await expect(page.locator('#documents-section')).toContainText(/class|role|document/i);
 await shot(page,`${workspace}-documents`);
 await nav(page,'compare').click();
 await page.locator(`input[name="role"][value="${roles[0]}"]`).check();
 const comparison=await run(page,query,'compare');
 expect(comparison.role).toBe(roles[0]);
 Object.values(comparison.results).forEach(account);
 expect(comparison.results.naive_top_k.context.length).toBeLessThanOrEqual(8);
 const dl=page.waitForEvent('download'); await page.locator('#export-compare').click();
 const download=await dl; const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 expect(exported).toEqual(comparison);
 await shot(page,`${workspace}-compare`);
});

for(const host of ['localhost','127.0.0.1']) for(const [workspace,username,role] of [
 ['pe-deal','julia','analyst'],['pe-deal','victoria','vp'],['pe-deal','patricia','partner'],
 ['saas-internal','sofia','employee'],['saas-internal','marcos','manager'],['saas-internal','alex','exec'],
]) test(`${host}: ${username} login, enforced role, reload and logout`,async({page})=>{
 await boot(page,{host,workspace}); await login(page,username);
 const data=await run(page,workspace==='pe-deal'?peQuery:saasQuery);
 expect(data.decision_trace.user_context.role).toBe(role); account(data);
 await page.reload(); await expect(page.locator('#logout-btn')).toBeVisible();
 expect((await(await page.request.get(`http://${host}:8011/me`)).json()).username).toBe(username);
 await page.locator('#logout-btn').click();
 await expect(page.locator('#logout-btn')).not.toBeVisible();
 expect((await page.request.get(`http://${host}:8011/me`)).status()).toBe(401);
});

test('admin manual role and scenario role agree with API; workspace change clears context',async({page})=>{
 await boot(page); await login(page,'patricia');
 await nav(page,'compare').click();
 await page.locator('input[name="role"][value="analyst"]').check();
 const data=await run(page,peQuery,'compare'); expect(data.role).toBe('analyst');
 expect(data.results.full_policy.decision_trace.metrics.blocked_count).toBeGreaterThan(0);
 await expect(page.locator('#identity-context')).toContainText(/patricia|Patricia/);
 await shot(page,'admin-simulated-analyst');
 await page.locator('#workspace-picker').selectOption('saas-internal');
 await expect(page.locator('#workspace-picker')).toHaveValue('saas-internal');
 await expect(page.locator('.compare-col')).toHaveCount(0);
 await expect(page.locator('#logout-btn')).not.toBeVisible();
});

test('restricted session cannot silently run an incompatible scenario or baseline',async({page})=>{
 await boot(page); await login(page,'julia');
 const incompatible=page.locator('.example-btn[data-role="partner"]');
 for(const button of await incompatible.all()) expect(await button.isEnabled()).toBe(false);
 expect((await page.request.post('/query',{data:{query:peQuery,role:'partner'}})).status()).toBe(400);
 expect((await page.request.post('/compare',{data:{query:peQuery,role:'analyst'}})).status()).toBe(403);
 const data=await run(page,peQuery);
 expect(data.decision_trace.blocked_by_permission).toEqual([]);
 await shot(page,'authenticated-query');
});

test('outside-domain and exhausted budget retain explanatory traces and export',async({page})=>{
 await boot(page);
 const outside=await run(page,'How do I bake a chocolate cake?');
 expect(outside.context).toHaveLength(0);
 expect(outside.decision_trace.result_status).toBe('insufficient_evidence');
 await expect(page.locator('#results-section')).toContainText(/evidence|relevant/i);
 await expect(page.locator('.trace-panel')).toBeVisible();
 await shot(page,'insufficient-evidence');
 // Advanced budget is a real request parameter, not a fabricated response.
 const budget=page.locator('#token-budget');
 await budget.fill('0');
 const empty=await run(page,peQuery);
 expect(empty.context).toHaveLength(0);
 expect(empty.decision_trace.result_status).toBe('budget_exhausted');
 await expect(page.locator('.trace-panel')).toBeVisible();
});

for(const [workspace,status] of [['restricted-test','blocked_by_permissions'],['empty-test','empty_corpus']])
test(`${status} remains inspectable in Query and Compare`,async({page})=>{
 await boot(page,{workspace});
 const q='How do I align the observatory telescope for observation?';
 const data=await run(page,q);expect(data.context).toHaveLength(0);
 expect(data.decision_trace.result_status).toBe(status);
 await expect(page.locator('.trace-panel')).toBeVisible();
 await nav(page,'compare').click();
 const comparison=await run(page,q,'compare');
 expect(comparison.results.full_policy.decision_trace.result_status).toBe(status);
});

test('BYOC without evaluation, scenarios or personas has usable documents and tutorial',async({page})=>{
 await boot(page,{workspace:'custom-no-evals'});
 await nav(page,'evals').click();
 await expect(page.locator('#evals-content')).toContainText(/unavailable|not configured|no evaluation/i);
 await expect(page.locator('#evals-content')).not.toContainText(/Certified|0% permission/);
 await shot(page,'custom-no-evals');
 await nav(page,'documents').click();
 await expect(page.locator('#documents-section')).toContainText('Observatory telescope manual');
 await page.locator('#guide-button').click();
 for(let i=0;i<5;i++)await page.locator('#tour-next').click();
 await expect(page.locator('#tour-panel')).toBeVisible();
 await page.locator('#tour-close').click();
 await nav(page,'single').click();
 const data=await run(page,'How do I align the observatory telescope?');
 expect(data.context.length).toBeGreaterThan(0);
});

test('Ask disabled is explained and Query remains available',async({page})=>{
 await boot(page);
 await expect(page.locator('#ask-btn')).toBeVisible();
 await expect(page.locator('#ask-btn')).toBeDisabled();
 expect((await run(page,peQuery)).context.length).toBeGreaterThan(0);
});

test('Ask simulated provider: actual trimmed context, grouped citations, safe Markdown and cache',async({page,request})=>{
 await request.post('/__test/control',{data:{enabled:true,context_cap:600}});
 await boot(page); await page.locator('input[name="policy"][value="whole_corpus"]').check();
 const data=await run(page,peQuery,'ask');account(data);
 const state=await(await request.get('/__test/state')).json();
 expect([...new Set(data.context.map(d=>d.doc_id))]).toEqual(state.calls[0].ids);
 expect(data.total_tokens).toBeLessThanOrEqual(600);
 expect(data.citations.some(c=>c.doc_id==='doc_999999'&&!c.valid)).toBe(true);
 await expect(page.locator('.ask-answer h2')).toHaveText('Simulated answer');
 await expect(page.locator('.ask-answer strong')).toHaveText('Test output');
 expect(await page.evaluate(()=>window.unsafeAnswer)).toBeUndefined();
 expect(await page.locator('.ask-answer script').count()).toBe(0);
 await shot(page,'ask-simulated');
 const cached=await run(page,peQuery,'ask'); expect(cached.cached).toBe(true);
 expect((await(await request.get('/__test/state')).json()).calls.length).toBe(1);
});

test('provider failure does not break subsequent retrieval',async({page,request})=>{
 await request.post('/__test/control',{data:{enabled:true,provider_error:true}});
 await boot(page);await page.locator('#query-input').fill(peQuery);
 const response=page.waitForResponse(r=>r.url().endsWith('/ask'));
 await page.locator('#ask-btn').click(); expect((await response).status()).toBe(502);
 await expect(page.locator('#results-section')).toContainText(/unavailable|provider|failed/i);
 expect((await run(page,peQuery)).context.length).toBeGreaterThan(0);
});

for(const width of [375,768,1024,1440]) for(const theme of ['light','dark'])
test(`responsive ${width}px ${theme}: Query, Compare, tutorial and keyboard`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(t=>localStorage.setItem('qt_theme',t),theme);
 await boot(page); await run(page,peQuery);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await shot(page,`query-${width}-${theme}`);
 await page.locator('#guide-button').focus(); await page.keyboard.press('Enter');
 await expect(page.locator('#tour-panel')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await shot(page,`tour-${width}-${theme}`);
 await page.locator('#tour-close').click();
 await nav(page,'compare').click();await run(page,peQuery,'compare');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await shot(page,`compare-${width}-${theme}`);
});

test('DOCX upload publishes tables and refreshes documents, counts, evals and Ask cache',async({page,request})=>{
 await request.post('/__test/control',{data:{enabled:true}});
 await boot(page);await login(page,'patricia');
 const first=await run(page,peQuery,'ask');
 const cached=await run(page,peQuery,'ask');expect(cached.cached).toBe(true);
 await nav(page,'evals').click(); await expect(page.locator('#evals-content')).toContainText(/complete/i);
 await nav(page,'admin').click();
 await page.locator('#admin-file').setInputFiles('tests/browser/fixtures/meridian-table.docx');
 await page.locator('#admin-title').fill('Meridian ARR observation update');
 await page.locator('#admin-date').fill('2024-06-01');
 await page.locator('#admin-min-role').selectOption('analyst');
 await page.locator('#admin-doc-type').selectOption('research_note');
 const response=page.waitForResponse(r=>r.url().endsWith('/ingest')&&r.request().method()==='POST');
 await page.locator('#admin-submit').click();expect((await response).status()).toBe(202);
 await expect(page.locator('#admin-status')).toContainText(/Indexed/i,{timeout:30000});
 await shot(page,'upload-complete');
 await nav(page,'documents').click();
 await expect(page.locator('#documents-section')).toContainText('Meridian ARR observation update');
 await nav(page,'single').click();
 const after=await run(page,peQuery,'ask');expect(after.cached).toBe(false);
 expect(after.execution.corpus_version).not.toBe(first.execution.corpus_version);
 expect(after.context.some(d=>d.content.includes('42 percent')&&d.content.includes('123 percent'))).toBe(true);
 const query=await run(page,peQuery);account(query);
 expect(query.context.some(d=>d.content.includes('observatory-meridian-table'))).toBe(true);
 await nav(page,'evals').click(); await expect(page.locator('#evals-content')).toContainText(/complete/i);
});

test('Audit exposes actor, effective role, workspace and stays workspace-scoped',async({page})=>{
 await boot(page); await login(page,'julia');await run(page,peQuery);
 await page.locator('#logout-btn').click();await login(page,'patricia');
 await nav(page,'audit').click();
 await expect(page.locator('#session-audit-content')).toContainText('julia');
 await expect(page.locator('#session-audit-content')).toContainText('pe-deal');
 await shot(page,'audit-admin');
 await page.locator('#workspace-picker').selectOption('saas-internal');
 await login(page,'alex');await run(page,saasQuery);await nav(page,'audit').click();
 await expect(page.locator('#session-audit-content')).toContainText('saas-internal');
 await expect(page.locator('#session-audit-content')).not.toContainText(peQuery);
});

test('no serious accessibility violations in both themes and tutorial',async({page})=>{
 const AxeBuilder=require('@axe-core/playwright').default;
 await boot(page);await run(page,peQuery);
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme) await page.locator('#theme-toggle').click();
  for(const tour of [false,true]){
   if(tour)await page.locator('#guide-button').click();
   const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   fs.writeFileSync(path.join(OUT,`accessibility-${theme}-${tour?'tour':'query'}.json`),JSON.stringify(results.violations,null,2));
   expect(results.violations.filter(v=>['critical','serious'].includes(v.impact))).toEqual([]);
   if(tour) await page.locator('#tour-close').click();
  }
 }
});

for(const [failure,state] of [['partial','incomplete'],['all','failed']])
test(`evaluations ${state}: real injected failures remain explicit`,async({page,request})=>{
 await request.post('/__test/control',{data:{evaluation_failure:failure}});
 await boot(page);
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/evals');
 await nav(page,'evals').click();const data=await(await response).json();
 expect(data.status).toBe(state);
 expect(data.aggregate.queries_failed).toBe(failure==='all'?12:1);
 if(failure==='all')expect(data.aggregate.permission_violation_rate).toBeNull();
 await expect(page.locator('#evals-content')).toContainText(new RegExp(state,'i'));
 await expect(page.locator('#evals-content')).not.toContainText('Certified');
 await shot(page,`evaluation-${state}`);
});
