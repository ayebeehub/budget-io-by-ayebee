"""Browser smoke for mandatory Phase 1 manual create and CSV import preview.
Compatibility runtime only: full React 19/Vite validation remains pending.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
html=(root/'budget-io-preview.html').read_text()
history_stub='''<script>
window.__hstack=[];window.__current=null;Object.defineProperty(history,"state",{get:()=>window.__current});window.history.replaceState=function(s){window.__current=s;};
window.history.pushState=function(s){window.__hstack.push(window.__current);window.__current=s;};
window.history.back=function(){window.__current=window.__hstack.pop()||null;dispatchEvent(new PopStateEvent('popstate',{state:window.__current}));};
</script>'''
html=html.replace('<div id="root"></div>','<div id="root"></div>'+history_stub)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu']);page=browser.new_page(viewport={'width':1440,'height':960})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load')
 page.get_by_test_id('nav-transactions').click()
 # create manual synthetic row, check note and financial reconciliation
 page.get_by_test_id('new-transaction-button').click()
 expect(page.get_by_role('heading',name='Add transaction',level=1)).to_be_visible()
 expect(page.get_by_test_id('back-button')).to_be_visible()
 page.get_by_test_id('new-merchant').fill('FABRICATED TEST PAYEE')
 page.get_by_test_id('new-amount').fill('121.75')
 page.get_by_test_id('new-kind').select_option('expense')
 page.get_by_test_id('save-new-transaction').click()
 expect(page.get_by_role('heading',name='All transactions')).to_be_visible()
 expect(page.get_by_text('FABRICATED TEST PAYEE')).to_be_visible()
 assert page.evaluate('history.state.view.filters.from')==''
 page.get_by_test_id('nav-reports').click()
 assert '₹0.00' in page.locator('.reconcile-row').last.inner_text()
 # transaction editing still functions on newly added row
 page.get_by_test_id('nav-transactions').click()
 page.locator('tr[data-testid="transaction-row"]:has-text("FABRICATED TEST PAYEE") button[data-testid^="edit-"]').click()
 expect(page.get_by_test_id('edit-note')).to_be_visible()
 page.get_by_test_id('back-button').click()
 # import preview does not commit and parses built-in synthetic rows, warns duplicates
 page.get_by_test_id('import-csv-button').click()
 expect(page.get_by_role('heading',name='CSV import preview')).to_be_visible()
 page.get_by_role('button',name='Load sample CSV',exact=True).click()
 expect(page.get_by_test_id('import-totals')).to_be_visible()
 assert page.locator('tr[data-testid^="import-row-"]').count()==6
 assert 'Possible duplicate' in page.locator('.import-table').inner_text()
 assert 'Classification requires review' in page.locator('.import-table').inner_text()
 assert 'Invalid/missing amount' in page.locator('.import-table').inner_text()
 assert page.get_by_role('button',name='Commit import: available in Phase 2').is_disabled()
 # uploaded fixture follows same parser; corrupt file generates a clear validation error
 sample='DATE,PLACE,AMOUNT,DR/CR,ACCOUNT,CATEGORY,EXPENSE,INCOME\n18-10-26,TEST,10,DR,SBI DEMO 001,GROCERIES,Yes,No\n'
 page.get_by_test_id('import-file').set_input_files({'name':'synthetic.csv','mimeType':'text/csv','buffer':sample.encode()})
 expect(page.get_by_test_id('import-totals')).to_be_visible()
 assert page.locator('tr[data-testid^="import-row-"]').count()==1
 page.get_by_test_id('import-file').set_input_files({'name':'wrong.csv','mimeType':'text/csv','buffer':b'foo,bar\n1,2'})
 expect(page.get_by_test_id('import-error')).to_contain_text('Unsupported CSV columns')
 assert not errors,errors
 print('PASS: manual create, reconciliation, edit, CSV dry-run, upload and error handling (compatibility Chromium)')
 browser.close()
