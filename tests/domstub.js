class El{constructor(tag){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.textContent="";
  this.classList={_s:new Set(),add(...c){c.forEach(x=>this._s.add(x))},remove(...c){c.forEach(x=>this._s.delete(x))},
    toggle(c,f){if(f===undefined){this._s.has(c)?this._s.delete(c):this._s.add(c);}else{f?this._s.add(c):this._s.delete(c);}return this._s.has(c)},contains(c){return this._s.has(c)}};
  this._attrs={};this._html="";}
  appendChild(c){this.children.push(c);return c}
  setAttribute(k,v){this._attrs[k]=v}getAttribute(k){return this._attrs[k]}
  addEventListener(){}remove(){}focus(){}click(){}
  set innerHTML(v){this._html=v;this.children=[]}get innerHTML(){return this._html}
  set className(v){this._cn=v}get className(){return this._cn||""}
  querySelector(){return new El("div")}querySelectorAll(){return []}
}
global.document={createElement:t=>new El(t),createTextNode:t=>({nodeType:3,text:t}),
  querySelector:()=>new El("div"),querySelectorAll:()=>[],body:new El("body"),documentElement:new El("html"),addEventListener(){}};
global.window={addEventListener(){}};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.location={hash:"#/login"};
global.confirm=()=>true;global.alert=()=>{};
