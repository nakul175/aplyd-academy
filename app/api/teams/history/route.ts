import {recordRefusal} from '@/lib/access-refusal-audit';
import {env} from '@/lib/platform-env';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {member,Team} from '@/lib/academy-teams';
import {RuleError} from '@/lib/academy-engine';
export const dynamic='force-dynamic';
const response=(x:any,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){try{
 const u=await getChatGPTUser();if(!u)throw new RuleError('Sign in to read workspace history.',401);if(!env.DB)throw new RuleError('Workspace history is temporarily unavailable.',503);
 const url=new URL(request.url),id=url.searchParams.get('teamId'),raw=url.searchParams.get('before'),before=raw===null?Number.MAX_SAFE_INTEGER:Number(raw);if(!id||!Number.isSafeInteger(before)||before<1)throw new RuleError('Choose a workspace and valid history cursor.',400);
 const snapshot=await env.DB.batch([env.DB.prepare('SELECT data,revision FROM academy_teams WHERE id=?').bind(id),env.DB.prepare('SELECT revision,data,created_at FROM academy_team_history WHERE team_id=? AND revision<? ORDER BY revision DESC LIMIT 6').bind(id,before)]),row:any=snapshot[0].results[0];if(!row)throw new RuleError('Workspace not found.',404);const t=JSON.parse(row.data) as Team,m=member(t,u.userId),admin=m.roles.includes('admin'),mod=m.roles.includes('moderator');if(!admin&&!mod)throw new RuleError('Workspace history requires a current owner or scoped moderator.',403);
 const rows=snapshot[1],packets=rows.results.slice(0,5).map((r:any)=>{const p=JSON.parse(r.data);return {revision:r.revision,archivedAt:r.created_at,activity:admin?p.activity:[],moderation:mod?p.moderation.filter((x:any)=>m.scopes.includes(x.cohortId)):[]}});
 return response({asOfRevision:row.revision,packets,nextBefore:rows.results.length>5?packets.at(-1)?.revision:null});
 }catch(e){if(e instanceof RuleError){await recordRefusal(request,e.status);return response({error:e.message},e.status)};console.error('Academy history read failed');return response({error:'Could not open archived workspace history.'},503)}}
