/* Isolated RNweb regression. Real screens, BookingProvider, api/session and preview logic.
 * Native navigation, safe areas, picker, file storage and sharing are explicit bridges.
 * No live backend requests, deployment, device testing or dependency changes.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const deps = process.env.UI_TEST_DEPS || '/private/tmp/vfixurpc-ui-test/node_modules';
const esbuild = require(path.join(deps, 'esbuild'));
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/Users/anujdakhara/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = process.env.BOOKING_UI_OUTPUT || '/private/tmp/vfixurpc-booking-preview-ui';
const catalog = require('../mobile/src/catalog/defaults.json');
const icons = require('../mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const imageBytes = fs.readFileSync(path.join(root, 'mobile/assets/icon.png'));
const png = imageBytes.toString('base64');
const upgradeLabels = catalog.find(c => c.id === 'upgrade').issues.map(i => i.label);
const longOptions = Array.from({ length: 24 }, (_, i) => `Choice ${String(i + 1).padStart(2, '0')}: Office workstation, development and editing requirements`);
const report = { scope: 'Chromium RNweb fixtures, not native Android/iOS or real service delivery', started: new Date().toISOString(), results: [], screenshots: [], sourceHashes: {}, bridges: ['native navigation', 'safe-area insets', 'SecureStore backing storage', 'picker', 'file cache + Image URI resolution', 'native sharing', 'native FormData file parts'] };
const sourceFiles = ['mobile/src/screens/book/Step2IssuesScreen.tsx', 'mobile/src/screens/book/Step3PickupScreen.tsx', 'mobile/src/context/BookingContext.tsx', 'mobile/src/components/AttachmentPreview.tsx', 'mobile/src/components/ServiceFields.tsx', 'mobile/src/screens/home/OrdersScreen.tsx'];
for (const file of sourceFiles) report.sourceHashes[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

const rnweb = path.join(deps, 'react-native-web/dist/index.js');
const mocks = {
  'react-native': `import React from 'react';import {Image as NativeImage} from ${JSON.stringify(rnweb)};export * from ${JSON.stringify(rnweb)};
    export const Image=React.forwardRef(({source,...props},ref)=>{const uri=source?.uri;const resolved=window.fileCache[uri]||(uri?.startsWith('file:///picker/')?'/fixture.png':uri);return <NativeImage ref={ref} source={uri?{...source,uri:resolved}:source} {...props}/>;});`,
  '@/context/AuthContext': `export const useAuth=()=>({user:{id:'fixture-user',name:'Asha Shah',phone:'+919999999999'}});`,
  '@react-navigation/native': `export const useNavigation=()=>window.testNavigation;`,
  'expo-constants': `export default {expoConfig:{}};`,
  'expo-crypto': `export const randomUUID=()=>crypto.randomUUID();`,
  'expo-secure-store': `export const getItemAsync=async k=>window.tokens[k]??null;export const setItemAsync=async(k,v)=>{window.tokens[k]=v;};export const deleteItemAsync=async k=>{delete window.tokens[k];};`,
  'expo-image-picker': `export const launchImageLibraryAsync=async options=>{window.pickerCalls.push(options);const next=window.pickerQueue.shift()??{canceled:true};if(next.error)throw new Error(next.error);return next;};`,
  'expo-file-system/legacy': `export const cacheDirectory='file:///cache/';export const EncodingType={Base64:'base64'};export const writeAsStringAsync=async(uri,data)=>{window.fileWrites.push(uri);window.fileCache[uri]='data:image/png;base64,'+data;};export const deleteAsync=async uri=>{window.fileDeletes.push(uri);delete window.fileCache[uri];};`,
  'expo-sharing': `export const isAvailableAsync=async()=>window.sharingAvailable;export const shareAsync=async(uri,options)=>{window.shareCalls.push({uri,options});if(window.shareError)throw new Error(window.shareError);};`,
  'expo-web-browser': `export const WebBrowserPresentationStyle={PAGE_SHEET:'pageSheet'};export const openBrowserAsync=async(url,options)=>{window.browserCalls.push({url,options});return{type:'dismiss'};};`,
  'react-native-safe-area-context': `import React from 'react';import {View} from 'react-native';export const useSafeAreaInsets=()=>window.insets;export const SafeAreaView=({style,...props})=><View {...props} style={[style,{paddingTop:window.insets.top,paddingBottom:window.insets.bottom}]}/>;`,
  '@expo/vector-icons': `import React from 'react';import {Text} from 'react-native';const glyphs=${JSON.stringify(icons)};export const Ionicons=({name,size,color})=><Text style={{fontFamily:'Ionicons',fontSize:size,color}}>{String.fromCodePoint(glyphs[name]||0)}</Text>;`,
  'expo-linear-gradient': `import React from 'react';import {View} from 'react-native';export const LinearGradient=({children,colors,style})=><View style={[style,{backgroundColor:colors[0]}]}>{children}</View>;`,
  'react-native-toast-message': `export default {show:message=>{window.toasts.push(message);window.dispatchEvent(new Event('fixture-toast'));}};`,
};

const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {View,Text} from 'react-native';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Step2 from '@/screens/book/Step2IssuesScreen';import Step3 from '@/screens/book/Step3PickupScreen';import {BookingProvider,useBooking} from '@/context/BookingContext';
import Fields from '@/components/ServiceFields';import Home from '@/screens/home/HomeScreen';import Orders from '@/screens/home/OrdersScreen';import RequestDetail from '@/screens/home/RequestDetailScreen';import TicketFiles from '@/components/TicketFiles';import {clearTokens} from '@/api/client';
import {srApi} from '@/api/client';const queryClient=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});window.clearTestSession=clearTokens;window.testCreateBooking=srApi.createBooking;
function Choices(){const [values,setValues]=React.useState({});return <View style={{flex:1,padding:16}}><Fields fields={[{id:'work',label:'Workstation requirements and intended usage',type:'multi',options:${JSON.stringify(longOptions)}}]} values={values} onChange={v=>{window.choiceValues=v;setValues(v);}}/></View>;}
function Screen(){const initial=new URLSearchParams(location.search).get('screen')||'Step2Issues';const [route,setRoute]=React.useState({name:initial,key:'draft-one',params:{categoryId:'upgrade'}});const booking=useBooking();
window.bookingState=booking;const nav={navigate:(name,params)=>{window.navigationCalls.push({name,params});setRoute({name,params,key:'route-'+name});},replace:(name,params)=>{window.navigationCalls.push({name,params});setRoute({name,params,key:'route-'+name});},goBack:()=>setRoute({name:'Orders',params:{},key:'back'}),popToTop:()=>setRoute({name:'Step2Issues',key:'draft-two',params:{categoryId:'upgrade'}}),getParent:()=>nav};window.testNavigation=nav;
return route.name==='fields'?<Choices/>:route.name==='Home'?<Home navigation={nav}/>:route.name==='Orders'?<Orders navigation={nav}/>:route.name==='RequestDetail'?<RequestDetail navigation={nav} route={route}/>:route.name==='files'?<View style={{flex:1,overflow:'auto',padding:16}}><TicketFiles id="fixture-ticket"/></View>:route.name==='Step3Pickup'?<Step3 navigation={nav} route={route}/>:route.name==='BookingSuccess'?<Text>Fixture booking success</Text>:<Step2 key={route.key} navigation={nav} route={route}/>;}
function Toasts(){const [text,setText]=React.useState('');React.useEffect(()=>{const cb=()=>setText(window.toasts.at(-1)?.text1||'');window.addEventListener('fixture-toast',cb);return()=>window.removeEventListener('fixture-toast',cb);},[]);return text?<div role="status" style={{position:'fixed',left:8,right:8,top:0,pointerEvents:'none',zIndex:1000,color:'#111',background:'#fff'}}>{text}</div>:null;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><BookingProvider><Screen/></BookingProvider><Toasts/></QueryClientProvider>);`;

async function build() {
  const compile = spawnSync('npm', ['run', 'type-check'], { cwd: path.join(root, 'mobile'), encoding: 'utf8' });
  report.compile = { status: compile.status, output: compile.stdout + compile.stderr };
  assert.equal(compile.status, 0, report.compile.output);
  return esbuild.build({ stdin: { contents: entry, loader: 'tsx', resolveDir: path.join(root, 'mobile') }, bundle: true, write: false, format: 'iife', metafile: true,
    loader: { '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"test"', 'process.env.EXPO_PUBLIC_API_URL': 'window.fixtureApiUrl' }, nodePaths: [deps, path.join(root, 'mobile/node_modules')],
    alias: { react: path.join(deps, 'react'), 'react-dom': path.join(deps, 'react-dom') }, plugins: [{ name: 'explicit-native-bridges', setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        if (mocks[args.path]) return { path: args.path, namespace: 'fixture' };
        if (args.path.startsWith('@/')) {
          const base = path.join(root, 'mobile/src', args.path.slice(2));
          const resolved = [base + '.tsx', base + '.ts', base + '/index.ts'].find(fs.existsSync);
          if (resolved) return { path: resolved };
        }
      });
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: path.join(root, 'mobile') }));
    } }] });
}

function baseRequest(index = 0) {
  return { id: 'fixture-ticket', serviceRequestNumber: `VFX-TEST-${index}`, ticketNumber: `VFX-TEST-${index}`, status: 'UNDER_REPAIR', serviceCategory: 'upgrade', serviceMode: 'PICKUP',
    device: { brand: 'Microsoft Surface', model: 'Long workstation model with a readable wrapping label' }, bookingAnswers: { brand: 'Microsoft Surface', model: 'Studio 2', requestedUpgrades: upgradeLabels.slice(0, 5) },
    issues: upgradeLabels.slice(0, 5).map((category, i) => ({ id: 'issue-' + i, category })), createdAt: '2026-09-14T10:00:00Z', pickupSlotDate: '2026-09-15', pickupSlotTime: '14:00 - 14:30', pickupAddress: 'Flat 402, Vile Parle West, Mumbai 400056', statusHistory: [], quoteItems: [] };
}

async function mockBackend(page, state) {
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1') { state.external.push(request.url()); return route.abort(); }
    if (!url.pathname.startsWith('/api/v1/')) return route.continue();
    const p = url.pathname.slice('/api/v1'.length);
    const method = request.method();
    const raw = request.postData();
    let body = raw;
    if (request.headers()['content-type']?.includes('application/json') && raw) body = JSON.parse(raw);
    const call = { method, path: p, body, authorization: request.headers().authorization };
    state.calls.push(call);
    let data;
    let status = 200;
    if (p === '/auth/refresh') { state.refreshes++; data = { accessToken: 'refreshed-access', refreshToken: 'refreshed-refresh' }; }
    else if (p === '/catalog') data = catalog;
    else if (p === '/devices' && method === 'POST') data = { id: 'legacy-device' };
    else if (p === '/devices') data = [];
    else if (p === '/notifications/unread-count') data = { count: 0 };
    else if (p === '/pickup-slots') data = [{ id: 'slot-1', startTime: '14:00', endTime: '14:30', isActive: true }];
    else if (p === '/places/autocomplete') data = { suggestions: [] };
    else if (p === '/places/business-profile') data = { placeId: 'fixture-place', name: 'VfixurPC', rating: 4.9, reviewCount: 303, writeReviewUrl: 'https://search.google.com/local/writereview?placeid=fixture-place', mapsUrl: 'https://www.google.com/maps/place/?q=place_id:fixture-place', reviews: [{ author: 'Dharmi Nandu', rating: 5, text: 'Easy, quick and fast service.', relativeTime: '4 days ago' }, { author: 'Prathmesh', rating: 5, text: 'Kind, professional and helpful.', relativeTime: '15 days ago' }] };
    else if (p === '/service-requests/bookings') {
      state.bookings.push(body);
      if (state.legacyBookings) { status = 404; data = { message: 'Cannot POST /service-requests/bookings' }; }
      else if (state.bookingFailure) { state.bookingFailure = false; status = 503; data = { message: 'Temporary fixture failure' }; }
      else data = { booking: { id: body.id, reference: 'BKG-FIXTURE' }, requests: body.requests.map((r, i) => ({ ...baseRequest(i), ...r, id: 'created-' + i })) };
    } else if (p === '/service-requests' && method === 'POST') {
      data = { ...baseRequest(), ...body, id: 'legacy-request', serviceRequestNumber: 'VFX-LEGACY', ticketNumber: 'VFX-LEGACY' };
    } else if (p === '/service-requests/my') {
      if (state.ordersError) { status = 503; data = { message: 'Fixture requests unavailable' }; }
      else data = Array.from({ length: 13 }, (_, i) => ({ ...baseRequest(i), id: 'ticket-' + i, status: i === 12 ? 'DELIVERED' : 'UNDER_REPAIR' }));
    } else if (p.endsWith('/warranty')) data = { coverage: null, claims: [], active: false, canClaim: false };
    else if (p.endsWith('/invoice')) {
      if (state.listError) { status = 503; data = { message: 'Fixture document list unavailable' }; }
      else data = [{ id: 'invoice-1', invoiceNumber: 'INV-FIXTURE', documentKind: 'Invoice' }];
    } else if (p.endsWith('/attachments') && method === 'POST') { state.uploads.push(call); data = { id: 'upload-1' }; }
    else if (p.endsWith('/attachments')) data = [{ id: 'image-1', mime: 'image/png', caption: 'Device condition image fixture', createdAt: '2026-09-14T10:00:00Z' }, { id: 'video-1', mime: 'video/mp4', caption: 'Device video fixture', createdAt: '2026-09-14T10:00:00Z' }];
    else if (/\/(file|pdf)$/.test(p)) {
      if (state.slowFile) await new Promise(resolve => setTimeout(resolve, 2500));
      if (state.denyFile) { status = state.denyFile; data = { message: 'Denied fixture' }; }
      else if (state.expireFile && request.headers().authorization !== 'Bearer refreshed-access') { status = 401; data = { message: 'Expired fixture token' }; }
      else return route.fulfill({ status: 200, contentType: p.endsWith('/pdf') ? 'application/pdf' : p.includes('video') ? 'video/mp4' : 'image/png', body: p.endsWith('/pdf') ? Buffer.from('%PDF-1.4 fixture') : imageBytes });
    } else if (/^\/service-requests\/[^/]+$/.test(p)) data = baseRequest();
    else { state.unhandled.push({ method, path: p }); status = 501; data = { message: 'Unmocked fixture endpoint' }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
}

async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))); });
}
async function screenshot(page, name) {
  await settle(page);
  const target = path.join(output, name + '.png');
  await page.screenshot({ path: target });
  report.screenshots.push(target);
}
async function contained(locator, page, message) {
  const viewport = page.viewportSize();
  const box = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${message}: ${JSON.stringify(box)}`);
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Horizontal document overflow');
}
async function wheelBottom(page) {
  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(150);
}
async function select(page, label, option) {
  await page.getByText(label, { exact: true }).locator('..').getByRole('button').click();
  await page.getByRole('radio').filter({ hasText: option }).click();
}
async function imageLoaded(page) {
  await page.waitForFunction(() => [...document.images].some(img => img.complete && img.naturalWidth > 1 && img.closest('[role="dialog"]')));
  await page.getByLabel('Loading image').waitFor({ state: 'hidden' });
}
const attachments = [{ uri: 'file:///picker/condition.png', fileName: 'Device condition image with a long readable filename.png', mimeType: 'image/png', width: 1024, height: 1024 }, { uri: 'file:///picker/issue.mp4', fileName: 'issue-video.mp4', mimeType: 'video/mp4', width: 640, height: 480 }];

async function fillStep2(page, labels) {
  await page.getByText('System Upgrade', { exact: true }).waitFor();
  await select(page, 'Device type (optional)', 'Desktop');
  await select(page, 'Brand (optional)', 'Microsoft Surface');
  await page.getByLabel('Model (optional)', { exact: true }).fill('Studio 2 workstation');
  await page.getByLabel('Current configuration (optional)', { exact: true }).fill('8 GB RAM, 256 GB SSD');
  await wheelBottom(page);
  for (const label of labels) await page.getByText(label, { exact: true }).click();
  await page.getByLabel('Additional details (optional)').fill('Keep existing files and quote each selected upgrade separately.');
}

async function fillStep3(page, prefix) {
  await page.getByText('Arrange your service', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enter manually', exact: true }).click();
  await page.getByLabel('Pickup address', { exact: true }).fill('Vile Parle West, Mumbai 400056');
  await page.getByLabel('Flat / house number, floor (optional)').fill('Flat 402, 4th floor');
  assert.equal(await page.getByRole('radio', { name: /^Booking date: Today,/ }).count(), 1, 'Today remains visible in the booking calendar');
  await page.getByRole('radio', { name: /^Booking date:/ }).nth(1).click();
  await page.getByText('2:00 PM – 2:30 PM', { exact: true }).click();
  await page.getByLabel('Additional instructions (optional)').fill('Call before arrival; use the side entrance.');
  if (prefix) {
    await page.getByText('Preferred date', { exact: true }).scrollIntoViewIfNeeded();
    await screenshot(page, prefix + '-calendar');
  }
  await page.getByText('Terms of Service', { exact: true }).click();
  const legalEnd = page.getByText('Website: www.vfixurpc.com', { exact: true });
  await legalEnd.scrollIntoViewIfNeeded();
  await contained(legalEnd, page, 'Terms remain scrollable through the final line');
  if (prefix) await screenshot(page, prefix + '-terms-bottom');
  await page.getByRole('dialog').getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('checkbox').filter({ hasText: 'I accept the Terms of Service, Privacy Policy and fees shown above' }).click();
  await page.getByText('Review booking', { exact: true }).click();
  await page.getByText('Review request', { exact: true }).waitFor();
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const bundle = await build();
  fs.writeFileSync(path.join(output, 'bundle-inputs.json'), JSON.stringify(Object.keys(bundle.metafile.inputs), null, 2));
  const server = http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(bundle.outputFiles[0].contents); }
    if (req.url === '/fixture.png') { res.setHeader('Content-Type', 'image/png'); return res.end(imageBytes); }
    if (req.url === '/icons.ttf') return res.end(fs.readFileSync(path.join(root, 'mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')));
    res.setHeader('Content-Type', 'text/html');
    res.end(`<style>@font-face{font-family:Ionicons;src:url('/icons.ttf')}html,body,#root{height:100%;margin:0}body{font-family:Arial;color:#fff}#root{display:flex;flex-direction:column}</style><div id="root"></div><script>window.fixtureApiUrl=location.origin+'/api/v1';</script><script src="/app.js"></script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const device of [
      { name: 'small-320x568', width: 320, height: 568, top: 20, bottom: 0 },
      { name: 'largeAndroid-430x932', width: 430, height: 932, top: 24, bottom: 24 },
      { name: 'iOS-sized-390x844', width: 390, height: 844, top: 47, bottom: 34 },
    ]) {
      async function run(name, test) {
        const page = await browser.newPage({ viewport: { width: device.width, height: device.height }, hasTouch: true, colorScheme: 'dark' });
        page.setDefaultTimeout(8000);
        const state = { calls: [], uploads: [], bookings: [], refreshes: 0, external: [], unhandled: [] };
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(({ top, bottom, png }) => {
          window.insets = { top, bottom, left: 0, right: 0 };
          window.tokens = { access_token: 'initial-access', refresh_token: 'fixture-refresh' };
          window.fileCache = {}; window.fileWrites = []; window.fileDeletes = []; window.shareCalls = []; window.browserCalls = [];
          window.sharingAvailable = true; window.shareError = ''; window.pickerCalls = []; window.pickerQueue = [];
          window.toasts = []; window.navigationCalls = []; window.choiceValues = {};
          const FormData = window.FormData;
          window.FormData = class extends FormData {
            append(key, value, filename) {
              if (value?.uri) return super.append(key, new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: value.type }), value.name);
              return filename === undefined ? super.append(key, value) : super.append(key, value, filename);
            }
          };
        }, { top: device.top, bottom: device.bottom, png });
        await mockBackend(page, state);
        const result = { viewport: device.name, test: name, status: 'pass' };
        try {
          await test(page, state, `${device.name}-${name}`);
          assert.deepEqual(errors, [], 'Browser runtime exceptions');
          assert.deepEqual(state.external, [], 'No external requests allowed');
          assert.deepEqual(state.unhandled, [], 'Unmocked backend requests');
          console.log('PASS', device.name, name);
        } catch (error) {
          result.status = 'fail'; result.error = error.message;
          console.error('FAIL', device.name, name, error.message);
          await screenshot(page, `${device.name}-${name}-FAIL`).catch(() => {});
          fs.writeFileSync(path.join(output, `${device.name}-${name}-FAIL.txt`), await page.locator('body').innerText().catch(() => 'No body'));
        } finally {
          result.calls = state.calls;
          result.runtimeErrors = errors;
          report.results.push(result);
          await page.close();
        }
      }

      await run('choices-scroll', async (page, state, prefix) => {
        await page.goto(base + '/?screen=fields');
        await page.getByText('Select', { exact: true }).click();
        const first = page.getByRole('checkbox').filter({ hasText: longOptions[0] });
        await first.waitFor(); await settle(page);
        assert.equal(await page.getByText('Done', { exact: true }).isVisible(), true, 'Done stays visible');
        const color = await page.getByText(longOptions[0], { exact: true }).evaluate(el => getComputedStyle(el).color);
        assert.notEqual(color, 'rgb(255, 255, 255)', 'Choices must remain readable in a dark host');
        await screenshot(page, prefix + '-top');
        await first.click();
        await wheelBottom(page);
        const last = page.getByRole('checkbox').filter({ hasText: longOptions.at(-1) });
        await contained(last, page, 'Wheel scroll reaches the last choice');
        await last.click();
        await screenshot(page, prefix + '-bottom');
        await page.getByText('Done', { exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.choiceValues.work), [longOptions[0], longOptions.at(-1)]);
        await noOverflow(page);
      });

      await run('booking-five-upgrades', async (page, state, prefix) => {
        await page.goto(base);
        await fillStep2(page, upgradeLabels.slice(0, 5));
        await page.evaluate(() => window.pickerQueue.push({ error: 'Permission denied' }));
        await page.getByText('Photos / short video (optional)', { exact: true }).click();
        await page.waitForFunction(() => window.toasts.some(t => /photos/.test(t.text1)));
        await page.evaluate(() => window.pickerQueue.push({ canceled: false, assets: window.fixtureAssets }), {});
        // Queue the actual native-shaped fixture after the denied picker path.
        await page.evaluate(assets => { window.pickerQueue = [{ canceled: false, assets }]; }, attachments);
        await page.getByText('Photos / short video (optional)', { exact: true }).click();
        await page.getByLabel('Preview attachment 1', { exact: true }).click();
        await imageLoaded(page);
        await contained(page.getByRole('button', { name: 'Close preview', exact: true }), page, 'Preview close button');
        await screenshot(page, prefix + '-step2-image');
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        await page.getByLabel('Preview attachment 2', { exact: true }).click();
        await page.getByText('Open in another app', { exact: true }).click();
        await page.waitForFunction(() => window.shareCalls.length === 1);
        assert.equal(await page.evaluate(() => window.shareCalls[0].options.mimeType), 'video/mp4');
        await screenshot(page, prefix + '-video');
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        await page.getByText('Photos / short video (optional)', { exact: true }).click();
        assert.equal(await page.getByLabel('Preview attachment 2', { exact: true }).count(), 1, 'Picker cancel preserves existing media');
        await contained(page.getByText('Continue', { exact: true }), page, 'Fixed Continue button');
        await screenshot(page, prefix + '-step2-bottom');
        await page.getByText('Continue', { exact: true }).click();
        const next = await page.evaluate(() => window.navigationCalls.find(c => c.name === 'Step3Pickup').params);
        assert.deepEqual(next.bookingAnswers.requestedUpgrades, upgradeLabels.slice(0, 5));
        assert.deepEqual(next.issues.map(i => i.category), upgradeLabels.slice(0, 5));
        assert.equal(next.media.length, 2);
        await fillStep3(page, prefix);
        await screenshot(page, prefix + '-review-top');
        for (const value of ['Studio 2 workstation', '8 GB RAM, 256 GB SSD', 'Requested upgrades', 'Flat 402, 4th floor, Vile Parle West', '+919999999999']) {
          assert((await page.locator('body').innerText()).includes(value), 'Review missing ' + value);
        }
        await page.getByText('Preview attachment 1', { exact: true }).click();
        await imageLoaded(page); await screenshot(page, prefix + '-review-image');
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        await page.getByText('Preview attachment 2', { exact: true }).scrollIntoViewIfNeeded();
        await screenshot(page, prefix + '-review-bottom');
        await noOverflow(page);
        state.bookingFailure = true;
        await page.getByText('Submit booking', { exact: true }).click();
        await page.getByText('Retry booking', { exact: true }).waitFor();
        await screenshot(page, prefix + '-retry');
        await page.getByText('Retry booking', { exact: true }).click();
        await page.getByText('Fixture booking success', { exact: true }).waitFor();
        assert.equal(state.bookings.length, 2);
        assert.deepEqual(state.bookings[0], state.bookings[1], 'Retry must use the same immutable booking payload and id');
        assert.deepEqual(state.bookings[1].requests[0].bookingAnswers.requestedUpgrades, upgradeLabels.slice(0, 5));
        assert.equal(state.uploads.length, 2);
        assert(state.uploads.every(c => c.path === '/service-requests/created-0/attachments'));
        assert.match(state.uploads[0].body, /filename="Device condition image with a long readable filename.png"/);
        assert.match(state.uploads[1].body, /filename="issue-video.mp4"/);
      });

      await run('all-upgrades-payload', async (page) => {
        await page.goto(base); await fillStep2(page, upgradeLabels);
        await page.getByText('Continue', { exact: true }).click();
        await page.getByText('Arrange your service', { exact: true }).waitFor();
        assert.deepEqual(await page.evaluate(() => window.navigationCalls[0].params.bookingAnswers.requestedUpgrades), upgradeLabels);
      });

      await run('legacy-single-booking-fallback', async (page, state) => {
        state.legacyBookings = true;
        await page.goto(base + '/?screen=fields');
        const result = await page.evaluate(async () => window.testCreateBooking({
          id: '0d94ee5e-c0c2-4d64-8e7b-0d9510b74dee',
          feePolicyVersion: '2026-09-14',
          feesAccepted: true,
          requests: [{
            newDevice: { brand: 'HP', model: 'Pavilion' },
            serviceCategory: 'laptop', serviceMode: 'PICKUP',
            bookingAnswers: {}, issues: [{ category: 'Battery' }],
            pickupSlotDate: '2026-09-16', pickupSlotTime: '14:00 - 14:30',
            pickupAddress: 'Fixture address', termsAccepted: true,
            policyVersion: '2026-08-31',
          }],
        }));
        assert.equal(result.booking.reference, 'VFX-LEGACY');
        assert.equal(result.requests[0].id, 'legacy-request');
        assert(state.calls.some(call => call.path === '/devices' && call.method === 'POST'));
        const legacyRequest = state.calls.find(call => call.path === '/service-requests' && call.method === 'POST');
        assert.equal(legacyRequest.body.deviceId, 'legacy-device');
        assert.equal('newDevice' in legacyRequest.body, false);

        const callsBeforeMulti = state.calls.length;
        const multiRejected = await page.evaluate(async () => {
          try {
            await window.testCreateBooking({ id: 'aa0eb355-df35-4d1a-aec1-8793617a2327', feePolicyVersion: '2026-09-14', feesAccepted: true, requests: [{}, {}] });
            return false;
          } catch { return true; }
        });
        assert.equal(multiRejected, true);
        assert.equal(state.calls.slice(callsBeforeMulti).filter(call => call.path === '/service-requests').length, 0, 'Multi-device booking must never split into legacy requests');
      });

      await run('requests-navigation', async (page, state, prefix) => {
        state.ordersError = true;
        await page.goto(base + '/?screen=Orders');
        await page.getByText('Could not load requests. Tap to retry.', { exact: true }).waitFor();
        await screenshot(page, prefix + '-error');
        state.ordersError = false;
        await page.getByText('Could not load requests. Tap to retry.', { exact: true }).click();
        await page.getByText('VFX-TEST-0', { exact: true }).waitFor();
        await screenshot(page, prefix + '-active');
        await wheelBottom(page);
        await contained(page.getByText('VFX-TEST-11', { exact: true }), page, 'Last active request reachable');
        await screenshot(page, prefix + '-bottom');
        await page.getByRole('tab', { name: 'History', exact: true }).click();
        await page.getByText('VFX-TEST-12', { exact: true }).waitFor();
        await screenshot(page, prefix + '-history');
        await page.getByRole('tab', { name: 'Active', exact: true }).click();
        await page.getByText('VFX-TEST-0', { exact: true }).click();
        await page.getByText('Requested upgrades', { exact: true }).waitFor();
        await screenshot(page, prefix + '-details');
        await noOverflow(page);
      });

      await run('home-google-reviews', async (page, state, prefix) => {
        await page.goto(base + '/?screen=Home');
        await page.getByText('303 Google reviews', { exact: true }).waitFor();
        await page.getByText('Easy, quick and fast service.', { exact: false }).scrollIntoViewIfNeeded();
        await screenshot(page, prefix + '-reviews');
        await page.getByText('Write a review', { exact: true }).click();
        await page.waitForFunction(() => window.browserCalls.length === 1);
        assert.match(await page.evaluate(() => window.browserCalls[0].url), /writereview/);
        await noOverflow(page);
      });

      await run('protected-preview-refresh', async (page, state, prefix) => {
        state.expireFile = true;
        await page.goto(base + '/?screen=files');
        await page.getByText('View full image', { exact: true }).click();
        await imageLoaded(page);
        assert.equal(state.refreshes, 1, '401 image requests share one refresh');
        assert(state.calls.some(c => c.path === '/attachments/image-1/file' && c.authorization === 'Bearer refreshed-access'));
        await screenshot(page, prefix + '-image');
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        await page.getByText('Invoice · INV-FIXTURE', { exact: true }).click();
        await page.getByText('Open in another app', { exact: true }).click();
        await page.waitForFunction(() => window.shareCalls.length > 0);
        assert.equal(await page.evaluate(() => window.shareCalls.at(-1).options.mimeType), 'application/pdf');
        assert.equal(await page.evaluate(() => window.shareCalls.at(-1).options.UTI), 'com.adobe.pdf');
        assert(state.calls.some(c => c.path === '/invoices/invoice-1/pdf' && c.authorization === 'Bearer refreshed-access'));
        await screenshot(page, prefix + '-pdf');
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        await page.getByText('View full image', { exact: true }).click(); await imageLoaded(page);
        await page.evaluate(() => window.clearTestSession());
        await page.getByRole('button', { name: 'Close preview', exact: true }).waitFor({ state: 'hidden' });
        await page.waitForFunction(() => Object.keys(window.fileCache).length === 0);
      });

      await run('preview-errors-cancel', async (page, state, prefix) => {
        state.denyFile = 403; state.listError = true;
        await page.goto(base + '/?screen=files');
        await page.getByText('You do not have permission to open this file.', { exact: true }).waitFor();
        await screenshot(page, prefix + '-denied');
        await page.getByText('View full image', { exact: true }).click();
        const previewDialog = page.getByRole('dialog');
        await previewDialog.getByRole('button', { name: 'Retry preview', exact: true }).waitFor();
        state.denyFile = 0;
        await previewDialog.getByRole('button', { name: 'Retry preview', exact: true }).click();
        await imageLoaded(page); await screenshot(page, prefix + '-retried');
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        state.listError = false;
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await page.getByText('Invoice · INV-FIXTURE', { exact: true }).waitFor();
        await page.getByText('Open video', { exact: true }).click();
        await page.evaluate(() => { window.sharingAvailable = false; });
        await page.getByText('Open in another app', { exact: true }).click();
        await page.getByText('Opening files is unavailable on this device.', { exact: true }).waitFor();
        await screenshot(page, prefix + '-unavailable');
        await page.evaluate(() => { window.sharingAvailable = true; window.shareError = 'No compatible viewer is installed.'; });
        await page.getByRole('button', { name: 'Retry opening file', exact: true }).click();
        await page.getByText('No compatible viewer is installed.', { exact: true }).waitFor();
        await page.evaluate(() => { window.shareError = ''; });
        await page.getByRole('button', { name: 'Retry opening file', exact: true }).click();
        await page.getByText('No compatible viewer is installed.', { exact: true }).waitFor({ state: 'hidden' });
        await page.waitForTimeout(100);
        const sharesBeforeCancel = await page.evaluate(() => window.shareCalls.length);
        assert(sharesBeforeCancel >= 1, 'A successful retry opens the native share sheet');
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        state.slowFile = true;
        await page.getByText('Open video', { exact: true }).click();
        await page.getByText('Open in another app', { exact: true }).click();
        await page.getByLabel('Preparing file').waitFor();
        const loadingShot = path.join(output, prefix + '-loading.png');
        await page.screenshot({ path: loadingShot });
        report.screenshots.push(loadingShot);
        await page.getByRole('button', { name: 'Close preview', exact: true }).click();
        await page.waitForTimeout(2700);
        assert.equal(await page.evaluate(() => window.shareCalls.length), sharesBeforeCancel, 'Closing pending download must not open sharing later');
      });
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    report.finished = new Date().toISOString();
    report.sourceChangedDuringRun = sourceFiles.filter(file => report.sourceHashes[file] !== crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'));
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Report: ${output}/report.json; ${report.screenshots.length} screenshots; ${report.results.filter(r => r.status === 'fail').length} failures.`);
    if (report.results.some(r => r.status === 'fail')) process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
