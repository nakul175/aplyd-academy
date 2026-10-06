from pathlib import Path
from hashlib import sha256
import json,zipfile
root=Path(__file__).resolve().parent.parent
files=sorted(p for p in root.iterdir() if p.is_file() and p.suffix in {'.md','.html','.csv','.json','.sql','.svg'} and p.name!='manifest.json')
manifest={'product':'Aplyd Academy','version':'0.1','date':'2026-10-05','status':'Proposed design baseline; planned product tests Not run','entry_point':'index.html','files':[{'path':p.name,'bytes':p.stat().st_size,'sha256':sha256(p.read_bytes()).hexdigest()} for p in files]}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
target=root.parent/'Aplyd-Academy-Documentation-v0.1.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for p in files+[root/'manifest.json']:z.write(p,'Aplyd-Academy-Documentation-v0.1/'+p.name)
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert 'Aplyd-Academy-Documentation-v0.1/index.html' in z.namelist()
    assert len(z.namelist())==len(files)+1
print(json.dumps({'zip':str(target),'files':len(files)+1,'bytes':target.stat().st_size,'crc_check':'passed'}))
