// Audit explanatory copy without counting controls, names or corpus data.
const {chromium} = require('@playwright/test');
const fs = require('fs');
const baseURL = process.env.QUERYTRACE_SMOKE_BASE_URL || 'http://localhost:8035';
const method = 'Guest, PE, Analyst, Full Policy, Ask enabled, fresh Query view, 1440×1000. All initial working-view explanatory blocks, including below the fold. Control labels, scenario titles, document content, role name, and access-count data excluded. Closed disclosure content excluded; necessary visible warnings counted. Alphabetic words counted; punctuation is not a word.';
function count(result) {
  result.method = method;
  result.rawWhitespaceTokens = result.parts.reduce((n,p) => n + p.text.split(/\s+/).length, 0);
  result.words = result.parts.reduce((n,p) => {
    const prose = p.text.replace(/\bAnalyst\b/g, '').replace(/Sees 6 of 16 docs[. ]*/g, '');
    return n + (prose.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
  }, 0);
  return result;
}
(async () => {
  const output = process.argv[2];
  if (!output) throw Error('Provide an output JSON path');
  let result;
  if (process.argv.includes('--recount')) result = JSON.parse(fs.readFileSync(output));
  else {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({viewport:{width:1440,height:1000}});
      await page.addInitScript(() => {
        localStorage.setItem('qt_tutorial_v1',JSON.stringify({status:'skipped'}));
        localStorage.setItem('qt_theme','light');
      });
      await page.goto(`${baseURL}/app/`);
      await page.locator('#identity-context').filter({hasText:'Analyst'}).waitFor();
      await page.evaluate(() => document.fonts.ready);
      result = await page.evaluate(() => {
        const selectors = ['.classification-line','.product-intro','#identity-context','#role-description','#policy-description','#policy-warning','#ask-availability','.empty-title','#empty-description','.empty-hint','.onboard-hint','.scenario-limit'];
        const parts = selectors.flatMap(selector => [...document.querySelectorAll(selector)]
          .filter(e => e.checkVisibility() && !e.closest('[hidden]') && !e.closest('details:not([open])'))
          .map(e => ({selector,text:e.innerText.trim()}))).filter(p => p.text);
        return {parts,queryTop:document.querySelector('#query-input').getBoundingClientRect().top};
      });
    } finally { await browser.close(); }
  }
  fs.writeFileSync(output,JSON.stringify(count(result),null,2)+'\n');
  console.log(`${result.words} instructional words; input top ${result.queryTop.toFixed(1)}px`);
})().catch(error => {console.error(error);process.exit(1);});
