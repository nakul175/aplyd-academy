/**
 * DEMO verifiable credential. The issuer is a DUMMY: a fixed, public demo key signs the
 * credential so tamper detection and lifecycle can be exercised. It is NOT a real certifying
 * body, NOT accredited, and a signature here proves only "unchanged since the demo issued it".
 * Pure and synchronous (HMAC-SHA256 in plain code so the sync engine can mint it); no network.
 */
export const DEMO_ISSUER='DUMMY issuer (demo key, not a real certifying body)';
export const DEMO_MARK='DEMO / not accredited';
export const DEMO_NOTICE='This is a demonstration credential. It is not a certificate, not accredited, and not issued by a real certifying body.';
// Public on purpose: a demo key. Anyone can read it, so it can never establish real trust.
const DEMO_KEY='aplyd-academy/DUMMY-issuer/demo-key-v1/public-not-a-secret';
export const CREDENTIAL_TTL_DAYS=365;
export type CredentialLabel='participation'|'completion'|'competence';
export type CredentialStatus='active'|'suspended'|'revoked'|'expired';
export type CredentialAction='issue'|'correct'|'suspend'|'revoke'|'expire'|'reinstate';
export type CredentialRole='learner'|'reviewer'|'admin'|'system';
export type CredentialActor={id:string;role:CredentialRole;name?:string};
export type CredentialEvent={id:string;at:string;action:CredentialAction;actor:CredentialActor;reason:string;from:CredentialStatus|null;to:CredentialStatus;cause:'manual'|'appeal'|'time'|'evidence';before?:string;after?:string;chain:string};
export type Credential={v:1;id:string;label:CredentialLabel;issuer:'DUMMY';recordId:string;pathwayTitle:string;pathwayEdition:string;issuedAt:string;expiresAt:string;status:CredentialStatus;version:number;sig:string;history:CredentialEvent[]};
export class CredentialError extends Error{constructor(message:string,public status=409){super(message);this.name='CredentialError'}}
export const LABEL_RANK:Record<CredentialLabel,number>={participation:1,completion:2,competence:3};
export const LABEL_MEANING:Record<CredentialLabel,string>={
 participation:'Took part in the pathway. No assessment of learning is claimed.',
 completion:'Finished every lesson of the pathway. No assessed practical work is claimed.',
 competence:'Practical work was passed in a human review against the published rubric. Not a professional qualification.'};

// ---- SHA-256 / HMAC (synchronous) ----
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(data:Uint8Array):Uint8Array{
 const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
 const len=data.length,padded=new Uint8Array(((len+9+63)>>6)<<6);padded.set(data);padded[len]=0x80;
 const dv=new DataView(padded.buffer);dv.setUint32(padded.length-8,Math.floor(len/0x20000000));dv.setUint32(padded.length-4,(len<<3)>>>0);
 const w=new Uint32Array(64),rotr=(x:number,n:number)=>(x>>>n)|(x<<(32-n));
 for(let o=0;o<padded.length;o+=64){
  for(let i=0;i<16;i++)w[i]=dv.getUint32(o+i*4);
  for(let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}
  let [a,b,c,d,e,f,g,hh]=h;
  for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(hh+S1+ch+K[i]+w[i])>>>0,S0=rotr(a,2)^rotr(a,13)^rotr(a,22),mj=(a&b)^(a&c)^(b&c),t2=(S0+mj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}
  h[0]+=a;h[1]+=b;h[2]+=c;h[3]+=d;h[4]+=e;h[5]+=f;h[6]+=g;h[7]+=hh;
 }
 const out=new Uint8Array(32),odv=new DataView(out.buffer);for(let i=0;i<8;i++)odv.setUint32(i*4,h[i]);return out;
}
const utf8=(s:string)=>new TextEncoder().encode(s);
const hex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export function hmacSha256Hex(key:string,message:string):string{
 let k:Uint8Array=utf8(key);if(k.length>64)k=sha256(k);const ipad=new Uint8Array(64).fill(0x36),opad=new Uint8Array(64).fill(0x5c);
 for(let i=0;i<k.length;i++){ipad[i]^=k[i];opad[i]^=k[i]}
 const m=utf8(message),inner=sha256(Uint8Array.from([...ipad,...m]));return hex(sha256(Uint8Array.from([...opad,...inner])));
}
const mac=(s:string)=>hmacSha256Hex(DEMO_KEY,s);
/** Seal = signed fields + current history head + status, re-made at every transition, so truncation or a status edit breaks it. */
const seal=(c:Credential)=>mac(signed(c)+'|'+(c.history.at(-1)?.chain??'')+'|'+c.status);
function equalConst(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}

// ---- tokens ----
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const TOKEN_PATTERN=/^acv_[A-Za-z0-9_-]{32}$/;
export const isCredentialToken=(v:unknown):v is string=>typeof v==='string'&&TOKEN_PATTERN.test(v);
export function newCredentialToken(random:(n:number)=>Uint8Array=n=>crypto.getRandomValues(new Uint8Array(n))):string{
 const b=random(32);let s='';for(let i=0;i<32;i++)s+=B64[b[i]&63];return 'acv_'+s; // 192 bits
}

