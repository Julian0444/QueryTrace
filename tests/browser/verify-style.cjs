// Read-only production checks for the visual system and empty outcomes.
// Run with the same isolated checkout that serves QUERYTRACE_SMOKE_BASE_URL.
const {chromium, expect} = require('@playwright/test');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const baseURL = process.env.QUERYTRACE_SMOKE_BASE_URL || 'http://localhost:8025';
const out = process.env.QUERYTRACE_SMOKE_OUTPUT_DIR || 'docs/evidence/madethis-style/tests';
const query = "What is Meridian's ARR growth rate and net revenue retention?";
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch(), checks = [], errors = [], externalRequests = new Set();
  for (const theme of ['light', 'dark']) for (const width of [375, 768, 1024, 1440]) {
    const page = await browser.newPage({baseURL, colorScheme:theme, viewport:{width, height:1000}, reducedMotion:'reduce'});
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL).origin) externalRequests.add(request.url()); });
    await page.addInitScript(() => localStorage.setItem('qt_tutorial_v1', JSON.stringify({status:'skipped'})));
    await page.goto('/app/');
    await expect(page.locator('#identity-context')).toContainText('Analyst');
    await page.evaluate(() => document.fonts.ready);
    // Verify every local font and application entry point, not an assumed server.
    const assets = ['index.html', 'styles.css', 'app.js', ...fs.readdirSync('frontend/fonts').filter(name => name.endsWith('.woff2')).map(name => `fonts/${name}`)];
    for (const asset of assets) {
      const response = await page.request.get(`/app/${asset}`);
      expect(response.ok()).toBe(true);
      expect(hash(await response.body())).toBe(hash(fs.readFileSync(`frontend/${asset}`)));
    }
    const typography = await page.evaluate(() => ({
      background:getComputedStyle(document.body).backgroundColor,
      body:getComputedStyle(document.body).fontFamily,
      heading:getComputedStyle(document.querySelector('.product-intro h2')).fontFamily,
      loaded:[...document.fonts].filter(font => font.status === 'loaded').map(font => font.family),
    }));
    expect(typography.background).toBe(theme === 'light' ? 'rgb(252, 251, 247)' : 'rgb(33, 31, 32)');
    expect(typography.loaded).toEqual(expect.arrayContaining(['Inter', 'Inria Serif']));
    await page.locator('#query-input').focus();
    await page.keyboard.press('Tab');
    const focus = await page.locator('#submit-btn').evaluate(e => ({focused:document.activeElement === e, outline:getComputedStyle(e).outlineWidth, style:getComputedStyle(e).outlineStyle}));
    expect(focus).toEqual({focused:true, outline:'2px', style:'solid'});
    await expect(page.locator('#ask-btn')).toBeDisabled();
    const inputState = await page.locator('#submit-btn').evaluate(e => ({base:getComputedStyle(e).backgroundColor}));
    await page.locator('#submit-btn').hover();
    inputState.hover = await page.locator('#submit-btn').evaluate(e => getComputedStyle(e).backgroundColor);
    expect(inputState.hover).not.toBe(inputState.base);
    // Empty retrieval and comparison remain explained, with real open traces.
    await page.locator('#query-input').fill(query);
    await page.locator('.advanced-controls summary').click();
    await page.locator('#token-budget').fill('0');
    await page.locator('#submit-btn').click();
    await expect(page.locator('[data-result-status="budget_exhausted"]')).toBeVisible();
    await expect(page.locator('.trace-panel.open')).toBeVisible();
    await page.locator('.mode-btn[data-mode="compare"]').click();
    await page.locator('#submit-btn').click();
    await expect(page.locator('.compare-col')).toHaveCount(3);
    await expect(page.locator('[data-policy="full_policy"] .trace-panel.open')).toBeVisible();
    const columns = await page.locator('.compare-col').evaluateAll(nodes => nodes.map(n => ({policy:n.dataset.policy, x:n.getBoundingClientRect().x, width:n.getBoundingClientRect().width})));
    expect(columns.map(c => c.policy)).toEqual(['naive_top_k', 'permission_aware', 'full_policy']);
    if (width === 1440) expect(new Set(columns.map(c => c.x)).size).toBe(3);
    await page.locator('#guide-button').click();
    if (width === 1440) {
      const positions = await page.locator('.compare-col').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
      expect(positions).toEqual(columns.map(c => c.width));
      const boxes = await page.evaluate(() => ({guide:document.querySelector('#tour-panel').getBoundingClientRect().bottom, query:document.querySelector('#query-form').getBoundingClientRect().top}));
      expect(boxes.guide).toBeLessThan(boxes.query);
    }
    await expect(page.locator('#tour-next')).toBeInViewport();
    await page.locator('#tour-close').click();
    await page.locator('.mode-btn[data-mode="single"]').click();
    await page.locator('#token-budget').fill('2048');
    await page.locator('#query-input').fill('How do I bake a chocolate cake with buttercream frosting?');
    await page.locator('#submit-btn').click();
    await expect(page.locator('[data-result-status="insufficient_evidence"]')).toBeVisible();
    await expect(page.locator('.trace-panel.open')).toBeVisible();
    await page.locator('.result-heading').evaluate(e => e.scrollIntoView({block:'start'}));
    if (width === 375 && theme === 'dark') await page.screenshot({path:path.join(out, 'empty-375-dark.png')});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.locator('#workspace-picker').selectOption('saas-internal');
    await expect(page.locator('#identity-context')).toContainText('Employee');
    await expect(page.locator('#executed-query')).toHaveCount(0);
    checks.push({width, theme, typography, focus, inputState, columns, emptyOutcomes:['budget_exhausted', 'insufficient_evidence'], workspaceChanged:true});
    await page.close();
  }
  expect(errors).toEqual([]);
  expect([...externalRequests]).toEqual([]);
  fs.writeFileSync(path.join(out,'style-checks.json'),JSON.stringify({baseURL,checks,errors,externalRequests:[...externalRequests]},null,2));
  await browser.close();
  console.log('8 style/empty-state checks passed: OS themes, local font loading, served file hashes, keyboard focus, hover, disabled Ask, empty Query/Compare, desktop Guide geometry, workspace clearing; no external runtime requests or console/page errors.');
})().catch(error => {console.error(error);process.exit(1);});
