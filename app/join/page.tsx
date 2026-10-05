import Academy from '../academy';
import {requireChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Join({searchParams}: {searchParams:Promise<{token?:string}>}){const {token}=await searchParams;const valid=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);await requireChatGPTUser(valid?'/join?token='+token:'/join');return <Academy initialInvitation={valid?token:undefined}/>}
