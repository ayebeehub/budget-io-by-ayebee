/* Local-only compatibility preview builder. React 19/Vite source is canonical.
 * Generates a single HTML file using a locally available React 16 UMD copy;
 * a lightweight Hooks adapter is employed solely for the offline preview.
 * Do not deploy this preview: it is NOT the production React build. */
const fs=require('fs');const path=require('path');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const reactBase='/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react/';
const react=fs.readFileSync(reactBase+'umd/react.production.min.js','utf8');
const dom=fs.readFileSync(reactBase+'react-dom.production.min.js','utf8');
const adapter=`
// Offline preview-only compatibility Hooks for the bundled React 16 runtime.
// Each function component is a React class wrapper with independent hook state.
(function(){
  const C=window.React;const oldCreate=C.createElement.bind(C);const cache=new WeakMap();let active=null;
  const eq=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
  function Wrapper(fn){
    class W extends C.Component{
      constructor(props){super(props);this._hooks=[];this._index=0;this._pending=[];this._unmounted=false;this.state={tick:0};}
      render(){const p=active;active=this;this._index=0;this._pending=[];try{return fn(this.props);}finally{active=p;}}
      componentDidMount(){this._commit();} componentDidUpdate(){this._commit();}
      componentWillUnmount(){this._unmounted=true;for(const h of this._hooks){if(h&&typeof h.cleanup==='function')h.cleanup();}}
      _commit(){for(const [i,effect,deps] of this._pending){const h=this._hooks[i];if(typeof h.cleanup==='function')h.cleanup();h.deps=deps;h.cleanup=effect()??undefined;}}
    }
    W.displayName=fn.displayName||fn.name||'CompatComponent';return W;
  }
  C.useState=function(init){const inst=active;if(!inst)throw Error('Hooks outside component');const i=inst._index++;
    if(!inst._hooks[i]){const hook={value:typeof init==='function'?init():init};hook.set=function(next){hook.value=typeof next==='function'?next(hook.value):next;if(!inst._unmounted)inst.setState(s=>({tick:s.tick+1}));};inst._hooks[i]=hook;}
    return [inst._hooks[i].value,inst._hooks[i].set];};
  C.useMemo=function(factory,deps){const inst=active;const i=inst._index++;const h=inst._hooks[i];if(!h||!eq(h.deps,deps)){inst._hooks[i]={value:factory(),deps};}return inst._hooks[i].value;};
  C.useCallback=function(fn,deps){return C.useMemo(()=>fn,deps);};
  C.useEffect=function(effect,deps){const inst=active;const i=inst._index++;const h=inst._hooks[i];if(!h){inst._hooks[i]={deps:undefined,cleanup:undefined};}
    if(!h||!eq(h.deps,deps))inst._pending.push([i,effect,deps]);};
  C.Fragment=function Fragment(p){return oldCreate('span',{style:{display:'contents'}},p.children);};
  C.createElement=function(type,...rest){if(typeof type==='function'&&!(type.prototype&&type.prototype.isReactComponent)){
    let adapted=cache.get(type);if(!adapted){adapted=Wrapper(type);cache.set(type,adapted);}type=adapted;}
    return oldCreate(type,...rest);};
})();
`;
const files=[['domain','src/domain.ts'],['navigation','src/navigation.ts'],['ingestion','src/ingestion.ts'],['App','src/App.tsx']];
let modules='const __modules={};function require(id){if(id==="react")return window.React;if(id==="react-dom")return window.ReactDOM;if(__modules[id])return __modules[id];if(id.endsWith(".js")&&__modules[id.slice(0,-3)])return __modules[id.slice(0,-3)];throw new Error("Missing module: "+id);}\n';
for(const [name,file]of files){const source=read(file);const compiled=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 modules+=`{const module={exports:{}};const exports=module.exports;\n${compiled}\n__modules["./${name}"]=module.exports;}\n`;
}
const script=`window.__LEDGER_STANDALONE__=true;\n${adapter}\n${modules}\nwindow.ReactDOM.render(window.React.createElement(__modules["./App"].default),document.getElementById("root"));`;
const style=read('src/styles.css').replace(/^@import[^;]+;/,'');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#08101e"/><title>Budget IO by AyeBee — Functional Offline Demo</title><style>${style}</style></head><body><div id="root"></div><!-- React 16.x MIT license: Facebook, Inc., 2013-present. Legacy preview-only dependency. --><script>${react}</script><script>${dom}</script><script>${script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
fs.writeFileSync(path.join(root,'budget-io-preview.html'),html);
console.log(`Offline single-file preview: ${Buffer.byteLength(html)} bytes`);
