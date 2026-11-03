const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const deps = '/private/tmp/vfixurpc-ui-test/node_modules';
const esbuild = require(deps + '/esbuild');
const { chromium } = require('/Users/anujdakhara/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const catalog = require('../mobile/src/catalog/defaults.json');
const icons = require('../mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
const output = '/private/tmp/vfixurpc-mobile-ui';
const fixture = {
  user: { id:'alice', name:'Asha Shah', email:'asha@example.test' }, catalog,
  orders: Array.from({length:12}, (_, i) => ({ id:'test-'+i, serviceRequestNumber:'VFX-TEST-'+i, status:'UNDER_REPAIR', device:{brand:'HP',model:'HP Pavilion'}, createdAt:'2026-09-09T12:00:00Z' })),
};
const mocks = {
  '@/context/AuthContext': `export const useAuth=()=>({user:window.fixture.user});`,
  '@/api/client': `export const srApi={list:async()=>window.fixture.orders}; export const placesApi={businessProfile:async()=>({placeId:'fixture',name:'VfixurPC',rating:4.9,reviewCount:302,writeReviewUrl:'https://example.com/write',mapsUrl:'https://example.com/maps',reviews:[{author:'Customer',rating:5,text:'Helpful and professional service.',relativeTime:'a week ago'}]})}; export const notificationsApi={unread:async()=>({count:2})}; export const api={get:async()=>({data:window.fixture.catalog})};`,
  '@react-navigation/native': `export const useNavigation=()=>({navigate:(...args)=>window.lastNotificationNavigation=args});`,
  'react-native-safe-area-context': `export const useSafeAreaInsets=()=>({top:24,bottom:0,left:0,right:0});`,
  '@expo/vector-icons': `import React from 'react';import {Text} from 'react-native';const glyphs=${JSON.stringify(icons)};export const Ionicons=({name,size,color})=><Text style={{fontFamily:'Ionicons',fontSize:size,color}}>{String.fromCodePoint(glyphs[name]||0)}</Text>;`,
  'expo-linear-gradient': `import React from 'react';import {View} from 'react-native';export const LinearGradient=({children,colors,style})=><View style={[style,{backgroundColor:colors[0]}]}>{children}</View>;`,
};
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const build=await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Home from '@/screens/home/HomeScreen';import Orders from '@/screens/home/OrdersScreen';import Fields from '@/components/ServiceFields';
    const nav={navigate:(...args)=>window.lastNavigation=args,getParent:()=>nav};
    function Choices(){const [values,setValues]=React.useState({});return <Fields fields={[{id:'location',label:'Location type',type:'select',options:['Home','Office','Shop','Other']}]} values={values} onChange={setValues}/>;}
    const screen=new URLSearchParams(location.search).get('screen');createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}>{screen==='fields'?<Choices/>:screen==='orders'?<Orders navigation={nav}/>:<Home navigation={nav}/>}</QueryClientProvider>);`,loader:'tsx',resolveDir:root+'/mobile'},bundle:true,write:false,format:'iife',loader:{'.png':'dataurl'},define:{'process.env.NODE_ENV':'"test"'},nodePaths:[deps,root+'/mobile/node_modules'],alias:{react:deps+'/react', 'react-dom':deps+'/react-dom', 'react-native':deps+'/react-native-web'},plugins:[{name:'test-native-bridges',setup(b){
    b.onResolve({filter:/.*/},args=>{if(mocks[args.path])return{path:args.path,namespace:'fixture'};if(args.path.startsWith('@/')){const base=path.join(root,'mobile/src',args.path.slice(2));return{path:[base+'.tsx',base+'.ts',base+'/index.ts'].find(fs.existsSync)};}});
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root+'/mobile'}));
    b.onResolve({filter:/^@\/theme$/},()=>({path:root+'/mobile/src/theme/index.ts'}));
  }}]});
  const server=http.createServer((req,res)=>{
    if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');return res.end(build.outputFiles[0].contents);}
    if(req.url==='/ionicons.ttf'){res.setHeader('Content-Type','font/ttf');return res.end(fs.readFileSync(root+'/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));}
    res.setHeader('Content-Type','text/html');res.end(`<style>@font-face{font-family:Ionicons;src:url('/ionicons.ttf')}html,body,#root{margin:0;height:100%;}body{color:#fff;font-family:Arial}#root{display:flex;flex-direction:column}</style><div id="root"></div><script>window.fixture=${JSON.stringify(fixture)}</script><script src="/app.js"></script>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const width of [320,390,430]){
      const page=await browser.newPage({viewport:{width,height:844},colorScheme:'dark'});
      await page.goto(url);await page.getByText('Hi Asha',{exact:true}).waitFor();await page.getByText('HP Pavilion',{exact:true}).first().waitFor();
      assert.equal(await page.getByText('Anuj',{exact:true}).count(),0);
      assert((await page.getByText('HP Pavilion',{exact:true}).count()) >= 1);
      const services=await page.getByText('What we fix',{exact:true}).boundingBox();const secondary=await page.getByText('Our services',{exact:true}).boundingBox();assert(services.y<secondary.y);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`${output}/home-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Laptop Repair',exact:true}).click();assert((await page.evaluate(()=>JSON.stringify(window.lastNavigation))).includes('laptop'));
      await page.goto(url+'/?screen=fields');await page.getByText('Select',{exact:true}).click();await page.getByRole('radio').filter({hasText:'Home'}).waitFor();
      const color=await page.getByText('Home',{exact:true}).evaluate(el=>getComputedStyle(el).color);assert.notEqual(color,'rgb(255, 255, 255)');
      await page.waitForFunction(() => Array.from(document.querySelectorAll('[role="radio"]')).some(el => { const r=el.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }));
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))); });
      await page.screenshot({path:`${output}/choices-${width}.png`,fullPage:true});
      await page.getByRole('radio').filter({hasText:'Office'}).click();await page.getByText('Office',{exact:true}).waitFor();
      await page.goto(url+'/?screen=orders');await page.getByText('VFX-TEST-0',{exact:true}).waitFor();await page.getByRole('tab',{name:'History'}).click();await page.getByText('No past requests').waitFor();
      await page.close();
    }
    console.log('PASS actual RN components via react-native-web: 320/390/430 widths, dark-theme choice text, selected value, signed-in greeting, service navigation, compact request summary and history. Native bridges/API are isolated fixtures, not device delivery tests.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
