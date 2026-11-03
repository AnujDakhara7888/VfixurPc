const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const esbuild = require('/private/tmp/vfixurpc-ui-test/node_modules/esbuild');
const root = path.resolve(__dirname, '..');
const requireMobile = createRequire(root+'/mobile/package.json');
const axios = requireMobile('axios');
const turn = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const result = await esbuild.build({entryPoints:[root+'/mobile/src/api/client.ts'],bundle:true,write:false,format:'cjs',platform:'node',external:['axios'],plugins:[{name:'isolated-native-storage',setup(build){
    build.onResolve({filter:/^(expo-secure-store|expo-constants)$/}, args=>({path:args.path,namespace:'native-test'}));
    build.onLoad({filter:/.*/,namespace:'native-test'},args=>({loader:'js',contents:args.path==='expo-constants'?'export default {};':`const tokens=new Map();export const getItemAsync=async k=>tokens.get(k)||null;export const setItemAsync=async(k,v)=>{tokens.set(k,v)};export const deleteItemAsync=async k=>{tokens.delete(k)};`}));
  }}]});
  const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(requireMobile,mod,mod.exports);
  const {api,session}=mod.exports;
  const response=(config,data)=>({config,data,status:200,statusText:'OK',headers:{}});
  let finish;
  api.defaults.adapter=config=>new Promise(resolve=>{finish=()=>resolve(response(config,{name:'Alice'}));});
  await session.replace('alice-access','alice-refresh');
  const old=api.get('/users/me');const oldRejected=assert.rejects(old,error=>axios.isCancel(error));await turn();
  await session.replace('bob-access','bob-refresh');finish();await oldRejected;
  let refreshCalls=0;
  axios.defaults.adapter=async config=>{refreshCalls++;return response(config,{accessToken:'refreshed',refreshToken:'refreshed-r'});};
  api.defaults.adapter=async config=>{throw new axios.AxiosError('Unauthorized','ERR_BAD_REQUEST',config,null,{...response(config,{}),status:401});};
  await assert.rejects(api.post('/auth/login',{username:'bob',password:'wrong'}));assert.equal(refreshCalls,0);
  await session.replace('bob-access','bob-refresh');
  api.defaults.adapter=async config=>{
    if(!config._retry)throw new axios.AxiosError('Unauthorized','ERR_BAD_REQUEST',config,null,{...response(config,{}),status:401});
    return response(config,{ok:true});
  };
  axios.defaults.adapter=async config=>{refreshCalls++;await turn();return response(config,{accessToken:'fresh-bob',refreshToken:'fresh-r'});};
  await Promise.all([api.get('/one'),api.get('/two')]);assert.equal(refreshCalls,1);
  assert.equal(await session.get('access_token'),'fresh-bob');
  console.log('PASS actual Axios interceptors: old-account response discarded, wrong-password login never refreshes an old session, concurrent 401s share one refresh. No live API calls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
