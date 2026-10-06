# Read-only catalog check (Python Playwright). Needs a local Worker on 127.0.0.1:8787 and ACADEMY_QA_DIR with academy.json. GET-only; API GETs fulfilled in-page; writes/foreign origins aborted and reported.
import os
import re
import json, sys
from playwright.sync_api import sync_playwright
S=os.environ['ACADEMY_QA_DIR'].rstrip('/')+'/'
academy=open(S+'academy.json').read()
H={'oai-authenticated-user-id':'display-learner-qa','oai-authenticated-user-email':'display-learner@academy.test','oai-authenticated-user-full-name':'Display%20learner','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}
directory=json.dumps({'workspaces':[],'user':{'id':'display-learner-qa','name':'Display learner','email':'display-learner@academy.test'}})
bad=[]; errs=[]
def handler(route):
    r=route.request; u=r.url
    if not u.startswith('http://127.0.0.1:8787') or r.method not in ('GET','HEAD'):
        bad.append((r.method,u)); return route.abort()
    if '/api/' in u:
        if u.endswith('/api/academy'): return route.fulfill(status=200,content_type='application/json',body=academy)
        if u.endswith('/api/teams'): return route.fulfill(status=200,content_type='application/json',body=directory)
        bad.append(('api',u)); return route.abort()
    return route.continue_()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=['--no-sandbox'])
    for w,h in ((1280,900),(390,844)):
        c=b.new_context(viewport={'width':w,'height':h},extra_http_headers=H,service_workers='block')
        pg=c.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.route('**/*',handler)
        pg.goto('http://127.0.0.1:8787/#programs'); pg.locator('[data-save-state="loaded"]').wait_for(timeout=30000)
        pg.get_by_role('heading',name='Choose a skill. Make it useful.').wait_for()
        print(w,'status:',pg.locator('[role=status]').first.inner_text())
        pg.screenshot(path=S+f'catalog-{w}.png',full_page=True)
        ov=pg.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth')
        print(w,'horizontal overflow:',ov)
        # open details on first card
        pg.locator('summary',has_text='Before you enrol').first.click()
        pg.screenshot(path=S+f'catalog-{w}-open.png',full_page=True)
        # filter by search
        pg.get_by_label('Search pathways').fill('customer')
        print(w,'after search:',pg.get_by_role('status').filter(has_text='shown').inner_text(), pg.locator('article').count())
        pg.get_by_label('Search pathways').fill('zzzz')
        print(w,'empty:',pg.get_by_role('status').filter(has_text='match').inner_text(), pg.get_by_role('heading',name='No matching pathway').count())
        pg.screenshot(path=S+f'catalog-{w}-empty.png',full_page=True)
        pg.get_by_role('button',name='Clear filters').first.click()
        print(w,'cleared:',pg.locator('article').count(), pg.get_by_label('Search pathways').input_value()=='')
        # facet select
        pg.get_by_label('Work context').select_option('Farmer')
        print(w,'role=Farmer:',pg.locator('article').count())
        pg.get_by_role('button',name='Clear filters').first.click()
        if w==1280:
            # keyboard only: tab from search through facets, clear, card buttons, details toggle with Enter
            pg.get_by_label('Search pathways').focus()
            order=[]
            for i in range(14):
                pg.keyboard.press('Tab')
                order.append(pg.evaluate("(()=>{const e=document.activeElement;return (e.tagName+':'+((e.getAttribute('aria-label')||e.innerText||e.id||'').trim().slice(0,38)))})()"))
            print('tab order:',order)
            pg.get_by_label('Search pathways').focus()
            pg.keyboard.type('records')
            print('kbd search count:',pg.locator('article').count())
            summ=pg.locator('summary',has_text='Before you enrol').first
            summ.focus(); pg.keyboard.press('Enter')
            print('details open via Enter:',pg.evaluate("document.querySelector('details[open] summary')?.innerText"))
            pg.get_by_role('button',name=re.compile('See details and enrol')).first.focus(); pg.keyboard.press('Enter')
            pg.wait_for_timeout(800); print('enter on card ->',pg.evaluate('location.hash'))
            pg.screenshot(path=S+'learn-1280.png',full_page=True)
        c.close()
    b.close()
print('blocked/unexpected:',bad); print('page errors:',errs)
