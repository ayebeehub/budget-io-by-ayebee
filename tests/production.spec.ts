import {test, expect, type Page} from '@playwright/test';
import {generateSyntheticLedger, money, type Kind} from '../src/domain';
const seed=generateSyntheticLedger(), expenses=seed.filter(r=>r.kind==='expense');
const sum=(rows:typeof seed)=>rows.reduce((n,r)=>n+r.amountPaise,0);
const storageKey='budget-io:phase1:synthetic:v1';
async function ledger(page:Page, expected:typeof seed){
 await expect(page.getByTestId('transaction-row')).toHaveCount(expected.length);
 const amounts=await page.locator('.data-table tbody .amount-cell').allTextContents();
 expect(amounts.reduce((n,s)=>n+Math.round(Number(s.replace(/[^\d.]/g,''))*100),0)).toBe(sum(expected));
 const ids=await page.locator('[data-testid^="edit-"]').evaluateAll(es=>es.map(e=>e.getAttribute('data-testid')!.slice(5)).sort());
 expect(ids).toEqual(expected.map(r=>r.id).sort());
 await expect(page.locator('.data-footer')).toContainText('reconciliation: PASS');
}
async function report(page:Page, expected:number){
 await page.getByTestId('nav-reports').click();
 const rows=page.locator('.reconcile-row strong');
 await expect(rows).toHaveText([money(expected),money(expected),money(0)]);
}
async function openCreate(page:Page){await page.getByTestId('nav-transactions').click();await page.getByTestId('new-transaction-button').click();}
async function create(page:Page,kind:Kind,direction:'debit'|'credit',name:string){
 await openCreate(page);
 await page.getByLabel('Date',{exact:true}).fill('2026-10-18');
 await page.getByTestId('new-merchant').fill(name);await page.getByTestId('new-amount').fill('123.45');
 await page.getByTestId('new-kind').selectOption(kind);await page.getByTestId('new-direction').selectOption(direction);
 await page.getByTestId('save-new-transaction').click();await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const found:string[]=[];errors.set(page,found);page.on('pageerror',e=>found.push(e.message));});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});

