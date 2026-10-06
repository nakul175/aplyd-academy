import {env} from 'cloudflare:workers';
import {PartnerDummyError} from '@/lib/academy-partner-dummy';
import {handleInboundEnrol} from '@/lib/academy-partner-dummy-service';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const respond=(v:unknown,status=200)=>Response.json(v,{status,headers});
/** DUMMY partner inbound request. HMAC-authenticated; records a PENDING claim only. Creates no account and no enrolment. */
export async function POST(request:Request){
 try{
  if((request.headers.get('content-type')??'').split(';')[0].trim()!=='application/json')throw new PartnerDummyError('Use a JSON request.',415);
  const raw=await request.text();if(raw.length>2000)throw new PartnerDummyError('This request is too large.',413);
  if(!env.DB)throw new PartnerDummyError('Temporarily unavailable.',503);
  const out=await handleInboundEnrol(env.DB as any,raw,request.headers,Date.now());
  return respond(out.body,out.status);
 }catch(e){if(e instanceof PartnerDummyError)return respond({error:e.message},e.status);return respond({error:'The dummy-partner request could not be completed.'},503)}
}
