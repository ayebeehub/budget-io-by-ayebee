/** Phase 1: client-side, volatile CSV preview and synthetic manual entry.
 * No CSV rows are committed, transmitted, logged, or persisted. */
import type {Direction, Kind, Transaction} from './domain.js';

export type ImportStatus = 'ready'|'review'|'invalid';
export interface PreviewRow {time:string;line:number; merchant:string; date:string; amountPaise:number|null; direction:Direction|null; kind:Kind|null; account:string; category:string; tags:string[]; status:ImportStatus; issues:string[];}
export interface CsvPreview {format:'axio'|'budget-io'; rows:PreviewRow[]; count:{ready:number;review:number;invalid:number;potentialDuplicates:number}; debitPaise:number;creditPaise:number;expensePaise:number;}

export function parseRupee(value:string):number|null {
 const input=value.trim().replace(/^(₹|INR\s*)/i,'').replace(/,/g,'');
 if(!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(input))return null;
 const [units,cents='']=input.split('.'); const paise=Number(units)*100+Number(cents.padEnd(2,'0'));
 return Number.isSafeInteger(paise)&&paise>0?paise:null;
}
export function normalizeDate(raw:string):string|null {
 const s=raw.trim();let y:number,m:number,d:number;
 if(/^\d{4}-\d{2}-\d{2}$/.test(s)){[y,m,d]=s.split('-').map(Number);}
 else if(/^(\d{2})[-/](\d{2})[-/](\d{2}|\d{4})$/.test(s)){
  const parts=s.split(/[-/]/).map(Number);[d,m,y]=parts; if(y<100)y+=2000;
 }else return null;
 const date=new Date(Date.UTC(y,m-1,d));
 if(date.getUTCFullYear()!==y||date.getUTCMonth()+1!==m||date.getUTCDate()!==d||y<2000||y>2100)return null;
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function normalizeTime(raw:string):string|null{
 if(!raw.trim())return '';
 const m=/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(raw.trim());if(!m)return null;
 let hour=Number(m[1]);const minute=Number(m[2]);if(minute>59||Number(m[3]??0)>59)return null;
 if(m[4]){if(hour<1||hour>12)return null;hour=hour%12+(m[4].toUpperCase()==='PM'?12:0);}
 else if(hour>23)return null;
 return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}
export function validateManual(t:Transaction):string[]{
 const issues:string[]=[];
 if(!normalizeDate(t.date))issues.push('Date must be valid.');
 if(normalizeTime(t.time??'')===null)issues.push('Time is invalid.');
 if(!t.merchant.trim())issues.push('Merchant is required.');
 if(!Number.isSafeInteger(t.amountPaise)||t.amountPaise<=0)issues.push('Amount must be greater than zero with at most two decimals.');
 if(!t.account.trim())issues.push('Account is required.');
 if(!t.category.trim())issues.push('Category is required.');
 if(!['debit','credit'].includes(t.direction))issues.push('Direction is required.');
 if(!['expense','income','refund','cashback','transfer','savings','investment','card_payment'].includes(t.kind))issues.push('Classification is required.');
 return issues;
}
/** RFC4180-compatible CSV lexer, including quoted commas, doubled quotes and newlines. */
export function parseCsv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,afterQuote=false;
 const source=text.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}else field+=c;continue;}
  if(afterQuote&&c!=='\r'&&c!=='\n'&&c!==','&&c!==' '&&c!=='\t')throw Error('Unexpected text after quoted CSV value.');
  if(c==='"'){if(field.trim()!=='')throw Error('Invalid quote in CSV cell.');field='';quoted=true;afterQuote=false;}
  else if(c===','){row.push(field);field='';afterQuote=false;}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';afterQuote=false;}
  else if(c===' '||c==='\t'){if(!afterQuote)field+=c;}
  else {field+=c;afterQuote=false;}
 }
 if(quoted)throw Error('Unclosed quoted CSV value.');
 row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