test('AT-01 category pointer and keyboard drilldowns reconcile every row',async({page})=>{
 await page.goto('/');await page.getByTestId('category-legend-Groceries').click();
 await ledger(page,expenses.filter(r=>r.category==='Groceries'));
 await page.getByTestId('back-button').click();await page.getByTestId('donut-slice-Shopping').press('Enter');
 await ledger(page,expenses.filter(r=>r.category==='Shopping'));
});
test('AT-02 August expense bar and income point reconcile their source amounts',async({page})=>{
 await page.goto('/');const selected=expenses.filter(r=>r.date.startsWith('2026-08'));
 await expect(page.getByTestId('trend-bar-2026-08')).toHaveAttribute('aria-label',`Aug expenses ${money(sum(selected))}`);
 await page.getByTestId('trend-bar-2026-08').click();await ledger(page,selected);
 await page.getByTestId('back-button').click();const income=seed.filter(r=>r.kind==='income'&&r.date.startsWith('2026-08'));
 await expect(page.getByTestId('trend-income-2026-08')).toHaveAttribute('aria-label',`Aug income ${money(sum(income))}`);
 await page.getByTestId('trend-income-2026-08').press('Space');await ledger(page,income);
});
for(const [id,kinds] of [['expenses',['expense']],['income',['income']],['wealth',['savings','investment']],['transfers',['transfer']]] as const){
 test(`KPI ${id} opens its exact classified records`,async({page})=>{
  await page.goto('/');const selected=seed.filter(r=>(kinds as readonly string[]).includes(r.kind));
  await expect(page.getByTestId(`kpi-${id}`).locator('.metric-value')).toHaveText(money(sum(selected),true));
  await page.getByTestId(`kpi-${id}`).click();await ledger(page,selected);
 });
}
test('AT-03 category merchant tag account date and search filters intersect',async({page})=>{
 await page.goto('/');await page.getByTestId('category-legend-Groceries').click();
 await page.getByRole('button',{name:'Blinkit',exact:true}).first().click();await page.getByRole('button',{name:'#Online',exact:true}).first().click();
 const selected=expenses.filter(r=>r.category==='Groceries'&&r.merchant==='Blinkit'&&r.tags.includes('Online'));await ledger(page,selected);
 await page.getByRole('button',{name:/^☷ Filters$/}).click();const account=selected[0].account;
 await page.getByTestId('filter-account').selectOption(account);await page.getByTestId('filter-from').fill('2026-08-01');await page.getByTestId('filter-to').fill('2026-09-30');
 await page.getByTestId('search').fill('blinkit');await ledger(page,selected.filter(r=>r.account===account&&r.date>='2026-08-01'&&r.date<='2026-09-30'));
 await page.locator('[title="Remove account filter"]').click();await expect(page).not.toHaveURL(/account=/);await expect(page).toHaveURL(/category=Groceries.*merchant=Blinkit.*tag=Online/);
 await page.getByTestId('search').fill('NO SYNTHETIC MERCHANT MATCHES THIS');await ledger(page,[]);
 await expect(page.getByText('No matching transactions. Remove a filter or change the date range.')).toBeVisible();
});
test('AT-04 native Back Forward breadcrumbs and reload retain filters and trail',async({page})=>{
 await page.goto('/transactions?from=2026-08-01&to=2026-09-30&account=ICICI+%C2%B7%C2%B7+4102');
 await page.getByRole('button',{name:/^☷ Filters$/}).click();await page.getByTestId('filter-category').selectOption('Groceries');await page.getByTestId('filter-kind').selectOption('expense');
 const parent=page.url();await page.getByRole('button',{name:'Blinkit',exact:true}).first().click();const merchant=page.url();
 await page.getByRole('button',{name:'#Online',exact:true}).first().click();const tag=page.url();await page.reload();await expect(page).toHaveURL(tag);
 await page.getByTestId('back-button').click();await expect(page).toHaveURL(merchant);await page.goBack();await expect(page).toHaveURL(parent);
 await page.goForward();await expect(page).toHaveURL(merchant);await page.goForward();await expect(page).toHaveURL(tag);
 await page.locator('.breadcrumbs').getByRole('button',{name:'Transactions',exact:true}).click();await expect(page).toHaveURL(parent);
 await ledger(page,expenses.filter(r=>r.category==='Groceries'&&r.account==='ICICI ·· 4102'&&r.date>='2026-08-01'&&r.date<='2026-09-30'));
});
test('AT-05 edit amount and comments persist with exact report delta',async({page})=>{
 const selected=expenses[0];await page.goto('/transactions');await page.getByTestId(`edit-${selected.id}`).click();
 const amount=((selected.amountPaise+10000)/100).toFixed(2);await page.getByTestId('edit-amount').fill(amount);await page.getByTestId('edit-note').fill('FABRICATED persisted edit');
 await page.getByTestId('save-transaction').click();await expect(page.getByTestId('transaction-row')).toHaveCount(seed.length);await page.reload();
 await page.getByTestId(`edit-${selected.id}`).click();await expect(page.getByTestId('edit-note')).toHaveValue('FABRICATED persisted edit');await expect(page.getByTestId('edit-amount')).toHaveValue(amount);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await report(page,sum(expenses)+10000);
});
test('AT-06 required fields validation natural typing creation persistence and charts',async({page})=>{
 await page.goto('/');await openCreate(page);await page.getByTestId('save-new-transaction').click();await expect(page).toHaveURL(/\/new/);
 await page.getByTestId('new-merchant').fill('   ');await page.getByTestId('new-amount').pressSequentially('99.25');await expect(page.getByTestId('new-amount')).toHaveValue('99.25');
 await page.getByTestId('save-new-transaction').click();await expect(page.getByText('Merchant is required.')).toBeVisible();
 await page.getByTestId('new-merchant').fill('FABRICATED MANUAL GROCERY');await page.getByLabel('Date',{exact:true}).fill('2026-10-18');await page.getByTestId('new-time').fill('14:35');
 await page.getByTestId('edit-category').fill('Groceries');await page.getByLabel('Subcategory',{exact:true}).fill('Synthetic supplies');
 await page.getByTestId('edit-tags').pressSequentially('SyntheticTag, Online');await expect(page.getByTestId('edit-tags')).toHaveValue('SyntheticTag, Online');await page.getByTestId('edit-note').fill('FABRICATED manual note');await page.getByTestId('save-new-transaction').click();
 await expect(page.getByTestId('transaction-row')).toHaveCount(seed.length+1);await page.reload();
 const row=page.getByTestId('transaction-row').filter({hasText:'FABRICATED MANUAL GROCERY'});await expect(row.locator('.amount-cell')).toHaveText(`−${money(9925)}`);
 await row.getByRole('button',{name:'Edit ↗'}).click();await expect(page.getByTestId('edit-note')).toHaveValue('FABRICATED manual note');await expect(page.getByTestId('edit-time')).toHaveValue('14:35');await expect(page.getByTestId('edit-tags')).toHaveValue('SyntheticTag, Online');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await report(page,sum(expenses)+9925);await page.getByTestId('nav-home').click();await page.getByTestId('category-legend-Groceries').click();
 await expect(page.getByRole('button',{name:'FABRICATED MANUAL GROCERY',exact:true})).toBeVisible();
});
test('AT-06 income repayment investment refunds cashback do not inflate spending',async({page})=>{
 await page.goto('/');for(const [kind,direction] of [['income','credit'],['card_payment','debit'],['investment','debit'],['refund','credit'],['cashback','credit']] as const){
  await create(page,kind,direction,`FABRICATED ${kind}`);await report(page,sum(expenses));
 }
 await page.getByTestId('nav-home').click();await page.getByTestId('kpi-income').click();await expect(page.getByRole('button',{name:'FABRICATED income',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'FABRICATED refund',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'FABRICATED cashback',exact:true})).toHaveCount(0);
});
test('AT-07 sample dry-run shows ambiguity duplicates invalid rows and no persistence',async({page})=>{
 await page.goto('/transactions');const before=await page.evaluate(key=>localStorage.getItem(key),storageKey);await page.getByTestId('import-csv-button').click();await page.getByRole('button',{name:'Load sample CSV',exact:true}).click();
 await expect(page.locator('[data-testid^="import-row-"]')).toHaveCount(6);await expect(page.getByTestId('import-totals').locator('strong')).toHaveText(['3','2','1','₹1,301.00']);
 await expect(page.getByText('Possible duplicate; manual review required')).toBeVisible();await expect(page.getByText('Classification requires review')).toBeVisible();await expect(page.getByText('Invalid/missing amount')).toBeVisible();
 await expect(page.getByRole('button',{name:/Commit import:/})).toBeDisabled();expect(await page.evaluate(key=>localStorage.getItem(key),storageKey)).toBe(before);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await ledger(page,seed);await page.goForward();await expect(page.locator('[data-testid^="import-row-"]')).toHaveCount(0);await page.reload();expect(await page.evaluate(key=>localStorage.getItem(key),storageKey)).toBe(before);
});
test('AT-07 file upload handles Axio preamble footer quoted values and format rejection',async({page})=>{
 await page.goto('/transactions');await page.getByTestId('import-csv-button').click();
 const fixture='FABRICATED EXPORT ONLY\nSynthetic report period\nDATE,TIME,PLACE,AMOUNT,DR/CR,ACCOUNT,EXPENSE,INCOME,CATEGORY,TAGS,NOTE\n18-10-26,10:00 AM,"DEMO SHOP, SOUTH",12.34,DR,DEMO ACCOUNT,Yes,No,GROCERIES,"#Synthetic,#Online",fabricated\n18-10-26,10:05 AM,"DEMO SHOP, SOUTH",12.34,DR,DEMO ACCOUNT,Yes,No,GROCERIES,#Synthetic,repeat purchase candidate\n18-10-26,11:00 AM,UNCERTAIN CREDIT,20,CR,DEMO ACCOUNT,No,No,CREDIT,,fabricated\n,,,,,,,,,,Powered by Axio\n';
 await page.getByTestId('import-file').setInputFiles({name:'FABRICATED-axio.csv',mimeType:'text/csv',buffer:Buffer.from(fixture)});await expect(page.locator('[data-testid^="import-row-"]')).toHaveCount(3);
 await expect(page.getByTestId('import-row-0')).toContainText('DEMO SHOP, SOUTH');await expect(page.getByTestId('import-row-0').locator('td').first()).toHaveText('4');await expect(page.getByTestId('import-row-1')).toContainText('Possible duplicate');await expect(page.getByTestId('import-row-2')).toContainText('Classification requires review');
 await page.getByTestId('import-file').setInputFiles({name:'FABRICATED-invalid.csv',mimeType:'text/csv',buffer:Buffer.from('date,amount\n2026-10-18,25')});await expect(page.getByTestId('import-error')).toContainText('Unsupported CSV');await expect(page.locator('[data-testid^="import-row-"]')).toHaveCount(0);
});
test('AT-07 exact filtered CSV export roundtrips as overlapping candidates only',async({page})=>{
 await page.goto('/transactions?kind=expense&category=Groceries');const selected=expenses.filter(r=>r.category==='Groceries');await page.getByTestId('nav-reports').click();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Export filtered CSV',exact:true}).click();const download=await event;
 await page.getByTestId('nav-transactions').click();await page.getByTestId('import-csv-button').click();await page.getByTestId('import-file').setInputFiles((await download.path())!);
 await expect(page.locator('[data-testid^="import-row-"]')).toHaveCount(selected.length);await expect(page.getByTestId('import-totals').locator('strong').nth(1)).toHaveText(String(selected.length));await expect(page.getByTestId('import-totals').locator('strong').nth(3)).toHaveText(money(sum(selected)));await expect(page.getByRole('button',{name:/Commit import:/})).toBeDisabled();
});
test('desktop dark design has no page overflow or external requests',async({page},info)=>{
 await page.setViewportSize({width:1512,height:982});const external:string[]=[];page.on('request',r=>{if(!['127.0.0.1','localhost'].includes(new URL(r.url()).hostname))external.push(r.url());});
 await page.goto('/');await expect(page.getByRole('heading',{name:'Your money, in focus'})).toBeVisible();await expect(page.getByTestId('kpi-expenses')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('overview-desktop.png'),fullPage:true});expect(external).toEqual([]);
});
test('narrow viewport supports entry CSV and navigation without page overflow',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await openCreate(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByTestId('new-merchant').fill('FABRICATED MOBILE');await page.getByTestId('new-amount').fill('1.23');await page.getByLabel('Date',{exact:true}).fill('2026-10-18');await page.getByTestId('save-new-transaction').click();await expect(page.getByRole('button',{name:'FABRICATED MOBILE',exact:true})).toBeVisible();
 await page.getByTestId('import-csv-button').click();await page.getByRole('button',{name:'Load sample CSV',exact:true}).click();await expect(page.locator('[data-testid^="import-row-"]')).toHaveCount(6);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('csv-preview-mobile.png'),fullPage:true});
});
