const {defineConfig}=require('@playwright/test');
const python=process.env.QUERYTRACE_TEST_PYTHON || 'python';
module.exports=defineConfig({
  testDir:'./tests/browser', testMatch:'**/*.spec.cjs',
  timeout:45000, expect:{timeout:10000}, workers:1, fullyParallel:false,
  reporter:[['list'],['json',{outputFile:'docs/evidence/after/browser-results.json'}],['html',{open:'never'}]],
  use:{baseURL:'http://localhost:8011', viewport:{width:1440,height:1000},
       trace:'retain-on-failure', screenshot:'only-on-failure', reducedMotion:'reduce'},
  webServer:{command:`"${python}" -m uvicorn tests.browser.server:app --host 127.0.0.1 --port 8011`,
             url:'http://127.0.0.1:8011/health',timeout:120000,reuseExistingServer:false},
});
