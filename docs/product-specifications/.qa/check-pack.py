import csv,json,re
from pathlib import Path
from collections import Counter
root=Path(__file__).resolve().parent.parent
checks=[]
def check(name,condition,detail=''):
    checks.append({'name':name,'passed':bool(condition),'detail':detail})
def rows(name):
    with (root/name).open(newline='') as f:return list(csv.DictReader(f))
requirements=rows('requirements-register.csv');cases=rows('test-cases.csv');scenarios=rows('test-scenarios.csv');trace=rows('traceability.csv');fields=rows('data-dictionary.csv')
brs={f'BR-{i:02}' for i in range(1,47)};tc={r['TC_ID']:r for r in cases};ts={r['Scenario_ID'] if 'Scenario_ID' in r else r['TS_ID']:r for r in scenarios}
check('All 46 source requirements registered',{r['br_id'] for r in requirements}==brs)
check('All 46 BR requirements traced',{r['BR_ID'] for r in trace}==brs)
check('Test identifiers unique',len(tc)==len(cases))
check('Case execution remains Not run',all(r['Execution_status']=='Not run' for r in cases))
check('Required case fields populated',all(all(r[k].strip() for k in ['Title','Preconditions','Synthetic_data','Steps','Expected_result','Priority','Release','Suites','BR_refs','F_refs','WF_refs','Evidence_required']) for r in cases))
bad=[]
for r in cases:
    if r['Scenario_ID'] not in ts:bad.append(r['TC_ID']+':scenario')
    for b in r['BR_refs'].split(';'):
        if b not in brs:bad.append(r['TC_ID']+':'+b)
    for f in r['F_refs'].split(';'):
        if f not in {f'F-{i:02}' for i in range(1,13)}:bad.append(r['TC_ID']+':'+f)
    for w in r['WF_refs'].split(';'):
        if w not in {f'WF-{i:02}' for i in range(1,15)}:bad.append(r['TC_ID']+':'+w)
check('Case requirement module screen and scenario references resolve',not bad,str(bad))
bad=[]
for r in trace:
    for cid in r['TC_IDs'].split(';'):
        if cid not in tc or r['BR_ID'] not in tc[cid]['BR_refs'].split(';'):bad.append(r['BR_ID']+':'+cid)
check('Traceability cases exist and reciprocate BR references',not bad,str(bad))
sql=(root/'schema.sql').read_text();tables={}
for name,body in re.findall(r'CREATE TABLE (\w+) \((.*?)\n\);',sql,re.S):
    tables[name]={m.group(1) for line in body.splitlines() if (m:=re.match(r'\s{4}(\w+)\s+([a-z][\w\[\]]*)',line))}
dictionary={(r['table'],r['column']) for r in fields};schema={(t,c) for t,cols in tables.items() for c in cols}
check('Dictionary covers exactly all SQL columns',dictionary==schema,json.dumps({'missing':sorted(schema-dictionary),'extra':sorted(dictionary-schema)}))
check('Dictionary fields unique',len(dictionary)==len(fields))
check('Dictionary purpose owner classification retention populated',all(all(r[k] for k in ['purpose','owner','classification','retention_category','phase']) for r in fields))
spec=json.loads((root/'openapi.json').read_text());refs=[];ops=[];unresolved=[]
def deref(ref):
    obj=spec
    for token in ref[2:].split('/'):obj=obj[token.replace('~1','/').replace('~0','~')]
    return obj
def walk(o):
    if isinstance(o,dict):
        if '$ref' in o:
            refs.append(o['$ref'])
            try:deref(o['$ref'])
            except (KeyError,TypeError):unresolved.append(o['$ref'])
        for v in o.values():walk(v)
    elif isinstance(o,list):
        for v in o:walk(v)
walk(spec)
check('OpenAPI parses and target is 3.1.0',spec.get('openapi')=='3.1.0')
check('All local OpenAPI references resolve',not unresolved,str(unresolved))
bad=[]
for endpoint,item in spec['paths'].items():
    for method,op in item.items():
        if method not in ['get','post','put','patch','delete','options','head','trace']:continue
        ops.append(op.get('operationId'));params=[deref(p['$ref']) if '$ref' in p else p for p in item.get('parameters',[])+op.get('parameters',[])]
        for name in re.findall(r'\{([^}]+)\}',endpoint):
            if not any(p.get('name')==name and p.get('in')=='path' and p.get('required') for p in params):bad.append(method+' '+endpoint+':'+name)
        if not op.get('responses'):bad.append(method+' '+endpoint+':responses')
check('All OpenAPI operation IDs present and unique',all(ops) and len(ops)==len(set(ops)))
check('API path parameters and responses specified',not bad,str(bad))
check('Baseline partner endpoints present',all(p in spec['paths'] for p in ['/api/v1/partner/enrollments','/api/v1/partner/achievements','/api/v1/partner/webhook-subscriptions']))
check('Public credential fields match minimal contract',set(spec['components']['schemas']['PublicCredential']['properties'])=={'issuer_label','approved_display_label','achievement_title','state'})
partner_params=[deref(p['$ref']) if '$ref' in p else p for p in spec['paths']['/api/v1/partner/achievements']['get'].get('parameters',[])]
partner_query={p['name'] for p in partner_params if p.get('in')=='query'}
check('Partner achievement query uses opaque learner reference','learner_ref' in partner_query and not {'learner_issuer','learner_subject','email','phone'}&partner_query)
bad=[]
for md in root.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)',md.read_text()):
        if target.startswith(('http:','https:','#','mailto:')):continue
        clean=target.split('#')[0].strip('<>')
        if clean and not (root/clean).exists():bad.append(md.name+':'+clean)
check('Markdown local file links resolve',not bad,str(bad))
report={'artifact_scope':'Documentation and reference contracts only; not implemented product tests','counts':{'requirements':len(requirements),'test_scenarios':len(scenarios),'test_cases':len(cases),'releases':dict(Counter(r['Release'] for r in cases)),'schema_tables':len(tables),'dictionary_fields':len(fields),'api_paths':len(spec['paths']),'api_operations':len(ops),'api_schemas':len(spec['components']['schemas']),'api_references':len(refs)},'checks':checks,'limits':['No PostgreSQL server execution','OpenAPI structural validation only, not a full conformance validator or live API execution','No product backend or security controls exercised']}
(root/'.qa/structural-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
raise SystemExit(0 if all(c['passed'] for c in checks) else 1)
