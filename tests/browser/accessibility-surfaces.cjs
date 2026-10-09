// Supplemental real-server accessibility checks for disclosed metadata and secondary screens.
const {chromium,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch(),checks=[];
 for(const theme of ['light','dark']){
  const context=await browser.newContext({baseURL:process.env.QUERYTRACE_SMOKE_BASE_URL||'http://localhost:8015',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(t=>{localStorage.setItem('qt_theme',t);localStorage.setItem('qt_tutorial_v1',JSON.stringify({status:'skipped'}));},theme);
  const page=await context.newPage();await page.goto('/app/');await expect(page.locator('#identity-context')).toContainText('Analyst');
  await page.locator('#query-input').fill("What is Meridian's ARR growth rate and net revenue retention?");await page.locator('#submit-btn').click();await expect(page.locator('.result-card').first()).toBeVisible();
  await page.locator('.result-details summary').first().focus();await page.keyboard.press('Enter');await expect(page.locator('.result-details .ranking-note').first()).toBeVisible();
  await page.screenshot({path:`docs/evidence/ui-polish/after/details-1440-${theme}.png`});
  async function check(state){const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();checks.push({state,theme,violations:a.violations});}
  await check('expanded context details');await page.locator('.trace-toggle').click();await check('expanded trace');
  for(const [mode,selector] of [['documents','.document-item'],['evals','.evaluation-status'],['audit','.audit-table']]){
   await page.locator(`.mode-btn[data-mode="${mode}"]`).click();await expect(page.locator(selector).first()).toBeVisible();await check(mode);
  }
  await page.locator('#signin-btn').click();await check('login');await context.close();
 }
 fs.writeFileSync('docs/evidence/ui-polish/tests/additional-accessibility.json',JSON.stringify(checks,null,2));
 expect(checks.flatMap(c=>c.violations)).toEqual([]);await browser.close();console.log('12 additional axe scans passed: expanded metadata, trace, Documents, Evaluations, Audit and login in both themes.');
})().catch(e=>{console.error(e);process.exit(1)});
