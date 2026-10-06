#!/usr/bin/env node
// DEMO Partner Registry: a FICTIONAL partner for Aplyd Academy demos. Zero dependencies.
// Binds to loopback only. Holds synthetic members in memory. No real organisation is involved.
//   node scripts/demo/dummy-partner.mjs            (PORT=8791, ACADEMY_URL=http://127.0.0.1:8787)
import http from 'node:http';
import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const DEMO_SECRET='DEMO-ONLY-shared-secret-aplyd-dummy-partner-v1';
const CONTRACT='aplyd.dummy-partner/1',WINDOW_MS=5*60*1000,MAX_BODY=8192;
export const MEMBERS=Object.freeze([
 {member_code:'DEMO-AAA001',cohort_code:'DEMO-COH-A1',status:'active'},
 {member_code:'DEMO-AAA002',cohort_code:'DEMO-COH-A1',status:'active'},
 {member_code:'DEMO-BBB001',cohort_code:'DEMO-COH-B2',status:'active'},
 {member_code:'DEMO-BBB002',cohort_code:'DEMO-COH-B2',status:'suspended'}]);
const LOOP_RE=/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const isLoop=a=>typeof a==='string'&&(a==='::1'||a==='::ffff:127.0.0.1'||LOOP_RE.test(a));
export const assertLoopbackHost=h=>{if(!(h==='::1'||LOOP_RE.test(h)))throw new Error('Refused: the dummy partner binds to loopback only.');};
const sign=(secret,ts,nonce,body)=>createHmac('sha256',secret).update(`${CONTRACT}.${ts}.${nonce}.${body}`).digest('hex');
function verify(secret,h,body,now){const ts=h['x-demo-timestamp'],nonce=h['x-demo-nonce'],sig=h['x-demo-signature'];
 if(!ts||!nonce||!sig)return 'missing';if(!/^\d{10,15}$/.test(ts)||Math.abs(now-Number(ts))>WINDOW_MS)return 'stale';if(!/^[a-zA-Z0-9_-]{16,64}$/.test(nonce))return 'bad-nonce';
 const want=Buffer.from(sign(secret,ts,nonce,body)),got=Buffer.from(String(sig));if(want.length!==got.length||!timingSafeEqual(want,got))return 'bad-signature';return null;}