// ---- canonical forms ----
const signed=(c:Pick<Credential,'v'|'id'|'label'|'issuer'|'recordId'|'pathwayTitle'|'pathwayEdition'|'issuedAt'|'expiresAt'|'version'>)=>JSON.stringify([c.v,c.id,c.label,c.issuer,c.recordId,c.pathwayTitle,c.pathwayEdition,c.issuedAt,c.expiresAt,c.version]);
const eventBody=(e:Omit<CredentialEvent,'chain'>)=>JSON.stringify([e.id,e.at,e.action,e.actor.id,e.actor.role,e.actor.name??null,e.reason,e.from,e.to,e.cause,e.before??null,e.after??null]);
function append(c:Credential,e:Omit<CredentialEvent,'chain'>){const prev=c.history.at(-1)?.chain??c.id;c.history.push({...e,chain:mac(prev+'|'+eventBody(e))})}
const iso=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const eventId=()=>crypto.randomUUID();

// ---- evidence -> label ----
export type Evidence={lessonsDone:number;lessonsTotal:number;humanPass:boolean};
export function labelFromEvidence(x:Evidence):CredentialLabel|null{
 if(x.humanPass)return 'competence';
 if(x.lessonsTotal>0&&x.lessonsDone>=x.lessonsTotal)return 'completion';
 if(x.lessonsDone>0)return 'participation';
 return null;
}

export type IssueInput={recordId:string;label:CredentialLabel;pathwayTitle:string;pathwayEdition:string;now:string;ttlDays?:number;token?:string};
export function issue(i:IssueInput):Credential{
 if(!iso(i.now)||!(i.label in LABEL_RANK))throw new CredentialError('The credential cannot be issued from this evidence.',422);
 const ttl=i.ttlDays??CREDENTIAL_TTL_DAYS;if(!Number.isFinite(ttl)||ttl<=0||ttl>3650)throw new CredentialError('Choose a validity of 1 to 3650 days.',422);
 const base={v:1 as const,id:i.token??newCredentialToken(),label:i.label,issuer:'DUMMY' as const,recordId:i.recordId,pathwayTitle:i.pathwayTitle,pathwayEdition:i.pathwayEdition,issuedAt:new Date(i.now).toISOString(),expiresAt:new Date(Date.parse(i.now)+ttl*86400000).toISOString(),version:1};
 const c:Credential={...base,status:'active',sig:'',history:[]};
 append(c,{id:eventId(),at:c.issuedAt,action:'issue',actor:{id:'system:demo-issuer',role:'system'},reason:'Issued from saved evidence by the DUMMY demo issuer.',from:null,to:'active',cause:'evidence',after:i.label});
 c.sig=seal(c);return c;
}

/** Status as it should be shown now: expiry is time-based and never depends on a write having happened. */
export function effectiveStatus(c:Credential,now:string):CredentialStatus{
 if(c.status==='revoked')return 'revoked';
 if(c.status==='expired'||Date.parse(now)>=Date.parse(c.expiresAt))return 'expired';
 return c.status;
}

