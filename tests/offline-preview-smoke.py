"""Offline Chromium smoke of the single-file compatibility preview.
Run with Python Playwright installed. Does NOT replace modern React/Vite E2E suite.
Chromium's navigation is sandbox-blocked here, so a fake history adapter is injected.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'budget-io-preview.html').read_text()
history_stub='''<script>
window.__hstack=[];window.__current=null;Object.defineProperty(history,"state",{get:()=>window.__current});window.history.replaceState=function(s){window.__current=s;};
window.history.pushState=function(s){window.__hstack.push(window.__current);window.__current=s;};
window.history.back=function(){window.__current=window.__hstack.pop()||null;dispatchEvent(new PopStateEvent('popstate',{state:window.__current}));};
</script>'''
html=html.replace('<div id="root"></div>','<div id="root"></div>'+history_stub)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load')
    expect(page.get_by_role('heading',name='Your money, in focus')).to_be_visible()
    expect(page.get_by_role('button',name='Budget IO BY AYEBEE · PERSONAL FINANCE')).to_be_visible()
    assert page.get_by_test_id('donut-slice-Groceries').count()==1
    # 1. Real donut segment event, category ledger matches
    page.get_by_test_id('donut-slice-Groceries').dispatch_event('click')
    expect(page.get_by_role('heading',name='All transactions')).to_be_visible()
    assert page.evaluate('history.state.view.filters.category')=='Groceries'
    assert page.evaluate('history.state.view.filters.kind')=='expense'
    assert page.get_by_test_id('transaction-row').count()>0
    assert set(page.locator('.data-table tbody .category-cell').all_text_contents())=={'Groceries'}
    # 2. Native-style Back returns home, trend click filters August only
    page.get_by_test_id('back-button').click()
    expect(page.get_by_role('heading',name='Your money, in focus')).to_be_visible()
    page.get_by_test_id('trend-bar-2026-08').dispatch_event('click')
    filters=page.evaluate('history.state.view.filters')
    assert (filters['from'],filters['to'],filters['kind'])==('2026-08-01','2026-08-31','expense')
    assert page.get_by_test_id('transaction-row').count()>0
    assert set(page.locator('.data-table tbody td.date-cell').all_text_contents())=={'31 Aug 2026'} or all('Aug 2026' in d for d in page.locator('.data-table tbody td.date-cell').all_text_contents())
    page.get_by_test_id('back-button').click()
    # 3. Progressive filters: category > merchant > tag, each retained
    page.get_by_test_id('donut-slice-Groceries').dispatch_event('click')
    page.get_by_role('button',name='Blinkit').first.click()
    page.get_by_role('button',name='#Online').first.click()
    filters=page.evaluate('history.state.view.filters')
    assert (filters['category'],filters['merchant'],filters['tag'])==('Groceries','Blinkit','Online')
    assert page.locator('.breadcrumbs button').count()>=3
    page.get_by_test_id('back-button').click()
    assert page.evaluate('history.state.view.filters.tag')==''
    assert page.evaluate('history.state.view.filters.merchant')=='Blinkit'
    page.get_by_test_id('back-button').click()
    assert page.evaluate('history.state.view.filters.merchant')==''
    # 4. Edit synthetic entry and save; any report must reconcile at zero
    page.get_by_test_id('back-button').click()
    page.get_by_test_id('kpi-expenses').click()
    page.locator('[data-testid^="edit-"]').first.click()
    expect(page.get_by_test_id('edit-note')).to_be_visible()
    page.get_by_test_id('edit-note').fill('Offline Chromium edit test')
    page.get_by_test_id('save-transaction').click()
    expect(page.get_by_text('Synthetic transaction saved locally')).to_be_visible()
    page.get_by_test_id('nav-reports').click()
    expect(page.get_by_text('Difference')).to_be_visible()
    assert '₹0.00' in page.locator('.reconcile-row').last.inner_text()
    # 5. Account drill-down and back retention
    page.get_by_test_id('nav-accounts').click()
    page.locator('.account-card').first.click()
    assert page.evaluate('history.state.view.filters.account')!=''
    expect(page.get_by_test_id('back-button')).to_be_visible()
    page.get_by_test_id('back-button').click()
    expect(page.get_by_role('heading',name='Accounts & cards')).to_be_visible()
    assert errors==[],f'Browser errors: {errors}'
    print('PASS: 5 offline-browser smoke scenarios, no runtime errors')
    browser.close()