const ALLOWED=['contract','member_code','pathway_id','edition','event_id','occurred_at','scopes','progress','completion','credential'];
const FORBIDDEN=/name|email|answer|evidence|score|feedback|practice|phone/i;
export function startDummyPartner({port=0,host='127.0.0.1',secret=DEMO_SECRET,academyUrl=null,now=()=>Date.now()}={}){
 try{assertLoopbackHost(host)}catch(e){return Promise.reject(e)}
 const receipts=[],events=new Map(),nonces=new Map();
 const send=(res,status,obj)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj))};
 const server=http.createServer(async(req,res)=>{
  try{
   if(!isLoop(req.socket.remoteAddress))return send(res,403,{error:'Loopback only.'});
   const url=new URL(req.url,'http://127.0.0.1');
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>MAX_BODY)return send(res,413,{error:'Too large.'});chunks.push(c)}
   const body=Buffer.concat(chunks).toString('utf8');
   if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true,label:'DEMO Partner Registry (DUMMY, loopback only)'});
   let m;
   if(req.method==='GET'&&(m=url.pathname.match(/^\/registry\/member\/([A-Za-z0-9-]{1,40})$/))){const member=MEMBERS.find(x=>x.member_code===m[1]);return member?send(res,200,{found:true,...member,label:'DUMMY synthetic member'}):send(res,404,{found:false})}
   if(req.method==='GET'&&url.pathname==='/receipts')return send(res,200,{label:'DUMMY partner receipts (memory only)',receipts});
   if(req.method==='POST'&&url.pathname==='/inbound/enrol'){
    // The partner asks Academy to enrol a member. Academy only records a PENDING claim.
    if(!academyUrl)return send(res,503,{error:'ACADEMY_URL is not set.'});
    let v;try{v=JSON.parse(body)}catch{return send(res,400,{error:'Invalid JSON.'})}
    const member=MEMBERS.find(x=>x.member_code===v?.member_code);if(!member||typeof v.pathway_id!=='string')return send(res,400,{error:'Unknown DEMO member or missing pathway_id.'});
    const out=JSON.stringify({member_code:member.member_code,cohort_code:member.cohort_code,pathway_id:v.pathway_id}),ts=String(now()),nonce=randomBytes(16).toString('hex');
    const u=new URL('/api/partner/enrol',academyUrl);if(!isLoop(u.hostname.replace(/^\[|\]$/g,'')))return send(res,400,{error:'Academy URL must be loopback.'});
    try{const r=await fetch(u,{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-demo-timestamp':ts,'x-demo-nonce':nonce,'x-demo-signature':sign(secret,ts,nonce,out)},body:out});return send(res,r.status,{academy_status:r.status,academy:await r.json().catch(()=>null)})}
    catch{return send(res,502,{error:'Academy not reachable on loopback.'})}
   }
   if(req.method==='POST'&&url.pathname==='/inbound/verify'){
    // The partner asks Academy what this member has authorised it to see (HMAC-signed over "verify:<code>").
    if(!academyUrl)return send(res,503,{error:'ACADEMY_URL is not set.'});
    let v;try{v=JSON.parse(body)}catch{return send(res,400,{error:'Invalid JSON.'})}
    const member=MEMBERS.find(x=>x.member_code===v?.member_code);if(!member)return send(res,400,{error:'Unknown DEMO member.'});
    const msg='verify:'+member.member_code,ts=String(now()),nonce=randomBytes(16).toString('hex'),u=new URL('/api/partner/verify/'+member.member_code,academyUrl);
    if(!isLoop(u.hostname.replace(/^\[|\]$/g,'')))return send(res,400,{error:'Academy URL must be loopback.'});
    try{const r=await fetch(u,{redirect:'error',headers:{'x-demo-timestamp':ts,'x-demo-nonce':nonce,'x-demo-signature':sign(secret,ts,nonce,msg)}});return send(res,r.status,{academy_status:r.status,academy:await r.json().catch(()=>null)})}
    catch{return send(res,502,{error:'Academy not reachable on loopback.'})}
   }
   if(req.method==='POST'&&url.pathname==='/callbacks/progress'){
    const bad=verify(secret,req.headers,body,now());if(bad)return send(res,401,{error:'Signature rejected.',reason:bad});
    const nonce=req.headers['x-demo-nonce'];for(const[k,t]of nonces)if(now()-t>2*WINDOW_MS)nonces.delete(k);
    if(nonces.has(nonce))return send(res,409,{error:'Replay rejected.'});nonces.set(nonce,now());
    let p;try{p=JSON.parse(body)}catch{return send(res,400,{error:'Invalid JSON.'})}
    if(!p||typeof p!=='object'||Array.isArray(p)||p.contract!==CONTRACT)return send(res,400,{error:'Unsupported contract.'});
    const keys=[...Object.keys(p),...Object.keys(p.progress??{}),...Object.keys(p.completion??{}),...Object.keys(p.credential??{})];
    if(Object.keys(p).some(k=>!ALLOWED.includes(k))||keys.some(k=>FORBIDDEN.test(k)))return send(res,400,{error:'Payload has fields this partner does not accept.'});
    if(!MEMBERS.some(x=>x.member_code===p.member_code))return send(res,404,{error:'Unknown DEMO member.'});
    if(typeof p.event_id!=='string')return send(res,400,{error:'event_id required.'});
    if(events.has(p.event_id))return send(res,200,{ok:true,duplicate:true,event_id:p.event_id});
    const r={event_id:p.event_id,member_code:p.member_code,scopes:p.scopes,received_at:new Date(now()).toISOString(),payload:p};events.set(p.event_id,r);receipts.push(r);
    return send(res,200,{ok:true,duplicate:false,event_id:p.event_id});
   }
   send(res,404,{error:'Not found.'});
  }catch{send(res,500,{error:'DUMMY partner error.'})}
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{const a=server.address();resolve({server,receipts,port:a.port,url:`http://${host.includes(':')?'['+host+']':host}:${a.port}`,close:()=>new Promise(r=>server.close(()=>r()))})})});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT??8791),host=process.env.HOST??'127.0.0.1';
 startDummyPartner({port,host,academyUrl:process.env.ACADEMY_URL??'http://127.0.0.1:8787'}).then(p=>console.log(`DEMO Partner Registry (DUMMY, loopback only) listening on ${p.url}\nSet ACADEMY_DUMMY_PARTNER_URL=${p.url} in Academy. No real organisation is contacted.`)).catch(e=>{console.error(e.message);process.exit(1)});
}