const norm=(s:string)=>s.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
const splitTags=(input:string)=>input.split(/[,;]/).map(t=>t.trim().replace(/^#/,'')).filter(Boolean);
const knownKinds=['expense','income','refund','cashback','transfer','savings','investment','card_payment'] as const;
function axioKind(category:string,direction:Direction,expense:string,income:string):{kind:Kind|null;review:boolean}{
 const cat=norm(category),exp=norm(expense),inc=norm(income);
 if(/CARDPAYMENT|BILLPAYMENT|CREDITCARD/.test(cat))return {kind:'card_payment',review:direction!=='debit'&&cat!=='BILLPAYMENT'};
 if(/INVESTMENT|MUTUALFUND|STOCK/.test(cat))return {kind:'investment',review:direction!=='debit'};
 if(/SAVING/.test(cat))return {kind:'savings',review:direction!=='debit'};
 if(/TRANSFER|ACCOUNTTRANSFER/.test(cat))return {kind:'transfer',review:false};
 if(/CASHBACK|REWARD/.test(cat)&&direction==='credit')return {kind:'cashback',review:false};
 if(/REFUND|REVERSAL/.test(cat)&&direction==='credit')return {kind:'refund',review:false};
 if(inc==='YES'&&direction==='credit')return {kind:'income',review:false};
 if(exp==='YES'&&direction==='debit')return {kind:'expense',review:false};
 return {kind:null,review:true};
}
const signature=(r:{date:string;account:string;merchant:string;amountPaise:number|null;direction:Direction|null})=>[r.date,norm(r.account),norm(r.merchant),r.amountPaise,r.direction].join('|');
export function previewCsv(text:string, existing:readonly Transaction[]=[]):CsvPreview{
 if(text.length>5_000_000)throw Error('File exceeds the 5 MB Phase 1 preview limit.');
 const parsed=parseCsv(text);
 if(!parsed.length)throw Error('CSV is empty.');
 // Axio exports include title/period rows before the actual header. Keep
 // source row indexes for review rather than dropping that export structure.
 const headerIndex=parsed.findIndex(cells=>{
  const names=cells.map(norm);
  return names.includes('DATE')&&names.includes('AMOUNT')&&
   (names.includes('DRCR')&&names.includes('PLACE')||names.includes('CLASSIFICATION')&&names.includes('MERCHANT'));
 });
 if(headerIndex<0)throw Error('Unsupported CSV columns. Expected Axio or Budget IO export format.');
 const header=parsed[headerIndex].map(norm);
 if(new Set(header).size!==header.length)throw Error('Duplicate CSV column names are not supported.');
 const ix=(...names:string[])=>header.findIndex(x=>names.map(norm).includes(x));
 const axio=ix('DR/CR')>=0&&ix('PLACE')>=0&&ix('AMOUNT')>=0;
 const canonical=ix('classification')>=0&&ix('direction')>=0&&ix('merchant')>=0;
 if(!axio&&!canonical)throw Error('Unsupported CSV columns. Expected Axio or Budget IO export format.');
 const format=axio?'axio':'budget-io';
 for(const req of axio?['DATE','PLACE','AMOUNT','DR/CR','ACCOUNT','CATEGORY']:['date','merchant','amount','direction','classification','account','category']){
  if(ix(req)<0)throw Error(`Missing required CSV column: ${req}`);
 }
 const get=(cells:string[],key:string)=>{const n=ix(key);return n>=0?(cells[n]??'').trim():'';};
 const existingKeys=new Set(existing.map(signature));
 const seen=new Set<string>();let potentialDuplicates=0;
 if(parsed.length-headerIndex-1>10000)throw Error('Preview is limited to 10,000 rows.');
 const rows:PreviewRow[]=[];
 for(let n=headerIndex+1;n<parsed.length;n++){
  const cells=parsed[n];
  if(!cells.some(s=>s.trim()))continue;
  // Axio footer is not a transaction, and may contain links or branding.
  if(axio&&(!get(cells,'DATE')&&!get(cells,'PLACE'))&&/POWERED|AXIO/i.test(cells.join(',')))continue;
  const date=normalizeDate(get(cells,'DATE'))??'';
  const time=normalizeTime(get(cells,'TIME'));
  const merchant=get(cells,axio?'PLACE':'MERCHANT');
  const account=get(cells,'ACCOUNT');
  const amountPaise=parseRupee(get(cells,'AMOUNT'));
  const rawDirection=get(cells,axio?'DR/CR':'DIRECTION').toUpperCase();
  const direction:Direction|null=rawDirection==='DR'||rawDirection==='DEBIT'?'debit':rawDirection==='CR'||rawDirection==='CREDIT'?'credit':null;
  const category=get(cells,'CATEGORY');
  const issues:string[]=[];
  if(!date)issues.push('Invalid/missing date');
  if(time===null)issues.push('Invalid time');
  if(!merchant)issues.push('Missing merchant');
  if(!account)issues.push('Missing account');
  if(!category)issues.push('Missing category');
  if(amountPaise===null)issues.push('Invalid/missing amount');
  if(!direction)issues.push('Unknown debit/credit direction');
  let kind:Kind|null=null;
  if(axio){if(direction){const inferred=axioKind(category,direction,get(cells,'EXPENSE'),get(cells,'INCOME'));kind=inferred.kind;if(inferred.review)issues.push('Classification requires review');}}
  else {const k=get(cells,'CLASSIFICATION').toLowerCase();if(knownKinds.includes(k as Kind))kind=k as Kind;else issues.push('Unknown classification');}
  if(!kind&&!issues.some(x=>x.includes('Classification')||x.includes('classification')))issues.push('Classification requires review');
  const r:PreviewRow={line:n+1,time:time??'',merchant,date,amountPaise,direction,kind,account,category,tags:splitTags(get(cells,'TAGS')),issues,status:'ready'};
  if(date&&account&&merchant&&amountPaise!==null&&direction){
   const key=signature(r);
   // Same-day identical amounts are NOT treated as safely removable; they need review.
   if(existingKeys.has(key)||seen.has(key)){potentialDuplicates++;issues.push('Possible duplicate; manual review required');}
   seen.add(key);
  }
  r.status=issues.some(s=>s.includes('Invalid')||s.includes('Missing')||s.includes('Unknown debit'))?'invalid':issues.length?'review':'ready';
  rows.push(r);
 }
 const count={ready:rows.filter(r=>r.status==='ready').length,review:rows.filter(r=>r.status==='review').length,invalid:rows.filter(r=>r.status==='invalid').length,potentialDuplicates};
 return {format,rows,count,debitPaise:rows.reduce((n,r)=>n+(r.direction==='debit'&&r.amountPaise!==null?r.amountPaise:0),0),creditPaise:rows.reduce((n,r)=>n+(r.direction==='credit'&&r.amountPaise!==null?r.amountPaise:0),0),expensePaise:rows.reduce((n,r)=>n+(r.kind==='expense'&&r.amountPaise!==null?r.amountPaise:0),0)};
}
/** Fabricated, export-shaped data for testing CSV selection, parsing, warnings and totals. */
export const SYNTHETIC_IMPORT_SAMPLE=`DATE,TIME,PLACE,AMOUNT,DR/CR,ACCOUNT,EXPENSE,INCOME,CATEGORY,TAGS,NOTE
18-10-26,10:00 AM,DEMO GROCERY,650.50,DR,SBI DEMO 001,Yes,No,GROCERIES,"#Groceries, #Online",fabricated
18-10-26,11:30 AM,DEMO PAYROLL,"1,25,000.00",CR,ICICI DEMO 002,No,Yes,SALARY,#Monthly,fabricated
18-10-26,12:00 PM,CARD PAYMENT,"8,000",DR,ICICI DEMO 002,No,No,CREDIT CARD,#Banking,fabricated
18-10-26,01:00 PM,UNKNOWN CREDIT,750,CR,SBI DEMO 001,No,No,CREDIT,,fabricated
18-10-26,02:00 PM,DEMO GROCERY,650.50,DR,SBI DEMO 001,Yes,No,GROCERIES,#Online,duplicate candidate
19-10-26,03:00 PM,BROKEN AMOUNT,abc,DR,SBI DEMO 001,Yes,No,OTHER,,fabricated
`;
