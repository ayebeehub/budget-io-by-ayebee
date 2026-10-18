import type {Filters} from './domain.js';
import {EMPTY_FILTERS} from './domain.js';
export type Page = 'home'|'transactions'|'analytics'|'budgets'|'accounts'|'reports'|'settings'|'detail'|'new'|'import';
export interface TrailEntry{label:string;page:Page;filters:Filters;transactionId?:string;}
export interface View{page:Page;filters:Filters;trail:TrailEntry[];title:string;transactionId?:string;}
export const initialView:View={page:'home',filters:{...EMPTY_FILTERS},trail:[],title:'Overview'};
const PAGE_PATHS: Record<Page,string>={home:'/',transactions:'/transactions',analytics:'/analytics',budgets:'/budgets',accounts:'/accounts',reports:'/reports',settings:'/settings',detail:'/transaction',new:'/new',import:'/import'};
export function serializeView(view:View):string{
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(view.filters)){if(value&&!(key==='kind'&&value==='all'))params.set(key,value);}
  if(view.transactionId)params.set('id',view.transactionId);
  const query=params.toString();const route=PAGE_PATHS[view.page]+(query?`?${query}`:'');
  if(typeof window!=='undefined'&&(window as Window & {__LEDGER_STANDALONE__?:boolean}).__LEDGER_STANDALONE__)return window.location.pathname+'#'+route;
  return route;
}
export function parseView(path:string):View{
  const url=new URL(path,'https://ledger.invalid');
  const actual=url.hash.startsWith('#/')?new URL(url.hash.slice(1),'https://ledger.invalid'):url;
  const page=(Object.entries(PAGE_PATHS).find(([,p])=>p===actual.pathname)?.[0]??'home') as Page;
  const filters={...EMPTY_FILTERS};
  for(const key of Object.keys(filters) as Array<keyof Filters>){const value=actual.searchParams.get(key);if(value!==null) filters[key]=value as never;}
  if(!['all','wealth','expense','income','refund','cashback','transfer','savings','investment','card_payment'].includes(filters.kind))filters.kind='all';
  return {page,filters,trail:[],title:page==='home'?'Overview':page==='detail'?'Transaction detail':page[0].toUpperCase()+page.slice(1),transactionId:actual.searchParams.get('id')??undefined};
}
export function drill(current:View,patch:Partial<Filters>,label:string,page:Page='transactions',transactionId?:string):View{
  return {page,filters:{...current.filters,...patch},title:label,transactionId,trail:[...current.trail,{label:current.title,page:current.page,filters:{...current.filters},transactionId:current.transactionId}]};
}
export function goToPage(current:View,page:Page):View{
  return {page,filters:{...current.filters},title:page==='home'?'Overview':page[0].toUpperCase()+page.slice(1),trail:[],transactionId:undefined};
}
export function parentView(current:View,index:number=current.trail.length-1):View{
  const parent=current.trail[index];
  if(!parent)return initialView;
  return {page:parent.page,filters:{...parent.filters},title:parent.label,transactionId:parent.transactionId,trail:current.trail.slice(0,index)};
}
