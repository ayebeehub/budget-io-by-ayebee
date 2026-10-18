/** Ledger Phase 1 domain logic. Integer paise throughout; no floating-point accounting. */
export type Direction = 'debit' | 'credit';
export type Kind = 'expense' | 'income' | 'refund' | 'cashback' | 'transfer' | 'savings' | 'investment' | 'card_payment';
export type KindFilter = Kind | 'wealth' | 'all';
export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD, local calendar day
  merchant: string;
  amountPaise: number; // positive integer
  direction: Direction; // never infer classification solely from direction
  kind: Kind;
  category: string;
  subcategory: string;
  account: string;
  institution: string;
  tags: string[];
  note: string;
  time?: string; // HH:mm, optional until SMS/CSV migration implements timestamp precision
}
export type Filters = {
  from: string; to: string; category: string; merchant: string; tag: string;
  account: string; institution: string; kind: KindFilter; search: string;
};
export const EMPTY_FILTERS: Filters = {
  from: '2026-05-01', to: '2026-10-31', category: '', merchant: '', tag: '', account: '', institution: '', kind: 'all', search: ''
};
export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drinks':'#ff4c85', 'Groceries':'#4add9b', 'Shopping':'#a678ff',
  'Bills & Utilities':'#f4be44', 'Transport':'#4a9af8', 'Ordering In':'#e773f2',
  'Entertainment':'#f47762', 'Health':'#32d5d4', 'Subscriptions':'#88a4fc',
  'Travel':'#f79356', 'Other':'#a8b5ce'
};
export const ACCOUNTS = [
  {name:'ICICI ·· 4102', institution:'ICICI', type:'Bank account'},
  {name:'SBI ·· 6821', institution:'SBI', type:'Bank account'},
  {name:'Axis Credit ·· 9017', institution:'Axis', type:'Credit card'},
  {name:'RBL Credit ·· 3884', institution:'RBL', type:'Credit card'},
  {name:'Kotak ·· 5293', institution:'Kotak', type:'Bank account'},
  {name:'Cash wallet', institution:'Cash', type:'Cash'},
  {name:'Kotak ·· 5716', institution:'Kotak', type:'Bank account'}
] as const;
export const TAG_LIBRARY = [
  'Online','UPI','Food','Lunch','Dinner','Breakfast','Snacks','DiningOut','Household','Groceries','Health','Doctor','Medicines','Fitness','Gym','Wellness','Travel','Flights','Hotel','Taxi','Cab','Metro','Fuel','Parking','Utilities','Electricity','Water','Internet','Mobile','Rent','Subscriptions','Streaming','Software','Work','Office','Business','Books','Learning','Courses','Gifts','Family','Friends','Birthday','Shopping','Clothes','Electronics','Gadgets','Home','Kitchen','Savings','Investing','ETF','MutualFunds','Stocks','EmergencyFund','Transfer','Bills','Monthly','Annual','Insurance','Taxes','Refund','Cashback','Weekend','Vacation','Essential','Discretionary','Card','Banking','HealthInsurance','Repairs','Delivery','Coffee','Entertainment','Music','Movies','Gaming','Other'
];
const EXPENSE_MERCHANTS: Array<{merchant:string;category:string;sub:string;tags:string[];min:number;max:number}> = [
  {merchant:'Zomato',category:'Ordering In',sub:'Food delivery',tags:['Online','Food','Dinner'],min:180,max:920},
  {merchant:'Swiggy',category:'Ordering In',sub:'Food delivery',tags:['Online','Food','Lunch'],min:110,max:760},
  {merchant:'Blinkit',category:'Groceries',sub:'Quick commerce',tags:['Online','Groceries','Household'],min:240,max:1800},
  {merchant:'BigBasket',category:'Groceries',sub:'Supermarket',tags:['Groceries','Monthly','Household'],min:650,max:3800},
  {merchant:'Third Wave Coffee',category:'Food & Drinks',sub:'Cafe',tags:['Coffee','DiningOut','Weekend'],min:200,max:850},
  {merchant:'Social Cafe',category:'Food & Drinks',sub:'Restaurant',tags:['DiningOut','Food','Friends'],min:500,max:2800},
  {merchant:'Amazon',category:'Shopping',sub:'Marketplace',tags:['Online','Shopping','Home'],min:450,max:6500},
  {merchant:'Myntra',category:'Shopping',sub:'Clothing',tags:['Clothes','Shopping','Online'],min:600,max:3600},
  {merchant:'Uber',category:'Transport',sub:'Cab',tags:['Taxi','Cab','Travel'],min:110,max:750},
  {merchant:'Rapido',category:'Transport',sub:'Bike taxi',tags:['Taxi','Cab','UPI'],min:60,max:320},
  {merchant:'BESCOM',category:'Bills & Utilities',sub:'Electricity',tags:['Electricity','Monthly','Utilities'],min:850,max:2400},
  {merchant:'Jio Fiber',category:'Bills & Utilities',sub:'Internet',tags:['Internet','Monthly','Bills'],min:600,max:1200},
  {merchant:'Netflix',category:'Subscriptions',sub:'Streaming',tags:['Streaming','Subscriptions','Monthly'],min:149,max:649},
  {merchant:'Google Play',category:'Subscriptions',sub:'Software',tags:['Apps','Subscriptions','Online'],min:79,max:890},
  {merchant:'BookMyShow',category:'Entertainment',sub:'Movies',tags:['Movies','Weekend','Entertainment'],min:260,max:1100},
  {merchant:'Apollo Pharmacy',category:'Health',sub:'Pharmacy',tags:['Medicines','Health','Essential'],min:250,max:1500},
  {merchant:'MakeMyTrip',category:'Travel',sub:'Travel booking',tags:['Travel','Flights','Vacation'],min:3200,max:18000},
  {merchant:'Local Store',category:'Other',sub:'Miscellaneous',tags:['UPI','Other','Essential'],min:90,max:900}
];
function hashRandom(seed: number): () => number {let state=seed>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
const rupees = (amount:number) => Math.round(amount*100);
/** Deterministic, fabricated transactions, not transformed CSV or private user data. */
export function generateSyntheticLedger(): Transaction[] {
  const random=hashRandom(152026);
  const rows:Transaction[]=[];let seq=0;
  const insert=(row:Omit<Transaction,'id'>)=>rows.push({id:`syn-${String(++seq).padStart(5,'0')}`,...row});
  for(let m=5;m<=10;m++) {
    const maxDay=m===10?17:({5:31,6:30,7:31,8:31,9:30} as Record<number,number>)[m];
    const month=`2026-${String(m).padStart(2,'0')}`;
    const date=(day:number)=>`${month}-${String(day).padStart(2,'0')}`;
    insert({date:date(3),merchant:'Acme Technologies',amountPaise:rupees(166000+m*3000),direction:'credit',kind:'income',category:'Salary',subcategory:'Base salary',account:ACCOUNTS[0].name,institution:'ICICI',tags:['Work','Monthly'],note:'Synthetic salary credit'});
    insert({date:date(5),merchant:'ICICI Interest',amountPaise:rupees(220+m*8),direction:'credit',kind:'income',category:'Interest',subcategory:'Savings interest',account:ACCOUNTS[0].name,institution:'ICICI',tags:['Banking'],note:''});
    insert({date:date(7),merchant:'Self transfer',amountPaise:rupees(14500+m*350),direction:'debit',kind:'savings',category:'Savings allocation',subcategory:'Emergency fund',account:ACCOUNTS[0].name,institution:'ICICI',tags:['Savings','EmergencyFund'],note:'Asset allocation, not spending'});
    insert({date:date(8),merchant:'Brokerage investment',amountPaise:rupees(12500+m*200),direction:'debit',kind:'investment',category:'Investments',subcategory:'Mutual funds',account:ACCOUNTS[1].name,institution:'SBI',tags:['Investing','MutualFunds'],note:'Investment transfer, not spending'});
    insert({date:date(11),merchant:'Card repayment',amountPaise:rupees(13750+m*115),direction:'debit',kind:'card_payment',category:'Card repayment',subcategory:'Credit card settlement',account:ACCOUNTS[0].name,institution:'ICICI',tags:['Card','Monthly'],note:'Excluded from expenses to prevent double counting'});
    insert({date:date(12),merchant:'Between own accounts',amountPaise:rupees(5000+m*60),direction:'debit',kind:'transfer',category:'Internal transfers',subcategory:'Own accounts',account:ACCOUNTS[1].name,institution:'SBI',tags:['Transfer','Banking'],note:'Not an expense'});
    insert({date:date(14),merchant:'Purchase refund',amountPaise:rupees(500+m*23),direction:'credit',kind:'refund',category:'Shopping',subcategory:'Reversal',account:ACCOUNTS[2].name,institution:'Axis',tags:['Refund','Shopping'],note:'Refund tracked separately from gross expenses'});
    insert({date:date(15),merchant:'Card cashback',amountPaise:rupees(190+m*13),direction:'credit',kind:'cashback',category:'Rewards',subcategory:'Cashback',account:ACCOUNTS[2].name,institution:'Axis',tags:['Cashback','Card'],note:''});
    const n=m===10?36:74;
    for(let i=0;i<n;i++) {
      const template=EXPENSE_MERCHANTS[Math.floor(random()*EXPENSE_MERCHANTS.length)];
      const day=1+Math.floor(random()*maxDay);
      const account=ACCOUNTS[Math.floor(random()*ACCOUNTS.length)];
      const amount=template.min+random()*(template.max-template.min);
      const third=TAG_LIBRARY[Math.floor(random()*TAG_LIBRARY.length)];
      insert({date:date(day),merchant:template.merchant,amountPaise:rupees(amount),direction:'debit',kind:'expense',category:template.category,subcategory:template.sub,account:account.name,institution:account.institution,tags:[...new Set([...template.tags.slice(0,2),third])],note:''});
    }
  }
  return rows.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
export function validAmountPaise(value:number):boolean {return Number.isSafeInteger(value)&&value>0;}
export function filterTransactions(rows:readonly Transaction[], f:Filters):Transaction[] {
  const q=f.search.toLocaleLowerCase().trim();
  return rows.filter(t=>{
    if(f.from&&t.date<f.from)return false;
    if(f.to&&t.date>f.to)return false;
    if(f.category&&t.category!==f.category)return false;
    if(f.merchant&&t.merchant!==f.merchant)return false;
    if(f.account&&t.account!==f.account)return false;
    if(f.institution&&t.institution!==f.institution)return false;
    if(f.tag&&!t.tags.includes(f.tag))return false;
    if(f.kind!=='all'&&(f.kind==='wealth'?!['savings','investment'].includes(t.kind):t.kind!==f.kind))return false;
    if(q&&!`${t.merchant} ${t.category} ${t.subcategory} ${t.note} ${t.tags.join(' ')} ${t.account} ${t.institution}`.toLowerCase().includes(q))return false;
    return true;
  });
}
export type Agg = {key:string;amountPaise:number;count:number};
export function sumAmount(rows:readonly Transaction[]):number{return rows.reduce((sum,t)=>sum+t.amountPaise,0);}
export function totals(rows:readonly Transaction[]){
  const kinds=(...ks:Kind[])=>sumAmount(rows.filter(t=>ks.includes(t.kind)));
  return {expenses:kinds('expense'),income:kinds('income'),wealth:kinds('savings','investment'),transfers:kinds('transfer'),cardPayments:kinds('card_payment'),refunds:kinds('refund'),cashback:kinds('cashback'),count:rows.length};
}
export function aggregate(rows:readonly Transaction[],by:(t:Transaction)=>string):Agg[]{
  const map=new Map<string,Agg>();
  for(const t of rows){const key=by(t);const item=map.get(key)??{key,amountPaise:0,count:0};item.amountPaise+=t.amountPaise;item.count++;map.set(key,item);}
  return [...map.values()].sort((a,b)=>b.amountPaise-a.amountPaise||a.key.localeCompare(b.key));
}
export function expenseCategories(rows:readonly Transaction[]):Agg[]{return aggregate(rows.filter(t=>t.kind==='expense'),t=>t.category);}
export function expenseMerchants(rows:readonly Transaction[]):Agg[]{return aggregate(rows.filter(t=>t.kind==='expense'),t=>t.merchant);}
export function monthKey(date:string):string{return date.slice(0,7);}
export type MonthAgg={month:string;expenses:number;income:number;count:number};
export function monthlyTrend(rows:readonly Transaction[],months:readonly string[]):MonthAgg[]{
  return months.map(month=>{const selected=rows.filter(t=>monthKey(t.date)===month);return {month,expenses:sumAmount(selected.filter(t=>t.kind==='expense')),income:sumAmount(selected.filter(t=>t.kind==='income')),count:selected.length};});
}
export function lastSixMonths():string[]{return ['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10'];}
export function money(paise:number,zeroDecimals=false):string{
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:zeroDecimals?0:2,maximumFractionDigits:zeroDecimals?0:2}).format(paise/100);
}
export function chartReconciles(rows:readonly Transaction[],grouped:readonly Agg[]):boolean{
  return sumAmount(rows.filter(t=>t.kind==='expense'))===grouped.reduce((n,x)=>n+x.amountPaise,0);
}
