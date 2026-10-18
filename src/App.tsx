import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {
  ACCOUNTS,CATEGORY_COLORS,EMPTY_FILTERS,TAG_LIBRARY,chartReconciles,expenseCategories,expenseMerchants,
  filterTransactions,generateSyntheticLedger,lastSixMonths,money,monthlyTrend,sumAmount,totals,validAmountPaise
} from './domain';
import type {Filters,Kind,KindFilter,Transaction,Agg} from './domain';
import {consolidatedView,drill,goToPage,parentView,parseView,serializeView} from './navigation';
import {parseRupee,previewCsv,validateManual,SYNTHETIC_IMPORT_SAMPLE} from './ingestion';
import type {CsvPreview} from './ingestion';
import type {Page,View} from './navigation';

const STORAGE_KEY='budget-io:phase1:synthetic:v1';
const KINDS:Kind[]=['expense','income','refund','cashback','transfer','savings','investment','card_payment'];
const PAGE_LABELS:Record<Page,string>={home:'Home',transactions:'Transactions',analytics:'Analytics',budgets:'Budgets',accounts:'Accounts',reports:'Reports',settings:'Settings',detail:'Transaction',new:'Add transaction',import:'CSV import preview'};
const SIDE_ICONS:Record<Exclude<Page,'detail'|'new'|'import'>,string>={home:'▣',transactions:'☷',analytics:'▥',budgets:'◉',accounts:'▤',reports:'▧',settings:'⚙'};
const shortDate=(iso:string)=>new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
const monthName=(key:string)=>new Date(`${key}-01T12:00:00`).toLocaleDateString('en-GB',{month:'short'});
const allMonths=lastSixMonths();
function monthRange(month:string):Pick<Filters,'from'|'to'>{const [y,m]=month.split('-').map(Number);const lastDay=new Date(y,m,0).getDate();return {from:`${month}-01`,to:`${month}-${String(lastDay).padStart(2,'0')}`};}
const datePresets=[{label:'Last 6 months',from:'2026-05-01',to:'2026-10-31'},{label:'October 2026',from:'2026-10-01',to:'2026-10-31'},{label:'All synthetic data',from:'',to:''}];
const kindLabel=(kind:KindFilter)=>({all:'All types',wealth:'Savings & investments',expense:'Expenses',income:'Income',refund:'Refunds',cashback:'Cashback',transfer:'Transfers',savings:'Savings',investment:'Investments',card_payment:'Card repayments'}[kind]);
function getStoredData():Transaction[]{
  const demo=generateSyntheticLedger();
  try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return demo;const parsed:unknown=JSON.parse(raw);
    if(Array.isArray(parsed)&&parsed.every(t=>t&&typeof t==='object'&&typeof t.id==='string'&&typeof t.date==='string'&&validAmountPaise(t.amountPaise)&&KINDS.includes(t.kind)&&Array.isArray(t.tags)))return parsed as Transaction[];
  }catch{/* corrupt demo storage: safely fall back to synthetic seed */}
  return demo;
}
function initialNavigation():View{
  if(typeof window==='undefined')return {page:'home',filters:{...EMPTY_FILTERS},trail:[],title:'Overview'};
  const viewFromHistory=(history.state as {view?:View}|null)?.view;
  return viewFromHistory??parseView(location.href);
}
const fallbackColor='#a8b5ce';

function Button({children,onClick,kind='ghost',testid,type='button',disabled=false}:{children:React.ReactNode;onClick?:()=>void;kind?:'ghost'|'primary'|'subtle';testid?:string;type?:'button'|'submit';disabled?:boolean}){
 return <button type={type} disabled={disabled} data-testid={testid} className={`btn btn-${kind}`} onClick={onClick}>{children}</button>;
}
function Pill({children,onClick,color}:{children:React.ReactNode;onClick?:()=>void;color?:string}){
 return <button type="button" className="tag" onClick={onClick} style={color?{'--tag-color':color} as React.CSSProperties:undefined}>{children}</button>;
}
const DrillNavigationContext=createContext<{back:()=>void;consolidate:()=>void}|null>(null);
function DrillControls(){
 const actions=useContext(DrillNavigationContext);
 return actions?<div className="drill-controls"><button type="button" onClick={actions.back}>← Back</button><button type="button" onClick={actions.consolidate} title="Clear drilldown filters and keep the selected period">Consolidated view</button></div>:null;
}
function Panel({children,className='',title,right}:{children:React.ReactNode;className?:string;title?:string;right?:React.ReactNode}){
 const drillActions=useContext(DrillNavigationContext);
 return <section className={`panel ${className}`}>{title&&<div className="panel-head"><h3>{title}</h3>{(right||drillActions)&&<div className="panel-actions">{right}<DrillControls/></div>}</div>}{children}</section>;
}
function MiniLabel({children}:{children:React.ReactNode}){return <span className="muted text-small">{children}</span>;}
function Badge({children,color='green'}:{children:React.ReactNode;color?:'green'|'blue'|'purple'|'orange'}){return <span className={`badge ${color}`}>{children}</span>;}

