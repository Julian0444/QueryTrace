// Real, non-mutating browser evidence. Run before and after against the same checkout.
const {chromium,expect}=require('@playwright/test');
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const baseURL=process.env.QUERYTRACE_SMOKE_BASE_URL||'http://localhost:8015';
const out=process.env.QUERYTRACE_SMOKE_OUTPUT_DIR||'docs/evidence/ui-polish/after';
const query="What is Meridian's ARR growth rate and net revenue retention?";
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch(); const report={baseURL,query,workspace:'pe-deal',role:'analyst',checks:[],errors:[],expectedAuthProbes:[]};
 for(const theme of ['light','dark']) for(const width of [375,768,1024,1440]){
  const page=await browser.newPage({baseURL,viewport:{width,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'){if(m.location().url.endsWith('/me') && m.text().includes('401'))report.expectedAuthProbes.push({url:m.location().url,status:401});else report.errors.push(m.text());}});
  await page.addInitScript(theme=>{localStorage.setItem('qt_theme',theme);localStorage.setItem('qt_tutorial_v1',JSON.stringify({status:'skipped',step:0}));},theme);
  await page.goto('/app/'); await expect(page.locator('#identity-context')).toContainText('Analyst');
  const css=await(await page.request.get('/app/styles.css')).body();
  expect(crypto.createHash('sha256').update(css).digest('hex')).toBe(crypto.createHash('sha256').update(fs.readFileSync('frontend/styles.css')).digest('hex'));
  async function shot(name,anchor){
   if(anchor)await page.locator(anchor).evaluate(e=>e.scrollIntoView({block:'start'}));else await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,`${name}-${width}-${theme}.png`),animations:'disabled'});
   const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   expect(dimensions.scroll,`${name} overflow at ${width}`).toBeLessThanOrEqual(width);
   report.checks.push({name,width,theme,overflow:false});
  }
  await shot('query');
  await page.locator('#query-input').fill(query);
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/query');await page.locator('#submit-btn').click();
  const data=await(await response).json();expect(data.context.length).toBeGreaterThan(0);
  await expect(page.locator('#executed-query')).toHaveText(query);await shot('results','.result-heading');
  await page.locator('.trace-toggle').click();await shot('trace','.trace-panel');
  await page.locator('.mode-btn[data-mode="compare"]').click();
  const comparison=page.waitForResponse(r=>new URL(r.url()).pathname==='/compare');await page.locator('#submit-btn').click();
  const c=await(await comparison).json();await expect(page.locator('.compare-col')).toHaveCount(3);await shot('compare','#compare-banner');
  if(width===1440 && out.endsWith('after')){
   const stats=await page.locator('.col-stats').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));
   expect(Math.max(...stats)-Math.min(...stats)).toBeLessThan(2);
  }
  for(const [mode,selector,text] of [['documents','#documents-content','Meridian'],['evals','#evals-content','12 / 12'],['audit','#session-audit-content','pe-deal']]){
   await page.locator(`.mode-btn[data-mode="${mode}"]`).click();await expect(page.locator(selector)).toContainText(text);await shot(mode);
  }
  await page.locator('.mode-btn[data-mode="single"]').click();await page.locator('#guide-button').click();await shot('guide');await page.locator('#tour-close').click();
  await page.locator('#signin-btn').click();await shot('login');const loginResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/login');await page.locator('[data-username="patricia"]').click();const login=await loginResponse;if(login.status()===429){await page.waitForTimeout(61000);await page.locator('[data-username="patricia"]').click();}await expect(page.locator('#logout-btn')).toBeVisible();
  await page.locator('.mode-btn[data-mode="admin"]').click();await shot('upload');
  await page.close();
  report.comparison={topKTokens:c.results.naive_top_k.total_tokens,fullTokens:c.results.full_policy.total_tokens};
 }
 expect(report.errors).toEqual([]);
 if(!out.endsWith('before'))expect(report.expectedAuthProbes).toEqual([]);
 fs.writeFileSync(path.join(out,'matrix.json'),JSON.stringify(report,null,2));await browser.close();console.log(`${report.checks.length} real UI checks passed; CSS matches checkout; no unexpected page/console errors or viewport overflow (${report.expectedAuthProbes.length} expected unauthenticated /me 401 probes recorded).`);
})().catch(e=>{console.error(e);process.exit(1)});
