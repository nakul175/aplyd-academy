/** Pure public-verification policy. Rows come from the caller; nothing here reads a database or the network. */
import {isCredentialToken,publicProjection,type PublicCredential} from './academy-credential';
export type StoredRow=Readonly<{data:string}>;
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** A credential is public ONLY while the learner's own share flag is on (record.share, or credentialShare when no record exists yet). */
export function sharedCredentialOf(e:any,token:string):any{
 if(!plain(e)||!plain(e.credential)||e.credential.id!==token)return null;
 const shared=e.record?e.record.share===true:e.credentialShare===true;
 return shared?e.credential:null;
}
function enrollmentsOf(parsed:any):any[]{
 if(!plain(parsed))return [];
 const own=Array.isArray(parsed.enrollments)?parsed.enrollments:[];
 const team=Array.isArray(parsed.learners)?parsed.learners.flatMap((l:any)=>Array.isArray(l?.state?.enrollments)?l.state.enrollments:[]):[];
 return [...own,...team];
}
/** Uniform result: a public projection or null. Unknown, malformed, unshared and unreadable all look the same. */
export function lookupPublicCredential(token:unknown,rows:readonly StoredRow[],now:string):PublicCredential|null{
 if(!isCredentialToken(token))return null;
 for(const row of rows){
  let parsed:unknown;try{parsed=JSON.parse(row.data)}catch{continue}
  for(const e of enrollmentsOf(parsed)){const c=sharedCredentialOf(e,token);if(c)return publicProjection(c,now)}
 }
 return null;
}
export const NOT_FOUND_BODY={error:'No shared demo credential matches this link.'} as const;
export const PUBLIC_HEADERS={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'} as const;
