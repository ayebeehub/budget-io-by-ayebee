import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRupee,normalizeDate,normalizeTime,parseCsv,previewCsv,SYNTHETIC_IMPORT_SAMPLE,validateManual} from '../build-test/ingestion.js';
import {generateSyntheticLedger,totals,expenseCategories,chartReconciles} from '../build-test/domain.js';

test('GATE 06 manual money/date validation accepts paise and rejects coercion/invalid dates',()=>{
 assert.equal(parseRupee('₹1,25,000.25'),12500025);
 assert.equal(parseRupee('0.01'),1);
 for(const v of ['-1','1.234','NaN','Infinity','0','', '12abc'])assert.equal(parseRupee(v),null,`should reject ${v}`);
 assert.equal(normalizeDate('18-10-26'),'2026-10-18');
 assert.equal(normalizeDate('31/02/2026'),null);
 const base=generateSyntheticLedger()[0];
 assert.deepEqual(validateManual({...base,date:'2026-02-31',amountPaise:0,merchant:'',category:''}).length,4);
 assert.deepEqual(validateManual({...base,amountPaise:18075,merchant:'DEMO'}),[]);
});
test('GATE 07 RFC CSV parsing supports BOM, quoted commas/newlines, doubles quotes, and rejects malformed syntax',()=>{
 const rows=parseCsv('\uFEFFa,b,c\r\n"1,2","a""b","line1\nline2"\r\n');
 assert.deepEqual(rows,[['a','b','c'],['1,2','a"b','line1\nline2']]);
 assert.throws(()=>parseCsv('A,B\n"unclosed,x'),/Unclosed/);
});
test('GATE 07 Axio preview dry-run has correctly separated financial direction and classification',()=>{
 const p=previewCsv(SYNTHETIC_IMPORT_SAMPLE);
 assert.equal(p.format,'axio');
 assert.equal(p.rows.length,6);
 assert.equal(p.count.ready,3);
 assert.equal(p.count.review,2);
 assert.equal(p.count.invalid,1);
 assert.equal(p.count.potentialDuplicates,1);
 assert.equal(p.expensePaise,130100);
 assert.equal(p.creditPaise,12575000);
 assert.equal(p.rows.find(r=>r.category==='CREDIT CARD')?.kind,'card_payment');
 assert.equal(p.rows.find(r=>r.merchant==='UNKNOWN CREDIT')?.kind,null);
 assert.equal(p.rows[1].amountPaise,12500000);
 assert.equal(p.rows[0].tags.join(','),'Groceries,Online');
});
test('GATE 07 matched overlapping exports are flagged, never silently removed',()=>{
 const fake={...generateSyntheticLedger()[0],date:'2026-10-18',merchant:'DEMO GROCERY',amountPaise:65050,account:'SBI DEMO 001',direction:'debit',kind:'expense'};
 const p=previewCsv(SYNTHETIC_IMPORT_SAMPLE,[fake]);
 assert.equal(p.rows.length,6);
 assert.equal(p.count.potentialDuplicates,2);
 assert.equal(p.rows[0].status,'review');
 assert.equal(p.rows[0].issues.some(i=>i.includes('duplicate')),true);
});
test('GATE 06 synthetic manually added spending changes totals while repayment does not',()=>{
 const original=generateSyntheticLedger();
 const fake={...original[0],id:'manual-fixture-1',date:'2026-10-18',amountPaise:12999,kind:'expense',direction:'debit',category:'Groceries'};
 const changed=[fake,...original];
 assert.equal(totals(changed).expenses,totals(original).expenses+12999);
 assert.equal(chartReconciles(changed,expenseCategories(changed)),true);
 assert.equal(totals([...changed,{...fake,id:'manual-fixture-2',kind:'card_payment'}]).expenses,totals(changed).expenses);
});
test('GATE 07 malformed format is rejected, never accepted as an import',()=>{
 assert.throws(()=>previewCsv('date,amount\n2026-10-18,100'),/Unsupported CSV/);
 assert.throws(()=>previewCsv('date,merchant,amount,direction,classification,account,category\n2026-01-01,x,1,DR,expense,a,z\n"x'),/Unclosed/);
});

test('Axio title/period and footer rows preserve source row numbers without adding transactions',()=>{
 const preview=previewCsv('FABRICATED AXIO REPORT\nSynthetic period\n'+SYNTHETIC_IMPORT_SAMPLE+'\n,,,,,,,,,,Powered by Axio\n');
 assert.equal(preview.rows.length,6);
 assert.equal(preview.rows[0].line,4);
 assert.deepEqual(preview.count,{ready:3,review:2,invalid:1,potentialDuplicates:1});
});

test('Duplicate column names and invalid seconds cannot become ready rows',()=>{
 assert.throws(()=>previewCsv('DATE,PLACE,AMOUNT,DR/CR,ACCOUNT,CATEGORY,AMOUNT\n'),/Duplicate CSV/);
 assert.equal(normalizeTime('12:30:99'),null);
 assert.equal(normalizeTime('12:30:59 PM'),'12:30');
});