function SpendingRing({value,budget,onClick}:{value:number;budget:number;onClick:()=>void}){
 const ratio=Math.min(value/Math.max(1,budget),1);const C=2*Math.PI*82;
 return <button type="button" data-testid="spending-ring" className="ring-click" onClick={onClick} title="Open expense transactions">
  <svg viewBox="0 0 240 240" className="spend-ring" aria-label={`Spending ${money(value)}; ${Math.round(ratio*100)} percent of illustrative budget`} role="img">
   <circle cx="120" cy="120" r="82" stroke="#14284c" strokeWidth="16" fill="none"/>
   <circle cx="120" cy="120" r="82" stroke="#2478ff" strokeWidth="16" fill="none" strokeLinecap="round" strokeDasharray={`${C*ratio} ${C*(1-ratio)}`} transform="rotate(-90 120 120)" style={{filter:'drop-shadow(0 0 12px #1460fb99)'}}/>
   <text x="120" y="89" textAnchor="middle" fill="#9cafd1" fontSize="12">Total spent</text>
   <text x="120" y="122" textAnchor="middle" fill="white" fontSize="23" fontWeight="760">{money(value,true)}</text>
   <text x="120" y="148" textAnchor="middle" fill="#74baff" fontSize="12">↗ {Math.round(ratio*100)}% of demo budget</text>
   <text x="120" y="169" textAnchor="middle" fill="#677f9f" fontSize="10">Click for transactions</text>
  </svg>
 </button>;
}
function Donut({groups,onSelect}:{groups:Agg[];onSelect:(name:string)=>void}){
 const total=groups.reduce((s,g)=>s+g.amountPaise,0);
 const R=78, circumference=2*Math.PI*R;let used=0;
 return <div className="donut-row">
  <div className="donut-visual"><svg viewBox="0 0 230 230" aria-label="Spending by category" role="img">
   <circle cx="115" cy="115" r={R} stroke="#18253d" strokeWidth="25" fill="none"/>
   {groups.map(group=>{const part=total?group.amountPaise/total:0;const dash=part*circumference;const offset=used;used+=dash;
    return <circle key={group.key} data-testid={`donut-slice-${group.key}`} role="button" tabIndex={0} aria-label={`Open ${group.key} transactions`} onClick={()=>onSelect(group.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(group.key);}}} cx="115" cy="115" r={R} fill="none" stroke={CATEGORY_COLORS[group.key]??fallbackColor} strokeWidth="25" strokeDasharray={`${Math.max(0,dash)} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 115 115)" className="donut-arc"><title>{group.key}: {money(group.amountPaise)}</title></circle>;
   })}
   <text x="115" y="102" textAnchor="middle" fill="#7f97b7" fontSize="11">Total spending</text>
   <text x="115" y="124" textAnchor="middle" fill="#f4f8ff" fontWeight="700" fontSize="18">{money(total,true)}</text>
   <text x="115" y="144" textAnchor="middle" fill="#7f97b7" fontSize="10">{groups.length} categories</text>
  </svg></div>
  <div className="donut-legend">
   {groups.slice(0,8).map(group=><button data-testid={`category-legend-${group.key}`} className="legend-item" key={group.key} onClick={()=>onSelect(group.key)}>
    <span className="legend-label"><span className="dot" style={{background:CATEGORY_COLORS[group.key]??fallbackColor}}/>{group.key}</span><span>{total?Math.round(group.amountPaise/total*100):0}%</span>
   </button>)}
   {!groups.length&&<span className="muted">No spending for these filters.</span>}
  </div>
 </div>;
}
function Trend({rows,onMonth,onIncome}:{rows:Transaction[];onMonth:(month:string)=>void;onIncome:(month:string)=>void}){
 const months=monthlyTrend(rows,allMonths);const max=Math.max(1,...months.map(x=>x.expenses),...months.map(x=>x.income));
 const coords=months.map((m,i)=>({x:62+i*91,y:180-m.income/max*136}));const points=coords.map(p=>`${p.x},${p.y}`).join(' ');
 return <div className="trend-holder"><svg viewBox="0 0 605 232" role="img" aria-label="Monthly spending bars and income line" className="trend-svg">
  <defs><linearGradient id="bargrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#378bff"/><stop offset="100%" stopColor="#2344c3"/></linearGradient></defs>
  {[0,1,2,3].map(t=><g key={t}><line x1="35" y1={180-t*45} x2="575" y2={180-t*45} stroke="#21304b" strokeDasharray="3 5"/><text x="10" y={184-t*45} fill="#6c819e" fontSize="10">{Math.round(max/10000000*t/3)}L</text></g>)}
  {months.map((m,i)=>{const x=62+i*91;const h=m.expenses/max*136;return <g key={m.month}>
    <rect data-testid={`trend-bar-${m.month}`} role="button" tabIndex={0} aria-label={`${monthName(m.month)} expenses ${money(m.expenses)}`} onClick={()=>onMonth(m.month)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onMonth(m.month);}}} x={x-20} y={180-h} width="40" height={Math.max(1,h)} rx="5" fill="url(#bargrad)" className="trend-bar"><title>{monthName(m.month)} expense transactions: {money(m.expenses)}</title></rect>
    <text x={x} y="205" fill="#94a8c8" fontSize="12" textAnchor="middle">{monthName(m.month)}</text>
   </g>;})}
  <polyline points={points} fill="none" stroke="#2fe993" strokeWidth="3"/>
  {coords.map((p,i)=><circle key={i} data-testid={`trend-income-${months[i].month}`} aria-label={`${monthName(months[i].month)} income ${money(months[i].income)}`} role="button" tabIndex={0} onClick={()=>onIncome(months[i].month)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onIncome(months[i].month);}}} cx={p.x} cy={p.y} r="6" fill="#29e89b" stroke="#0b1c28" strokeWidth="3" className="income-point"><title>{monthName(months[i].month)} income: {money(months[i].income)}</title></circle>)}
 </svg><div className="chart-keys"><span><i className="dot" style={{background:'#3c82fe'}}/> Expenses (bars)</span><span><i className="dot" style={{background:'#29e89b'}}/> Income (points)</span></div></div>;
}
function EmptyState({message='No matching transactions. Remove a filter or change the date range.'}:{message?:string}){return <div className="empty-state">{message}</div>}
function Table({rows,onMerchant,onTag,onCategory,onAccount,onEdit,limit}:{rows:Transaction[];onMerchant:(m:string)=>void;onTag:(t:string)=>void;onCategory:(c:string)=>void;onAccount:(a:string)=>void;onEdit:(t:Transaction)=>void;limit?:number}){
 const [expanded,setExpanded]=useState(false);const shown=limit&&!expanded?rows.slice(0,limit):rows;
 return <div className="table-wrap">
  <table className="data-table"><thead><tr><th>Merchant</th><th>Account</th><th>Category</th><th>Tags</th><th>Date</th><th className="right">Amount</th><th className="right">Action</th></tr></thead>
   <tbody>{shown.map(t=><tr key={t.id} data-testid="transaction-row">
    <td><div className="merchant-cell"><span className="merchant-avatar" style={{background:(CATEGORY_COLORS[t.category]??'#4a9af8')+'25',color:CATEGORY_COLORS[t.category]??'#81aaff'}}>{t.merchant.slice(0,1).toUpperCase()}</span><button className="linkish merchant-name" onClick={()=>onMerchant(t.merchant)}>{t.merchant}</button></div><div className="mobile-only sub-cell">{t.account}</div></td>
    <td><button className="linkish subtle-link" onClick={()=>onAccount(t.account)}>{t.account}</button></td>
    <td><button className="category-cell" onClick={()=>onCategory(t.category)}><span className="dot" style={{background:CATEGORY_COLORS[t.category]??'#8091ae'}}/>{t.category}</button></td>
    <td><div className="tag-row">{t.tags.slice(0,3).map(tag=><Pill key={tag} onClick={()=>onTag(tag)}>#{tag}</Pill>)}</div></td>
    <td className="date-cell">{shortDate(t.date)}</td>
    <td className={`right amount-cell ${['income','refund','cashback'].includes(t.kind)?'positive':''}`}>{t.direction==='credit'?'+':'−'}{money(t.amountPaise)}</td>
    <td className="right"><button className="mini-action" data-testid={`edit-${t.id}`} onClick={()=>onEdit(t)}>Edit ↗</button></td>
   </tr>)}</tbody>
  </table>
  {!shown.length&&<EmptyState/>}
  {limit&&rows.length>limit&&<button className="view-more" onClick={()=>setExpanded(!expanded)}>{expanded?'Show fewer':`Show all ${rows.length} matching transactions`} →</button>}
 </div>;
}
function SectionTitle({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}){
 return <div className="page-intro"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
function EditForm({original,save,cancel,isNew=false}:{original:Transaction;save:(t:Transaction)=>void;cancel:()=>void;isNew?:boolean}){
 const [t,setT]=useState<Transaction>(original);const [error,setError]=useState('');
 const [amountInput,setAmountInput]=useState(original.amountPaise?(original.amountPaise/100).toFixed(2):'');
 const [tagsInput,setTagsInput]=useState(original.tags.join(', '));
 const set=<K extends keyof Transaction>(field:K,value:Transaction[K])=>setT(prev=>({...prev,[field]:value}));
 const submit=(ev:React.FormEvent)=>{ev.preventDefault();const next={...t,amountPaise:parseRupee(amountInput)??0,tags:tagsInput.split(',').map(x=>x.trim().replace(/^#/,'')).filter(Boolean)};const errors=validateManual(next);if(errors.length){setError(errors.join(' '));return;}save({...next,tags:[...new Set(next.tags)],merchant:t.merchant.trim(),category:t.category.trim()});};
 return <Panel className="edit-panel" title={isNew?"Add transaction":"Edit transaction"} right={<Badge color="purple">Synthetic demo</Badge>}><form onSubmit={submit} className="edit-grid">
  <label>Merchant<input data-testid={isNew?"new-merchant":"edit-merchant"} value={t.merchant} onChange={e=>set('merchant',e.target.value)} required/></label>
  <label>Date<input type="date" value={t.date} onChange={e=>set('date',e.target.value)} required/></label>
  <label>Amount (₹)<input type="number" step="0.01" min="0.01" data-testid={isNew?"new-amount":"edit-amount"} value={amountInput} onChange={e=>setAmountInput(e.target.value)} required/></label>
  <label>Time (optional)<input type="time" data-testid={isNew?"new-time":"edit-time"} value={t.time??""} onChange={e=>set('time',e.target.value)}/></label>
  <label>Direction<select data-testid={isNew?"new-direction":"edit-direction"} value={t.direction} onChange={e=>set('direction',e.target.value as Transaction['direction'])}><option value="debit">Debit</option><option value="credit">Credit</option></select></label>
  <label>Classification<select data-testid={isNew?"new-kind":"edit-kind"} value={t.kind} onChange={e=>set('kind',e.target.value as Kind)}>{KINDS.map(k=><option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>
  <label>Category<input data-testid="edit-category" list="categories-datalist" value={t.category} onChange={e=>set('category',e.target.value)} required/><datalist id="categories-datalist">{Object.keys(CATEGORY_COLORS).concat(['Salary','Interest','Investments','Savings allocation','Internal transfers','Card repayment','Rewards']).map(c=><option key={c} value={c}/>)}</datalist></label>
  <label>Subcategory<input value={t.subcategory} onChange={e=>set('subcategory',e.target.value)}/></label>
  <label>Account<select value={t.account} onChange={e=>{const account=ACCOUNTS.find(a=>a.name===e.target.value);setT(prev=>({...prev,account:e.target.value,institution:account?.institution??prev.institution}));}}>{ACCOUNTS.map(a=><option key={a.name}>{a.name}</option>)}</select></label>
  <label className="full">Tags (comma-separated)<input data-testid="edit-tags" value={tagsInput} onChange={e=>setTagsInput(e.target.value)}/><span className="hint">{TAG_LIBRARY.length} suggested tags. Create additional tags freely.</span></label>
  <label className="full">Comments<textarea data-testid="edit-note" rows={3} value={t.note} onChange={e=>set('note',e.target.value)}/></label>
  {error&&<div className="form-error full">{error}</div>}
  <div className="full form-actions"><Button onClick={cancel}>Cancel</Button><Button kind="primary" type="submit" testid={isNew?"save-new-transaction":"save-transaction"}>{isNew?"Add transaction":"Save changes"}</Button></div>
 </form></Panel>;
}
function ImportPreview({existing,onCancel}:{existing:Transaction[];onCancel:()=>void}){
 const [result,setResult]=useState<CsvPreview|null>(null);
 const [error,setError]=useState('');
 const [name,setName]=useState('');
 const analyze=(text:string,filename:string)=>{try{setResult(previewCsv(text,existing));setError('');setName(filename);}catch(e){setResult(null);setError(e instanceof Error?e.message:'Unable to parse CSV.');setName(filename);}};
 const onFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5_000_000){setResult(null);setError('CSV exceeds the 5 MB preview limit.');return;}try{analyze(await file.text(),file.name);}catch{setError('Unable to read selected file.');}};
 const downloadSample=()=>{const b=new Blob([SYNTHETIC_IMPORT_SAMPLE],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='budget-io-FABRICATED-axio-fixture.csv';a.click();URL.revokeObjectURL(u);};
 return <div data-testid="csv-import-preview-page"><SectionTitle title="CSV import preview" subtitle="Inspect, validate and review locally. No transaction rows will be committed in Phase 1."/><Panel title="Select a fabricated test export" right={<Badge color="purple">Preview only</Badge>}>
 <div className="import-actions"><label className="import-file-label">Choose CSV<input type="file" accept=".csv,text/csv" data-testid="import-file" onChange={onFile}/></label><Button onClick={()=>analyze(SYNTHETIC_IMPORT_SAMPLE,'Built-in fabricated Axio fixture')}>Load sample CSV</Button><Button onClick={downloadSample}>↓ Download sample CSV</Button><Button onClick={onCancel}>Cancel</Button></div>
 <p className="fineprint">Staging must use fabricated CSV data. A chosen file is read into transient browser memory, without uploading or persisting its contents. Do not enter private banking records in this unauthenticated prototype.</p>
 {error&&<div role="alert" className="form-error" data-testid="import-error">{error}</div>}
 </Panel>
 {result&&<><div className="mini-metrics" data-testid="import-totals"><div className="submetric"><MiniLabel>Ready</MiniLabel><strong>{result.count.ready}</strong><span className="green-text">Can be mapped</span></div><div className="submetric"><MiniLabel>Review</MiniLabel><strong>{result.count.review}</strong><span className="purple-text">Including {result.count.potentialDuplicates} possible duplicates</span></div><div className="submetric"><MiniLabel>Invalid</MiniLabel><strong>{result.count.invalid}</strong><span className="red-text">Cannot commit</span></div><div className="submetric"><MiniLabel>Classified expenses</MiniLabel><strong>{money(result.expensePaise)}</strong><span className="blue-text">Excludes repayments</span></div></div>
 <Panel title={`${name} · ${result.format==='axio'?'Axio':'Budget IO'} format · ${result.rows.length} rows`} right={<Badge color="orange">Dry run: no commit</Badge>}>
 <p className="muted">Debit total: {money(result.debitPaise)} · Credit total: {money(result.creditPaise)} · All values are candidate mappings, not booked transactions.</p>
 <div className="table-wrap"><table className="data-table import-table"><thead><tr><th>CSV row</th><th>Date</th><th>Time</th><th>Merchant</th><th>Account</th><th>Direction</th><th>Class</th><th className="right">Amount</th><th>Validation</th></tr></thead><tbody>{result.rows.slice(0,150).map((r,i)=><tr key={i} data-testid={`import-row-${i}`}><td>{r.line}</td><td>{r.date||'—'}</td><td>{r.time||'—'}</td><td>{r.merchant||'—'}</td><td>{r.account||'—'}</td><td>{r.direction??'—'}</td><td>{r.kind??'Unclassified'}</td><td className="right">{r.amountPaise!==null?money(r.amountPaise):'—'}</td><td><span className={`import-status status-${r.status}`}>{r.status}</span><small className="import-issues">{r.issues.join('; ')||'Validated'}</small></td></tr>)}</tbody></table></div>
 {result.rows.length>150&&<p className="fineprint">Showing first 150 of {result.rows.length} preview rows; validation statistics cover all rows.</p>}
 <div className="import-disabled"><Button disabled kind="primary">Commit import: available in Phase 2</Button><span className="muted text-small">No CSV records have been saved.</span></div>
 </Panel></>}
 </div>;
}
function ActiveChips({filters,reset}:{filters:Filters;reset:(p:Partial<Filters>)=>void}){
 const pairs:(keyof Filters)[]=['category','merchant','tag','account','institution','kind','search'];
 return <div className="active-chips">{pairs.filter(key=>Boolean(filters[key])&&filters[key]!=='all').map(key=><button className="filter-chip" key={key} onClick={()=>reset({[key]:key==='kind'?'all':''})} title={`Remove ${key} filter`}><span>{key}: {filters[key]}</span> ×</button>)}</div>;
}

export default function App(){
 const [rows,setRows]=useState<Transaction[]>(getStoredData);
 const [view,setView]=useState<View>(initialNavigation);
 const [showFilters,setShowFilters]=useState(false);
 const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
 const menuToggle=useRef<HTMLButtonElement>(null);
 const navigationPanel=useRef<HTMLElement>(null);
 const [toast,setToast]=useState('');
 const hasDrillFilters=Boolean(view.filters.category||view.filters.merchant||view.filters.tag||view.filters.account||view.filters.institution||view.filters.search||view.filters.kind!=='all');
 const showDrillNavigation=!['detail','new','import','settings'].includes(view.page)&&(view.trail.length>0||hasDrillFilters);
 const filtered=useMemo(()=>filterTransactions(rows,view.filters),[rows,view.filters]);
 const amounts=useMemo(()=>totals(filtered),[filtered]);
 const categories=useMemo(()=>expenseCategories(filtered),[filtered]);
 const merchants=useMemo(()=>expenseMerchants(filtered),[filtered]);
 const allCategories=useMemo(()=>[...new Set(rows.map(t=>t.category))].sort(),[rows]);
 const allMerchants=useMemo(()=>[...new Set(rows.map(t=>t.merchant))].sort(),[rows]);
 const allTags=useMemo(()=>[...new Set([...TAG_LIBRARY,...rows.flatMap(t=>t.tags)])].sort(),[rows]);
 const filteredCorrect=chartReconciles(filtered,categories);
 useEffect(()=>{if(!(history.state as {view?:View}|null)?.view) history.replaceState({view},'',serializeView(view));
  const onBack=(e:PopStateEvent)=>{setView((e.state as {view?:View}|null)?.view??parseView(location.href));};
  window.addEventListener('popstate',onBack);return ()=>window.removeEventListener('popstate',onBack);
 // intentionally install once: the current navigation snapshot lives in browser history
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));}catch{/* e.g. browser storage blocked: edits remain in React memory */}},[rows]);
 useEffect(()=>{
  if(!mobileMenuOpen)return;
  navigationPanel.current?.querySelector<HTMLButtonElement>('nav button')?.focus();
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const dismiss=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMobileMenuOpen(false);menuToggle.current?.focus();}};
  window.addEventListener('keydown',dismiss);
  return ()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',dismiss);};
 },[mobileMenuOpen]);
 useEffect(()=>{const desktop=window.matchMedia('(min-width: 901px)');const closeOnDesktop=()=>{if(desktop.matches)setMobileMenuOpen(false);};desktop.addEventListener('change',closeOnDesktop);return ()=>desktop.removeEventListener('change',closeOnDesktop);},[]);
 const navigate=useCallback((next:View,replace=false)=>{if(replace)history.replaceState({view:next},'',serializeView(next));else history.pushState({view:next},'',serializeView(next));setView(next);},[]);
 const filterChange=(patch:Partial<Filters>)=>navigate({...view,filters:{...view.filters,...patch}},true);
 const dive=(patch:Partial<Filters>,label:string,page:Page='transactions',transactionId?:string)=>navigate(drill(view,patch,label,page,transactionId));
 const closeMenu=()=>{setMobileMenuOpen(false);menuToggle.current?.focus();};
 const goto=(page:Page)=>{setShowFilters(false);if(mobileMenuOpen)closeMenu();navigate(goToPage(view,page));};
 const consolidate=()=>navigate(consolidatedView(view));
 const back=()=>{if(view.trail.length){history.back();}else if(hasDrillFilters){consolidate();}else if(view.page!=='home'){goto('home');}else{navigate(goToPage(view,'home'));}};
 const crumb=(index:number)=>navigate(parentView(view,index));
 const diveCategory=(c:string)=>dive({category:c,kind:'expense'},c);
 const diveMerchant=(m:string)=>dive({merchant:m},m);
 const diveTag=(t:string)=>dive({tag:t},`#${t}`);
 const diveAccount=(a:string)=>dive({account:a},a);
 const diveKind=(k:KindFilter,label=kindLabel(k))=>dive({kind:k},label);
 const diveMonth=(month:string,kind:KindFilter)=>dive({...monthRange(month),kind},`${monthName(month)} ${month.slice(0,4)} · ${kindLabel(kind)}`);
 const editRow=(t:Transaction)=>dive({},`Edit ${t.merchant}`,'detail',t.id);
 const openCreate=()=>dive({},'Add transaction','new');
 const openImport=()=>dive({},'CSV import preview','import');
 const create=(next:Transaction)=>{setRows(prev=>[next,...prev].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)));setToast('Fabricated manual transaction created');setTimeout(()=>setToast(''),3000);const destination=goToPage(view,'transactions');destination.filters={...destination.filters,from:'',to:'',kind:'all',category:'',merchant:'',tag:'',account:'',institution:'',search:''};navigate(destination);};
 const save=(next:Transaction)=>{setRows(prev=>prev.map(t=>t.id===next.id?next:t));setToast('Synthetic transaction saved locally');setTimeout(()=>setToast(''),3000);back();};
 const resetDemo=()=>{setRows(generateSyntheticLedger());setToast('Synthetic data reset');setTimeout(()=>setToast(''),3000);};
 const exportCsv=()=>{
  const fields=['date','time','merchant','amount','direction','classification','category','subcategory','account','institution','tags','note'];
  const quote=(s:string)=>`"${s.replaceAll('"','""')}"`;
  const text=[fields.join(','),...filtered.map(t=>[t.date,t.time??'',t.merchant,(t.amountPaise/100).toFixed(2),t.direction,t.kind,t.category,t.subcategory,t.account,t.institution,t.tags.join('; '),t.note].map(x=>quote(String(x))).join(','))].join('\r\n');
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='budget-io-SYNTHETIC-demo.csv';a.click();URL.revokeObjectURL(url);
 };
 const activePage=['detail','new','import'].includes(view.page)?'transactions':view.page as Exclude<Page,'detail'|'new'|'import'>;
 const periodMonths=Math.max(1,allMonths.filter(m=>(!view.filters.from||`${m}-31`>=view.filters.from)&&(!view.filters.to||`${m}-01`<=view.filters.to)).length);
 const financeMetrics=[
  {label:'Total spending',value:amounts.expenses,desc:'Gross classified expenses',color:'blue',icon:'▣',kind:'expense' as KindFilter,test:'kpi-expenses'},
  {label:'Income',value:amounts.income,desc:'Classified income credits',color:'green',icon:'↗',kind:'income' as KindFilter,test:'kpi-income'},
  {label:'Savings & investments',value:amounts.wealth,desc:'Excluded from expenses',color:'purple',icon:'◈',kind:'wealth' as KindFilter,test:'kpi-wealth'},
  {label:'Transfers',value:amounts.transfers,desc:'Internal movement only',color:'yellow',icon:'⇄',kind:'transfer' as KindFilter,test:'kpi-transfers'}
 ];
 const transTable=(list:Transaction[],limit?:number)=><Table rows={list} limit={limit} onMerchant={diveMerchant} onTag={diveTag} onCategory={diveCategory} onAccount={diveAccount} onEdit={editRow}/>;
 return <DrillNavigationContext.Provider value={showDrillNavigation?{back,consolidate}:null}><div className={`app-shell${showDrillNavigation?' has-drill-navigation':''}`}>
  {mobileMenuOpen&&<button type="button" className="navigation-backdrop" aria-label="Dismiss navigation menu" onClick={closeMenu}/>}
  <aside ref={navigationPanel} id="workspace-navigation" className={`sidebar${mobileMenuOpen?' is-open':''}`}>
   <button className="brand" onClick={()=>goto('home')}><span className="brand-mark">●</span><span><strong>Budget <em>IO</em></strong><small>BY AYEBEE · PERSONAL FINANCE</small></span></button>
   <div className="nav-caption">WORKSPACE</div>
   <nav aria-label="Main navigation">{(['home','transactions','analytics','budgets','accounts','reports','settings'] as const).map(p=><button key={p} className={`nav-link ${activePage===p?'selected':''}`} data-testid={`nav-${p}`} onClick={()=>goto(p)}><span className="nav-icon">{SIDE_ICONS[p]}</span>{PAGE_LABELS[p]}{p==='transactions'&&<span className="nav-arrow">›</span>}</button>)}</nav>
   <div className="sidebar-bottom"><span className="sync-indicator">●</span><div><strong>Local demo mode</strong><small>No bank or SMS connected</small></div></div>
  </aside>
  <main className="main-area">
   <header className="topbar"><button ref={menuToggle} type="button" className="mobile-menu-toggle" aria-label={mobileMenuOpen?'Close navigation menu':'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation" onClick={()=>mobileMenuOpen?closeMenu():setMobileMenuOpen(true)}><span aria-hidden="true">{mobileMenuOpen?'✕':'☰'}</span></button><div className="mobile-brand"><span className="brand-mark">●</span> Budget IO <span className="mobile-brand-owner">by AyeBee</span></div><span className="topbar-path">BUDGET IO / {PAGE_LABELS[activePage].toUpperCase()}</span><div className="topbar-actions"><span className="demo-badge">SYNTHETIC DATA</span><div className="profile-avatar">BI</div></div></header>
   <div className="content-area">
    {view.trail.length>0&&<div className="navigation-strip"><button data-testid="back-button" className="back-button" onClick={back}>← Back</button><div aria-label="Breadcrumb" className="breadcrumbs">{view.trail.map((c,i)=><React.Fragment key={i}><button onClick={()=>crumb(i)}>{c.label}</button><span> / </span></React.Fragment>)}<strong>{view.title}</strong></div></div>}
    {view.page==='home'&&<>
      <SectionTitle title="Your money, in focus" subtitle="A complete view of your financial activity, with every number traceable." action={<Badge>● Demo records only</Badge>}/>
      <div className="date-strip"><div className="date-tabs">{datePresets.map(p=><button key={p.label} className={view.filters.from===p.from&&view.filters.to===p.to?'active':''} onClick={()=>filterChange({from:p.from,to:p.to})}>{p.label}</button>)}</div><Button onClick={()=>setShowFilters(!showFilters)}>☷ {showFilters?'Hide filters':'All filters'}</Button></div>
      <div className="dashboard-hero"><Panel className="ring-panel"><div className="ring-title">Spending overview <span>↗</span></div><SpendingRing value={amounts.expenses} budget={65000000} onClick={()=>diveKind('expense')}/><div className="ring-stats"><div><span>Income</span><strong className="green-text">{money(amounts.income,true)}</strong></div><div><span>Card repayments</span><strong>{money(amounts.cardPayments,true)}</strong></div></div></Panel>
      <Panel className="trend-panel" title="Trends by month" right={<span className="muted text-small">May to Oct '26 · click a bar</span>}><Trend rows={filtered} onMonth={m=>diveMonth(m,'expense')} onIncome={m=>diveMonth(m,'income')}/></Panel>
      <Panel className="category-panel" title="Spending by category" right={<button className="text-action" onClick={()=>goto('analytics')}>View all →</button>}><Donut groups={categories} onSelect={diveCategory}/></Panel></div>
      <div className="metrics-row">{financeMetrics.map(m=><button key={m.label} data-testid={m.test} className={`metric-card tone-${m.color}`} onClick={()=>diveKind(m.kind)}><span className="metric-head"><span className="metric-icon">{m.icon}</span><span className="metric-arrow">↗</span></span><span className="metric-label">{m.label}</span><span className="metric-value">{money(m.value,true)}</span><span className="metric-detail">{m.desc}</span></button>)}</div>
      <Panel className="recent-panel" title="Recent transactions" right={<button className="text-action" onClick={()=>goto('transactions')}>View all →</button>}>{transTable(filtered,7)}</Panel>
     </>}
    {view.page!=='home'&&view.page!=='detail'&&view.page!=='new'&&view.page!=='import'&&<>
      <SectionTitle title={{transactions:'All transactions',analytics:'Trends & Analytics',budgets:'Budgets & allocations',accounts:'Accounts & cards',reports:'Financial reports',settings:'Demo settings'}[view.page]} subtitle={{transactions:'Explore, filter and edit every transaction.',analytics:'See where money comes from and where it goes.',budgets:'Compare spending against illustrative monthly targets.',accounts:'Inspect activity for each bank account and card.',reports:'Export and reconcile the exact currently filtered transactions.',settings:'Phase 1 prototype controls and data integrity details.'}[view.page]} action={view.page==='reports'?<Button kind="primary" onClick={exportCsv}>↓ Export filtered CSV</Button>:view.page==='transactions'?<div className="import-actions"><Button kind="primary" onClick={openCreate} testid="new-transaction-button">+ Add Transaction</Button><Button onClick={openImport} testid="import-csv-button">↑ Import CSV</Button></div>:undefined}/>
      {view.page!=='settings'&&<div className="filters-toolbar"><div className="toolbar-first"><div className="search-wrap"><span>⌕</span><input data-testid="search" placeholder="Search transactions, merchants, tags..." aria-label="Search transactions" value={view.filters.search} onChange={e=>filterChange({search:e.target.value})}/></div><Button onClick={()=>setShowFilters(!showFilters)}>☷ {showFilters?'Hide filters':'Filters'}</Button><Button onClick={()=>navigate({...view,filters:{...EMPTY_FILTERS}},true)}>Clear all</Button></div><ActiveChips filters={view.filters} reset={filterChange}/></div>}
     </>}
    {(showFilters&&view.page!=='detail'&&view.page!=='new'&&view.page!=='import'&&view.page!=='settings')&&<Panel className="advanced-filters" title="Filter transactions"><div className="filter-grid">
      <label>From<input aria-label="From date" data-testid="filter-from" type="date" value={view.filters.from} onChange={e=>filterChange({from:e.target.value})}/></label>
      <label>To<input aria-label="To date" data-testid="filter-to" type="date" value={view.filters.to} onChange={e=>filterChange({to:e.target.value})}/></label>
      <label>Classification<select data-testid="filter-kind" value={view.filters.kind} onChange={e=>filterChange({kind:e.target.value as KindFilter})}><option value="all">All types</option><option value="wealth">Savings & investments</option>{KINDS.map(x=><option key={x} value={x}>{kindLabel(x)}</option>)}</select></label>
      <label>Category<select data-testid="filter-category" value={view.filters.category} onChange={e=>filterChange({category:e.target.value})}><option value="">All categories</option>{allCategories.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Merchant<select data-testid="filter-merchant" value={view.filters.merchant} onChange={e=>filterChange({merchant:e.target.value})}><option value="">All merchants</option>{allMerchants.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Tag<select data-testid="filter-tag" value={view.filters.tag} onChange={e=>filterChange({tag:e.target.value})}><option value="">All tags</option>{allTags.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Account<select data-testid="filter-account" value={view.filters.account} onChange={e=>filterChange({account:e.target.value})}><option value="">All accounts</option>{ACCOUNTS.map(x=><option key={x.name}>{x.name}</option>)}</select></label>
      <label>Institution<select data-testid="filter-institution" value={view.filters.institution} onChange={e=>filterChange({institution:e.target.value})}><option value="">All institutions</option>{[...new Set(ACCOUNTS.map(x=>x.institution))].map(x=><option key={x}>{x}</option>)}</select></label>
     </div><div className="filter-panel-footer"><MiniLabel>Filters are combined using AND, and retained when navigating back.</MiniLabel><Button onClick={()=>navigate({...view,filters:{...EMPTY_FILTERS}},true)}>Reset filters</Button></div></Panel>}
    {view.page==='transactions'&&<>
      <div className="mini-metrics"><button className="submetric" onClick={()=>diveKind('expense')}><MiniLabel>Spending</MiniLabel><strong>{money(amounts.expenses,true)}</strong><span className="blue-text">↗ Show expenses</span></button><button className="submetric" onClick={()=>diveKind('income')}><MiniLabel>Income</MiniLabel><strong>{money(amounts.income,true)}</strong><span className="green-text">↗ Show income</span></button><button className="submetric" onClick={()=>diveKind('wealth')}><MiniLabel>Wealth allocations</MiniLabel><strong>{money(amounts.wealth,true)}</strong><span className="purple-text">↗ Show allocations</span></button><button className="submetric" onClick={()=>diveKind('card_payment')}><MiniLabel>Card payments (excluded)</MiniLabel><strong>{money(amounts.cardPayments,true)}</strong><span className="muted">↗ Inspect</span></button></div>
      <div className="analytics-two"><Panel title="Spend by category" right={<span className="muted text-small">Click segments to filter</span>}><Donut groups={categories} onSelect={diveCategory}/></Panel><Panel title="Top merchants" right={<span className="muted text-small">By spending</span>}><div className="rank-list">{merchants.slice(0,6).map((m,i)=><button className="rank-row" key={m.key} onClick={()=>diveMerchant(m.key)}><span className="rank-num">{i+1}</span><strong>{m.key}</strong><span>{money(m.amountPaise,true)}</span><span className="rank-arrow">›</span></button>)}</div></Panel></div>
      <Panel title={`${filtered.length} transactions` } right={<span className="muted text-small">{money(sumAmount(filtered),true)} total movement · gross, not net</span>}>{transTable(filtered)}</Panel>
     </>}
    {view.page==='analytics'&&<>
      <div className="metrics-row analytics-kpis">{financeMetrics.map(m=><button key={m.label} className={`metric-card tone-${m.color}`} onClick={()=>diveKind(m.kind)}><span className="metric-label">{m.label} ↗</span><strong className="metric-value">{money(m.value,true)}</strong><small>{m.desc}</small></button>)}</div>
      <div className="analytics-two"><Panel title="Spending vs income · monthly" right={<span className="muted text-small">Select a month</span>}><Trend rows={filtered} onMonth={m=>diveMonth(m,'expense')} onIncome={m=>diveMonth(m,'income')}/></Panel><Panel title="Category breakdown" right={<span className="muted text-small">Select a category</span>}><Donut groups={categories} onSelect={diveCategory}/></Panel></div>
      <div className="analytics-two"><Panel title="Top spending categories"><div className="rank-list">{categories.slice(0,8).map((c,i)=><button key={c.key} className="rank-row" onClick={()=>diveCategory(c.key)}><span className="rank-num">{i+1}</span><span className="dot" style={{background:CATEGORY_COLORS[c.key]??fallbackColor}}/><strong>{c.key}</strong><span>{money(c.amountPaise,true)}</span><span className="rank-arrow">›</span></button>)}</div></Panel><Panel title="Top merchants"><div className="rank-list">{merchants.slice(0,8).map((c,i)=><button key={c.key} className="rank-row" onClick={()=>diveMerchant(c.key)}><span className="rank-num">{i+1}</span><strong>{c.key}</strong><span>{money(c.amountPaise,true)}</span><span className="rank-arrow">›</span></button>)}</div></Panel></div>
     </>}
    {view.page==='budgets'&&<><div className="info-line">Illustrative monthly limits multiplied by months in the selected period; not connected to a budget engine. Click a category to inspect its transactions.</div><div className="budget-grid">{Object.entries({ 'Food & Drinks':9000,'Groceries':10000,'Shopping':8000,'Bills & Utilities':6500,'Transport':5000,'Ordering In':9500,'Entertainment':5500,'Subscriptions':2200}).map(([category,budget])=>{const actual=categories.find(c=>c.key===category)?.amountPaise??0;const periodBudget=budget*periodMonths*100;const ratio=actual/periodBudget;return <button key={category} className="budget-card" onClick={()=>diveCategory(category)}><span>{category} <b>↗</b></span><strong>{money(actual,true)} <small>/ {money(periodBudget,true)} ({periodMonths} mo.)</small></strong><div className="progress-track"><div style={{width:`${Math.min(100,ratio*100)}%`,background:ratio>1?'#ff627a':'#22dca0'}}/></div><small>{Math.round(ratio*100)}% of illustrative target</small></button>})}</div></>}
    {view.page==='accounts'&&<><div className="account-grid">{ACCOUNTS.map(a=>{const accountRows=filterTransactions(rows,{...view.filters,account:a.name});const metric=totals(accountRows);return <button key={a.name} data-testid={`account-${a.institution}`} className="account-card" onClick={()=>diveAccount(a.name)}><span className="account-logo">{a.institution[0]}</span><div><strong>{a.name}</strong><small>{a.type}</small></div><div className="account-stats"><span>Expenses</span><strong>{money(metric.expenses,true)}</strong><span>{accountRows.length} matched entries</span></div><span className="rank-arrow">↗</span></button>})}</div></>}
    {view.page==='reports'&&<><div className="metrics-row">{financeMetrics.map(m=><button key={m.label} className={`metric-card tone-${m.color}`} onClick={()=>diveKind(m.kind)}><span className="metric-label">{m.label}</span><strong className="metric-value">{money(m.value,true)}</strong></button>)}</div><Panel title="Reconciliation check"><div className="reconcile-row"><span>Expenses in filtered ledger</span><strong>{money(amounts.expenses)}</strong></div><div className="reconcile-row"><span>Sum of category chart segments</span><strong>{money(categories.reduce((s,c)=>s+c.amountPaise,0))}</strong></div><div className="reconcile-row"><span>Difference</span><strong className={filteredCorrect?'green-text':'red-text'}>{money(amounts.expenses-categories.reduce((s,c)=>s+c.amountPaise,0))}</strong></div><p className="fineprint">{filteredCorrect?'✓ Category totals reconcile exactly in integer paise.':'Warning: totals do not reconcile.'} Card repayments, investments and own-account transfers are excluded from expenses.</p></Panel><Panel title="Export current view"><p className="muted">The CSV contains {filtered.length} fabricated entries matching your current filters. It can be opened in a spreadsheet for auditing.</p><Button kind="primary" onClick={exportCsv}>↓ Export {filtered.length} synthetic records</Button></Panel></>}
    {view.page==='settings'&&<><Panel title="Privacy & prototype status"><div className="setting-row"><span>Data source</span><strong>Deterministic synthetic ledger</strong></div><div className="setting-row"><span>Backend</span><strong>Not connected (Phase 2)</strong></div><div className="setting-row"><span>Financial SMS access</span><strong>Not implemented (Phase 3)</strong></div><div className="setting-row"><span>Edits</span><strong>Browser localStorage (demo only, not encrypted)</strong></div><div className="setting-row"><span>Demo tag dictionary</span><strong>{TAG_LIBRARY.length} tags, plus custom edits</strong></div><Button onClick={resetDemo}>Reset synthetic dataset</Button></Panel><Panel title="Integrity"><p className="muted">Current spending chart and expense records {filteredCorrect?'reconcile exactly.':'do not reconcile.'} No private CSV rows are bundled with this application.</p></Panel></>}
    {view.page==='new'&&<><SectionTitle title="Add transaction" subtitle="Create a fabricated transaction; live dashboard and reports update immediately."/><EditForm isNew original={{id:`manual-${Date.now().toString(36)}-${Math.floor(Math.random()*1e9).toString(36)}`,date:(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})(),merchant:'',amountPaise:0,direction:'debit',kind:'expense',category:'Other',subcategory:'',account:ACCOUNTS[0].name,institution:ACCOUNTS[0].institution,tags:[],note:''}} save={create} cancel={back}/></>}
    {view.page==='import'&&<ImportPreview existing={rows} onCancel={back}/>}
    {view.page==='detail'&&(()=>{const selected=rows.find(t=>t.id===view.transactionId);return selected?<><SectionTitle title={`${selected.merchant} · ${shortDate(selected.date)}`} subtitle="Edit the synthetic transaction. Your change will update every financial visual."/><EditForm key={selected.id} original={selected} save={save} cancel={back}/></>:<Panel><EmptyState message="Transaction not found in demo data."/><Button onClick={back}>← Back</Button></Panel>})()}
    {view.page!=='settings'&&view.page!=='detail'&&view.page!=='new'&&view.page!=='import'&&<footer className="data-footer"><span className={filteredCorrect?'ok-dot':'bad-dot'}>●</span> Chart-to-ledger reconciliation: {filteredCorrect?'PASS':'FAIL'} · Data is synthetic · No live bank connection · {filtered.length} matching records</footer>}
   </div>
  </main>
  {showDrillNavigation&&<nav className="drill-dock" aria-label="Drilldown navigation"><span className="drill-dock-label">{view.title}</span><DrillControls/></nav>}
  {toast&&<div className="toast" role="status">{toast}</div>}
 </div></DrillNavigationContext.Provider>;
}
