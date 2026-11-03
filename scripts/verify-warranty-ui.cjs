const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const deps = '/private/tmp/vfixurpc-ui-test/node_modules';
const esbuild = require(deps + '/esbuild');
const { chromium } = require('/Users/anujdakhara/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = '/private/tmp/vfixurpc-warranty-ui';
const coverage = { startsOn: '2026-09-01', endsOn: '2026-12-01', coverage: 'Original keyboard repair and labour only. Unrelated faults and new accidental damage are excluded.' };
const fixture = { coverage, active: true, canClaim: true, claims: [] };
const icons = require('../mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const bundles = {};
  for (const platform of ['mobile', 'admin']) {
    const apiMock = `const capture=(method,url,body)=>{window.calls.push({method,url,body});if(url.endsWith('/claims')){window.fixture.canClaim=false;window.fixture.claims=[{id:'claim',status:'REQUESTED',description:body.description,history:[{status:'REQUESTED',note:'Warranty follow-up requested',at:'2026-09-09T12:00:00Z'}]}];}return Promise.resolve({data:window.fixture});};export const api={get:async()=>({data:window.fixture}),post:(url,body)=>capture('POST',url,body),put:(url,body)=>capture('PUT',url,body),patch:(url,body)=>capture('PATCH',url,body)};export const getApiErrorMessage=()=> 'Could not send. Please retry.';`;
    const mocks = { '@/api/client': apiMock, '@/lib/api': apiMock, 'react-hot-toast': 'export default {success:()=>{},error:()=>{}};',
      '@expo/vector-icons': `import React from 'react';import {Text} from 'react-native';const glyphs=${JSON.stringify(icons)};export const Ionicons=({name,size,color})=><Text style={{fontFamily:'Ionicons',fontSize:size,color}}>{String.fromCodePoint(glyphs[name]||0)}</Text>;`,
      'expo-linear-gradient': `import React from 'react';import {View} from 'react-native';export const LinearGradient=({children,colors,style})=><View style={[style,{backgroundColor:colors[0]}]}>{children}</View>;` };
    const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Warranty from '@/components/WarrantyPanel';${platform === 'admin' ? "import Collection from '@/components/CustomerCollection';" : ''}createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><div style={{padding:20,maxWidth:720,margin:'0 auto',width:'100%',boxSizing:'border-box'}}><Warranty id="ticket" canManage={true} canIssue={true}/>${platform === 'admin' ? '<Collection id="ticket"/>' : ''}</div></QueryClientProvider>);`;
    bundles[platform] = (await esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: root + '/' + platform }, jsx: 'automatic', bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"test"' }, nodePaths: [deps, root + '/' + platform + '/node_modules'], alias: { react: deps + '/react', 'react-dom': deps + '/react-dom', 'react-native': deps + '/react-native-web' }, plugins: [{ name: 'fixture', setup(b) {
      b.onResolve({ filter: /.*/ }, args => { if (mocks[args.path]) return { path: args.path, namespace: 'fixture' }; if (args.path.startsWith('@/')) { const base = path.join(root, platform, 'src', args.path.slice(2)); return { path: [base + '.tsx', base + '.ts', base + '/index.ts'].find(fs.existsSync) }; } });
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root + '/' + platform }));
    } }] })).outputFiles[0].contents;
  }
  const staticDir = path.join(root, 'admin/.next/static');
  const cssFiles = [];
  const collectCss = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) collectCss(target);
      else if (entry.name.endsWith('.css')) cssFiles.push(target);
    }
  };
  collectCss(staticDir);
  const css = cssFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  const server = http.createServer((req, res) => {
    if (req.url === '/mobile.js' || req.url === '/admin.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(bundles[req.url.slice(1, -3)]); }
    if (req.url === '/icons.ttf') return res.end(fs.readFileSync(root + '/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
    const platform = req.url.startsWith('/admin') ? 'admin' : 'mobile';
    const state = structuredClone(fixture);
    if (req.url.includes('empty')) { state.coverage = null; state.active = false; state.canClaim = false; }
    if (req.url.includes('expired')) { state.active = false; state.canClaim = false; }
    if (req.url.includes('review')) state.claims = [{ id: 'claim', status: 'REQUESTED', description: 'The keyboard issue has returned after the original repair.', createdAt: '2026-09-09T12:00:00Z', coverageSnapshot: coverage, history: [{ status: 'REQUESTED', note: 'Warranty follow-up requested', at: '2026-09-09T12:00:00Z' }] }];
    res.setHeader('Content-Type', 'text/html'); res.end(`<style>${platform === 'admin' ? css : ''}@font-face{font-family:Ionicons;src:url('/icons.ttf')}html,body{margin:0;font-family:Arial;color:#111;background:white;}button,input,textarea,select{font:inherit}</style><div id="root"></div><script>window.fixture=${JSON.stringify(state)};window.calls=[];</script><script src="/${platform}.js"></script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => console.error('Fixture browser error: ' + error.message));
      await page.goto(url + '/mobile'); await page.getByText('Active coverage', { exact: true }).waitFor();
      await page.getByText('Request warranty follow-up', { exact: true }).click();
      await page.getByLabel('What issue has returned?').fill('The same keyboard issue has returned after repair.');
      await page.getByText('Submit follow-up', { exact: true }).click();
      await page.getByText('Your warranty follow-up has been received.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Request warranty follow-up', { exact: true }).count(), 0);
      assert.equal((await page.evaluate(() => window.calls))[0].url, '/service-requests/ticket/warranty/claims');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/mobile-${width}.png`, fullPage: true });
      await page.goto(url + '/mobile?expired'); await page.getByText('Outside coverage dates', { exact: true }).waitFor();
      assert.equal(await page.getByText('Request warranty follow-up', { exact: true }).count(), 0);
      await page.goto(url + '/admin?empty'); await page.getByRole('button', { name: 'Add warranty', exact: true }).click();
      await page.getByLabel('Starts on').fill('09/09/2026'); await page.getByLabel('Covered through').fill('09/12/2026'); await page.getByLabel('Coverage and exclusions').fill('Original repair and labour only.');
      await page.getByRole('button', { name: 'Issue warranty', exact: true }).click();
      await page.waitForFunction(() => window.calls.some(c => c.method === 'PUT'));
      assert.equal((await page.evaluate(() => window.calls))[0].body.endsOn, '2026-12-09');
      await page.getByRole('button', { name: 'Collected by customer', exact: true }).click(); await page.getByLabel('Received by').fill('Test Customer');
      await page.getByRole('button', { name: 'Confirm handover', exact: true }).click();
      await page.waitForFunction(() => window.calls.some(c => c.url.endsWith('/customer-collection')));
      await page.goto(url + '/admin?review'); await page.getByLabel('Update for customer').fill('Accepted. We will call to arrange the follow-up.');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/admin-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Save update', exact: true }).click();
      await page.waitForFunction(() => window.calls.some(c => c.method === 'PATCH'));
      assert.equal((await page.evaluate(() => window.calls))[0].body.status, 'IN_PROGRESS');
      await page.close();
    }
    console.log('PASS warranty UI: mobile claim, expired policy, admin date entry, customer collection and claim review at 320/390/1440px. Isolated fixtures only.');
  } finally {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({ path: output + '/last-screen.png', fullPage: true });
      console.log((await page.locator('body').innerText()).slice(0, 1500));
    }
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
