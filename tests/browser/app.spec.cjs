const {test, expect}=require('@playwright/test');
const fs=require('fs');
const path=require('path');
const OUT=path.resolve(process.env.QUERYTRACE_TEST_OUTPUT_DIR || 'docs/evidence/after');
fs.mkdirSync(OUT,{recursive:true});
const peQuery="What is Meridian's ARR growth rate and net revenue retention?";
const saasQuery='What is the current on-call escalation process and database failover procedure?';
const nav=(page,mode)=>page.locator(`.mode-btn[data-mode="${mode}"]`);

async function boot(page,{host='localhost',workspace='pe-deal',welcome=false}={}) {
  if(!welcome) await page.addInitScript(()=>{if(!localStorage.getItem('qt_tutorial_v1'))localStorage.setItem('qt_tutorial_v1',JSON.stringify({status:'skipped',step:0}))});
  await page.addInitScript(ws=>{if(!sessionStorage.getItem('qt_workspace'))sessionStorage.setItem('qt_workspace',ws)},workspace);
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
  await expect(page.locator('#signin-btn')).toBeVisible();
  await page.locator('#signin-btn').click();
  await page.locator(`[data-username="${username}"]`).click();
  await expect(page.locator('#logout-btn')).toBeVisible();
}
function account(data) {
  const t=data.decision_trace,m=t.metrics;
  expect(m.included_count).toBe(data.context.length);
  expect(t.included.reduce((n,d)=>n+d.token_count,0)).toBe(data.total_tokens);
  expect(t.total_tokens).toBe(data.total_tokens);
  expect(m.blocked_count+m.included_count+m.dropped_count+(m.prompt_excluded_count||0)).toBe(m.retrieved_count);
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
 await page.keyboard.press('Escape');
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
   await page.locator(`label:has(input[name="role"][value="${role}"])`).click();
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
 await page.locator(`label:has(input[name="role"][value="${roles[0]}"])`).click();
 const comparison=await run(page,query,'compare');
 expect(comparison.role).toBe(roles[0]);
 Object.values(comparison.results).forEach(account);
 expect(comparison.results.naive_top_k.context.length).toBeLessThanOrEqual(8);
 const dl=page.waitForEvent('download'); await page.locator('#export-compare').click();
 const download=await dl; const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 expect(exported).toEqual(comparison);
 await shot(page,`${workspace}-compare`);
 await page.locator('#compare-banner').evaluate(el=>el.scrollIntoView({block:'start'}));
 await shot(page,`${workspace}-compare-results`);
});

for(const host of ['localhost','127.0.0.1']) for(const [workspace,username,role] of [
 ['pe-deal','julia','analyst'],['pe-deal','victoria','vp'],['pe-deal','patricia','partner'],
 ['saas-internal','sofia','employee'],['saas-internal','marcos','manager'],['saas-internal','alex','exec'],
]) test(`${host}: ${username} login, enforced role, reload and logout`,async({page})=>{
 await boot(page,{host,workspace}); await login(page,username);
 const data=await run(page,workspace==='pe-deal'?peQuery:saasQuery);
 expect(data.decision_trace.user_context.role).toBe(role); account(data);
 await expect(page.locator('#identity-context')).not.toContainText('Simulating');
 expect(data.execution.simulated).toBe(false);
 const meta=await(await page.request.get(`http://${host}:8011/workspaces/${workspace}/meta`)).json();
 const count=meta.roles.find(r=>r.name===role).docs_visible;
 await expect(page.locator('#role-description')).toContainText(`Sees ${count} of ${meta.total_docs}`);
 await page.reload(); await expect(page.locator('#logout-btn')).toBeVisible();
 expect((await(await page.request.get(`http://${host}:8011/me`)).json()).username).toBe(username);
 await page.locator('#logout-btn').click();
 await expect(page.locator('#logout-btn')).not.toBeVisible();
 expect((await page.request.get(`http://${host}:8011/me`)).status()).toBe(401);
});

