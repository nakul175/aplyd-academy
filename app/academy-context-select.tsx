'use client';
import {useId} from 'react';
import {Sprout,Building2,Landmark} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
export const roleOptions=[{id:'farmer',label:'Farmer',icon:Sprout,tag:'AGRI SAHA',title:'Make better farm decisions'},{id:'msme',label:'MSME owner',icon:Building2,tag:'MSME',title:'Run your business with clarity'},{id:'public',label:'Public servant',icon:Landmark,tag:'PUBLIC SERVICE',title:'Serve people with confidence'}];
export function ContextSelect({value,onChange,label,hint}:{value:string;onChange:(value:string)=>void;label?:string;hint?:string}){
 const id=useId(),labelId=id+'-label',hintId=id+'-hint';
 return <div className={label||hint?'guidance-browse':undefined}>{label&&<label id={labelId} htmlFor={id}>{label}</label>}<Select value={value} onValueChange={onChange}><SelectTrigger id={id} aria-label={label?undefined:'Your work context'} aria-labelledby={label?labelId:undefined} aria-describedby={hint?hintId:undefined} className="context-select"><SelectValue/></SelectTrigger><SelectContent>{roleOptions.map(p=><SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select>{hint&&<p id={hintId} className="form-hint">{hint}</p>}</div>;
}
