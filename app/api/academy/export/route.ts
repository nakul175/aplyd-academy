import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {freshWorkspace} from '@/lib/academy-engine';
import {buildPersonalSnapshot} from '@/lib/academy-snapshot';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
export async function GET(){
 try{
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to export your personal practice lab.'},{status:401,headers});
  if(!env.DB)return Response.json({error:'Your personal practice lab is temporarily unavailable. Please retry.'},{status:503,headers});
  const row:any=await env.DB.prepare('SELECT data,revision,updated_at FROM academy_workspaces WHERE owner=?').bind(user.userId).first();
  const snapshot=await buildPersonalSnapshot({subjectId:user.userId,sourceRevision:row?.revision??0,saved:!!row,sourceUpdatedAt:row?.updated_at??null,snapshotJson:row?.data??JSON.stringify(freshWorkspace())});
  return Response.json(snapshot,{headers:{...headers,'Content-Disposition':'attachment; filename="aplyd-personal-snapshot.json"'}});
 }catch{return Response.json({error:'Your private snapshot could not be exported. No learning data was changed.'},{status:503,headers});}
}