test('admin manual role and scenario role agree with API; workspace change clears context',async({page})=>{
 await boot(page); await login(page,'patricia');
 await nav(page,'compare').click();
 await page.locator('label:has(input[name="role"][value="analyst"])').click();
 const data=await run(page,peQuery,'compare'); expect(data.role).toBe('analyst');
 expect(data.results.full_policy.decision_trace.metrics.blocked_count).toBeGreaterThan(0);
 await expect(page.locator('#identity-context')).toContainText(/patricia|Patricia/);
 await expect(page.locator('#identity-context')).toContainText('Simulating document role: Analyst');
 expect(data.results.full_policy.execution.simulated).toBe(true);
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
 await page.locator('.advanced-controls summary').click();
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
 await boot(page); await page.locator('.advanced-controls summary').click();
 await page.locator('input[name="policy"][value="whole_corpus"]').check();
 const data=await run(page,peQuery,'ask');account(data);
 const state=await(await request.get('/__test/state')).json();
 expect([...new Set(data.context.map(d=>d.doc_id))]).toEqual(state.calls[0].ids);
 expect(data.total_tokens).toBeLessThanOrEqual(600);
 expect(data.citations.some(c=>c.doc_id==='doc_999999'&&!c.valid)).toBe(true);
 await expect(page.getByRole('heading',{name:'Simulated answer'})).toHaveText('Simulated answer');
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
 await page.locator('#executed-query').evaluate(el=>el.scrollIntoView({block:'start'}));
 await shot(page,`query-results-${width}-${theme}`);
 await page.locator('#guide-button').focus(); await page.keyboard.press('Enter');
 await expect(page.locator('#tour-panel')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await shot(page,`tour-${width}-${theme}`);
 for(let step=1;step<6;step++){
   await page.locator('#tour-next').click();
   const box=await page.locator('#tour-next').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(900);
   if(step===1||step===4)await shot(page,`tour-step${step+1}-${width}-${theme}`);
 }
 await page.locator('#tour-close').click();
 await nav(page,'compare').click();await run(page,peQuery,'compare');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await shot(page,`compare-${width}-${theme}`);
 await page.locator('#compare-banner').evaluate(el=>el.scrollIntoView({block:'start'}));
 await shot(page,`compare-results-${width}-${theme}`);
 for(const mode of ['documents','evals']){
   await nav(page,mode).click();
   await expect(page.locator(mode==='documents'?'#documents-section':'#evals-content')).not.toContainText('Loading');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   await shot(page,`${mode}-${width}-${theme}`);
 }
 await page.locator('#signin-btn').click();await expect(page.locator('#login-screen')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await shot(page,`login-${width}-${theme}`);
 await page.locator('[data-username="patricia"]').click();await expect(page.locator('#logout-btn')).toBeVisible();
 await nav(page,'admin').click();await expect(page.locator('#admin-submit')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await shot(page,`upload-${width}-${theme}`);
});

test('DOCX upload publishes tables and refreshes documents, counts, evals and Ask cache',async({page,request})=>{
 await request.post('/__test/control',{data:{enabled:true}});
 await boot(page);await login(page,'patricia');
 const first=await run(page,peQuery,'ask');
 const cached=await run(page,peQuery,'ask');expect(cached.cached).toBe(true);
 await page.locator('#guide-button').click();
 await page.locator('#tour-next').click();await page.locator('#tour-next').click();
 await page.locator('#tour-action').click();
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
 await page.locator('#tour-close').click();
 await expect(page.locator('#executed-query')).toHaveCount(0);
 await nav(page,'admin').click();await shot(page,'upload-complete');
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

for(const workspace of ['pe-deal','saas-internal'])
test(`scenario buttons execute their declared role and policy in ${workspace}`,async({page})=>{
 await boot(page,{workspace});
 const descriptors=await page.locator('.example-btn:visible:not(:disabled)').evaluateAll(nodes=>nodes.map(n=>({query:n.dataset.query,role:n.dataset.role,mode:n.dataset.mode||'single'})));
 expect(descriptors.length).toBeGreaterThan(0);
 for(const scenario of descriptors){
   await page.reload();await expect(page.locator('#identity-context')).toContainText('Guest');
   const endpoint=scenario.mode==='compare'?'compare':'query';
   const target=page.locator('.example-btn').filter({visible:true});
   const all=await target.all();
   let matched;
   for(const item of all)if(await item.getAttribute('data-query')===scenario.query && (await item.getAttribute('data-mode')||'single')===scenario.mode){matched=item;break;}
   expect(matched).toBeTruthy();
   const response=page.waitForResponse(r=>new URL(r.url()).pathname===`/${endpoint}`&&r.request().method()==='POST');
   await matched.click();const data=await(await response).json();
   expect(data.query).toBe(scenario.query);
   if(endpoint==='compare'){expect(data.role).toBe(scenario.role);Object.values(data.results).forEach(account);}
   else {expect(data.decision_trace.user_context.role).toBe(scenario.role);account(data);}
 }
});

test('tour explicitly loads, runs and traces a real scenario, then restores prior work',async({page,request})=>{
 await boot(page);const prior=await run(page,peQuery);
 await page.locator('#query-input').fill('Keep this draft');
 await page.locator('#guide-button').click();
 await page.locator('#tour-next').click();await page.locator('#tour-next').click();
 await page.locator('#tour-action').click();
 const example=await page.locator('#query-input').inputValue();expect(example).not.toBe('Keep this draft');
 // The action only loads a scenario. Running it remains an explicit user action.
 expect((await(await request.get('/__test/state')).json()).calls).toHaveLength(0);
 await run(page,example);
 await page.locator('#tour-next').click();
 const comparison=page.waitForResponse(r=>new URL(r.url()).pathname==='/compare'&&r.request().method()==='POST');
 await page.locator('#tour-action').click();
 const compared=await(await comparison).json();
 const blocked=new Set(compared.results.full_policy.decision_trace.blocked_by_permission.map(d=>d.doc_id));
 expect(compared.results.naive_top_k.context.some(d=>blocked.has(d.doc_id))).toBe(true);
 await page.locator('#tour-next').click();await page.locator('#tour-action').click();
 await expect(page.locator('[data-policy="full_policy"] .trace-body')).toBeVisible();
 await expect(page.locator('[data-policy="full_policy"] .record-table')).toContainText('Blocked');
 await expect(page.locator('[data-policy="naive_top_k"] .trace-body')).not.toBeVisible();
 await page.locator('#tour-close').click();
 await expect(page.locator('#query-input')).toHaveValue('Keep this draft');
 await expect(page.locator('#executed-query')).toContainText(prior.query);
 expect((await(await request.get('/__test/state')).json()).calls).toHaveLength(0);
});

for (const ending of ['finish','exit']) test(`first-time guide ${ending} keeps real query and comparison results`,async({page,request})=>{
 await boot(page,{welcome:true});
 await page.locator('#tour-start').click();
 await page.locator('#tour-next').click();await page.locator('#tour-next').click();
 await page.locator('#tour-action').click();
 const example=await page.locator('#query-input').inputValue();
 const result=await run(page,example);
 await page.locator('#tour-next').click();
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/compare'&&r.request().method()==='POST');
 await page.locator('#tour-action').click();
 const comparison=await(await response).json();
 const boxes=await page.locator('.compare-col').evaluateAll(cols=>cols.map(c=>({x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y})));
 expect(boxes).toHaveLength(3);
 expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
 expect(boxes[2].x).toBeGreaterThan(boxes[1].x);
 expect(Math.max(...boxes.map(b=>b.y))-Math.min(...boxes.map(b=>b.y))).toBeLessThan(2);
 const blocked=new Set(comparison.results.full_policy.decision_trace.blocked_by_permission.map(d=>d.doc_id));
 const leaks=new Set(comparison.results.naive_top_k.context.filter(d=>blocked.has(d.doc_id)).map(d=>d.doc_id));
 await expect(page.locator('.comparison-finding')).toContainText(`Top-k includes ${leaks.size} document${leaks.size === 1 ? "" : "s"}`);
 await page.locator('#tour-next').click();await page.locator('#tour-action').click();
 await expect(page.locator('[data-policy="full_policy"] .trace-body')).toBeVisible();
 if(ending==='finish'){
   await page.locator('#tour-next').click();await page.locator('#tour-action').click();
   await page.locator('#tour-next').click();
 } else await page.locator('#tour-close').click();
 await expect(page.locator('#tour-panel')).not.toBeVisible();
 await expect(page.locator('#query-input')).toHaveValue(example);
 await nav(page,'single').click();
 await expect(page.locator('#executed-query')).toHaveText(result.query);
 await page.locator('.result-details').first().locator('summary').click();
 const first=result.context[0];
 await expect(page.locator('.ranking-note').first()).toContainText(((first.score+first.freshness_score)/2).toFixed(3));
 await nav(page,'compare').click();
 await expect(page.locator('.compare-col')).toHaveCount(3);
 await nav(page,'audit').click();
 const table=page.locator('.audit-table');await expect(table).toBeVisible();
 expect(await table.evaluate(t=>t.getBoundingClientRect().width<=t.parentElement.clientWidth+1)).toBe(true);
 await expect(table).toContainText('Effective role:');
 expect((await(await request.get('/__test/state')).json()).calls).toHaveLength(0);
});

test('private BYOC login uses credentials form without publishing hints',async({page})=>{
 await boot(page,{workspace:'private-test'});
 await expect(page.locator('#login-screen')).toBeVisible();
 await expect(page.locator('#guest-link')).not.toBeVisible();
 await expect(page.locator('#persona-cards')).not.toContainText('must-not-be-published');
 await page.locator('#login-username').fill('private-reader');
 await page.locator('#login-password').fill('local-test-password');
 await page.locator('#login-submit').click();
 await expect(page.locator('#logout-btn')).toBeVisible();
 const data=await run(page,'How do I align the observatory telescope?');
 expect(data.context.length).toBeGreaterThan(0);
 expect(data.execution.identity).toBe('private-reader');
});

test('keyboard-only role, query, trace and tutorial controls remain usable',async({page})=>{
 await boot(page);
 await page.locator('input[name="role"][value="analyst"]').focus();
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('input[name="role"][value="vp"]')).toBeChecked();
 await page.locator('#query-input').focus(); await page.keyboard.type(peQuery);
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/query');
 await page.keyboard.press('Enter');const data=await(await response).json();expect(data.execution.effective_role).toBe('vp');
 await page.locator('.trace-toggle').focus();await page.keyboard.press('Enter');
 await expect(page.locator('.trace-body')).toBeVisible();
 await page.keyboard.press('Tab');await expect(page.locator('.record-table-wrap')).toBeFocused();
 await page.locator('#guide-button').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#tour-title')).toBeFocused();
 await page.keyboard.press('Tab');await expect(page.locator('#tour-action')).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.locator('#tour-panel')).not.toBeVisible();
 await expect(page.locator('#guide-button')).toBeFocused();
});

test('Ask without trim and zero context use truthful provider accounting',async({page,request})=>{
 await request.post('/__test/control',{data:{enabled:true}});await boot(page);
 const answer=await run(page,peQuery,'ask');account(answer);
 expect(answer.context_trimmed).toBe(false);expect(answer.selected_total_tokens).toBe(answer.total_tokens);
 expect(answer.prompt_excluded).toHaveLength(0);
 const empty=await run(page,'How do I bake a chocolate cake?','ask');account(empty);
 expect(empty.model).toBe('not_called');expect(empty.usage.input_tokens).toBe(0);
 expect((await(await request.get('/__test/state')).json()).calls).toHaveLength(1);
 await expect(page.locator('.trace-panel')).toBeVisible();
});

test('Query service failure shows actionable error then recovers',async({page})=>{
 await boot(page);
 await page.route('**/query',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Test service temporarily unavailable; retry.'})}));
 await page.locator('#query-input').fill(peQuery);await page.locator('#submit-btn').click();
 await expect(page.locator('#results-section')).toContainText(/unavailable|retry/i);
 await page.unroute('**/query');expect((await run(page,peQuery)).context.length).toBeGreaterThan(0);
});

test('exports match Query, Ask, evaluation and scoped audit responses',async({page,request})=>{
 await request.post('/__test/control',{data:{enabled:true}});await boot(page);
 async function exportJSON(selector){const event=page.waitForEvent('download');await page.locator(selector).click();return JSON.parse(fs.readFileSync(await(await event).path(),'utf8'));}
 const query=await run(page,peQuery);expect(await exportJSON('#export-single')).toEqual(query);
 const answer=await run(page,peQuery,'ask');expect(await exportJSON('#export-single')).toEqual(answer);
 const evalResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/evals');await nav(page,'evals').click();
 const evaluation=await(await evalResponse).json();expect(await exportJSON('#export-evals')).toEqual(evaluation);
 await shot(page,'evaluation-complete');
 const auditResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/session-audit');await nav(page,'audit').click();
 const audit=await(await auditResponse).json();expect(await exportJSON('#export-audit')).toEqual(audit);
 await expect(page.locator('#session-audit-content')).toContainText('Ask');
 expect(audit.entries.some(e=>e.kind==='ask'&&e.decision_trace.total_tokens===answer.total_tokens)).toBe(true);
});

test('a role change during an in-flight request cannot restore the previous role result',async({page})=>{
 await boot(page);
 let release;const barrier=new Promise(resolve=>release=resolve);
 await page.route('**/query',async route=>{await barrier;await route.continue();});
 await page.locator('#query-input').fill(peQuery);await page.locator('#submit-btn').click();
 await page.locator('label:has(input[name="role"][value="vp"])').click();
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/query');release();await response;
 await expect(page.locator('#results-section')).toContainText(/changed|current settings/i);
 await expect(page.locator('#executed-query')).toHaveCount(0);
 await page.unroute('**/query');const data=await run(page,peQuery);expect(data.execution.effective_role).toBe('vp');
});

test('administrative capability cannot bypass a lower document role',async({page})=>{
 await boot(page,{workspace:'private-test'});
 await page.locator('#login-username').fill('private-admin');
 await page.locator('#login-password').fill('local-test-password');await page.locator('#login-submit').click();
 await expect(page.locator('#logout-btn')).toBeVisible();
 await expect(page.locator('input[name="role"][value="owner"]')).toBeDisabled();
 await expect(page.locator('input[name="policy"][value="naive_top_k"]')).toBeDisabled();
 for(const mode of ['compare','evals','audit'])await expect(nav(page,mode)).toBeDisabled();
 await expect(nav(page,'admin')).toBeEnabled();
 expect((await page.request.get('/session-audit?workspace=private-test')).status()).toBe(403);
 expect((await page.request.get('/evals?workspace=private-test')).status()).toBe(403);
 const data=await run(page,'How do I align the observatory telescope?');expect(data.execution.effective_role).toBe('viewer');
});
