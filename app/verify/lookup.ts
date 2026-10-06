import {env} from 'cloudflare:workers';
import {lookupPublicCredential} from '@/lib/academy-credential-public';
import {isCredentialToken} from '@/lib/academy-credential';
/** Read-only. The token is validated first, then used only as a bound parameter. A bounded substring scan
 *  (no index table, no migration) is acceptable for a pilot; it is O(rows) and would need an index table at scale. */
export async function findPublicCredential(token:string,now=new Date().toISOString()){
 if(!isCredentialToken(token))return {state:'none' as const};
 const db=env.DB;if(!db)return {state:'unavailable' as const};
 try{
  const [a,b]=await Promise.all([
   db.prepare('SELECT data FROM academy_workspaces WHERE instr(data, ?) > 0 LIMIT 5').bind(token).all<{data:string}>(),
   db.prepare('SELECT data FROM academy_teams WHERE instr(data, ?) > 0 LIMIT 5').bind(token).all<{data:string}>()]);
  const found=lookupPublicCredential(token,[...(a.results??[]),...(b.results??[])],now);
  return found?{state:'found' as const,credential:found}:{state:'none' as const};
 }catch{return {state:'unavailable' as const}}
}
