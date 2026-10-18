import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_FILTERS,chartReconciles,expenseCategories,filterTransactions,generateSyntheticLedger,monthlyTrend,monthKey,sumAmount,totals,CATEGORY_COLORS,TAG_LIBRARY} from '../build-test/domain.js';
const ledger=generateSyntheticLedger();
const base={...EMPTY_FILTERS};
const all=filterTransactions(ledger,base);
test('Dataset is fabricated, contains >50 searchable tags and all financial classes',()=>{
 assert.ok(all.length>300);assert.ok(TAG_LIBRARY.length>50);assert.ok(Object.keys(CATEGORY_COLORS).length>5);
 for(const k of ['expense','income','refund','cashback','savings','investment','card_payment','transfer']) assert.ok(all.some(x=>x.kind===k),`missing ${k}`);
 assert.ok(all.every(x=>x.id.startsWith('syn-')&&Number.isInteger(x.amountPaise)));
});
test('ACCEPTANCE 1: donut category slice total equals expense ledger after clicking Groceries',()=>{
 const grouped=expenseCategories(all);assert.ok(chartReconciles(all,grouped));
 const c=grouped.find(x=>x.key==='Groceries');assert.ok(c);
 const clicked=filterTransactions(ledger,{...base,kind:'expense',category:'Groceries'});
 assert.equal(sumAmount(clicked),c.amountPaise);assert.equal(clicked.length,c.count);
});
test('ACCEPTANCE 2: August trend bar amount equals precisely filtered August expense rows',()=>{
 const month='2026-08';const trend=monthlyTrend(all,[month])[0];
 const selected=filterTransactions(ledger,{...base,from:'2026-08-01',to:'2026-08-31',kind:'expense'});
 assert.equal(sumAmount(selected),trend.expenses);
 assert.ok(selected.every(x=>monthKey(x.date)===month&&x.kind==='expense'));
});
test('ACCEPTANCE 3: progressive category + merchant + tag filters intersect, not overwrite',()=>{
 const cat=filterTransactions(ledger,{...base,kind:'expense',category:'Groceries'});
 const mer=filterTransactions(ledger,{...base,kind:'expense',category:'Groceries',merchant:'Blinkit'});
 const tag=filterTransactions(ledger,{...base,kind:'expense',category:'Groceries',merchant:'Blinkit',tag:'Online'});
 assert.ok(cat.length>=mer.length&&mer.length>=tag.length&&tag.length>0);
 assert.ok(tag.every(x=>x.kind==='expense'&&x.category==='Groceries'&&x.merchant==='Blinkit'&&x.tags.includes('Online')));
 assert.equal(sumAmount(tag),tag.reduce((n,t)=>n+t.amountPaise,0));
});
test('ACCEPTANCE 5: classification keeps credit card settlements, transfers, savings out of expense sum',()=>{
 const t=totals(all);const expense=all.filter(x=>x.kind==='expense');
 assert.equal(t.expenses,sumAmount(expense));
 assert.equal(t.cardPayments,sumAmount(all.filter(x=>x.kind==='card_payment')));
 assert.equal(t.wealth,sumAmount(all.filter(x=>x.kind==='savings'||x.kind==='investment')));
 assert.ok(t.cardPayments>0&&t.transfers>0&&t.wealth>0);
 const excluded=all.filter(x=>x.kind==='card_payment');assert.ok(excluded.every(x=>x.direction==='debit'));
});
