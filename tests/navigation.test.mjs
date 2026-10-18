import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_FILTERS} from '../build-test/domain.js';
import {drill,goToPage,parentView,parseView,serializeView} from '../build-test/navigation.js';
const home={page:'home',filters:{...EMPTY_FILTERS},trail:[],title:'Overview'};
test('ACCEPTANCE 4: back and breadcrumbs preserve parent date/account/tag filters',()=>{
 const filtered={...home,filters:{...home.filters,from:'2026-08-01',to:'2026-08-31',account:'ICICI ·· 4102'}};
 const cat=drill(filtered,{kind:'expense',category:'Groceries'},'Groceries');
 const merchant=drill(cat,{merchant:'Blinkit'},'Blinkit');
 const tag=drill(merchant,{tag:'Online'},'#Online');
 assert.equal(tag.trail.length,3);
 assert.deepEqual(parentView(tag),merchant);assert.deepEqual(parentView(merchant),cat);
 assert.deepEqual(parentView(cat).filters,filtered.filters);assert.equal(parentView(cat).page,filtered.page);
 assert.equal(parentView(tag,0).filters.account,'ICICI ·· 4102');
 assert.equal(parentView(tag,0).filters.from,'2026-08-01');
 assert.equal(tag.filters.tag,'Online');assert.equal(tag.filters.category,'Groceries');
});
test('URL roundtrip stores all filters and detail ID for browser reload',()=>{
 const view=drill(home,{kind:'expense',tag:'Weekend',search:'coffee & cake'},'Detail','detail','syn-00042');
 const url=serializeView(view);const restored=parseView(url);
 assert.equal(restored.filters.search,'coffee & cake');assert.equal(restored.filters.tag,'Weekend');
 assert.equal(restored.transactionId,'syn-00042');assert.equal(restored.page,'detail');
 assert.equal(goToPage(view,'analytics').filters.tag,'Weekend');
});
