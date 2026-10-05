'use client';
import {Sprout,Building2,Landmark} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
export const roleOptions=[{id:'farmer',label:'Farmer',icon:Sprout,tag:'AGRI SAHA',title:'Make better farm decisions'},{id:'msme',label:'MSME owner',icon:Building2,tag:'MSME',title:'Run your business with clarity'},{id:'public',label:'Public servant',icon:Landmark,tag:'PUBLIC SERVICE',title:'Serve people with confidence'}];
export function ContextSelect({value,onChange}:any){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label="Your work context" className="context-select"><SelectValue/></SelectTrigger><SelectContent>{roleOptions.map(p=><SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select>}