export type Transition={action:Exclude<CredentialAction,'issue'|'expire'>|'expire';actor:CredentialActor;reason:string;now:string;cause?:'manual'|'appeal'|'time'|'evidence';label?:CredentialLabel;maxLabel?:CredentialLabel|null};
const human=(a:CredentialActor)=>(a.role==='reviewer'||a.role==='admin')&&typeof a.id==='string'&&a.id.length>0&&!a.id.startsWith('system:');
const sys=(a:CredentialActor)=>a.role==='system'&&a.id.startsWith('system:');
/** Returns a NEW credential; history is append-only and never shortened. */
export function transition(original:Credential,t:Transition):Credential{
 const c=structuredClone(original),now=t.now;if(!iso(now))throw new CredentialError('The lifecycle time is invalid.',422);
 const cur=effectiveStatus(c,now),reason=typeof t.reason==='string'?t.reason.trim():'';
 const permitted=t.action==='expire'?sys(t.actor):human(t.actor)||(sys(t.actor)&&t.cause==='appeal'&&(t.action==='suspend'||t.action==='reinstate'))||(sys(t.actor)&&t.cause==='evidence'&&t.action==='correct');
 if(!permitted)throw new CredentialError('Only an assigned reviewer or workspace admin can change a credential.',403);
 if(t.action!=='expire'&&human(t.actor)&&(reason.length<10||reason.length>1000))throw new CredentialError('Give a reason of 10 to 1000 characters. It is kept in the credential history.',422);
 if(sys(t.actor)&&(reason.length<1||reason.length>1000))throw new CredentialError('A system lifecycle change needs a recorded reason.',422);
 const ev=(action:CredentialAction,to:CredentialStatus,extra:Partial<CredentialEvent>={})=>append(c,{id:eventId(),at:new Date(now).toISOString(),action,actor:t.actor,reason,from:cur==='expired'&&c.status!=='expired'?c.status:c.status,to,cause:t.cause??'manual',...extra});
 switch(t.action){
  case 'expire':{if(c.status==='revoked'||c.status==='expired')throw new CredentialError('This credential is already closed.',409);if(Date.parse(now)<Date.parse(c.expiresAt))throw new CredentialError('This credential has not reached its expiry.',409);ev('expire','expired',{cause:'time'});c.status='expired';break}
  case 'suspend':{if(cur!=='active')throw new CredentialError('Only an active credential can be suspended.',409);ev('suspend','suspended');c.status='suspended';break}
  case 'reinstate':{if(c.status!=='suspended'||cur==='expired')throw new CredentialError('Only a suspended credential that has not expired can be reinstated. Revoked and expired credentials stay closed.',409);ev('reinstate','active');c.status='active';break}
  case 'revoke':{if(cur==='revoked')throw new CredentialError('This credential is already revoked.',409);ev('revoke','revoked');c.status='revoked';break}
  case 'correct':{if(!t.label||!(t.label in LABEL_RANK))throw new CredentialError('Choose the corrected label.',422);if(cur!=='active'&&cur!=='suspended')throw new CredentialError('Only an active or suspended credential can be corrected.',409);if(t.label===c.label)throw new CredentialError('The label is already '+c.label+'.',409);if(!t.maxLabel||LABEL_RANK[t.label]>LABEL_RANK[t.maxLabel])throw new CredentialError('The saved evidence does not support that label.',409);const before=c.label;ev('correct',c.status,{before,after:t.label});c.label=t.label;c.version++;break}
  default:throw new CredentialError('Unknown credential action.',422);
 }
 c.sig=seal(c);return c;
}

/** Integrity only: signature over issued fields, status consistent with history, history chain intact. */
export type Integrity={ok:boolean;problems:string[]};
export function verifyIntegrity(c:unknown):Integrity{
 const problems:string[]=[];const x=c as Credential;
 if(!x||typeof x!=='object'||x.v!==1||!isCredentialToken(x.id)||!Array.isArray(x.history)||typeof x.sig!=='string')return {ok:false,problems:['malformed']};
 if(x.issuer!=='DUMMY')problems.push('issuer');
 if(!(x.label in LABEL_RANK)||!['active','suspended','revoked','expired'].includes(x.status)||!iso(x.issuedAt)||!iso(x.expiresAt))problems.push('fields');
 else if(!equalConst(seal(x),x.sig))problems.push('signature');
 let prev=x.id,last:CredentialStatus|null=null;
 for(const e of x.history){const {chain,...body}=e;if(typeof chain!=='string'||!equalConst(mac(prev+'|'+eventBody(body)),chain)){problems.push('history');break}prev=chain;last=e.to}
 if(!x.history.length||x.history[0].action!=='issue')problems.push('history');
 if(last!==x.status)problems.push('status');
 return {ok:problems.length===0,problems};
}

// ---- public projection ----
export type PublicCredential={credentialId:string;label:CredentialLabel;labelMeaning:string;pathway:string;edition:string;issuedAt:string;expiresAt:string;status:CredentialStatus;statusNote:string;integrity:'intact'|'failed';issuer:string;mark:string;notice:string;lastChange:{action:CredentialAction;at:string}|null};
const NOTE:Record<CredentialStatus,string>={active:'Active: current and unchanged, as a demonstration credential.',suspended:'SUSPENDED: temporarily not valid while a review is outstanding.',revoked:'REVOKED: withdrawn and no longer valid.',expired:'EXPIRED: past its validity date and no longer current.'};
/** The only shape that may leave the private workspace: no name, email, user id, record id, evidence or actors. */
export function publicProjection(c:Credential,now:string):PublicCredential{
 const status=effectiveStatus(c,now),integrity=verifyIntegrity(c).ok,last=c.history.at(-1);
 return {credentialId:c.id,label:c.label,labelMeaning:LABEL_MEANING[c.label],pathway:c.pathwayTitle,edition:c.pathwayEdition,issuedAt:c.issuedAt,expiresAt:c.expiresAt,status,statusNote:integrity?NOTE[status]:'INTEGRITY CHECK FAILED: this credential was altered after issue and must not be relied on.',integrity:integrity?'intact':'failed',issuer:DEMO_ISSUER,mark:DEMO_MARK,notice:DEMO_NOTICE,lastChange:last?{action:last.action,at:last.at}:null};
}
/** Owner-only view: includes the history with reasons and actors. */
export const ownerView=(c:Credential,now:string)=>({...publicProjection(c,now),history:c.history.map(({id,at,action,actor,reason,cause,before,after})=>({id,at,action,actorRole:actor.role,actorName:actor.name,reason,cause,before,after}))});
