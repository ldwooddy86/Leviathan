(()=>{var b$=Object.create;var vp=Object.defineProperty;var y$=Object.getOwnPropertyDescriptor;var w$=Object.getOwnPropertyNames;var C$=Object.getPrototypeOf,v$=Object.prototype.hasOwnProperty;var be=(r,t)=>()=>{try{return t||r((t={exports:{}}).exports,t),t.exports}catch(e){throw t=0,e}},Lt=(r,t)=>{for(var e in t)vp(r,e,{get:t[e],enumerable:!0})},$$=(r,t,e,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of w$(t))!v$.call(r,n)&&n!==e&&vp(r,n,{get:()=>t[n],enumerable:!(o=y$(t,n))||o.enumerable});return r};var ld=(r,t,e)=>(e=r!=null?b$(C$(r)):{},$$(t||!r||!r.__esModule?vp(e,"default",{value:r,enumerable:!0}):e,r));var Ed=be((GO,Td)=>{Td.exports=gt;var ye=null;try{ye=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,13,2,96,0,1,127,96,4,127,127,127,127,1,127,3,7,6,0,1,1,1,1,1,6,6,1,127,1,65,0,11,7,50,6,3,109,117,108,0,1,5,100,105,118,95,115,0,2,5,100,105,118,95,117,0,3,5,114,101,109,95,115,0,4,5,114,101,109,95,117,0,5,8,103,101,116,95,104,105,103,104,0,0,10,191,1,6,4,0,35,0,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,126,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,127,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,128,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,129,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,130,34,4,66,32,135,167,36,0,32,4,167,11])),{}).exports}catch{}function gt(r,t,e){this.low=r|0,this.high=t|0,this.unsigned=!!e}gt.prototype.__isLong__;Object.defineProperty(gt.prototype,"__isLong__",{value:!0});function le(r){return(r&&r.__isLong__)===!0}gt.isLong=le;var gd={},xd={};function Io(r,t){var e,o,n;return t?(r>>>=0,(n=0<=r&&r<256)&&(o=xd[r],o)?o:(e=xt(r,(r|0)<0?-1:0,!0),n&&(xd[r]=e),e)):(r|=0,(n=-128<=r&&r<128)&&(o=gd[r],o)?o:(e=xt(r,r<0?-1:0,!1),n&&(gd[r]=e),e))}gt.fromInt=Io;function we(r,t){if(isNaN(r))return t?Eo:Ce;if(t){if(r<0)return Eo;if(r>=Cd)return Sd}else{if(r<=-yd)return ae;if(r+1>=yd)return $d}return r<0?we(-r,t).neg():xt(r%En|0,r/En|0,t)}gt.fromNumber=we;function xt(r,t,e){return new gt(r,t,e)}gt.fromBits=xt;var wl=Math.pow;function Wp(r,t,e){if(r.length===0)throw Error("empty string");if(r==="NaN"||r==="Infinity"||r==="+Infinity"||r==="-Infinity")return Ce;if(typeof t=="number"?(e=t,t=!1):t=!!t,e=e||10,e<2||36<e)throw RangeError("radix");var o;if((o=r.indexOf("-"))>0)throw Error("interior hyphen");if(o===0)return Wp(r.substring(1),t,e).neg();for(var n=we(wl(e,8)),s=Ce,i=0;i<r.length;i+=8){var a=Math.min(8,r.length-i),l=parseInt(r.substring(i,i+a),e);if(a<8){var c=we(wl(e,a));s=s.mul(c).add(we(l))}else s=s.mul(n),s=s.add(we(l))}return s.unsigned=t,s}gt.fromString=Wp;function ke(r,t){return typeof r=="number"?we(r,t):typeof r=="string"?Wp(r,t):xt(r.low,r.high,typeof t=="boolean"?t:r.unsigned)}gt.fromValue=ke;var bd=65536,sS=1<<24,En=bd*bd,Cd=En*En,yd=Cd/2,wd=Io(sS),Ce=Io(0);gt.ZERO=Ce;var Eo=Io(0,!0);gt.UZERO=Eo;var Tn=Io(1);gt.ONE=Tn;var vd=Io(1,!0);gt.UONE=vd;var Vp=Io(-1);gt.NEG_ONE=Vp;var $d=xt(-1,2147483647,!1);gt.MAX_VALUE=$d;var Sd=xt(-1,-1,!0);gt.MAX_UNSIGNED_VALUE=Sd;var ae=xt(0,-2147483648,!1);gt.MIN_VALUE=ae;var M=gt.prototype;M.toInt=function(){return this.unsigned?this.low>>>0:this.low};M.toNumber=function(){return this.unsigned?(this.high>>>0)*En+(this.low>>>0):this.high*En+(this.low>>>0)};M.toString=function(t){if(t=t||10,t<2||36<t)throw RangeError("radix");if(this.isZero())return"0";if(this.isNegative())if(this.eq(ae)){var e=we(t),o=this.div(e),n=o.mul(e).sub(this);return o.toString(t)+n.toInt().toString(t)}else return"-"+this.neg().toString(t);for(var s=we(wl(t,6),this.unsigned),i=this,a="";;){var l=i.div(s),c=i.sub(l.mul(s)).toInt()>>>0,u=c.toString(t);if(i=l,i.isZero())return u+a;for(;u.length<6;)u="0"+u;a=""+u+a}};M.getHighBits=function(){return this.high};M.getHighBitsUnsigned=function(){return this.high>>>0};M.getLowBits=function(){return this.low};M.getLowBitsUnsigned=function(){return this.low>>>0};M.getNumBitsAbs=function(){if(this.isNegative())return this.eq(ae)?64:this.neg().getNumBitsAbs();for(var t=this.high!=0?this.high:this.low,e=31;e>0&&(t&1<<e)==0;e--);return this.high!=0?e+33:e+1};M.isZero=function(){return this.high===0&&this.low===0};M.eqz=M.isZero;M.isNegative=function(){return!this.unsigned&&this.high<0};M.isPositive=function(){return this.unsigned||this.high>=0};M.isOdd=function(){return(this.low&1)===1};M.isEven=function(){return(this.low&1)===0};M.equals=function(t){return le(t)||(t=ke(t)),this.unsigned!==t.unsigned&&this.high>>>31===1&&t.high>>>31===1?!1:this.high===t.high&&this.low===t.low};M.eq=M.equals;M.notEquals=function(t){return!this.eq(t)};M.neq=M.notEquals;M.ne=M.notEquals;M.lessThan=function(t){return this.comp(t)<0};M.lt=M.lessThan;M.lessThanOrEqual=function(t){return this.comp(t)<=0};M.lte=M.lessThanOrEqual;M.le=M.lessThanOrEqual;M.greaterThan=function(t){return this.comp(t)>0};M.gt=M.greaterThan;M.greaterThanOrEqual=function(t){return this.comp(t)>=0};M.gte=M.greaterThanOrEqual;M.ge=M.greaterThanOrEqual;M.compare=function(t){if(le(t)||(t=ke(t)),this.eq(t))return 0;var e=this.isNegative(),o=t.isNegative();return e&&!o?-1:!e&&o?1:this.unsigned?t.high>>>0>this.high>>>0||t.high===this.high&&t.low>>>0>this.low>>>0?-1:1:this.sub(t).isNegative()?-1:1};M.comp=M.compare;M.negate=function(){return!this.unsigned&&this.eq(ae)?ae:this.not().add(Tn)};M.neg=M.negate;M.add=function(t){le(t)||(t=ke(t));var e=this.high>>>16,o=this.high&65535,n=this.low>>>16,s=this.low&65535,i=t.high>>>16,a=t.high&65535,l=t.low>>>16,c=t.low&65535,u=0,p=0,m=0,f=0;return f+=s+c,m+=f>>>16,f&=65535,m+=n+l,p+=m>>>16,m&=65535,p+=o+a,u+=p>>>16,p&=65535,u+=e+i,u&=65535,xt(m<<16|f,u<<16|p,this.unsigned)};M.subtract=function(t){return le(t)||(t=ke(t)),this.add(t.neg())};M.sub=M.subtract;M.multiply=function(t){if(this.isZero())return Ce;if(le(t)||(t=ke(t)),ye){var e=ye.mul(this.low,this.high,t.low,t.high);return xt(e,ye.get_high(),this.unsigned)}if(t.isZero())return Ce;if(this.eq(ae))return t.isOdd()?ae:Ce;if(t.eq(ae))return this.isOdd()?ae:Ce;if(this.isNegative())return t.isNegative()?this.neg().mul(t.neg()):this.neg().mul(t).neg();if(t.isNegative())return this.mul(t.neg()).neg();if(this.lt(wd)&&t.lt(wd))return we(this.toNumber()*t.toNumber(),this.unsigned);var o=this.high>>>16,n=this.high&65535,s=this.low>>>16,i=this.low&65535,a=t.high>>>16,l=t.high&65535,c=t.low>>>16,u=t.low&65535,p=0,m=0,f=0,d=0;return d+=i*u,f+=d>>>16,d&=65535,f+=s*u,m+=f>>>16,f&=65535,f+=i*c,m+=f>>>16,f&=65535,m+=n*u,p+=m>>>16,m&=65535,m+=s*c,p+=m>>>16,m&=65535,m+=i*l,p+=m>>>16,m&=65535,p+=o*u+n*c+s*l+i*a,p&=65535,xt(f<<16|d,p<<16|m,this.unsigned)};M.mul=M.multiply;M.divide=function(t){if(le(t)||(t=ke(t)),t.isZero())throw Error("division by zero");if(ye){if(!this.unsigned&&this.high===-2147483648&&t.low===-1&&t.high===-1)return this;var e=(this.unsigned?ye.div_u:ye.div_s)(this.low,this.high,t.low,t.high);return xt(e,ye.get_high(),this.unsigned)}if(this.isZero())return this.unsigned?Eo:Ce;var o,n,s;if(this.unsigned){if(t.unsigned||(t=t.toUnsigned()),t.gt(this))return Eo;if(t.gt(this.shru(1)))return vd;s=Eo}else{if(this.eq(ae)){if(t.eq(Tn)||t.eq(Vp))return ae;if(t.eq(ae))return Tn;var i=this.shr(1);return o=i.div(t).shl(1),o.eq(Ce)?t.isNegative()?Tn:Vp:(n=this.sub(t.mul(o)),s=o.add(n.div(t)),s)}else if(t.eq(ae))return this.unsigned?Eo:Ce;if(this.isNegative())return t.isNegative()?this.neg().div(t.neg()):this.neg().div(t).neg();if(t.isNegative())return this.div(t.neg()).neg();s=Ce}for(n=this;n.gte(t);){o=Math.max(1,Math.floor(n.toNumber()/t.toNumber()));for(var a=Math.ceil(Math.log(o)/Math.LN2),l=a<=48?1:wl(2,a-48),c=we(o),u=c.mul(t);u.isNegative()||u.gt(n);)o-=l,c=we(o,this.unsigned),u=c.mul(t);c.isZero()&&(c=Tn),s=s.add(c),n=n.sub(u)}return s};M.div=M.divide;M.modulo=function(t){if(le(t)||(t=ke(t)),ye){var e=(this.unsigned?ye.rem_u:ye.rem_s)(this.low,this.high,t.low,t.high);return xt(e,ye.get_high(),this.unsigned)}return this.sub(this.div(t).mul(t))};M.mod=M.modulo;M.rem=M.modulo;M.not=function(){return xt(~this.low,~this.high,this.unsigned)};M.and=function(t){return le(t)||(t=ke(t)),xt(this.low&t.low,this.high&t.high,this.unsigned)};M.or=function(t){return le(t)||(t=ke(t)),xt(this.low|t.low,this.high|t.high,this.unsigned)};M.xor=function(t){return le(t)||(t=ke(t)),xt(this.low^t.low,this.high^t.high,this.unsigned)};M.shiftLeft=function(t){return le(t)&&(t=t.toInt()),(t&=63)===0?this:t<32?xt(this.low<<t,this.high<<t|this.low>>>32-t,this.unsigned):xt(0,this.low<<t-32,this.unsigned)};M.shl=M.shiftLeft;M.shiftRight=function(t){return le(t)&&(t=t.toInt()),(t&=63)===0?this:t<32?xt(this.low>>>t|this.high<<32-t,this.high>>t,this.unsigned):xt(this.high>>t-32,this.high>=0?0:-1,this.unsigned)};M.shr=M.shiftRight;M.shiftRightUnsigned=function(t){if(le(t)&&(t=t.toInt()),t&=63,t===0)return this;var e=this.high;if(t<32){var o=this.low;return xt(o>>>t|e<<32-t,e>>>t,this.unsigned)}else return t===32?xt(e,0,this.unsigned):xt(e>>>t-32,0,this.unsigned)};M.shru=M.shiftRightUnsigned;M.shr_u=M.shiftRightUnsigned;M.toSigned=function(){return this.unsigned?xt(this.low,this.high,!1):this};M.toUnsigned=function(){return this.unsigned?this:xt(this.low,this.high,!0)};M.toBytes=function(t){return t?this.toBytesLE():this.toBytesBE()};M.toBytesLE=function(){var t=this.high,e=this.low;return[e&255,e>>>8&255,e>>>16&255,e>>>24,t&255,t>>>8&255,t>>>16&255,t>>>24]};M.toBytesBE=function(){var t=this.high,e=this.low;return[t>>>24,t>>>16&255,t>>>8&255,t&255,e>>>24,e>>>16&255,e>>>8&255,e&255]};gt.fromBytes=function(t,e,o){return o?gt.fromBytesLE(t,e):gt.fromBytesBE(t,e)};gt.fromBytesLE=function(t,e){return new gt(t[0]|t[1]<<8|t[2]<<16|t[3]<<24,t[4]|t[5]<<8|t[6]<<16|t[7]<<24,e)};gt.fromBytesBE=function(t,e){return new gt(t[4]<<24|t[5]<<16|t[6]<<8|t[7],t[0]<<24|t[1]<<16|t[2]<<8|t[3],e)}});var ph=be(()=>{});var mh=be(()=>{});var Wg=be((Vg,$m)=>{(function(r,t,e){function o(a){var l=this,c=i();l.next=function(){var u=2091639*l.s0+l.c*23283064365386963e-26;return l.s0=l.s1,l.s1=l.s2,l.s2=u-(l.c=u|0)},l.c=1,l.s0=c(" "),l.s1=c(" "),l.s2=c(" "),l.s0-=c(a),l.s0<0&&(l.s0+=1),l.s1-=c(a),l.s1<0&&(l.s1+=1),l.s2-=c(a),l.s2<0&&(l.s2+=1),c=null}function n(a,l){return l.c=a.c,l.s0=a.s0,l.s1=a.s1,l.s2=a.s2,l}function s(a,l){var c=new o(a),u=l&&l.state,p=c.next;return p.int32=function(){return c.next()*4294967296|0},p.double=function(){return p()+(p()*2097152|0)*11102230246251565e-32},p.quick=p,u&&(typeof u=="object"&&n(u,c),p.state=function(){return n(c,{})}),p}function i(){var a=4022871197,l=function(c){c=String(c);for(var u=0;u<c.length;u++){a+=c.charCodeAt(u);var p=.02519603282416938*a;a=p>>>0,p-=a,p*=a,a=p>>>0,p-=a,a+=p*4294967296}return(a>>>0)*23283064365386963e-26};return l}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.alea=s})(Vg,typeof $m=="object"&&$m,typeof define=="function"&&define)});var Kg=be((zg,Sm)=>{(function(r,t,e){function o(i){var a=this,l="";a.x=0,a.y=0,a.z=0,a.w=0,a.next=function(){var u=a.x^a.x<<11;return a.x=a.y,a.y=a.z,a.z=a.w,a.w^=a.w>>>19^u^u>>>8},i===(i|0)?a.x=i:l+=i;for(var c=0;c<l.length+64;c++)a.x^=l.charCodeAt(c)|0,a.next()}function n(i,a){return a.x=i.x,a.y=i.y,a.z=i.z,a.w=i.w,a}function s(i,a){var l=new o(i),c=a&&a.state,u=function(){return(l.next()>>>0)/4294967296};return u.double=function(){do var p=l.next()>>>11,m=(l.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=l.next,u.quick=u,c&&(typeof c=="object"&&n(c,l),u.state=function(){return n(l,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xor128=s})(zg,typeof Sm=="object"&&Sm,typeof define=="function"&&define)});var qg=be((Hg,Tm)=>{(function(r,t,e){function o(i){var a=this,l="";a.next=function(){var u=a.x^a.x>>>2;return a.x=a.y,a.y=a.z,a.z=a.w,a.w=a.v,(a.d=a.d+362437|0)+(a.v=a.v^a.v<<4^(u^u<<1))|0},a.x=0,a.y=0,a.z=0,a.w=0,a.v=0,i===(i|0)?a.x=i:l+=i;for(var c=0;c<l.length+64;c++)a.x^=l.charCodeAt(c)|0,c==l.length&&(a.d=a.x<<10^a.x>>>4),a.next()}function n(i,a){return a.x=i.x,a.y=i.y,a.z=i.z,a.w=i.w,a.v=i.v,a.d=i.d,a}function s(i,a){var l=new o(i),c=a&&a.state,u=function(){return(l.next()>>>0)/4294967296};return u.double=function(){do var p=l.next()>>>11,m=(l.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=l.next,u.quick=u,c&&(typeof c=="object"&&n(c,l),u.state=function(){return n(l,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xorwow=s})(Hg,typeof Tm=="object"&&Tm,typeof define=="function"&&define)});var jg=be((Xg,Em)=>{(function(r,t,e){function o(i){var a=this;a.next=function(){var c=a.x,u=a.i,p,m,f;return p=c[u],p^=p>>>7,m=p^p<<24,p=c[u+1&7],m^=p^p>>>10,p=c[u+3&7],m^=p^p>>>3,p=c[u+4&7],m^=p^p<<7,p=c[u+7&7],p=p^p<<13,m^=p^p<<9,c[u]=m,a.i=u+1&7,m};function l(c,u){var p,m,f=[];if(u===(u|0))m=f[0]=u;else for(u=""+u,p=0;p<u.length;++p)f[p&7]=f[p&7]<<15^u.charCodeAt(p)+f[p+1&7]<<13;for(;f.length<8;)f.push(0);for(p=0;p<8&&f[p]===0;++p);for(p==8?m=f[7]=-1:m=f[p],c.x=f,c.i=0,p=256;p>0;--p)c.next()}l(a,i)}function n(i,a){return a.x=i.x.slice(),a.i=i.i,a}function s(i,a){i==null&&(i=+new Date);var l=new o(i),c=a&&a.state,u=function(){return(l.next()>>>0)/4294967296};return u.double=function(){do var p=l.next()>>>11,m=(l.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=l.next,u.quick=u,c&&(c.x&&n(c,l),u.state=function(){return n(l,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xorshift7=s})(Xg,typeof Em=="object"&&Em,typeof define=="function"&&define)});var Zg=be((Yg,Im)=>{(function(r,t,e){function o(i){var a=this;a.next=function(){var c=a.w,u=a.X,p=a.i,m,f;return a.w=c=c+1640531527|0,f=u[p+34&127],m=u[p=p+1&127],f^=f<<13,m^=m<<17,f^=f>>>15,m^=m>>>12,f=u[p]=f^m,a.i=p,f+(c^c>>>16)|0};function l(c,u){var p,m,f,d,x,g=[],b=128;for(u===(u|0)?(m=u,u=null):(u=u+"\0",m=0,b=Math.max(b,u.length)),f=0,d=-32;d<b;++d)u&&(m^=u.charCodeAt((d+32)%u.length)),d===0&&(x=m),m^=m<<10,m^=m>>>15,m^=m<<4,m^=m>>>13,d>=0&&(x=x+1640531527|0,p=g[d&127]^=m+x,f=p==0?f+1:0);for(f>=128&&(g[(u&&u.length||0)&127]=-1),f=127,d=512;d>0;--d)m=g[f+34&127],p=g[f=f+1&127],m^=m<<13,p^=p<<17,m^=m>>>15,p^=p>>>12,g[f]=m^p;c.w=x,c.X=g,c.i=f}l(a,i)}function n(i,a){return a.i=i.i,a.w=i.w,a.X=i.X.slice(),a}function s(i,a){i==null&&(i=+new Date);var l=new o(i),c=a&&a.state,u=function(){return(l.next()>>>0)/4294967296};return u.double=function(){do var p=l.next()>>>11,m=(l.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=l.next,u.quick=u,c&&(c.X&&n(c,l),u.state=function(){return n(l,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.xor4096=s})(Yg,typeof Im=="object"&&Im,typeof define=="function"&&define)});var Jg=be((Qg,Nm)=>{(function(r,t,e){function o(i){var a=this,l="";a.next=function(){var u=a.b,p=a.c,m=a.d,f=a.a;return u=u<<25^u>>>7^p,p=p-m|0,m=m<<24^m>>>8^f,f=f-u|0,a.b=u=u<<20^u>>>12^p,a.c=p=p-m|0,a.d=m<<16^p>>>16^f,a.a=f-u|0},a.a=0,a.b=0,a.c=-1640531527,a.d=1367130551,i===Math.floor(i)?(a.a=i/4294967296|0,a.b=i|0):l+=i;for(var c=0;c<l.length+20;c++)a.b^=l.charCodeAt(c)|0,a.next()}function n(i,a){return a.a=i.a,a.b=i.b,a.c=i.c,a.d=i.d,a}function s(i,a){var l=new o(i),c=a&&a.state,u=function(){return(l.next()>>>0)/4294967296};return u.double=function(){do var p=l.next()>>>11,m=(l.next()>>>0)/4294967296,f=(p+m)/(1<<21);while(f===0);return f},u.int32=l.next,u.quick=u,c&&(typeof c=="object"&&n(c,l),u.state=function(){return n(l,{})}),u}t&&t.exports?t.exports=s:e&&e.amd?e(function(){return s}):this.tychei=s})(Qg,typeof Nm=="object"&&Nm,typeof define=="function"&&define)});var tx=be(()=>{});var rx=be((ex,ic)=>{(function(r,t,e){var o=256,n=6,s=52,i="random",a=e.pow(o,n),l=e.pow(2,s),c=l*2,u=o-1,p;function m(S,E,N){var R=[];E=E==!0?{entropy:!0}:E||{};var A=g(x(E.entropy?[S,$(t)]:S??b(),3),R),_=new f(R),P=function(){for(var O=_.g(n),B=a,W=0;O<l;)O=(O+W)*o,B*=o,W=_.g(1);for(;O>=c;)O/=2,B/=2,W>>>=1;return(O+W)/B};return P.int32=function(){return _.g(4)|0},P.quick=function(){return _.g(4)/4294967296},P.double=P,g($(_.S),t),(E.pass||N||function(O,B,W,J){return J&&(J.S&&d(J,_),O.state=function(){return d(_,{})}),W?(e[i]=O,B):O})(P,A,"global"in E?E.global:this==e,E.state)}function f(S){var E,N=S.length,R=this,A=0,_=R.i=R.j=0,P=R.S=[];for(N||(S=[N++]);A<o;)P[A]=A++;for(A=0;A<o;A++)P[A]=P[_=u&_+S[A%N]+(E=P[A])],P[_]=E;(R.g=function(O){for(var B,W=0,J=R.i,et=R.j,st=R.S;O--;)B=st[J=u&J+1],W=W*o+st[u&(st[J]=st[et=u&et+B])+(st[et]=B)];return R.i=J,R.j=et,W})(o)}function d(S,E){return E.i=S.i,E.j=S.j,E.S=S.S.slice(),E}function x(S,E){var N=[],R=typeof S,A;if(E&&R=="object")for(A in S)try{N.push(x(S[A],E-1))}catch{}return N.length?N:R=="string"?S:S+"\0"}function g(S,E){for(var N=S+"",R,A=0;A<N.length;)E[u&A]=u&(R^=E[u&A]*19)+N.charCodeAt(A++);return $(E)}function b(){try{var S;return p&&(S=p.randomBytes)?S=S(o):(S=new Uint8Array(o),(r.crypto||r.msCrypto).getRandomValues(S)),$(S)}catch{var E=r.navigator,N=E&&E.plugins;return[+new Date,r,N,r.screen,$(t)]}}function $(S){return String.fromCharCode.apply(0,S)}if(g(e.random(),t),typeof ic=="object"&&ic.exports){ic.exports=m;try{p=tx()}catch{}}else typeof define=="function"&&define.amd?define(function(){return m}):e["seed"+i]=m})(typeof self<"u"?self:ex,[],Math)});var nx=be((a5,ox)=>{var zI=Wg(),KI=Kg(),HI=qg(),qI=jg(),XI=Zg(),jI=Jg(),Bo=rx();Bo.alea=zI;Bo.xor128=KI;Bo.xorwow=HI;Bo.xorshift7=qI;Bo.xor4096=XI;Bo.tychei=jI;ox.exports=Bo});var Rc={};Lt(Rc,{Abs:()=>mn,Acos:()=>ms,Acosh:()=>fs,AdadeltaOptimizer:()=>Vr,AdagradOptimizer:()=>Wr,AdamOptimizer:()=>zr,AdamaxOptimizer:()=>Kr,Add:()=>Tr,AddN:()=>ds,All:()=>rl,Any:()=>ol,ArgMax:()=>hs,ArgMin:()=>gs,Asin:()=>xs,Asinh:()=>bs,Atan:()=>ys,Atan2:()=>Cs,Atanh:()=>ws,AvgPool:()=>vs,AvgPool3D:()=>$s,AvgPool3DGrad:()=>_p,AvgPoolGrad:()=>Ap,BatchMatMul:()=>Ss,BatchToSpaceND:()=>Ts,Bincount:()=>Es,BitwiseAnd:()=>oo,BroadcastArgs:()=>Is,BroadcastTo:()=>K$,Cast:()=>Er,Ceil:()=>no,ClipByValue:()=>Ns,Complex:()=>fn,ComplexAbs:()=>ks,Concat:()=>Rs,Conv2D:()=>As,Conv2DBackpropFilter:()=>_s,Conv2DBackpropInput:()=>Ds,Conv3D:()=>Fs,Conv3DBackpropFilterV2:()=>Dp,Conv3DBackpropInputV2:()=>Ps,Cos:()=>nl,Cosh:()=>Os,CropAndResize:()=>Bs,Cumprod:()=>Ms,Cumsum:()=>Ls,DataStorage:()=>sn,DenseBincount:()=>Gs,DepthToSpace:()=>Us,DepthwiseConv2dNative:()=>Vs,DepthwiseConv2dNativeBackpropFilter:()=>Ws,DepthwiseConv2dNativeBackpropInput:()=>zs,Diag:()=>Ks,Dilation2D:()=>Hs,Dilation2DBackpropFilter:()=>q$,Dilation2DBackpropInput:()=>H$,Draw:()=>sl,ENV:()=>el,Einsum:()=>Xs,Elu:()=>il,EluGrad:()=>Fp,Environment:()=>pn,Equal:()=>so,Erf:()=>al,Exp:()=>dn,ExpandDims:()=>js,Expm1:()=>io,FFT:()=>ll,Fill:()=>Ys,FlipLeftRight:()=>Zs,Floor:()=>ao,FloorDiv:()=>lo,FromPixels:()=>wn,FusedBatchNorm:()=>Qs,FusedConv2D:()=>vn,FusedDepthwiseConv2D:()=>$n,GatherNd:()=>ti,GatherV2:()=>Js,Greater:()=>co,GreaterEqual:()=>uo,IFFT:()=>ei,Identity:()=>Ir,Imag:()=>ri,IsFinite:()=>oi,IsInf:()=>ni,IsNan:()=>si,KernelBackend:()=>vr,LRN:()=>cl,LRNGrad:()=>Pp,LeakyRelu:()=>ii,Less:()=>po,LessEqual:()=>mo,LinSpace:()=>ai,Log:()=>hn,Log1p:()=>li,LogSoftmax:()=>j$,LogicalAnd:()=>ci,LogicalNot:()=>ui,LogicalOr:()=>pi,LogicalXor:()=>X$,LowerBound:()=>Y$,MatrixBandPart:()=>Z$,Max:()=>ul,MaxPool:()=>mi,MaxPool3D:()=>fi,MaxPool3DGrad:()=>Mp,MaxPoolGrad:()=>Op,MaxPoolWithArgmax:()=>di,Maximum:()=>fo,Mean:()=>hi,Min:()=>pl,Minimum:()=>ho,MirrorPad:()=>gi,Mod:()=>ml,MomentumOptimizer:()=>Hr,Multinomial:()=>xi,Multiply:()=>go,Neg:()=>bi,NonMaxSuppressionV3:()=>yi,NonMaxSuppressionV4:()=>wi,NonMaxSuppressionV5:()=>Ci,NotEqual:()=>xo,OP_SCOPE_SUFFIX:()=>sm,OneHot:()=>$i,OnesLike:()=>vi,Optimizer:()=>qt,OptimizerConstructors:()=>zn,Pack:()=>Si,PadV2:()=>Ti,Pool:()=>Q$,Pow:()=>fl,Prelu:()=>Ei,Prod:()=>gn,RMSPropOptimizer:()=>qr,RaggedGather:()=>Ii,RaggedRange:()=>Ni,RaggedTensorToTensor:()=>ki,Range:()=>Ri,Rank:()=>Sl,Real:()=>xn,RealDiv:()=>qs,Reciprocal:()=>Ai,Reduction:()=>bt,Relu:()=>_i,Relu6:()=>Oi,Reshape:()=>Di,ResizeBilinear:()=>Pi,ResizeBilinearGrad:()=>Bp,ResizeNearestNeighbor:()=>Fi,ResizeNearestNeighborGrad:()=>Lp,Reverse:()=>Mi,RotateWithOffset:()=>fa,Round:()=>Li,Rsqrt:()=>bo,SGDOptimizer:()=>tr,ScatterNd:()=>Bi,SearchSorted:()=>Ui,Select:()=>Vi,Selu:()=>Wi,Sigmoid:()=>yo,Sign:()=>Ki,Sin:()=>dl,Sinh:()=>zi,Slice:()=>bn,Softmax:()=>ji,Softplus:()=>Hi,SpaceToBatchND:()=>qi,SparseFillEmptyRows:()=>Yi,SparseReshape:()=>Zi,SparseSegmentMean:()=>Qi,SparseSegmentSum:()=>Ji,SparseToDense:()=>ta,SplitV:()=>Xi,Sqrt:()=>wo,Square:()=>Gp,SquaredDifference:()=>Co,StaticRegexReplace:()=>vo,Step:()=>ma,StridedSlice:()=>ea,StringNGrams:()=>ra,StringSplit:()=>oa,StringToHashBucketFast:()=>na,Sub:()=>yn,Sum:()=>hl,Tan:()=>gl,Tanh:()=>sa,Tensor:()=>lt,TensorBuffer:()=>ce,TensorScatterUpdate:()=>Gi,Tile:()=>$o,TopK:()=>ia,Transform:()=>aa,Transpose:()=>So,Unique:()=>la,Unpack:()=>ca,UnsortedSegmentSum:()=>ua,UpperBound:()=>J$,Variable:()=>Ue,ZerosLike:()=>pa,_FusedMatMul:()=>Cn,abs:()=>Dt,acos:()=>fh,acosh:()=>dh,add:()=>U,addN:()=>hh,all:()=>gh,any:()=>xh,argMax:()=>bh,argMin:()=>yh,asin:()=>wh,asinh:()=>Ch,atan:()=>vh,atan2:()=>$h,atanh:()=>Sh,avgPool:()=>Pl,avgPool3d:()=>Ih,backend:()=>cm,backend_util:()=>T,basicLSTMCell:()=>Nh,batchNorm:()=>Dr,batchNorm2d:()=>Rh,batchNorm3d:()=>Ah,batchNorm4d:()=>_h,batchToSpaceND:()=>Ol,bincount:()=>Ml,bitwiseAnd:()=>Dh,booleanMaskAsync:()=>Z2,broadcastArgs:()=>Fh,broadcastTo:()=>Fr,broadcast_util:()=>ur,browser:()=>Xm,buffer:()=>j,cast:()=>Y,ceil:()=>Ph,clipByValue:()=>Oh,clone:()=>ve,complex:()=>te,concat:()=>vt,concat1d:()=>Mh,concat2d:()=>Lh,concat3d:()=>Bh,concat4d:()=>Gh,conv1d:()=>Uh,conv2d:()=>Pr,conv2dTranspose:()=>Vh,conv3d:()=>Wh,conv3dTranspose:()=>Kh,copyRegisteredKernels:()=>nS,cos:()=>Hh,cosh:()=>qh,cosineWindow:()=>Aa,cumprod:()=>Xh,cumsum:()=>jh,customGrad:()=>Ht,denseBincount:()=>Yh,deprecationWarn:()=>Ud,depthToSpace:()=>Zh,depthwiseConv2d:()=>Fn,device_util:()=>ir,diag:()=>Qh,dilation2d:()=>Jh,disableDeprecationWarnings:()=>kS,dispose:()=>St,disposeVariables:()=>RS,div:()=>Z,divNoNan:()=>eg,dot:()=>rg,dropout:()=>cN,einsum:()=>Or,elu:()=>Ul,enableDebugMode:()=>NS,enableProdMode:()=>IS,enclosingPowerOfTwo:()=>Fm,engine:()=>We,ensureShape:()=>og,env:()=>I,equal:()=>Gl,erf:()=>ng,euclideanNorm:()=>ag,exp:()=>$e,expandDims:()=>De,expm1:()=>lg,eye:()=>Vl,fft:()=>Mn,fill:()=>Ye,findBackend:()=>MS,findBackendFactory:()=>LS,floor:()=>Wl,floorDiv:()=>Fl,fused:()=>Pm,gather:()=>zl,gatherND:()=>aN,gather_util:()=>jm,getBackend:()=>am,getGradient:()=>xl,getKernel:()=>To,getKernelsForBackend:()=>ha,grad:()=>dg,grads:()=>hg,greater:()=>Po,greaterEqual:()=>Kl,ifft:()=>Uo,imag:()=>Lr,image:()=>fk,inTopKAsync:()=>pN,io:()=>Hm,irfft:()=>fc,isFinite:()=>cg,isInf:()=>ug,isNaN:()=>pg,keep:()=>im,kernel_impls:()=>Fe,leakyRelu:()=>Hl,less:()=>Ia,lessEqual:()=>Pn,linalg:()=>dk,linspace:()=>mg,localResponseNormalization:()=>fg,log:()=>fr,log1p:()=>ql,logSigmoid:()=>bg,logSoftmax:()=>yg,logSumExp:()=>Zl,logicalAnd:()=>Oo,logicalNot:()=>Ql,logicalOr:()=>Jl,logicalXor:()=>wg,losses:()=>hk,lowerBound:()=>Cg,matMul:()=>Q,math:()=>qm,max:()=>Ze,maxPool:()=>ec,maxPool3d:()=>vg,maxPoolWithArgmax:()=>$g,maximum:()=>rc,mean:()=>Mo,memory:()=>AS,meshgrid:()=>Sg,min:()=>Ea,minimum:()=>Lo,mirrorPad:()=>Tg,mod:()=>Eg,moments:()=>Ig,movingAverage:()=>tN,mul:()=>F,multiRNNCell:()=>Ng,multinomial:()=>kg,neg:()=>Vt,nextFrame:()=>Nc,norm:()=>Fo,notEqual:()=>oc,oneHot:()=>ka,ones:()=>Qe,onesLike:()=>Rg,op:()=>y,outerProduct:()=>Ag,pad:()=>Je,pad1d:()=>_g,pad2d:()=>Dg,pad3d:()=>Fg,pad4d:()=>Pg,pool:()=>Og,pow:()=>mr,prelu:()=>sc,print:()=>Dl,prod:()=>Mg,profile:()=>_S,raggedGather:()=>Lg,raggedRange:()=>Bg,raggedTensorToTensor:()=>Gg,rand:()=>Ug,randomGamma:()=>ax,randomNormal:()=>uc,randomStandardNormal:()=>lx,randomUniform:()=>On,randomUniformInt:()=>cx,range:()=>Br,ready:()=>PS,real:()=>dr,reciprocal:()=>ux,registerBackend:()=>lm,registerGradient:()=>eS,registerKernel:()=>bl,relu:()=>Gr,relu6:()=>pc,removeBackend:()=>OS,reshape:()=>k,reverse:()=>ge,reverse1d:()=>px,reverse2d:()=>mx,reverse3d:()=>fx,reverse4d:()=>dx,rfft:()=>Ln,round:()=>mc,rsqrt:()=>hx,scalar:()=>H,scatterND:()=>rN,scatter_util:()=>Ra,searchSorted:()=>Na,selu:()=>gx,separableConv2d:()=>xx,serialization:()=>Bm,setBackend:()=>FS,setPlatform:()=>BS,setdiff1dAsync:()=>bx,sigmoid:()=>je,sign:()=>yx,signal:()=>mk,sin:()=>wx,sinh:()=>Cx,slice:()=>rt,slice1d:()=>vx,slice2d:()=>$x,slice3d:()=>Sx,slice4d:()=>Tx,slice_util:()=>Zt,softmax:()=>Ex,softplus:()=>Yl,spaceToBatchND:()=>nc,sparse:()=>gk,sparseToDense:()=>sN,spectral:()=>pk,split:()=>hr,sqrt:()=>ee,square:()=>Ft,squaredDifference:()=>dc,squeeze:()=>Bn,stack:()=>gr,step:()=>hc,stridedSlice:()=>Ix,string:()=>xk,sub:()=>z,sum:()=>ot,sumOutType:()=>Rr,tan:()=>Nx,tanh:()=>Ta,tensor:()=>Ve,tensor1d:()=>Pt,tensor2d:()=>Ur,tensor3d:()=>gc,tensor4d:()=>kx,tensor5d:()=>Rx,tensor6d:()=>Ax,tensorScatterUpdate:()=>Dx,tensor_util:()=>tm,test_util:()=>_m,tidy:()=>at,tile:()=>Mr,time:()=>DS,topk:()=>Fx,train:()=>jk,transpose:()=>Vn,truncatedNormal:()=>Px,unique:()=>Ox,unregisterGradient:()=>oS,unregisterKernel:()=>rS,unsortedSegmentSum:()=>Mx,unstack:()=>Un,upcastType:()=>Bt,upperBound:()=>Lx,util:()=>C,valueAndGrad:()=>gg,valueAndGrads:()=>xg,variable:()=>Bx,variableGrads:()=>Xl,version_core:()=>o0,where:()=>he,whereAsync:()=>bc,zeros:()=>Se,zerosLike:()=>Nt});var sn=class{constructor(t,e){this.backend=t,this.dataMover=e,this.data=new WeakMap,this.dataIdsCount=0}get(t){return this.data.has(t)||this.dataMover.moveData(this.backend,t),this.data.get(t)}set(t,e){this.dataIdsCount++,this.data.set(t,e)}has(t){return this.data.has(t)}delete(t){return this.dataIdsCount--,this.data.delete(t)}numDataIds(){return this.dataIdsCount}},vr=class{refCount(t){return ie("refCount")}incRef(t){return ie("incRef")}timerAvailable(){return!0}time(t){return ie("time")}read(t){return ie("read")}readSync(t){return ie("readSync")}readToGPU(t,e){return ie("readToGPU")}numDataIds(){return ie("numDataIds")}disposeData(t,e){return ie("disposeData")}write(t,e,o){return ie("write")}move(t,e,o,n,s){return ie("move")}createTensorFromGPUData(t,e,o){return ie("createTensorFromGPUData")}memory(){return ie("memory")}floatPrecision(){return ie("floatPrecision")}epsilon(){return this.floatPrecision()===32?1e-7:1e-4}dispose(){return ie("dispose")}};function ie(r){throw new Error(`'${r}' not yet implemented or not found in the registry. This kernel may not be supported by the tfjs backend you have chosen`)}function cd(r){let t=r.length,e=0;for(;t>0;)e=Math.random()*t|0,t--,Ja(r,t,e)}function S$(r,t){if(r.length!==t.length)throw new Error(`Array sizes must match to be shuffled together First array length was ${r.length}Second array length was ${t.length}`);let e=r.length,o=0;for(;e>0;)o=Math.random()*e|0,e--,Ja(r,e,o),Ja(t,e,o)}function an(r,t,e){return Math.max(r,Math.min(t,e))}function T$(r){return r%2===0?r:r+1}function Ja(r,t,e){let o=r[t];r[t]=r[e],r[e]=o}function E$(r){let t=0;for(let e=0;e<r.length;e++)t+=r[e];return t}function I$(r,t){let e=Math.random();return t*e+(1-e)*r}function N$(r,t){let e=0;for(let o=0;o<r.length;o++){let n=Number(r[o])-Number(t[o]);e+=n*n}return e}function v(r,t){if(!r)throw new Error(typeof t=="string"?t:t())}function ut(r,t,e=""){v(Xt(r,t),()=>e+` Shapes ${r} and ${t} must match`)}function de(r){v(r!=null,()=>"The input to the tensor constructor must be a non-null value.")}function X(r){if(r.length===0)return 1;let t=r[0];for(let e=1;e<r.length;e++)t*=r[e];return t}function k$(r){return r.length===0}function $p(r,t){if(r===t)return!0;if(r==null||t==null||r.length!==t.length)return!1;for(let e=0;e<r.length;e++)if(r[e]!==null&&t[e]!==null&&r[e]!==t[e])return!1;return!0}function Xt(r,t){if(r===t)return!0;if(r==null||t==null||r.length!==t.length)return!1;for(let e=0;e<r.length;e++)if(r[e]!==t[e])return!1;return!0}function sr(r){return r%1===0}function R$(r){if(Math.tanh!=null)return Math.tanh(r);if(r===1/0)return 1;if(r===-1/0)return-1;{let t=Math.exp(2*r);return(t-1)/(t+1)}}function A$(r){let t=Math.ceil(Math.sqrt(r));return[t,Math.ceil(r/t)]}function _$(r){let t=new Uint32Array(r);for(let e=0;e<r;++e)t[e]=e;return cd(t),t}function eo(r,t){return t<=r.length?r:r+" ".repeat(t-r.length)}function D$(r,t=n=>0,e,o){return new Promise((n,s)=>{let i=0,a=()=>{if(r()){n();return}i++;let l=t(i);if(e!=null&&i>=e){s();return}o!=null?o(a,l):setTimeout(a,l)};a()})}function F$(r,t){let e=1,o=-1;for(let s=0;s<r.length;++s)if(r[s]>=0)e*=r[s];else if(r[s]===-1){if(o!==-1)throw Error(`Shapes can only have 1 implicit size. Found -1 at dim ${o} and dim ${s}`);o=s}else if(r[s]<0)throw Error(`Shapes can not be < 0. Found ${r[s]} at dim ${s}`);if(o===-1){if(t>0&&t!==e)throw Error(`Size(${t}) must match the product of shape ${r}`);return r}if(e===0)throw Error(`Cannot infer the missing size in [${r}] when there are 0 elements`);if(t%e!==0)throw Error(`The implicit shape can't be a fractional number. Got ${t} / ${e}`);let n=r.slice();return n[o]=t/e,n}function $r(r,t){let e=t.length;return r=r==null?t.map((o,n)=>n):[].concat(r),v(r.every(o=>o>=-e&&o<e),()=>`All values in axis param must be in range [-${e}, ${e}) but got axis ${r}`),v(r.every(o=>sr(o)),()=>`All values in axis param must be integers but got axis ${r}`),r.map(o=>o<0?e+o:o)}function Sp(r,t){let e=[],o=[],n=t!=null&&Array.isArray(t)&&t.length===0,s=t==null||n?null:$r(t,r).sort(),i=0;for(let a=0;a<r.length;++a){if(s!=null){if(s[i]===a&&r[a]!==1)throw new Error(`Can't squeeze axis ${a} since its dim '${r[a]}' is not 1`);(s[i]==null||s[i]>a)&&r[a]===1&&(e.push(r[a]),o.push(a)),s[i]<=a&&i++}r[a]!==1&&(e.push(r[a]),o.push(a))}return{newShape:e,keptDims:o}}function Tp(r,t){return tl(r,t)}function tl(r,t){let e=null;if(r==null||r==="float32")e=new Float32Array(t);else if(r==="int32")e=new Int32Array(t);else if(r==="bool")e=new Uint8Array(t);else if(r==="string")e=new Array(t);else throw new Error(`Unknown data type ${r}`);return e}function Ep(r,t){for(let e=0;e<r.length;e++){let o=r[e];if(isNaN(o)||!isFinite(o))throw Error(`A tensor of type ${t} being uploaded contains ${o}.`)}}function Ip(r){return r==="bool"||r==="complex64"||r==="float32"||r==="int32"||r==="string"}function P$(r,t){return!(t==="complex64"||t==="float32"&&r!=="complex64"||t==="int32"&&r!=="float32"&&r!=="complex64"||t==="bool"&&r==="bool")}function ln(r){if(r==="float32"||r==="int32")return 4;if(r==="complex64")return 8;if(r==="bool")return 1;throw new Error(`Unknown dtype ${r}`)}function Np(r){if(r==null)return 0;let t=0;return r.forEach(e=>t+=e.length),t}function Ne(r){return typeof r=="string"||r instanceof String}function ud(r){return typeof r=="boolean"}function pd(r){return typeof r=="number"}function Sr(r){return Array.isArray(r)?Sr(r[0]):r instanceof Float32Array?"float32":r instanceof Int32Array||r instanceof Uint8Array||r instanceof Uint8ClampedArray?"int32":pd(r)?"float32":Ne(r)?"string":ud(r)?"bool":"float32"}function Le(r){return!!(r&&r.constructor&&r.call&&r.apply)}function cn(r,t){for(let e=t;e<r;++e)if(r%e===0)return e;return r}function Be(r){let t=r.length;if(t<2)return[];let e=new Array(t-1);e[t-2]=r[t-1];for(let o=t-3;o>=0;--o)e[o]=e[o+1]*r[o+1];return e}function md(r,t,e,o=!1){let n=new Array;if(t.length===1){let s=t[0]*(o?2:1);for(let i=0;i<s;i++)n[i]=e[r+i]}else{let s=t[0],i=t.slice(1),a=i.reduce((l,c)=>l*c)*(o?2:1);for(let l=0;l<s;l++)n[l]=md(r+l*a,i,e,o)}return n}function to(r,t,e=!1){if(r.length===0)return t[0];let o=r.reduce((n,s)=>n*s)*(e?2:1);if(o===0)return[];if(o!==t.length)throw new Error(`[${r}] does not match the input size ${t.length}${e?" for a complex tensor":""}.`);return md(0,r,t,e)}function O$(r,t){if(Array.isArray(r))return r;if(t==="float32")return r instanceof Float32Array?r:new Float32Array(r);if(t==="int32")return r instanceof Int32Array?r:new Int32Array(r);if(t==="bool"||t==="string")return Uint8Array.from(new Int32Array(r));throw new Error(`Unknown dtype ${t}`)}function us(r,t){let e=un(r,t);for(let o=0;o<e.length;o++)e[o]=1;return e}function un(r,t){if(t==null||t==="float32"||t==="complex64")return new Float32Array(r);if(t==="int32")return new Int32Array(r);if(t==="bool")return new Uint8Array(r);throw new Error(`Unknown data type ${t}`)}function M$(r,t){let e=r.reduce((o,n)=>o*n,1);if(t==null||t==="float32")return to(r,new Float32Array(e));if(t==="int32")return to(r,new Int32Array(e));if(t==="bool")return to(r,new Uint8Array(e));throw new Error(`Unknown data type ${t}`)}function ft(r){r.forEach(t=>{v(Number.isInteger(t)&&t>=0,()=>`Tensor must have a shape comprised of positive integers but got shape [${r}].`)})}function L$(r,t,e){if(t===0)return 0;if(t===1)return r[0];let o=r[r.length-1];for(let n=0;n<r.length-1;++n)o+=e[n]*r[n];return o}function B$(r,t,e){if(t===0)return[];if(t===1)return[r];let o=new Array(t);for(let n=0;n<o.length-1;++n)o[n]=Math.floor(r/e[n]),r-=o[n]*e[n];return o[o.length-1]=r,o}function ro(r){return r&&r.then&&typeof r.then=="function"}var fd="tfjsflags",pn=class{constructor(t){this.global=t,this.flags={},this.flagRegistry={},this.urlFlags={},this.getQueryParams=U$,this.populateURLFlags()}setPlatform(t,e){this.platform!=null&&(I().getBool("IS_TEST")||I().getBool("PROD")||console.warn(`Platform ${this.platformName} has already been set. Overwriting the platform with ${t}.`)),this.platformName=t,this.platform=e}registerFlag(t,e,o){if(this.flagRegistry[t]={evaluationFn:e,setHook:o},this.urlFlags[t]!=null){let n=this.urlFlags[t];I().getBool("IS_TEST")||I().getBool("PROD")||console.warn(`Setting feature override from URL ${t}: ${n}.`),this.set(t,n)}}async getAsync(t){return t in this.flags?this.flags[t]:(this.flags[t]=await this.evaluateFlag(t),this.flags[t])}get(t){if(t in this.flags)return this.flags[t];let e=this.evaluateFlag(t);if(ro(e))throw new Error(`Flag ${t} cannot be synchronously evaluated. Please use getAsync() instead.`);return this.flags[t]=e,this.flags[t]}getNumber(t){return this.get(t)}getBool(t){return this.get(t)}getString(t){return this.get(t)}getFlags(){return this.flags}get features(){return this.flags}set(t,e){if(this.flagRegistry[t]==null)throw new Error(`Cannot set flag ${t} as it has not been registered.`);this.flags[t]=e,this.flagRegistry[t].setHook!=null&&this.flagRegistry[t].setHook(e)}evaluateFlag(t){if(this.flagRegistry[t]==null)throw new Error(`Cannot evaluate flag '${t}': no evaluation function found.`);return this.flagRegistry[t].evaluationFn()}setFlags(t){this.flags=Object.assign({},t)}reset(){this.flags={},this.urlFlags={},this.populateURLFlags()}populateURLFlags(){if(typeof this.global>"u"||typeof this.global.location>"u"||typeof this.global.location.search>"u")return;let t=this.getQueryParams(this.global.location.search);fd in t&&t[fd].split(",").forEach(o=>{let[n,s]=o.split(":");this.urlFlags[n]=W$(n,s)})}};function U$(r){let t={};return r.replace(/[?&]([^=?&]+)(?:=([^&]*))?/g,(e,...o)=>(V$(t,o[0],o[1]),o.join("="))),t}function V$(r,t,e){r[decodeURIComponent(t)]=decodeURIComponent(e||"")}function W$(r,t){let e=t.toLowerCase();return e==="true"||e==="false"?e==="true":`${+e}`===e?+e:t}function I(){return el}var el=null;function dd(r){el=r}var kp;function Rp(){if(kp==null){let r;if(typeof window<"u")r=window;else if(typeof global<"u")r=global;else if(typeof process<"u")r=process;else if(typeof self<"u")r=self;else throw new Error("Could not find a global object");kp=r}return kp}function z$(){let r=Rp();return r._tfGlobals==null&&(r._tfGlobals=new Map),r._tfGlobals}function ps(r,t){let e=z$();if(e.has(r))return e.get(r);{let o=t();return e.set(r,o),e.get(r)}}var mn="Abs",ms="Acos",fs="Acosh",Tr="Add",ds="AddN",rl="All",ol="Any",hs="ArgMax",gs="ArgMin",xs="Asin",bs="Asinh",ys="Atan",ws="Atanh",Cs="Atan2",vs="AvgPool",Ap="AvgPoolGrad",$s="AvgPool3D",_p="AvgPool3DGrad",Ss="BatchMatMul",Ts="BatchToSpaceND",Es="Bincount",oo="BitwiseAnd",K$="BroadcastTo",Is="BroadcastArgs",Er="Cast",no="Ceil",Ns="ClipByValue",fn="Complex",ks="ComplexAbs",Rs="Concat",As="Conv2D",_s="Conv2DBackpropFilter",Ds="Conv2DBackpropInput",Fs="Conv3D",Dp="Conv3DBackpropFilterV2",Ps="Conv3DBackpropInputV2",nl="Cos",Os="Cosh",Ms="Cumprod",Ls="Cumsum",Bs="CropAndResize",Gs="DenseBincount",Us="DepthToSpace",Vs="DepthwiseConv2dNative",Ws="DepthwiseConv2dNativeBackpropFilter",zs="DepthwiseConv2dNativeBackpropInput",Ks="Diag",Hs="Dilation2D",H$="Dilation2DBackpropInput",q$="Dilation2DBackpropFilter",sl="Draw",qs="RealDiv",Xs="Einsum",il="Elu",Fp="EluGrad",al="Erf",so="Equal",dn="Exp",js="ExpandDims",io="Expm1",ll="FFT",Ys="Fill",Zs="FlipLeftRight",ao="Floor",lo="FloorDiv",Qs="FusedBatchNorm",Js="GatherV2",ti="GatherNd",co="Greater",uo="GreaterEqual",Ir="Identity",ei="IFFT",ri="Imag",oi="IsFinite",ni="IsInf",si="IsNan",ii="LeakyRelu",po="Less",mo="LessEqual",ai="LinSpace",hn="Log",li="Log1p",ci="LogicalAnd",ui="LogicalNot",pi="LogicalOr",X$="LogicalXor",j$="LogSoftmax",Y$="LowerBound",cl="LRN",Pp="LRNGrad",Z$="MatrixBandPart",ul="Max",fo="Maximum",mi="MaxPool",Op="MaxPoolGrad",fi="MaxPool3D",Mp="MaxPool3DGrad",di="MaxPoolWithArgmax",hi="Mean",pl="Min",ho="Minimum",gi="MirrorPad",ml="Mod",xi="Multinomial",go="Multiply",bi="Neg",xo="NotEqual",yi="NonMaxSuppressionV3",wi="NonMaxSuppressionV4",Ci="NonMaxSuppressionV5",vi="OnesLike",$i="OneHot",Si="Pack",Ti="PadV2",Q$="Pool",fl="Pow",Ei="Prelu",gn="Prod",Ii="RaggedGather",Ni="RaggedRange",ki="RaggedTensorToTensor",Ri="Range",xn="Real",Ai="Reciprocal",_i="Relu",Di="Reshape",Fi="ResizeNearestNeighbor",Lp="ResizeNearestNeighborGrad",Pi="ResizeBilinear",Bp="ResizeBilinearGrad",Oi="Relu6",Mi="Reverse",Li="Round",bo="Rsqrt",Bi="ScatterNd",Gi="TensorScatterUpdate",Ui="SearchSorted",Vi="Select",Wi="Selu",bn="Slice",dl="Sin",zi="Sinh",Ki="Sign",yo="Sigmoid",Hi="Softplus",wo="Sqrt",hl="Sum",qi="SpaceToBatchND",Xi="SplitV",ji="Softmax",Yi="SparseFillEmptyRows",Zi="SparseReshape",Qi="SparseSegmentMean",Ji="SparseSegmentSum",ta="SparseToDense",Co="SquaredDifference",Gp="Square",vo="StaticRegexReplace",ea="StridedSlice",ra="StringNGrams",oa="StringSplit",na="StringToHashBucketFast",yn="Sub",gl="Tan",sa="Tanh",$o="Tile",ia="TopK",aa="Transform",So="Transpose",la="Unique",ca="Unpack",ua="UnsortedSegmentSum",J$="UpperBound",pa="ZerosLike",ma="Step",wn="FromPixels",fa="RotateWithOffset",Cn="_FusedMatMul",vn="FusedConv2D",$n="FusedDepthwiseConv2D";function Ge(...r){I().getBool("IS_TEST")||I().getBool("PROD")||console.warn(...r)}function tS(...r){I().getBool("IS_TEST")||I().getBool("PROD")||console.log(...r)}var Sn=ps("kernelRegistry",()=>new Map),da=ps("gradRegistry",()=>new Map);function To(r,t){let e=Up(r,t);return Sn.get(e)}function xl(r){return da.get(r)}function ha(r){let t=Sn.entries(),e=[];for(;;){let{done:o,value:n}=t.next();if(o)break;let[s,i]=n,[a]=s.split("_");a===r&&e.push(i)}return e}function bl(r){let{kernelName:t,backendName:e}=r,o=Up(t,e);Sn.has(o)&&Ge(`The kernel '${t}' for backend '${e}' is already registered`),Sn.set(o,r)}function eS(r){let{kernelName:t}=r;da.has(t)&&I().getBool("DEBUG")&&Ge(`Overriding the gradient for '${t}'`),da.set(t,r)}function rS(r,t){let e=Up(r,t);if(!Sn.has(e))throw new Error(`The kernel '${r}' for backend '${t}' is not registered`);Sn.delete(e)}function oS(r){if(!da.has(r))throw new Error(`The gradient '${r}' for backend is not registered`);da.delete(r)}function nS(r,t){ha(r).forEach(o=>{let n=Object.assign({},o,{backendName:t});bl(n)})}function Up(r,t){return`${t}_${r}`}var C={};Lt(C,{arraysEqual:()=>Xt,arraysEqualWithNull:()=>$p,assert:()=>v,assertNonNegativeIntegerDimensions:()=>ft,assertNonNull:()=>de,assertShapesMatch:()=>ut,bytesFromStringArray:()=>Np,bytesPerElement:()=>ln,checkConversionForErrors:()=>Ep,clamp:()=>an,computeStrides:()=>Be,convertBackendValuesAndArrayBuffer:()=>O$,createScalarValue:()=>pS,createShuffledIndices:()=>_$,decodeString:()=>Nn,distSquared:()=>N$,encodeString:()=>kr,fetch:()=>fS,fingerPrint64:()=>uS,flatten:()=>Re,getArrayFromDType:()=>tl,getTypedArrayFromDType:()=>Tp,hasEncodingLoss:()=>P$,hexToLong:()=>ga,indexToLoc:()=>B$,inferDtype:()=>Sr,inferFromImplicitShape:()=>F$,isBoolean:()=>ud,isFunction:()=>Le,isInt:()=>sr,isNumber:()=>pd,isPromise:()=>ro,isScalarShape:()=>k$,isString:()=>Ne,isTypedArray:()=>Ct,isValidDtype:()=>Ip,locToIndex:()=>L$,makeOnesTypedArray:()=>us,makeZerosNestedTypedArray:()=>M$,makeZerosTypedArray:()=>un,nearestDivisor:()=>cn,nearestLargerEven:()=>T$,now:()=>Ro,parseAxisParam:()=>$r,randUniform:()=>I$,repeatedTry:()=>D$,rightPad:()=>eo,shuffle:()=>cd,shuffleCombo:()=>S$,sizeFromShape:()=>X,sizeToSquarishShape:()=>A$,squeezeShape:()=>Sp,sum:()=>E$,swap:()=>Ja,tanh:()=>R$,toNestedArray:()=>to,toTypedArray:()=>In});function yl(r){return r instanceof Float32Array||r instanceof Int32Array||r instanceof Uint8Array||r instanceof Uint8ClampedArray}var Kp=ld(Ed());var ko=Kp.default||Kp;function ga(r){return ko.fromString(r,!0,16)}var Nd=ga("c3a5c85c97cb3127"),No=ga("b492b66fbe98f273"),jt=ga("9ae16a3b2f90404f");function zp(r){return r.xor(r.shru(47))}function kd(r,t,e){let o=r.slice(t,t+e);return ko.fromBytes(Array.from(o),!0,!0)}function dt(r,t){return kd(r,t,8)}function Id(r,t){return kd(r,t,4)}function _t(r,t){return t===0?r:r.shru(t).or(r.shl(64-t))}function Nr(r,t,e=ga("9ddfea08eb382d69")){let o=r.xor(t).mul(e);o=o.xor(o.shru(47));let n=t.xor(o).mul(e);return n=n.xor(n.shru(47)),n=n.mul(e),n}function iS(r,t,e,o,n,s){n=n.add(r),s=_t(s.add(n).add(o),21);let i=n;return n=n.add(t),n=n.add(e),s=s.add(_t(n,44)),[n.add(o),s.add(i)]}function Cl(r,t,e,o){return iS(dt(r,t),dt(r,t+8),dt(r,t+16),dt(r,t+24),e,o)}function aS(r,t=r.length){if(t>=8){let e=jt.add(t*2),o=dt(r,0).add(jt),n=dt(r,t-8),s=_t(n,37).mul(e).add(o),i=_t(o,25).add(n).mul(e);return Nr(s,i,e)}if(t>=4){let e=jt.add(t*2),o=Id(r,0);return Nr(o.shl(3).add(t),Id(r,t-4),e)}if(t>0){let e=r[0],o=r[t>>1],n=r[t-1],s=e+(o<<8),i=t+(n<<2);return zp(jt.mul(s).xor(Nd.mul(i))).mul(jt)}return jt}function lS(r,t=r.length){let e=jt.add(t*2),o=dt(r,0).mul(No),n=dt(r,8),s=dt(r,t-8).mul(e),i=dt(r,t-16).mul(jt);return Nr(_t(o.add(n),43).add(_t(s,30)).add(i),o.add(_t(n.add(jt),18)).add(s),e)}function cS(r,t=r.length){let e=jt.add(t*2),o=dt(r,0).mul(jt),n=dt(r,8),s=dt(r,t-8).mul(e),i=dt(r,t-16).mul(jt),a=_t(o.add(n),43).add(_t(s,30)).add(i),l=Nr(a,o.add(_t(n.add(jt),18)).add(s),e),c=dt(r,16).mul(e),u=dt(r,24),p=a.add(dt(r,t-32)).mul(e),m=l.add(dt(r,t-24)).mul(e);return Nr(_t(c.add(u),43).add(_t(p,30)).add(m),c.add(_t(u.add(o),18)).add(p),e)}function uS(r,t=r.length){let e=ko.fromNumber(81,!0);if(t<=32)return t<=16?aS(r,t):lS(r,t);if(t<=64)return cS(r,t);let o=e,n=e.mul(No).add(113),s=zp(n.mul(jt).add(113)).mul(jt),i=[ko.UZERO,ko.UZERO],a=[ko.UZERO,ko.UZERO];o=o.mul(jt).add(dt(r,0));let l=0,c=(t-1>>6)*64,u=c+(t-1&63)-63;do o=_t(o.add(n).add(i[0]).add(dt(r,l+8)),37).mul(No),n=_t(n.add(i[1]).add(dt(r,l+48)),42).mul(No),o=o.xor(a[1]),n=n.add(i[0]).add(dt(r,l+40)),s=_t(s.add(a[0]),33).mul(No),i=Cl(r,l,i[1].mul(No),o.add(a[0])),a=Cl(r,l+32,s.add(a[1]),n.add(dt(r,l+16))),[s,o]=[o,s],l+=64;while(l!==c);let p=No.add(s.and(255).shl(1));return l=u,a[0]=a[0].add(t-1&63),i[0]=i[0].add(a[0]),a[0]=a[0].add(i[0]),o=_t(o.add(n).add(i[0]).add(dt(r,l+8)),37).mul(p),n=_t(n.add(i[1]).add(dt(r,l+48)),42).mul(p),o=o.xor(a[1].mul(9)),n=n.add(i[0].mul(9).add(dt(r,l+40))),s=_t(s.add(a[0]),33).mul(p),i=Cl(r,l,i[1].mul(p),o.add(a[0])),a=Cl(r,l+32,s.add(a[1]),n.add(dt(r,l+16))),[s,o]=[o,s],Nr(Nr(i[0],a[0],p).add(zp(n).mul(Nd)).add(s),Nr(i[1],a[1],p).add(o),p)}function pS(r,t){return t==="string"?kr(r):In([r],t)}function mS(r,t){return r instanceof Float32Array&&t==="float32"||r instanceof Int32Array&&t==="int32"||r instanceof Uint8Array&&t==="bool"}function In(r,t){if(t==="string")throw new Error("Cannot convert a string[] to a TypedArray");if(Array.isArray(r)&&(r=Re(r)),I().getBool("DEBUG")&&Ep(r,t),mS(r,t))return r;if(t==null||t==="float32"||t==="complex64")return new Float32Array(r);if(t==="int32")return new Int32Array(r);if(t==="bool"){let e=new Uint8Array(r.length);for(let o=0;o<e.length;++o)Math.round(r[o])!==0&&(e[o]=1);return e}else throw new Error(`Unknown data type ${t}`)}function Ro(){return I().platform.now()}function fS(r,t){return I().platform.fetch(r,t)}function kr(r,t="utf-8"){return t=t||"utf-8",I().platform.encode(r,t)}function Nn(r,t="utf-8"){return t=t||"utf-8",I().platform.decode(r,t)}function Ct(r){return I().platform.isTypedArray!=null?I().platform.isTypedArray(r):yl(r)}function Re(r,t=[],e=!1){if(t==null&&(t=[]),typeof r=="boolean"||typeof r=="number"||typeof r=="string"||ro(r)||r==null||Ct(r)&&e)t.push(r);else if(Array.isArray(r)||Ct(r))for(let o=0;o<r.length;++o)Re(r[o],t,e);else{let o=-1;for(let n of Object.keys(r))/^([1-9]+[0-9]*|0)$/.test(n)&&(o=Math.max(o,Number(n)));for(let n=0;n<=o;n++)Re(r[n],t,e)}return t}var vl=class{constructor(t,e){this.backendTimer=t,this.logger=e,e==null&&(this.logger=new Hp)}profileKernel(t,e,o){let n,s=()=>{n=o()},i,a=Ro();if(this.backendTimer.timerAvailable())i=this.backendTimer.time(s);else{s();for(let c of n)c.dataSync();i=Promise.resolve({kernelMs:Ro()-a})}if(I().getBool("CHECK_COMPUTATION_FOR_ERRORS"))for(let c=0;c<n.length;c++){let u=n[c];u.data().then(p=>{dS(p,u.dtype,t)})}return{kernelName:t,outputs:n,inputs:e,timeMs:i.then(c=>c.kernelMs),extraInfo:i.then(c=>c.getExtraProfileInfo!=null?c.getExtraProfileInfo():"")}}logKernelProfile(t){let{kernelName:e,outputs:o,timeMs:n,inputs:s,extraInfo:i}=t;o.forEach(a=>{Promise.all([a.data(),n,i]).then(l=>{this.logger.logKernelProfile(e,a,l[0],l[1],s,l[2])})})}};function dS(r,t,e){if(t!=="float32")return!1;for(let o=0;o<r.length;o++){let n=r[o];if(isNaN(n)||!isFinite(n))return console.warn(`Found ${n} in the result of '${e}'`),!0}return!1}var Hp=class{logKernelProfile(t,e,o,n,s,i){let a=typeof n=="number"?eo(`${n}ms`,9):n.error,l=eo(t,25),c=e.rank,u=e.size,p=eo(e.shape.toString(),14),m="";for(let f in s){let d=s[f];if(d!=null){let x=d.shape||e.shape,g=x.length;m+=`${f}: ${g}D ${g>0?x:""} `}}console.log(`%c${l}	%c${a}	%c${c}D ${p}	%c${u}	%c${m}	%c${i}`,"font-weight:bold","color:red","color:blue","color: orange","color: green","color: steelblue")}};function Rd(r,t,e){let o={},n={};for(let l=0;l<t.length;l++)o[t[l].id]=!0;for(let l=0;l<r.length;l++){let c=r[l],u=c.inputs;for(let p in u){let m=u[p],f=!1;for(let d=0;d<t.length;d++)if(o[m.id]){c.outputs.forEach(x=>o[x.id]=!0),f=!0,n[c.id]=!0;break}if(f)break}}let s={};s[e.id]=!0;let i={};for(let l=r.length-1;l>=0;l--){let c=r[l],u=c.inputs;for(let p=0;p<c.outputs.length;p++)if(s[c.outputs[p].id]){for(let m in u)s[u[m].id]=!0,i[c.id]=!0;break}}let a=[];for(let l=0;l<r.length;l++){let c=r[l];if(n[c.id]&&i[c.id]){let u={};for(let m in c.inputs){let f=c.inputs[m];o[f.id]&&(u[m]=f)}let p=Object.assign({},c);p.inputs=u,p.outputs=c.outputs,a.push(p)}}return a}function Ad(r,t,e,o){for(let n=t.length-1;n>=0;n--){let s=t[n],i=[];if(s.outputs.forEach(l=>{let c=r[l.id];c!=null?i.push(c):i.push(null)}),s.gradient==null)throw new Error(`Cannot compute gradient: gradient function not found for ${s.kernelName}.`);let a=s.gradient(i);for(let l in s.inputs){if(!(l in a))throw new Error(`Cannot backprop through input ${l}. Available gradients found: ${Object.keys(a)}.`);let c=e(()=>a[l]());if(c.dtype!=="float32")throw new Error(`Error in gradient for op ${s.kernelName}. The gradient of input ${l} must have 'float32' dtype, but has '${c.dtype}'`);let u=s.inputs[l];if(!Xt(c.shape,u.shape))throw new Error(`Error in gradient for op ${s.kernelName}. The gradient of input '${l}' has shape '${c.shape}', which does not match the shape of the input '${u.shape}'`);if(r[u.id]==null)r[u.id]=c;else{let p=r[u.id];r[u.id]=o(p,c),p.dispose()}}}}var _d=20,xa=3,qp=7;function Dd(r,t,e,o){let n=Be(t),s=hS(r,t,e,n),i=t.length,a=$l(r,t,e,n,s),l=["Tensor"];return o&&(l.push(`  dtype: ${e}`),l.push(`  rank: ${i}`),l.push(`  shape: [${t}]`),l.push("  values:")),l.push(a.map(c=>"    "+c).join(`
`)),l.join(`
`)}function hS(r,t,e,o){let n=X(t),s=o[o.length-1],i=new Array(s).fill(0),a=t.length,l=e==="complex64"?ya(r):r;if(a>1)for(let c=0;c<n/s;c++){let u=c*s;for(let p=0;p<s;p++)i[p]=Math.max(i[p],ba(l[u+p],0,e).length)}return i}function ba(r,t,e){let o;return Array.isArray(r)?o=`${parseFloat(r[0].toFixed(qp))} + ${parseFloat(r[1].toFixed(qp))}j`:Ne(r)?o=`'${r}'`:e==="bool"?o=Fd(r):o=parseFloat(r.toFixed(qp)).toString(),eo(o,t)}function Fd(r){return r===0?"false":"true"}function $l(r,t,e,o,n,s=!0){let i=e==="complex64"?2:1,a=t[0],l=t.length;if(l===0){if(e==="complex64"){let x=ya(r);return[ba(x[0],0,e)]}return e==="bool"?[Fd(r[0])]:[r[0].toString()]}if(l===1){if(a>_d){let g=xa*i,b=Array.from(r.slice(0,g)),$=Array.from(r.slice((a-xa)*i,a*i));return e==="complex64"&&(b=ya(b),$=ya($)),["["+b.map((S,E)=>ba(S,n[E],e)).join(", ")+", ..., "+$.map((S,E)=>ba(S,n[a-xa+E],e)).join(", ")+"]"]}return["["+(e==="complex64"?ya(r):Array.from(r)).map((g,b)=>ba(g,n[b],e)).join(", ")+"]"]}let c=t.slice(1),u=o.slice(1),p=o[0]*i,m=[];if(a>_d){for(let x=0;x<xa;x++){let g=x*p,b=g+p;m.push(...$l(r.slice(g,b),c,e,u,n,!1))}m.push("...");for(let x=a-xa;x<a;x++){let g=x*p,b=g+p;m.push(...$l(r.slice(g,b),c,e,u,n,x===a-1))}}else for(let x=0;x<a;x++){let g=x*p,b=g+p;m.push(...$l(r.slice(g,b),c,e,u,n,x===a-1))}let f=l===2?",":"";m[0]="["+(a>0?m[0]+f:"");for(let x=1;x<m.length-1;x++)m[x]=" "+m[x]+f;let d=`,
`;for(let x=2;x<l;x++)d+=`
`;return m[m.length-1]=" "+m[m.length-1]+"]"+(s?"":d),m}function ya(r){let t=[];for(let e=0;e<r.length;e+=2)t.push([r[e],r[e+1]]);return t}var ce=class{constructor(t,e,o){if(this.dtype=e,this.shape=t.slice(),this.size=X(t),o!=null){let n=o.length;v(n===this.size,()=>`Length of values '${n}' does not match the size inferred by the shape '${this.size}'.`)}if(e==="complex64")throw new Error("complex64 dtype TensorBuffers are not supported. Please create a TensorBuffer for the real and imaginary parts separately and call tf.complex(real, imag).");this.values=o||tl(e,this.size),this.strides=Be(t)}set(t,...e){e.length===0&&(e=[0]),v(e.length===this.rank,()=>`The number of provided coordinates (${e.length}) must match the rank (${this.rank})`);let o=this.locToIndex(e);this.values[o]=t}get(...t){t.length===0&&(t=[0]);let e=0;for(let n of t){if(n<0||n>=this.shape[e]){let s=`Requested out of range element at ${t}.   Buffer shape=${this.shape}`;throw new Error(s)}e++}let o=t[t.length-1];for(let n=0;n<t.length-1;++n)o+=this.strides[n]*t[n];return this.values[o]}locToIndex(t){if(this.rank===0)return 0;if(this.rank===1)return t[0];let e=t[t.length-1];for(let o=0;o<t.length-1;++o)e+=this.strides[o]*t[o];return e}indexToLoc(t){if(this.rank===0)return[];if(this.rank===1)return[t];let e=new Array(this.shape.length);for(let o=0;o<e.length-1;++o)e[o]=Math.floor(t/this.strides[o]),t-=e[o]*this.strides[o];return e[e.length-1]=t,e}get rank(){return this.shape.length}toTensor(){return Ae().makeTensor(this.values,this.shape,this.dtype)}},Ae=null,kn=null,gS=null;function Pd(r){Ae=r}function Od(r){kn=r}function Md(r){gS=r}var lt=class{constructor(t,e,o,n){this.kept=!1,this.isDisposedInternal=!1,this.shape=t.slice(),this.dtype=e||"float32",this.size=X(t),this.strides=Be(t),this.dataId=o,this.id=n,this.rankType=this.rank<5?this.rank.toString():"higher"}get rank(){return this.shape.length}async buffer(){let t=await this.data();return kn.buffer(this.shape,this.dtype,t)}bufferSync(){return kn.buffer(this.shape,this.dtype,this.dataSync())}async array(){let t=await this.data();return to(this.shape,t,this.dtype==="complex64")}arraySync(){return to(this.shape,this.dataSync(),this.dtype==="complex64")}async data(){this.throwIfDisposed();let t=Ae().read(this.dataId);if(this.dtype==="string"){let e=await t;try{return e.map(o=>Nn(o))}catch{throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}}return t}dataToGPU(t){return this.throwIfDisposed(),Ae().readToGPU(this.dataId,t)}dataSync(){this.throwIfDisposed();let t=Ae().readSync(this.dataId);if(this.dtype==="string")try{return t.map(e=>Nn(e))}catch{throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}return t}async bytes(){this.throwIfDisposed();let t=await Ae().read(this.dataId);return this.dtype==="string"?t:new Uint8Array(t.buffer)}dispose(){this.isDisposed||(this.kerasMask&&this.kerasMask.dispose(),Ae().disposeTensor(this),this.isDisposedInternal=!0)}get isDisposed(){return this.isDisposedInternal}throwIfDisposed(){if(this.isDisposed)throw new Error("Tensor is disposed.")}print(t=!1){return kn.print(this,t)}clone(){return this.throwIfDisposed(),kn.clone(this)}toString(t=!1){let e=this.dataSync();return Dd(e,this.shape,this.dtype,t)}cast(t){return this.throwIfDisposed(),kn.cast(this,t)}variable(t=!0,e,o){return this.throwIfDisposed(),Ae().makeVariable(this,t,e,o)}};Object.defineProperty(lt,Symbol.hasInstance,{value:r=>!!r&&r.data!=null&&r.dataSync!=null&&r.throwIfDisposed!=null});function Xp(){return ps("Tensor",()=>lt)}Xp();var Ue=class extends lt{constructor(t,e,o,n){super(t.shape,t.dtype,t.dataId,n),this.trainable=e,this.name=o}assign(t){if(t.dtype!==this.dtype)throw new Error(`dtype of the new value (${t.dtype}) and previous value (${this.dtype}) must match`);if(!Xt(t.shape,this.shape))throw new Error(`shape of the new value (${t.shape}) and previous value (${this.shape}) must match`);Ae().disposeTensor(this),this.dataId=t.dataId,Ae().incRef(this,null)}dispose(){Ae().disposeVariable(this),this.isDisposedInternal=!0}};Object.defineProperty(Ue,Symbol.hasInstance,{value:r=>r instanceof lt&&r.assign!=null&&r.assign instanceof Function});var tm={};Lt(tm,{assertTypesMatch:()=>Jp,getTensorsInContainer:()=>wa,isTensorInList:()=>bS,makeTypesMatch:()=>q});var Sl;(function(r){r.R0="R0",r.R1="R1",r.R2="R2",r.R3="R3",r.R4="R4",r.R5="R5",r.R6="R6"})(Sl||(Sl={}));var jp;(function(r){r.float32="float32",r.int32="int32",r.bool="int32",r.complex64="complex64"})(jp||(jp={}));var Yp;(function(r){r.float32="float32",r.int32="int32",r.bool="bool",r.complex64="complex64"})(Yp||(Yp={}));var Zp;(function(r){r.float32="float32",r.int32="float32",r.bool="float32",r.complex64="complex64"})(Zp||(Zp={}));var Qp;(function(r){r.float32="complex64",r.int32="complex64",r.bool="complex64",r.complex64="complex64"})(Qp||(Qp={}));var xS={float32:Zp,int32:jp,bool:Yp,complex64:Qp};function Bt(r,t){if(r==="string"||t==="string"){if(r==="string"&&t==="string")return"string";throw new Error(`Can not upcast ${r} with ${t}`)}return xS[r][t]}function Rr(r){return Bt(r,"int32")}function Tl(r){return r!=null&&typeof r=="object"&&"texture"in r&&r.texture instanceof WebGLTexture}function El(r){return typeof GPUBuffer<"u"&&r!=null&&typeof r=="object"&&"buffer"in r&&r.buffer instanceof GPUBuffer}function q(r,t){if(r.dtype===t.dtype)return[r,t];let e=Bt(r.dtype,t.dtype);return[r.cast(e),t.cast(e)]}function Jp(r,t){v(r.dtype===t.dtype,()=>`The dtypes of the first(${r.dtype}) and second(${t.dtype}) input must match`)}function bS(r,t){return t.some(e=>e.id===r.id)}function wa(r){let t=[];return Ld(r,t,new Set),t}function Ld(r,t,e){if(r==null)return;if(r instanceof lt){t.push(r);return}if(!yS(r))return;let o=r;for(let n in o){let s=o[n];e.has(s)||(e.add(s),Ld(s,t,e))}}function yS(r){return Array.isArray(r)||typeof r=="object"}function em(r){return r.kernelName!=null}var Il=class{constructor(){this.registeredVariables={},this.nextTapeNodeId=0,this.numBytes=0,this.numTensors=0,this.numStringTensors=0,this.numDataBuffers=0,this.gradientDepth=0,this.kernelDepth=0,this.scopeStack=[],this.numDataMovesStack=[],this.nextScopeId=0,this.tensorInfo=new WeakMap,this.profiling=!1,this.activeProfile={newBytes:0,newTensors:0,peakBytes:0,kernels:[],result:null,get kernelNames(){return Array.from(new Set(this.kernels.map(t=>t.name)))}}}dispose(){for(let t in this.registeredVariables)this.registeredVariables[t].dispose()}},Ca=class r{constructor(t){this.ENV=t,this.registry={},this.registryFactory={},this.pendingBackendInitId=0,this.state=new Il}async ready(){if(this.pendingBackendInit!=null)return this.pendingBackendInit.then(()=>{});if(this.backendInstance!=null)return;let t=this.getSortedBackends();for(let e=0;e<t.length;e++){let o=t[e];if(await this.initializeBackend(o).success){await this.setBackend(o);return}}throw new Error("Could not initialize any backends, all backend initializations failed.")}get backend(){if(this.pendingBackendInit!=null)throw new Error(`Backend '${this.backendName}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);if(this.backendInstance==null){let{name:t,asyncInit:e}=this.initializeBackendsAndReturnBest();if(e)throw new Error(`The highest priority backend '${t}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);this.setBackend(t)}return this.backendInstance}backendNames(){return Object.keys(this.registryFactory)}findBackend(t){if(!(t in this.registry))if(t in this.registryFactory){let{asyncInit:e}=this.initializeBackend(t);if(e)return null}else return null;return this.registry[t]}findBackendFactory(t){return t in this.registryFactory?this.registryFactory[t].factory:null}registerBackend(t,e,o=1){return t in this.registryFactory?(Ge(`${t} backend was already registered. Reusing existing backend factory.`),!1):(this.registryFactory[t]={factory:e,priority:o},!0)}async setBackend(t){if(this.registryFactory[t]==null)throw new Error(`Backend name '${t}' not found in registry`);if(this.backendName=t,this.registry[t]==null){this.backendInstance=null;let{success:e,asyncInit:o}=this.initializeBackend(t);if(!(o?await e:e))return!1}return this.backendInstance=this.registry[t],this.setupRegisteredKernels(),this.profiler=new vl(this.backendInstance),!0}setupRegisteredKernels(){ha(this.backendName).forEach(e=>{e.setupFunc!=null&&e.setupFunc(this.backendInstance)})}disposeRegisteredKernels(t){ha(t).forEach(o=>{o.disposeFunc!=null&&o.disposeFunc(this.registry[t])})}initializeBackend(t){let e=this.registryFactory[t];if(e==null)throw new Error(`Cannot initialize backend ${t}, no registration found.`);try{let o=e.factory();if(o&&!(o instanceof vr)&&typeof o.then=="function"){let n=++this.pendingBackendInitId,s=o.then(i=>n<this.pendingBackendInitId?!1:(this.registry[t]=i,this.pendingBackendInit=null,!0)).catch(i=>(n<this.pendingBackendInitId||(this.pendingBackendInit=null,Ge(`Initialization of backend ${t} failed`),Ge(i.stack||i.message)),!1));return this.pendingBackendInit=s,{success:s,asyncInit:!0}}else return this.registry[t]=o,{success:!0,asyncInit:!1}}catch(o){return Ge(`Initialization of backend ${t} failed`),Ge(o.stack||o.message),{success:!1,asyncInit:!1}}}removeBackend(t){if(!(t in this.registryFactory))throw new Error(`${t} backend not found in registry`);this.backendName===t&&this.pendingBackendInit!=null&&this.pendingBackendInitId++,t in this.registry&&(this.disposeRegisteredKernels(t),this.registry[t].dispose(),delete this.registry[t]),delete this.registryFactory[t],this.backendName===t&&(this.pendingBackendInit=null,this.backendName=null,this.backendInstance=null)}getSortedBackends(){if(Object.keys(this.registryFactory).length===0)throw new Error("No backend found in registry.");return Object.keys(this.registryFactory).sort((t,e)=>this.registryFactory[e].priority-this.registryFactory[t].priority)}initializeBackendsAndReturnBest(){let t=this.getSortedBackends();for(let e=0;e<t.length;e++){let o=t[e],{success:n,asyncInit:s}=this.initializeBackend(o);if(s||n)return{name:o,asyncInit:s}}throw new Error("Could not initialize any backends, all backend initializations failed.")}moveData(t,e){let o=this.state.tensorInfo.get(e),n=o.backend,s=this.readSync(e),i=n.refCount(e);n.disposeData(e,!0),o.backend=t,t.move(e,s,o.shape,o.dtype,i),this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack[this.state.numDataMovesStack.length-1]++}tidy(t,e){let o=null;if(e==null){if(typeof t!="function")throw new Error("Please provide a function to tidy()");e=t}else{if(typeof t!="string"&&!(t instanceof String))throw new Error("When calling with two arguments, the first argument to tidy() must be a string");if(typeof e!="function")throw new Error("When calling with two arguments, the 2nd argument to tidy() must be a function");o=t}let n;return this.scopedRun(()=>this.startScope(o),()=>this.endScope(n),()=>(n=e(),n instanceof Promise&&console.error("Cannot return a Promise inside of tidy."),n))}scopedRun(t,e,o){t();try{let n=o();return e(),n}catch(n){throw e(),n}}nextTensorId(){return r.nextTensorId++}nextVariableId(){return r.nextVariableId++}clone(t){let e=w.runKernel(Ir,{x:t}),o={x:t},n=i=>({x:()=>{let a="float32",l={x:i},c={dtype:a};return w.runKernel(Er,l,c)}}),s=[];return this.addTapeNode(this.state.activeScope.name,o,[e],n,s,{}),e}runKernel(t,e,o){if(this.backendName==null&&this.backend,!(To(t,this.backendName)!=null))throw new Error(`Kernel '${t}' not registered for backend '${this.backendName}'`);return this.runKernelFunc({kernelName:t,inputs:e,attrs:o})}shouldCheckForMemLeaks(){return this.ENV.getBool("IS_TEST")}checkKernelForMemLeak(t,e,o){let n=this.backend.numDataIds(),s=0;o.forEach(l=>{s+=l.dtype==="complex64"?3:1});let i=this.state.numDataMovesStack[this.state.numDataMovesStack.length-1],a=n-e-s-i;if(a>0)throw new Error(`Backend '${this.backendName}' has an internal memory leak (${a} data ids) after running '${t}'`)}runKernelFunc(t){let e,o=[],n=this.isTapeOn(),s=this.state.numBytes,i=this.state.numTensors;this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack.push(0);let a;this.backendName==null&&this.backend;let l,c=em(t)?t.kernelName:this.state.activeScope!=null?this.state.activeScope.name:"";if(em(t)){let{kernelName:d,inputs:x,attrs:g}=t;this.backendName==null&&this.backend;let b=To(d,this.backendName);v(b!=null,()=>`Cannot find registered kernel '${d}' for backend '${this.backendName}'`),a=()=>{let $=this.backend.numDataIds();l=b.kernelFunc({inputs:x,attrs:g,backend:this.backend});let S=Array.isArray(l)?l:[l];this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(d,$,S);let E=S.map(N=>N.rank!=null?N:this.makeTensorFromTensorInfo(N));if(n){let N=this.getTensorsForGradient(d,x,E);o=this.saveTensorsForBackwardMode(N)}return E}}else{let{forwardFunc:d}=t,x=g=>{n&&(o=g.map(b=>this.keep(this.clone(b))))};a=()=>{let g=this.backend.numDataIds();l=this.tidy(()=>d(this.backend,x));let b=Array.isArray(l)?l:[l];return this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(c,g,b),b}}let{inputs:u,attrs:p}=t,m=em(t)?null:t.backwardsFunc,f;return this.scopedRun(()=>this.state.kernelDepth++,()=>this.state.kernelDepth--,()=>{!this.ENV.getBool("DEBUG")&&!this.state.profiling?e=a():(f=this.profiler.profileKernel(c,u,()=>a()),this.ENV.getBool("DEBUG")&&this.profiler.logKernelProfile(f),e=f.outputs)}),n&&this.addTapeNode(c,u,e,m,o,p),this.state.profiling&&this.state.activeProfile.kernels.push({name:c,bytesAdded:this.state.numBytes-s,totalBytesSnapshot:this.state.numBytes,tensorsAdded:this.state.numTensors-i,totalTensorsSnapshot:this.state.numTensors,inputShapes:Object.keys(u).map(d=>u[d]!=null?u[d].shape:null),outputShapes:e.map(d=>d.shape),kernelTimeMs:f.timeMs,extraInfo:f.extraInfo}),Array.isArray(l)?e:e[0]}saveTensorsForBackwardMode(t){return t.map(o=>this.keep(this.clone(o)))}getTensorsForGradient(t,e,o){let n=xl(t);if(n!=null){let s=n.inputsToSave||[],i=n.outputsToSave||[],a;n.saveAllInputs?(v(Array.isArray(e),()=>"saveAllInputs is true, expected inputs to be an array."),a=Object.keys(e).map(c=>e[c])):a=s.map(c=>e[c]);let l=o.filter((c,u)=>i[u]);return a.concat(l)}return[]}makeTensor(t,e,o,n){if(t==null)throw new Error("Values passed to engine.makeTensor() are null");o=o||"float32",n=n||this.backend;let s=t;o==="string"&&Ne(t[0])&&(s=t.map(l=>kr(l)));let i=n.write(s,e,o),a=new lt(e,o,i,this.nextTensorId());if(this.trackTensor(a,n),o==="string"){let l=this.state.tensorInfo.get(i),c=Np(s);this.state.numBytes+=c-l.bytes,l.bytes=c}return a}makeTensorFromDataId(t,e,o,n){o=o||"float32";let s={dataId:t,shape:e,dtype:o};return this.makeTensorFromTensorInfo(s,n)}makeTensorFromTensorInfo(t,e){let{dataId:o,shape:n,dtype:s}=t,i=new lt(n,s,o,this.nextTensorId());return this.trackTensor(i,e),i}makeVariable(t,e=!0,o,n){o=o||this.nextVariableId().toString(),n!=null&&n!==t.dtype&&(t=t.cast(n));let s=new Ue(t,e,o,this.nextTensorId());if(this.state.registeredVariables[s.name]!=null)throw new Error(`Variable with name ${s.name} was already registered`);return this.state.registeredVariables[s.name]=s,this.incRef(s,this.backend),s}trackTensor(t,e){this.state.numTensors++,t.dtype==="string"&&this.state.numStringTensors++;let o=0;t.dtype!=="complex64"&&t.dtype!=="string"&&(o=t.size*ln(t.dtype)),this.state.numBytes+=o,this.state.tensorInfo.has(t.dataId)||(this.state.numDataBuffers++,this.state.tensorInfo.set(t.dataId,{backend:e||this.backend,dtype:t.dtype,shape:t.shape,bytes:o})),t instanceof Ue||this.track(t)}incRef(t,e){this.trackTensor(t,e),this.backend.incRef(t.dataId)}removeDataId(t,e){this.state.tensorInfo.has(t)&&this.state.tensorInfo.get(t).backend===e&&(this.state.tensorInfo.delete(t),this.state.numDataBuffers--)}disposeTensor(t){if(!this.state.tensorInfo.has(t.dataId))return;let e=this.state.tensorInfo.get(t.dataId);if(this.state.numTensors--,t.dtype==="string"&&(this.state.numStringTensors--,this.state.numBytes-=e.bytes),t.dtype!=="complex64"&&t.dtype!=="string"){let o=t.size*ln(t.dtype);this.state.numBytes-=o}e.backend.disposeData(t.dataId)&&this.removeDataId(t.dataId,e.backend)}disposeVariables(){for(let t in this.state.registeredVariables){let e=this.state.registeredVariables[t];this.disposeVariable(e)}}disposeVariable(t){this.disposeTensor(t),this.state.registeredVariables[t.name]!=null&&delete this.state.registeredVariables[t.name]}memory(){let t=this.backend.memory();return t.numTensors=this.state.numTensors,t.numDataBuffers=this.state.numDataBuffers,t.numBytes=this.state.numBytes,this.state.numStringTensors>0&&(t.unreliable=!0,t.reasons==null&&(t.reasons=[]),t.reasons.push("Memory usage by string tensors is approximate (2 bytes per character)")),t}async profile(t){this.state.profiling=!0;let e=this.state.numBytes,o=this.state.numTensors;this.state.activeProfile.kernels=[],this.state.activeProfile.result=await t(),this.state.profiling=!1,this.state.activeProfile.peakBytes=Math.max(...this.state.activeProfile.kernels.map(n=>n.totalBytesSnapshot)),this.state.activeProfile.newBytes=this.state.numBytes-e,this.state.activeProfile.newTensors=this.state.numTensors-o;for(let n of this.state.activeProfile.kernels)n.kernelTimeMs=await n.kernelTimeMs,n.extraInfo=await n.extraInfo;return this.state.activeProfile}isTapeOn(){return this.state.gradientDepth>0&&this.state.kernelDepth===0}addTapeNode(t,e,o,n,s,i){let a={id:this.state.nextTapeNodeId++,kernelName:t,inputs:e,outputs:o,saved:s},l=xl(t);l!=null&&(n=l.gradFunc),n!=null&&(a.gradient=c=>(c=c.map((u,p)=>{if(u==null){let m=o[p],f=un(m.size,m.dtype);return this.makeTensor(f,m.shape,m.dtype)}return u}),n(c.length>1?c:c[0],s,i))),this.state.activeTape.push(a)}keep(t){return t.kept=!0,t}startTape(){this.state.gradientDepth===0&&(this.state.activeTape=[]),this.state.gradientDepth++}endTape(){this.state.gradientDepth--}startScope(t){let e={track:[],name:"unnamed scope",id:this.state.nextScopeId++};t&&(e.name=t),this.state.scopeStack.push(e),this.state.activeScope=e}endScope(t){let e=wa(t),o=new Set(e.map(s=>s.id));for(let s=0;s<this.state.activeScope.track.length;s++){let i=this.state.activeScope.track[s];!i.kept&&!o.has(i.id)&&i.dispose()}let n=this.state.scopeStack.pop();this.state.activeScope=this.state.scopeStack.length===0?null:this.state.scopeStack[this.state.scopeStack.length-1],e.forEach(s=>{!s.kept&&s.scopeId===n.id&&this.track(s)})}gradients(t,e,o,n=!1){if(v(e.length>0,()=>"gradients() received an empty list of xs."),o!=null&&o.dtype!=="float32")throw new Error(`dy must have 'float32' dtype, but has '${o.dtype}'`);let s=this.scopedRun(()=>this.startTape(),()=>this.endTape(),()=>this.tidy("forward",t));v(s instanceof lt,()=>"The result y returned by f() must be a tensor.");let i=Rd(this.state.activeTape,e,s);if(!n&&i.length===0&&e.length>0)throw new Error("Cannot compute gradient of y=f(x) with respect to x. Make sure that the f you passed encloses all operations that lead from x to y.");return this.tidy("backward",()=>{let a={};a[s.id]=o??wS(s.shape),Ad(a,i,c=>this.tidy(c),CS);let l=e.map(c=>a[c.id]);return this.state.gradientDepth===0&&(this.state.activeTape.forEach(c=>{for(let u of c.saved)u.dispose()}),this.state.activeTape=null),{value:s,grads:l}})}customGrad(t){return v(Le(t),()=>"The f passed in customGrad(f) must be a function."),(...e)=>{v(e.every(a=>a instanceof lt),()=>"The args passed in customGrad(f)(x1, x2,...) must all be tensors");let o,n={};e.forEach((a,l)=>{n[l]=a});let s=(a,l)=>(o=t(...e,l),v(o.value instanceof lt,()=>"The function f passed in customGrad(f) must return an object where `obj.value` is a tensor"),v(Le(o.gradFunc),()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function."),o.value),i=(a,l)=>{let c=o.gradFunc(a,l),u=Array.isArray(c)?c:[c];v(u.length===e.length,()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns the same number of tensors as inputs passed to f(...)."),v(u.every(m=>m instanceof lt),()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns a list of only tensors.");let p={};return u.forEach((m,f)=>{p[f]=()=>m}),p};return this.runKernelFunc({forwardFunc:s,backwardsFunc:i,inputs:n})}}readSync(t){return this.state.tensorInfo.get(t).backend.readSync(t)}read(t){return this.state.tensorInfo.get(t).backend.read(t)}readToGPU(t,e){return this.state.tensorInfo.get(t).backend.readToGPU(t,e)}async time(t){let e=Ro(),o=await this.backend.time(t);return o.wallMs=Ro()-e,o}track(t){return this.state.activeScope!=null&&(t.scopeId=this.state.activeScope.id,this.state.activeScope.track.push(t)),t}get registeredVariables(){return this.state.registeredVariables}reset(){this.pendingBackendInitId++,this.state.dispose(),this.ENV.reset(),this.state=new Il;for(let t in this.registry)this.disposeRegisteredKernels(t),this.registry[t].dispose(),delete this.registry[t];this.backendName=null,this.backendInstance=null,this.pendingBackendInit=null}};Ca.nextTensorId=0;Ca.nextVariableId=0;function wS(r){let t=us(X(r),"float32");return w.makeTensor(t,r,"float32")}function rm(){let r=Rp();if(r._tfengine==null){let t=new pn(r);r._tfengine=new Ca(t)}return dd(r._tfengine.ENV),Pd(()=>r._tfengine),r._tfengine}var w=rm();function CS(r,t){let e={a:r,b:t};return w.runKernel("Add",e)}var ir={};Lt(ir,{isBrowser:()=>nm,isMobile:()=>SS,mockIsMobile:()=>$S});function vS(){return typeof navigator<"u"&&navigator!=null}var om;function $S(r){om=r}function SS(r){if(om!==void 0)return om;if(r||vS()){if(r||(r=navigator),r.product==="ReactNative")return!0;let t=r.userAgent||r.vendor||(typeof window<"u"?window.opera:"");if(!t){let e=r;return e.userAgentData&&e.userAgentData.mobile}return/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(t)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(t.substr(0,4))}return!1}function nm(){return typeof window<"u"&&window.document!=null||typeof WorkerGlobalScope<"u"}var Jt=I();Jt.registerFlag("DEBUG",()=>!1,r=>{r&&console.warn("Debugging mode is ON. The output of every math call will be downloaded to CPU and checked for NaNs. This significantly impacts performance.")});Jt.registerFlag("IS_BROWSER",()=>nm());Jt.registerFlag("IS_NODE",()=>typeof process<"u"&&typeof process.versions<"u"&&typeof process.versions.node<"u");Jt.registerFlag("IS_CHROME",()=>typeof navigator<"u"&&navigator!=null&&navigator.userAgent!=null&&/Chrome/.test(navigator.userAgent)&&/Google Inc/.test(navigator.vendor));Jt.registerFlag("IS_SAFARI",()=>typeof navigator<"u"&&navigator!=null&&navigator.userAgent!=null&&/Safari/.test(navigator.userAgent)&&/Apple/.test(navigator.vendor));Jt.registerFlag("PROD",()=>!1);Jt.registerFlag("TENSORLIKE_CHECK_SHAPE_CONSISTENCY",()=>Jt.getBool("DEBUG"));Jt.registerFlag("DEPRECATION_WARNINGS_ENABLED",()=>!0);Jt.registerFlag("IS_TEST",()=>!1);Jt.registerFlag("CHECK_COMPUTATION_FOR_ERRORS",()=>Jt.getBool("DEBUG"));Jt.registerFlag("WRAP_TO_IMAGEBITMAP",()=>!1);Jt.registerFlag("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU",()=>!1);Jt.registerFlag("USE_SETTIMEOUTCUSTOM",()=>!1);function Gt(r,t){let e=r;if(Ct(r))return t==="string"?[]:[r.length];if(Tl(r)){let n=r.channels||"RGBA";return[r.height,r.width*n.length]}else if(El(r))return[r.buffer.size/(t==null?4:ln(t))];if(!Array.isArray(r))return[];let o=[];for(;Array.isArray(e)||Ct(e)&&t!=="string";)o.push(e.length),e=e[0];return Array.isArray(r)&&I().getBool("TENSORLIKE_CHECK_SHAPE_CONSISTENCY")&&Gd(r,o,[]),o}function Gd(r,t,e){if(e=e||[],!Array.isArray(r)&&!Ct(r)){v(t.length===0,()=>`Element arr[${e.join("][")}] is a primitive, but should be an array/TypedArray of ${t[0]} elements`);return}v(t.length>0,()=>`Element arr[${e.join("][")}] should be a primitive, but is an array of ${r.length} elements`),v(r.length===t[0],()=>`Element arr[${e.join("][")}] should have ${t[0]} elements, but has ${r.length} elements`);let o=t.slice(1);for(let n=0;n<r.length;++n)Gd(r[n],o,e.concat(n))}function Bd(r,t,e,o){if(r!=="string_or_numeric"){if(r==null)throw new Error("Expected dtype cannot be null.");if(r!=="numeric"&&r!==t||r==="numeric"&&t==="string")throw new Error(`Argument '${e}' passed to '${o}' must be ${r} tensor, but got ${t} tensor`)}}function h(r,t,e,o="numeric"){if(r instanceof Xp())return Bd(o,r.dtype,t,e),r;let n=Sr(r);if(n!=="string"&&["bool","int32","float32"].indexOf(o)>=0&&(n=o),Bd(o,n,t,e),r==null||!Ct(r)&&!Array.isArray(r)&&typeof r!="number"&&typeof r!="boolean"&&typeof r!="string"){let l=r==null?"null":r.constructor.name;throw new Error(`Argument '${t}' passed to '${e}' must be a Tensor or TensorLike, but got '${l}'`)}let s=Gt(r,n);!Ct(r)&&!Array.isArray(r)&&(r=[r]);let a=n!=="string"?In(r,n):Re(r,[],!0);return w.makeTensor(a,s,n)}function ar(r,t,e,o="numeric"){if(!Array.isArray(r))throw new Error(`Argument ${t} passed to ${e} must be a \`Tensor[]\` or \`TensorLike[]\``);return r.map((s,i)=>h(s,`${t}[${i}]`,e,o))}var sm="__op";function y(r){let t=Object.keys(r);if(t.length!==1)throw new Error(`Please provide an object with a single key (operation name) mapping to a function. Got an object with ${t.length} keys.`);let e=t[0],o=r[e];e.endsWith("_")&&(e=e.substring(0,e.length-1)),e=e+sm;let n=(...s)=>{w.startScope(e);try{let i=o(...s);return ro(i)&&console.error("Cannot return a Promise inside of tidy."),w.endScope(i),i}catch(i){throw w.endScope(null),i}};return Object.defineProperty(n,"name",{value:e,configurable:!0}),n}function TS(r,t){let e=h(r,"real","complex"),o=h(t,"imag","complex");ut(e.shape,o.shape,`real and imag shapes, ${e.shape} and ${o.shape}, must match in call to tf.complex().`);let n={real:e,imag:o};return w.runKernel(fn,n)}var te=y({complex_:TS});function Yt(r,t,e,o){if(o==null)o=Sr(r);else if(o==="complex64")throw new Error("Cannot construct a complex64 tensor directly. Please use tf.complex(real, imag).");if(El(r)||Tl(r)){if(o!=="float32"&&o!=="int32")throw new Error(`Creating tensor from GPU data only supports 'float32'|'int32' dtype, while the dtype is ${o}.`);return w.backend.createTensorFromGPUData(r,t||e,o)}if(!Ct(r)&&!Array.isArray(r)&&typeof r!="number"&&typeof r!="boolean"&&typeof r!="string")throw new Error("values passed to tensor(values) must be a number/boolean/string or an array of numbers/booleans/strings, or a TypedArray");if(t!=null){ft(t);let n=X(t),s=X(e);v(n===s,()=>`Based on the provided shape, [${t}], the tensor should have ${n} values but has ${s}`);for(let i=0;i<e.length;++i){let a=e[i],l=i===e.length-1?a!==X(t.slice(i)):!0;v(e[i]===t[i]||!l,()=>`Error creating a new Tensor. Inferred shape (${e}) does not match the provided shape (${t}). `)}}return!Ct(r)&&!Array.isArray(r)&&(r=[r]),t=t||e,r=o!=="string"?In(r,o):Re(r,[],!0),w.makeTensor(r,t,o)}function Ve(r,t,e){let o=Gt(r,e);return Yt(r,t,o,e)}var lr={float32:4,float16:2,int32:4,uint16:2,uint8:1,bool:1,complex64:8};var Ut=class r{static join(t){return new r(t).slice()}constructor(t){if(this.shards=[],this.previousShardIndex=0,t==null||(t instanceof Array||(t=[t]),t=t.map(o=>Ct(o)?o.buffer:o),t.length===0))return;this.bufferUniformSize=t[0].byteLength;let e=0;for(let o=0;o<t.length;o++){let n=t[o];o!==t.length-1&&n.byteLength!==this.bufferUniformSize&&(this.bufferUniformSize=void 0);let s=e+n.byteLength;this.shards.push({buffer:n,start:e,end:s}),e=s}this.shards.length===0&&(this.byteLength=0),this.byteLength=this.shards[this.shards.length-1].end}slice(t=0,e=this.byteLength){if(this.shards.length===0)return new ArrayBuffer(0);if(t=isNaN(Number(t))?0:t,e=isNaN(Number(e))?0:e,t=Math.max(0,t),e=Math.min(this.byteLength,e),e<=t)return new ArrayBuffer(0);let o=this.findShardForByte(t);if(o===-1)throw new Error(`Could not find start shard for byte ${t}`);let n=e-t,s=new ArrayBuffer(n),i=new Uint8Array(s),a=0;for(let l=o;l<this.shards.length;l++){let c=this.shards[l],p=t+a-c.start,m=a,d=Math.min(e,c.end)-c.start,x=new Uint8Array(c.buffer,p,d-p);if(i.set(x,m),a+=x.length,e<c.end)break}return s}findShardForByte(t){if(this.shards.length===0||t<0||t>=this.byteLength)return-1;if(this.bufferUniformSize!=null)return this.previousShardIndex=Math.floor(t/this.bufferUniformSize),this.previousShardIndex;function e(n){return t<n.start?-1:t>=n.end?1:0}if(e(this.shards[this.previousShardIndex])===0)return this.previousShardIndex;let o=ES(this.shards,e);return o===-1?-1:(this.previousShardIndex=o,this.previousShardIndex)}};function ES(r,t){let e=0,o=r.length;for(;e<=o;){let n=Math.floor((o-e)/2)+e,s=t(r[n]);if(s===0)return n;s<0?o=n:e=n+1}return-1}function IS(){I().set("PROD",!0)}function NS(){I().set("DEBUG",!0)}function kS(){I().set("DEPRECATION_WARNINGS_ENABLED",!1),console.warn("TensorFlow.js deprecation warnings have been disabled.")}function Ud(r){I().getBool("DEPRECATION_WARNINGS_ENABLED")&&console.warn(r+" You can disable deprecation warnings with tf.disableDeprecationWarnings().")}Md(Ud);function RS(){w.disposeVariables()}function We(){return w}function AS(){return w.memory()}function _S(r){return w.profile(r)}function at(r,t){return w.tidy(r,t)}function St(r){wa(r).forEach(e=>e.dispose())}function im(r){return w.keep(r)}function DS(r){return w.time(r)}function FS(r){return w.setBackend(r)}function PS(){return w.ready()}function am(){return w.backendName}function OS(r){w.removeBackend(r)}function MS(r){return w.findBackend(r)}function LS(r){return w.findBackendFactory(r)}function lm(r,t,e=1){return w.registerBackend(r,t,e)}function cm(){return w.backend}function BS(r,t){I().setPlatform(r,t)}var Ar=4;async function zd(r,t){let e=[],o=[],n=Array.isArray(r)?r.map(i=>i.name):Object.keys(r);for(let i=0;i<n.length;++i){let a=n[i],l=Array.isArray(r)?r[i].tensor:r[a];if(l.dtype!=="float32"&&l.dtype!=="int32"&&l.dtype!=="bool"&&l.dtype!=="string"&&l.dtype!=="complex64")throw new Error(`Unsupported dtype in weight '${a}': ${l.dtype}`);let c={name:a,shape:l.shape,dtype:l.dtype};if(l.dtype==="string"){let u=new Promise(async p=>{let m=await l.bytes(),f=m.reduce((g,b)=>g+b.length,0)+Ar*m.length,d=new Uint8Array(f),x=0;for(let g=0;g<m.length;g++){let b=m[g],$=new Uint8Array(new Uint32Array([b.length]).buffer);d.set($,x),x+=Ar,d.set(b,x),x+=b.length}p(d)});o.push(u)}else o.push(l.data());t!=null&&(c.group=t),e.push(c)}let s=await Promise.all(o);return{data:VS(s),specs:e}}function Nl(r,t){let e=new Ut(r),o={},n=0;for(let s of t){let i=GS(s,(a,l)=>e.slice(n+a,n+l));o[s.name]=Kd(s,e.slice(n,n+i)),n+=i}return o}function GS(r,t){let e=X(r.shape),o;if("quantization"in r){let n=r.quantization;o=lr[n.dtype]}else if(r.dtype==="string"){let n=0;for(let s=0;s<e;s++)n+=Ar+new Uint32Array(t(n,n+Ar))[0];return n}else o=lr[r.dtype];return e*o}async function US(r,t){let e=X(r.shape),o;if("quantization"in r){let n=r.quantization;o=lr[n.dtype]}else if(r.dtype==="string"){let n=0;for(let s=0;s<e;s++)n+=Ar+new Uint32Array(await t(n,n+Ar))[0];return n}else o=lr[r.dtype];return e*o}function Kd(r,t){let e=r.name,o=r.dtype,n=r.shape,s=X(n),i,a=0;if("quantization"in r){let l=r.quantization;if(l.dtype==="uint8"||l.dtype==="uint16"){if(!("min"in l&&"scale"in l))throw new Error(`Weight ${r.name} with quantization ${l.dtype} doesn't have corresponding metadata min and scale.`)}else if(l.dtype==="float16"){if(o!=="float32")throw new Error(`Weight ${r.name} is quantized with ${l.dtype} which only supports weights of type float32 not ${o}.`)}else throw new Error(`Weight ${r.name} has unknown quantization dtype ${l.dtype}. Supported quantization dtypes are: 'uint8', 'uint16', and 'float16'.`);let c=lr[l.dtype],u=l.dtype==="uint8"?new Uint8Array(t):new Uint16Array(t);if(o==="float32")if(l.dtype==="uint8"||l.dtype==="uint16"){i=new Float32Array(u.length);for(let p=0;p<u.length;p++){let m=u[p];i[p]=m*l.scale+l.min}}else if(l.dtype==="float16")i=HS()(u);else throw new Error(`Unsupported quantization type ${l.dtype} for weight type float32.`);else if(o==="int32"){if(l.dtype!=="uint8"&&l.dtype!=="uint16")throw new Error(`Unsupported quantization type ${l.dtype} for weight type int32.`);i=new Int32Array(u.length);for(let p=0;p<u.length;p++){let m=u[p];i[p]=Math.round(m*l.scale+l.min)}}else throw new Error(`Unsupported dtype in weight '${e}': ${o}`);a+=s*c}else if(o==="string"){let l=X(r.shape);i=[];for(let c=0;c<l;c++){let u=new Uint32Array(t.slice(a,a+Ar))[0];a+=Ar;let p=new Uint8Array(t.slice(a,a+u));i.push(p),a+=u}}else{let l=lr[o];if(o==="float32")i=new Float32Array(t);else if(o==="int32")i=new Int32Array(t);else if(o==="bool")i=new Uint8Array(t);else if(o==="complex64"){i=new Float32Array(t);let c=new Float32Array(i.length/2),u=new Float32Array(i.length/2);for(let d=0;d<c.length;d++)c[d]=i[d*2],u[d]=i[d*2+1];let p=Ve(c,n,"float32"),m=Ve(u,n,"float32"),f=te(p,m);return p.dispose(),m.dispose(),f}else throw new Error(`Unsupported dtype in weight '${e}': ${o}`);a+=s*l}return Ve(i,n,o)}async function Vd(r,t,e){let o=new Uint8Array(t);for(;o.byteLength<e;){let{done:n,value:s}=await r.read();if(n&&s==null){let a=e-o.byteLength;throw new Error(`Reader is done but ${a} bytes are still expected`)}let i=new Uint8Array(o.length+s.byteLength);i.set(o,0),i.set(new Uint8Array(s),o.length),o=i}return o.buffer}async function Hd(r,t){let e={},o=r.getReader(),n=new ArrayBuffer(0);for(let s of t){let i=await US(s,async(c,u)=>(n=await Vd(o,n,u),n.slice(c,u)));n=await Vd(o,n,i);let a=n.slice(0,i);n=n.slice(i);let l=Kd(s,a);if(e[s.name]=l,am()==="webgpu"){let c=cm();"uploadToGPU"in c&&X(l.shape)>=I().get("WEBGPU_CPU_HANDOFF_SIZE_THRESHOLD")&&c.uploadToGPU(l.dataId)}}return e}function VS(r){if(r===null)throw new Error(`Invalid input value: ${JSON.stringify(r)}`);let t=0,e=[];r.forEach(s=>{if(t+=s.byteLength,e.push(s.byteLength===s.buffer.byteLength?s:new s.constructor(s)),!(s instanceof Float32Array||s instanceof Int32Array||s instanceof Uint8Array))throw new Error(`Unsupported TypedArray subtype: ${s.constructor.name}`)});let o=new Uint8Array(t),n=0;return e.forEach(s=>{o.set(new Uint8Array(s.buffer),n),n+=s.byteLength}),o.buffer}var um=typeof Buffer<"u"&&(typeof Blob>"u"||typeof atob>"u"||typeof btoa>"u");function Wd(r){return um?Buffer.byteLength(r,"utf8"):new Blob([r]).size}function qd(r){if(um)return Buffer.from(r).toString("base64");let t=new Uint8Array(r),e="";for(let o=0,n=t.length;o<n;o++)e+=String.fromCharCode(t[o]);return btoa(e)}function Xd(r){if(um){let o=Buffer.from(r,"base64");return o.buffer.slice(o.byteOffset,o.byteOffset+o.byteLength)}let t=atob(r),e=new Uint8Array(t.length);for(let o=0;o<t.length;++o)e.set([t.charCodeAt(o)],o);return e.buffer}function jd(r){return Ut.join(r)}function pm(r){for(r=r.trim();r.endsWith("/");)r=r.slice(0,r.length-1);let e=r.split("/");return e[e.length-1]}function kl(r,t){let e={modelTopology:r.modelTopology,format:r.format,generatedBy:r.generatedBy,convertedBy:r.convertedBy,weightsManifest:t};return r.signature!=null&&(e.signature=r.signature),r.userDefinedMetadata!=null&&(e.userDefinedMetadata=r.userDefinedMetadata),r.modelInitializer!=null&&(e.modelInitializer=r.modelInitializer),r.initializerSignature!=null&&(e.initializerSignature=r.initializerSignature),r.trainingConfig!=null&&(e.trainingConfig=r.trainingConfig),e}function mm(r,t,e){let o={modelTopology:r.modelTopology,format:r.format,generatedBy:r.generatedBy,convertedBy:r.convertedBy};if(r.trainingConfig!=null&&(o.trainingConfig=r.trainingConfig),r.weightsManifest!=null){if(!t)throw new Error("modelJSON has weightsManifest but weightSpecs is null");if(!e)throw new Error("modelJSON has weightsManifest but weightData is null");o.weightSpecs=t,o.weightData=e}return r.signature!=null&&(o.signature=r.signature),r.userDefinedMetadata!=null&&(o.userDefinedMetadata=r.userDefinedMetadata),r.modelInitializer!=null&&(o.modelInitializer=r.modelInitializer),r.initializerSignature!=null&&(o.initializerSignature=r.initializerSignature),o}async function Rn(r,t){let e,o;return r.weightsManifest!=null&&([e,o]=await t(r.weightsManifest)),mm(r,e,o)}function ze(r){if(r.modelTopology instanceof ArrayBuffer)throw new Error("Expected JSON model topology, received ArrayBuffer.");return{dateSaved:new Date,modelTopologyType:"JSON",modelTopologyBytes:r.modelTopology==null?0:Wd(JSON.stringify(r.modelTopology)),weightSpecsBytes:r.weightSpecs==null?0:Wd(JSON.stringify(r.weightSpecs)),weightDataBytes:r.weightData==null?0:new Ut(r.weightData).byteLength}}function va(r){let t=[];for(let e of r)t.push(...e.weights);return t}function WS(){let r=e=>{let o=e<<13,n=0;for(;(o&8388608)===0;)n-=8388608,o<<=1;return o&=-8388609,n+=947912704,o|n},t=new Uint32Array(2048);t[0]=0;for(let e=1;e<1024;e++)t[e]=r(e);for(let e=1024;e<2048;e++)t[e]=939524096+(e-1024<<13);return t}function zS(){let r=new Uint32Array(64);r[0]=0,r[31]=1199570944,r[32]=2147483648,r[63]=3347054592;for(let t=1;t<31;t++)r[t]=t<<23;for(let t=33;t<63;t++)r[t]=2147483648+(t-32<<23);return r}function KS(){let r=new Uint32Array(64);for(let t=0;t<64;t++)r[t]=1024;return r[0]=r[32]=0,r}function HS(){let r=WS(),t=zS(),e=KS();return o=>{let n=new ArrayBuffer(4*o.length),s=new Uint32Array(n);for(let i=0;i<o.length;i++){let a=o[i],l=r[e[a>>10]+(a&1023)]+t[a>>10];s[i]=l}return new Float32Array(n)}}var kt=class r{constructor(){this.saveRouters=[],this.loadRouters=[]}static getInstance(){return r.instance==null&&(r.instance=new r),r.instance}static registerSaveRouter(t){r.getInstance().saveRouters.push(t)}static registerLoadRouter(t){r.getInstance().loadRouters.push(t)}static getSaveHandlers(t){return r.getHandlers(t,"save")}static getLoadHandlers(t,e){return r.getHandlers(t,"load",e)}static getHandlers(t,e,o){let n=[];return(e==="load"?r.getInstance().loadRouters:r.getInstance().saveRouters).forEach(i=>{let a=i(t,o);a!==null&&n.push(a)}),n}},Yd=r=>kt.registerSaveRouter(r),Zd=r=>kt.registerLoadRouter(r),Qd=r=>kt.getSaveHandlers(r),Jd=(r,t)=>kt.getLoadHandlers(r,t);var fm="tensorflowjs",dm=1,Ao="models_store",_r="model_info_store";function th(){if(!I().getBool("IS_BROWSER"))throw new Error("Failed to obtain IndexedDB factory because the current environmentis not a web browser.");let r=typeof window>"u"?self:window,t=r.indexedDB||r.mozIndexedDB||r.webkitIndexedDB||r.msIndexedDB||r.shimIndexedDB;if(t==null)throw new Error("The current browser does not appear to support IndexedDB.");return t}function hm(r){let t=r.result;t.createObjectStore(Ao,{keyPath:"modelPath"}),t.createObjectStore(_r,{keyPath:"modelPath"})}var Ke=class{constructor(t){if(this.indexedDB=th(),t==null||!t)throw new Error("For IndexedDB, modelPath must not be null, undefined or empty.");this.modelPath=t}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");return this.databaseAction(this.modelPath,t)}async load(){return this.databaseAction(this.modelPath)}databaseAction(t,e){return new Promise((o,n)=>{let s=this.indexedDB.open(fm,dm);s.onupgradeneeded=()=>hm(s),s.onsuccess=()=>{let i=s.result;if(e==null){let a=i.transaction(Ao,"readonly"),c=a.objectStore(Ao).get(this.modelPath);c.onsuccess=()=>{if(c.result==null)return i.close(),n(new Error(`Cannot find model with path '${this.modelPath}' in IndexedDB.`));o(c.result.modelArtifacts)},c.onerror=u=>(i.close(),n(c.error)),a.oncomplete=()=>i.close()}else{e.weightData=Ut.join(e.weightData);let a=ze(e),l=i.transaction(_r,"readwrite"),c=l.objectStore(_r),u;try{u=c.put({modelPath:this.modelPath,modelArtifactsInfo:a})}catch(m){return n(m)}let p;u.onsuccess=()=>{p=i.transaction(Ao,"readwrite");let m=p.objectStore(Ao),f;try{f=m.put({modelPath:this.modelPath,modelArtifacts:e,modelArtifactsInfo:a})}catch(d){return n(d)}f.onsuccess=()=>o({modelArtifactsInfo:a}),f.onerror=d=>{c=l.objectStore(_r);let x=c.delete(this.modelPath);x.onsuccess=()=>(i.close(),n(f.error)),x.onerror=g=>(i.close(),n(f.error))}},u.onerror=m=>(i.close(),n(u.error)),l.oncomplete=()=>{p==null?i.close():p.oncomplete=()=>i.close()}}},s.onerror=i=>n(s.error)})}};Ke.URL_SCHEME="indexeddb://";var eh=r=>I().getBool("IS_BROWSER")&&!Array.isArray(r)&&r.startsWith(Ke.URL_SCHEME)?qS(r.slice(Ke.URL_SCHEME.length)):null;kt.registerSaveRouter(eh);kt.registerLoadRouter(eh);function qS(r){return new Ke(r)}function XS(r){return r.startsWith(Ke.URL_SCHEME)?r.slice(Ke.URL_SCHEME.length):r}var Rl=class{constructor(){this.indexedDB=th()}async listModels(){return new Promise((t,e)=>{let o=this.indexedDB.open(fm,dm);o.onupgradeneeded=()=>hm(o),o.onsuccess=()=>{let n=o.result,s=n.transaction(_r,"readonly"),a=s.objectStore(_r).getAll();a.onsuccess=()=>{let l={};for(let c of a.result)l[c.modelPath]=c.modelArtifactsInfo;t(l)},a.onerror=l=>(n.close(),e(a.error)),s.oncomplete=()=>n.close()},o.onerror=n=>e(o.error)})}async removeModel(t){return t=XS(t),new Promise((e,o)=>{let n=this.indexedDB.open(fm,dm);n.onupgradeneeded=()=>hm(n),n.onsuccess=()=>{let s=n.result,i=s.transaction(_r,"readwrite"),a=i.objectStore(_r),l=a.get(t),c;l.onsuccess=()=>{if(l.result==null)return s.close(),o(new Error(`Cannot find model with path '${t}' in IndexedDB.`));{let u=a.delete(t),p=()=>{c=s.transaction(Ao,"readwrite");let f=c.objectStore(Ao).delete(t);f.onsuccess=()=>e(l.result.modelArtifactsInfo),f.onerror=d=>o(l.error)};u.onsuccess=p,u.onerror=m=>(p(),s.close(),o(l.error))}},l.onerror=u=>(s.close(),o(l.error)),i.oncomplete=()=>{c==null?s.close():c.oncomplete=()=>s.close()}},n.onerror=s=>o(n.error)})}};var cr="/",An="tensorflowjs_models",rh="info",jS="model_topology",YS="weight_specs",ZS="weight_data",QS="model_metadata";function oh(r){return{info:[An,r,rh].join(cr),topology:[An,r,jS].join(cr),weightSpecs:[An,r,YS].join(cr),weightData:[An,r,ZS].join(cr),modelMetadata:[An,r,QS].join(cr)}}function nh(r){for(let t of Object.values(r))window.localStorage.removeItem(t)}function JS(r){let t=r.split(cr);if(t.length<3)throw new Error(`Invalid key format: ${r}`);return t.slice(1,t.length-1).join(cr)}function tT(r){return r.startsWith(He.URL_SCHEME)?r.slice(He.URL_SCHEME.length):r}var He=class{constructor(t){if(!I().getBool("IS_BROWSER")||typeof window>"u"||typeof window.localStorage>"u")throw new Error("The current environment does not support local storage.");if(this.LS=window.localStorage,t==null||!t)throw new Error("For local storage, modelPath must not be null, undefined or empty.");this.modelPath=t,this.keys=oh(this.modelPath)}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");{let e=JSON.stringify(t.modelTopology),o=JSON.stringify(t.weightSpecs),n=ze(t),s=Ut.join(t.weightData);try{this.LS.setItem(this.keys.info,JSON.stringify(n)),this.LS.setItem(this.keys.topology,e),this.LS.setItem(this.keys.weightSpecs,o),this.LS.setItem(this.keys.weightData,qd(s));let i={format:t.format,generatedBy:t.generatedBy,convertedBy:t.convertedBy,signature:t.signature!=null?t.signature:void 0,userDefinedMetadata:t.userDefinedMetadata!=null?t.userDefinedMetadata:void 0,modelInitializer:t.modelInitializer!=null?t.modelInitializer:void 0,initializerSignature:t.initializerSignature!=null?t.initializerSignature:void 0,trainingConfig:t.trainingConfig!=null?t.trainingConfig:void 0};return this.LS.setItem(this.keys.modelMetadata,JSON.stringify(i)),{modelArtifactsInfo:n}}catch{throw nh(this.keys),new Error(`Failed to save model '${this.modelPath}' to local storage: size quota being exceeded is a possible cause of this failure: modelTopologyBytes=${n.modelTopologyBytes}, weightSpecsBytes=${n.weightSpecsBytes}, weightDataBytes=${n.weightDataBytes}.`)}}}async load(){let t=JSON.parse(this.LS.getItem(this.keys.info));if(t==null)throw new Error(`In local storage, there is no model with name '${this.modelPath}'`);if(t.modelTopologyType!=="JSON")throw new Error("BrowserLocalStorage does not support loading non-JSON model topology yet.");let e={},o=JSON.parse(this.LS.getItem(this.keys.topology));if(o==null)throw new Error(`In local storage, the topology of model '${this.modelPath}' is missing.`);e.modelTopology=o;let n=JSON.parse(this.LS.getItem(this.keys.weightSpecs));if(n==null)throw new Error(`In local storage, the weight specs of model '${this.modelPath}' are missing.`);e.weightSpecs=n;let s=this.LS.getItem(this.keys.modelMetadata);if(s!=null){let a=JSON.parse(s);e.format=a.format,e.generatedBy=a.generatedBy,e.convertedBy=a.convertedBy,a.signature!=null&&(e.signature=a.signature),a.userDefinedMetadata!=null&&(e.userDefinedMetadata=a.userDefinedMetadata),a.modelInitializer!=null&&(e.modelInitializer=a.modelInitializer),a.initializerSignature!=null&&(e.initializerSignature=a.initializerSignature),a.trainingConfig!=null&&(e.trainingConfig=a.trainingConfig)}let i=this.LS.getItem(this.keys.weightData);if(i==null)throw new Error(`In local storage, the binary weight values of model '${this.modelPath}' are missing.`);return e.weightData=Xd(i),e}};He.URL_SCHEME="localstorage://";var sh=r=>I().getBool("IS_BROWSER")&&!Array.isArray(r)&&r.startsWith(He.URL_SCHEME)?eT(r.slice(He.URL_SCHEME.length)):null;kt.registerSaveRouter(sh);kt.registerLoadRouter(sh);function eT(r){return new He(r)}var Al=class{constructor(){v(I().getBool("IS_BROWSER"),()=>"Current environment is not a web browser"),v(typeof window>"u"||typeof window.localStorage<"u",()=>"Current browser does not appear to support localStorage"),this.LS=window.localStorage}async listModels(){let t={},e=An+cr,o=cr+rh;for(let n=0;n<this.LS.length;++n){let s=this.LS.key(n);if(s.startsWith(e)&&s.endsWith(o)){let i=JS(s);t[i]=JSON.parse(this.LS.getItem(s))}}return t}async removeModel(t){t=tT(t);let e=oh(t);if(this.LS.getItem(e.info)==null)throw new Error(`Cannot find model at path '${t}'`);let o=JSON.parse(this.LS.getItem(e.info));return nh(e),o}};var _n="://",_e=class r{constructor(){this.managers={}}static getInstance(){return r.instance==null&&(r.instance=new r),r.instance}static registerManager(t,e){v(t!=null,()=>"scheme must not be undefined or null."),t.endsWith(_n)&&(t=t.slice(0,t.indexOf(_n))),v(t.length>0,()=>"scheme must not be an empty string.");let o=r.getInstance();v(o.managers[t]==null,()=>`A model store manager is already registered for scheme '${t}'.`),o.managers[t]=e}static getManager(t){let e=r.getInstance().managers[t];if(e==null)throw new Error(`Cannot find model manager for scheme '${t}'`);return e}static getSchemes(){return Object.keys(r.getInstance().managers)}};function _l(r){if(r.indexOf(_n)===-1)throw new Error(`The url string provided does not contain a scheme. Supported schemes are: ${_e.getSchemes().join(",")}`);return{scheme:r.split(_n)[0],path:r.split(_n)[1]}}async function ih(r,t,e=!1){v(r!==t,()=>`Old path and new path are the same: '${r}'`);let o=kt.getLoadHandlers(r);v(o.length>0,()=>`Copying failed because no load handler is found for source URL ${r}.`),v(o.length<2,()=>`Copying failed because more than one (${o.length}) load handlers for source URL ${r}.`);let n=o[0],s=kt.getSaveHandlers(t);v(s.length>0,()=>`Copying failed because no save handler is found for destination URL ${t}.`),v(s.length<2,()=>`Copying failed because more than one (${o.length}) save handlers for destination URL ${t}.`);let i=s[0],a=_l(r).scheme,l=_l(r).path,c=a===_l(r).scheme,u=await n.load();e&&c&&await _e.getManager(a).removeModel(l);let p=await i.save(u);return e&&!c&&await _e.getManager(a).removeModel(l),p.modelArtifactsInfo}async function ah(){let r=_e.getSchemes(),t={};for(let e of r){let o=await _e.getManager(e).listModels();for(let n in o){let s=e+_n+n;t[s]=o[n]}}return t}async function lh(r){let t=_l(r);return _e.getManager(t.scheme).removeModel(t.path)}async function ch(r,t){return ih(r,t,!1)}async function uh(r,t){return ih(r,t,!0)}var gm=class{constructor(){this.messageName="setTimeoutCustom",this.functionRefs=[],this.handledMessageCount=0,this.hasEventListener=!1}fetch(t,e){return fetch(t,e)}now(){return performance.now()}encode(t,e){if(e!=="utf-8"&&e!=="utf8")throw new Error(`Browser's encoder only supports utf-8, but got ${e}`);return this.textEncoder==null&&(this.textEncoder=new TextEncoder),this.textEncoder.encode(t)}decode(t,e){return new TextDecoder(e).decode(t)}setTimeoutCustom(t,e){if(typeof window>"u"||!I().getBool("USE_SETTIMEOUTCUSTOM")){setTimeout(t,e);return}this.functionRefs.push(t),setTimeout(()=>{window.postMessage({name:this.messageName,index:this.functionRefs.length-1},"*")},e),this.hasEventListener||(this.hasEventListener=!0,window.addEventListener("message",o=>{if(o.source===window&&o.data.name===this.messageName){o.stopPropagation();let n=this.functionRefs[o.data.index];n(),this.handledMessageCount++,this.handledMessageCount===this.functionRefs.length&&(this.functionRefs=[],this.handledMessageCount=0)}},!0))}isTypedArray(t){return yl(t)}};if(I().get("IS_BROWSER")){I().setPlatform("browser",new gm);try{_e.registerManager(He.URL_SCHEME,new Al)}catch{}try{_e.registerManager(Ke.URL_SCHEME,new Rl)}catch{}}var rT={importFetch:()=>ph()},xm;var bm=class{constructor(){this.util=mh(),this.textEncoder=new this.util.TextEncoder}fetch(t,e){return I().global.fetch!=null?I().global.fetch(t,e):(xm==null&&(xm=rT.importFetch()),xm(t,e))}now(){let t=process.hrtime();return t[0]*1e3+t[1]/1e6}encode(t,e){if(e!=="utf-8"&&e!=="utf8")throw new Error(`Node built-in encoder only supports utf-8, but got ${e}`);return this.textEncoder.encode(t)}decode(t,e){return t.length===0?"":new this.util.TextDecoder(e).decode(t)}isTypedArray(t){return this.util.types.isFloat32Array(t)||this.util.types.isInt32Array(t)||this.util.types.isUint8Array(t)||this.util.types.isUint8ClampedArray(t)}};I().get("IS_NODE")&&!I().get("IS_BROWSER")&&I().setPlatform("node",new bm);function j(r,t="float32",e){return t=t||"float32",ft(r),new ce(r,t,e)}function oT(r,t){let e=h(r,"x","cast");if(!Ip(t))throw new Error(`Failed to cast to unknown dtype ${t}`);if(t==="string"&&e.dtype!=="string"||t!=="string"&&e.dtype==="string")throw new Error("Only strings can be casted to strings");let o={x:e},n={dtype:t};return w.runKernel(Er,o,n)}var Y=y({cast_:oT});function nT(r){let e={x:h(r,"x","clone","string_or_numeric")};return w.runKernel(Ir,e)}var ve=y({clone_:nT});function Dl(r,t=!1){console.log(r.toString(t))}rm();var sT={buffer:j,cast:Y,clone:ve,print:Dl};Od(sT);function iT(r,t){let e=h(r,"a","add"),o=h(t,"b","add");[e,o]=q(e,o);let n={a:e,b:o};return w.runKernel("Add",n)}var U=y({add_:iT});function aT(r,t){let e=h(r,"a","floorDiv"),o=h(t,"b","floorDiv");[e,o]=q(e,o);let n={a:e,b:o};return w.runKernel(lo,n)}var Fl=y({floorDiv_:aT});function lT(r,t){let e=h(r,"a","div"),o=h(t,"b","div");if([e,o]=q(e,o),e.dtype==="int32"&&o.dtype==="int32")return Fl(e,o);let n={a:e,b:o},s={};return w.runKernel(qs,n,s)}var Z=y({div_:lT});function cT(r,t){let e=h(r,"a","mul"),o=h(t,"b","mul");[e,o]=q(e,o);let n={a:e,b:o};return w.runKernel(go,n)}var F=y({mul_:cT});function uT(r){let t=h(r,"x","abs");if(t.dtype==="complex64"){let e={x:t};return w.runKernel(ks,e)}else{let e={x:t};return w.runKernel("Abs",e)}}var Dt=y({abs_:uT});function pT(r){let e={x:h(r,"x","acos")};return w.runKernel(ms,e)}var fh=y({acos_:pT});function mT(r){let e={x:h(r,"x","acosh")};return w.runKernel(fs,e)}var dh=y({acosh_:mT});function fT(r){v(Array.isArray(r),()=>"The argument passed to tf.addN() must be a list of tensors"),v(r.length>=1,()=>`Must pass at least one tensor to tf.addN(), but got ${r.length}`);let t=r.map((n,s)=>h(n,`tensors${s}`,"addN")),e=t[0];t.forEach(n=>{if(n.dtype!==e.dtype)throw new Error("All tensors passed to tf.addN() must have the same dtype")}),t.forEach(n=>{if(!Xt(n.shape,e.shape))throw new Error("All tensors passed to tf.addN() must have the same shape")});let o=t;return w.runKernel(ds,o)}var hh=y({addN_:fT});function dT(r,t=null,e=!1){let n={x:h(r,"x","all","bool")},s={axis:t,keepDims:e};return w.runKernel("All",n,s)}var gh=y({all_:dT});function hT(r,t=null,e=!1){let n={x:h(r,"x","any","bool")},s={axis:t,keepDims:e};return w.runKernel("Any",n,s)}var xh=y({any_:hT});function gT(r,t=0){let o={x:h(r,"x","argMax")},n={axis:t};return w.runKernel(hs,o,n)}var bh=y({argMax_:gT});function xT(r,t=0){let o={x:h(r,"x","argMin")},n={axis:t};return w.runKernel(gs,o,n)}var yh=y({argMin_:xT});function bT(r){let e={x:h(r,"x","asin")};return w.runKernel(xs,e)}var wh=y({asin_:bT});function yT(r){let e={x:h(r,"x","asinh")};return w.runKernel(bs,e)}var Ch=y({asinh_:yT});function wT(r){let e={x:h(r,"x","atan")};return w.runKernel(ys,e)}var vh=y({atan_:wT});function CT(r,t){let e=h(r,"a","atan2"),o=h(t,"b","atan2");[e,o]=q(e,o);let n={a:e,b:o};return w.runKernel(Cs,n)}var $h=y({atan2_:CT});function vT(r){let e={x:h(r,"x","atanh")};return w.runKernel(ws,e)}var Sh=y({atanh_:vT});function $T(r,t,e,o,n="NHWC",s){let i=r[3],a=[...t,i],l=Eh(n);return Do(r,a,e,s,o,null,null,l)}function wm(r,t,e,o,n,s,i="channelsLast"){let[a,l]=$a(t),c;if(i==="channelsLast")c=[a,l,r[3],r[3]];else if(i==="channelsFirst")c=[a,l,r[1],r[1]];else throw new Error(`Unknown dataFormat ${i}`);return Do(r,c,e,o,n,s,!1,i)}function ST(r,t,e,o,n,s,i="NDHWC"){let[a,l,c]=ym(t),u,p;if(i==="NDHWC")p="channelsLast",u=[a,l,c,r[4],r[4]];else if(i==="NCDHW")p="channelsFirst",u=[a,l,c,r[1],r[1]];else throw new Error(`Unknown dataFormat ${i}`);return Th(r,u,e,o,n,!1,p,s)}function Do(r,t,e,o,n,s,i=!1,a="channelsLast"){let[l,c,u,p]=[-1,-1,-1,-1];if(a==="channelsLast")[l,c,u,p]=r;else if(a==="channelsFirst")[l,p,c,u]=r;else throw new Error(`Unknown dataFormat ${a}`);let[m,f,,d]=t,[x,g]=$a(e),[b,$]=$a(o),S=Dn(m,b),E=Dn(f,$),{padInfo:N,outHeight:R,outWidth:A}=IT(n,c,u,x,g,S,E,s,a),_=i?d*p:d,P;return a==="channelsFirst"?P=[l,_,R,A]:a==="channelsLast"&&(P=[l,R,A,_]),{batchSize:l,dataFormat:a,inHeight:c,inWidth:u,inChannels:p,outHeight:R,outWidth:A,outChannels:_,padInfo:N,strideHeight:x,strideWidth:g,filterHeight:m,filterWidth:f,effectiveFilterHeight:S,effectiveFilterWidth:E,dilationHeight:b,dilationWidth:$,inShape:r,outShape:P,filterShape:t}}function Th(r,t,e,o,n,s=!1,i="channelsLast",a){let[l,c,u,p,m]=[-1,-1,-1,-1,-1];if(i==="channelsLast")[l,c,u,p,m]=r;else if(i==="channelsFirst")[l,m,c,u,p]=r;else throw new Error(`Unknown dataFormat ${i}`);let[f,d,x,,g]=t,[b,$,S]=ym(e),[E,N,R]=ym(o),A=Dn(f,E),_=Dn(d,N),P=Dn(x,R),{padInfo:O,outDepth:B,outHeight:W,outWidth:J}=NT(n,c,u,p,b,$,S,A,_,P,a),et=s?g*m:g,st;return i==="channelsFirst"?st=[l,et,B,W,J]:i==="channelsLast"&&(st=[l,B,W,J,et]),{batchSize:l,dataFormat:i,inDepth:c,inHeight:u,inWidth:p,inChannels:m,outDepth:B,outHeight:W,outWidth:J,outChannels:et,padInfo:O,strideDepth:b,strideHeight:$,strideWidth:S,filterDepth:f,filterHeight:d,filterWidth:x,effectiveFilterDepth:A,effectiveFilterHeight:_,effectiveFilterWidth:P,dilationDepth:E,dilationHeight:N,dilationWidth:R,inShape:r,outShape:st,filterShape:t}}function TT(r,t,e,o,n){o==null&&(o=Cm(r,t,e));let s=r[0],i=r[1],a=Sa((s-t+2*o)/e+1,n),l=Sa((i-t+2*o)/e+1,n);return[a,l]}function ET(r,t,e,o,n,s){n==null&&(n=Cm(r,t[0],o[0]));let i=[0,0,0,e];for(let a=0;a<3;a++)r[a]+2*n>=t[a]&&(i[a]=Sa((r[a]-t[a]+2*n)/o[a]+1,s));return i}function Cm(r,t,e,o=1){let n=Dn(t,o);return Math.floor((r[0]*(e-1)-e+n)/2)}function $a(r){return typeof r=="number"?[r,r,r]:r.length===2?[r[0],r[1],1]:r}function ym(r){return typeof r=="number"?[r,r,r]:r}function Dn(r,t){return t<=1?r:r+(r-1)*(t-1)}function IT(r,t,e,o,n,s,i,a,l){let c,u,p;if(typeof r=="number"){c={top:r,bottom:r,left:r,right:r,type:r===0?"VALID":"NUMBER"};let f=TT([t,e],s,o,r,a);u=f[0],p=f[1]}else if(r==="same"){u=Math.ceil(t/o),p=Math.ceil(e/n);let m=Math.max(0,(u-1)*o+s-t),f=Math.max(0,(p-1)*n+i-e),d=Math.floor(m/2),x=m-d,g=Math.floor(f/2),b=f-g;c={top:d,bottom:x,left:g,right:b,type:"SAME"}}else if(r==="valid")c={top:0,bottom:0,left:0,right:0,type:"VALID"},u=Math.ceil((t-s+1)/o),p=Math.ceil((e-i+1)/n);else if(typeof r=="object"){let m=l==="channelsLast"?r[1][0]:r[2][0],f=l==="channelsLast"?r[1][1]:r[2][1],d=l==="channelsLast"?r[2][0]:r[3][0],x=l==="channelsLast"?r[2][1]:r[3][1];c={top:m,bottom:f,left:d,right:x,type:m===0&&f===0&&d===0&&x===0?"VALID":"EXPLICIT"},u=Sa((t-s+m+f)/o+1,a),p=Sa((e-i+d+x)/n+1,a)}else throw Error(`Unknown padding parameter: ${r}`);return{padInfo:c,outHeight:u,outWidth:p}}function NT(r,t,e,o,n,s,i,a,l,c,u){let p,m,f,d;if(r==="valid"&&(r=0),typeof r=="number"){p={top:r,bottom:r,left:r,right:r,front:r,back:r,type:r===0?"VALID":"NUMBER"};let g=ET([t,e,o,1],[a,l,c],1,[n,s,i],r,u);m=g[0],f=g[1],d=g[2]}else if(r==="same"){m=Math.ceil(t/n),f=Math.ceil(e/s),d=Math.ceil(o/i);let x=(m-1)*n+a-t,g=(f-1)*s+l-e,b=(d-1)*i+c-o,$=Math.floor(x/2),S=x-$,E=Math.floor(g/2),N=g-E,R=Math.floor(b/2),A=b-R;p={top:E,bottom:N,left:R,right:A,front:$,back:S,type:"SAME"}}else throw Error(`Unknown padding parameter: ${r}`);return{padInfo:p,outDepth:m,outHeight:f,outWidth:d}}function Sa(r,t){if(!t)return Math.trunc(r);switch(t){case"round":return Math.round(r);case"ceil":return Math.ceil(r);case"floor":return Math.floor(r);default:throw new Error(`Unknown roundingMode ${t}`)}}function _o(r){let[t,e,o]=$a(r);return t===1&&e===1&&o===1}function Kt(r,t){return _o(r)||_o(t)}function qe(r){return $a(r).every(t=>t>0)}function Eh(r){if(r==="NHWC")return"channelsLast";if(r==="NCHW")return"channelsFirst";throw new Error(`Unknown dataFormat ${r}`)}function Tt(r,t,e){if(e!=null){if(typeof t=="string")throw Error(`Error in ${r}: pad must be an integer when using dimRoundingMode ${e} but got pad ${t}.`);if(typeof t=="number")v(sr(t),()=>`Error in ${r}: pad must be an integer when using dimRoundingMode ${e} but got pad ${t}.`);else if(typeof t=="object")t.forEach(o=>{o.forEach(n=>{v(sr(n),()=>`Error in ${r}: pad must be an integer when using dimRoundingMode ${e} but got pad ${n}.`)})});else throw Error(`Error in ${r}: Unknown padding parameter: ${t}`)}}function kT(r,t){let o={x:h(r,"x","reshape","string_or_numeric")},n={shape:t};return w.runKernel(Di,o,n)}var k=y({reshape_:kT});function RT(r,t,e,o,n){let s=h(r,"x","avgPool","float32"),i=1;v(Kt(e,i),()=>`Error in avgPool: Either strides or dilations must be 1. Got strides ${e} and dilations '${i}'`);let a=s,l=!1;s.rank===3&&(l=!0,a=k(s,[1,s.shape[0],s.shape[1],s.shape[2]])),v(a.rank===4,()=>`Error in avgPool: x must be rank 4 but got rank ${a.rank}.`),Tt("avgPool",o,n);let c={x:a},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n},p=w.runKernel(vs,c,u);return p=Y(p,s.dtype),l?k(p,[p.shape[1],p.shape[2],p.shape[3]]):p}var Pl=y({avgPool_:RT});function AT(r,t,e,o,n,s="NDHWC"){let i=h(r,"x","avgPool3d","float32"),a=i,l=!1;i.rank===4&&(l=!0,a=k(i,[1,i.shape[0],i.shape[1],i.shape[2],i.shape[3]])),v(a.rank===5,()=>`Error in avgPool3d: x must be rank 5 but got rank ${a.rank}.`),v(s==="NDHWC",()=>`Error in avgPool3d: Only NDHWC is currently supported, but got dataFormat of ${s}`),v(typeof e=="number"&&e>0||Array.isArray(e)&&e[0]>0&&e[1]>0&&e[2]>0,()=>`Error in avgPool3d: Stride must be > 0, but got '${e}'`),Tt("avgPool3d",o,n);let c={x:a},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n,dataFormat:s},p=w.runKernel($s,c,u);return p=Y(p,a.dtype),l?k(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}var Ih=y({avgPool3d_:AT});function _T(r,t=0){v(r.length>=1,()=>"Pass at least one tensor to concat");let e=ar(r,"tensors","concat","string_or_numeric");if(e[0].dtype==="complex64"&&e.forEach(s=>{if(s.dtype!=="complex64")throw new Error(`Cannot concatenate complex64 tensors with a tensor
          with dtype ${s.dtype}. `)}),e.length===1)return ve(e[0]);let o=e,n={axis:t};return w.runKernel(Rs,o,n)}var vt=y({concat_:_T});function DT(r,t,e=!1,o=!1){let n=h(r,"a","matMul"),s=h(t,"b","matMul");[n,s]=q(n,s);let i={a:n,b:s},a={transposeA:e,transposeB:o};return w.runKernel(Ss,i,a)}var Q=y({matMul_:DT});function FT(r){let e={x:h(r,"x","sigmoid","float32")};return w.runKernel(yo,e)}var je=y({sigmoid_:FT});function PT(r,t,e){let o=h(r,"x","slice","string_or_numeric");if(o.rank===0)throw new Error("Slicing scalar is not possible");let n={x:o},s={begin:t,size:e};return w.runKernel(bn,n,s)}var rt=y({slice_:PT});function OT(r){let e={x:h(r,"x","tanh","float32")};return w.runKernel(sa,e)}var Ta=y({tanh_:OT});function MT(r,t,e,o,n,s){let i=h(r,"forgetBias","basicLSTMCell"),a=h(t,"lstmKernel","basicLSTMCell"),l=h(e,"lstmBias","basicLSTMCell"),c=h(o,"data","basicLSTMCell"),u=h(n,"c","basicLSTMCell"),p=h(s,"h","basicLSTMCell"),m=vt([c,p],1),f=Q(m,a),d=U(f,l),x=d.shape[0],g=d.shape[1]/4,b=[x,g],$=rt(d,[0,0],b),S=rt(d,[0,g],b),E=rt(d,[0,g*2],b),N=rt(d,[0,g*3],b),R=U(F(je($),Ta(S)),F(u,je(U(i,E)))),A=F(Ta(R),je(N));return[R,A]}var Nh=y({basicLSTMCell_:MT});function LT(r,t,e){let o=h(r,"x","batchToSpaceND"),n=t.reduce((a,l)=>a*l);v(o.rank>=1+t.length,()=>`input rank is ${o.rank} but should be > than blockShape.length ${t.length}`),v(e.length===t.length,()=>`crops.length is ${e.length} but should be equal to blockShape.length  ${t.length}`),v(o.shape[0]%n===0,()=>`input tensor batch is ${o.shape[0]} but is not divisible by the product of the elements of blockShape ${t.join(" * ")} === ${n}`);let s={x:o},i={blockShape:t,crops:e};return w.runKernel(Ts,s,i)}var Ol=y({batchToSpaceND_:LT});function kh(r){let t;return r.rank===0||r.rank===1?t=k(r,[1,1,1,r.size]):r.rank===2?t=k(r,[1,1,r.shape[0],r.shape[1]]):r.rank===3?t=k(r,[1,r.shape[0],r.shape[1],r.shape[2]]):t=r,t}function BT(r,t,e,o,n,s){s==null&&(s=.001);let i=h(r,"x","batchNorm"),a=h(t,"mean","batchNorm"),l=h(e,"variance","batchNorm"),c;n!=null&&(c=h(n,"scale","batchNorm"));let u;o!=null&&(u=h(o,"offset","batchNorm")),v(a.rank===l.rank,()=>"Batch normalization gradient requires mean and variance to have equal ranks."),v(u==null||a.rank===u.rank,()=>"Batch normalization gradient requires mean and offset to have equal ranks."),v(c==null||a.rank===c.rank,()=>"Batch normalization gradient requires mean and scale to have equal ranks.");let m={x:kh(i),scale:c,offset:u,mean:a,variance:l},f={varianceEpsilon:s},d=w.runKernel(Qs,m,f);return k(d,i.shape)}var Dr=y({batchNorm_:BT});function GT(r,t,e,o,n,s){let i=h(r,"x","batchNorm"),a=h(t,"mean","batchNorm"),l=h(e,"variance","batchNorm"),c;n!=null&&(c=h(n,"scale","batchNorm"));let u;return o!=null&&(u=h(o,"offset","batchNorm")),v(i.rank===2,()=>`Error in batchNorm2D: x must be rank 2 but got rank ${i.rank}.`),v(a.rank===2||a.rank===1,()=>`Error in batchNorm2D: mean must be rank 2 or rank 1 but got rank ${a.rank}.`),v(l.rank===2||l.rank===1,()=>`Error in batchNorm2D: variance must be rank 2 or rank 1 but got rank ${l.rank}.`),c!=null&&v(c.rank===2||c.rank===1,()=>`Error in batchNorm2D: scale must be rank 2 or rank 1 but got rank ${c.rank}.`),u!=null&&v(u.rank===2||u.rank===1,()=>`Error in batchNorm2D: offset must be rank 2 or rank 1 but got rank ${u.rank}.`),Dr(i,a,l,u,c,s)}var Rh=y({batchNorm2d_:GT});function UT(r,t,e,o,n,s){let i=h(r,"x","batchNorm"),a=h(t,"mean","batchNorm"),l=h(e,"variance","batchNorm"),c;n!=null&&(c=h(n,"scale","batchNorm"));let u;return o!=null&&(u=h(o,"offset","batchNorm")),v(i.rank===3,()=>`Error in batchNorm3D: x must be rank 3 but got rank ${i.rank}.`),v(a.rank===3||a.rank===1,()=>`Error in batchNorm3D: mean must be rank 3 or rank 1 but got rank ${a.rank}.`),v(l.rank===3||l.rank===1,()=>`Error in batchNorm3D: variance must be rank 3 or rank 1 but got rank ${l.rank}.`),c!=null&&v(c.rank===3||c.rank===1,()=>`Error in batchNorm3D: scale must be rank 3 or rank 1 but got rank ${c.rank}.`),u!=null&&v(u.rank===3||u.rank===1,()=>`Error in batchNorm3D: offset must be rank 3 or rank 1 but got rank ${u.rank}.`),Dr(i,a,l,u,c,s)}var Ah=y({batchNorm3d_:UT});function VT(r,t,e,o,n,s){let i=h(r,"x","batchNorm"),a=h(t,"mean","batchNorm"),l=h(e,"variance","batchNorm"),c;n!=null&&(c=h(n,"scale","batchNorm"));let u;return o!=null&&(u=h(o,"offset","batchNorm")),v(i.rank===4,()=>`Error in batchNorm4D: x must be rank 4 but got rank ${i.rank}.`),v(a.rank===4||a.rank===1,()=>`Error in batchNorm4D: mean must be rank 4 or rank 1 but got rank ${a.rank}.`),v(l.rank===4||l.rank===1,()=>`Error in batchNorm4D: variance must be rank 4 or rank 1 but got rank ${l.rank}.`),c!=null&&v(c.rank===4||c.rank===1,()=>`Error in batchNorm4D: scale must be rank 4 or rank 1 but got rank ${c.rank}.`),u!=null&&v(u.rank===4||u.rank===1,()=>`Error in batchNorm4D: offset must be rank 4 or rank 1 but got rank ${u.rank}.`),Dr(i,a,l,u,c,s)}var _h=y({batchNorm4d_:VT});function WT(r,t,e){let o=h(r,"x","bincount"),n=h(t,"weights","bincount");v(o.dtype==="int32",()=>`Error in bincount: input dtype must be int32, but got ${o.dtype}`),v(e>=0,()=>`size must be non-negative, but got ${e}.`),v(n.size===o.size||n.size===0,()=>`Error in bincount: weights must have the same size as input or0-length, but got input shape: ${o.shape}, weights shape: ${n.shape}.`);let s={x:o,weights:n},i={size:e};return w.runKernel(Es,s,i)}var Ml=y({bincount_:WT});function zT(r,t){let e=h(r,"x","bitwiseAnd"),o=h(t,"y","bitwiseAnd");if(!Xt(e.shape,o.shape))throw new Error(`BitwiseAnd: Tensors must have the same shape. x: ${e.shape}, y: ${o.shape}`);if(e.dtype!=="int32"||o.dtype!=="int32")throw new Error(`BitwiseAnd: Only supports 'int32' values in tensor, found type of x: ${e.dtype} and type of y: ${o.dtype}`);let n={a:e,b:o};return w.runKernel(oo,n)}var Dh=y({bitwiseAnd_:zT});function KT(r,t){let e=h(r,"s0","broadcastArgs","int32"),o=h(t,"s1","broadcastArgs","int32");if(e.rank!==1)throw new Error(`broadcastArgs(): first input must be a vector (rank=1). Has rank ${e.rank}`);if(o.rank!==1)throw new Error(`broadcastArgs(): second input must be a vector (rank=1). Has rank ${o.rank}`);let n={s0:e,s1:o};return w.runKernel(Is,n)}var Fh=y({broadcastArgs_:KT});function HT(r,t){let e=h(r,"broadcastTo","x"),o=e.shape;if(ft(t),t.length<e.rank)throw new Error(`broadcastTo(): shape.length=${t.length} < input.rank=${e.rank}.`);if(t.length>e.rank){let c=e.shape.slice();for(;c.length<t.length;)c.unshift(1);e=k(e,c)}let n=e.shape,s=Array.from(t);for(let c=t.length-1;c>=0;c--)if(n[c]===t[c])s[c]=1;else if(e.shape[c]!==1)throw new Error(`broadcastTo(): [${o}] cannot be broadcast to [${t}].`);if(s.map((c,u)=>c>1?u:-1).filter(c=>c>=0).length===0)return ve(e);let a={x:e},l={reps:s};return w.runKernel($o,a,l)}var Fr=y({broadcastTo_:HT});function qT(r){let e={x:h(r,"x","ceil","float32")};return w.runKernel(no,e)}var Ph=y({ceil_:qT});function Ye(r,t,e){ft(r),e=e||Sr(t);let o={shape:r,value:t,dtype:e};return w.runKernel(Ys,{},o)}function XT(r,t,e){let o=h(r,"x","clipByValue");if(v(t<=e,()=>`Error in clip: min (${t}) must be less than or equal to max (${e}).`),t===e)return Ye(o.shape,t,o.dtype);let n={x:o},s={clipValueMin:t,clipValueMax:e};return w.runKernel(Ns,n,s)}var Oh=y({clipByValue_:XT});function jT(r){return vt(r,0)}var Mh=y({concat1d_:jT});function YT(r,t){return vt(r,t)}var Lh=y({concat2d_:YT});function ZT(r,t){return vt(r,t)}var Bh=y({concat3d_:ZT});function QT(r,t){return vt(r,t)}var Gh=y({concat4d_:QT});function JT(r,t,e,o,n="NHWC",s=[1,1],i){let a=h(r,"x","conv2d","float32"),l=h(t,"filter","conv2d","float32"),c=a,u=!1;a.rank===3&&(u=!0,c=k(a,[1,a.shape[0],a.shape[1],a.shape[2]])),v(c.rank===4,()=>`Error in conv2d: input must be rank 4, but got rank ${c.rank}.`),v(l.rank===4,()=>`Error in conv2d: filter must be rank 4, but got rank ${l.rank}.`),Tt("conv2d",o,i);let p=n==="NHWC"?c.shape[3]:c.shape[1];v(p===l.shape[2],()=>`Error in conv2d: depth of input (${p}) must match input depth for filter ${l.shape[2]}.`),v(Kt(e,s),()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`),v(qe(s),()=>"Error in conv2D: Dilated rates should be larger than 0."),v(qe(e),()=>"Error in conv2D: Strides should be larger than 0.");let m={x:c,filter:l},f={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:i},d=w.runKernel(As,m,f);return u?k(d,[d.shape[1],d.shape[2],d.shape[3]]):d}var Pr=y({conv2d_:JT});function tE(r,t,e,o,n="NWC",s=1,i){let a=h(r,"x","conv1d"),l=h(t,"filter","conv1d"),c=a,u=!1;a.rank===2&&(u=!0,c=k(a,[1,a.shape[0],a.shape[1]])),v(c.rank===3,()=>`Error in conv1d: input must be rank 3, but got rank ${c.rank}.`),v(l.rank===3,()=>`Error in conv1d: filter must be rank 3, but got rank ${l.rank}.`),Tt("conv1d",o,i),v(c.shape[2]===l.shape[1],()=>`Error in conv1d: depth of input (${c.shape[2]}) must match input depth for filter ${l.shape[1]}.`),v(Kt(e,s),()=>`Error in conv1D: Either stride or dilation must be 1. Got stride ${e} and dilation '${s}'`),v(qe(s),()=>"Error in conv1D: Dilated rates should be larger than 0."),v(qe(e),()=>"Error in conv1D: Stride should be larger than 0."),v(n==="NWC",()=>`Error in conv1d: got dataFormat of ${n} but only NWC is currently supported.`);let p=k(l,[1,l.shape[0],l.shape[1],l.shape[2]]),m=k(c,[c.shape[0],1,c.shape[1],c.shape[2]]),g=Pr(m,p,[1,e],o,"NHWC",[1,s],i);return u?k(g,[g.shape[2],g.shape[3]]):k(g,[g.shape[0],g.shape[2],g.shape[3]])}var Uh=y({conv1d_:tE});function eE(r,t,e,o,n,s="NHWC",i){v(r.length===t.rank,()=>`Length of inShape (${r.length}) and rank of dy (${t.rank}) must match`);let a=r,l=t,c=!1;t.rank===3&&(c=!0,l=k(t,[1,t.shape[0],t.shape[1],t.shape[2]]),a=[1,r[0],r[1],r[2]]),v(a.length===4,()=>`Error in conv2dDerInput: inShape must be length 4, but got length ${a.length}.`),v(l.rank===4,()=>`Error in conv2dDerInput: dy must be rank 4, but got rank ${l.rank}`),v(e.rank===4,()=>`Error in conv2dDerInput: filter must be rank 4, but got rank ${e.rank}`);let u=s==="NHWC"?a[3]:a[1],p=s==="NHWC"?l.shape[3]:l.shape[1];v(u===e.shape[2],()=>`Error in conv2dDerInput: depth of input (${u}) must match input depth for filter ${e.shape[2]}.`),v(p===e.shape[3],()=>`Error in conv2dDerInput: depth of output (${p}) must match output depth for filter ${e.shape[3]}.`),Tt("conv2dDerInput",n,i);let m={dy:l,filter:e},f={strides:o,pad:n,dataFormat:s,dimRoundingMode:i,inputShape:a},d=w.runKernel(Ds,m,f);return c?k(d,[d.shape[1],d.shape[2],d.shape[3]]):d}var Ll=y({conv2DBackpropInput_:eE});function rE(r,t,e,o,n,s){let i=h(r,"x","conv2dTranspose"),a=h(t,"filter","conv2dTranspose");return Ll(e,i,a,o,n,"NHWC",s)}var Vh=y({conv2dTranspose_:rE});function oE(r,t,e,o,n="NDHWC",s=[1,1,1]){let i=h(r,"x","conv3d"),a=h(t,"filter","conv3d"),l=i,c=!1;i.rank===4&&(c=!0,l=k(i,[1,i.shape[0],i.shape[1],i.shape[2],i.shape[3]])),v(l.rank===5,()=>`Error in conv3d: input must be rank 5, but got rank ${l.rank}.`),v(a.rank===5,()=>`Error in conv3d: filter must be rank 5, but got rank ${a.rank}.`),v(l.shape[4]===a.shape[3],()=>`Error in conv3d: depth of input (${l.shape[4]}) must match input depth for filter ${a.shape[3]}.`),v(Kt(e,s),()=>`Error in conv3D: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`),v(n==="NDHWC",()=>`Error in conv3d: got dataFormat of ${n} but only NDHWC is currently supported.`),v(qe(s),()=>"Error in conv3D: Dilated rates should be larger than 0."),v(qe(e),()=>"Error in conv3D: Strides should be larger than 0.");let u={x:l,filter:a},p={strides:e,pad:o,dataFormat:n,dilations:s},m=w.runKernel(Fs,u,p);return c?k(m,[m.shape[1],m.shape[2],m.shape[3],m.shape[4]]):m}var Wh=y({conv3d_:oE});function nE(r,t,e,o,n){v(r.length===t.rank,()=>`Length of inShape (${r.length}) and rank of dy (${t.rank}) must match`);let s=r,i=t,a=!1;t.rank===4&&(a=!0,i=k(t,[1,t.shape[0],t.shape[1],t.shape[2],t.shape[3]]),s=[1,r[0],r[1],r[2],r[3]]);let l=s[4],c=i.shape[4];v(s.length===5,()=>`Error in conv3dDerInput: inShape must be length 5, but got length ${s.length}.`),v(i.rank===5,()=>`Error in conv3dDerInput: dy must be rank 5, but got rank ${i.rank}`),v(e.rank===5,()=>`Error in conv3dDerInput: filter must be rank 5, but got rank ${e.rank}`),v(l===e.shape[3],()=>`Error in conv3dDerInput: depth of input (${l}) must match input depth for filter ${e.shape[3]}.`),v(c===e.shape[4],()=>`Error in conv3dDerInput: depth of output (${c}) must match output depth for filter ${e.shape[4]}.`);let u={dy:i,filter:e},p={pad:n,strides:o,inputShape:s},m=w.runKernel(Ps,u,p);return a?k(m,[m.shape[1],m.shape[2],m.shape[3],m.shape[4]]):m}var zh=y({conv3DBackpropInput_:nE});function sE(r,t,e,o,n){let s=h(r,"x","conv3dTranspose"),i=h(t,"filter","conv3dTranspose");return zh(e,s,i,o,n)}var Kh=y({conv3dTranspose_:sE});function iE(r){let e={x:h(r,"x","cos","float32")};return w.runKernel("Cos",e)}var Hh=y({cos_:iE});function aE(r){let e={x:h(r,"x","cosh","float32")};return w.runKernel(Os,e)}var qh=y({cosh_:aE});function lE(r,t=0,e=!1,o=!1){let s={x:h(r,"x","cumprod")},i={axis:t,exclusive:e,reverse:o};return w.runKernel(Ms,s,i)}var Xh=y({cumprod_:lE});function cE(r,t=0,e=!1,o=!1){let s={x:h(r,"x","cumsum")},i={axis:t,exclusive:e,reverse:o};return w.runKernel(Ls,s,i)}var jh=y({cumsum_:cE});function uE(r,t,e,o=!1){let n=h(r,"x","denseBincount"),s=h(t,"weights","denseBincount");v(n.dtype==="int32",()=>`Error in denseBincount: input dtype must be int32, but got ${n.dtype}`),v(n.rank<=2,()=>`Error in denseBincount: input must be at most rank 2, but got rank ${n.rank}.`),v(e>=0,()=>`size must be non-negative, but got ${e}.`),v(s.size===n.size||s.size===0,()=>`Error in denseBincount: weights must have the same shape as x or 0-length, but got x shape: ${n.shape}, weights shape: ${s.shape}.`);let i={x:n,weights:s},a={size:e,binaryOutput:o};return w.runKernel(Gs,i,a)}var Yh=y({denseBincount_:uE});function pE(r,t,e="NHWC"){let o=h(r,"x","depthToSpace","float32"),n=e==="NHWC"?o.shape[1]:o.shape[2],s=e==="NHWC"?o.shape[2]:o.shape[3],i=e==="NHWC"?o.shape[3]:o.shape[1];v(t>1,()=>`blockSize should be > 1 for depthToSpace, but was: ${t}`),v(n*t>=0,()=>`Negative dimension size caused by overflow when multiplying
    ${n} and ${t}  for depthToSpace with input shape
    ${o.shape}`),v(s*t>=0,()=>`Negative dimension size caused by overflow when multiplying
    ${s} and ${t} for depthToSpace with input shape
        ${o.shape}`),v(i%(t*t)===0,()=>`Dimension size must be evenly divisible by ${t*t} but is ${i} for depthToSpace with input shape ${o.shape}`);let a={x:o},l={blockSize:t,dataFormat:e};return w.runKernel(Us,a,l)}var Zh=y({depthToSpace_:pE});function mE(r,t,e,o,n="NHWC",s=[1,1],i){let a=h(r,"x","depthwiseConv2d","float32"),l=h(t,"filter","depthwiseConv2d","float32"),c=a,u=!1;a.rank===3&&(u=!0,c=k(a,[1,a.shape[0],a.shape[1],a.shape[2]])),v(c.rank===4,()=>`Error in depthwiseConv2d: input must be rank 4, but got rank ${c.rank}.`),v(l.rank===4,()=>`Error in depthwiseConv2d: filter must be rank 4, but got rank ${l.rank}.`);let p=n==="NHWC"?c.shape[3]:c.shape[1];v(p===l.shape[2],()=>`Error in depthwiseConv2d: number of input channels (${p}) must match the inChannels dimension in filter ${l.shape[2]}.`),Tt("depthwiseConv2d",o,i);let m={x:c,filter:l},f={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:i},d=w.runKernel(Vs,m,f);return u?k(d,[d.shape[1],d.shape[2],d.shape[3]]):d}var Fn=y({depthwiseConv2d_:mE});function fE(r){let e={x:h(r,"x","diag")};return w.runKernel(Ks,e)}var Qh=y({diag_:fE});function dE(r,t,e,o,n=[1,1],s="NHWC"){let i=h(r,"x","dilation2d"),a=h(t,"filter","dilation2d");v(i.rank===3||i.rank===4,()=>`Error in dilation2d: input must be rank 3 or 4, but got rank ${i.rank}.`),v(a.rank===3,()=>`Error in dilation2d: filter must be rank 3, but got rank ${a.rank}.`),v(s==="NHWC",()=>`Error in dilation2d: Only NHWC is currently supported, but got dataFormat of ${s}`);let l=i,c=!1;i.rank===3&&(l=k(i,[1,i.shape[0],i.shape[1],i.shape[2]]),c=!0),v(l.shape[3]===a.shape[2],()=>`Error in dilation2d:  input and filter must have the same depth: ${l.shape[3]} vs ${a.shape[2]}`);let u={x:l,filter:a},p={strides:e,pad:o,dilations:n},m=w.runKernel(Hs,u,p);return c?k(m,[m.shape[1],m.shape[2],m.shape[3]]):m}var Jh=y({dilation2d_:dE});var ur={};Lt(ur,{assertAndGetBroadcastShape:()=>tt,getBroadcastDims:()=>tg,getReductionAxes:()=>Bl});function tg(r,t){let e=r.length,o=[];for(let n=0;n<e;n++){let s=e-1-n,i=r[s]||1;(t[t.length-1-n]||1)>1&&i===1&&o.unshift(s)}return o}function Bl(r,t){let e=[];for(let o=0;o<t.length;o++){let n=r[r.length-o-1],s=t.length-o-1,i=t[s];(n==null||n===1&&i>1)&&e.unshift(s)}return e}function tt(r,t){let e=Math.max(r.length,t.length),o=new Array(e);for(let n=0;n<e;n++){let s=r[r.length-n-1];s==null&&(s=1);let i=t[t.length-n-1];if(i==null&&(i=1),s===1)o[e-n-1]=i;else if(i===1)o[e-n-1]=s;else if(s!==i){let a=`Operands could not be broadcast together with shapes ${r} and ${t}.`;throw Error(a)}else o[e-n-1]=s}return o}function hE(r,t){let e=h(r,"a","equal","string_or_numeric"),o=h(t,"b","equal","string_or_numeric");[e,o]=q(e,o),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(so,n)}var Gl=y({equal_:hE});function gE(r,t,e){let o=h(t,"a","where"),n=h(e,"b","where"),s=h(r,"condition","where","bool"),i=tt(tt(s.shape,o.shape),n.shape),a=Fr(s,i),l=Fr(o,i),c=Fr(n,i),u={condition:a,t:l,e:c};return w.runKernel(Vi,u)}var he=y({where_:gE});function xE(r){let e={x:h(r,"x","zerosLike")};return w.runKernel(pa,e)}var Nt=y({zerosLike_:xE});function bE(r,t){let e=h(r,"a","div"),o=h(t,"b","div");[e,o]=q(e,o);let n=Z(e,o),s=Nt(n),i=Gl(o,s);return he(i,s,n)}var eg=y({divNoNan_:bE});function yE(r,t){let e=h(r,"t1","dot"),o=h(t,"t2","dot");v((e.rank===1||e.rank===2)&&(o.rank===1||o.rank===2),()=>`Error in dot: inputs must all be rank 1 or 2, but got ranks ${e.rank} and ${o.rank}.`);let n=e.rank===1?e.size:e.shape[1],s=o.rank===1?o.size:o.shape[0];if(v(n===s,()=>`Error in dot: inner dimensions of inputs must match, but got ${n} and ${s}.`),e.rank===1&&o.rank===1){let i=k(e,[1,-1]),a=k(o,[-1,1]),l=Q(i,a);return k(l,[])}else if(e.rank===1&&o.rank===2){let i=k(e,[1,-1]),a=k(o,[o.shape[0],o.shape[1]]),l=Q(i,a);return k(l,[l.size])}else if(e.rank===2&&o.rank===1){let i=k(o,[-1,1]),a=Q(e,i);return k(a,[a.size])}else{let i=k(o,[o.shape[0],o.shape[1]]);return Q(e,i)}}var rg=y({dot_:yE});function wE(r,...t){let e=t.map((n,s)=>h(n,`tensors${s}`,"einsum")),o={equation:r};return w.runKernel(Xs,e,o)}var Or=y({einsum_:wE});function CE(r){let e={x:h(r,"x","elu","float32")};return w.runKernel("Elu",e)}var Ul=y({elu_:CE});function vE(r,t){let e=h(r,"x","ensureShape","string_or_numeric");if(!$p(e.shape,t))throw new Error(`EnsureShape: Shape of tensor ${e.shape} is not compatible with expected shape ${t}`);return r}var og=y({ensureShape_:vE});function $E(r){let t=h(r,"x","erf");v(t.dtype==="int32"||t.dtype==="float32",()=>"Input dtype must be `int32` or `float32`."),t.dtype==="int32"&&(t=Y(t,"float32"));let e={x:t};return w.runKernel("Erf",e)}var ng=y({erf_:$E});function vm(r,t){for(let e=0;e<r.length;++e)if(r[r.length-e-1]!==t-1-e)return!1;return!0}function sg(r,t,e){let o=r.length+t.length,n=[],s=0,i=0;for(let a=0;a<o;a++)e.indexOf(a)===-1?n.push(r[s++]):n.push(t[i++]);return n}function SE(r,t){let e=[],o=r.length;for(let s=0;s<o;s++)t.indexOf(s)===-1&&e.push(r[s]);let n=t.map(s=>r[s]);return[e,n]}function pr(r,t){let e=t.map(o=>1);return sg(r,e,t)}function TE(r,t,e){v(vm(t,e),()=>`${r} supports only inner-most axes for now. Got axes ${t} and rank-${e} input.`)}function EE(r,t){if(vm(r,t))return null;let e=[];for(let o=0;o<t;++o)r.indexOf(o)===-1&&e.push(o);return r.forEach(o=>e.push(o)),e}function IE(r){return r.map((t,e)=>[e,t]).sort((t,e)=>t[1]-e[1]).map(t=>t[0])}function NE(r,t){let e=[];for(let o=t-r;o<t;++o)e.push(o);return e}function RE(r,t=null,e=!1){let n={x:h(r,"x","max")},s={reductionIndices:t,keepDims:e};return w.runKernel("Max",n,s)}var Ze=y({max_:RE});function AE(r,t=null,e=!1){let n={x:h(r,"x","min")},s={axis:t,keepDims:e};return w.runKernel("Min",n,s)}var Ea=y({min_:AE});function _E(r,t){let e=h(r,"base","pow"),o=h(t,"exp","pow");[e,o]=q(e,o);let n={a:e,b:o};return w.runKernel("Pow",n)}var mr=y({pow_:_E});function H(r,t){if((Ct(r)&&t!=="string"||Array.isArray(r))&&t!=="complex64")throw new Error("Error creating a new Scalar: value must be a primitive (number|boolean|string)");if(t==="string"&&Ct(r)&&!(r instanceof Uint8Array))throw new Error("When making a scalar from encoded string, the value must be `Uint8Array`.");return Yt(r,[],[],t)}function DE(r){let e={x:h(r,"x","sqrt","float32")};return w.runKernel(wo,e)}var ee=y({sqrt_:DE});function FE(r){let t=h(r,"x","square"),e={};return w.runKernel("Square",{x:t},e)}var Ft=y({square_:FE});function PE(r,t=null,e=!1){let o=h(r,"x","sum");o.dtype==="bool"&&(o=Y(o,"int32"));let n={x:o},s={axis:t,keepDims:e};return w.runKernel("Sum",n,s)}var ot=y({sum_:PE});function OE(r,t="euclidean",e=null,o=!1){r=h(r,"x","norm");let n=ig(r,t,e),s=n.shape;if(o){let i=$r(e,r.shape);s=pr(n.shape,i)}return k(n,s)}function ig(r,t,e=null){if(r.rank===0)return Dt(r);if(r.rank!==1&&e===null)return ig(k(r,[-1]),t,e);if(r.rank===1||typeof e=="number"||Array.isArray(e)&&e.length===1){if(t===1)return ot(Dt(r),e);if(t===1/0)return Ze(Dt(r),e);if(t===-1/0)return Ea(Dt(r),e);if(t==="euclidean"||t===2)return ee(ot(mr(Dt(r),H(2,"int32")),e));throw new Error(`Error in norm: invalid ord value: ${t}`)}if(Array.isArray(e)&&e.length===2){if(t===1)return Ze(ot(Dt(r),e[0]),e[1]-1);if(t===1/0)return Ze(ot(Dt(r),e[1]),e[0]);if(t===-1/0)return Ea(ot(Dt(r),e[1]),e[0]);if(t==="fro"||t==="euclidean")return ee(ot(Ft(r),e));throw new Error(`Error in norm: invalid ord value: ${t}`)}throw new Error(`Error in norm: invalid axis: ${e}`)}var Fo=y({norm_:OE});function ME(r,t=null,e=!1){return Fo(r,"euclidean",t,e)}var ag=y({euclideanNorm_:ME});function LE(r){let e={x:h(r,"x","exp")};return w.runKernel("Exp",e)}var $e=y({exp_:LE});function BE(r,t=0){let e=h(r,"x","expandDims","string_or_numeric");v(t<=e.rank,()=>"Axis must be <= rank of the tensor");let o={input:e},n={dim:t};return w.runKernel(js,o,n)}var De=y({expandDims_:BE});function GE(r){let e={x:h(r,"x","expm1")};return w.runKernel(io,e)}var lg=y({expm1_:GE});function UE(r,t){let e=h(r,"x","tile","string_or_numeric");v(e.rank===t.length,()=>`Error in transpose: rank of input ${e.rank} must match length of reps ${t}.`);let o={x:e},n={reps:t};return w.runKernel($o,o,n)}var Mr=y({tile_:UE});function VE(r,t,e,o="float32"){t==null&&(t=r);let n=j([r,t],o),s=r<=t?r:t;for(let a=0;a<s;++a)n.set(1,a,a);let i=k(n.toTensor(),[r,t]);if(e==null)return i;if(e.length===1)return Mr(De(i,0),[e[0],1,1]);if(e.length===2)return Mr(De(De(i,0),0),[e[0],e[1],1,1]);if(e.length===3)return Mr(De(De(De(i,0),0),0),[e[0],e[1],e[2],1,1]);throw new Error(`eye() currently supports only 1D and 2D batchShapes, but received ${e.length}D.`)}var Vl=y({eye_:VE});function WE(r){let e={x:h(r,"x","floor","float32")};return w.runKernel(ao,e)}var Wl=y({floor_:WE});function zE(r,t,e=0,o=0){let n=h(r,"x","gather"),s=h(t,"indices","gather","int32"),i={x:n,indices:s},a={axis:e,batchDims:o};return w.runKernel(Js,i,a)}var zl=y({gather_:zE});function KE(r,t){let e=h(r,"a","greater","string_or_numeric"),o=h(t,"b","greater","string_or_numeric");[e,o]=q(e,o),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(co,n)}var Po=y({greater_:KE});function HE(r,t){let e=h(r,"a","greaterEqual","string_or_numeric"),o=h(t,"b","greaterEqual","string_or_numeric");[e,o]=q(e,o),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(uo,n)}var Kl=y({greaterEqual_:HE});function qE(r){let e={input:h(r,"input","imag")};return w.runKernel(ri,e)}var Lr=y({imag_:qE});function XE(r){let e={x:h(r,"x","isFinite")};return w.runKernel(oi,e)}var cg=y({isFinite_:XE});function jE(r){let e={x:h(r,"x","isInf")};return w.runKernel(ni,e)}var ug=y({isInf_:jE});function YE(r){let e={x:h(r,"x","isNaN")};return w.runKernel(si,e)}var pg=y({isNaN_:YE});function ZE(r,t=.2){let o={x:h(r,"x","leakyRelu")},n={alpha:t};return w.runKernel(ii,o,n)}var Hl=y({leakyRelu_:ZE});function QE(r,t){let e=h(r,"a","less","string_or_numeric"),o=h(t,"b","less","string_or_numeric");[e,o]=q(e,o),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(po,n)}var Ia=y({less_:QE});function JE(r,t){let e=h(r,"a","lessEqual","string_or_numeric"),o=h(t,"b","lessEqual","string_or_numeric");[e,o]=q(e,o),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(mo,n)}var Pn=y({lessEqual_:JE});function mg(r,t,e){if(e<=0)throw new Error("The number of values should be positive.");let o={start:r,stop:t,num:e};return w.runKernel(ai,{},o)}function tI(r,t=5,e=1,o=1,n=.5){let s=h(r,"x","localResponseNormalization");v(s.rank===4||s.rank===3,()=>`Error in localResponseNormalization: x must be rank 3 or 4 but got
               rank ${s.rank}.`),v(sr(t),()=>`Error in localResponseNormalization: depthRadius must be an integer but got depthRadius ${t}.`);let i=s,a=!1;s.rank===3&&(a=!0,i=k(s,[1,s.shape[0],s.shape[1],s.shape[2]]));let l={x:i},c={depthRadius:t,bias:e,alpha:o,beta:n},u=w.runKernel("LRN",l,c);return a?k(u,[u.shape[1],u.shape[2],u.shape[3]]):u}var fg=y({localResponseNormalization_:tI});function eI(r){let e={x:h(r,"x","log","float32")};return w.runKernel("Log",e)}var fr=y({log_:eI});function rI(r){let e={x:h(r,"x","log1p")};return w.runKernel(li,e)}var ql=y({log1p_:rI});function dg(r){return v(Le(r),()=>"The f passed in grad(f) must be a function"),(t,e)=>{let o=h(t,"x","tf.grad","string_or_numeric"),n=e!=null?h(e,"dy","tf.grad"):null;return w.tidy(()=>{let{value:s,grads:i}=w.gradients(()=>r(o),[o],n);return n!=null&&ut(s.shape,n.shape,"The shape of dy passed in grad(f)(x, dy) must match the shape returned by f(x)"),jl(i),i[0]})}}function hg(r){return v(Le(r),()=>"The f passed in grads(f) must be a function"),(t,e)=>{v(Array.isArray(t),()=>"The args passed in grads(f)(args) must be an array of `Tensor`s or `TensorLike`s");let o=ar(t,"args","tf.grads","string_or_numeric"),n=e!=null?h(e,"dy","tf.grads"):null;return w.tidy(()=>{let{value:s,grads:i}=w.gradients(()=>r(...o),o,n);return n!=null&&ut(s.shape,n.shape,"The shape of dy passed in grads(f)([x1,...], dy) must match the shape returned by f([x1,...])"),jl(i),i})}}function gg(r){return v(Le(r),()=>"The f passed in valueAndGrad(f) must be a function"),(t,e)=>{v(t instanceof lt,()=>"The x passed in valueAndGrad(f)(x) must be a tensor"),v(e==null||e instanceof lt,()=>"The dy passed in valueAndGrad(f)(x, dy) must be a tensor");let{grads:o,value:n}=w.gradients(()=>r(t),[t],e);return jl(o),{grad:o[0],value:n}}}function xg(r){return v(Le(r),()=>"The f passed in valueAndGrads(f) must be a function"),(t,e)=>{v(Array.isArray(t)&&t.every(n=>n instanceof lt),()=>"The args passed in valueAndGrads(f)(args) must be array of tensors"),v(e==null||e instanceof lt,()=>"The dy passed in valueAndGrads(f)(args, dy) must be a tensor");let o=w.gradients(()=>r(...t),t,e);return e!=null&&ut(o.value.shape,e.shape,"The shape of dy passed in valueAndGrads(f)([x1,...], dy) must match the shape returned by f([x1,...])"),jl(o.grads),o}}function Xl(r,t){v(Le(r),()=>"The f passed in variableGrads(f) must be a function"),v(t==null||Array.isArray(t)&&t.every(c=>c instanceof Ue),()=>"The varList passed in variableGrads(f, varList) must be an array of variables");let e=t!=null;if(!e){t=[];for(let c in w.registeredVariables)t.push(w.registeredVariables[c])}let o=e?t.filter(c=>!c.trainable):null,n=t.length;t=t.filter(c=>c.trainable),v(t.length>0,()=>`variableGrads() expects at least one of the input variables to be trainable, but none of the ${n} variables is trainable.`);let s=!0,{value:i,grads:a}=w.gradients(r,t,null,s);v(a.some(c=>c!=null),()=>"Cannot find a connection between any variable and the result of the loss function y=f(x). Please make sure the operations that use variables are inside the function f passed to minimize()."),v(i.rank===0,()=>`The f passed in variableGrads(f) must return a scalar, but it returned a rank-${i.rank} tensor`);let l={};return t.forEach((c,u)=>{a[u]!=null&&(l[c.name]=a[u])}),o?.forEach(c=>l[c.name]=null),{value:i,grads:l}}function Ht(r){return w.customGrad(r)}function jl(r){if(r.filter(e=>e==null).length>0)throw new Error(`Cannot compute gradient of y=f(x) with respect to x. Make sure that
    the f you passed encloses all operations that lead from x to y.`)}function oI(r){let e={x:h(r,"x","neg")};return w.runKernel("Neg",e)}var Vt=y({neg_:oI});function nI(r){let e={x:h(r,"x","softplus")};return w.runKernel(Hi,e)}var Yl=y({softplus_:nI});function sI(r){let t=h(r,"x","logSigmoid");return Ht(o=>({value:Vt(Yl(Vt(o))),gradFunc:i=>F(i,je(Vt(o)))}))(t)}var bg=y({logSigmoid_:sI});function iI(r,t){let e=h(r,"a","sub"),o=h(t,"b","sub");[e,o]=q(e,o);let n={a:e,b:o};return w.runKernel("Sub",n)}var z=y({sub_:iI});function aI(r,t=-1){let e=h(r,"logits","logSoftmax");if(t===-1&&(t=e.rank-1),t!==e.rank-1)throw Error(`Log Softmax along a non-last dimension is not yet supported. Logits was rank ${e.rank} and axis was ${t}`);return Ht((n,s)=>{let a=Ze(n,t,!0),l=z(n,a),c=z(Y(l,"float32"),fr(ot($e(l),t,!0)));return s([c]),{value:c,gradFunc:(p,m)=>{let[f]=m,d=!0,x=$e(f);return z(p,F(ot(p,t,d),x))}}})(e)}var yg=y({logSoftmax_:aI});function lI(r,t=null,e=!1){let o=h(r,"x","logSumExp"),n=$r(t,o.shape),s=Ze(o,n,!0),i=z(o,s),a=$e(i),l=ot(a,n),c=fr(l),u=U(k(s,c.shape),c);if(e){let p=pr(u.shape,n);return k(u,p)}return u}var Zl=y({logSumExp_:lI});function cI(r,t){let e=h(r,"a","logicalAnd","bool"),o=h(t,"b","logicalAnd","bool");tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(ci,n)}var Oo=y({logicalAnd_:cI});function uI(r){let e={x:h(r,"x","logicalNot","bool")};return w.runKernel(ui,e)}var Ql=y({logicalNot_:uI});function pI(r,t){let e=h(r,"a","logicalOr","bool"),o=h(t,"b","logicalOr","bool");tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(pi,n)}var Jl=y({logicalOr_:pI});function mI(r,t){let e=h(r,"a","logicalXor","bool"),o=h(t,"b","logicalXor","bool");return tt(e.shape,o.shape),Oo(Jl(r,t),Ql(Oo(r,t)))}var wg=y({logicalXor_:mI});var tc=2147483648;function fI(r,t,e="left"){let o=h(r,"sortedSequence","searchSorted"),n=h(t,"values","searchSorted"),s=o.shape[o.shape.length-1],i=n.shape[n.shape.length-1],a=k(o,[-1,s]),l=k(n,[-1,i]);if(a.rank<2)throw new Error("Sorted input argument must be at least 2-dimensional");if(a.shape[0]!==l.shape[0])throw new Error("Leading dimension of 'sortedSequence' and 'values' must match.");if(X(l.shape)>=tc)throw new Error(`values tensor size must less than ${tc}`);if(a.shape[1]>=tc)throw new Error(`trailing dim_size must less than ${tc} for int32 output type, was ${a.shape[1]}`);let c={sortedSequence:a,values:l},u={side:e};return w.runKernel(Ui,c,u)}var Na=y({searchSorted_:fI});function Cg(r,t){return Na(r,t,"left")}function dI(r,t,e,o,n){let s=h(r,"x","maxPool"),i=1,a=s,l=!1;s.rank===3&&(l=!0,a=k(s,[1,s.shape[0],s.shape[1],s.shape[2]])),v(a.rank===4,()=>`Error in maxPool: input must be rank 4 but got rank ${a.rank}.`),v(Kt(e,i),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${e} and dilations '${i}'`),Tt("maxPool",o,n);let c={x:a},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n},p=w.runKernel(mi,c,u);return l?k(p,[p.shape[1],p.shape[2],p.shape[3]]):p}var ec=y({maxPool_:dI});function hI(r,t=[1,1,1],e,o,n,s="NDHWC"){let i=h(r,"x","maxPool3d"),a=i,l=!1;i.rank===4&&(l=!0,a=k(i,[1,i.shape[0],i.shape[1],i.shape[2],i.shape[3]])),v(a.rank===5,()=>`Error in maxPool3d: x must be rank 5 but got rank ${a.rank}.`),v(s==="NDHWC",()=>`Error in maxPool3d: Only NDHWC is currently supported, but got dataFormat of ${s}`),Tt("maxPool3d",o,n);let c={x:a},u={filterSize:t,strides:e,pad:o,dimRoundingMode:n,dataFormat:s},p=w.runKernel(fi,c,u);return l?k(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}var vg=y({maxPool3d_:hI});function gI(r,t,e,o,n=!1){let i={x:h(r,"x","maxPoolWithArgmax")},a={filterSize:t,strides:e,pad:o,includeBatchInIndex:n},l=w.runKernel(di,i,a);return{result:l[0],indexes:l[1]}}var $g=y({maxPoolWithArgmax_:gI});function xI(r,t){let e=h(r,"a","maximum"),o=h(t,"b","maximum");[e,o]=q(e,o),e.dtype==="bool"&&(e=Y(e,"int32"),o=Y(o,"int32")),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(fo,n)}var rc=y({maximum_:xI});function bI(r,t=null,e=!1){let n={x:h(r,"x","mean")},s={axis:t,keepDims:e};return w.runKernel(hi,n,s)}var Mo=y({mean_:bI});function Se(r,t="float32"){if(ft(r),t==="complex64"){let o=Se(r,"float32"),n=Se(r,"float32");return te(o,n)}let e=un(X(r),t);return w.makeTensor(e,r,t)}function Qe(r,t="float32"){if(ft(r),t==="complex64"){let o=Qe(r,"float32"),n=Se(r,"float32");return te(o,n)}let e=us(X(r),t);return w.makeTensor(e,r,t)}function Sg(r,t,{indexing:e="xy"}={}){if(e!=="xy"&&e!=="ij")throw new TypeError(`${e} is not a valid third argument to meshgrid`);if(r===void 0)return[];let o=h(r,"x","meshgrid",r instanceof lt?r.dtype:"float32");if(t===void 0)return[o];let n=h(t,"y","meshgrid",t instanceof lt?t.dtype:"float32"),s=X(o.shape),i=X(n.shape);return e==="xy"?(o=k(o,[1,-1]),n=k(n,[-1,1]),[Q(Qe([i,1],o.dtype),o),Q(n,Qe([1,s],n.dtype))]):(o=k(o,[-1,1]),n=k(n,[1,-1]),[Q(o,Qe([1,i],o.dtype)),Q(Qe([s,1],n.dtype),n)])}function yI(r,t){let e=h(r,"a","minimum"),o=h(t,"b","minimum");[e,o]=q(e,o),e.dtype==="bool"&&(e=Y(e,"int32"),o=Y(o,"int32")),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(ho,n)}var Lo=y({minimum_:yI});function wI(r,t,e){v(e==="reflect"||e==="symmetric",()=>`Invalid mode. Mode must be either reflect or symmetric. Got ${e}.`);let o=h(r,"x","mirrorPad");if(o.rank===0)throw new Error("mirrorPad(scalar) is not defined. Pass non-scalar to mirrorPad");v(t.length===o.rank,()=>`Padding doesn't match input. Must be ${o.rank}. Got ${t.length}.`);let n=e==="reflect"?1:0;for(let a=0;a<o.rank;a++)v(t[a].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),v(t[a][0]>=0&&t[a][0]<=o.shape[a]-n&&t[a][1]>=0&&t[a][1]<=o.shape[a]-n,()=>`Padding in dimension ${a} cannot be greater than or equal to ${o.shape[a]-n} or less than 0 for input of shape ${o.shape}`);let s={paddings:t,mode:e},i={x:o};return w.runKernel(gi,i,s)}var Tg=y({mirrorPad_:wI});function CI(r,t){let e=h(r,"a","mod"),o=h(t,"b","mod");[e,o]=q(e,o);let n={a:e,b:o};return w.runKernel("Mod",n)}var Eg=y({mod_:CI});function vI(r,t=null,e=!1){r=h(r,"x","moments");let o=$r(t,r.shape),n=Mo(r,o,e),s=n.shape;e||(s=pr(n.shape,o));let i=Ft(z(Y(r,"float32"),k(n,s))),a=Mo(i,o,e);return{mean:n,variance:a}}var Ig=y({moments_:vI});function $I(r,t,e,o){let n=h(t,"data","multiRNNCell"),s=ar(e,"c","multiRNNCell"),i=ar(o,"h","multiRNNCell"),a=n,l=[];for(let p=0;p<r.length;p++){let m=r[p](a,s[p],i[p]);l.push(m[0]),l.push(m[1]),a=m[1]}let c=[],u=[];for(let p=0;p<l.length;p+=2)c.push(l[p]),u.push(l[p+1]);return[c,u]}var Ng=y({multiRNNCell_:$I});function SI(r,t,e,o=!1){let n=h(r,"logits","multinomial"),s=n.size,i=n.rank;if(s<2)throw new Error(`Error in multinomial: you need at least 2 outcomes, but got ${s}.`);if(i>2)throw new Error(`Rank of probabilities must be 1 or 2, but is ${i}`);e=e||Math.random();let l={logits:i===1?k(n,[1,-1]):n},c={numSamples:t,seed:e,normalized:o},u=w.runKernel(xi,l,c);return i===1?k(u,[u.size]):u}var kg=y({multinomial_:SI});function TI(r,t){let e=h(r,"a","notEqual","string_or_numeric"),o=h(t,"b","notEqual","string_or_numeric");[e,o]=q(e,o),tt(e.shape,o.shape);let n={a:e,b:o};return w.runKernel(xo,n)}var oc=y({notEqual_:TI});function EI(r,t,e=1,o=0,n="int32"){if(t<2)throw new Error(`Error in oneHot: depth must be >=2, but it is ${t}`);let i={indices:h(r,"indices","oneHot","int32")},a={dtype:n,depth:t,onValue:e,offValue:o};return w.runKernel($i,i,a)}var ka=y({oneHot_:EI});function II(r){let e={x:h(r,"x","onesLike")};return w.runKernel(vi,e)}var Rg=y({onesLike_:II});function NI(r,t){let e=h(r,"v1","outerProduct"),o=h(t,"v2","outerProduct");v(e.rank===1&&o.rank===1,()=>`Error in outerProduct: inputs must be rank 1, but got ranks ${e.rank} and ${o.rank}.`);let n=k(e,[-1,1]),s=k(o,[1,-1]);return Q(n,s)}var Ag=y({outerProduct_:NI});function kI(r,t,e=0){let o=h(r,"x","pad");if(o.rank===0)throw new Error("pad(scalar) is not defined. Pass non-scalar to pad");let n={paddings:t,constantValue:e},s={x:o};return w.runKernel(Ti,s,n)}var Je=y({pad_:kI});function RI(r,t,e=0){return v(t.length===2,()=>"Invalid number of paddings. Must be length of 2."),Je(r,[t],e)}var _g=y({pad1d_:RI});function AI(r,t,e=0){return v(t.length===2&&t[0].length===2&&t[1].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),Je(r,t,e)}var Dg=y({pad2d_:AI});function _I(r,t,e=0){return v(t.length===3&&t[0].length===2&&t[1].length===2&&t[2].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),Je(r,t,e)}var Fg=y({pad3d_:_I});function DI(r,t,e=0){return v(t.length===4&&t[0].length===2&&t[1].length===2&&t[2].length===2&&t[3].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),Je(r,t,e)}var Pg=y({pad4d_:DI});function FI(r,t,e){let o=h(r,"x","spaceToBatchND");v(o.rank>=1+t.length,()=>`input rank ${o.rank} should be > than [blockShape] ${t.length}`),v(e.length===t.length,()=>`paddings.shape[0] ${e.length} must be equal to [blockShape] ${t.length}`),v(o.shape.reduce((i,a,l)=>l>0&&l<=t.length?i&&(a+e[l-1][0]+e[l-1][1])%t[l-1]===0:i,!0),()=>`input spatial dimensions ${o.shape.slice(1)} with paddings ${e.toString()} must be divisible by blockShapes ${t.toString()}`);let n={x:o},s={blockShape:t,paddings:e};return w.runKernel(qi,n,s)}var nc=y({spaceToBatchND_:FI});function PI(r,t,e,o,n,s,i){n==null&&(n=[1,1]),s==null&&(s=1),o===0&&(o="valid");let a=h(r,"x","maxPool"),l=a,c=!1;a.rank===3&&(c=!0,l=k(a,[1,a.shape[0],a.shape[1],a.shape[2]])),v(Kt(s,n),()=>`Error in pool: Either strides or dilations must be 1. Got strides ${s} and dilations '${n}'`);let u=wm(l.shape,t,s,n,o),p=[u.dilationHeight,u.dilationWidth],m;o==="same"?m=MI([u.filterHeight,u.filterWidth],p):m=[[0,0],[0,0]];let f=p[0]===1&&p[1]===1,[d,x]=OI([u.inHeight,u.inWidth],p,m),g=f?o:"valid",b=f?l:nc(l,p,d),S=(e==="avg"?()=>Pl(b,t,s,g,i):()=>ec(b,t,s,g,i))(),E=f?S:Ol(S,p,x);return c?k(E,[E.shape[1],E.shape[2],E.shape[3]]):E}function OI(r,t,e){let o=e.map(u=>u[0]),n=e.map(u=>u[1]),s=r.concat(o,n),i=t.map((u,p)=>(u-s[p]%u)%u),a=n.map((u,p)=>u+i[p]),l=t.map((u,p)=>[o[p],a[p]]),c=t.map((u,p)=>[0,i[p]]);return[l,c]}function MI(r,t){let o=r.map((i,a)=>i+(i-1)*(t[a]-1)).map(i=>i-1),n=o.map(i=>Math.floor(i/2)),s=o.map((i,a)=>i-n[a]);return o.map((i,a)=>[n[a],s[a]])}var Og=y({pool_:PI});function LI(r,t){let e=h(r,"x","prelu"),o=h(t,"alpha","prelu"),n={x:e,alpha:o};return w.runKernel(Ei,n)}var sc=y({prelu_:LI});function BI(r,t=null,e=!1){let o=h(r,"x","prod");o.dtype==="bool"&&(o=Y(o,"int32"));let n={x:o},s={axis:t,keepDims:e};return w.runKernel(gn,n,s)}var Mg=y({prod_:BI});function GI(r,t,e,o){let n=r.map((u,p)=>h(u,`tensors${p}`,"raggedGather","int32")),s=h(t,"paramsDenseValues","raggedGather"),i=h(e,"indices","raggedGather","int32"),a={paramsNestedSplits:n,paramsDenseValues:s,indices:i},l={outputRaggedRank:o},c=w.runKernel(Ii,a,l);return{outputNestedSplits:c.slice(0,c.length-1),outputDenseValues:c[c.length-1]}}var Lg=y({raggedGather_:GI});function UI(r,t,e){let o=h(r,"starts","raggedRange"),n=h(t,"limits","raggedRange",o.dtype),s=h(e,"deltas","raggedRange",o.dtype),i={starts:o,limits:n,deltas:s},a=w.runKernel(Ni,i);return{rtNestedSplits:a[0],rtDenseValues:a[1]}}var Bg=y({raggedRange_:UI});function VI(r,t,e,o,n){let s=h(r,"shape","raggedTensorToTensor","int32"),i=h(t,"values","raggedTensorToTensor"),a=h(e,"defaultValue","raggedTensorToTensor",i.dtype),l=o.map((p,m)=>h(p,`tensors${m}`,"raggedTensorToTensor","int32")),c={shape:s,values:i,defaultValue:a,rowPartitionTensors:l},u={rowPartitionTypes:n};return w.runKernel(ki,c,u)}var Gg=y({raggedTensorToTensor_:VI});function WI(r,t,e){ft(r);let o=X(r),n=null;if(e==null||e==="float32")n=new Float32Array(o);else if(e==="int32")n=new Int32Array(o);else if(e==="bool")n=new Uint8Array(o);else throw new Error(`Unknown data type ${e}`);for(let s=0;s<o;s++)n[s]=t();return w.makeTensor(n,r,e)}var Ug=y({rand_:WI});var cc=ld(nx());var _m={};Lt(_m,{TEST_EPSILON_FLOAT16:()=>sx,createVideoElement:()=>o2,encodeStrings:()=>ix,expectArrayBuffersEqual:()=>r2,expectArraysClose:()=>ZI,expectArraysEqual:()=>JI,expectNumbersClose:()=>t2,expectPromiseToFail:()=>QI,expectValuesInRange:()=>e2,play:()=>n2,testEpsilon:()=>Rm});var YI=.001,sx=.1;function ZI(r,t,e){return e==null&&(e=Rm()),km(r,t,(o,n)=>Am(o,n,e))}function Rm(){return w.backend.floatPrecision()===32?YI:sx}function km(r,t,e){let o=!0;if((Ct(r)||Ct(t))&&(o=!1),Ct(r)&&Ct(t)&&(o=!0),o){let i=r.constructor.name,a=t.constructor.name;if(i!==a)throw new Error(`Arrays are of different type. Actual: ${i}. Expected: ${a}`)}if(Array.isArray(r)&&Array.isArray(t)){let i=Gt(r),a=Gt(t);if(!Xt(i,a))throw new Error(`Arrays have different shapes. Actual: [${i}]. Expected: [${a}]`)}let n=Ct(r)?r:Re(r),s=Ct(t)?t:Re(t);if(n.length!==s.length)throw new Error(`Arrays have different lengths actual: ${n.length} vs expected: ${s.length}.
Actual:   ${n}.
Expected: ${s}.`);for(let i=0;i<s.length;++i){let a=n[i],l=s[i];if(!e(a,l))throw new Error(`Arrays differ: actual[${i}] = ${a}, expected[${i}] = ${l}.
Actual:   ${n}.
Expected: ${s}.`)}typeof expect<"u"&&expect().nothing()}function QI(r,t){r().then(()=>t.fail(),()=>t()),typeof expect<"u"&&expect().nothing()}function JI(r,t){let e=typeof t=="string"||typeof t=="number"||typeof t=="boolean"?[t]:t;return Ne(r)||Ne(r[0])||Ne(t)||Ne(t[0])?km(r,e,(o,n)=>o==n):km(r,t,(o,n)=>Am(o,n,0))}function t2(r,t,e){if(e==null&&(e=Rm()),!Am(r,t,e))throw new Error(`Numbers differ: actual === ${r}, expected === ${t}`);typeof expect<"u"&&expect().nothing()}function Am(r,t,e){return!isFinite(r)&&!isFinite(t)?!0:!(isNaN(r)||isNaN(t)||Math.abs(r-t)>e)}function e2(r,t,e){for(let o=0;o<r.length;o++)if(r[o]<t||r[o]>e)throw new Error(`Value out of range:${r[o]} low: ${t}, high: ${e}`)}function r2(r,t){let e=new Float32Array(r),o=new Float32Array(t);if(e.length!==o.length)throw new Error(`Expected ArrayBuffer to be of length ${o.length}, but it was ${e.length}`);for(let n=0;n<o.length;n++)if(e[n]!==o[n])throw new Error(`Expected ArrayBuffer value at ${n} to be ${o[n]} but got ${e[n]} instead`)}function ix(r){for(let t=0;t<r.length;t++){let e=r[t];Array.isArray(e)?ix(e):r[t]=kr(e)}return r}function o2(r){let t=document.createElement("video");return"playsInline"in t&&(t.playsInline=!0),t.muted=!0,t.loop=!0,t.style.position="fixed",t.style.left="0px",t.style.top="0px",t.preload="auto",t.appendChild(r),new Promise(e=>{t.addEventListener("loadeddata",o=>e(t)),t.load()})}async function n2(r){await r.play(),"requestVideoFrameCallback"in r&&await new Promise(t=>{r.requestVideoFrameCallback(t)})}var Go=class{constructor(t,e,o,n,s){this.mean=t,this.stdDev=e,this.dtype=o,this.nextVal=NaN,this.truncated=n,this.truncated&&(this.upper=this.mean+this.stdDev*2,this.lower=this.mean-this.stdDev*2);let i=s||Math.random();this.random=cc.alea(i.toString())}nextValue(){if(!isNaN(this.nextVal)){let n=this.nextVal;return this.nextVal=NaN,n}let t,e,o=!1;for(;!o;){let n,s,i;do n=2*this.random()-1,s=2*this.random()-1,i=n*n+s*s;while(i>=1||i===0);let a=Math.sqrt(-2*Math.log(i)/i);t=this.mean+this.stdDev*n*a,e=this.mean+this.stdDev*s*a,(!this.truncated||this.isValidTruncated(t))&&(o=!0)}return(!this.truncated||this.isValidTruncated(e))&&(this.nextVal=this.convertValue(e)),this.convertValue(t)}convertValue(t){return this.dtype==null||this.dtype==="float32"?t:Math.round(t)}isValidTruncated(t){return t<=this.upper&&t>=this.lower}},ac=class{constructor(t,e,o,n){this.alpha=t,this.beta=1/e,this.dtype=o;let s=n||Math.random();this.randu=cc.alea(s.toString()),this.randn=new Go(0,1,o,!1,this.randu()),t<1?this.d=t+2/3:this.d=t-1/3,this.c=1/Math.sqrt(9*this.d)}nextValue(){let t,e,o,n,s,i;for(;;){do n=this.randn.nextValue(),i=1+this.c*n;while(i<=0);if(i*=i*i,t=n*n,e=1-.331*t*t,o=.5*t+this.d*(1-i+Math.log(i)),s=this.randu(),s<e||Math.log(s)<o)break}return i=1/this.beta*this.d*i,this.alpha<1&&(i*=Math.pow(this.randu(),1/this.alpha)),this.convertValue(i)}convertValue(t){return this.dtype==="float32"?t:Math.round(t)}},lc=class{constructor(t=0,e=1,o,n){if(this.canReturnFloat=()=>this.dtype==null||this.dtype==="float32",this.min=t,this.range=e-t,this.dtype=o,n==null&&(n=Math.random()),typeof n=="number"&&(n=n.toString()),!this.canReturnFloat()&&this.range<=1)throw new Error(`The difference between ${t} - ${e} <= 1 and dtype is not float`);this.random=cc.alea(n)}convertValue(t){return this.canReturnFloat()?t:Math.round(t)}nextValue(){return this.convertValue(this.min+this.range*this.random())}};function s2(r,t,e=1,o="float32",n){if(ft(r),e==null&&(e=1),o==null&&(o="float32"),o!=="float32"&&o!=="int32")throw new Error(`Unsupported data type ${o}`);let s=new ac(t,e,o,n),i=j(r,o);for(let a=0;a<i.values.length;a++)i.values[a]=s.nextValue();return i.toTensor()}var ax=y({randomGamma_:s2});function i2(r,t=0,e=1,o,n){if(ft(r),o!=null&&o==="bool")throw new Error(`Unsupported data type ${o}`);let s=new Go(t,e,o,!1,n),i=j(r,o);for(let a=0;a<i.values.length;a++)i.values[a]=s.nextValue();return i.toTensor()}var uc=y({randomNormal_:i2});function a2(r,t,e){if(t!=null&&t==="bool")throw new Error(`Unsupported data type ${t}`);return uc(r,0,1,t,e)}var lx=y({randomStandardNormal_:a2});function l2(r,t=0,e=1,o="float32",n){ft(r);let s=j(r,o),i=new lc(t,e,null,n);for(let a=0;a<s.values.length;a++)s.values[a]=i.nextValue();return s.toTensor()}var On=y({randomUniform_:l2});function c2(r,t,e,o){return On(r,t,e,"int32",o)}var cx=y({randomUniformInt_:c2});function Br(r,t,e=1,o="float32"){if(e===0)throw new Error("Cannot have a step of zero");let n={start:r,stop:t,step:e,dtype:o};return w.runKernel(Ri,{},n)}function u2(r){let e={input:h(r,"input","real")};return w.runKernel(xn,e)}var dr=y({real_:u2});function p2(r){let e={x:h(r,"x","reciprocal")};return w.runKernel(Ai,e)}var ux=y({reciprocal_:p2});function m2(r){let e={x:h(r,"x","relu")};return w.runKernel(_i,e)}var Gr=y({relu_:m2});function f2(r){let e={x:h(r,"x","relu6")};return w.runKernel(Oi,e)}var pc=y({relu6_:f2});function d2(r,t){let o={x:h(r,"x","reverse")},n={dims:t};return w.runKernel(Mi,o,n)}var ge=y({reverse_:d2});function h2(r){let t=h(r,"x","reverse");return v(t.rank===1,()=>`Error in reverse1D: x must be rank 1 but got rank ${t.rank}.`),ge(t,0)}var px=y({reverse1d_:h2});function g2(r,t){let e=h(r,"x","reverse");return v(e.rank===2,()=>`Error in reverse2D: x must be rank 2 but got rank ${e.rank}.`),ge(e,t)}var mx=y({reverse2d_:g2});function x2(r,t){let e=h(r,"x","reverse");return v(e.rank===3,()=>`Error in reverse3D: x must be rank 3 but got rank ${e.rank}.`),ge(e,t)}var fx=y({reverse3d_:x2});function b2(r,t){let e=h(r,"x","reverse");return v(e.rank===4,()=>`Error in reverse4D: x must be rank 4 but got rank ${e.rank}.`),ge(e,t)}var dx=y({reverse4d_:b2});function y2(r){let e={x:h(r,"x","round")};return w.runKernel(Li,e)}var mc=y({round_:y2});function w2(r){let e={x:h(r,"x","rsqrt","float32")};return w.runKernel(bo,e)}var hx=y({rsqrt_:w2});function C2(r){let e={x:h(r,"x","selu")};return w.runKernel(Wi,e)}var gx=y({selu_:C2});function v2(r,t,e,o,n,s=[1,1],i="NHWC"){let a=h(r,"x","separableConv2d"),l=h(t,"depthwiseFilter","separableConv2d"),c=h(e,"pointwiseFilter","separableConv2d"),u=a,p=!1;if(a.rank===3&&(p=!0,u=k(a,[1,a.shape[0],a.shape[1],a.shape[2]])),i==="NCHW")throw new Error("separableConv2d currently does not support dataFormat NCHW; only NHWC is supported");v(u.rank===4,()=>`Error in separableConv2d: input must be rank 4, but got rank ${u.rank}.`),v(l.rank===4,()=>`Error in separableConv2d: depthwise filter must be rank 4, but got rank ${l.rank}.`),v(c.rank===4,()=>`Error in separableConv2d: pointwise filter must be rank 4, but got rank ${l.rank}.`),v(c.shape[0]===1,()=>`Error in separableConv2d: the first dimension of pointwise filter  must be 1, but got ${c.shape[0]}.`),v(c.shape[1]===1,()=>`Error in separableConv2d: the second dimension of pointwise filter must be 1, but got ${c.shape[1]}.`);let m=l.shape[2],f=l.shape[3];v(c.shape[2]===m*f,()=>`Error in separableConv2d: the third dimension of pointwise filter must be ${m*f}, but got ${c.shape[2]}.`);let d=Fn(u,l,o,n,i,s),g=Pr(d,c,1,"valid",i);return p?k(g,[g.shape[1],g.shape[2],g.shape[3]]):g}var xx=y({separableConv2d_:v2});async function $2(r,t){let e=h(r,"x","setdiff1d"),o=h(t,"y","setdiff1d");v(e.dtype===o.dtype,()=>`x and y should have the same dtype, but got x (${e.dtype}) and y (${o.dtype}).`),v(e.rank===1,()=>`x should be 1D tensor, but got x (${e.shape}).`),v(o.rank===1,()=>`y should be 1D tensor, but got y (${o.shape}).`);let n=await e.data(),s=await o.data(),i=new Set(s),a=0;for(let u=0;u<n.length;u++)i.has(n[u])||a++;let l=new ce([a],e.dtype),c=new ce([a],"int32");for(let u=0,p=0;u<n.length;u++)i.has(n[u])||(l.values[p]=n[u],c.values[p]=u,p++);return[l.toTensor(),c.toTensor()]}var bx=$2;function S2(r){let e={x:h(r,"x","sign")};return w.runKernel(Ki,e)}var yx=y({sign_:S2});function T2(r){let e={x:h(r,"x","sin","float32")};return w.runKernel("Sin",e)}var wx=y({sin_:T2});function E2(r){let e={x:h(r,"x","sinh")};return w.runKernel(zi,e)}var Cx=y({sinh_:E2});function I2(r,t,e){let o=h(r,"x","slice1d");return v(o.rank===1,()=>`slice1d expects a rank-1 tensor, but got a rank-${o.rank} tensor`),rt(o,[t],[e])}var vx=y({slice1d_:I2});function N2(r,t,e){let o=h(r,"x","slice2d");return v(o.rank===2,()=>`slice2d expects a rank-2 tensor, but got a rank-${o.rank} tensor`),rt(o,t,e)}var $x=y({slice2d_:N2});function k2(r,t,e){let o=h(r,"x","slice3d");return v(o.rank===3,()=>`slice3d expects a rank-3 tensor, but got a rank-${o.rank} tensor`),rt(o,t,e)}var Sx=y({slice3d_:k2});function R2(r,t,e){let o=h(r,"x","slice4d");return v(o.rank===4,()=>`slice4d expects a rank-4 tensor, but got a rank-${o.rank} tensor`),rt(o,t,e)}var Tx=y({slice4d_:R2});function A2(r,t=-1){let e=h(r,"logits","softmax","float32");if(t===-1&&(t=e.rank-1),t!==e.rank-1)throw Error(`Softmax along a non-last dimension is not yet supported. Logits was rank ${e.rank} and dim was ${t}`);let o={logits:e},n={dim:t};return w.runKernel(ji,o,n)}var Ex=y({softmax_:A2});function _2(r){v(r.dtype==="complex64",()=>`The dtype for tf.spectral.fft() must be complex64 but got ${r.dtype}.`);let t={input:r};return w.runKernel("FFT",t)}var Mn=y({fft_:_2});function D2(r){v(r.dtype==="complex64",()=>`The dtype for tf.spectral.ifft() must be complex64 but got ${r.dtype}.`);let t={input:r};return w.runKernel(ei,t)}var Uo=y({ifft_:D2});function F2(r){let t=r.shape[r.shape.length-1],e=r.size/t,o;if(t<=2){let n=k(r,[e,t]);o=Uo(n)}else{let n=[e,2*(t-1)],s=k(dr(r),[e,t]),i=k(Lr(r),[e,t]),a=ge(rt(s,[0,1],[e,t-2]),1),l=F(ge(rt(i,[0,1],[e,t-2]),1),H(-1)),c=vt([s,a],1),u=vt([i,l],1),p=k(te(c,u),[n[0],n[1]]);o=Uo(p)}if(o=dr(o),r.rank===3&&r.shape[0]!==0){let n=o,s=r.shape[0];o=k(o,[s,o.shape[0]/s,o.shape[1]]),n.dispose()}return o}var fc=y({irfft_:F2});function P2(r,t,e=0){let n={x:h(r,"x","split")},s={numOrSizeSplits:t,axis:e};return w.runKernel(Xi,n,s)}var hr=y({split_:P2});function O2(r,t){v(r.dtype==="float32",()=>`The dtype for rfft() must be real value but got ${r.dtype}`);let e=r.shape[r.shape.length-1],o=r.size/e,n;if(t!=null&&t<e){let d=r.shape.map(g=>0),x=r.shape.map(g=>g);x[r.shape.length-1]=t,n=rt(r,d,x),e=t}else if(t!=null&&t>e){let d=r.shape.map(x=>x);d[r.shape.length-1]=t-e,n=vt([r,Se(d)],r.shape.length-1),e=t}else n=r;let s=Nt(n),i=k(te(n,s),[o,e]),a=Mn(i),l=Math.floor(e/2)+1,c=dr(a),u=Lr(a),p=hr(c,[l,e-l],c.shape.length-1),m=hr(u,[l,e-l],u.shape.length-1),f=n.shape.slice();return f[n.shape.length-1]=l,k(te(p[0],m[0]),f)}var Ln=y({rfft_:O2});function M2(r,t){let e=h(r,"a","squaredDifference"),o=h(t,"b","squaredDifference");[e,o]=q(e,o),tt(e.shape,o.shape);let n={a:e,b:o},s={};return w.runKernel(Co,n,s)}var dc=y({squaredDifference_:M2});function L2(r,t){let e=h(r,"x","squeeze","string_or_numeric");return k(e,Sp(e.shape,t).newShape)}var Bn=y({squeeze_:L2});function B2(r,t=0){let e=ar(r,"tensors","stack","string_or_numeric");v(e.length>=1,()=>"Pass at least one tensor to tf.stack"),e.length>0&&v(t<=e[0].rank,()=>"Axis must be <= rank of the tensor");let o=e,n={axis:t};return w.runKernel(Si,o,n)}var gr=y({stack_:B2});function G2(r,t=0){let o={x:h(r,"x","step")},n={alpha:t};return w.runKernel(ma,o,n)}var hc=y({step_:G2});function U2(r,t,e,o,n=0,s=0,i=0,a=0,l=0){let u={x:h(r,"x","stridedSlice","string_or_numeric")},p={begin:t,end:e,strides:o,beginMask:n,endMask:s,ellipsisMask:i,newAxisMask:a,shrinkAxisMask:l};return w.runKernel(ea,u,p)}var Ix=y({stridedSlice_:U2});function V2(r){let e={x:h(r,"x","tan","float32")};return w.runKernel("Tan",e)}var Nx=y({tan_:V2});function Pt(r,t){de(r);let e=Gt(r,t);if(e.length!==1)throw new Error("tensor1d() requires values to be a flat/TypedArray");return Yt(r,null,e,t)}function Ur(r,t,e){if(de(r),t!=null&&t.length!==2)throw new Error("tensor2d() requires shape to have two numbers");let o=Gt(r,e);if(o.length!==2&&o.length!==1)throw new Error("tensor2d() requires values to be number[][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor2d() requires shape to be provided when `values` are a flat/TypedArray");return Yt(r,t,o,e)}function gc(r,t,e){if(de(r),t!=null&&t.length!==3)throw new Error("tensor3d() requires shape to have three numbers");let o=Gt(r,e);if(o.length!==3&&o.length!==1)throw new Error("tensor3d() requires values to be number[][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor3d() requires shape to be provided when `values` are a flat array");return Yt(r,t,o,e)}function kx(r,t,e){if(de(r),t!=null&&t.length!==4)throw new Error("tensor4d() requires shape to have four numbers");let o=Gt(r,e);if(o.length!==4&&o.length!==1)throw new Error("tensor4d() requires values to be number[][][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor4d() requires shape to be provided when `values` are a flat array");return Yt(r,t,o,e)}function Rx(r,t,e){if(de(r),t!=null&&t.length!==5)throw new Error("tensor5d() requires shape to have five numbers");let o=Gt(r,e);if(o.length!==5&&o.length!==1)throw new Error("tensor5d() requires values to be number[][][][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor5d() requires shape to be provided when `values` are a flat array");return Yt(r,t,o,e)}function Ax(r,t,e){if(de(r),t!=null&&t.length!==6)throw new Error("tensor6d() requires shape to have six numbers");let o=Gt(r,e);if(o.length!==6&&o.length!==1)throw new Error("tensor6d() requires values to be number[][][][][][] or flat/TypedArray");if(o.length===1&&t==null)throw new Error("tensor6d() requires shape to be provided when `values` are a flat array");return t=t||o,Yt(r,t,o,e)}var Ra={};Lt(Ra,{calculateShapes:()=>_x,validateInput:()=>Gn,validateUpdateShape:()=>Dm});function Dm(r,t,e){let o=t.rank>1?t.shape[t.rank-1]:1,n=t.rank>1?t.rank-1:1,s=`Must have updates.shape = indices.shape[:batchDim] + shape[sliceDim:], got updates.shape: ${e.shape}, indices.shape: ${t.shape}, shape: ${r}, sliceDim: ${o}, and batchDim: ${n}.`;if(e.rank<n)throw new Error(s+` update.rank < ${n}. `);if(r.length<o+(e.rank-n))throw new Error(s+` Output shape length < ${o+(e.rank-n)}`);if(e.rank!==n+r.length-o)throw new Error(s+` update.rank != ${n+r.length-o}`);for(let i=0;i<n;++i)if(e.shape[i]!==t.shape[i])throw new Error(s+` updates.shape[${i}] (${e.shape[i]}) != indices.shape[${i}] (${t.shape[i]}).`);for(let i=0;i<e.rank-n;++i)if(e.shape[i+n]!==r[i+o])throw new Error(s+` updates.shape[${i+n}] (${e.shape[i+n]}) != shape[${i+n}] (${r[i+n]})`)}function Gn(r,t,e){if(t.rank<1)throw new Error(`tf.scatterND() expects the indices to be rank 1 or higher, but the rank was ${t.rank}.`);if(r.rank<1)throw new Error(`tf.scatterND() expects the updates to be rank 1 or higher, but the rank was ${r.rank}.`);if(t.dtype!=="int32")throw new Error(`The dtype of 'indices' should be int32, but got dtype: ${t.dtype}`);if(e.length<1)throw new Error(`Output rank must be greater or equal to 1, but got shape: ${e}`);if(e.length===0){if(t.size===0)throw new Error(`Indices specified for empty output. indices shape: ${t.shape}`);if(r.size===0)throw new Error(`Updates specified for empty output. updates shape: ${r.shape}`)}Dm(e,t,r)}function _x(r,t,e){let o=t.shape.length,n=o>1?t.shape[o-1]:1,s=e.length,i=1;for(let p=n;p<s;++p)i*=e[p];let a=n<1?1:n,l=X(t.shape)/a,c=[...Be(e.slice(0,n)),1],u=X(e);return{sliceRank:n,numUpdates:l,sliceSize:i,strides:c,outputSize:u}}function W2(r,t,e){let o=h(r,"tensor","tensorScatterupdate"),n=h(t,"indices","tensorScatterupdate","int32"),s=h(e,"updates","tensorScatterupdate");if(Gn(s,n,o.shape),o.dtype!==s.dtype)throw new Error(`tensor and updates must have the same dtype, instead they are ${o.dtype} and ${s.dtype}.`);let i={tensor:o,indices:n,updates:s},a={};return w.runKernel(Gi,i,a)}var Dx=y({tensorScatterUpdate_:W2});function z2(r,t=1,e=!0){let o=h(r,"x","topk");if(o.rank===0)throw new Error("topk() expects the input to be of rank 1 or higher");let n=o.shape[o.shape.length-1];if(t<0)throw new Error(`'k' passed to topk() must be >= 0 but got ${t}`);if(t>n)throw new Error(`'k' passed to topk() must be <= the last dimension (${n}) but got ${t}`);let s={x:o},i={k:t,sorted:e},[a,l]=w.runKernel(ia,s,i);return{values:a,indices:l}}var Fx=y({topk_:z2});function K2(r,t=0,e=1,o,n){if(ft(r),o!=null&&o==="bool")throw new Error("Unsupported data type $ { dtype }");let s=new Go(t,e,o,!0,n),i=j(r,o);for(let a=0;a<i.values.length;a++)i.values[a]=s.nextValue();return i.toTensor()}var Px=y({truncatedNormal_:K2});function H2(r,t=0){let e=h(r,"x","unique","string_or_numeric");v(e.rank>0,()=>"The input tensor must be at least 1D");let o={x:e},n={axis:t},[s,i]=w.runKernel(la,o,n);return{values:s,indices:i}}var Ox=y({unique_:H2});function q2(r,t,e){let o=h(r,"x","unsortedSegmentSum"),n=h(t,"segmentIds","unsortedSegmentSum","int32");v(sr(e),()=>"numSegments must be of dtype int");let s={x:o,segmentIds:n},i={numSegments:e};return w.runKernel(ua,s,i)}var Mx=y({unsortedSegmentSum_:q2});function X2(r,t=0){let e=h(r,"x","unstack","string_or_numeric");v(t>=-e.shape.length&&t<e.shape.length,()=>`Axis = ${t} is not in [-${e.shape.length}, ${e.shape.length})`);let o={value:e},n={axis:t};return w.runKernel(ca,o,n)}var Un=y({unstack_:X2});function Lx(r,t){return Na(r,t,"right")}function Bx(r,t=!0,e,o){return w.makeVariable(r,t,e,o)}function xc(r,t){let e=[];for(let s=0;s<t.length;s++)t[s]&&e.push(s);let o=j(r,"int32"),n=j([e.length,r.length],"int32");for(let s=0;s<e.length;s++){let i=o.indexToLoc(e[s]),a=s*r.length;n.values.set(i,a)}return n.toTensor()}async function j2(r){let t=h(r,"condition","whereAsync","bool"),e=await t.data(),o=xc(t.shape,e);return r!==t&&t.dispose(),o}var bc=j2;async function Y2(r,t,e){let o=h(r,"tensor","boolMask"),n=h(t,"mask","boolMask","bool"),s=e??0,i=n.rank,a=o.shape;v(i>0,()=>"mask cannot be scalar"),ut(a.slice(s,s+i),n.shape,"mask's shape must match the first K dimensions of tensor's shape,");let l=1;for(let x=s;x<s+i;x++)l*=a[x];let c=a.slice(0,s).concat([l],a.slice(s+i)),u=k(o,c),p=k(n,[-1]),m=await bc(p),f=Bn(m,[1]),d=zl(u,f,s);return r!==o&&o.dispose(),t!==n&&n.dispose(),f.dispose(),u.dispose(),p.dispose(),m.dispose(),d}var Z2=Y2;function Q2(r,t,e){let o=h(r,"x","transpose");if(t==null&&(t=o.shape.map((i,a)=>a).reverse()),v(o.rank===t.length,()=>`Error in transpose: rank of input ${o.rank} must match length of perm ${t}.`),t.forEach(i=>{v(i>=0&&i<o.rank,()=>`All entries in 'perm' must be between 0 and ${o.rank-1} but got ${t}`)}),o.rank<=1)return o.clone();let n={x:o},s={perm:t};return o.dtype==="complex64"?at(()=>{let i=dr(o),a=Lr(o);return i=w.runKernel(So,{x:i},s),a=w.runKernel(So,{x:a},s),e&&(a=Vt(a)),te(i,a)}):w.runKernel(So,n,s)}var Vn=y({transpose_:Q2});function J2(r,t,e,o,n=!0){let s=h(r,"v","movingAverage"),i=h(t,"x","movingAverage"),a=h(e,"decay","movingAverage");Jp(s,i),v(Xt(s.shape,i.shape),()=>"Shape mismatch in v and x");let l=H(1),c=z(l,a),u=F(z(i,s),c);if(n){v(o!=null,()=>"When using zeroDebias: true, step is required.");let p=h(o,"step","movingAverage");u=Z(u,z(l,mr(a,p)))}return U(s,u)}var tN=y({movingAverage_:J2});function eN(r,t,e){ft(e);let o=h(r,"indices","scatterND","int32"),n=h(t,"updates","scatterND");Gn(n,o,e);let s={indices:o,updates:n},i={shape:e};return w.runKernel(Bi,s,i)}var rN=y({scatterND_:eN});function Gx(r,t,e,o){if(r.dtype!=="int32")throw new Error(`tf.sparseToDense() expects the indices to be int32 type, but the dtype was ${r.dtype}.`);if(r.rank>2)throw new Error(`sparseIndices should be a scalar, vector, or matrix, but got shape ${r.shape}.`);let n=r.rank>0?r.shape[0]:1,s=r.rank>1?r.shape[1]:1;if(e.length!==s)throw new Error(`outputShape has incorrect number of elements:, ${e.length}, should be: ${s}.`);let i=t.size;if(!(t.rank===0||t.rank===1&&i===n))throw new Error(`sparseValues has incorrect shape ${t.shape}, should be [] or [${n}]`);if(t.dtype!==o.dtype)throw new Error("sparseValues.dtype must match defaultValues.dtype")}function nN(r,t,e,o=0){ft(e);let n=h(r,"sparseIndices","sparseToDense","int32"),s=h(t,"sparseValues","sparseToDense","string_or_numeric"),i=h(o,"defaultValue","sparseToDense",s.dtype);Gx(n,s,e,i);let a={sparseIndices:n,sparseValues:s,defaultValue:i},l={outputShape:e};return w.runKernel(ta,a,l)}var sN=y({sparseToDense_:nN});function iN(r,t){let e=h(t,"indices","gatherND","int32"),n={params:h(r,"x","gatherND","string_or_numeric"),indices:e};return w.runKernel(ti,n)}var aN=y({gatherND_:iN});function Ux(r,t){if(t==null)return r.shape.slice();if(Xt(r.shape,t))return t;if(r.shape.length===t.length){let e=[];for(let o=0;o<r.shape.length;o++)t[o]==null&&r.shape[o]!=null?e.push(r.shape[o]):e.push(t[o]);return e}return t}function lN(r,t,e,o){let n=h(r,"x","dropout");if(v(n.dtype==="float32",()=>`x has to be a floating point tensor since it's going to be scaled, but got a ${n.dtype} tensor instead.`),v(t>=0&&t<1,()=>`rate must be a float in the range [0, 1), but got ${t}.`),t===0)return r instanceof lt?n.clone():n;let s=Ux(n,e),i=1-t,a=Z(Wl(U(On(s,0,1,"float32",o),i)),i);return F(n,a)}var cN=y({dropout_:lN});function Fm(r){return Math.floor(Math.pow(2,Math.ceil(Math.log(r)/Math.log(2))))}function Aa(r,t,e){let o=1-r%2,n=new Float32Array(r);for(let s=0;s<r;++s){let i=2*Math.PI*s/(r+o-1);n[s]=t-e*Math.cos(i)}return Pt(n,"float32")}async function uN(r,t,e=1){let o=h(r,"predictions","inTopK"),n=h(t,"targets","inTopK");v(o.rank>1,()=>`inTopK() expects the predictions to be of rank 2 or higher, but got ${o.rank}`),v(o.rank-1===n.rank,()=>`predictions rank should be 1 larger than targets rank, but got predictions rank ${o.rank} and targets rank ${n.rank}`),ut(o.shape.slice(0,o.shape.length-1),n.shape,"predictions's shape should be align with the targets' shape, except the last dimension.");let s=o.shape[o.shape.length-1];v(e>0&&e<=s,()=>`'k' passed to inTopK() must be > 0 && <= the predictions last dimension (${s}), but got ${e}`);let i=await o.data(),a=await n.data(),[l,c]=[i.length/s,s],u=Tp("bool",l);for(let p=0;p<l;p++){let m=p*c,f=i.subarray(m,m+c),d=[];for(let x=0;x<f.length;x++)d.push({value:f[x],index:x});d.sort((x,g)=>g.value-x.value),u[p]=0;for(let x=0;x<e;x++)if(d[x].index===a[p]){u[p]=1;break}}return r!==o&&o.dispose(),t!==n&&n.dispose(),Ve(u,n.shape,"bool")}var pN=uN;var Pm={};Lt(Pm,{conv2d:()=>Wx,depthwiseConv2d:()=>Hx,matMul:()=>qx});function mN(r,t,e,o,n,s="NHWC",i){let a=r;r.rank===3&&(a=k(r,[1,r.shape[0],r.shape[1],r.shape[2]]));let l=t;l.rank===3&&(l=k(t,[1,t.shape[0],t.shape[1],t.shape[2]])),v(a.rank===4,()=>`Error in conv2dDerFilter: input must be rank 4, but got shape ${a.shape}.`),v(l.rank===4,()=>`Error in conv2dDerFilter: dy must be rank 4, but got shape ${l.shape}.`),v(e.length===4,()=>`Error in conv2dDerFilter: filterShape must be length 4, but got ${e}.`);let c=s==="NHWC"?a.shape[3]:a.shape[1],u=s==="NHWC"?l.shape[3]:l.shape[1];v(c===e[2],()=>`Error in conv2dDerFilter: depth of input ${c}) must match input depth in filter (${e[2]}.`),v(u===e[3],()=>`Error in conv2dDerFilter: depth of dy (${u}) must match output depth for filter (${e[3]}).`),Tt("conv2dDerFilter",n,i);let p={x:a,dy:l},m={strides:o,pad:n,dataFormat:s,dimRoundingMode:i,filterShape:e};return w.runKernel(_s,p,m)}var Vx=y({conv2DBackpropFilter_:mN});function Vo(r,t,e){if(e==null||e==="linear")return r;if(e==="relu")return F(r,hc(t));throw new Error(`Cannot compute gradient for fused activation ${e}.`)}function Wo(r,t){let e=t,o=Bl(r.shape,t.shape);return o.length>0&&(e=ot(e,o)),k(e,r.shape)}function zo(r,t,e,o){if(t==="linear")return r;if(t==="relu")return Gr(r);if(t==="elu")return Ul(r);if(t==="relu6")return pc(r);if(t==="prelu")return sc(r,e);if(t==="leakyrelu")return Hl(r,o);if(t==="sigmoid")return je(r);throw new Error(`Unknown fused activation ${t}.`)}var Ko=(r,t)=>!(r>0)||t==="linear";function fN({x:r,filter:t,strides:e,pad:o,dataFormat:n="NHWC",dilations:s=[1,1],dimRoundingMode:i,bias:a,activation:l="linear",preluActivationWeights:c,leakyreluAlpha:u}){if(l=l||"linear",Ko(w.state.gradientDepth,l)===!1){v(n==="NHWC",()=>`Error in fused conv2d: got dataFormat of ${n} but only NHWC is currently supported for the case of gradient depth is 0 and the activation is not linear.`);let R=Pr(r,t,e,o,n,s,i);return a!=null&&(R=U(R,a)),zo(R,l,c,u)}let p=h(r,"x","conv2d","float32"),m=h(t,"filter","conv2d","float32"),f=p,d=!1;p.rank===3&&(d=!0,f=k(p,[1,p.shape[0],p.shape[1],p.shape[2]])),v(f.rank===4,()=>`Error in fused conv2d: input must be rank 4, but got rank ${f.rank}.`),v(m.rank===4,()=>`Error in fused conv2d: filter must be rank 4, but got rank ${m.rank}.`),Tt("fused conv2d",o,i);let x=n==="NHWC"?f.shape[3]:f.shape[1];v(m.shape[2]===x,()=>`Error in conv2d: depth of input (${x}) must match input depth for filter ${m.shape[2]}.`),v(Kt(e,s),()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`);let g=Do(f.shape,m.shape,e,s,o,i),b;a!=null&&(b=h(a,"bias","fused conv2d"),[b]=q(b,p),n==="NHWC"?tt(g.outShape,b.shape):(v(b.shape.length<=1,()=>`Error in fused conv2d: only supports scalar or 1-D Tensor bias for NCHW format but got the bias of rank-${b.shape.length}.`),v(b.shape.length===0||b.shape[0]===g.outChannels||b.shape[0]===1,()=>`Error in fused conv2d: bias shape (${b.shape}) is not compatible with the number of output channels (${g.outChannels})`)));let $;if(c!=null){let R=c.shape;if(v(R.length<=1||R.length===3,()=>`Error in fused conv2d: only supports scalar, 1-D Tensor or 3-D Tensor PReLU activation weights but got a tensor of rank-${R.length}.`),R.length===1)v(R[0]===1||R[0]===g.outChannels,()=>`Error in fused conv2d: PReLU activation weights (${R}) is not compatible with the number of output channels (${g.outChannels}).`);else if(R.length===3)try{tt(R,g.outShape)}catch{let _=`Error in fused conv2d: PReLU activation weights (${R}) is not compatible with the output shape of the conv2d (${g.outShape}).`;throw Error(_)}$=h(c,"prelu weights","fused conv2d")}let S=(R,A)=>{v(n==="NHWC",()=>`Error in gradient of fused conv2D: got dataFormat of ${n} but only NHWC is currently supported.`);let[_,P,O,B]=A,W=Vo(R,O,l);v(_o(s),()=>`Error in gradient of fused conv2D: dilation rates greater than 1 are not yet supported in gradients. Got dilations '${s}'`);let J=Ll(P.shape,W,_,e,o),et=Vx(P,W,_.shape,e,o),st=[J,et];if(B!=null){let At=Wo(B,W);st.push(At)}return st},E={x:f,filter:m,bias:b,preluActivationWeights:$},N={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:i,activation:l,leakyreluAlpha:u};return a==null?Ht((A,_,P)=>{let O=w.runKernel(vn,E,N);return P([_,A,O]),d&&(O=k(O,[O.shape[1],O.shape[2],O.shape[3]])),{value:O,gradFunc:S}})(f,m):Ht((A,_,P,O)=>{let B=w.runKernel(vn,E,N);return O([_,A,B,P]),d&&(B=k(B,[B.shape[1],B.shape[2],B.shape[3]])),{value:B,gradFunc:S}})(f,m,b)}var Wx=y({fusedConv2d_:fN});function dN(r,t,e,o,n,s=[1,1],i){let a=r;r.rank===3&&(a=k(r,[1,r.shape[0],r.shape[1],r.shape[2]]));let l=t;l.rank===3&&(l=k(t,[1,t.shape[0],t.shape[1],t.shape[2]]));let c={x:a,dy:l},u={strides:o,pad:n,dimRoundingMode:i,dilations:s,filterShape:e};return w.runKernel(Ws,c,u)}var zx=y({depthwiseConv2dNativeBackpropFilter_:dN});function hN(r,t,e,o,n,s=[1,1],i){let a=t,l=!1;t.rank===3&&(l=!0,a=k(t,[1,t.shape[0],t.shape[1],t.shape[2]]));let c={dy:a,filter:e},u={strides:o,pad:n,dimRoundingMode:i,dilations:s,inputShape:r},p=w.runKernel(zs,c,u);return l?k(p,[p.shape[1],p.shape[2],p.shape[3]]):p}var Kx=y({depthwiseConv2dNativeBackpropInput_:hN});function gN({x:r,filter:t,strides:e,pad:o,dataFormat:n="NHWC",dilations:s=[1,1],dimRoundingMode:i,bias:a,activation:l="linear",preluActivationWeights:c,leakyreluAlpha:u}){if(Ko(w.state.gradientDepth,l)===!1){let N=Fn(r,t,e,o,n,s,i);return a!=null&&(N=U(N,a)),zo(N,l,c,u)}let p=h(r,"x","depthwiseConv2d","float32"),m=h(t,"filter","depthwiseConv2d","float32"),f=p,d=!1;p.rank===3&&(d=!0,f=k(p,[1,p.shape[0],p.shape[1],p.shape[2]])),v(f.rank===4,()=>`Error in fused depthwiseConv2d: input must be rank 4, but got rank ${f.rank}.`),v(m.rank===4,()=>`Error in fused depthwiseConv2d: filter must be rank 4, but got rank ${m.rank}.`),v(f.shape[3]===m.shape[2],()=>`Error in fused depthwiseConv2d: number of input channels (${f.shape[3]}) must match the inChannels dimension in filter ${m.shape[2]}.`),s==null&&(s=[1,1]),v(Kt(e,s),()=>`Error in fused depthwiseConv2d: Either strides or dilations must be 1. Got strides ${e} and dilations '${s}'`),Tt("fused depthwiseConv2d",o,i);let x=Do(f.shape,m.shape,e,s,o,i,!0),g;a!=null&&(g=h(a,"bias","fused conv2d"),[g]=q(g,p),tt(x.outShape,g.shape));let b;c!=null&&(b=h(c,"prelu weights","fused depthwiseConv2d"));let $=(N,R)=>{v(_o(s),()=>`Error in gradient of fused depthwiseConv2d: dilation rates greater than 1 are not yet supported. Got dilations '${s}'`);let[A,_,P,O]=R,B=Vo(N,P,l),W=Kx(_.shape,B,A,e,o,s,i),J=zx(_,B,A.shape,e,o,s,i);if(O!=null){let et=Wo(g,B);return[W,J,et]}return[W,J]},S={x:f,filter:m,bias:g,preluActivationWeights:b},E={strides:e,pad:o,dataFormat:n,dilations:s,dimRoundingMode:i,activation:l,leakyreluAlpha:u};return a==null?Ht((R,A,_)=>{let P=w.runKernel($n,S,E);return _([A,R,P]),d&&(P=k(P,[P.shape[1],P.shape[2],P.shape[3]])),{value:P,gradFunc:$}})(f,m):Ht((R,A,_,P)=>{let O=w.runKernel($n,S,E);return P([A,R,O,_]),d&&(O=k(O,[O.shape[1],O.shape[2],O.shape[3]])),{value:O,gradFunc:$}})(f,m,g)}var Hx=y({fusedDepthwiseConv2d_:gN});function xN({a:r,b:t,transposeA:e=!1,transposeB:o=!1,bias:n,activation:s="linear",preluActivationWeights:i,leakyreluAlpha:a=.2}){if(Ko(w.state.gradientDepth,s)===!1){let B=Q(r,t,e,o);return n!=null&&(B=U(B,n)),zo(B,s,i,a)}let l=h(r,"a","fused matMul"),c=h(t,"b","fused matMul");[l,c]=q(l,c);let u=e?l.shape[l.rank-2]:l.shape[l.rank-1],p=o?c.shape[c.rank-1]:c.shape[c.rank-2],m=e?l.shape[l.rank-1]:l.shape[l.rank-2],f=o?c.shape[c.rank-2]:c.shape[c.rank-1],d=l.shape.slice(0,-2),x=c.shape.slice(0,-2),g=X(d),b=X(x);v(u===p,()=>`Error in fused matMul: inner shapes (${u}) and (${p}) of Tensors with shapes ${l.shape} and ${c.shape} and transposeA=${e} and transposeB=${o} must match.`);let S=tt(l.shape.slice(0,-2),c.shape.slice(0,-2)).concat([m,f]),E=e?k(l,[g,u,m]):k(l,[g,m,u]),N=o?k(c,[b,f,p]):k(c,[b,p,f]),R;n!=null&&(R=h(n,"bias","fused matMul"),[R]=q(R,l),tt(S,R.shape));let A;i!=null&&(A=h(i,"prelu weights","fused matMul"));let _=(B,W)=>{let[J,et,st,At]=W,It=Vo(k(B,st.shape),st,s),$t,Qt;if(!e&&!o?($t=Q(It,et,!1,!0),Qt=Q(J,It,!0,!1)):!e&&o?($t=Q(It,et,!1,!1),Qt=Q(It,J,!0,!1)):e&&!o?($t=Q(et,It,!1,!0),Qt=Q(J,It,!1,!1)):($t=Q(et,It,!0,!0),Qt=Q(It,J,!0,!0)),n!=null){let Cr=Wo(At,It);return[$t,Qt,Cr]}else return[$t,Qt]},P={a:E,b:N,bias:R,preluActivationWeights:A},O={transposeA:e,transposeB:o,activation:s,leakyreluAlpha:a};return n==null?Ht((W,J,et)=>{let st=w.runKernel(Cn,P,O);return et([W,J,st]),{value:k(st,S),gradFunc:_}})(E,N):Ht((W,J,et,st)=>{let At=w.runKernel(Cn,P,O);return st([W,J,At,et]),{value:k(At,S),gradFunc:_}})(E,N,R)}var qx=y({fusedMatMul_:xN});function bN(r){return Aa(r,.54,.46)}var Xx=y({hammingWindow_:bN});function yN(r){return Aa(r,.5,.5)}var yc=y({hannWindow_:yN});function wN(r,t,e,o=!1,n=0){let s=0,i=[];for(;s+t<=r.size;)i.push(rt(r,s,t)),s+=e;if(o)for(;s<r.size;){let a=s+t-r.size,l=vt([rt(r,s,t-a),Ye([a],n)]);i.push(l),s+=e}return i.length===0?Ur([],[0,t]):k(vt(i),[i.length,t])}var wc=y({frame_:wN});function CN(r,t,e,o,n=yc){o==null&&(o=Fm(t));let s=wc(r,t,e),i=F(s,n(t));return Ln(i,o)}var jx=y({stft_:CN});function vN(r,t,e,o,n="bilinear",s=0){let i=h(r,"image","cropAndResize"),a=h(t,"boxes","cropAndResize","float32"),l=h(e,"boxInd","cropAndResize","int32"),c=a.shape[0];v(i.rank===4,()=>`Error in cropAndResize: image must be rank 4,but got rank ${i.rank}.`),v(a.rank===2&&a.shape[1]===4,()=>`Error in cropAndResize: boxes must be have size [${c},4] but had shape ${a.shape}.`),v(l.rank===1&&l.shape[0]===c,()=>`Error in cropAndResize: boxInd must be have size [${c}] but had shape ${a.shape}.`),v(o.length===2,()=>`Error in cropAndResize: cropSize must be of length 2, but got length ${o.length}.`),v(o[0]>=1&&o[1]>=1,()=>`cropSize must be atleast [1,1], but was ${o}`),v(n==="bilinear"||n==="nearest",()=>`method must be bilinear or nearest, but was ${n}`);let u={image:i,boxes:a,boxInd:l},p={method:n,extrapolationValue:s,cropSize:o};return w.runKernel(Bs,u,p)}var Yx=y({cropAndResize_:vN});function $N(r){let t=h(r,"image","flipLeftRight","float32");v(t.rank===4,()=>`Error in flipLeftRight: image must be rank 4,but got rank ${t.rank}.`);let e={image:t};return w.runKernel(Zs,e,{})}var Zx=y({flipLeftRight_:$N});function SN(r){let t=h(r,"image","grayscaleToRGB"),e=t.rank-1,o=t.shape[e];v(t.rank>=2,()=>`Error in grayscaleToRGB: images must be at least rank 2, but got rank ${t.rank}.`),v(o===1,()=>`Error in grayscaleToRGB: last dimension of a grayscale image should be size 1, but got size ${o}.`);let n=new Array(t.rank);return n.fill(1,0,e),n[e]=3,Mr(t,n)}var Qx=y({grayscaleToRGB_:SN});function TN(r){let t=h(r,"image","RGBToGrayscale"),e=t.rank-1,o=t.shape[e];v(t.rank>=2,()=>`Error in RGBToGrayscale: images must be at least rank 2, but got rank ${t.rank}.`),v(o===3,()=>`Error in RGBToGrayscale: last dimension of an RGB image should be size 3, but got size ${o}.`);let n=t.dtype,s=Y(t,"float32"),i=Pt([.2989,.587,.114]),a;switch(t.rank){case 2:a=Or("ij,j->i",s,i);break;case 3:a=Or("ijk,k->ij",s,i);break;case 4:a=Or("ijkl,l->ijk",s,i);break;case 5:a=Or("ijklm,m->ijkl",s,i);break;case 6:a=Or("ijklmn,n->ijklm",s,i);break;default:throw new Error("Not a valid tensor rank.")}return a=De(a,-1),Y(a,n)}var Jx=y({rgbToGrayscale_:TN});function EN(r,t,e=0,o=.5){let n=h(r,"image","rotateWithOffset","float32");v(n.rank===4,()=>`Error in rotateWithOffset: image must be rank 4,but got rank ${n.rank}.`);let s={image:n},i={radians:t,fillValue:e,center:o};return w.runKernel(fa,s,i)}var tb=y({rotateWithOffset_:EN});function Te(r,t,e,o,n,s){o==null&&(o=.5),n==null&&(n=Number.NEGATIVE_INFINITY),s==null&&(s=0);let i=r.shape[0];return e=Math.min(e,i),v(0<=o&&o<=1,()=>`iouThreshold must be in [0, 1], but was '${o}'`),v(r.rank===2,()=>`boxes must be a 2D tensor, but was of rank '${r.rank}'`),v(r.shape[1]===4,()=>`boxes must have 4 columns, but 2nd dimension was ${r.shape[1]}`),v(t.rank===1,()=>"scores must be a 1D tensor"),v(t.shape[0]===i,()=>`scores has incompatible shape with boxes. Expected ${i}, but was ${t.shape[0]}`),v(0<=s&&s<=1,()=>`softNmsSigma must be in [0, 1], but was '${s}'`),{maxOutputSize:e,iouThreshold:o,scoreThreshold:n,softNmsSigma:s}}function IN(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY){let s=h(r,"boxes","nonMaxSuppression","float32"),i=h(t,"scores","nonMaxSuppression","float32"),a=Te(s,i,e,o,n);e=a.maxOutputSize,o=a.iouThreshold,n=a.scoreThreshold;let l={maxOutputSize:e,iouThreshold:o,scoreThreshold:n};return w.runKernel(yi,{boxes:s,scores:i},l)}var eb=y({nonMaxSuppression_:IN});function rb(r,t,e){let o=NN(r,t,e),n=o<0?-(o+1):o;r.splice(n,0,t)}function NN(r,t,e){return RN(r,t,e||kN)}function kN(r,t){return r>t?1:r<t?-1:0}function RN(r,t,e){let o=0,n=r.length,s=0,i=!1;for(;o<n;){s=o+(n-o>>>1);let a=e(t,r[s]);a>0?o=s+1:(n=s,i=!a)}return i?o:-o-1}function Cc(r,t,e,o,n){return Om(r,t,e,o,n,0)}function vc(r,t,e,o,n,s){return Om(r,t,e,o,n,0,!1,s,!0)}function $c(r,t,e,o,n,s){return Om(r,t,e,o,n,s,!0)}function Om(r,t,e,o,n,s,i=!1,a=!1,l=!1){let c=[];for(let g=0;g<t.length;g++)t[g]>n&&c.push({score:t[g],boxIndex:g,suppressBeginIndex:0});c.sort(ob);let u=s>0?-.5/s:0,p=[],m=[];for(;p.length<e&&c.length>0;){let g=c.pop(),{score:b,boxIndex:$,suppressBeginIndex:S}=g;if(b<n)break;let E=!1;for(let N=p.length-1;N>=S;--N){let R=AN(r,$,p[N]);if(R>=o){E=!0;break}if(g.score=g.score*_N(o,u,R),g.score<=n)break}g.suppressBeginIndex=p.length,E||(g.score===b?(p.push($),m.push(g.score)):g.score>n&&rb(c,g,ob))}let f=p.length,d=e-f;a&&d>0&&(p.push(...new Array(d).fill(0)),m.push(...new Array(d).fill(0)));let x={selectedIndices:p};return i&&(x.selectedScores=m),l&&(x.validOutputs=f),x}function AN(r,t,e){let o=r.subarray(t*4,t*4+4),n=r.subarray(e*4,e*4+4),s=Math.min(o[0],o[2]),i=Math.min(o[1],o[3]),a=Math.max(o[0],o[2]),l=Math.max(o[1],o[3]),c=Math.min(n[0],n[2]),u=Math.min(n[1],n[3]),p=Math.max(n[0],n[2]),m=Math.max(n[1],n[3]),f=(a-s)*(l-i),d=(p-c)*(m-u);if(f<=0||d<=0)return 0;let x=Math.max(s,c),g=Math.max(i,u),b=Math.min(a,p),$=Math.min(l,m),S=Math.max(b-x,0)*Math.max($-g,0);return S/(f+d-S)}function _N(r,t,e){let o=Math.exp(t*e*e);return e<=r?o:0}function ob(r,t){return r.score-t.score||r.score===t.score&&t.boxIndex-r.boxIndex}async function DN(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY){let s=h(r,"boxes","nonMaxSuppressionAsync"),i=h(t,"scores","nonMaxSuppressionAsync"),a=Te(s,i,e,o,n);e=a.maxOutputSize,o=a.iouThreshold,n=a.scoreThreshold;let l=await Promise.all([s.data(),i.data()]),c=l[0],u=l[1],{selectedIndices:p}=Cc(c,u,e,o,n);return s!==r&&s.dispose(),i!==t&&i.dispose(),Pt(p,"int32")}var nb=DN;function FN(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=0){let i=h(r,"boxes","nonMaxSuppression"),a=h(t,"scores","nonMaxSuppression"),l=Te(i,a,e,o,n,s);e=l.maxOutputSize,o=l.iouThreshold,n=l.scoreThreshold,s=l.softNmsSigma;let c={boxes:i,scores:a},u={maxOutputSize:e,iouThreshold:o,scoreThreshold:n,softNmsSigma:s},p=w.runKernel(Ci,c,u);return{selectedIndices:p[0],selectedScores:p[1]}}var sb=y({nonMaxSuppressionWithScore_:FN});async function PN(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=0){let i=h(r,"boxes","nonMaxSuppressionAsync"),a=h(t,"scores","nonMaxSuppressionAsync"),l=Te(i,a,e,o,n,s);e=l.maxOutputSize,o=l.iouThreshold,n=l.scoreThreshold,s=l.softNmsSigma;let c=await Promise.all([i.data(),a.data()]),u=c[0],p=c[1],{selectedIndices:m,selectedScores:f}=$c(u,p,e,o,n,s);return i!==r&&i.dispose(),a!==t&&a.dispose(),{selectedIndices:Pt(m,"int32"),selectedScores:Pt(f)}}var ib=PN;function ON(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=!1){let i=h(r,"boxes","nonMaxSuppression"),a=h(t,"scores","nonMaxSuppression"),l=Te(i,a,e,o,n,null),c=l.maxOutputSize,u=l.iouThreshold,p=l.scoreThreshold,m={boxes:i,scores:a},f={maxOutputSize:c,iouThreshold:u,scoreThreshold:p,padToMaxOutputSize:s},d=w.runKernel(wi,m,f);return{selectedIndices:d[0],validOutputs:d[1]}}var ab=y({nonMaxSuppressionPadded_:ON});async function MN(r,t,e,o=.5,n=Number.NEGATIVE_INFINITY,s=!1){let i=h(r,"boxes","nonMaxSuppressionAsync"),a=h(t,"scores","nonMaxSuppressionAsync"),l=Te(i,a,e,o,n,null),c=l.maxOutputSize,u=l.iouThreshold,p=l.scoreThreshold,[m,f]=await Promise.all([i.data(),a.data()]),{selectedIndices:d,validOutputs:x}=vc(m,f,c,u,p,s);return i!==r&&i.dispose(),a!==t&&a.dispose(),{selectedIndices:Pt(d,"int32"),validOutputs:H(x,"int32")}}var lb=MN;function LN(r,t,e=!1,o=!1){let n=h(r,"images","resizeBilinear");v(n.rank===3||n.rank===4,()=>`Error in resizeBilinear: x must be rank 3 or 4, but got rank ${n.rank}.`),v(t.length===2,()=>`Error in resizeBilinear: new shape must 2D, but got shape ${t}.`),v(o===!1||e===!1,()=>"Error in resizeBilinear: If halfPixelCenters is true, alignCorners must be false.");let s=n,i=!1;n.rank===3&&(i=!0,s=k(n,[1,n.shape[0],n.shape[1],n.shape[2]]));let[]=t,a={images:s},l={alignCorners:e,halfPixelCenters:o,size:t},c=w.runKernel(Pi,a,l);return i?k(c,[c.shape[1],c.shape[2],c.shape[3]]):c}var cb=y({resizeBilinear_:LN});function BN(r,t,e=!1,o=!1){let n=h(r,"images","resizeNearestNeighbor");v(n.rank===3||n.rank===4,()=>`Error in resizeNearestNeighbor: x must be rank 3 or 4, but got rank ${n.rank}.`),v(t.length===2,()=>`Error in resizeNearestNeighbor: new shape must 2D, but got shape ${t}.`),v(n.dtype==="float32"||n.dtype==="int32",()=>"`images` must have `int32` or `float32` as dtype"),v(o===!1||e===!1,()=>"Error in resizeNearestNeighbor: If halfPixelCenters is true, alignCorners must be false.");let s=n,i=!1;n.rank===3&&(i=!0,s=k(n,[1,n.shape[0],n.shape[1],n.shape[2]]));let[]=t,a={images:s},l={alignCorners:e,halfPixelCenters:o,size:t},c=w.runKernel(Fi,a,l);return i?k(c,[c.shape[1],c.shape[2],c.shape[3]]):c}var ub=y({resizeNearestNeighbor_:BN});function GN(r,t="binary",e=!1,o=.5){let n=h(r,"image","threshold"),s=.2989,i=.587,a=.114,l=n.shape[0]*n.shape[1],c=F(Pt([o]),255),u,p,m,f;if(v(n.rank===3,()=>`Error in threshold: image must be rank 3,but got rank ${n.rank}.`),v(n.shape[2]===3||n.shape[2]===1,()=>`Error in threshold: image color channel must be equal to 3 or 1but got ${n.shape[2]}.`),v(n.dtype==="int32"||n.dtype==="float32",()=>`Error in dtype: image dtype must be int32 or float32,but got dtype ${n.dtype}.`),v(t==="otsu"||t==="binary",()=>`Method must be binary or otsu, but was ${t}`),n.shape[2]===3){[u,p,m]=hr(n,[1,1,1],-1);let g=F(u,s),b=F(p,i),$=F(m,a);f=U(U(g,b),$)}else f=r;if(t==="otsu"){let g=Ml(Y(mc(f),"int32"),Ve([]),256);c=UN(g,l)}let d=e?Pn(f,c):Po(f,c);return Y(F(d,255),"int32")}function UN(r,t){let e=Pt([-1]),o=Pt([0]),n=Pt([0]),s,i,a,l,c,u;for(let p=0;p<r.size-1;p++){s=rt(r,0,p+1),i=rt(r,p+1),c=Z(ot(s),t),u=Z(ot(i),t);let m=ot(F(s,Br(0,s.size)));a=Z(m,ot(s));let f=Ye(i.shape,s.size),d=U(Br(0,i.size),f),x=F(i,d);l=Z(ot(x),ot(i));let g=z(a,l),b=z(a,l),$=F(c,u);n=F(F($,g),b);let S=Po(n,o);o=he(S,n,o),e=he(S,Pt([p]),e)}return e}var pb=y({threshold_:GN});function VN(r,t,e="nearest",o="constant",n=0,s){let i=h(r,"image","transform","float32"),a=h(t,"transforms","transform","float32");v(i.rank===4,()=>`Error in transform: image must be rank 4,but got rank ${i.rank}.`),v(a.rank===2&&(a.shape[0]===i.shape[0]||a.shape[0]===1)&&a.shape[1]===8,()=>"Error in transform: Input transform should be batch x 8 or 1 x 8"),v(s==null||s.length===2,()=>`Error in transform: outputShape must be [height, width] or null, but got ${s}.`);let l={image:i,transforms:a},c={interpolation:e,fillMode:o,fillValue:n,outputShape:s};return w.runKernel(aa,l,c)}var mb=y({transform_:VN});function WN(r,t,e){let o=h(r,"a","bandPart");v(o.rank>=2,()=>`bandPart(): Rank must be at least 2, got ${o.rank}.`);let n=o.shape,[s,i]=o.shape.slice(-2),a,l;typeof t=="number"?(v(t%1===0,()=>`bandPart(): numLower must be an integer, got ${t}.`),v(t<=s,()=>`bandPart(): numLower (${t}) must not be greater than the number of rows (${s}).`),a=h(t<0?s:t,"numLower","bandPart")):(v(t.dtype==="int32",()=>"bandPart(): numLower's dtype must be an int32."),a=he(Ia(t,0),s,Lo(t,s))),typeof e=="number"?(v(e%1===0,()=>`bandPart(): numUpper must be an integer, got ${e}.`),v(e<=i,()=>`bandPart(): numUpper (${e}) must not be greater than the number of columns (${i}).`),l=h(e<0?i:e,"numUpper","bandPart")):(v(e.dtype==="int32",()=>"bandPart(): numUpper's dtype must be an int32."),l=he(Ia(e,0),i,Lo(e,i)));let c=k(Br(0,s,1,"int32"),[-1,1]),u=Br(0,i,1,"int32"),p=z(c,u),m=Oo(Pn(p,a),Kl(p,Vt(l))),f=Se([s,i],o.dtype);return k(gr(Un(k(o,[-1,s,i])).map(d=>he(m,d,f))),n)}var fb=y({bandPart_:WN});function zN(r){let t;if(Array.isArray(r)){t=!1,v(r!=null&&r.length>0,()=>"Gram-Schmidt process: input must not be null, undefined, or empty");let n=r[0].shape[0];for(let s=1;s<r.length;++s)v(r[s].shape[0]===n,()=>`Gram-Schmidt: Non-unique lengths found in the input vectors: (${r[s].shape[0]} vs. ${n})`)}else t=!0,r=hr(r,r.shape[0],0).map(n=>Bn(n,[0]));v(r.length<=r[0].shape[0],()=>`Gram-Schmidt: Number of vectors (${r.length}) exceeds number of dimensions (${r[0].shape[0]}).`);let e=[],o=r;for(let n=0;n<r.length;++n)e.push(w.tidy(()=>{let s=o[n];if(n>0)for(let i=0;i<n;++i){let a=F(ot(F(e[i],s)),e[i]);s=z(s,a)}return Z(s,Fo(s,"euclidean"))}));return t?gr(e,0):e}var db=y({gramSchmidt_:zN});function KN(r,t=!1){if(v(r.rank>=2,()=>`qr() requires input tensor to have a rank >= 2, but got rank ${r.rank}`),r.rank===2)return hb(r,t);{let e=r.shape.slice(0,r.shape.length-2).reduce((l,c)=>l*c),o=Un(k(r,[e,r.shape[r.shape.length-2],r.shape[r.shape.length-1]]),0),n=[],s=[];o.forEach(l=>{let[c,u]=hb(l,t);n.push(c),s.push(u)});let i=k(gr(n,0),r.shape),a=k(gr(s,0),r.shape);return[i,a]}}function hb(r,t=!1){return w.tidy(()=>{v(r.shape.length===2,()=>`qr2d() requires a 2D Tensor, but got a ${r.shape.length}D Tensor.`);let e=r.shape[0],o=r.shape[1],n=Vl(e),s=ve(r),i=Ur([[1]],[1,1]),a=ve(i),l=e>=o?o:e;for(let c=0;c<l;++c){let u=s,p=a,m=n;[a,s,n]=w.tidy(()=>{let f=rt(s,[c,c],[e-c,1]),d=Fo(f),x=rt(s,[c,c],[1,1]),g=he(Po(x,0),Ur([[-1]]),Ur([[1]])),b=z(x,F(g,d)),$=Z(f,b);$.shape[0]===1?a=ve(i):a=vt([i,rt($,[1,0],[$.shape[0]-1,$.shape[1]])],0);let S=Vt(Z(Q(g,b),d)),E=rt(s,[c,0],[e-c,o]),N=F(S,a),R=Vn(a);if(c===0)s=z(E,Q(N,Q(R,E)));else{let P=z(E,Q(N,Q(R,E)));s=vt([rt(s,[0,0],[c,o]),P],0)}let A=Vn(N),_=rt(n,[0,c],[e,n.shape[1]-c]);if(c===0)n=z(_,Q(Q(_,a),A));else{let P=z(_,Q(Q(_,a),A));n=vt([rt(n,[0,0],[e,c]),P],1)}return[a,s,n]}),St([u,p,m])}return!t&&e>o&&(n=rt(n,[0,0],[e,o]),s=rt(s,[0,0],[o,o])),[n,s]})}var gb=y({qr_:KN});var bt;(function(r){r[r.NONE=0]="NONE",r[r.MEAN=1]="MEAN",r[r.SUM=2]="SUM",r[r.SUM_BY_NONZERO_WEIGHTS=3]="SUM_BY_NONZERO_WEIGHTS"})(bt||(bt={}));function HN(r,t,e=bt.SUM_BY_NONZERO_WEIGHTS){let o=h(r,"losses","computeWeightedLoss"),n=null;t!=null&&(n=h(t,"weights","computeWeightedLoss"));let s=n==null?o:F(o,n);if(e===bt.NONE)return s;if(e===bt.SUM)return ot(s);if(e===bt.MEAN){if(n==null)return Mo(s);{let i=o.size/n.size,a=Z(ot(s),ot(n));return i>1?Z(a,H(i)):a}}if(e===bt.SUM_BY_NONZERO_WEIGHTS){if(n==null)return Z(ot(s),H(o.size));{let i=F(n,Qe(o.shape)),a=Y(ot(oc(i,H(0))),"float32");return Z(ot(s),a)}}throw Error(`Unknown reduction: ${e}`)}var Wt=y({computeWeightedLoss_:HN});function qN(r,t,e,o=bt.SUM_BY_NONZERO_WEIGHTS){let n=h(r,"labels","absoluteDifference"),s=h(t,"predictions","absoluteDifference"),i=null;e!=null&&(i=h(e,"weights","absoluteDifference")),ut(n.shape,s.shape,"Error in absoluteDifference: ");let a=Dt(z(n,s));return Wt(a,i,o)}var xb=y({absoluteDifference_:qN});function XN(r,t,e,o,n=bt.SUM_BY_NONZERO_WEIGHTS){let s=h(r,"labels","cosineDistance"),i=h(t,"predictions","cosineDistance"),a=null;o!=null&&(a=h(o,"weights","cosineDistance")),ut(s.shape,i.shape,"Error in cosineDistance: ");let l=H(1),c=z(l,ot(F(s,i),e,!0));return Wt(c,a,n)}var bb=y({cosineDistance_:XN});function jN(r,t,e,o=bt.SUM_BY_NONZERO_WEIGHTS){let n=h(r,"labels","hingeLoss"),s=h(t,"predictions","hingeLoss"),i=null;e!=null&&(i=h(e,"weights","hingeLoss")),ut(n.shape,s.shape,"Error in hingeLoss: ");let a=H(1);n=z(F(H(2),n),a);let l=Gr(z(a,F(n,s)));return Wt(l,i,o)}var yb=y({hingeLoss_:jN});function YN(r,t,e,o=1,n=bt.SUM_BY_NONZERO_WEIGHTS){let s=h(r,"labels","huberLoss"),i=h(t,"predictions","huberLoss"),a=null;e!=null&&(a=h(e,"weights","huberLoss")),ut(s.shape,i.shape,"Error in huberLoss: ");let l=H(o),c=Dt(z(i,s)),u=Lo(c,l),p=z(c,u),m=U(F(H(.5),Ft(u)),F(l,p));return Wt(m,a,n)}var wb=y({huberLoss_:YN});function ZN(r,t,e,o=1e-7,n=bt.SUM_BY_NONZERO_WEIGHTS){let s=h(r,"labels","logLoss"),i=h(t,"predictions","logLoss"),a=null;e!=null&&(a=h(e,"weights","logLoss")),ut(s.shape,i.shape,"Error in logLoss: ");let l=H(1),c=H(o),u=Vt(F(s,fr(U(i,c)))),p=F(z(l,s),fr(U(z(l,i),c))),m=z(u,p);return Wt(m,a,n)}var Cb=y({logLoss_:ZN});function QN(r,t,e,o=bt.SUM_BY_NONZERO_WEIGHTS){let n=h(r,"labels","meanSquaredError"),s=h(t,"predictions","meanSquaredError"),i=null;e!=null&&(i=h(e,"weights","meanSquaredError")),ut(n.shape,s.shape,"Error in meanSquaredError: ");let a=dc(n,s);return Wt(a,i,o)}var vb=y({meanSquaredError_:QN});function JN(r,t){let e=h(r,"labels","sigmoidCrossEntropyWithLogits"),o=h(t,"logits","sigmoidCrossEntropyWithLogits");ut(e.shape,o.shape,"Error in sigmoidCrossEntropyWithLogits: ");let n=Gr(o),s=F(o,e),i=ql($e(Vt(Dt(o))));return U(z(n,s),i)}function tk(r,t,e,o=0,n=bt.SUM_BY_NONZERO_WEIGHTS){let s=h(r,"multiClassLabels","sigmoidCrossEntropy"),i=h(t,"logits","sigmoidCrossEntropy"),a=null;if(e!=null&&(a=h(e,"weights","sigmoidCrossEntropy")),ut(s.shape,i.shape,"Error in sigmoidCrossEntropy: "),o>0){let c=H(o),u=H(1),p=H(.5);s=U(F(s,z(u,c)),F(p,c))}let l=JN(s,i);return Wt(l,a,n)}var $b=y({sigmoidCrossEntropy_:tk});function ek(r,t,e=-1){if(e===-1&&(e=t.rank-1),e!==t.rank-1)throw Error(`Softmax cross entropy along a non-last dimension is not yet supported. Labels / logits was rank ${t.rank} and dim was ${e}`);return Ht((n,s,i)=>{let l=Zl(s,[e],!0),c=z(Y(s,"float32"),l);i([n,c]);let u=Vt(F(c,n));return{value:ot(u,[e]),gradFunc:(f,d)=>{let[x,g]=d,b=pr(f.shape,[e]);return[F(k(f,b),z(Y(x,"float32"),$e(g))),F(k(f,b),z($e(g),Y(x,"float32")))]}}})(r,t)}function rk(r,t,e,o=0,n=bt.SUM_BY_NONZERO_WEIGHTS){let s=h(r,"onehotLabels","softmaxCrossEntropy"),i=h(t,"logits","softmaxCrossEntropy"),a=null;if(e!=null&&(a=h(e,"weights","softmaxCrossEntropy")),ut(s.shape,i.shape,"Error in softmaxCrossEntropy: "),o>0){let c=H(o),u=H(1),p=H(s.shape[1]);s=U(F(s,z(u,c)),Z(c,p))}let l=ek(s,i);return Wt(l,a,n)}var Sb=y({softmaxCrossEntropy_:rk});function ok(r,t,e,o){let n=h(r,"indices","sparseFillEmptyRows","int32"),s=h(t,"values","sparseFillEmptyRows"),i=h(e,"denseShape","sparseFillEmptyRows","int32"),a=h(o,"defaultValue","sparseFillEmptyRows",s.dtype);if(n.rank!==2)throw new Error(`Indices should be Tensor2D but received shape
        ${n.shape}`);if(s.rank!==1)throw new Error(`Values should be Tensor1D but received shape ${s.shape}`);if(i.rank!==1)throw new Error(`Dense shape should be Tensor1D but received shape ${i.shape}`);if(a.rank!==0)throw new Error(`Default value should be a scalar but received shape ${a.shape}`);let l={indices:n,values:s,denseShape:i,defaultValue:a},c=w.runKernel(Yi,l);return{outputIndices:c[0],outputValues:c[1],emptyRowIndicator:c[2],reverseIndexMap:c[3]}}var Tb=y({sparseFillEmptyRows_:ok});function nk(r,t,e){let o=h(r,"inputIndices","sparseReshape","int32"),n=h(t,"inputShape","sparseReshape","int32"),s=h(e,"newShape","sparseReshape","int32");if(o.rank!==2)throw new Error(`Input indices should be Tensor2D but received shape
        ${o.shape}`);if(n.rank!==1)throw new Error(`Input shape should be Tensor1D but received shape ${n.shape}`);if(s.rank!==1)throw new Error(`New shape should be Tensor1D but received shape ${s.shape}`);let i={inputIndices:o,inputShape:n,newShape:s},a=w.runKernel(Zi,i);return{outputIndices:a[0],outputShape:a[1]}}var Eb=y({sparseReshape_:nk});function sk(r,t,e){let o=h(r,"data","sparseSegmentMean"),n=h(t,"indices","sparseSegmentMean","int32"),s=h(e,"segmentIds","sparseSegmentMean","int32");if(o.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.rank!==1)throw new Error(`Indices should be Tensor1D but received shape
          ${n.shape}`);if(s.rank!==1)throw new Error(`Segment ids should be Tensor1D but received shape
          ${s.shape}`);let i={data:o,indices:n,segmentIds:s};return w.runKernel(Qi,i)}var Ib=y({sparseSegmentMean_:sk});function ik(r,t,e){let o=h(r,"data","sparseSegmentSum"),n=h(t,"indices","sparseSegmentSum","int32"),s=h(e,"segmentIds","sparseSegmentSum","int32");if(o.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.rank!==1)throw new Error(`Indices should be Tensor1D but received shape
         ${n.shape}`);if(s.rank!==1)throw new Error(`Segment ids should be Tensor1D but received shape
         ${s.shape}`);let i={data:o,indices:n,segmentIds:s};return w.runKernel(Ji,i)}var Nb=y({sparseSegmentSum_:ik});function ak(r,t,e,o,n,s,i,a){let l=h(r,"data","stringNGrams","string");if(l.dtype!=="string")throw new Error("Data must be of datatype string");if(l.shape.length!==1)throw new Error(`Data must be a vector, saw: ${l.shape}`);let c=h(t,"dataSplits","stringNGrams");if(c.dtype!=="int32")throw new Error("Data splits must be of datatype int32");let u={separator:e,nGramWidths:o,leftPad:n,rightPad:s,padWidth:i,preserveShortSequences:a},p={data:l,dataSplits:c},m=w.runKernel(ra,p,u);return{nGrams:m[0],nGramsSplits:m[1]}}var kb=y({stringNGrams_:ak});function lk(r,t,e=!0){let o=h(r,"input","stringSplit","string"),n=h(t,"delimiter","stringSplit","string");if(o.rank!==1)throw new Error(`Input should be Tensor1D but received shape ${o.shape}`);if(n.rank!==0)throw new Error(`Delimiter should be a scalar but received shape ${n.shape}`);let s={skipEmpty:e},i={input:o,delimiter:n},a=w.runKernel(oa,i,s);return{indices:a[0],values:a[1],shape:a[2]}}var Rb=y({stringSplit_:lk});function ck(r,t){let e=h(r,"input","stringToHashBucketFast","string"),o={numBuckets:t};if(t<=0)throw new Error("Number of buckets must be at least 1");let n={input:e};return w.runKernel(na,n,o)}var Ab=y({stringToHashBucketFast_:ck});function uk(r,t,e,o=!0){let n=h(r,"input","staticRegexReplace","string"),s={pattern:t,rewrite:e,replaceGlobal:o};return w.runKernel(vo,{x:n},s)}var _b=y({staticRegexReplace_:uk});var pk={fft:Mn,ifft:Uo,rfft:Ln,irfft:fc},mk={hammingWindow:Xx,hannWindow:yc,frame:wc,stft:jx},fk={flipLeftRight:Zx,grayscaleToRGB:Qx,resizeNearestNeighbor:ub,resizeBilinear:cb,rgbToGrayscale:Jx,rotateWithOffset:tb,cropAndResize:Yx,nonMaxSuppression:eb,nonMaxSuppressionAsync:nb,nonMaxSuppressionWithScore:sb,nonMaxSuppressionWithScoreAsync:ib,nonMaxSuppressionPadded:ab,nonMaxSuppressionPaddedAsync:lb,threshold:pb,transform:mb},dk={bandPart:fb,gramSchmidt:db,qr:gb},hk={absoluteDifference:xb,computeWeightedLoss:Wt,cosineDistance:bb,hingeLoss:yb,huberLoss:wb,logLoss:Cb,meanSquaredError:vb,sigmoidCrossEntropy:$b,softmaxCrossEntropy:Sb},gk={sparseFillEmptyRows:Tb,sparseReshape:Eb,sparseSegmentMean:Ib,sparseSegmentSum:Nb},xk={stringNGrams:kb,stringSplit:Rb,stringToHashBucketFast:Ab,staticRegexReplace:_b};var Bm={};Lt(Bm,{Serializable:()=>_a,SerializationMap:()=>Sc,getRegisteredName:()=>yk,registerClass:()=>Lm});var bk=new Map,Mm=new Map,_a=class{getClassName(){return this.constructor.className}static fromConfig(t,e){return new t(e)}},Sc=class r{constructor(){this.classNameMap={}}static getMap(){return r.instance==null&&(r.instance=new r),r.instance}static register(t){r.getMap().classNameMap[t.className]=[t,t.fromConfig]}};function Lm(r,t,e){v(r.className!=null,()=>"Class being registered does not have the static className property defined."),v(typeof r.className=="string",()=>"className is required to be a string, but got type "+typeof r.className),v(r.className.length>0,()=>"Class being registered has an empty-string as its className, which is disallowed."),typeof t>"u"&&(t="Custom"),typeof e>"u"&&(e=r.className);let o=e,n=t+">"+o;return Sc.register(r),bk.set(n,r),Mm.set(r,n),r}function yk(r){return Mm.has(r)?Mm.get(r):r.className}var qt=class extends _a{minimize(t,e=!1,o){let{value:n,grads:s}=this.computeGradients(t,o);if(o!=null){let i=o.map(a=>({name:a.name,tensor:s[a.name]}));this.applyGradients(i)}else this.applyGradients(s);return St(s),e?n:(n.dispose(),null)}get iterations(){return this.iterations_==null&&(this.iterations_=0),this.iterations_}incrementIterations(){this.iterations_=this.iterations+1}computeGradients(t,e){return Xl(t,e)}dispose(){this.iterations_!=null&&St(this.iterations_)}async saveIterations(){return this.iterations_==null&&(this.iterations_=0),{name:"iter",tensor:H(this.iterations_,"int32")}}async getWeights(){throw new Error("getWeights() is not implemented for this optimizer yet.")}async setWeights(t){throw new Error(`setWeights() is not implemented for this optimizer class ${this.getClassName()}`)}async extractIterations(t){return this.iterations_=(await t[0].tensor.data())[0],t.slice(1)}};Object.defineProperty(qt,Symbol.hasInstance,{value:r=>r.minimize!=null&&r.computeGradients!=null&&r.applyGradients!=null});var Vr=class extends qt{static get className(){return"Adadelta"}constructor(t,e,o=null){super(),this.learningRate=t,this.rho=e,this.epsilon=o,this.accumulatedGrads=[],this.accumulatedUpdates=[],o==null&&(this.epsilon=w.backend.epsilon())}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=w.registeredVariables[o],i=!1;this.accumulatedGrads[n]==null&&(this.accumulatedGrads[n]={originalName:`${o}/accum_grad`,variable:at(()=>Nt(s).variable(i))}),this.accumulatedUpdates[n]==null&&(this.accumulatedUpdates[n]={originalName:`${o}/accum_var`,variable:at(()=>Nt(s).variable(i))});let a=Array.isArray(t)?t[n].tensor:t[o];if(a==null)return;let l=this.accumulatedGrads[n].variable,c=this.accumulatedUpdates[n].variable;at(()=>{let u=U(F(l,this.rho),F(Ft(a),1-this.rho)),p=F(Z(ee(U(c,this.epsilon)),ee(U(l,this.epsilon))),a),m=U(F(c,this.rho),F(Ft(p),1-this.rho));l.assign(u),c.assign(m);let f=U(F(p,-this.learningRate),s);s.assign(f)})}),this.incrementIterations()}dispose(){this.accumulatedUpdates!=null&&(St(this.accumulatedGrads.map(t=>t.variable)),St(this.accumulatedUpdates.map(t=>t.variable)))}async getWeights(){let t=[...this.accumulatedGrads,...this.accumulatedUpdates];return[await this.saveIterations()].concat(t.map(e=>({name:e.originalName,tensor:e.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=t.length/2,o=!1;this.accumulatedGrads=t.slice(0,e).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.accumulatedUpdates=t.slice(e,e*2).map(n=>({originalName:n.name,variable:n.tensor.variable(o)}))}getConfig(){return{learningRate:this.learningRate,rho:this.rho,epsilon:this.epsilon}}static fromConfig(t,e){return new t(e.learningRate,e.rho,e.epsilon)}};var Wr=class extends qt{static get className(){return"Adagrad"}constructor(t,e=.1){super(),this.learningRate=t,this.initialAccumulatorValue=e,this.accumulatedGrads=[]}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=w.registeredVariables[o];this.accumulatedGrads[n]==null&&(this.accumulatedGrads[n]={originalName:`${o}/accumulator`,variable:at(()=>Ye(s.shape,this.initialAccumulatorValue).variable(!1))});let i=Array.isArray(t)?t[n].tensor:t[o];if(i==null)return;let a=this.accumulatedGrads[n].variable;at(()=>{let l=U(a,Ft(i));a.assign(l);let c=U(F(Z(i,ee(U(l,w.backend.epsilon()))),-this.learningRate),s);s.assign(c)})}),this.incrementIterations()}dispose(){this.accumulatedGrads!=null&&St(this.accumulatedGrads.map(t=>t.variable))}async getWeights(){return[await this.saveIterations()].concat(this.accumulatedGrads.map(t=>({name:t.originalName,tensor:t.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=!1;this.accumulatedGrads=t.map(o=>({originalName:o.name,variable:o.tensor.variable(e)}))}getConfig(){return{learningRate:this.learningRate,initialAccumulatorValue:this.initialAccumulatorValue}}static fromConfig(t,e){return new t(e.learningRate,e.initialAccumulatorValue)}};var zr=class extends qt{static get className(){return"Adam"}constructor(t,e,o,n=null){super(),this.learningRate=t,this.beta1=e,this.beta2=o,this.epsilon=n,this.accumulatedFirstMoment=[],this.accumulatedSecondMoment=[],at(()=>{this.accBeta1=H(e).variable(),this.accBeta2=H(o).variable()}),n==null&&(this.epsilon=w.backend.epsilon())}applyGradients(t){let e=Array.isArray(t)?t.map(o=>o.name):Object.keys(t);at(()=>{let o=z(1,this.accBeta1),n=z(1,this.accBeta2);e.forEach((s,i)=>{let a=w.registeredVariables[s],l=!1;this.accumulatedFirstMoment[i]==null&&(this.accumulatedFirstMoment[i]={originalName:`${s}/m`,variable:at(()=>Nt(a).variable(l))}),this.accumulatedSecondMoment[i]==null&&(this.accumulatedSecondMoment[i]={originalName:`${s}/v`,variable:at(()=>Nt(a).variable(l))});let c=Array.isArray(t)?t[i].tensor:t[s];if(c==null)return;let u=this.accumulatedFirstMoment[i].variable,p=this.accumulatedSecondMoment[i].variable,m=U(F(u,this.beta1),F(c,1-this.beta1)),f=U(F(p,this.beta2),F(Ft(c),1-this.beta2)),d=Z(m,o),x=Z(f,n);u.assign(m),p.assign(f);let g=U(F(Z(d,U(ee(x),this.epsilon)),-this.learningRate),a);a.assign(g)}),this.accBeta1.assign(F(this.accBeta1,this.beta1)),this.accBeta2.assign(F(this.accBeta2,this.beta2))}),this.incrementIterations()}dispose(){this.accBeta1.dispose(),this.accBeta2.dispose(),this.accumulatedFirstMoment!=null&&St(this.accumulatedFirstMoment.map(t=>t.variable)),this.accumulatedSecondMoment!=null&&St(this.accumulatedSecondMoment.map(t=>t.variable))}async getWeights(){let t=[...this.accumulatedFirstMoment,...this.accumulatedSecondMoment];return[await this.saveIterations()].concat(t.map(e=>({name:e.originalName,tensor:e.variable})))}async setWeights(t){t=await this.extractIterations(t),at(()=>{this.accBeta1.assign(mr(this.beta1,this.iterations_+1)),this.accBeta2.assign(mr(this.beta2,this.iterations_+1))});let e=t.length/2,o=!1;this.accumulatedFirstMoment=t.slice(0,e).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.accumulatedSecondMoment=t.slice(e,e*2).map(n=>({originalName:n.name,variable:n.tensor.variable(o)}))}getConfig(){return{learningRate:this.learningRate,beta1:this.beta1,beta2:this.beta2,epsilon:this.epsilon}}static fromConfig(t,e){return new t(e.learningRate,e.beta1,e.beta2,e.epsilon)}};var Kr=class extends qt{static get className(){return"Adamax"}constructor(t,e,o,n=null,s=0){super(),this.learningRate=t,this.beta1=e,this.beta2=o,this.epsilon=n,this.decay=s,this.accumulatedFirstMoment=[],this.accumulatedWeightedInfNorm=[],at(()=>{this.iteration=H(0).variable(),this.accBeta1=H(e).variable()}),n==null&&(this.epsilon=w.backend.epsilon())}applyGradients(t){let e=Array.isArray(t)?t.map(o=>o.name):Object.keys(t);at(()=>{let o=z(1,this.accBeta1),n=Z(-this.learningRate,U(F(this.iteration,this.decay),1));e.forEach((s,i)=>{let a=w.registeredVariables[s],l=!1;this.accumulatedFirstMoment[i]==null&&(this.accumulatedFirstMoment[i]={originalName:`${s}/m`,variable:Nt(a).variable(l)}),this.accumulatedWeightedInfNorm[i]==null&&(this.accumulatedWeightedInfNorm[i]={originalName:`${s}/v`,variable:Nt(a).variable(l)});let c=Array.isArray(t)?t[i].tensor:t[s];if(c==null)return;let u=this.accumulatedFirstMoment[i].variable,p=this.accumulatedWeightedInfNorm[i].variable,m=U(F(u,this.beta1),F(c,1-this.beta1)),f=F(p,this.beta2),d=Dt(c),x=rc(f,d);u.assign(m),p.assign(x);let g=U(F(Z(n,o),Z(m,U(x,this.epsilon))),a);a.assign(g)}),this.iteration.assign(U(this.iteration,1)),this.accBeta1.assign(F(this.accBeta1,this.beta1))}),this.incrementIterations()}dispose(){this.accBeta1.dispose(),this.iteration.dispose(),this.accumulatedFirstMoment!=null&&St(this.accumulatedFirstMoment.map(t=>t.variable)),this.accumulatedWeightedInfNorm!=null&&St(this.accumulatedWeightedInfNorm.map(t=>t.variable))}async getWeights(){throw new Error("getWeights() is not implemented for Adamax yet.")}async setWeights(t){throw new Error("setWeights() is not implemented for Adamax yet.")}getConfig(){return{learningRate:this.learningRate,beta1:this.beta1,beta2:this.beta2,epsilon:this.epsilon,decay:this.decay}}static fromConfig(t,e){return new t(e.learningRate,e.beta1,e.beta2,e.epsilon,e.decay)}};var tr=class extends qt{static get className(){return"SGD"}constructor(t){super(),this.learningRate=t,this.setLearningRate(t)}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=Array.isArray(t)?t[n].tensor:t[o];if(s==null)return;let i=w.registeredVariables[o];at(()=>{let a=U(F(this.c,s),i);i.assign(a)})}),this.incrementIterations()}setLearningRate(t){this.learningRate=t,this.c!=null&&this.c.dispose(),this.c=im(H(-t))}dispose(){this.c.dispose()}async getWeights(){return[await this.saveIterations()]}async setWeights(t){if(t=await this.extractIterations(t),t.length!==0)throw new Error("SGD optimizer does not have settable weights.")}getConfig(){return{learningRate:this.learningRate}}static fromConfig(t,e){return new t(e.learningRate)}};var Hr=class extends tr{static get className(){return"Momentum"}constructor(t,e,o=!1){super(t),this.learningRate=t,this.momentum=e,this.useNesterov=o,this.accumulations=[],this.m=H(this.momentum)}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=w.registeredVariables[o];this.accumulations[n]==null&&(this.accumulations[n]={originalName:`${o}/momentum`,variable:at(()=>Nt(s).variable(!1))});let i=this.accumulations[n].variable,a=Array.isArray(t)?t[n].tensor:t[o];a!=null&&at(()=>{let l,c=U(F(this.m,i),a);this.useNesterov?l=U(F(this.c,U(a,F(c,this.m))),s):l=U(F(this.c,c),s),i.assign(c),s.assign(l)})}),this.incrementIterations()}dispose(){this.m.dispose(),this.accumulations!=null&&St(this.accumulations.map(t=>t.variable))}setMomentum(t){this.momentum=t}async getWeights(){return[await this.saveIterations()].concat(this.accumulations.map(t=>({name:t.originalName,tensor:t.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=!1;this.accumulations=t.map(o=>({originalName:o.name,variable:o.tensor.variable(e)}))}getConfig(){return{learningRate:this.learningRate,momentum:this.momentum,useNesterov:this.useNesterov}}static fromConfig(t,e){return new t(e.learningRate,e.momentum,e.useNesterov)}};var qr=class extends qt{static get className(){return"RMSProp"}constructor(t,e=.9,o=0,n=null,s=!1){if(super(),this.learningRate=t,this.decay=e,this.momentum=o,this.epsilon=n,this.accumulatedMeanSquares=[],this.accumulatedMoments=[],this.accumulatedMeanGrads=[],this.centered=s,n==null&&(this.epsilon=w.backend.epsilon()),t==null)throw new Error("learningRate for RMSPropOptimizer must be defined.")}applyGradients(t){(Array.isArray(t)?t.map(o=>o.name):Object.keys(t)).forEach((o,n)=>{let s=w.registeredVariables[o],i=!1;this.accumulatedMeanSquares[n]==null&&(this.accumulatedMeanSquares[n]={originalName:`${o}/rms`,variable:at(()=>Nt(s).variable(i))}),this.accumulatedMoments[n]==null&&(this.accumulatedMoments[n]={originalName:`${o}/momentum`,variable:at(()=>Nt(s).variable(i))}),this.accumulatedMeanGrads[n]==null&&this.centered&&(this.accumulatedMeanGrads[n]={originalName:`${o}/mg`,variable:at(()=>Nt(s).variable(i))});let a=Array.isArray(t)?t[n].tensor:t[o];if(a==null)return;let l=this.accumulatedMeanSquares[n].variable,c=this.accumulatedMoments[n].variable;at(()=>{let u=U(F(l,this.decay),F(Ft(a),1-this.decay));if(this.centered){let p=this.accumulatedMeanGrads[n].variable,m=U(F(p,this.decay),F(a,1-this.decay)),f=Z(F(a,this.learningRate),ee(z(u,U(Ft(m),this.epsilon)))),d=U(F(c,this.momentum),f);l.assign(u),p.assign(m),c.assign(d);let x=z(s,d);s.assign(x)}else{let p=U(F(l,this.decay),F(Ft(a),1-this.decay)),m=U(F(c,this.momentum),Z(F(a,this.learningRate),ee(U(p,this.epsilon))));l.assign(p),c.assign(m);let f=z(s,m);s.assign(f)}})}),this.incrementIterations()}dispose(){this.accumulatedMeanSquares!=null&&St(this.accumulatedMeanSquares.map(t=>t.variable)),this.accumulatedMeanGrads!=null&&this.centered&&St(this.accumulatedMeanGrads.map(t=>t.variable)),this.accumulatedMoments!=null&&St(this.accumulatedMoments.map(t=>t.variable))}async getWeights(){let t=[...this.accumulatedMeanSquares,...this.accumulatedMoments];return this.centered&&t.push(...this.accumulatedMeanGrads),[await this.saveIterations()].concat(t.map(e=>({name:e.originalName,tensor:e.variable})))}async setWeights(t){t=await this.extractIterations(t);let e=this.centered?t.length/3:t.length/2,o=!1;this.accumulatedMeanSquares=t.slice(0,e).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.accumulatedMoments=t.slice(e,e*2).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})),this.centered&&(this.accumulatedMeanGrads=t.slice(e*2,e*3).map(n=>({originalName:n.name,variable:n.tensor.variable(o)})))}getConfig(){return{learningRate:this.learningRate,decay:this.decay,momentum:this.momentum,epsilon:this.epsilon,centered:this.centered}}static fromConfig(t,e){return new t(e.learningRate,e.decay,e.momentum,e.epsilon,e.centered)}};var wk=[Vr,Wr,zr,Kr,Hr,qr,tr];function Db(){for(let r of wk)Lm(r)}var Hm={};Lt(Hm,{CompositeArrayBuffer:()=>Ut,browserFiles:()=>Pb,browserHTTPRequest:()=>Bb,concatenateArrayBuffers:()=>jd,copyModel:()=>ch,decodeWeights:()=>Nl,decodeWeightsStream:()=>Hd,encodeWeights:()=>zd,fromMemory:()=>Gb,fromMemorySync:()=>Km,getLoadHandlers:()=>Jd,getModelArtifactsForJSON:()=>Rn,getModelArtifactsForJSONSync:()=>mm,getModelArtifactsInfoForJSON:()=>ze,getSaveHandlers:()=>Qd,getWeightSpecs:()=>va,http:()=>Ec,isHTTPScheme:()=>Tc,listModels:()=>ah,loadWeights:()=>Mb,moveModel:()=>uh,registerLoadRouter:()=>Zd,registerSaveRouter:()=>Yd,removeModel:()=>lh,weightsLoaderFactory:()=>Wm,withSaveHandler:()=>Ub,withSaveHandlerSync:()=>Vb});var Ck="model",vk=".json",$k=".weights.bin";function Fb(r){return new Promise(t=>setTimeout(t)).then(r)}var Wn=class r{constructor(t){if(!I().getBool("IS_BROWSER"))throw new Error("browserDownloads() cannot proceed because the current environment is not a browser.");t.startsWith(r.URL_SCHEME)&&(t=t.slice(r.URL_SCHEME.length)),(t==null||t.length===0)&&(t=Ck),this.modelJsonFileName=t+vk,this.weightDataFileName=t+$k}async save(t){if(typeof document>"u")throw new Error("Browser downloads are not supported in this environment since `document` is not present");let e=Ut.join(t.weightData),o=window.URL.createObjectURL(new Blob([e],{type:"application/octet-stream"}));if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserDownloads.save() does not support saving model topology in binary formats yet.");{let n=[{paths:["./"+this.weightDataFileName],weights:t.weightSpecs}],s=kl(t,n),i=window.URL.createObjectURL(new Blob([JSON.stringify(s)],{type:"application/json"})),a=this.modelJsonAnchor==null?document.createElement("a"):this.modelJsonAnchor;if(a.download=this.modelJsonFileName,a.href=i,await Fb(()=>a.dispatchEvent(new MouseEvent("click"))),t.weightData!=null){let l=this.weightDataAnchor==null?document.createElement("a"):this.weightDataAnchor;l.download=this.weightDataFileName,l.href=o,await Fb(()=>l.dispatchEvent(new MouseEvent("click")))}return{modelArtifactsInfo:ze(t)}}}};Wn.URL_SCHEME="downloads://";var Gm=class{constructor(t){if(t==null||t.length<1)throw new Error(`When calling browserFiles, at least 1 file is required, but received ${t}`);this.jsonFile=t[0],this.weightsFiles=t.slice(1)}async load(){return new Promise((t,e)=>{let o=new FileReader;o.onload=n=>{let s=JSON.parse(n.target.result),i=s.modelTopology;if(i==null){e(new Error(`modelTopology field is missing from file ${this.jsonFile.name}`));return}if(s.weightsManifest==null){e(new Error(`weightManifest field is missing from file ${this.jsonFile.name}`));return}if(this.weightsFiles.length===0){t({modelTopology:i});return}let l=Rn(s,c=>this.loadWeights(c));t(l)},o.onerror=n=>e(`Failed to read model topology and weights manifest JSON from file '${this.jsonFile.name}'. BrowserFiles supports loading Keras-style tf.Model artifacts only.`),o.readAsText(this.jsonFile)})}loadWeights(t){let e=[],o=[];for(let i of t)e.push(...i.weights),o.push(...i.paths);let n=this.checkManifestAndWeightFiles(t),s=o.map(i=>this.loadWeightsFile(i,n[i]));return Promise.all(s).then(i=>[e,i])}loadWeightsFile(t,e){return new Promise((o,n)=>{let s=new FileReader;s.onload=i=>{let a=i.target.result;o(a)},s.onerror=i=>n(`Failed to weights data from file of path '${t}'.`),s.readAsArrayBuffer(e)})}checkManifestAndWeightFiles(t){let e=[],o=this.weightsFiles.map(s=>pm(s.name)),n={};for(let s of t)s.paths.forEach(i=>{let a=pm(i);if(e.indexOf(a)!==-1)throw new Error(`Duplicate file basename found in weights manifest: '${a}'`);if(e.push(a),o.indexOf(a)===-1)throw new Error(`Weight file with basename '${a}' is not provided.`);n[i]=this.weightsFiles[o.indexOf(a)]});if(e.length!==this.weightsFiles.length)throw new Error(`Mismatch in the number of files in weights manifest (${e.length}) and the number of weight files provided (${this.weightsFiles.length}).`);return n}},Sk=r=>I().getBool("IS_BROWSER")&&!Array.isArray(r)&&r.startsWith(Wn.URL_SCHEME)?Tk(r.slice(Wn.URL_SCHEME.length)):null;kt.registerSaveRouter(Sk);function Tk(r="model"){return new Wn(r)}function Pb(r){return new Gm(r)}function Um(r,t,e,o){i(r),e=e??0,o=o??1,a(e,o);let n=0,s=l=>(l.then(c=>{let u=e+ ++n/r.length*(o-e);return t(u),c}),l);function i(l){v(l!=null&&Array.isArray(l)&&l.length>0,()=>"promises must be a none empty array")}function a(l,c){v(l>=0&&l<=1,()=>`Progress fraction must be in range [0, 1], but got startFraction ${l}`),v(c>=0&&c<=1,()=>`Progress fraction must be in range [0, 1], but got endFraction ${c}`),v(c>=l,()=>`startFraction must be no more than endFraction, but got startFraction ${l} and endFraction ${c}`)}return Promise.all(r.map(s))}async function Vm(r,t){t==null&&(t={});let e=t.fetchFunc==null?I().platform.fetch:t.fetchFunc,o=r.map(p=>e(p,t.requestInit,{isBinary:!0})),a=(t.onProgress==null?await Promise.all(o):await Um(o,t.onProgress,0,.5)).map(p=>p.arrayBuffer());return t.onProgress==null?await Promise.all(a):await Um(a,t.onProgress,.5,1)}function Ob(r,t){var e;let o=t.fetchFunc==null?I().platform.fetch:t.fetchFunc,n=0,s;return(e=t.onProgress)===null||e===void 0||e.call(t,0),new ReadableStream({pull:async i=>{for(var a;n<r.length;){s||(s=(await o(r[n],t.requestInit,{isBinary:!0})).body.getReader());let{done:l,value:c}=await s.read();if(l){n++,s=void 0,(a=t.onProgress)===null||a===void 0||a.call(t,n/r.length);continue}i.enqueue(c);return}i.close()}})}async function Mb(r,t="",e,o){return Wm(i=>Vm(i,{requestInit:o}))(r,t,e)}function Wm(r){return async(t,e="",o)=>{let n=t.map(()=>!1),s={},i=o!=null?o.map(()=>!1):[],a=[];if(t.forEach((f,d)=>{let x=0;f.weights.forEach(g=>{let b="quantization"in g?g.quantization.dtype:g.dtype,$=lr[b]*X(g.shape),S=()=>{n[d]=!0,s[d]==null&&(s[d]=[]),s[d].push({manifestEntry:g,groupOffset:x,sizeBytes:$})};o!=null?o.forEach((E,N)=>{E===g.name&&(S(),i[N]=!0)}):S(),a.push(g.name),x+=$})}),!i.every(f=>f)){let f=o.filter((d,x)=>!i[x]);throw new Error(`Could not find weights in manifest with names: ${f.join(", ")}. 
Manifest JSON has weights with names: ${a.join(", ")}.`)}let l=n.reduce((f,d,x)=>(d&&f.push(x),f),[]),c=[];l.forEach(f=>{t[f].paths.forEach(d=>{let x=e+(e.endsWith("/")?"":"/")+d;c.push(x)})});let u=await r(c),p={},m=0;return l.forEach(f=>{let d=t[f].paths.length,x=new Ut(u.slice(m,m+d));s[f].forEach(b=>{let $=x.slice(b.groupOffset,b.groupOffset+b.sizeBytes),S=Nl($,[b.manifestEntry]);for(let E in S)p[E]=S[E]}),m+=d}),p}}var Ek="application/octet-stream",Ik="application/json",Da=class{constructor(t,e){if(this.DEFAULT_METHOD="POST",e==null&&(e={}),this.weightPathPrefix=e.weightPathPrefix,this.weightUrlConverter=e.weightUrlConverter,e.fetchFunc!=null?(v(typeof e.fetchFunc=="function",()=>"Must pass a function that matches the signature of `fetch` (see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)"),this.fetch=e.fetchFunc):this.fetch=I().platform.fetch,v(t!=null&&t.length>0,()=>"URL path for http must not be null, undefined or empty."),Array.isArray(t)&&v(t.length===2,()=>`URL paths for http must have a length of 2, (actual length is ${t.length}).`),this.path=t,e.requestInit!=null&&e.requestInit.body!=null)throw new Error("requestInit is expected to have no pre-existing body, but has one.");this.requestInit=e.requestInit||{},this.loadOptions=e}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserHTTPRequest.save() does not support saving model topology in binary formats yet.");let e=Object.assign({method:this.DEFAULT_METHOD},this.requestInit);e.body=new FormData;let o=[{paths:["./model.weights.bin"],weights:t.weightSpecs}],n=kl(t,o);if(e.body.append("model.json",new Blob([JSON.stringify(n)],{type:Ik}),"model.json"),t.weightData!=null){let i=Ut.join(t.weightData);e.body.append("model.weights.bin",new Blob([i],{type:Ek}),"model.weights.bin")}let s=await this.fetch(this.path,e);if(s.ok)return{modelArtifactsInfo:ze(t),responses:[s]};throw new Error(`BrowserHTTPRequest.save() failed due to HTTP response status ${s.status}.`)}async loadModelJSON(){let t=await this.fetch(this.path,this.requestInit);if(!t.ok)throw new Error(`Request to ${this.path} failed with status code ${t.status}. Please verify this URL points to the model JSON of the model to load.`);let e;try{e=await t.json()}catch{let i=`Failed to parse model JSON of response from ${this.path}.`;throw this.path.endsWith(".pb")?i+=" Your path contains a .pb file extension. Support for .pb models have been removed in TensorFlow.js 1.0 in favor of .json models. You can re-convert your Python TensorFlow model using the TensorFlow.js 1.0 conversion scripts or you can convert your.pb models with the 'pb2json'NPM script in the tensorflow/tfjs-converter repository.":i+=" Please make sure the server is serving valid JSON for this request.",new Error(i)}let o=e.modelTopology,n=e.weightsManifest;if(o==null&&n==null)throw new Error(`The JSON from HTTP path ${this.path} contains neither model topology or manifest for weights.`);return e}async load(){if(this.loadOptions.streamWeights)return this.loadStream();let t=await this.loadModelJSON();return Rn(t,e=>this.loadWeights(e))}async loadStream(){let t=await this.loadModelJSON(),e=await this.getWeightUrls(t.weightsManifest),o=va(t.weightsManifest),n=()=>Ob(e,this.loadOptions);return Object.assign(Object.assign({},t),{weightSpecs:o,getWeightStream:n})}async getWeightUrls(t){let e=Array.isArray(this.path)?this.path[1]:this.path,[o,n]=Nk(e),s=this.weightPathPrefix||o,i=[],a=[];for(let l of t)for(let c of l.paths)this.weightUrlConverter!=null?a.push(this.weightUrlConverter(c)):i.push(s+c+n);return this.weightUrlConverter&&i.push(...await Promise.all(a)),i}async loadWeights(t){let e=await this.getWeightUrls(t),o=va(t),n=await Vm(e,this.loadOptions);return[o,n]}};Da.URL_SCHEME_REGEX=/^https?:\/\//;function Nk(r){let t=r.lastIndexOf("/"),e=r.lastIndexOf("?"),o=r.substring(0,t),n=e>t?r.substring(e):"";return[o+"/",n]}function Tc(r){return r.match(Da.URL_SCHEME_REGEX)!=null}var Lb=(r,t)=>{if(typeof fetch>"u"&&(t==null||t.fetchFunc==null))return null;{let e=!0;if(Array.isArray(r)?e=r.every(o=>Tc(o)):e=Tc(r),e)return Ec(r,t)}return null};kt.registerSaveRouter(Lb);kt.registerLoadRouter(Lb);function Ec(r,t){return new Da(r,t)}function Bb(r,t){return Ec(r,t)}var Fa=class{constructor(t){this.modelArtifacts=t}load(){return this.modelArtifacts}},Ic=class{constructor(t){this.saveHandler=t}save(t){return this.saveHandler(t)}},zm=class{constructor(t){t.load&&(this.load=()=>Promise.resolve(t.load())),t.save&&(this.save=e=>Promise.resolve(t.save(e)))}};function Gb(r,t,e,o){let n=arguments;return new zm(Km(...n))}function Km(r,t,e,o){return arguments.length===1?r.modelTopology!=null||r.weightSpecs!=null?new Fa(r):(console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new Fa({modelTopology:r})):(console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new Fa({modelTopology:r,weightSpecs:t,weightData:e,trainingConfig:o}))}function Ub(r){return new Ic(r)}function Vb(r){return new Ic(r)}var qm={};Lt(qm,{confusionMatrix:()=>Wb});function kk(r,t,e){let o=h(r,"labels","confusionMatrix"),n=h(t,"predictions","confusionMatrix");v(e==null||e>0&&Number.isInteger(e),()=>`If provided, numClasses must be a positive integer, but got ${e}`),v(o.rank===1,()=>`Expected the rank of labels to be 1, but got ${o.rank}`),v(n.rank===1,()=>`Expected the rank of predictions to be 1, but got ${n.rank}`),v(o.shape[0]===n.shape[0],()=>`Mismatch in the number of examples: ${o.shape[0]} vs. ${n.shape[0]}. Labels and predictions should have the same number of elements.`),v(e>0&&Number.isInteger(e),()=>`numClasses is required to be a positive integer, but got ${e}`);let s=ka(Y(o,"int32"),e),i=ka(Y(n,"int32"),e),a=Vn(s),l=Q(a,i);return Y(l,"int32")}var Wb=y({confusionMatrix_:kk});var Xm={};Lt(Xm,{draw:()=>Mk,fromPixels:()=>Lk,fromPixelsAsync:()=>Fk,toPixels:()=>Ok});var Ho,zb=!1;function Kb(r,t=3){if(t>4)throw new Error("Cannot construct Tensor with more than 4 channels from pixels.");if(r==null)throw new Error("pixels passed to tf.browser.fromPixels() can not be null");let e=!1,o=!1,n=!1,s=!1,i=!1,a=!1;if(r.data instanceof Uint8Array)e=!0;else if(typeof ImageData<"u"&&r instanceof ImageData)o=!0;else if(typeof HTMLVideoElement<"u"&&r instanceof HTMLVideoElement)n=!0;else if(typeof HTMLImageElement<"u"&&r instanceof HTMLImageElement)s=!0;else if(r.getContext!=null)i=!0;else if(typeof ImageBitmap<"u"&&r instanceof ImageBitmap)a=!0;else throw new Error(`pixels passed to tf.browser.fromPixels() must be either an HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, ImageData in browser, or OffscreenCanvas, ImageData in webworker or {data: Uint32Array, width: number, height: number}, but was ${r.constructor.name}`);if(To(wn,w.backendName)!=null){let d={pixels:r},x={numChannels:t};return w.runKernel(wn,d,x)}let[c,u]=n?[r.videoWidth,r.videoHeight]:[r.width,r.height],p;if(i)p=r.getContext("2d").getImageData(0,0,c,u).data;else if(o||e)p=r.data;else if(s||n||a){if(Ho==null)if(typeof document>"u")if(typeof OffscreenCanvas<"u"&&typeof OffscreenCanvasRenderingContext2D<"u")Ho=new OffscreenCanvas(1,1).getContext("2d");else throw new Error("Cannot parse input in current context. Reason: OffscreenCanvas Context2D rendering is not supported.");else Ho=document.createElement("canvas").getContext("2d",{willReadFrequently:!0});Ho.canvas.width=c,Ho.canvas.height=u,Ho.drawImage(r,0,0,c,u),p=Ho.getImageData(0,0,c,u).data}let m;if(t===4)m=new Int32Array(p);else{let d=c*u;m=new Int32Array(d*t);for(let x=0;x<d;x++)for(let g=0;g<t;++g)m[x*t+g]=p[x*4+g]}return gc(m,[u,c,t],"int32")}function Rk(r){return r!=null&&r.data instanceof Uint8Array}function Ak(){return typeof window<"u"&&typeof ImageBitmap<"u"&&window.hasOwnProperty("createImageBitmap")}function _k(r){return r!=null&&r.width!==0&&r.height!==0}function Dk(r){return Ak()&&!(r instanceof ImageBitmap)&&_k(r)&&!Rk(r)}async function Fk(r,t=3){let e=null;if(I().getBool("WRAP_TO_IMAGEBITMAP")&&Dk(r)){let o;try{o=await createImageBitmap(r,{premultiplyAlpha:"none"})}catch{o=null}o!=null&&o.width===r.width&&o.height===r.height?e=o:e=r}else e=r;return Kb(e,t)}function Hb(r){if(r.rank!==2&&r.rank!==3)throw new Error(`toPixels only supports rank 2 or 3 tensors, got rank ${r.rank}.`);let t=r.rank===2?1:r.shape[2];if(t>4||t===2)throw new Error(`toPixels only supports depth of size 1, 3 or 4 but got ${t}`);if(r.dtype!=="float32"&&r.dtype!=="int32")throw new Error(`Unsupported type for toPixels: ${r.dtype}. Please use float32 or int32 tensors.`)}function Pk(r){let t=r?.alpha||1;if(t>1||t<0)throw new Error(`Alpha value ${t} is suppoed to be in range [0 - 1].`)}async function Ok(r,t){let e=h(r,"img","toPixels");if(!(r instanceof lt)){let c=e;e=Y(c,"int32"),c.dispose()}Hb(e);let[o,n]=e.shape.slice(0,2),s=e.rank===2?1:e.shape[2],i=await e.data(),a=e.dtype==="float32"?255:1,l=new Uint8ClampedArray(n*o*4);for(let c=0;c<o*n;++c){let u=[0,0,0,255];for(let m=0;m<s;m++){let f=i[c*s+m];if(e.dtype==="float32"){if(f<0||f>1)throw new Error(`Tensor values for a float32 Tensor must be in the range [0 - 1] but encountered ${f}.`)}else if(e.dtype==="int32"&&(f<0||f>255))throw new Error(`Tensor values for a int32 Tensor must be in the range [0 - 255] but encountered ${f}.`);s===1?(u[0]=f*a,u[1]=f*a,u[2]=f*a):u[m]=f*a}let p=c*4;l[p+0]=Math.round(u[0]),l[p+1]=Math.round(u[1]),l[p+2]=Math.round(u[2]),l[p+3]=Math.round(u[3])}if(t!=null){zb||To(sl,w.backendName)!=null&&(console.warn("tf.browser.toPixels is not efficient to draw tensor on canvas. Please try tf.browser.draw instead."),zb=!0),t.width=n,t.height=o;let c=t.getContext("2d"),u=new ImageData(l,n,o);c.putImageData(u,0,0)}return e!==r&&e.dispose(),l}function Mk(r,t,e){let o=h(r,"img","draw");if(!(r instanceof lt)){let i=o;o=Y(i,"int32"),i.dispose()}Hb(o),Pk(e?.imageOptions);let n={image:o},s={canvas:t,options:e};w.runKernel(sl,n,s)}var Lk=y({fromPixels_:Kb});var jm={};Lt(jm,{prepareAndValidate:()=>qb});function qb(r,t){let e=r.shape.length,o=t.shape.length;if(e<1)throw new Error(`tf.gatherND() expects the input to be rank 1 or higher, but the rank was ${e}.`);if(o<1)throw new Error(`tf.gatherND() expects the indices to be rank 1 or higher, but the rank was ${o}.`);if(t.dtype!=="int32")throw new Error(`tf.gatherND() expects the indices to be int32 type, but the dtype was ${t.dtype}.`);if(t.shape[o-1]>e)throw new Error(`index innermost dimension length must be <= tensor rank; saw: ${t.shape[o-1]} vs. ${e}`);if(X(r.shape)===0)throw new Error(`Requested more than 0 entries, but input is empty. Input shape: ${r.shape}.`);let n=t.shape,s=n[n.length-1],i=1;for(let p=0;p<n.length-1;++p)i*=n[p];let a=r.shape,l=n.slice();l.pop();let c=1;for(let p=s;p<e;++p)c*=a[p],l.push(a[p]);let u=[...Be(r.shape).map(p=>p/c),1].slice(0,s);return[l,i,c,u]}var Zt={};Lt(Zt,{assertParamsValid:()=>Gk,computeFlatOffset:()=>Kk,computeOutShape:()=>Vk,getNormalizedAxes:()=>Wk,isSliceContinous:()=>zk,maskToAxes:()=>Uk,parseSliceParams:()=>Hk,sliceInfo:()=>qk,startForAxis:()=>e0,startIndicesWithElidedDims:()=>Qb,stopForAxis:()=>r0,stopIndicesWithElidedDims:()=>Jb,stridesForAxis:()=>t0,stridesWithElidedDims:()=>jb});var Ym=-2,Bk=-1;function Gk(r,t,e){let o=r.shape.length;v(o===t.length,()=>`Error in slice${o}D: Length of begin ${t} must match the rank of the array (${o}).`),v(o===e.length,()=>`Error in slice${o}D: Length of size ${e} must match the rank of the array (${o}).`);for(let n=0;n<o;++n)v(t[n]+e[n]<=r.shape[n],()=>`Error in slice${o}D: begin[${n}] + size[${n}] (${t[n]+e[n]}) would overflow input.shape[${n}] (${r.shape[n]})`)}function Uk(r){let t=[],e=0;for(;r>0;)r&1&&t.push(e),r/=2,e++;return t}function Vk(r,t,e){let o=[];for(let n=0;n<r.length;n++)o[n]=Math.ceil((t[n]-r[n])/e[n]);return o}function jb(r,t,e,o){let n=[...r];for(let s=n.length;s<o.length;s++)n.push(1);for(let s=0;s<e;s++)s===0?n[t]=1:(n.splice(t,0,1),n.pop());return n}function Yb(r,t,e){return e<=r?e:e-(t-1)}function Zb(r,t){let e=[];for(let o=0;o<r;o++)e.push(t+o);return e}function Wk(r,t,e,o,n,s,i,a,l){let c=r.length,u=new Array(c),p=new Array(c),m=new Array(c);if(t.length&&e>0){let f=t[0],d=e+1;u=Qb(i,f,d,o,r),p=Jb(a,f,d,n,r),m=jb(s,f,d,r)}else for(let f=0;f<c;f++)u[f]=e0(i,o,s,r,f,l),p[f]=r0(a,n,s,r,f,l),m[f]=t0(s,f,l);return{begin:u,end:p,strides:m}}function Qb(r,t,e,o,n){let s=[...n],i=Zb(e,t);for(let a=0;a<s.length;a++)if(i.indexOf(a)>-1)s[a]=0;else{let l=Yb(t,e,a),c=o[l];r&1<<l&&(c=0),s[a]=c}return s}function Jb(r,t,e,o,n){let s=[...n],i=Zb(e,t);for(let a=0;a<s.length;a++)if(i.indexOf(a)>-1)s[a]=Number.MAX_SAFE_INTEGER;else{let l=Yb(t,e,a),c=o[l];r&1<<l&&(c=Number.MAX_SAFE_INTEGER),s[a]=c}for(let a=0;a<s.length;a++){let l=n[a];s[a]<0&&(s[a]+=l),s[a]=an(0,s[a],n[a])}return s}function t0(r,t,e){let o=r[t];return(e&1<<t||o==null)&&(o=1),o}function e0(r,t,e,o,n,s){let i=t[n],a=e[n]||1;(r&1<<n||s&1<<n||i==null)&&(a>0?i=Number.MIN_SAFE_INTEGER:i=Number.MAX_SAFE_INTEGER);let l=o[n];return i<0&&(i+=l),i=an(0,i,l-1),i}function r0(r,t,e,o,n,s){let i=t[n],a=e[n]||1;(r&1<<n||s&1<<n||i==null)&&(a>0?i=Number.MAX_SAFE_INTEGER:i=Number.MIN_SAFE_INTEGER);let l=o[n];return i<0&&(i+=l),a>0?i=an(0,i,l):i=an(-1,i,l-1),i}function zk(r,t,e){let o=e.length;for(let n=0;n<e.length;n++)if(e[n]>1){o=n;break}for(let n=o+1;n<e.length;n++)if(t[n]>0||e[n]!==r[n])return!1;return!0}function Kk(r,t){let e=r.length>0?r[r.length-1]:1;for(let o=0;o<r.length-1;o++)e+=r[o]*t[o];return e}function Hk(r,t,e){let o,n=r.shape.length;typeof t=="number"?o=[t,...new Array(n-1).fill(0)]:t.length<n?o=t.concat(new Array(n-t.length).fill(0)):o=t.slice(),o.forEach(i=>{v(i!==-1,()=>"slice() does not support negative begin indexing.")});let s;return e==null?s=new Array(n).fill(-1):typeof e=="number"?s=[e,...new Array(n-1).fill(-1)]:e.length<n?s=e.concat(new Array(n-e.length).fill(-1)):s=e,s=s.map((i,a)=>i>=0?i:(v(i===-1,()=>`Negative size values should be exactly -1 but got ${i} for the slice() size at index ${a}.`),r.shape[a]-o[a])),[o,s]}function qk(r,t,e,o,n,s,i,a,l){let c;if(o==null?(c=new Array(t.length),c.fill(1)):c=o,i!=null&&(i&i-1)!==0)throw new Error("Multiple ellipses in slice is not allowed.");let u=!1,p={dims:c.length,numAddAxisAfterEllipsis:0,begin:t.slice(),end:e.slice(),strides:c.slice(),beginMask:n,endMask:s,ellipsisMask:i,newAxisMask:a,shrinkAxisMask:l};for(let S=0;S<p.dims;S++)u&&(1<<S&a)!==0&&p.numAddAxisAfterEllipsis++,1<<S&i&&(u=!0);u||(p.ellipsisMask|=1<<p.dims,p.dims++);let m={dims:r.length,beginMask:0,endMask:0,beginValid:!1,endValid:!1};Xk(p,m);let f=!0,d=!0,x=!0,g=[],b=[];for(let S=0;S<r.length;++S){if(m.strides[S]===0)throw Error(`strides[${S}] must be non-zero`);let E=!!(m.shrinkAxisMask&1<<S),N=r[S];if(N===-1){g.push(E?1:-1);continue}let R=[m.beginMask&1<<S,m.endMask&1<<S],A=[m.strides[S]>0?0:-1,m.strides[S]>0?N:N-1];if(E&&m.strides[S]<=0)throw Error("only stride 1 allowed on non-range indexing.");x=x&&m.strides[S]===1;let _=!!(m.beginMask&1<<S&&m.endMask&1<<S);if(m.beginValid&&m.endValid){if(E){let W=m.begin[S]<0?N+m.begin[S]:m.begin[S];if(m.begin[S]=W,m.end[S]=m.begin[S]+1,W<0||W>=N)throw Error(`slice index ${m.begin[S]} of dimension ${S} out of bounds.`)}else m.begin[S]=Xb(m.begin[S],0,m.strides[S],N,R,A),m.end[S]=Xb(m.end[S],1,m.strides[S],N,R,A);let B=m.strides[S]===1&&m.begin[S]===0&&m.end[S]===N;f=f&&B,d=d&&(S===0&&m.strides[S]===1||B)}else f=f&&m.strides[S]===1&&_,d=d&&(S===0&&m.strides[S]===1||_);let P,O=!1;if(m.beginValid&&m.endValid?(P=m.end[S]-m.begin[S],O=!0):E?(P=1,O=!0):_&&N>=0&&(m.strides[S]<0?P=-N:P=N,O=!0),O){let B;P===0||P<0!=m.strides[S]<0?B=0:B=Math.trunc(P/m.strides[S])+(P%m.strides[S]!==0?1:0),g.push(B)}else g.push(-1)}for(let S=0;S<m.finalShapeGatherIndices.length;++S){let E=m.finalShapeGatherIndices[S];E>=0?b.push(g[E]):E===Ym&&b.push(1)}return{finalShapeSparse:b.filter((S,E)=>m.finalShapeGatherIndices[E]!==Ym),finalShape:b,isIdentity:f,sliceDim0:d,isSimpleSlice:x,begin:m.begin,end:m.end,strides:m.strides}}function Xk(r,t){t.beginMask=0,t.endMask=0,t.shrinkAxisMask=0;let e=0;t.beginValid=r.begin!=null,t.endValid=r.end!=null,t.begin=new Array(t.dims),t.end=new Array(t.dims),t.strides=new Array(t.dims),t.finalShapeGatherIndices=[],t.finalShapeGatherIndicesSparse=[],t.inputShapeGatherIndicesSparse=new Array(t.dims);for(let o=0;o<r.dims;o++)if(1<<o&r.ellipsisMask){let n=Math.min(t.dims-(r.dims-o)+1+r.numAddAxisAfterEllipsis,t.dims);for(;e<n;e++)t.begin[e]=0,t.end[e]=0,t.strides[e]=1,t.beginMask|=1<<e,t.endMask|=1<<e,t.finalShapeGatherIndices.push(e),t.finalShapeGatherIndicesSparse.push(-1),t.inputShapeGatherIndicesSparse[e]=o}else if(1<<o&r.newAxisMask)t.finalShapeGatherIndices.push(Ym),t.finalShapeGatherIndicesSparse.push(-1);else{if(e===t.begin.length)throw Error(`Index out of range using input dim ${e}; input has only ${t.dims} dims, ${t.begin.length}.`);r.begin!=null&&(t.begin[e]=r.begin[o]),r.end!=null&&(t.end[e]=r.end[o]),t.strides[e]=r.strides[o],r.beginMask&1<<o&&(t.beginMask|=1<<e),r.endMask&1<<o&&(t.endMask|=1<<e),r.shrinkAxisMask&1<<o?(t.finalShapeGatherIndices.push(Bk),t.finalShapeGatherIndicesSparse.push(-1),t.shrinkAxisMask|=1<<e):(t.finalShapeGatherIndices.push(e),t.finalShapeGatherIndicesSparse.push(o)),t.inputShapeGatherIndicesSparse[e]=o,e++}}function Xb(r,t,e,o,n,s){if(n[t])return e>0?s[t]:s[t+1&1];{let i=r<0?o+r:r;return i<s[0]?s[0]:i>s[1]?s[1]:i}}var o0="4.22.0";var zn=class{static sgd(t){return new tr(t)}static momentum(t,e,o=!1){return new Hr(t,e,o)}static rmsprop(t,e=.9,o=0,n=null,s=!1){return new qr(t,e,o,n,s)}static adam(t=.001,e=.9,o=.999,n=null){return new zr(t,e,o,n)}static adadelta(t=.001,e=.95,o=null){return new Vr(t,e,o)}static adamax(t=.002,e=.9,o=.999,n=null,s=0){return new Kr(t,e,o,n,s)}static adagrad(t,e=.1){return new Wr(t,e)}};var jk=zn;var Yk=typeof requestAnimationFrame<"u"?requestAnimationFrame:typeof setImmediate<"u"?setImmediate:r=>r();function Nc(){return new Promise(r=>Yk(()=>r()))}var T={};Lt(T,{ERF_A1:()=>fR,ERF_A2:()=>dR,ERF_A3:()=>hR,ERF_A4:()=>gR,ERF_A5:()=>xR,ERF_P:()=>mR,PARALLELIZE_THRESHOLD:()=>kc,RowPartitionType:()=>er,SELU_SCALE:()=>pR,SELU_SCALEALPHA:()=>uR,applyActivation:()=>zo,assertAndGetBroadcastShape:()=>tt,assertAxesAreInnerMostDims:()=>TE,assertParamsConsistent:()=>Zk,assignToTypedArray:()=>$R,axesAreInnerMostDims:()=>vm,calculateShapes:()=>_x,checkEinsumDimSizes:()=>kR,checkPadOnDimRoundingMode:()=>Tt,combineLocations:()=>sg,combineRaggedTensorToTensorShapes:()=>Jk,complexWithEvenIndex:()=>wR,complexWithOddIndex:()=>CR,computeConv2DInfo:()=>Do,computeConv3DInfo:()=>Th,computeDefaultPad:()=>Cm,computeDilation2DInfo:()=>$T,computeOptimalWindowSize:()=>oR,computeOutAndReduceShapes:()=>SE,computeOutShape:()=>Qk,computePool2DInfo:()=>wm,computePool3DInfo:()=>ST,convertConv2DDataFormat:()=>Eh,decodeEinsumEquation:()=>IR,eitherStridesOrDilationsAreOne:()=>Kt,expandShapeToKeepDim:()=>pr,exponent:()=>TR,exponents:()=>SR,fromStringArrayToUint8:()=>YR,fromUint8ToStringArray:()=>jR,getAxesPermutation:()=>EE,getBroadcastDims:()=>tg,getComplexWithIndex:()=>vR,getEinsumComputePath:()=>RR,getEinsumPermutation:()=>NR,getFusedBiasGradient:()=>Wo,getFusedDyActivation:()=>Vo,getImageCenter:()=>nR,getInnerMostAxes:()=>NE,getPermuted:()=>iR,getRaggedRank:()=>eR,getReductionAxes:()=>Bl,getReshaped:()=>sR,getReshapedPermuted:()=>aR,getRowPartitionTypesHelper:()=>tR,getSliceBeginCoords:()=>lR,getSliceSize:()=>cR,getSparseFillEmptyRowsIndicesDenseShapeMismatch:()=>FR,getSparseFillEmptyRowsNegativeIndexErrorMessage:()=>PR,getSparseFillEmptyRowsOutOfRangeIndexErrorMessage:()=>OR,getSparseReshapeEmptyTensorZeroOutputDimErrorMessage:()=>BR,getSparseReshapeInputOutputMismatchErrorMessage:()=>UR,getSparseReshapeInputOutputMultipleErrorMessage:()=>GR,getSparseReshapeMultipleNegativeOneOutputDimErrorMessage:()=>MR,getSparseReshapeNegativeOutputDimErrorMessage:()=>LR,getSparseSegmentReductionIndicesOutOfRangeErrorMessage:()=>KR,getSparseSegmentReductionNegativeSegmentIdsErrorMessage:()=>VR,getSparseSegmentReductionNonIncreasingSegmentIdsErrorMessage:()=>WR,getSparseSegmentReductionSegmentIdOutOfRangeErrorMessage:()=>zR,getUndoAxesPermutation:()=>IE,isIdentityPermutation:()=>AR,log:()=>tS,mergeRealAndImagArrays:()=>bR,prepareAndValidate:()=>qb,prepareSplitSize:()=>DR,segment_util:()=>Qm,shouldFuse:()=>Ko,slice_util:()=>Zt,splitRealAndImagArrays:()=>yR,stridesOrDilationsArePositive:()=>qe,tupleValuesAreOne:()=>_o,upcastType:()=>Bt,validateDefaultValueShape:()=>rR,validateInput:()=>Gn,validateUpdateShape:()=>Dm,warn:()=>Ge});function Zk(r,t){let e=r[0].length;r.forEach((n,s)=>{v(n.length===e,()=>`Error in concat${e}D: rank of tensors[${s}] must be the same as the rank of the rest (${e})`)}),v(t>=0&&t<e,()=>`Error in concat${e}D: axis must be between 0 and ${e-1}.`);let o=r[0];r.forEach((n,s)=>{for(let i=0;i<e;i++)v(i===t||n[i]===o[i],()=>`Error in concat${e}D: Shape of tensors[${s}] (${n}) does not match the shape of the rest (${o}) along the non-concatenated axis ${s}.`)})}function Qk(r,t){let e=r[0].slice();for(let o=1;o<r.length;o++)e[t]+=r[o][t];return e}var er;(function(r){r[r.FIRST_DIM_SIZE=0]="FIRST_DIM_SIZE",r[r.VALUE_ROWIDS=1]="VALUE_ROWIDS",r[r.ROW_LENGTHS=2]="ROW_LENGTHS",r[r.ROW_SPLITS=3]="ROW_SPLITS",r[r.ROW_LIMITS=4]="ROW_LIMITS",r[r.ROW_STARTS=5]="ROW_STARTS"})(er||(er={}));function Jk(r,t,e){let o=new Array;if(e==null&&t==null)return o;if(t==null)for(;o.length<r+e.length;)o.push(-1);else o=t.slice();if(e==null)return o;if(r+e.length!==o.length)throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.rank = ${r+e.length}, but shape.rank = ${o.length}`);for(let n=1;n<e.length;++n){let s=e[n],i=o[o.length-e.length+n],a=o[i];if(s>=0)if(a>=0){if(a!==s)throw new Error(`rt input.shape and shape=${t} are incompatible: rt input.shape[${n+r}] = ${s} but shape[${n+r}] = ${a}`)}else o[i]=s}return o}function tR(r){let t={FIRST_DIM_SIZE:er.FIRST_DIM_SIZE,VALUE_ROWIDS:er.VALUE_ROWIDS,ROW_LENGTHS:er.ROW_LENGTHS,ROW_SPLITS:er.ROW_SPLITS,ROW_LIMITS:er.ROW_LIMITS,ROW_STARTS:er.ROW_STARTS},e=[];for(let o of r)if(o in t)e.push(t[o]);else break;return e}function eR(r){return r.length===0?0:r[0]===er.FIRST_DIM_SIZE?r.length-1:r.length}function rR(r,t){if(r==null||t==null)return;let e=r.length,o=t.length;if(e>=o)throw new Error(`defaultValue.shape=${r} and ragged tensor flatValues.shape=${t}, are incompatible: defaultValue.rank = ${e} must be less than ragged tensor input flatValues.rank = ${o})`);for(let n=0;n<Math.min(e,o-1);++n){let s=r[n],i=t[n+1];if(s>=0&&i>=0&&s!==1&&s!==i)throw new Error(`defaultValue.shape=${r}, and ragged tensor input flatValues.shape=${t} are incompatible: defaultValue.shape[${n-r.length}] = ${s} but ragged tensor input.flatValues.shape[${n-r.length}] = ${i}`)}}var kc=30;function oR(r){return r<=kc?r:cn(r,Math.floor(Math.sqrt(r)))}function nR(r,t,e){let o=e*(typeof r=="number"?r:r[0]),n=t*(typeof r=="number"?r:r[1]);return[o,n]}function sR(r,t,e,o=!0){let n=[];if(o)n=n.concat(t.slice(0)),n.push(r[0]/e),n=n.concat(r.slice(1));else{n=n.concat(r[0]);let s=t.length;for(let i=0;i<s;++i)n=n.concat([r[i+1]/t[i],t[i]]);n=n.concat(r.slice(s+1))}return n}function iR(r,t,e=!0){let o=[];if(e){o.push(t);for(let n=t+1;n<r;++n)n<=2*t?(o.push(n),o.push(n-(t+1))):o.push(n)}else{let n=[],s=[];for(let i=1;i<r;++i)i>=t*2+1||i%2===1?s.push(i):n.push(i);o.push(...n),o.push(0),o.push(...s)}return o}function aR(r,t,e,o=!0){let n=[];o?n.push(r[0]/e):n.push(r[0]*e);for(let s=1;s<r.length;++s)s<=t.length?o?n.push(t[s-1]*r[s]):n.push(r[s]/t[s-1]):n.push(r[s]);return n}function lR(r,t){let e=[0];for(let o=0;o<t;++o)e.push(r[o][0]);return e}function cR(r,t,e){let o=r.slice(0,1);for(let n=0;n<e;++n)o.push(r[n+1]-t[n][0]-t[n][1]);return o}var uR=1.7580993408473768,pR=1.0507009873554805;var mR=.3275911,fR=.254829592,dR=-.284496736,hR=1.421413741,gR=-1.453152027,xR=1.061405429;function bR(r,t){if(r.length!==t.length)throw new Error(`Cannot merge real and imag arrays of different lengths. real:${r.length}, imag: ${t.length}.`);let e=new Float32Array(r.length*2);for(let o=0;o<e.length;o+=2)e[o]=r[o/2],e[o+1]=t[o/2];return e}function yR(r){let t=new Float32Array(r.length/2),e=new Float32Array(r.length/2);for(let o=0;o<r.length;o+=2)t[o/2]=r[o],e[o/2]=r[o+1];return{real:t,imag:e}}function wR(r){let t=Math.ceil(r.length/4),e=new Float32Array(t),o=new Float32Array(t);for(let n=0;n<r.length;n+=4)e[Math.floor(n/4)]=r[n],o[Math.floor(n/4)]=r[n+1];return{real:e,imag:o}}function CR(r){let t=Math.floor(r.length/4),e=new Float32Array(t),o=new Float32Array(t);for(let n=2;n<r.length;n+=4)e[Math.floor(n/4)]=r[n],o[Math.floor(n/4)]=r[n+1];return{real:e,imag:o}}function vR(r,t){let e=r[t*2],o=r[t*2+1];return{real:e,imag:o}}function $R(r,t,e,o){r[o*2]=t,r[o*2+1]=e}function SR(r,t){let e=new Float32Array(r/2),o=new Float32Array(r/2);for(let n=0;n<Math.ceil(r/2);n++){let s=(t?2:-2)*Math.PI*(n/r);e[n]=Math.cos(s),o[n]=Math.sin(s)}return{real:e,imag:o}}function TR(r,t,e){let o=(e?2:-2)*Math.PI*(r/t),n=Math.cos(o),s=Math.sin(o);return{real:n,imag:s}}var Zm="->",ER=/->/g,n0=",",s0="...";function IR(r,t){r=r.replace(/\s/g,"");let e=(r.length-r.replace(ER,"").length)/Zm.length;if(e<1)throw new Error("Equations without an arrow are not supported.");if(e>1)throw new Error(`Equation must contain exactly one arrow ("${Zm}").`);let[o,n]=r.split(Zm);v(o.indexOf(s0)===-1,()=>`The ellipsis notation ("${s0}") is not supported yet.`);let s=o.split(n0),i=s.length;if(t!==i)throw new Error(`Expected ${i} input tensors, received ${t}`);if(i>2)throw new Error("Support for more than 2 input tensors is not implemented yet.");let a=[];for(let m=0;m<n.length;++m){let f=n[m];if(!s.some(d=>d.indexOf(f)!==-1))throw new Error(`Output subscripts contain the label ${f} not present in the input subscripts.`);a.indexOf(f)===-1&&a.push(f)}for(let m=0;m<o.length;++m){let f=o[m];a.indexOf(f)===-1&&f!==n0&&a.push(f)}let l=new Array(s.length);for(let m=0;m<i;++m){if(new Set(s[m].split("")).size!==s[m].length)throw new Error(`Found duplicate axes in input component ${s[m]}. Support for duplicate axes in input is not implemented yet.`);l[m]=[];for(let f=0;f<s[m].length;++f)l[m].push(a.indexOf(s[m][f]))}let c=a.length,u=n.length,p=[];for(let m=u;m<c;++m)p.push(m);return{allDims:a,summedDims:p,idDims:l}}function NR(r,t){let e=new Array(r);e.fill(-1);for(let n=0;n<t.length;++n)e[t[n]]=n;let o=[];for(let n=0;n<r;++n)e[n]===-1&&o.push(n);return e=e.filter(n=>n!==-1),{permutationIndices:e,expandDims:o}}function kR(r,t,e){let o=new Array(r);for(let n=0;n<e.length;++n){let s=e[n].shape;for(let i=0;i<t[n].length;++i)o[t[n][i]]===void 0?o[t[n][i]]=s[i]:v(o[t[n][i]]===s[i],()=>`Expected dimension ${o[t[n][i]]} at axis ${i} of input shaped ${JSON.stringify(s)}, but got dimension ${s[i]}`)}}function RR(r,t){let e=r,o=[],n=0;r.length===0&&e.push(-1),n=r.length+1;for(let i=0;i<n;++i)o.push([]);let s=[];for(let i=0;i<e.length;++i){let a=e[i],l=_R(t,a);for(let c of l)s.indexOf(c)===-1&&(o[i].push(c),s.push(c))}return{path:e,steps:o}}function AR(r){return r.every((t,e)=>t===e)}function _R(r,t){let e=[];for(let o=0;o<r.length;++o)(r[o].length===0||r[o].indexOf(t)!==-1||t===-1)&&e.push(o);return e}function DR(r,t,e=0){let o=[];if(typeof t=="number")v(r.shape[e]%t===0,()=>"Number of splits must evenly divide the axis."),o=new Array(t).fill(r.shape[e]/t);else{let n=t.reduce((i,a)=>(a===-1&&(i+=1),i),0);v(n<=1,()=>"There should be only one negative value in split array.");let s=t.indexOf(-1);if(s!==-1){let i=t.reduce((a,l)=>l>0?a+l:a);t[s]=r.shape[e]-i}v(r.shape[e]===t.reduce((i,a)=>i+a),()=>"The sum of sizes must match the size of the axis dimension."),o=t}return o}function FR(r){return`Received SparseTensor with denseShape[0] = 0 but
  indices.shape[0] = ${r}`}function PR(r,t){return`indices(${r}, 0) is invalid: ${t} < 0`}function OR(r,t,e){return`indices(${r}, 0) is invalid: ${t} >= ${e}`}function MR(r,t){return`only one output dimension may be -1, not both ${r} and ${t}`}function LR(r,t){return`size ${r} must be non-negative, not ${t}`}function BR(){return"reshape cannot infer the missing input size for an empty tensor unless all specified input sizes are non-zero"}function GR(r,t){let e=X(r),o=X(t);return`Input to reshape is a SparseTensor with ${e}
  dense values, but the requested shape requires a multiple of ${o}. inputShape=${r} outputShape= ${t}`}function UR(r,t){let e=X(r),o=X(t);return`Input to reshape is a tensor with ${e} dense values, but the requested shape has ${o}. inputShape=${r} outputShape=${t}`}function VR(){return"segment ids must be >= 0"}function WR(){return"segment ids are not increasing"}function zR(r,t){return`Segment id ${r} out of range [0, ${t}), possibly because segmentIds input is not sorted.`}function KR(r,t,e){return`Bad: indices[${r}] == ${t} out of range [0, ${e})`}var Qm={};Lt(Qm,{collectGatherOpShapeInfo:()=>XR,computeOutShape:()=>qR,segOpComputeOptimalWindowSize:()=>HR});function HR(r,t){let e=!1,o;for(r<=kc?(o=r,e=!0):o=cn(r,Math.floor(Math.sqrt(r)));!e;)o>t||o===r?e=!0:o=cn(r,o+1);return o}function qR(r,t,e){let o=[],n=r.length;for(let s=0;s<n;s++)s!==t?o.push(r[s]):o.push(e);return o}function XR(r,t,e,o){let n=t.shape.length,s=r.shape.length;if(o!==0&&(o<-n||o>n))throw new Error(`Expect batchDims in the range of [-${n}, ${n}], but got ${o}`);if(o<0&&(o+=n),o>s)throw new Error(`batchDims (${o}) must be less than rank(x) (
    ${s}).`);if(e<o)throw new Error(`batchDims (${o}) must be less than or equal to axis (${e}).`);for(let p=0;p<o;++p)if(r.shape[p]!==t.shape[p])throw new Error(`x.shape[${p}]: ${r.shape[p]} should be equal to indices.shape[${p}]: ${t.shape[p]}.`);let i=r.shape[e],a=[],l=1,c=1,u=1;for(let p=0;p<o;++p)a.push(r.shape[p]),l*=r.shape[p];for(let p=o;p<e;p++)a.push(r.shape[p]),c*=r.shape[p];for(let p=o;p<n;p++)a.push(t.shape[p]);for(let p=e+1;p<s;p++)a.push(r.shape[p]),u*=r.shape[p];return{batchSize:l,sliceSize:u,outerSize:c,dimSize:i,outputShape:a}}function jR(r){try{return r.map(t=>Nn(t))}catch(t){throw new Error(`Failed to decode encoded string bytes into utf-8, error: ${t}`)}}function YR(r){return r.map(t=>kr(t))}var Fe={};Lt(Fe,{nonMaxSuppressionV3Impl:()=>Cc,nonMaxSuppressionV4Impl:()=>vc,nonMaxSuppressionV5Impl:()=>$c,whereImpl:()=>xc});Db();var qo={},Ac={alpha:!1,antialias:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,depth:!1,stencil:!1,failIfMajorPerformanceCaveat:!0};function i0(r,t){qo[r]=t}function ue(r,t){if(!(r in qo)||t!=null){let o=QR(r,t);if(o!==null)qo[r]=o;else return console.log("Could not get context for WebGL version",r),null}let e=qo[r];return e==null||e.isContextLost()?(delete qo[r],ue(r)):(e.disable(e.DEPTH_TEST),e.disable(e.STENCIL_TEST),e.disable(e.BLEND),e.disable(e.DITHER),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SAMPLE_COVERAGE),e.enable(e.SCISSOR_TEST),e.enable(e.CULL_FACE),e.cullFace(e.BACK),qo[r])}function ZR(r){if(!I().getBool("IS_SAFARI")&&typeof OffscreenCanvas<"u"&&r===2)return new OffscreenCanvas(300,150);if(typeof document<"u")return document.createElement("canvas");throw new Error("Cannot create a canvas in this context")}function QR(r,t){if(r!==1&&r!==2)throw new Error("Cannot get WebGL rendering context, WebGL is disabled.");let e=t??ZR(r);return e.addEventListener("webglcontextlost",o=>{o.preventDefault(),delete qo[r]},!1),I().getBool("SOFTWARE_WEBGL_ENABLED")&&(Ac.failIfMajorPerformanceCaveat=!1),r===1?e.getContext("webgl",Ac)||e.getContext("experimental-webgl",Ac):e.getContext("webgl2",Ac)}var Xr;(function(r){r[r.DENSE=0]="DENSE",r[r.SHARED_BATCH=1]="SHARED_BATCH"})(Xr||(Xr={}));var zt;(function(r){r[r.RENDER=0]="RENDER",r[r.UPLOAD=1]="UPLOAD",r[r.PIXELS=2]="PIXELS",r[r.DOWNLOAD=3]="DOWNLOAD"})(zt||(zt={}));var Ot;(function(r){r[r.UNPACKED_FLOAT16=0]="UNPACKED_FLOAT16",r[r.UNPACKED_FLOAT32=1]="UNPACKED_FLOAT32",r[r.PACKED_4X1_UNSIGNED_BYTE=2]="PACKED_4X1_UNSIGNED_BYTE",r[r.PACKED_2X2_FLOAT32=3]="PACKED_2X2_FLOAT32",r[r.PACKED_2X2_FLOAT16=4]="PACKED_2X2_FLOAT16"})(Ot||(Ot={}));function Xo(r,t){return[t,r]}function a0(r,t){return r*t}function Pa(r){let t=C.sizeFromShape(r),e=Math.ceil(t/4);return C.sizeToSquarishShape(e)}function rr(r,t){return[Math.max(1,Math.ceil(t/2)),Math.max(1,Math.ceil(r/2))]}function l0(r,t){let[e,o]=rr(r,t);return e*o*4}function Oa(r,t){let e=r,o,n,s,i,a,l,c,u,p,m;return I().getNumber("WEBGL_VERSION")===2?(o=e.R32F,n=e.R16F,s=e.RGBA16F,i=e.RGBA32F,a=e.RED,c=4,u=1,p=e.HALF_FLOAT,m=e.FLOAT,l=e.RGBA8):(o=r.RGBA,n=r.RGBA,s=r.RGBA,i=e.RGBA,a=r.RGBA,c=4,u=4,p=t!=null?t.HALF_FLOAT_OES:null,m=r.FLOAT,l=r.RGBA),{internalFormatFloat:o,internalFormatHalfFloat:n,internalFormatPackedHalfFloat:s,internalFormatPackedFloat:i,textureFormatFloat:a,downloadTextureFormat:l,downloadUnpackNumChannels:c,defaultNumChannels:u,textureTypeHalfFloat:p,textureTypeFloat:m}}function L(r,t){let e=t();return I().getBool("DEBUG")&&JR(r),e}function JR(r){let t=r.getError();if(t!==r.NO_ERROR)throw new Error("WebGL Error: "+rA(r,t))}var tA=596e-10,eA=65504;function c0(r){return!!(I().getBool("WEBGL_RENDER_FLOAT32_ENABLED")||r===0||tA<Math.abs(r)&&Math.abs(r)<eA)}function rA(r,t){switch(t){case r.NO_ERROR:return"NO_ERROR";case r.INVALID_ENUM:return"INVALID_ENUM";case r.INVALID_VALUE:return"INVALID_VALUE";case r.INVALID_OPERATION:return"INVALID_OPERATION";case r.INVALID_FRAMEBUFFER_OPERATION:return"INVALID_FRAMEBUFFER_OPERATION";case r.OUT_OF_MEMORY:return"OUT_OF_MEMORY";case r.CONTEXT_LOST_WEBGL:return"CONTEXT_LOST_WEBGL";default:return`Unknown error code ${t}`}}function Ma(r,t){return xr(r,()=>r.getExtension(t),'Extension "'+t+'" not supported on this browser.')}function u0(r,t){let e=xr(r,()=>r.createShader(r.VERTEX_SHADER),"Unable to create vertex WebGLShader.");if(L(r,()=>r.shaderSource(e,t)),L(r,()=>r.compileShader(e)),r.getShaderParameter(e,r.COMPILE_STATUS)===!1)throw console.log(r.getShaderInfoLog(e)),new Error("Failed to compile vertex shader.");return e}function p0(r,t){let e=xr(r,()=>r.createShader(r.FRAGMENT_SHADER),"Unable to create fragment WebGLShader.");if(L(r,()=>r.shaderSource(e,t)),L(r,()=>r.compileShader(e)),I().get("ENGINE_COMPILE_ONLY"))return e;if(r.getShaderParameter(e,r.COMPILE_STATUS)===!1)throw of(t,r.getShaderInfoLog(e)),new Error("Failed to compile fragment shader.");return e}var oA=/ERROR: [0-9]+:([0-9]+):/g;function of(r,t){let e=oA.exec(t);if(e==null){console.log(`Couldn't parse line number in error: ${t}`),console.log(r);return}let o=+e[1],n=r.split(`
`),s=n.length.toString().length+2,i=n.map((p,m)=>C.rightPad((m+1).toString(),s)+p),a=0;for(let p=0;p<i.length;p++)a=Math.max(i[p].length,a);let l=i.slice(0,o-1),c=i.slice(o-1,o),u=i.slice(o);console.log(l.join(`
`)),console.log(t.split(`
`)[0]),console.log(`%c ${C.rightPad(c[0],a)}`,"border:1px solid red; background-color:#e3d2d2; color:#a61717"),console.log(u.join(`
`))}function m0(r){return xr(r,()=>r.createProgram(),"Unable to create WebGLProgram.")}function f0(r,t){if(L(r,()=>r.linkProgram(t)),!I().get("ENGINE_COMPILE_ONLY")&&r.getProgramParameter(t,r.LINK_STATUS)===!1)throw console.log(r.getProgramInfoLog(t)),new Error("Failed to link vertex and fragment shaders.")}function Dc(r,t){if(L(r,()=>r.validateProgram(t)),r.getProgramParameter(t,r.VALIDATE_STATUS)===!1)throw console.log(r.getProgramInfoLog(t)),new Error("Shader program validation failed.")}function d0(r,t){let e=xr(r,()=>r.createBuffer(),"Unable to create WebGLBuffer");return L(r,()=>r.bindBuffer(r.ARRAY_BUFFER,e)),L(r,()=>r.bufferData(r.ARRAY_BUFFER,t,r.STATIC_DRAW)),e}function h0(r,t){let e=xr(r,()=>r.createBuffer(),"Unable to create WebGLBuffer");return L(r,()=>r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,e)),L(r,()=>r.bufferData(r.ELEMENT_ARRAY_BUFFER,t,r.STATIC_DRAW)),e}function g0(r){return xr(r,()=>r.createTexture(),"Unable to create WebGLTexture.")}function x0(r,t){let e=I().getNumber("WEBGL_MAX_TEXTURE_SIZE");if(r<=0||t<=0){let o=`[${r}x${t}]`;throw new Error("Requested texture size "+o+" is invalid.")}if(r>e||t>e){let o=`[${r}x${t}]`,n=`[${e}x${e}]`;throw new Error("Requested texture size "+o+" greater than WebGL maximum on this browser / GPU "+n+".")}}function b0(r){return xr(r,()=>r.createFramebuffer(),"Unable to create WebGLFramebuffer.")}function nf(r,t,e,o,n,s,i){let a=r.getAttribLocation(t,e);return a===-1?!1:(L(r,()=>r.bindBuffer(r.ARRAY_BUFFER,o)),L(r,()=>r.vertexAttribPointer(a,n,r.FLOAT,!1,s,i)),L(r,()=>r.enableVertexAttribArray(a)),!0)}function nA(r,t,e){iA(r,e),L(r,()=>r.activeTexture(r.TEXTURE0+e)),L(r,()=>r.bindTexture(r.TEXTURE_2D,t))}function y0(r,t,e){return xr(r,()=>r.getUniformLocation(t,e),'uniform "'+e+'" not present in program.')}function w0(r,t,e){return r.getUniformLocation(t,e)}function C0(r,t,e,o){L(r,()=>nA(r,t,o)),L(r,()=>r.uniform1i(e,o))}function Fc(r,t,e){L(r,()=>r.bindFramebuffer(r.FRAMEBUFFER,e)),L(r,()=>r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,t,0))}function sf(r,t){L(r,()=>r.bindFramebuffer(r.FRAMEBUFFER,t)),L(r,()=>r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,null,0))}function La(r){let t=r.checkFramebufferStatus(r.FRAMEBUFFER);if(t!==r.FRAMEBUFFER_COMPLETE)throw new Error("Error binding framebuffer: "+sA(r,t))}function sA(r,t){switch(t){case r.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:return"FRAMEBUFFER_INCOMPLETE_ATTACHMENT";case r.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:return"FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";case r.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:return"FRAMEBUFFER_INCOMPLETE_DIMENSIONS";case r.FRAMEBUFFER_UNSUPPORTED:return"FRAMEBUFFER_UNSUPPORTED";default:return`unknown error ${t}`}}function xr(r,t,e){let o=L(r,()=>t());if(o==null)throw new Error(e);return o}function iA(r,t){let e=r.MAX_COMBINED_TEXTURE_IMAGE_UNITS-1,o=t+r.TEXTURE0;if(o<r.TEXTURE0||o>e){let n=`[gl.TEXTURE0, gl.TEXTURE${e}]`;throw new Error(`textureUnit must be in ${n}.`)}}function jr(r,t=2){return C.sizeFromShape(r.slice(0,r.length-t))}function Yr(r){if(r.length===0)throw Error("Cannot get rows and columns of an empty shape array.");return[r.length>1?r[r.length-2]:1,r[r.length-1]]}function Ba(r){let t=[1,1,1];return r.length===0||r.length===1&&r[0]===1||(t=[jr(r),...Yr(r)]),t}function v0(r,t=!1){let e=I().getNumber("WEBGL_MAX_TEXTURE_SIZE"),o=I().getNumber("WEBGL_MAX_SIZE_FOR_NARROW_TEXTURE");o===1/0&&I().getBool("WEBGL_AUTO_SQUARIFY_NARROW_TEXTURE_SHAPE")&&(o=e/2),t&&(e=e*2,o=o*2,r=r.map((a,l)=>l>=r.length-2?C.nearestLargerEven(r[l]):r[l]),r.length===1&&(r=[2,r[0]])),r.length!==2&&(r=C.squeezeShape(r).newShape);let n=C.sizeFromShape(r),s=null;r.length<=1&&n<=e?s=[1,n]:r.length===2&&r[0]<=e&&r[1]<=e?s=r:r.length===3&&r[0]*r[1]<=e&&r[2]<=e?s=[r[0]*r[1],r[2]]:r.length===3&&r[0]<=e&&r[1]*r[2]<=e?s=[r[0],r[1]*r[2]]:r.length===4&&r[0]*r[1]*r[2]<=e&&r[3]<=e?s=[r[0]*r[1]*r[2],r[3]]:r.length===4&&r[0]<=e&&r[1]*r[2]*r[3]<=e&&(s=[r[0],r[1]*r[2]*r[3]]);let i=s!=null&&Math.max(...s)>o&&Math.min(...s)<=(t?2:1)&&Math.min(...s)>0;if(s==null||i)if(t){let a=jr(r),l=2,c=2;r.length&&([l,c]=Yr(r)),n=a*(l/2)*(c/2),s=C.sizeToSquarishShape(n).map(u=>u*2)}else s=C.sizeToSquarishShape(n);return s}function _c(r){return r%2===0}function jo(r,t){if(r=r.slice(-2),t=t.slice(-2),C.arraysEqual(r,t)||!r.length||!t.length||r[0]===0||r[1]===0||t[0]===0||t[1]===0)return!0;if(r.length!==t.length){let e=r[r.length-1],o=t[t.length-1];if(e===o||_c(e)&&_c(o)&&(r[0]===1||t[0]===1))return!0}return r[1]===t[1]&&_c(r[0])&&_c(t[0])}var tf,ef;function $0(r){if(tf==null){let t=ue(r);tf=t.getParameter(t.MAX_TEXTURE_SIZE)}return tf}function S0(r){if(ef==null){let t=ue(r);ef=t.getParameter(t.MAX_TEXTURE_IMAGE_UNITS)}return Math.min(16,ef)}function T0(r){if(r===0)return 0;let t,e=ue(r);return xe(e,"EXT_disjoint_timer_query_webgl2")&&r===2?t=2:xe(e,"EXT_disjoint_timer_query")?t=1:t=0,t}function xe(r,t){return r.getExtension(t)!=null}function af(r){try{if(ue(r)!=null)return!0}catch(t){return console.log("Error when getting WebGL context: ",t),!1}return!1}function E0(r){if(r===0)return!1;let t=ue(r);if(r===1){if(!xe(t,"OES_texture_float"))return!1}else if(!xe(t,"EXT_color_buffer_float"))return!1;return rf(t)}function I0(r){if(r===0)return!1;let t=ue(r);if(r===1){if(!xe(t,"OES_texture_float")||!xe(t,"WEBGL_color_buffer_float"))return!1}else{if(xe(t,"EXT_color_buffer_float"))return rf(t);let o="EXT_color_buffer_half_float";if(xe(t,o)){let n=t.getExtension(o);return aA(t,n)}return!1}return rf(t)}function rf(r){let t=Oa(r),e=r.createTexture();r.bindTexture(r.TEXTURE_2D,e),r.texImage2D(r.TEXTURE_2D,0,t.internalFormatFloat,1,1,0,t.textureFormatFloat,t.textureTypeFloat,null);let s=r.createFramebuffer();r.bindFramebuffer(r.FRAMEBUFFER,s),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,e,0);let i=r.checkFramebufferStatus(r.FRAMEBUFFER)===r.FRAMEBUFFER_COMPLETE;return r.bindTexture(r.TEXTURE_2D,null),r.bindFramebuffer(r.FRAMEBUFFER,null),r.deleteTexture(e),r.deleteFramebuffer(s),i}function aA(r,t){let e=Oa(r,t),o=r.createTexture();r.bindTexture(r.TEXTURE_2D,o),r.texImage2D(r.TEXTURE_2D,0,e.internalFormatHalfFloat,1,1,0,e.textureFormatFloat,e.textureTypeHalfFloat,null);let i=r.createFramebuffer();r.bindFramebuffer(r.FRAMEBUFFER,i),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,o,0);let a=r.checkFramebufferStatus(r.FRAMEBUFFER)===r.FRAMEBUFFER_COMPLETE;return r.bindTexture(r.TEXTURE_2D,null),r.bindFramebuffer(r.FRAMEBUFFER,null),r.deleteTexture(o),r.deleteFramebuffer(i),a}function N0(r){return r!==2?!1:ue(r).fenceSync!=null}function or(r,t){Array.isArray(r)||(r=[r]),r.forEach(e=>{e!=null&&C.assert(e.dtype!=="complex64",()=>`${t} does not support complex64 tensors in the WebGL backend.`)})}var V=I();V.registerFlag("HAS_WEBGL",()=>V.getNumber("WEBGL_VERSION")>0);V.registerFlag("WEBGL_VERSION",()=>af(2)?2:af(1)?1:0);V.registerFlag("WEBGL_CHECK_NUMERICAL_PROBLEMS",()=>!1);V.registerFlag("WEBGL_BUFFER_SUPPORTED",()=>V.get("WEBGL_VERSION")===2);V.registerFlag("WEBGL_CPU_FORWARD",()=>!0);V.registerFlag("WEBGL_FORCE_F16_TEXTURES",()=>!1);V.registerFlag("WEBGL_PACK",()=>V.getBool("HAS_WEBGL"));V.registerFlag("WEBGL_PACK_NORMALIZATION",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_CLIP",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_DEPTHWISECONV",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_BINARY_OPERATIONS",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_UNARY_OPERATIONS",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_ARRAY_OPERATIONS",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_IMAGE_OPERATIONS",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_REDUCE",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_LAZILY_UNPACK",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_CONV_IM2COL",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_PACK_CONV2DTRANSPOSE",()=>V.getBool("WEBGL_PACK"));V.registerFlag("WEBGL_MAX_TEXTURE_SIZE",()=>$0(V.getNumber("WEBGL_VERSION")));V.registerFlag("WEBGL_MAX_TEXTURES_IN_SHADER",()=>S0(V.getNumber("WEBGL_VERSION")));V.registerFlag("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION",()=>{let r=V.getNumber("WEBGL_VERSION");return r===0?0:T0(r)});V.registerFlag("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE",()=>V.getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")>0&&!ir.isMobile());V.registerFlag("WEBGL_RENDER_FLOAT32_CAPABLE",()=>E0(V.getNumber("WEBGL_VERSION")));V.registerFlag("WEBGL_RENDER_FLOAT32_ENABLED",()=>V.getBool("WEBGL_FORCE_F16_TEXTURES")?!1:V.getBool("WEBGL_RENDER_FLOAT32_CAPABLE"));V.registerFlag("WEBGL_DOWNLOAD_FLOAT_ENABLED",()=>I0(V.getNumber("WEBGL_VERSION")));V.registerFlag("WEBGL_FENCE_API_ENABLED",()=>N0(V.getNumber("WEBGL_VERSION")));V.registerFlag("WEBGL_SIZE_UPLOAD_UNIFORM",()=>V.getBool("WEBGL_RENDER_FLOAT32_ENABLED")?4:0);V.registerFlag("WEBGL_DELETE_TEXTURE_THRESHOLD",()=>-1,r=>{if(typeof r!="number")throw new Error(`WEBGL_DELETE_TEXTURE_THRESHOLD must be a number but got ${r}.`);if(r<0&&r!==-1)throw new Error(`WEBGL_DELETE_TEXTURE_THRESHOLD must be -1 (indicating never delete) or at least 0, but got ${r}.`)});V.registerFlag("WEBGL_FLUSH_THRESHOLD",()=>ir.isMobile()?1:-1,r=>{if(typeof r!="number")throw new Error(`WEBGL_FLUSH_THRESHOLD must be a number but got ${r}.`);if(r<0&&r!==-1)throw new Error(`WEBGL_FLUSH_THRESHOLD must be -1 (indicating never manual flush) or at least 0, but got ${r}.`)});V.registerFlag("CPU_HANDOFF_SIZE_THRESHOLD",()=>128);V.registerFlag("WEBGL_USE_SHAPES_UNIFORMS",()=>!1);V.registerFlag("TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD",()=>1e5);V.registerFlag("TOPK_K_CPU_HANDOFF_THRESHOLD",()=>128);V.registerFlag("WEBGL_EXP_CONV",()=>!1);V.registerFlag("SOFTWARE_WEBGL_ENABLED",()=>V.getBool("IS_TEST"));V.registerFlag("WEBGL_MAX_SIZE_FOR_NARROW_TEXTURE",()=>1/0);V.registerFlag("WEBGL_AUTO_SQUARIFY_NARROW_TEXTURE_SHAPE",()=>!1);V.registerFlag("WEBGL2_ISNAN_CUSTOM",()=>!1);V.registerFlag("ENGINE_COMPILE_ONLY",()=>!1);function ht(){let r,t,e,o,n,s,i,a,l,c;return I().getNumber("WEBGL_VERSION")===2?(r="#version 300 es",t="in",e="out",o="in",n="texture",s="outputColor",i="out vec4 outputColor;",a=I().getBool("WEBGL2_ISNAN_CUSTOM")?`
      bool isnan_custom(float val) {
        uint floatToUint = floatBitsToUint(val);
        return (floatToUint & 0x7fffffffu) > 0x7f800000u;
      }

      bvec4 isnan_custom(vec4 val) {
        return bvec4(isnan_custom(val.x),
          isnan_custom(val.y), isnan_custom(val.z), isnan_custom(val.w));
      }

      #define isnan(value) isnan_custom(value)
    `:"",l="",c=`
      #define round(value) newRound(value)
      int newRound(float value) {
        return int(floor(value + 0.5));
      }

      ivec4 newRound(vec4 value) {
        return ivec4(floor(value + vec4(0.5)));
      }
    `):(r="",t="attribute",e="varying",o="varying",n="texture2D",s="gl_FragColor",i="",a=`
      #define isnan(value) isnan_custom(value)
      bool isnan_custom(float val) {
        return (val > 0. || val < 1. || val == 0.) ? false : true;
      }
      bvec4 isnan_custom(vec4 val) {
        return bvec4(isnan(val.x), isnan(val.y), isnan(val.z), isnan(val.w));
      }
    `,l=`
      uniform float INFINITY;

      bool isinf(float val) {
        return abs(val) == INFINITY;
      }
      bvec4 isinf(vec4 val) {
        return equal(abs(val), vec4(INFINITY));
      }
    `,c=`
      int round(float value) {
        return int(floor(value + 0.5));
      }

      ivec4 round(vec4 value) {
        return ivec4(floor(value + vec4(0.5)));
      }
    `),{version:r,attribute:t,varyingVs:e,varyingFs:o,texture2D:n,output:s,defineOutput:i,defineSpecialNaN:a,defineSpecialInf:l,defineRound:c}}function Pe(r,t,e="index"){let o=C.computeStrides(t);return o.map((n,s)=>{let i=`int ${r[s]} = ${e} / ${n}`,a=s===o.length-1?`int ${r[s+1]} = ${e} - ${r[s]} * ${n}`:`index -= ${r[s]} * ${n}`;return`${i}; ${a};`}).join("")}function Yo(r,t,e="index"){let o=C.computeStrides(t);return o.map((n,s)=>{let i=`int ${r[s]} = ${e} / outShapeStrides[${s}]`,a=s===o.length-1?`int ${r[s+1]} = ${e} - ${r[s]} * outShapeStrides[${s}]`:`index -= ${r[s]} * outShapeStrides[${s}]`;return`${i}; ${a};`}).join("")}function lA(r,t){let e=r.length,o=r.map(s=>`${t}[${s}]`),n=new Array(e-1);n[e-2]=o[e-1];for(let s=e-3;s>=0;--s)n[s]=`(${n[s+1]} * ${o[s+1]})`;return n}function k0(r,t,e="index"){let o=r.map((s,i)=>i),n=lA(o,t);return n.map((s,i)=>{let a=`int ${r[i]} = ${e} / ${n[i]}`,l=i===n.length-1?`int ${r[i+1]} = ${e} - ${r[i]} * ${n[i]}`:`index -= ${r[i]} * ${n[i]}`;return`${a}; ${l};`}).join("")}function Kn(r){let t=C.computeStrides(r).map(e=>e.toString());return`
  int getFlatIndex(ivec3 coords) {
    return coords.x * ${t[0]} + coords.y * ${t[1]} + coords.z;
  }
`}function Hn(){return`
  int getFlatIndex(ivec3 coords) {
    return coords.x * outShapeStrides[0] + coords.y * outShapeStrides[1] + coords.z;
  }
`}var Oc=`
  const float FLOAT_MAX = 1.70141184e38;
  const float FLOAT_MIN = 1.17549435e-38;

  lowp vec4 encode_float(highp float v) {
    if (isnan(v)) {
      return vec4(255, 255, 255, 255);
    }

    highp float av = abs(v);

    if(av < FLOAT_MIN) {
      return vec4(0.0, 0.0, 0.0, 0.0);
    } else if(v > FLOAT_MAX) {
      return vec4(0.0, 0.0, 128.0, 127.0) / 255.0;
    } else if(v < -FLOAT_MAX) {
      return vec4(0.0, 0.0,  128.0, 255.0) / 255.0;
    }

    highp vec4 c = vec4(0,0,0,0);

    highp float e = floor(log2(av));
    highp float m = exp2(fract(log2(av))) - 1.0;

    c[2] = floor(128.0 * m);
    m -= c[2] / 128.0;
    c[1] = floor(32768.0 * m);
    m -= c[1] / 32768.0;
    c[0] = floor(8388608.0 * m);

    highp float ebias = e + 127.0;
    c[3] = floor(ebias / 2.0);
    ebias -= c[3] * 2.0;
    c[2] += floor(ebias) * 128.0;

    c[3] += 128.0 * step(0.0, -v);

    return c / 255.0;
  }
`;var{getBroadcastDims:R0}=T;function A0(r,t,e){let o=[];if(r.forEach(f=>{let d=C.sizeFromShape(f.shapeInfo.logicalShape);if(f.shapeInfo.isUniform?o.push(`uniform float ${f.name}${d>1?`[${d}]`:""};`):(o.push(`uniform sampler2D ${f.name};`),o.push(`uniform int offset${f.name};`)),e.enableShapeUniforms){let{uniformShape:x}=Mc(e.packedInputs,f.shapeInfo.logicalShape,f.shapeInfo.texShape);switch(x.length){case 1:o.push(`uniform int ${f.name}Shape;`);break;case 2:o.push(`uniform ivec2 ${f.name}Shape;`);break;case 3:o.push(`uniform ivec3 ${f.name}Shape;`);break;case 4:o.push(`uniform ivec4 ${f.name}Shape;`);break;default:break}o.push(`uniform ivec2 ${f.name}TexShape;`)}}),e.enableShapeUniforms){switch(t.logicalShape.length){case 1:o.push("uniform int outShape;");break;case 2:o.push("uniform ivec2 outShape;"),o.push("uniform int outShapeStrides;");break;case 3:o.push("uniform ivec3 outShape;"),o.push("uniform ivec2 outShapeStrides;");break;case 4:o.push("uniform ivec4 outShape;"),o.push("uniform ivec3 outShapeStrides;");break;default:break}o.push("uniform ivec2 outTexShape;")}e.customUniforms&&e.customUniforms.forEach(f=>{o.push(`uniform ${f.type} ${f.name}${f.arrayIndex?`[${f.arrayIndex}]`:""};`)});let n=o.join(`
`),s=r.map(f=>cA(f,t,e.packedInputs,e.enableShapeUniforms)).join(`
`),i=t.texShape,a=ht(),l=mA(a),c,u,p=hA(a);return t.isPacked?(c=uA(t.logicalShape,i,e.enableShapeUniforms),u=dA(a)):(c=pA(t.logicalShape,i,e.enableShapeUniforms),u=fA(a)),e.packedInputs&&(p+=yA),[p,l,u,n,c,s,e.userCode].join(`
`)}function Xn(r,t=!1){let e=r.shapeInfo.logicalShape;switch(e.length){case 0:return AA(r,t);case 1:return DA(r,t);case 2:return PA(r,t);case 3:return MA(r,t);case 4:return BA(r,t);case 5:return GA(r);case 6:return UA(r);default:throw new Error(`${e.length}-D input sampling is not yet supported`)}}function _0(r,t){switch(r.shapeInfo.logicalShape.length){case 0:return RA(r);case 1:return _A(r,t);case 2:return FA(r,t);case 3:return OA(r,t);default:return LA(r,t)}}function cA(r,t,e=!1,o){let n="";e?n+=_0(r,o):n+=Xn(r,o);let s=r.shapeInfo.logicalShape,i=t.logicalShape;return s.length<=i.length&&(e?n+=VA(r,t):n+=WA(r,t)),n}function uA(r,t,e){switch(r.length){case 0:return D0();case 1:return wA(r,t,e);case 2:return NA(r,t,e);case 3:return vA(r,t,e);default:return SA(r,t,e)}}function pA(r,t,e){switch(r.length){case 0:return D0();case 1:return CA(r,t,e);case 2:return kA(r,t,e);case 3:return $A(r,t,e);case 4:return TA(r,t,e);case 5:return EA(r,t);case 6:return IA(r,t);default:throw new Error(`${r.length}-D output sampling is not yet supported`)}}function mA(r){return`
    float sampleTexture(sampler2D textureSampler, vec2 uv) {
      return ${r.texture2D}(textureSampler, uv).r;
    }
  `}function fA(r){return`
    void setOutput(float val) {
      ${r.output} = vec4(val, 0, 0, 0);
    }
  `}function dA(r){return`
    void setOutput(vec4 val) {
      ${r.output} = val;
    }
  `}function hA(r){return`${r.version}
    precision highp float;
    precision highp int;
    precision highp sampler2D;
    ${r.varyingFs} vec2 resultUV;
    ${r.defineOutput}
    const vec2 halfCR = vec2(0.5, 0.5);

    struct ivec5
    {
      int x;
      int y;
      int z;
      int w;
      int u;
    };

    struct ivec6
    {
      int x;
      int y;
      int z;
      int w;
      int u;
      int v;
    };

    uniform float NAN;
    ${r.defineSpecialNaN}
    ${r.defineSpecialInf}
    ${r.defineRound}

    int imod(int x, int y) {
      return x - y * (x / y);
    }

    int idiv(int a, int b, float sign) {
      int res = a / b;
      int mod = imod(a, b);
      if (sign < 0. && mod != 0) {
        res -= 1;
      }
      return res;
    }

    //Based on the work of Dave Hoskins
    //https://www.shadertoy.com/view/4djSRW
    #define HASHSCALE1 443.8975
    float random(float seed){
      vec2 p = resultUV * seed;
      vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
      p3 += dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
    }

    ${gA}
    ${xA}
    ${bA}
  `}var gA=`
vec2 uvFromFlat(int texNumR, int texNumC, int index) {
  int texR = index / texNumC;
  int texC = index - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
vec2 packedUVfrom1D(int texNumR, int texNumC, int index) {
  int texelIndex = index / 2;
  int texR = texelIndex / texNumC;
  int texC = texelIndex - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
`,xA=`
vec2 packedUVfrom2D(int texelsInLogicalRow, int texNumR,
  int texNumC, int row, int col) {
  int texelIndex = (row / 2) * texelsInLogicalRow + (col / 2);
  int texR = texelIndex / texNumC;
  int texC = texelIndex - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
`,bA=`
vec2 packedUVfrom3D(int texNumR, int texNumC,
    int texelsInBatch, int texelsInLogicalRow, int b,
    int row, int col) {
  int index = b * texelsInBatch + (row / 2) * texelsInLogicalRow + (col / 2);
  int texR = index / texNumC;
  int texC = index - texR * texNumC;
  return (vec2(texC, texR) + halfCR) / vec2(texNumC, texNumR);
}
`,yA=`
  float getChannel(vec4 frag, vec2 innerDims) {
    vec2 modCoord = mod(innerDims, 2.);
    return modCoord.x == 0. ?
      (modCoord.y == 0. ? frag.r : frag.g) :
      (modCoord.y == 0. ? frag.b : frag.a);
  }
  float getChannel(vec4 frag, int dim) {
    float modCoord = mod(float(dim), 2.);
    return modCoord == 0. ? frag.r : frag.g;
  }
`;function D0(){return`
    int getOutputCoords() {
      return 0;
    }
  `}function wA(r,t,e){let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)];return o[0]===1?e?`
      int getOutputCoords() {
        return 2 * int(resultUV.x * ceil(float(outTexShape[1]) / 2.0));
      }
    `:`
      int getOutputCoords() {
        return 2 * int(resultUV.x * ${o[1]}.0);
      }
    `:o[1]===1?e?`
      int getOutputCoords() {
        return 2 * int(resultUV.y * ceil(float(outTexShape[0]) / 2.0));
      }
    `:`
      int getOutputCoords() {
        return 2 * int(resultUV.y * ${o[0]}.0);
      }
    `:e?`
    int getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));
      return 2 * (resTexRC.x * packedTexShape[1] + resTexRC.y);
    }
  `:`
    int getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));
      return 2 * (resTexRC.x * ${o[1]} + resTexRC.y);
    }
  `}function CA(r,t,e){return t[0]===1?e?`
      int getOutputCoords() {
        return int(resultUV.x * float(outTexShape[1]));
      }
    `:`
      int getOutputCoords() {
        return int(resultUV.x * ${t[1]}.0);
      }
    `:t[1]===1?e?`
      int getOutputCoords() {
        return int(resultUV.y * float(outTexShape[0]));
      }
    `:`
      int getOutputCoords() {
        return int(resultUV.y * ${t[0]}.0);
      }
    `:e?`
    int getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(outTexShape[0], outTexShape[1]));
      return resTexRC.x * outTexShape[1] + resTexRC.y;
    }
  `:`
    int getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${t[0]}, ${t[1]}));
      return resTexRC.x * ${t[1]} + resTexRC.y;
    }
  `}function vA(r,t,e){if(e)return`
    ivec3 getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      int texelsInLogicalRow = int(ceil(float(outShape[2]) / 2.0));
      int texelsInBatch = texelsInLogicalRow * int(ceil(float(outShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));
      int index = resTexRC.x * packedTexShape[1] + resTexRC.y;

      int b = index / texelsInBatch;
      index -= b * texelsInBatch;

      int r = 2 * (index / texelsInLogicalRow);
      int c = imod(index, texelsInLogicalRow) * 2;

      return ivec3(b, r, c);
    }
  `;let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)],n=Math.ceil(r[2]/2),s=n*Math.ceil(r[1]/2);return`
    ivec3 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));
      int index = resTexRC.x * ${o[1]} + resTexRC.y;

      int b = index / ${s};
      index -= b * ${s};

      int r = 2 * (index / ${n});
      int c = imod(index, ${n}) * 2;

      return ivec3(b, r, c);
    }
  `}function $A(r,t,e){if(e)return`
  ivec3 getOutputCoords() {
    ivec2 resTexRC = ivec2(resultUV.yx *
                           vec2(outTexShape[0], outTexShape[1]));
    int index = resTexRC.x * outTexShape[1] + resTexRC.y;
    ${Yo(["r","c","d"],r)}
    return ivec3(r, c, d);
  }
`;let o=Pe(["r","c","d"],r);return`
    ivec3 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;
      ${o}
      return ivec3(r, c, d);
    }
  `}function SA(r,t,e){if(e)return`
    ivec4 getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));
      int index = resTexRC.x * packedTexShape[1] + resTexRC.y;

      int texelsInLogicalRow = int(ceil(float(outShape[3]) / 2.0));
      int texelsInBatch = texelsInLogicalRow * int(ceil(float(outShape[2]) / 2.0));
      int texelsInBatchN = texelsInBatch * outShape[1];

      int b2 = index / texelsInBatchN;
      index -= b2 * texelsInBatchN;

      int b = index / texelsInBatch;
      index -= b * texelsInBatch;

      int r = 2 * (index / texelsInLogicalRow);
      int c = imod(index, texelsInLogicalRow) * 2;

      return ivec4(b2, b, r, c);
    }
  `;let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)],n=Math.ceil(r[r.length-1]/2),s=n*Math.ceil(r[r.length-2]/2),i=s,a="",l="b, r, c";for(let c=2;c<r.length-1;c++)i*=r[r.length-c-1],a=`
      int b${c} = index / ${i};
      index -= b${c} * ${i};
    `+a,l=`b${c}, `+l;return`
    ivec${r.length} getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));
      int index = resTexRC.x * ${o[1]} + resTexRC.y;

      ${a}

      int b = index / ${s};
      index -= b * ${s};

      int r = 2 * (index / ${n});
      int c = imod(index, ${n}) * 2;

      return ivec${r.length}(${l});
    }
  `}function TA(r,t,e){if(e)return`
    ivec4 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
        vec2(outTexShape[0], outTexShape[1]));
      int index = resTexRC.x * outTexShape[1] + resTexRC.y;
      ${Yo(["r","c","d","d2"],r)}
      return ivec4(r, c, d, d2);
    }
  `;let o=Pe(["r","c","d","d2"],r);return`
    ivec4 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
        vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;
      ${o}
      return ivec4(r, c, d, d2);
    }
  `}function EA(r,t){let e=Pe(["r","c","d","d2","d3"],r);return`
    ivec5 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx * vec2(${t[0]},
                             ${t[1]}));

      int index = resTexRC.x * ${t[1]} + resTexRC.y;

      ${e}

      ivec5 outShape = ivec5(r, c, d, d2, d3);
      return outShape;
    }
  `}function IA(r,t){let e=Pe(["r","c","d","d2","d3","d4"],r);return`
    ivec6 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
        vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;

      ${e}

      ivec6 result = ivec6(r, c, d, d2, d3, d4);
      return result;
    }
  `}function NA(r,t,e){let o=[Math.ceil(t[0]/2),Math.ceil(t[1]/2)];if(C.arraysEqual(r,t))return e?`
      ivec2 getOutputCoords() {
        ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
        return 2 * ivec2(resultUV.yx * vec2(packedTexShape[0], packedTexShape[1]));
      }
    `:`
      ivec2 getOutputCoords() {
        return 2 * ivec2(resultUV.yx * vec2(${o[0]}, ${o[1]}));
      }
    `;let n=Math.ceil(r[1]/2);return e?`
    ivec2 getOutputCoords() {
      ivec2 packedTexShape = ivec2(ceil(float(outTexShape[0]) / 2.0), ceil(float(outTexShape[1]) / 2.0));
      int texelsInLogicalRow = int(ceil(float(outShape[1]) / 2.0));
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(packedTexShape[0], packedTexShape[1]));

      int index = resTexRC.x * packedTexShape[1] + resTexRC.y;
      int r = 2 * (index / texelsInLogicalRow);
      int c = imod(index, texelsInLogicalRow) * 2;

      return ivec2(r, c);
    }
  `:`
    ivec2 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${o[0]}, ${o[1]}));

      int index = resTexRC.x * ${o[1]} + resTexRC.y;
      int r = 2 * (index / ${n});
      int c = imod(index, ${n}) * 2;

      return ivec2(r, c);
    }
  `}function kA(r,t,e){return C.arraysEqual(r,t)?e?`
      ivec2 getOutputCoords() {
        return ivec2(resultUV.yx * vec2(outTexShape[0], outTexShape[1]));
      }
    `:`
      ivec2 getOutputCoords() {
        return ivec2(resultUV.yx * vec2(${t[0]}, ${t[1]}));
      }
    `:r[1]===1?e?`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(outTexShape[0], outTexShape[1]));
        int index = resTexRC.x * outTexShape[1] + resTexRC.y;
        return ivec2(index, 0);
      }
    `:`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(${t[0]}, ${t[1]}));
        int index = resTexRC.x * ${t[1]} + resTexRC.y;
        return ivec2(index, 0);
      }
    `:r[0]===1?e?`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(outTexShape[0], outTexShape[1]));
        int index = resTexRC.x * outTexShape[1] + resTexRC.y;
        return ivec2(0, index);
      }
    `:`
      ivec2 getOutputCoords() {
        ivec2 resTexRC = ivec2(resultUV.yx *
                               vec2(${t[0]}, ${t[1]}));
        int index = resTexRC.x * ${t[1]} + resTexRC.y;
        return ivec2(0, index);
      }
    `:e?`
    ivec2 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(outTexShape[0], outTexShape[1]));
      int index = resTexRC.x * outTexShape[1] + resTexRC.y;
      int r = index / outShape[1];
      int c = index - r * outShape[1];
      return ivec2(r, c);
    }
  `:`
    ivec2 getOutputCoords() {
      ivec2 resTexRC = ivec2(resultUV.yx *
                             vec2(${t[0]}, ${t[1]}));
      int index = resTexRC.x * ${t[1]} + resTexRC.y;
      int r = index / ${r[1]};
      int c = index - r * ${r[1]};
      return ivec2(r, c);
    }
  `}function Zo(r){return`offset${r}`}function RA(r){let t=r.name,e="get"+t.charAt(0).toUpperCase()+t.slice(1),o=ht();return`
    vec4 ${e}() {
      return ${o.texture2D}(${t}, halfCR);
    }
  `}function AA(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1);if(r.shapeInfo.isUniform)return`float ${o}() {return ${e};}`;let[n,s]=r.shapeInfo.texShape;if(n===1&&s===1)return`
      float ${o}() {
        return sampleTexture(${e}, halfCR);
      }
    `;let i=Zo(e);if(t)return`
    float ${o}() {
      vec2 uv = uvFromFlat(${e}TexShape[0], ${e}TexShape[1], ${i});
      return sampleTexture(${e}, uv);
    }
  `;let[a,l]=r.shapeInfo.texShape;return`
    float ${o}() {
      vec2 uv = uvFromFlat(${a}, ${l}, ${i});
      return sampleTexture(${e}, uv);
    }
  `}function _A(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),n=r.shapeInfo.texShape,s=ht();if(t)return`
    vec4 ${o}(int index) {
      ivec2 packedTexShape = ivec2(ceil(float(${e}TexShape[0]) / 2.0), ceil(float(${e}TexShape[1]) / 2.0));
      vec2 uv = packedUVfrom1D(
        packedTexShape[0], packedTexShape[1], index);
      return ${s.texture2D}(${e}, uv);
    }
  `;let i=[Math.ceil(n[0]/2),Math.ceil(n[1]/2)];return`
    vec4 ${o}(int index) {
      vec2 uv = packedUVfrom1D(
        ${i[0]}, ${i[1]}, index);
      return ${s.texture2D}(${e}, uv);
    }
  `}function DA(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1);if(r.shapeInfo.isUniform)return`
      float ${o}(int index) {
        ${jn(r)}
      }
    `;let n=r.shapeInfo.texShape,s=n[0],i=n[1];if(i===1&&s===1)return`
      float ${o}(int index) {
        return sampleTexture(${e}, halfCR);
      }
    `;let a=Zo(e);return i===1?t?`
      float ${o}(int index) {
        vec2 uv = vec2(0.5, (float(index + ${a}) + 0.5) / float(${e}TexShape[0]));
        return sampleTexture(${e}, uv);
      }
    `:`
      float ${o}(int index) {
        vec2 uv = vec2(0.5, (float(index + ${a}) + 0.5) / ${s}.0);
        return sampleTexture(${e}, uv);
      }
    `:s===1?t?`
      float ${o}(int index) {
        vec2 uv = vec2((float(index + ${a}) + 0.5) / float(${e}TexShape[1]), 0.5);
        return sampleTexture(${e}, uv);
      }
    `:`
      float ${o}(int index) {
        vec2 uv = vec2((float(index + ${a}) + 0.5) / ${i}.0, 0.5);
        return sampleTexture(${e}, uv);
      }
    `:t?`
    float ${o}(int index) {
      vec2 uv = uvFromFlat(${e}TexShape[0], ${e}TexShape[1], index + ${a});
      return sampleTexture(${e}, uv);
    }
  `:`
    float ${o}(int index) {
      vec2 uv = uvFromFlat(${s}, ${i}, index + ${a});
      return sampleTexture(${e}, uv);
    }
  `}function FA(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=r.shapeInfo.texShape,i=s[0],a=s[1],l=ht();if(s!=null&&C.arraysEqual(e,s))return t?`
      vec4 ${n}(int row, int col) {
        vec2 uv = (vec2(col, row) + halfCR) / vec2(${o}TexShape[1], ${o}TexShape[0]);

        return ${l.texture2D}(${o}, uv);
      }
    `:`
      vec4 ${n}(int row, int col) {
        vec2 uv = (vec2(col, row) + halfCR) / vec2(${a}.0, ${i}.0);

        return ${l.texture2D}(${o}, uv);
      }
    `;if(t)return`
    vec4 ${n}(int row, int col) {
      ivec2 packedTexShape = ivec2(ceil(float(${o}TexShape[0]) / 2.0), ceil(float(${o}TexShape[1]) / 2.0));
      int valuesPerRow = int(ceil(float(${o}Shape[1]) / 2.0));
      vec2 uv = packedUVfrom2D(valuesPerRow, packedTexShape[0], packedTexShape[1], row, col);
      return ${l.texture2D}(${o}, uv);
    }
  `;let c=[Math.ceil(s[0]/2),Math.ceil(s[1]/2)],u=Math.ceil(e[1]/2);return`
    vec4 ${n}(int row, int col) {
      vec2 uv = packedUVfrom2D(${u}, ${c[0]}, ${c[1]}, row, col);
      return ${l.texture2D}(${o}, uv);
    }
  `}function PA(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=r.shapeInfo.texShape;if(s!=null&&C.arraysEqual(e,s)){if(t)return`
      float ${n}(int row, int col) {
        vec2 uv = (vec2(col, row) + halfCR) / vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `;let m=s[0],f=s[1];return`
    float ${n}(int row, int col) {
      vec2 uv = (vec2(col, row) + halfCR) / vec2(${f}.0, ${m}.0);
      return sampleTexture(${o}, uv);
    }
  `}let{newShape:i,keptDims:a}=C.squeezeShape(e),l=i;if(l.length<e.length){let m=Yn(r,l),f=["row","col"];return`
      ${Xn(m,t)}
      float ${n}(int row, int col) {
        return ${n}(${Zn(f,a)});
      }
    `}if(r.shapeInfo.isUniform)return`
      float ${n}(int row, int col) {
        int index = round(dot(vec2(row, col), vec2(${e[1]}, 1)));
        ${jn(r)}
      }
    `;let c=s[0],u=s[1],p=Zo(o);return u===1?t?`
      float ${n}(int row, int col) {
        float index = dot(vec3(row, col, ${p}), vec3(${o}Shape[1], 1, 1));
        vec2 uv = vec2(0.5, (index + 0.5) / float(${o}TexShape[0]));
        return sampleTexture(${o}, uv);
      }
    `:`
    float ${n}(int row, int col) {
      float index = dot(vec3(row, col, ${p}), vec3(${e[1]}, 1, 1));
      vec2 uv = vec2(0.5, (index + 0.5) / ${c}.0);
      return sampleTexture(${o}, uv);
    }
  `:c===1?t?`
      float ${n}(int row, int col) {
        float index = dot(vec3(row, col, ${p}), vec3(${o}Shape[1], 1, 1));
        vec2 uv = vec2((index + 0.5) / float(${o}TexShape[1]), 0.5);
        return sampleTexture(${o}, uv);
      }
    `:`
    float ${n}(int row, int col) {
      float index = dot(vec3(row, col, ${p}), vec3(${e[1]}, 1, 1));
      vec2 uv = vec2((index + 0.5) / ${u}.0, 0.5);
      return sampleTexture(${o}, uv);
    }
  `:t?`
      float ${n}(int row, int col) {
        // Explicitly use integer operations as dot() only works on floats.
        int index = row * ${o}Shape[1] + col + ${p};
        vec2 uv = uvFromFlat(${o}TexShape[0], ${o}TexShape[1], index);
        return sampleTexture(${o}, uv);
      }
    `:`
  float ${n}(int row, int col) {
    // Explicitly use integer operations as dot() only works on floats.
    int index = row * ${e[1]} + col + ${p};
    vec2 uv = uvFromFlat(${c}, ${u}, index);
    return sampleTexture(${o}, uv);
  }
`}function OA(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=r.shapeInfo.texShape,i=[Math.ceil(s[0]/2),Math.ceil(s[1]/2)];if(e[0]===1){let m=e.slice(1),f=[1,2],d=Yn(r,m),x=["b","row","col"];return`
        ${_0(d,t)}
        vec4 ${n}(int b, int row, int col) {
          return ${n}(${Zn(x,f)});
        }
      `}let a=ht();if(t)return`
    vec4 ${n}(int b, int row, int col) {
      ivec2 packedTexShape = ivec2(ceil(float(${o}TexShape[0]) / 2.0), ceil(float(${o}TexShape[1]) / 2.0));
      int valuesPerRow = int(ceil(float(${o}Shape[2]) / 2.0));
      int texelsInBatch = valuesPerRow * int(ceil(float(${o}Shape[1]) / 2.0));
      vec2 uv = packedUVfrom3D(
        packedTexShape[0], packedTexShape[1], texelsInBatch, valuesPerRow, b, row, col);
      return ${a.texture2D}(${o}, uv);
    }
  `;let l=i[0],c=i[1],u=Math.ceil(e[2]/2),p=u*Math.ceil(e[1]/2);return`
    vec4 ${n}(int b, int row, int col) {
      vec2 uv = packedUVfrom3D(
        ${l}, ${c}, ${p}, ${u}, b, row, col);
      return ${a.texture2D}(${o}, uv);
    }
  `}function MA(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=e[1]*e[2],i=e[2],{newShape:a,keptDims:l}=C.squeezeShape(e),c=a;if(c.length<e.length){let x=Yn(r,c),g=["row","col","depth"];return`
        ${Xn(x,t)}
        float ${n}(int row, int col, int depth) {
          return ${n}(${Zn(g,l)});
        }
      `}if(r.shapeInfo.isUniform)return`
      float ${n}(int row, int col, int depth) {
        int index = round(dot(vec3(row, col, depth),
                          vec3(${s}, ${i}, 1)));
        ${jn(r)}
      }
    `;let u=r.shapeInfo.texShape,p=u[0],m=u[1],f=r.shapeInfo.flatOffset;if(m===s&&f==null)return t?`
      float ${n}(int row, int col, int depth) {
        int stride1 = ${o}Shape[2];
        float texR = float(row);
        float texC = dot(vec2(col, depth), vec2(stride1, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
        float ${n}(int row, int col, int depth) {
          float texR = float(row);
          float texC = dot(vec2(col, depth), vec2(${i}, 1));
          vec2 uv = (vec2(texC, texR) + halfCR) /
                     vec2(${m}.0, ${p}.0);
          return sampleTexture(${o}, uv);
        }
      `;if(m===i&&f==null)return t?`
      float ${n}(int row, int col, int depth) {
        float texR = dot(vec2(row, col), vec2(${o}Shape[1], 1));
        float texC = float(depth);
        vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
    float ${n}(int row, int col, int depth) {
      float texR = dot(vec2(row, col), vec2(${e[1]}, 1));
      float texC = float(depth);
      vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${m}.0, ${p}.0);
      return sampleTexture(${o}, uv);
    }
  `;let d=Zo(o);return t?`
    float ${n}(int row, int col, int depth) {
      // Explicitly use integer operations as dot() only works on floats.
      int stride0 = ${o}Shape[1] * ${o}Shape[2];
      int stride1 = ${o}Shape[2];
      int index = row * stride0 + col * stride1 + depth + ${d};
      vec2 uv = uvFromFlat(${o}TexShape[0], ${o}TexShape[1], index);
      return sampleTexture(${o}, uv);
    }
    `:`
      float ${n}(int row, int col, int depth) {
        // Explicitly use integer operations as dot() only works on floats.
        int index = row * ${s} + col * ${i} + depth + ${d};
        vec2 uv = uvFromFlat(${p}, ${m}, index);
        return sampleTexture(${o}, uv);
      }
  `}function LA(r,t){let e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),n=ht();if(t)return`
    vec4 ${o}(int b2, int b, int row, int col) {
      int valuesPerRow = int(ceil(float(${e}Shape[3]) / 2.0));
      int texelsInBatch = valuesPerRow * int(ceil(float(${e}Shape[2]) / 2.0));
      int index = b * texelsInBatch + (row / 2) * valuesPerRow + (col / 2);
      texelsInBatch *= ${e}Shape[1];
      index = b2 * texelsInBatch + index;
      ivec2 packedTexShape = ivec2(ceil(float(${e}TexShape[0]) / 2.0), ceil(float(${e}TexShape[1]) / 2.0));
      int texR = index / packedTexShape[1];
      int texC = index - texR * packedTexShape[1];
      vec2 uv = (vec2(texC, texR) + halfCR) / vec2(packedTexShape[1], packedTexShape[0]); return ${n.texture2D}(${e}, uv);
    }
  `;let s=r.shapeInfo.logicalShape,i=s.length,a=r.shapeInfo.texShape,l=[Math.ceil(a[0]/2),Math.ceil(a[1]/2)],c=l[0],u=l[1],p=Math.ceil(s[i-1]/2),m=p*Math.ceil(s[i-2]/2),f="int b, int row, int col",d=`b * ${m} + (row / 2) * ${p} + (col / 2)`;for(let x=2;x<i-1;x++)f=`int b${x}, `+f,m*=s[i-x-1],d=`b${x} * ${m} + `+d;return`
    vec4 ${o}(${f}) {
      int index = ${d};
      int texR = index / ${u};
      int texC = index - texR * ${u};
      vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${u}, ${c});
      return ${n.texture2D}(${e}, uv);
    }
  `}function BA(r,t){let e=r.shapeInfo.logicalShape,o=r.name,n="get"+o.charAt(0).toUpperCase()+o.slice(1),s=e[3],i=e[2]*s,a=e[1]*i,{newShape:l,keptDims:c}=C.squeezeShape(e);if(l.length<e.length){let $=Yn(r,l),S=["row","col","depth","depth2"];return`
      ${Xn($,t)}
      float ${n}(int row, int col, int depth, int depth2) {
        return ${n}(${Zn(S,c)});
      }
    `}if(r.shapeInfo.isUniform)return`
      float ${n}(int row, int col, int depth, int depth2) {
        int index = round(dot(vec4(row, col, depth, depth2),
                          vec4(${a}, ${i}, ${s}, 1)));
        ${jn(r)}
      }
    `;let u=r.shapeInfo.flatOffset,p=r.shapeInfo.texShape,m=p[0],f=p[1],d=`int stride2 = ${o}Shape[3];`,x=`int stride1 = ${o}Shape[2] * stride2;`,g=`int stride0 = ${o}Shape[1] * stride1;`;if(f===a&&u==null)return t?`
      float ${n}(int row, int col, int depth, int depth2) {
        ${d}
        ${x}
        float texR = float(row);
        float texC =
            dot(vec3(col, depth, depth2),
                vec3(stride1, stride2, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
      float ${n}(int row, int col, int depth, int depth2) {
        float texR = float(row);
        float texC =
            dot(vec3(col, depth, depth2),
                vec3(${i}, ${s}, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${f}.0, ${m}.0);
        return sampleTexture(${o}, uv);
      }
    `;if(f===s&&u==null)return t?`
      float ${n}(int row, int col, int depth, int depth2) {
        float texR = dot(vec3(row, col, depth),
                         vec3(${o}Shape[1] * ${o}Shape[2], ${o}Shape[2], 1));
        float texC = float(depth2);
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${o}TexShape[1], ${o}TexShape[0]);
        return sampleTexture(${o}, uv);
      }
    `:`
      float ${n}(int row, int col, int depth, int depth2) {
        float texR = dot(vec3(row, col, depth),
                         vec3(${e[1]*e[2]}, ${e[2]}, 1));
        float texC = float(depth2);
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${f}.0, ${m}.0);
        return sampleTexture(${o}, uv);
      }
    `;let b=Zo(o);return t?`
    float ${n}(int row, int col, int depth, int depth2) {
      // Explicitly use integer operations as dot() only works on floats.
      ${d}
      ${x}
      ${g}
      int index = row * stride0 + col * stride1 +
          depth * stride2 + depth2;
      vec2 uv = uvFromFlat(${o}TexShape[0], ${o}TexShape[1], index + ${b});
      return sampleTexture(${o}, uv);
    }
  `:`
    float ${n}(int row, int col, int depth, int depth2) {
      // Explicitly use integer operations as dot() only works on floats.
      int index = row * ${a} + col * ${i} +
          depth * ${s} + depth2;
      vec2 uv = uvFromFlat(${m}, ${f}, index + ${b});
      return sampleTexture(${o}, uv);
    }
  `}function GA(r){let t=r.shapeInfo.logicalShape,e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),n=t[4],s=t[3]*n,i=t[2]*s,a=t[1]*i,{newShape:l,keptDims:c}=C.squeezeShape(t);if(l.length<t.length){let x=Yn(r,l),g=["row","col","depth","depth2","depth3"];return`
      ${Xn(x)}
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        return ${o}(${Zn(g,c)});
      }
    `}if(r.shapeInfo.isUniform)return`
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        float index = dot(
          vec4(row, col, depth, depth2),
          vec4(${a}, ${i}, ${s}, ${n})) +
          depth3;
        ${jn(r)}
      }
    `;let u=r.shapeInfo.flatOffset,p=r.shapeInfo.texShape,m=p[0],f=p[1];if(f===a&&u==null)return`
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        int texR = row;
        float texC = dot(vec4(col, depth, depth2, depth3),
                         vec4(${i}, ${s}, ${n}, 1));
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${f}.0, ${m}.0);
        return sampleTexture(${e}, uv);
      }
    `;if(f===n&&u==null)return`
      float ${o}(int row, int col, int depth, int depth2, int depth3) {
        float texR = dot(
          vec4(row, col, depth, depth2),
          vec4(${t[1]*t[2]*t[3]},
               ${t[2]*t[3]}, ${t[3]}, 1));
        int texC = depth3;
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${f}.0, ${m}.0);
        return sampleTexture(${e}, uv);
      }
    `;let d=Zo(e);return`
    float ${o}(int row, int col, int depth, int depth2, int depth3) {
      // Explicitly use integer operations as dot() only works on floats.
      int index = row * ${a} + col * ${i} + depth * ${s} +
          depth2 * ${n} + depth3 + ${d};
      vec2 uv = uvFromFlat(${m}, ${f}, index);
      return sampleTexture(${e}, uv);
    }
  `}function UA(r){let t=r.shapeInfo.logicalShape,e=r.name,o="get"+e.charAt(0).toUpperCase()+e.slice(1),{newShape:n,keptDims:s}=C.squeezeShape(t);if(n.length<t.length){let g=Yn(r,n),b=["row","col","depth","depth2","depth3","depth4"];return`
      ${Xn(g)}
      float ${o}(int row, int col, int depth,
                    int depth2, int depth3, int depth4) {
        return ${o}(${Zn(b,s)});
      }
    `}let i=t[5],a=t[4]*i,l=t[3]*a,c=t[2]*l,u=t[1]*c;if(r.shapeInfo.isUniform)return`
      float ${o}(int row, int col, int depth,
                  int depth2, int depth3, int depth4) {
        int index = round(dot(
          vec4(row, col, depth, depth2),
          vec4(${u}, ${c}, ${l}, ${a})) +
          dot(
            vec2(depth3, depth4),
            vec2(${i}, 1)));
        ${jn(r)}
      }
    `;let p=r.shapeInfo.flatOffset,m=r.shapeInfo.texShape,f=m[0],d=m[1];if(d===u&&p==null)return`
      float ${o}(int row, int col, int depth,
                    int depth2, int depth3, int depth4) {
        int texR = row;
        float texC = dot(vec4(col, depth, depth2, depth3),
          vec4(${c}, ${l}, ${a}, ${i})) +
               float(depth4);
        vec2 uv = (vec2(texC, texR) + halfCR) /
                   vec2(${d}.0, ${f}.0);
        return sampleTexture(${e}, uv);
      }
    `;if(d===i&&p==null)return`
      float ${o}(int row, int col, int depth,
                    int depth2, int depth3, int depth4) {
        float texR = dot(vec4(row, col, depth, depth2),
          vec4(${t[1]*t[2]*t[3]*t[4]},
               ${t[2]*t[3]*t[4]},
               ${t[3]*t[4]},
               ${t[4]})) + float(depth3);
        int texC = depth4;
        vec2 uv = (vec2(texC, texR) + halfCR) /
                  vec2(${d}.0, ${f}.0);
        return sampleTexture(${e}, uv);
      }
    `;let x=Zo(e);return`
    float ${o}(int row, int col, int depth,
                  int depth2, int depth3, int depth4) {
      // Explicitly use integer operations as dot() only works on floats.
      int index = row * ${u} + col * ${c} + depth * ${l} +
          depth2 * ${a} + depth3 * ${i} + depth4 + ${x};
      vec2 uv = uvFromFlat(${f}, ${d}, index);
      return sampleTexture(${e}, uv);
    }
  `}function jn(r){let t=r.name,e=C.sizeFromShape(r.shapeInfo.logicalShape);return e<2?`return ${t};`:`
    for (int i = 0; i < ${e}; i++) {
      if (i == index) {
        return ${t}[i];
      }
    }
  `}function VA(r,t){let e=r.name,o=e.charAt(0).toUpperCase()+e.slice(1),n="get"+o+"AtOutCoords",s=r.shapeInfo.logicalShape.length,i=t.logicalShape.length,a=R0(r.shapeInfo.logicalShape,t.logicalShape),l=K(i),c=i-s,u,p=["x","y","z","w","u","v"];s===0?u="":i<2&&a.length>=1?u="coords = 0;":u=a.map($=>`coords.${p[$+c]} = 0;`).join(`
`);let m="";i<2&&s>0?m="coords":m=r.shapeInfo.logicalShape.map(($,S)=>`coords.${p[S+c]}`).join(", ");let f="return outputValue;",x=C.sizeFromShape(r.shapeInfo.logicalShape)===1,b=C.sizeFromShape(t.logicalShape)===1;if(s===1&&!x&&!b)f=`
      return vec4(outputValue.xy, outputValue.xy);
    `;else if(x&&!b)i===1?f=`
        return vec4(outputValue.x, outputValue.x, 0., 0.);
      `:f=`
        return vec4(outputValue.x);
      `;else if(a.length){let $=s-2,S=s-1;a.indexOf($)>-1&&a.indexOf(S)>-1?f="return vec4(outputValue.x);":a.indexOf($)>-1?f="return vec4(outputValue.x, outputValue.y, outputValue.x, outputValue.y);":a.indexOf(S)>-1&&(f="return vec4(outputValue.xx, outputValue.zz);")}return`
    vec4 ${n}() {
      ${l} coords = getOutputCoords();
      ${u}
      vec4 outputValue = get${o}(${m});
      ${f}
    }
  `}function WA(r,t){let e=r.name,o=e.charAt(0).toUpperCase()+e.slice(1),n="get"+o+"AtOutCoords",s=t.texShape,i=r.shapeInfo.texShape,a=r.shapeInfo.logicalShape.length,l=t.logicalShape.length;if(!r.shapeInfo.isUniform&&a===l&&r.shapeInfo.flatOffset==null&&C.arraysEqual(i,s))return`
      float ${n}() {
        return sampleTexture(${e}, resultUV);
      }
    `;let c=K(l),u=R0(r.shapeInfo.logicalShape,t.logicalShape),p=l-a,m,f=["x","y","z","w","u","v"];a===0?m="":l<2&&u.length>=1?m="coords = 0;":m=u.map(x=>`coords.${f[x+p]} = 0;`).join(`
`);let d="";return l<2&&a>0?d="coords":d=r.shapeInfo.logicalShape.map((x,g)=>`coords.${f[g+p]}`).join(", "),`
    float ${n}() {
      ${c} coords = getOutputCoords();
      ${m}
      return get${o}(${d});
    }
  `}function K(r){if(r<=1)return"int";if(r===2)return"ivec2";if(r===3)return"ivec3";if(r===4)return"ivec4";if(r===5)return"ivec5";if(r===6)return"ivec6";throw Error(`GPU for rank ${r} is not yet supported`)}function Mc(r,t,e){let{newShape:o,keptDims:n}=C.squeezeShape(t),s=t.length,i=r&&s===3&&t[0]===1,a=i?t.slice(1):o,l=!r&&s>1&&!C.arraysEqual(t,e)&&o.length<s||i;return{useSqueezeShape:l,uniformShape:l?a:t,keptDims:n}}function Yn(r,t){let e=JSON.parse(JSON.stringify(r));return e.shapeInfo.logicalShape=t,e}function Zn(r,t){return t.map(e=>r[e]).join(", ")}function P0(r,t,e,o){let n=e.map((u,p)=>{let m={logicalShape:u.shape,texShape:u.isUniform?null:u.texData.texShape,isUniform:u.isUniform,isPacked:u.isUniform?!1:u.texData.isPacked,flatOffset:null};return u.texData!=null&&u.texData.slice!=null&&u.texData.slice.flatOffset>0&&(m.flatOffset=u.texData.slice.flatOffset),{name:t.variableNames[p],shapeInfo:m}}),s=n.map(u=>u.shapeInfo),i={logicalShape:o.shape,texShape:o.texData.texShape,isUniform:!1,isPacked:o.texData.isPacked,flatOffset:null},a=A0(n,i,t),l=p0(r.gl,a),c=r.createProgram(l);return I().get("ENGINE_COMPILE_ONLY")?{program:t,fragmentShader:l,source:a,webGLProgram:c,inShapeInfos:s,outShapeInfo:i,variablesLocations:null,customUniformLocations:null,infLoc:null,nanLoc:null,outShapeLocation:null,outShapeStridesLocation:null,outTexShapeLocation:null}:(r.buildVao(c),Object.assign({program:t,fragmentShader:l,source:a,webGLProgram:c,inShapeInfos:s,outShapeInfo:i},lf(r,t,c)))}function lf(r,t,e){let o=[],n=[],s,i,a,l=null,c=null;c=r.getUniformLocation(e,"NAN",!1),I().getNumber("WEBGL_VERSION")===1&&(l=r.getUniformLocation(e,"INFINITY",!1));let u=!1;for(let p of t.variableNames){let m={name:p,uniform:r.getUniformLocation(e,p,u),offset:r.getUniformLocation(e,`offset${p}`,u)};t.enableShapeUniforms&&(m.shape=r.getUniformLocation(e,`${p}Shape`,u),m.texShape=r.getUniformLocation(e,`${p}TexShape`,u)),o.push(m)}if(t.enableShapeUniforms&&(s=r.getUniformLocation(e,"outShape",u),a=r.getUniformLocation(e,"outShapeStrides",u),i=r.getUniformLocation(e,"outTexShape",u)),t.customUniforms)for(let p of t.customUniforms)n.push(r.getUniformLocation(e,p.name,u));return{variablesLocations:o,customUniformLocations:n,infLoc:l,nanLoc:c,outShapeLocation:s,outShapeStridesLocation:a,outTexShapeLocation:i}}function F0(r,t){if(r.length!==t.length)throw Error(`Binary was compiled with ${r.length} inputs, but was executed with ${t.length} inputs`);r.forEach((e,o)=>{let n=e.logicalShape,s=t[o],i=s.shape;if(!C.arraysEqual(n,i))throw Error(`Binary was compiled with different shapes than the current args. Shapes ${n} and ${i} must match`);if(e.isUniform&&s.isUniform)return;let a=e.texShape,l=s.isUniform?null:s.texData.texShape;if(!C.arraysEqual(a,l))throw Error(`Binary was compiled with different texture shapes than the current args. Shape ${a} and ${l} must match`)})}function O0(r,t,e,o,n){t.program.enableShapeUniforms||(F0(t.inShapeInfos,e),F0([t.outShapeInfo],[o]));let s=o.texData.texture,i=o.texData.texShape;o.texData.isPacked?r.setOutputPackedMatrixTexture(s.texture,i[0],i[1]):r.setOutputMatrixTexture(s.texture,i[0],i[1]),r.setProgram(t.webGLProgram),r.bindVertexArray(t.webGLProgram.vao),I().getNumber("WEBGL_VERSION")===1&&t.infLoc!==null&&r.gl.uniform1f(t.infLoc,1/0),t.nanLoc!==null&&r.gl.uniform1f(t.nanLoc,NaN);for(let l=0;l<e.length;++l){let c=e[l],{uniform:u,offset:p,shape:m,texShape:f}=t.variablesLocations[l];if(m){let{uniformShape:d}=Mc(t.program.packedInputs,c.shape,c.texData.texShape);switch(d.length){case 1:r.gl.uniform1iv(m,new Int32Array(d));break;case 2:r.gl.uniform2iv(m,new Int32Array(d));break;case 3:r.gl.uniform3iv(m,new Int32Array(d));break;case 4:r.gl.uniform4iv(m,new Int32Array(d));break;default:break}}if(f&&r.gl.uniform2i(f,c.texData.texShape[0],c.texData.texShape[1]),u!=null){if(c.isUniform){if(C.sizeFromShape(c.shape)<2)r.gl.uniform1f(u,c.uniformValues[0]);else{let d=c.uniformValues;d instanceof Float32Array||(d=new Float32Array(d)),r.gl.uniform1fv(u,d)}continue}c.texData.slice!=null&&p!=null&&r.gl.uniform1i(p,c.texData.slice.flatOffset),r.setInputMatrixTexture(c.texData.texture.texture,u,l)}}let a=t.outShapeLocation;if(a)switch(o.shape.length){case 1:r.gl.uniform1iv(a,new Int32Array(o.shape));break;case 2:r.gl.uniform2iv(a,new Int32Array(o.shape));break;case 3:r.gl.uniform3iv(a,new Int32Array(o.shape));break;case 4:r.gl.uniform4iv(a,new Int32Array(o.shape));break;default:break}if(t.outShapeStridesLocation){let l=C.computeStrides(o.shape);switch(o.shape.length){case 2:r.gl.uniform1iv(t.outShapeStridesLocation,new Int32Array(l));break;case 3:r.gl.uniform2iv(t.outShapeStridesLocation,new Int32Array(l));break;case 4:r.gl.uniform3iv(t.outShapeStridesLocation,new Int32Array(l));break;default:break}}if(t.outTexShapeLocation&&r.gl.uniform2i(t.outTexShapeLocation,o.texData.texShape[0],o.texData.texShape[1]),t.program.customUniforms&&n)for(let l=0;l<t.program.customUniforms.length;++l){let c=t.program.customUniforms[l],u=t.customUniformLocations[l],p=n[l];if(c.type==="float")r.gl.uniform1fv(u,p);else if(c.type==="vec2")r.gl.uniform2fv(u,p);else if(c.type==="vec3")r.gl.uniform3fv(u,p);else if(c.type==="vec4")r.gl.uniform4fv(u,p);else if(c.type==="int")r.gl.uniform1iv(u,p);else if(c.type==="ivec2")r.gl.uniform2iv(u,p);else if(c.type==="ivec3")r.gl.uniform3iv(u,p);else if(c.type==="ivec4")r.gl.uniform4iv(u,p);else throw Error(`uniform type ${c.type} is not supported yet.`)}r.executeProgram()}function M0(r,t,e){let o="";t.concat(e).forEach(i=>{let a=i.texData!=null&&i.texData.slice!=null&&i.texData.slice.flatOffset>0;if(r.enableShapeUniforms&&!i.isUniform){let l=i.texData.texShape,{useSqueezeShape:c,uniformShape:u,keptDims:p}=Mc(r.packedInputs,i.shape,l),m="",f="",d="";if(u.length===1&&r.packedInputs){let N=[Math.ceil(l[0]/2),Math.ceil(l[1]/2)];m=`${N[0]>1}_${N[1]>1}`}else if(u.length===2&&!r.packedInputs)f=`${u[0]>1}_${u[1]>1}`;else if(u.length>2&&!r.packedInputs){let N=C.computeStrides(u);d=`${N[0]===l[1]}_${N[N.length-1]===l[1]}`}let x=i.shape.length,g=u.length===2&&C.arraysEqual(i.shape,l),b=C.sizeFromShape(i.shape)===1,$=T.getBroadcastDims(i.shape,e.shape),S=!r.packedInputs&&x===e.shape.length&&C.arraysEqual(l,e.texData.texShape),E=r.packedInputs||u.length>2?"":`${l[0]>1}_${l[1]>1}`;o+=`${x}_${S}_${c?p:""}_${u.length}_${b}_${$}_${g}_${m}_${f}_${d}_${E}_${a}`}else{let l=i.isUniform?"uniform":i.texData.texShape;o+=`${i.shape}_${l}_${a}`}});let n=r.userCode,s=r.constructor.name;return s+="_"+o+"_"+n+`${I().getNumber("WEBGL_VERSION")}`,s}function it(r){return I().getBool("WEBGL_USE_SHAPES_UNIFORMS")&&r<=4}var Lc=class{constructor(t){this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0,this.outPackingScheme=Xr.DENSE,this.customUniforms=[{name:"texShape",type:"ivec2"}];let e=ht();this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length),this.userCode=`
      ivec3 outCoordsFromFlatIndex(int index) {
        ${this.enableShapeUniforms?Yo(["r","c","d"],t):Pe(["r","c","d"],t)}
        return ivec3(r, c, d);
      }

      void main() {
        ivec2 resTexRC = ivec2(resultUV.yx * vec2(texShape[0], texShape[1]));
        int index = 4 * (resTexRC.x * texShape[1] + resTexRC.y);

        vec4 result = vec4(0.);

        for (int i=0; i<4; i++) {
          int flatIndex = index + i;
          ivec3 rc = outCoordsFromFlatIndex(flatIndex);
          result[i] = getA(rc.x, rc.y, rc.z);
        }

        ${e.output} = result;
      }
    `}};var Bc=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outPackingScheme=Xr.DENSE,this.customUniforms=[{name:"texShape",type:"ivec2"}];let e=ht();this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length),this.userCode=`
      ivec3 outCoordsFromFlatIndex(int index) {
        ${this.enableShapeUniforms?Yo(["r","c","d"],t):Pe(["r","c","d"],t)}
        return ivec3(r, c, d);
      }

      void main() {
        ivec2 resTexRC = ivec2(resultUV.yx * vec2(texShape[0], texShape[1]));
        int index = 4 * (resTexRC.x * texShape[1] + resTexRC.y);

        vec4 result = vec4(0.);

        for (int i=0; i<4; i++) {
          int flatIndex = index + i;
          ivec3 rc = outCoordsFromFlatIndex(flatIndex);
          result[i] = getChannel(getA(rc.x, rc.y, rc.z), vec2(rc.y, rc.z));
        }

        ${e.output} = result;
      }
    `}};var Gc=class{constructor(t){this.variableNames=["A"],this.outTexUsage=zt.DOWNLOAD;let e=ht();this.outputShape=t,this.userCode=`
      ${Oc}

      void main() {
        float x = getAAtOutCoords();
        ${e.output} = encode_float(x);
      }
    `}};var Uc=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!1,this.outTexUsage=zt.DOWNLOAD;let e=ht();this.outputShape=t,this.userCode=`
      ${Oc}

      void main() {
        ivec3 coords = getOutputCoords();
        float x = getChannel(getAAtOutCoords(), vec2(coords.y, coords.z));
        ${e.output} = encode_float(x);
      }
    `}};var HA={R:0,G:1,B:2,A:3},Ga=class{constructor(t,e=!1,o="RGBA"){this.variableNames=["A"],this.customUniforms=[{name:"texShape",type:"ivec2"}];let n=ht();this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length);let s="result";e&&(s="floor(result * 255. + 0.5)");let i="";for(let a=0;a<o.length;a++){let l=o[a];i+=`
          if(offset == ${a}) {
            result = values[${HA[l]}];
          }`}this.userCode=`
      ${this.enableShapeUniforms?Hn():Kn(t)}

      void main() {
        ivec3 coords = getOutputCoords();
        int flatIndex = getFlatIndex(coords);
        float result = 0.;
        int offset = imod(flatIndex, ${o.length});

        flatIndex = idiv(flatIndex, ${o.length}, 1.);

        int r = flatIndex / texShape[1];
        if (r < texShape[0]) {
          int c = imod(flatIndex, texShape[1]);
          vec2 uv = (vec2(c, r) + halfCR) / vec2(texShape[1], texShape[0]);
          vec4 values = ${n.texture2D}(A, uv);
          ${i}
        }
        ${n.output} = vec4(${s}, 0., 0., 0.);
      }
    `}};var Vc=class{constructor(t,e=!1){this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0,this.customUniforms=[{name:"texShape",type:"ivec2"}];let o=ht();this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length);let n="",s="result";e&&(s="floor(result * 255. + 0.5)");for(let i=0;i<=1;i++)for(let a=0;a<=1;a++){let l=i*2+a;n+=`
          localCoords = coords;
          if(localCoords[2] + ${a} < ${this.enableShapeUniforms?"outShape[2]":`${t[2]}`}) {
          localCoords[2] += ${a};
          if (localCoords[1] + ${i} < ${this.enableShapeUniforms?"outShape[1]":`${t[1]}`}) {
            localCoords[1] += ${i};

            flatIndex = getFlatIndex(localCoords);
            offset = imod(flatIndex, 4);

            flatIndex = idiv(flatIndex, 4, 1.);

            int r = flatIndex / texShape[1];
            int c = imod(flatIndex, texShape[1]);
            vec2 uv = (vec2(c, r) + halfCR) / vec2(texShape[1], texShape[0]);
            values = ${o.texture2D}(A, uv);

            if (offset == 0) {
              result[${l}] = values[0];
            } else if (offset == 1) {
              result[${l}] = values[1];
            } else if (offset == 2) {
              result[${l}] = values[2];
            } else {
              result[${l}] = values[3];
            }
          }
        }
        `}this.userCode=`
        ${this.enableShapeUniforms?Hn():Kn(t)}

        void main() {
          ivec3 coords = getOutputCoords();

          vec4 result = vec4(0.);
          int flatIndex, r, c, offset;
          ivec3 localCoords;
          vec2 uv;
          vec4 values;

          ${n}

          ${o.output} = ${s};
        }
    `}};function L0(r){let t=ht(),e=`${t.version}
    precision highp float;
    ${t.attribute} vec3 clipSpacePos;
    ${t.attribute} vec2 uv;
    ${t.varyingVs} vec2 resultUV;

    void main() {
      gl_Position = vec4(clipSpacePos, 1);
      resultUV = uv;
    }`;return u0(r,e)}function B0(r){let t=new Float32Array([-1,1,0,0,1,-1,-1,0,0,0,1,1,0,1,1,1,-1,0,1,0]);return d0(r,t)}function G0(r){let t=new Uint16Array([0,1,2,2,1,3]);return h0(r,t)}function Ua(r,t,e,o,n,s){x0(t,e);let i=g0(r),a=r.TEXTURE_2D;return L(r,()=>r.bindTexture(a,i)),L(r,()=>r.texParameteri(a,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE)),L(r,()=>r.texParameteri(a,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE)),L(r,()=>r.texParameteri(a,r.TEXTURE_MIN_FILTER,r.NEAREST)),L(r,()=>r.texParameteri(a,r.TEXTURE_MAG_FILTER,r.NEAREST)),I().getNumber("WEBGL_VERSION")===1?L(r,()=>r.texImage2D(a,0,o,t,e,0,n,s,null)):L(r,()=>r.texStorage2D(a,1,o,t,e)),L(r,()=>r.bindTexture(r.TEXTURE_2D,null)),{texture:i,texShape:[e,t]}}function cf(r){return r.internalFormatFloat}function U0(r,t,e,o){let[n,s]=Xo(t,e);return Ua(r,n,s,cf(o),o.textureFormatFloat,r.FLOAT)}function uf(r){return r.internalFormatHalfFloat}function V0(r,t,e,o){let[n,s]=Xo(t,e);return Ua(r,n,s,uf(o),o.textureFormatFloat,o.textureTypeHalfFloat)}function pf(r){return r.downloadTextureFormat}function W0(r,t,e,o){let[n,s]=Xo(t,e);return Ua(r,n,s,pf(o),r.RGBA,r.UNSIGNED_BYTE)}function mf(r){return r.internalFormatPackedFloat}function z0(r,t,e,o){let[n,s]=rr(t,e);return Ua(r,n,s,mf(o),r.RGBA,r.FLOAT)}function ff(r){return r.internalFormatPackedHalfFloat}function K0(r,t,e,o){let[n,s]=rr(t,e);return Ua(r,n,s,ff(o),r.RGBA,o.textureTypeHalfFloat)}function H0(r,t,e){return L(r,()=>r.bindBuffer(r.ARRAY_BUFFER,e)),nf(r,t,"clipSpacePos",e,3,20,0)&&nf(r,t,"uv",e,2,20,12)}function q0(r,t,e,o,n,s){L(r,()=>r.bindTexture(r.TEXTURE_2D,t));let i,a,l;n instanceof Uint8Array?(i=new Uint8Array(e*o*4),a=r.UNSIGNED_BYTE,l=r.RGBA):(i=new Float32Array(e*o*4),a=r.FLOAT,l=s.internalFormatPackedFloat),i.set(n),I().getNumber("WEBGL_VERSION")===2?L(r,()=>r.texSubImage2D(r.TEXTURE_2D,0,0,0,e,o,r.RGBA,a,i)):L(r,()=>r.texImage2D(r.TEXTURE_2D,0,l,e,o,0,r.RGBA,a,i)),L(r,()=>r.bindTexture(r.TEXTURE_2D,null))}function X0(r,t,e){L(r,()=>r.bindTexture(r.TEXTURE_2D,t)),e.data instanceof Uint8Array?I().getNumber("WEBGL_VERSION")===2?L(r,()=>r.texSubImage2D(r.TEXTURE_2D,0,0,0,e.width,e.height,r.RGBA,r.UNSIGNED_BYTE,e.data)):L(r,()=>r.texImage2D(r.TEXTURE_2D,0,r.RGBA,e.width,e.height,0,r.RGBA,r.UNSIGNED_BYTE,e.data)):I().getNumber("WEBGL_VERSION")===2?L(r,()=>r.texSubImage2D(r.TEXTURE_2D,0,0,0,r.RGBA,r.UNSIGNED_BYTE,e)):L(r,()=>r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,e)),L(r,()=>r.bindTexture(r.TEXTURE_2D,null))}function j0(r,t,e,o){let n=r.createBuffer();L(r,()=>r.bindBuffer(r.PIXEL_PACK_BUFFER,n));let a=4*4*t*e;return L(r,()=>r.bufferData(r.PIXEL_PACK_BUFFER,a,r.STREAM_READ)),L(r,()=>r.readPixels(0,0,e,t,r.RGBA,r.FLOAT,0)),L(r,()=>r.bindBuffer(r.PIXEL_PACK_BUFFER,null)),n}function Y0(r,t,e){let o=r,n=new Float32Array(e);return o.bindBuffer(o.PIXEL_PACK_BUFFER,t),o.getBufferSubData(o.PIXEL_PACK_BUFFER,0,n),o.bindBuffer(o.PIXEL_PACK_BUFFER,null),n}function Z0(r,t,e,o){let[n,s]=Xo(t,e),i=4,a=new Uint8Array(a0(t*e,i));return L(r,()=>r.readPixels(0,0,n,s,o.downloadTextureFormat,r.UNSIGNED_BYTE,a)),new Float32Array(a.buffer)}function Q0(r,t,e,o,n,s,i,a){let l=r,c=new Float32Array(l0(s,i));return l.bindBuffer(l.PIXEL_PACK_BUFFER,t),l.getBufferSubData(l.PIXEL_PACK_BUFFER,0,c),l.bindBuffer(l.PIXEL_PACK_BUFFER,null),c}function J0(r,t,e){let o=new Float32Array(t*e*4);return L(r,()=>r.readPixels(0,0,e,t,r.RGBA,r.FLOAT,o)),o}var Qn=class{constructor(t){this.outputTexture=null,this.program=null,this.disposed=!1,this.itemsToPoll=[];let e=I().getNumber("WEBGL_VERSION");if(t!=null?(this.gl=t,i0(e,t)):this.gl=ue(e),t=this.gl,I().getNumber("WEBGL_VERSION")===2){let s=t;this.createVertexArray=()=>L(s,()=>s.createVertexArray()),this.bindVertexArray=i=>L(s,()=>s.bindVertexArray(i)),this.deleteVertexArray=i=>L(s,()=>s.deleteVertexArray(i)),this.getVertexArray=()=>L(s,()=>s.getParameter(s.VERTEX_ARRAY_BINDING))}else if(t!=null){let s=t.getExtension("OES_vertex_array_object");if(s==null)throw new Error("All WebGL1 implementations are expected to offer OES_vertex_array_object.");this.createVertexArray=()=>L(t,()=>s.createVertexArrayOES()),this.bindVertexArray=i=>L(t,()=>s.bindVertexArrayOES(i)),this.deleteVertexArray=i=>L(t,()=>s.deleteVertexArrayOES(i)),this.getVertexArray=()=>L(t,()=>t.getParameter(s.VERTEX_ARRAY_BINDING_OES))}let o="WEBGL_color_buffer_float",n="EXT_color_buffer_half_float";if(this.parallelCompilationExtension=this.gl.getExtension("KHR_parallel_shader_compile"),I().getNumber("WEBGL_VERSION")===1){let s="OES_texture_float",i="OES_texture_half_float";if(this.textureFloatExtension=Ma(this.gl,s),xe(this.gl,i))this.textureHalfFloatExtension=Ma(this.gl,i);else if(I().get("WEBGL_FORCE_F16_TEXTURES"))throw new Error("GL context does not support half float textures, yet the environment flag WEBGL_FORCE_F16_TEXTURES is set to true.");if(this.colorBufferFloatExtension=this.gl.getExtension(o),xe(this.gl,n))this.colorBufferHalfFloatExtension=Ma(this.gl,n);else if(I().get("WEBGL_FORCE_F16_TEXTURES"))throw new Error("GL context does not support color renderable half floats, yet the environment flag WEBGL_FORCE_F16_TEXTURES is set to true.")}else if(o="EXT_color_buffer_float",xe(this.gl,o))this.colorBufferFloatExtension=this.gl.getExtension(o);else if(xe(this.gl,n))this.colorBufferHalfFloatExtension=this.gl.getExtension(n);else throw new Error("GL context does not support color renderable floats");this.vertexBuffer=B0(this.gl),this.indexBuffer=G0(this.gl),this.framebuffer=b0(this.gl),this.textureConfig=Oa(this.gl,this.textureHalfFloatExtension)}get debug(){return I().getBool("DEBUG")}dispose(){if(this.disposed)return;this.program!=null&&console.warn("Disposing a GPGPUContext that still has a bound WebGLProgram. This is probably a resource leak, delete the program with GPGPUContext.deleteProgram before disposing."),this.outputTexture!=null&&console.warn("Disposing a GPGPUContext that still has a bound output matrix texture.  This is probably a resource leak, delete the output matrix texture with GPGPUContext.deleteMatrixTexture before disposing.");let t=this.gl;L(t,()=>t.finish()),L(t,()=>t.bindFramebuffer(t.FRAMEBUFFER,null)),L(t,()=>t.deleteFramebuffer(this.framebuffer)),L(t,()=>t.bindBuffer(t.ARRAY_BUFFER,null)),L(t,()=>t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,null)),L(t,()=>t.deleteBuffer(this.indexBuffer)),this.disposed=!0}createFloat32MatrixTexture(t,e){return this.throwIfDisposed(),U0(this.gl,t,e,this.textureConfig)}createFloat16MatrixTexture(t,e){return this.throwIfDisposed(),V0(this.gl,t,e,this.textureConfig)}createUnsignedBytesMatrixTexture(t,e){return this.throwIfDisposed(),W0(this.gl,t,e,this.textureConfig)}uploadPixelDataToTexture(t,e){this.throwIfDisposed(),X0(this.gl,t,e)}uploadDenseMatrixToTexture(t,e,o,n){this.throwIfDisposed(),q0(this.gl,t,e,o,n,this.textureConfig)}createFloat16PackedMatrixTexture(t,e){return this.throwIfDisposed(),K0(this.gl,t,e,this.textureConfig)}createPackedMatrixTexture(t,e){return this.throwIfDisposed(),z0(this.gl,t,e,this.textureConfig)}deleteMatrixTexture(t){this.throwIfDisposed(),this.outputTexture===t&&(sf(this.gl,this.framebuffer),this.outputTexture=null),L(this.gl,()=>this.gl.deleteTexture(t))}downloadByteEncodedFloatMatrixFromOutputTexture(t,e,o){return this.downloadMatrixDriver(t,()=>Z0(this.gl,e,o,this.textureConfig))}downloadPackedMatrixFromBuffer(t,e,o,n,s,i){return Q0(this.gl,t,e,o,n,s,i,this.textureConfig)}downloadFloat32MatrixFromBuffer(t,e){return Y0(this.gl,t,e)}createBufferFromTexture(t,e,o){this.bindTextureToFrameBuffer(t);let n=j0(this.gl,e,o,this.textureConfig);return this.unbindTextureToFrameBuffer(),n}createAndWaitForFence(){let t=this.createFence(this.gl);return this.pollFence(t)}createFence(t){let e,o;if(I().getBool("WEBGL_FENCE_API_ENABLED")){let n=t,s=n.fenceSync(n.SYNC_GPU_COMMANDS_COMPLETE,0);t.flush(),o=()=>{let i=n.clientWaitSync(s,0,0);return i===n.ALREADY_SIGNALED||i===n.CONDITION_SATISFIED},e=s}else I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")>0?(e=this.beginQuery(),this.endQuery(),o=()=>this.isQueryAvailable(e,I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION"))):o=()=>!0;return{query:e,isFencePassed:o}}downloadMatrixFromPackedTexture(t,e,o){return this.downloadMatrixDriver(t,()=>J0(this.gl,e,o))}createProgram(t){this.throwIfDisposed();let e=this.gl;this.vertexShader==null&&(this.vertexShader=L0(e));let o=m0(e);L(e,()=>e.attachShader(o,this.vertexShader)),L(e,()=>e.attachShader(o,t)),f0(e,o);let n=Object.assign(o,{vao:this.createVertexArray()});return this.debug&&Dc(e,n),n}buildVao(t){this.setProgram(t),this.bindVertexArray(t.vao);let e=this.gl;L(e,()=>e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,this.indexBuffer)),H0(e,t,this.vertexBuffer)}deleteProgram(t){this.throwIfDisposed(),t===this.program&&(this.program=null),t!=null&&(L(this.gl,()=>this.gl.deleteProgram(t)),this.deleteVertexArray(t.vao))}setProgram(t){this.throwIfDisposed(),this.program=t,this.program!=null&&this.debug&&Dc(this.gl,this.program),L(this.gl,()=>this.gl.useProgram(t))}getUniformLocation(t,e,o=!0){return this.throwIfDisposed(),o?y0(this.gl,t,e):w0(this.gl,t,e)}getAttributeLocation(t,e){return this.throwIfDisposed(),L(this.gl,()=>this.gl.getAttribLocation(t,e))}getUniformLocationNoThrow(t,e){return this.throwIfDisposed(),this.gl.getUniformLocation(t,e)}setInputMatrixTexture(t,e,o){this.throwIfDisposed(),this.throwIfNoProgram(),C0(this.gl,t,e,o)}setOutputMatrixTexture(t,e,o){this.setOutputMatrixTextureDriver(t,o,e)}setOutputPackedMatrixTexture(t,e,o){this.throwIfDisposed();let[n,s]=rr(e,o);this.setOutputMatrixTextureDriver(t,n,s)}setOutputMatrixWriteRegion(t,e,o,n){this.setOutputMatrixWriteRegionDriver(o,t,n,e)}setOutputPackedMatrixWriteRegion(t,e,o,n){throw new Error("setOutputPackedMatrixWriteRegion not implemented.")}debugValidate(){this.program!=null&&Dc(this.gl,this.program),La(this.gl)}executeProgram(){this.throwIfDisposed(),this.throwIfNoProgram();let t=this.gl;if(this.debug){let e=this.getVertexArray();console.assert(e===this.program.vao,"VAO changed between setProgram and executeProgram!"),this.debugValidate()}L(t,()=>t.drawElements(t.TRIANGLES,6,t.UNSIGNED_SHORT,0))}blockUntilAllProgramsCompleted(){this.throwIfDisposed(),L(this.gl,()=>this.gl.finish())}getQueryTimerExtension(){return this.disjointQueryTimerExtension==null&&(this.disjointQueryTimerExtension=Ma(this.gl,I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")===2?"EXT_disjoint_timer_query_webgl2":"EXT_disjoint_timer_query")),this.disjointQueryTimerExtension}getQueryTimerExtensionWebGL2(){return this.getQueryTimerExtension()}getQueryTimerExtensionWebGL1(){return this.getQueryTimerExtension()}beginQuery(){if(I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")===2){let o=this.gl,n=this.getQueryTimerExtensionWebGL2(),s=o.createQuery();return o.beginQuery(n.TIME_ELAPSED_EXT,s),s}let t=this.getQueryTimerExtensionWebGL1(),e=t.createQueryEXT();return t.beginQueryEXT(t.TIME_ELAPSED_EXT,e),e}endQuery(){if(I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION")===2){let e=this.gl,o=this.getQueryTimerExtensionWebGL2();e.endQuery(o.TIME_ELAPSED_EXT);return}let t=this.getQueryTimerExtensionWebGL1();t.endQueryEXT(t.TIME_ELAPSED_EXT)}async waitForQueryAndGetTime(t){return await C.repeatedTry(()=>this.disposed||this.isQueryAvailable(t,I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION"))),this.getQueryTime(t,I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_VERSION"))}getQueryTime(t,e){if(e===0)return null;if(e===2){let o=this.gl;return o.getQueryParameter(t,o.QUERY_RESULT)/1e6}else{let o=this.getQueryTimerExtensionWebGL1();return o.getQueryObjectEXT(t,o.QUERY_RESULT_EXT)/1e6}}isQueryAvailable(t,e){if(e===0)return!0;if(e===2){let o=this.gl,n=this.getQueryTimerExtensionWebGL2(),s=o.getQueryParameter(t,o.QUERY_RESULT_AVAILABLE);return this.disjoint==null&&(this.disjoint=this.gl.getParameter(n.GPU_DISJOINT_EXT)),s&&!this.disjoint}else{let o=this.getQueryTimerExtensionWebGL1(),n=o.getQueryObjectEXT(t,o.QUERY_RESULT_AVAILABLE_EXT);return this.disjoint==null&&(this.disjoint=this.gl.getParameter(o.GPU_DISJOINT_EXT)),n&&!this.disjoint}}pollFence(t){return new Promise(e=>{this.addItemToPoll(()=>t.isFencePassed(),()=>e())})}pollItems(){let t=XA(this.itemsToPoll.map(e=>e.isDoneFn));for(let e=0;e<=t;++e){let{resolveFn:o}=this.itemsToPoll[e];o()}this.itemsToPoll=this.itemsToPoll.slice(t+1)}addItemToPoll(t,e){if(this.itemsToPoll.push({isDoneFn:t,resolveFn:e}),this.itemsToPoll.length>1)return;let o;"setTimeoutCustom"in I().platform&&(o=I().platform.setTimeoutCustom.bind(I().platform)),C.repeatedTry(()=>(this.pollItems(),this.itemsToPoll.length===0),()=>0,null,o)}bindTextureToFrameBuffer(t){this.throwIfDisposed(),Fc(this.gl,t,this.framebuffer),this.debug&&La(this.gl)}unbindTextureToFrameBuffer(){this.outputTexture!=null?(Fc(this.gl,this.outputTexture,this.framebuffer),this.debug&&La(this.gl)):sf(this.gl,this.framebuffer)}downloadMatrixDriver(t,e){this.bindTextureToFrameBuffer(t);let o=e();return this.unbindTextureToFrameBuffer(),o}setOutputMatrixTextureDriver(t,e,o){this.throwIfDisposed();let n=this.gl;Fc(n,t,this.framebuffer),this.debug&&La(n),this.outputTexture=t,L(n,()=>n.viewport(0,0,e,o)),L(n,()=>n.scissor(0,0,e,o))}setOutputMatrixWriteRegionDriver(t,e,o,n){this.throwIfDisposed(),L(this.gl,()=>this.gl.scissor(t,e,o,n))}throwIfDisposed(){if(this.disposed)throw new Error("Attempted to use disposed GPGPUContext.")}throwIfNoProgram(){if(this.program==null)throw new Error("No GPU program is currently set.")}};function XA(r){let t=0;for(;t<r.length&&r[t]();++t);return t-1}var Lf={};Lt(Lf,{addImpl:()=>gf,bincountImpl:()=>ry,bincountReduceImpl:()=>oy,bitwiseAndImpl:()=>xf,castImpl:()=>hf,ceilImpl:()=>bf,concatImpl:()=>ny,equalImpl:()=>yf,expImpl:()=>wf,expm1Impl:()=>Cf,floorDivImpl:()=>$f,floorImpl:()=>vf,gatherNdImpl:()=>sy,gatherV2Impl:()=>iy,greaterEqualImpl:()=>Tf,greaterImpl:()=>Sf,lessEqualImpl:()=>If,lessImpl:()=>Ef,linSpaceImpl:()=>ay,logImpl:()=>Nf,maxImpl:()=>ly,maximumImpl:()=>kf,minimumImpl:()=>Rf,multiplyImpl:()=>Wa,negImpl:()=>cy,notEqualImpl:()=>Af,prodImpl:()=>py,raggedGatherImpl:()=>fy,raggedRangeImpl:()=>hy,raggedTensorToTensorImpl:()=>by,rangeImpl:()=>yy,rsqrtImpl:()=>Df,scatterImpl:()=>wy,sigmoidImpl:()=>Cy,simpleAbsImpl:()=>ty,sliceImpl:()=>vy,sparseFillEmptyRowsImpl:()=>$y,sparseReshapeImpl:()=>Sy,sparseSegmentReductionImpl:()=>Ty,sqrtImpl:()=>Ey,squaredDifferenceImpl:()=>Ff,staticRegexReplaceImpl:()=>Pf,stridedSliceImpl:()=>Iy,stringNGramsImpl:()=>Ny,stringSplitImpl:()=>ky,stringToHashBucketFastImpl:()=>Ry,subImpl:()=>Mf,tileImpl:()=>Ay,topKImpl:()=>Dy,transposeImpl:()=>uy,uniqueImpl:()=>Fy});function Wc(r,t){Array.isArray(r)||(r=[r]),r.forEach(e=>{e!=null&&C.assert(e.dtype!=="complex64",()=>`${t} does not support complex64 tensors in the CPU backend.`)})}function ty(r){let t=new Float32Array(r.length);for(let e=0;e<r.length;++e)t[e]=Math.abs(r[e]);return t}function ct(r){return(t,e,o,n,s)=>{let i=T.assertAndGetBroadcastShape(t,e),a=i.length,l=C.computeStrides(i),c=C.sizeFromShape(i),u=C.getTypedArrayFromDType(s,c),p=t.length,m=e.length,f=C.computeStrides(t),d=C.computeStrides(e),x=T.getBroadcastDims(t,i),g=T.getBroadcastDims(e,i);if(x.length+g.length===0)for(let b=0;b<u.length;++b)u[b]=r(o[b%o.length],n[b%n.length]);else for(let b=0;b<u.length;++b){let $=C.indexToLoc(b,a,l),S=$.slice(-p);x.forEach(A=>S[A]=0);let E=C.locToIndex(S,p,f),N=$.slice(-m);g.forEach(A=>N[A]=0);let R=C.locToIndex(N,m,d);u[b]=r(o[E],n[R])}return[u,i]}}function Jn(r){let{inputs:t,backend:e}=r,{real:o,imag:n}=t,s=e.data.get(o.dataId).values,i=e.data.get(n.dataId).values,a=e.makeTensorInfo(o.shape,"complex64"),l=e.data.get(a.dataId);return l.complexTensorInfos={real:e.makeTensorInfo(o.shape,"float32",s),imag:e.makeTensorInfo(n.shape,"float32",i)},a}function zc(r,t,e="float32"){if(e==="complex64"){let n=zc(r,t,"float32"),s=zc(r,t,"float32");return Jn({inputs:{real:n,imag:s},backend:r})}let o=C.makeZerosTypedArray(C.sizeFromShape(t),e);return r.makeTensorInfo(t,e,o)}function df(r){let{inputs:t,backend:e}=r,{x:o}=t;return e.incRef(o.dataId),{dataId:o.dataId,shape:o.shape,dtype:o.dtype}}function ey(r){let{inputs:t,backend:e}=r,{input:o}=t,n=e.data.get(o.dataId).complexTensorInfos.real,s=e.data.get(n.dataId).values;return e.makeTensorInfo(n.shape,n.dtype,s)}function hf(r,t,e,o){if(o==="int32"){let n=Int32Array.from(r);return[t,"int32",n]}if(o==="bool"){let n=C.toTypedArray([0],e),[s,i]=ct((a,l)=>a!==l?1:0)(t,[],r,n,"bool");return[i,"bool",s]}throw new Error(`Error in Cast: failed to cast ${e} to ${o}`)}function Va(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{dtype:s}=o;if(s==="complex64"){if(n.dtype==="complex64")return df({inputs:{x:n},backend:e});let u=zc(e,n.shape,n.dtype),p=Va({inputs:{x:n},backend:e,attrs:{dtype:"float32"}}),m=Jn({inputs:{real:p,imag:u},backend:e});return e.disposeIntermediateTensorInfo(u),e.disposeIntermediateTensorInfo(p),m}if(n.dtype==="complex64"){let u=ey({inputs:{input:n},backend:e}),p=Va({inputs:{x:u},backend:e,attrs:{dtype:s}});return e.disposeIntermediateTensorInfo(u),p}if(!C.hasEncodingLoss(n.dtype,s)){let u=df({inputs:{x:n},backend:e});return{dataId:u.dataId,shape:u.shape,dtype:s}}let i=e.data.get(n.dataId).values,[a,l,c]=hf(i,n.shape,n.dtype,s);return e.makeTensorInfo(a,l,c)}function pt(r,t,e,o){return e==null?({inputs:n,backend:s})=>{let{a:i,b:a}=n,l=s;Wc([i,a],r);let c=l.data.get(i.dataId).values,u=l.data.get(a.dataId).values,p=i.dtype==="string"?T.fromUint8ToStringArray(c):c,m=i.dtype==="string"?T.fromUint8ToStringArray(u):u,f=o||i.dtype,[d,x]=t(i.shape,a.shape,p,m,f);return l.makeTensorInfo(x,f,d)}:({inputs:n,backend:s})=>{let{a:i,b:a}=n,l=s;if(i.dtype==="complex64"||a.dtype==="complex64"){let c=Va({inputs:{x:i},backend:l,attrs:{dtype:"complex64"}}),u=l.data.get(c.dataId),p=u.complexTensorInfos.real,m=u.complexTensorInfos.imag,f=l.data.get(p.dataId).values,d=l.data.get(m.dataId).values,x=Va({inputs:{x:a},backend:l,attrs:{dtype:"complex64"}}),g=l.data.get(x.dataId),b=g.complexTensorInfos.real,$=g.complexTensorInfos.imag,S=l.data.get(b.dataId).values,E=l.data.get($.dataId).values,[N,R,A]=e(i.shape,a.shape,f,d,S,E),_=l.makeTensorInfo(A,"float32",N),P=l.makeTensorInfo(A,"float32",R),O=Jn({inputs:{real:_,imag:P},backend:l});return l.disposeIntermediateTensorInfo(c),l.disposeIntermediateTensorInfo(x),l.disposeIntermediateTensorInfo(_),l.disposeIntermediateTensorInfo(P),O}else{let c=l.data.get(i.dataId).values,u=l.data.get(a.dataId).values,p=o||i.dtype,[m,f]=t(i.shape,a.shape,c,u,p);return l.makeTensorInfo(f,p,m)}}}function ts(r){return(t,e,o,n,s,i)=>{let a=T.assertAndGetBroadcastShape(t,e),l=C.sizeFromShape(a),c=a.length,u=C.computeStrides(a),p=C.getTypedArrayFromDType("float32",l),m=C.getTypedArrayFromDType("float32",l),f=T.getBroadcastDims(t,a),d=T.getBroadcastDims(e,a),x=T.mergeRealAndImagArrays(o,n),g=T.mergeRealAndImagArrays(s,i),b=t.length,$=C.computeStrides(t),S=e.length,E=C.computeStrides(e);if(f.length+d.length===0)for(let N=0;N<p.length;N++){let R=N%x.length,A=N%g.length,_=r(x[R*2],x[R*2+1],g[A*2],g[A*2+1]);p[N]=_.real,m[N]=_.imag}else for(let N=0;N<p.length;N++){let R=C.indexToLoc(N,c,u),A=R.slice(-b);f.forEach(W=>A[W]=0);let _=C.locToIndex(A,b,$),P=R.slice(-S);d.forEach(W=>P[W]=0);let O=C.locToIndex(P,S,E),B=r(x[_*2],x[_*2+1],g[O*2],g[O*2+1]);p[N]=B.real,m[N]=B.imag}return[p,m,a]}}var gf=ct(((r,t)=>r+t)),jA=ts(((r,t,e,o)=>({real:r+e,imag:t+o}))),yht=pt("Add",gf,jA);function ry(r,t,e,o,n){let s=C.sizeFromShape(o),i=C.makeZerosTypedArray(n,e);for(let a=0;a<r.length;a++){let l=r[a];if(l<0)throw new Error("Input x must be non-negative!");l>=n||(s>0?i[l]+=t[a]:i[l]+=1)}return i}function oy(r,t,e,o=!1){let n=r.shape[0],s=r.shape[1],i=j([n,e],t.dtype);for(let a=0;a<n;a++)for(let l=0;l<s;l++){let c=r.get(a,l);if(c<0)throw new Error("Input x must be non-negative!");c>=e||(o?i.set(1,a,c):t.size>0?i.set(i.get(a,c)+t.get(a,l),a,c):i.set(i.get(a,c)+1,a,c))}return i}var xf=ct(((r,t)=>r&t)),Eht=pt(oo,xf);function Rt(r){return(t,e,o)=>{let n=C.getArrayFromDType(e,t.length);for(let s=0;s<t.length;++s)n[s]=r(t[s],o);return n}}function Kc(r,t,e){let o=Rt(t);return re(r,o,e)}function re(r,t,e){return({inputs:o,attrs:n,backend:s})=>{let{x:i}=o;Wc(i,r);let a=s,l=a.data.get(i.dataId).values,c;if(i.dtype==="string"){if(!Array.isArray(l))throw new Error("String tensor's value was not an instance of Array");c=T.fromUint8ToStringArray(l)}else c=l;let u=e||i.dtype,p=t(c,u,n);return a.makeTensorInfo(i.shape,u,p)}}var bf=Rt(r=>Math.ceil(r)),Mht=re(no,bf);function ny(r,t,e,o){let n=C.getArrayFromDType(e,C.sizeFromShape(t));if(o&&e!=="string"){let s=0;r.forEach(i=>{let a=C.sizeFromShape(i.shape);n.set(i.vals,s),s+=a})}else{let s=0;r.forEach(i=>{let a=e==="string"?T.fromUint8ToStringArray(i.vals):i.vals,l=0;for(let c=0;c<i.shape[0];++c){let u=c*t[1]+s;for(let p=0;p<i.shape[1];++p)n[u+p]=a[l++]}s+=i.shape[1]})}return n}var yf=ct((r,t)=>r===t?1:0),zht=pt(so,yf,null,"bool");var wf=Rt(r=>Math.exp(r)),jht=re("Exp",wf,"float32");var Cf=Rt(r=>Math.expm1(r)),tgt=re(io,Cf);var vf=Rt(r=>Math.floor(r)),sgt=re(ao,vf);var $f=ct((r,t)=>Math.floor(r/t)),ugt=pt(lo,$f,null,"int32");function sy(r,t,e,o,n,s,i,a,l){let c=j([o,s],e);for(let u=0;u<o;u++){let p=[],m=0;for(let f=0;f<n;f++){let d=r[u*n+f];m+=d*i[f],p.push(d)}if(m<0||m>=l/s)throw new Error(`Invalid indices: ${p} does not index into ${a}`);for(let f=0;f<s;f++)c.values[u*s+f]=t.get(...t.indexToLoc(m*s+f))}return c}function iy(r,t,e){let o=j(e,r.dtype);for(let n=0;n<o.size;++n){let i=o.indexToLoc(n).slice(),a=i[0],l=i[2],c=t.locToIndex([a,l]);i[2]=t.values[c];let u=r.locToIndex(i);0<=u&&u<r.values.length&&(o.values[n]=r.values[u])}return o}var Sf=ct((r,t)=>r>t?1:0),ygt=pt(co,Sf,null,"bool");var Tf=ct((r,t)=>r>=t?1:0),Sgt=pt(uo,Tf,null,"bool");var Ef=ct((r,t)=>r<t?1:0),kgt=pt(po,Ef,null,"bool");var If=ct((r,t)=>r<=t?1:0),Fgt=pt(mo,If,null,"bool");function ay(r,t,e){let o=(t-r)/(e-1),n=C.makeZerosTypedArray(e,"float32");n[0]=r;for(let s=1;s<n.length;s++)n[s]=n[s-1]+o;return n}var Nf=Rt(r=>Math.log(r)),Ugt=re("Log",Nf);function ly(r,t,e,o){let n=C.getTypedArrayFromDType(o,C.sizeFromShape(e));for(let s=0;s<n.length;++s){let i=s*t,a=r[i];for(let l=0;l<t;++l){let c=r[i+l];(Number.isNaN(c)||c>a)&&(a=c)}n[s]=a}return n}var kf=ct(((r,t)=>Math.max(r,t))),Xgt=pt(fo,kf);var Rf=ct(((r,t)=>Math.min(r,t))),Jgt=pt(ho,Rf);var Wa=ct(((r,t)=>r*t)),YA=ts(((r,t,e,o)=>({real:r*e-t*o,imag:r*o+t*e}))),nxt=pt(go,Wa,YA);function cy(r,t,e){let o=C.createScalarValue(-1,e);return Wa([],t,o,r,e)}var Af=ct(((r,t)=>r!==t?1:0)),mxt=pt(xo,Af,null,"bool");function uy(r,t,e,o,n){let s=t.length,i=C.sizeFromShape(t),a=C.computeStrides(t),l=C.computeStrides(n),c=C.getTypedArrayFromDType(e,C.sizeFromShape(n));for(let u=0;u<i;++u){let p=C.indexToLoc(u,s,a),m=new Array(p.length);for(let d=0;d<m.length;d++)m[d]=p[o[d]];let f=C.locToIndex(m,s,l);c[f]=r[u]}return c}function py(r,t,e,o){let[n,s]=T.computeOutAndReduceShapes(r,o),i=Bt(t,"int32"),a=C.makeZerosTypedArray(C.sizeFromShape(n),i),l=C.sizeFromShape(s);for(let c=0;c<a.length;++c){let u=c*l,p=1;for(let m=0;m<l;++m)p*=e[u+m];a[c]=p}return{outVals:a,outShape:n,outDtype:i}}function ZA(r,t,e){r.forEach((o,n)=>{if(o<0||o>=e){let s=C.indexToLoc(n,t.length,C.computeStrides(t)).join(",");throw new Error(`indices[${s}] = ${o} is not in [0, ${e})`)}})}function QA(r,t){for(let e=0;e<r.length;++e){let o=r[e],n=e===r.length-1?t:r[e+1].length;if(o.length===0)throw new Error("Ragged splits may not be empty");if(o[0]<0)throw new Error("Ragged splits must be non-negative");if(o[o.length-1]>n)throw new Error("Ragged splits must not point past values");for(let s=1;s<o.length;++s)if(o[s-1]>o[s])throw new Error("Ragged splits must be sorted in ascending order")}}function JA(r,t,e,o){let n=[],s=0,i=t.length-1+e.length,a=new Array(i).fill(null).map(()=>[0]);QA(e,o);let l=1;for(let c=0;c<t.length-1;++c){l*=t[c];let u=t[c+1];for(let p=1;p<l+1;++p)a[c].push(p*u)}for(let c=0;c<r.length;++c){let u=r[c],p=r[c]+1;for(let m=0;m<e.length;++m){let f=e[m],d=m+t.length-1;if(d>=0){let x=a[d],g=x[x.length-1]-f[u];for(let b=u;b<p;++b)a[d].push(f[b+1]+g)}u=f[u],p=f[p]}p!==u&&(n.push([u,p]),s+=p-u)}return{outSplits:a,valueSlices:n,numValues:s}}function t_(r){let t=[];for(let e=0;e<r.length;++e){let o=r[e].length,n=C.getArrayFromDType("int32",o);t.push(n),r[e].forEach((s,i)=>n[i]=s)}return t}function my(r,t){let e=r.slice(0,t);for(;e.length<t;)e.push(1);for(let o=t;o<r.length;o++)e[t-1]*=r[o];return e}function e_(r,t,e,o,n,s){let i=my(t,2)[1],a=my(s,2)[1],l=0;for(let c of e)for(let u=c[0];u<c[1];++u){for(let p=0;p<o;++p)n[l*a+p]=r[u*i+p];++l}}function r_(r,t,e,o,n){let s=t.slice();s[0]=n;let i=C.getArrayFromDType(e,C.sizeFromShape(s)),a=r.length,l=a===0?0:a/t[0];return e_(r,t,o,l,i,s),[i,s]}function fy(r,t,e,o,n,s,i,a){if(r.length===0)throw new Error("paramsNestedSplits must be non empty");if(t[0].length===0)throw new Error("Split tensors must not be scalars");let l=t[0][0]-1;if(ZA(s,i,l),o.length===0)throw new Error("params.rank must be nonzero");let c=o[0],{outSplits:u,valueSlices:p,numValues:m}=JA(s,i,r,c),f=t_(u),d=r_(e,o,n,p,m);return[f,d[0],d[1]]}var dy=2147483647;function hy(r,t,e,o,n,s,i){if(t.length>1)throw new Error("starts must be a scalar or vector");if(n.length>1)throw new Error("limits must be a scalar or vector");if(i.length>1)throw new Error("deltas must be a scalar or vector");let a=t.length===0,l=n.length===0,c=i.length===0,u=[];a||u.push(t[0]),l||u.push(n[0]),c||u.push(i[0]);for(let g=1;g<u.length;++g)if(u[g]!==u[g-1])throw new Error("starts, limits, and deltas must have the same shape");let p=u.length===0?1:u[0],m=C.getArrayFromDType("int32",p+1);m[0]=0;for(let g=0;g<p;++g){let b=a?r[0]:r[g],$=l?o[0]:o[g],S=c?s[0]:s[g];if(S===0)throw new Error("Requires delta != 0");let E;if(S>0&&$<b||S<0&&$>b)E=0;else if(E=Math.ceil(Math.abs(($-b)/S)),E>dy)throw new Error(`Requires ((limit - start) / delta) <= ${dy}`);m[g+1]=m[g]+E}let f=m[p],d=C.getArrayFromDType(e,f),x=0;for(let g=0;g<p;++g){let b=m[g+1]-m[g],$=a?r[0]:r[g],S=c?s[0]:s[g];for(let E=0;E<b;++E)d[x++]=$,$+=S}return[m,d]}var Ee=T.RowPartitionType,_f=class r{constructor(t,e,o,n,s,i,a,l,c,u){this.shape=t,this.shapeShape=e,this.values=o,this.valuesShape=n,this.valuesDType=s,this.defaultValue=i,this.defaultValueShape=a,this.rowPartitionValues=l,this.rowPartitionValuesShapes=c,this.rowPartitionTypes=T.getRowPartitionTypesHelper(u),this.raggedRank=T.getRaggedRank(this.rowPartitionTypes)}getRowPartitionTypeByDimension(t){return this.rowPartitionTypes[0]===Ee.FIRST_DIM_SIZE?this.rowPartitionTypes[t+1]:this.rowPartitionTypes[t]}getRowPartitionTensor(t){return this.rowPartitionTypes[0]===Ee.FIRST_DIM_SIZE?this.rowPartitionValues[t+1]:this.rowPartitionValues[t]}getMaxWidth(t){let e=this.getRowPartitionTensor(t-1);switch(this.getRowPartitionTypeByDimension(t-1)){case Ee.VALUE_ROWIDS:return r.getMaxWidthValueRowID(e);case Ee.ROW_SPLITS:return r.getMaxWidthRowSplit(e);default:throw new Error(`Cannot handle partition type ${Ee[this.getRowPartitionTypeByDimension(t-1)]}`)}}static getMaxWidthRowSplit(t){let e=t.length;if(e===0||e===1)return 0;let o=0;for(let n=0;n<e-1;++n){let s=t[n+1]-t[n];s>o&&(o=s)}return o}static getMaxWidthValueRowID(t){let e=t.length;if(e===0)return 0;let o=0,n=t[0],s=0;for(let i=1;i<e;++i){let a=t[i];a!==n&&(n=a,s=Math.max(i-o,s),o=i)}return Math.max(e-o,s)}tensorShapeFromTensor(t,e,o=!0){if(e.length===0){if(t[0]===-1)return[];throw new Error("The only valid scalar shape tensor is the fully unknown shape specified as -1.")}return xy(t,o)}calculateOutputSize(t){let e=this.valuesShape,o=this.defaultValueShape;T.validateDefaultValueShape(o,e);let n=this.tensorShapeFromTensor(this.shape,this.shapeShape),i=T.combineRaggedTensorToTensorShapes(this.raggedRank,n,e);i[0]<0&&(i[0]=t);for(let a=1;a<=this.raggedRank;++a)i[a]<0&&(i[a]=this.getMaxWidth(a));return i}calculateFirstParentOutputIndex(t,e,o){let n=Math.min(t,o),s=[],i=0;for(let a=0;a<n;++a,i+=e)s.push(i);for(let a=n;a<t;++a)s.push(-1);return C.assert(s.length===t,()=>"Final length of result must be equal to firstDimension."),s}calculateOutputIndexRowSplit(t,e,o,n){let s=t.length,i=[];for(let a=0;a<s-1;++a){let l=t[a+1]-t[a],c=Math.min(n,l),u=e[a];u===-1&&(c=0);for(let p=0;p<c;++p)i.push(u),u+=o;for(let p=0;p<l-c;++p)i.push(-1)}if(s>0&&i.length!==t[s-1])throw new Error("Invalid row split size.");return i}calculateOutputIndexValueRowID(t,e,o,n){let s=t.length,i=[];if(s===0)return[];let a=0,l=t[0];if(l>=e.length)throw new Error(`Got currentValueRowId=${l}, which is not less than ${e.length}`);let c=e[l];i.push(c);for(let u=1;u<s;++u){let p=t[u];if(p===l)c>=0&&(++a,a<n?c+=o:c=-1);else{if(a=0,l=p,p>=e.length)throw new Error(`Got nextValueRowId=${p} which is not less than ${e.length}`);c=e[p]}i.push(c)}if(i.length!==t.length)throw new Error("Invalid row ids.");return i}calculateOutputIndex(t,e,o,n){let s=this.getRowPartitionTensor(t),i=this.getRowPartitionTypeByDimension(t);switch(i){case Ee.VALUE_ROWIDS:return this.calculateOutputIndexValueRowID(s,e,o,n);case Ee.ROW_SPLITS:if(s.length-1>e.length)throw new Error(`Row partition size is greater than output size: ${s.length-1} > ${e.length}`);return this.calculateOutputIndexRowSplit(s,e,o,n);default:throw new Error(`Unsupported partition type: ${Ee[i]}`)}}getFirstDimensionSize(){let t=this.rowPartitionValues[0];if(this.rowPartitionTypes.length===0)throw new Error("No row_partition_types given.");let e=this.rowPartitionTypes[0];switch(e){case Ee.FIRST_DIM_SIZE:return t[0];case Ee.VALUE_ROWIDS:throw new Error("Cannot handle VALUE_ROWIDS in first dimension.");case Ee.ROW_SPLITS:return this.rowPartitionValuesShapes[0][0]-1;default:throw new Error(`Cannot handle type ${Ee[e]}`)}}compute(){if(this.rowPartitionValues[0].length<=0)throw new Error("Invalid first partition input. Tensor requires at least one element.");let e=this.getFirstDimensionSize(),o=this.calculateOutputSize(e),n=new Array(this.raggedRank+1);n[n.length-1]=1;for(let l=n.length-2;l>=0;--l)n[l]=n[l+1]*o[l+1];let s=xy(o,!1),i=C.getArrayFromDType(this.valuesDType,C.sizeFromShape(s));if(n[0]*o[0]>0){let l=this.calculateFirstParentOutputIndex(e,n[0],o[0]);for(let c=1;c<=this.raggedRank;++c)l=this.calculateOutputIndex(c-1,l,n[c],o[c]);this.setOutput(this.raggedRank,l,i,s)}return[s,i]}setOutput(t,e,o,n){if(o.length===0)return;let s=this.values,i=o,a=n.slice();a=a.slice(t+1);let l=C.sizeFromShape(a),c=e.length,u=this.defaultValue;if(u.length!==l&&u.length!==1){let d=this.defaultValueShape;at(()=>{let x=k(u,d);u=Fr(x,a).dataSync()})}let p=0,m=0,f=0;for(let d=0;d<=c;++d){let x=d<c?e[d]:-1;if(x===f){++f;continue}if(m<f){let g=s.subarray(p*l),b=i.subarray(m*l),$=(f-m)*l;gy(b,g,$)}if(d>=c){let g=o.length;x=Math.floor(g/l)}if(x>f)if(this.defaultValue.length===1)i.subarray(f*l,x*l).fill(this.defaultValue[0]),f=x;else for(;x>f;){let g=i.slice(f*l);gy(g,u,l),++f}x<0?(p=d+1,m=f):(p=d,m=f,f=m+1)}}};function gy(r,t,e){for(let o=0;o<e;o++)r[o]=t[o]}function xy(r,t){let e=[];for(let o of r){if(o<0){if(!t)throw new Error(`Dimension ${o} must be >= 0`);if(o<-1)throw new Error(`Dimension ${o} must be >= -1`);o=-1}e.push(o)}return e}function by(r,t,e,o,n,s,i,a,l,c){return new _f(r,t,e,o,n,s,i,a,l,c).compute()}function yy(r,t,e,o){let n=r===t,s=r<t&&e<0,i=t<r&&e>1;if(n||s||i)return C.makeZerosTypedArray(0,o);let a=Math.abs(Math.ceil((t-r)/e)),l=C.makeZerosTypedArray(a,o);t<r&&e===1&&(e=-1),l[0]=r;for(let c=1;c<l.length;c++)l[c]=l[c-1]+e;return l}var Df=Rt(r=>1/Math.sqrt(r)),kxt=re(bo,Df);function wy(r,t,e,o,n,s,i,a,l,c){let u=[o/n,n],p=r.values,m=t.values;if(o===0)return j(e,t.dtype);let f=l instanceof ce?l:j(u,t.dtype);typeof l=="string"||typeof l=="number"?f.values.fill(l):typeof l=="boolean"&&f.values.fill(+l);for(let d=0;d<s;d++){let x=[],g=0;for(let b=0;b<i;b++){let $=p[d*i+b];x.push($),g+=$*a[b]}if(g<0||g>=o/n)throw new Error(`Invalid indices: ${x} does not index into ${e}`);for(let b=0;b<n;b++)c?f.values[g*n+b]+=m[d*n+b]:f.values[g*n+b]=t.rank===0?m[0]:m[d*n+b]}return f}var Cy=Rt(r=>1/(1+Math.exp(-r))),Oxt=Kc(yo,r=>1/(1+Math.exp(-r)));function vy(r,t,e,o,n){let s=Zt.isSliceContinous(o,t,e),i=C.sizeFromShape(e),a=C.computeStrides(o);if(s){let p=Zt.computeFlatOffset(t,a);return n==="string"?r.slice(p,p+i):r.subarray(p,p+i)}let l=n==="string"?T.fromUint8ToStringArray(r):r,c=j(o,n,l),u=j(e,n);for(let p=0;p<u.size;++p){let m=u.indexToLoc(p),f=m.map((d,x)=>d+t[x]);u.set(c.get(...f),...m)}return n==="string"?T.fromStringArrayToUint8(u.values):u.values}function $y(r,t,e,o,n,s,i){let a=t[0],l=s[0],c=new Array(l),u=new Array(a),p=t[1];if(l===0){if(a!==0)throw new Error(T.getSparseFillEmptyRowsIndicesDenseShapeMismatch(a));let g=C.getArrayFromDType(e,0),b=C.getArrayFromDType(n,0);return[g,[0,p],b,c,u]}let m=!0,f=0,d=new Array(l).fill(0);for(let g=0;g<a;++g){let b=r[g*p];if(b<0)throw new Error(T.getSparseFillEmptyRowsNegativeIndexErrorMessage(g,b));if(b>=l)throw new Error(T.getSparseFillEmptyRowsOutOfRangeIndexErrorMessage(g,b,l));++d[b],m=m&&b>=f,f=b}let x=!0;for(let g=0;g<l;++g){let b=d[g]===0;c[g]=b,x=x&&!b,d[g]=Math.max(d[g],1),g>0&&(d[g]+=d[g-1])}if(x&&m){let g=r,b=o;for(let $=0;$<a;++$)u[$]=$;return[g,[a,p],b,c,u]}else{let g=d[l-1],b=C.getArrayFromDType(e,g*p),$=C.getArrayFromDType(n,g),S=new Array(l).fill(0);for(let E=0;E<a;++E){let N=r[E*p],R=S[N],A=(N===0?0:d[N-1])+R;S[N]++;for(let _=0;_<p;++_)b[A*p+_]=r[E*p+_];$[A]=o[E],u[E]=A}for(let E=0;E<l;++E)if(S[E]===0){let R=E===0?0:d[E-1];b[R*p+0]=E;for(let A=1;A<p;++A)b[R*p+A]=0;$[R]=i}return[b,[g,p],$,c,u]}}function Sy(r,t,e,o,n){let s=C.sizeFromShape(o),i=t[0],a=n.length,l=[],c=1,u=-1;for(let g=0;g<a;++g){let b=n[g];if(b===-1){if(u!==-1)throw new Error(T.getSparseReshapeMultipleNegativeOneOutputDimErrorMessage(u,g));u=g,l.push(1)}else{if(b<0)throw new Error(T.getSparseReshapeNegativeOutputDimErrorMessage(g,b));c*=b,l.push(b)}}if(u!==-1){if(c<=0)throw new Error(T.getSparseReshapeEmptyTensorZeroOutputDimErrorMessage());let g=Math.trunc(s/c);if(c*g!==s)throw new Error(T.getSparseReshapeInputOutputMultipleErrorMessage(o,l));l[u]=g}if(C.sizeFromShape(l)!==s)throw new Error(T.getSparseReshapeInputOutputMismatchErrorMessage(o,l));let m=o.length,f=[];if(m>0){f[m-1]=1;for(let g=m-2;g>=0;--g)f[g]=f[g+1]*o[g+1]}let d=[];if(a>0){d[a-1]=1;for(let g=a-2;g>=0;--g)d[g]=d[g+1]*l[g+1]}let x=C.getArrayFromDType(e,i*a);for(let g=0;g<i;++g){let b=0;for(let $=0;$<m;++$)b+=r[g*m+$]*f[$];for(let $=0;$<a;++$)x[g*a+$]=Math.trunc(b/d[$]),b%=d[$]}return[x,[i,a],l]}function Ty(r,t,e,o,n,s=!1,i=0){let a=o.length,l=[t[0],r.length/t[0]],c=l[1],p=a>0?n[a-1]+1:0;if(p<0)throw new Error(T.getSparseSegmentReductionNegativeSegmentIdsErrorMessage());let m=t.slice();m[0]=p;let f=m.reduce((S,E)=>S*E,1),d=C.getArrayFromDType(e,f);if(a===0)return p>0&&d.fill(i),[d,m];if(p<=0)throw new Error(T.getSparseSegmentReductionNegativeSegmentIdsErrorMessage());let x=0,g=1,b=0,$=n[x];for(;;){let S=0;if(g<a){if(S=n[g],$===S){++g;continue}if($>=S)throw new Error(T.getSparseSegmentReductionNonIncreasingSegmentIdsErrorMessage())}if($<0||$>=p)throw new Error(T.getSparseSegmentReductionSegmentIdOutOfRangeErrorMessage($,p));$>b&&d.fill(i,b*c,$*c);for(let E=x;E<g;++E){let N=o[E];if(N<0||N>=l[0])throw new Error(T.getSparseSegmentReductionIndicesOutOfRangeErrorMessage(E,o[E],l[0]));for(let R=0;R<c;R++)d[$*c+R]+=r[N*c+R]}if(s)for(let E=0;E<c;E++)d[$*c+E]/=g-x;if(x=g,++g,b=$+1,$=S,g>a)break}return b<p&&d.fill(i,b*c,p*c),[d,m]}var Ey=Rt(r=>Math.sqrt(r)),jxt=Kc(wo,r=>Math.sqrt(r));var Ff=ct(((r,t)=>{let e=r-t;return e*e})),tbt=pt(Co,Ff);var Pf=Rt((r,t)=>{let{pattern:e,replaceGlobal:o,rewrite:n}=t;return r.replace(new RegExp(e,o?"g":""),n)}),sbt=re(vo,Pf);function Iy(r,t,e,o){let n=j(r,t.dtype);for(let s=0;s<n.size;s++){let i=n.indexToLoc(s),a=new Array(i.length);for(let l=0;l<a.length;l++)a[l]=i[l]*e[l]+o[l];n.set(t.get(...a),...i)}return n}var Of=class{constructor(t,e,o,n,s,i){this.separator=C.encodeString(t),this.nGramWidths=e,this.leftPad=C.encodeString(o),this.rightPad=C.encodeString(n),this.padWidth=s,this.preserveShort=i}getPadWidth(t){return Math.min(this.padWidth<0?t-1:this.padWidth,t-1)}getNumNGrams(t,e){let o=this.getPadWidth(e);return Math.max(0,t+2*o-e+1)}createNGrams(t,e,o,n,s,i){for(let a=0;a<s;++a){let l=this.getPadWidth(i),c=Math.max(0,l-a),u=Math.max(0,l-(s-(a+1))),p=i-(c+u),m=e+(c>0?0:a-l),f=0;f+=c*this.leftPad.length;for(let $=0;$<p;++$)f+=t[m+$].length;f+=u*this.rightPad.length;let d=c+u+p-1;f+=d*this.separator.length,o[n+a]=new Uint8Array(f);let x=o[n+a],g=0,b=$=>$.forEach(S=>x[g++]=S);for(let $=0;$<c;++$)b(this.leftPad),b(this.separator);for(let $=0;$<p-1;++$)b(t[m+$]),b(this.separator);if(p>0){b(t[m+p-1]);for(let $=0;$<u;++$)b(this.separator),b(this.rightPad)}else{for(let $=0;$<u-1;++$)b(this.rightPad),b(this.separator);b(this.rightPad)}}}compute(t,e){let o=t.length,n=e.length;if(n>0){let l=e[0];if(l!==0)throw new Error(`First split value must be 0, got ${l}`);for(let c=1;c<n;++c){let u=e[c]>=l;if(u=u&&e[c]<=o,!u)throw new Error(`Invalid split value ${e[c]}, must be in [${l}, ${o}]`);l=e[c]}if(l!==o)throw new Error(`Last split value must be data size. Expected ${o}, got ${l}`)}let s=n-1,i=C.getArrayFromDType("int32",n);if(o===0||n===0){let l=new Array(o);for(let c=0;c<=s;++c)i[c]=0;return[l,i]}i[0]=0;for(let l=1;l<=s;++l){let c=e[l]-e[l-1],u=0;this.nGramWidths.forEach(p=>{u+=this.getNumNGrams(c,p)}),this.preserveShort&&c>0&&u===0&&(u=1),i[l]=i[l-1]+u}let a=new Array(i[s]);for(let l=0;l<s;++l){let c=e[l],u=i[l];if(this.nGramWidths.forEach(p=>{let m=e[l+1]-e[l],f=this.getNumNGrams(m,p);this.createNGrams(t,c,a,u,f,p),u+=f}),this.preserveShort&&u===i[l]){let p=e[l+1]-e[l];if(p===0)continue;let m=p+2*this.padWidth;this.createNGrams(t,c,a,u,1,m)}}return[a,i]}};function Ny(r,t,e,o,n,s,i,a){return new Of(e,o,n,s,i,a).compute(r,t)}function o_(r,t,e,o){if(!r.length)return;if(t.length===0){for(let s=0;s<r.length;++s)o.push(r.subarray(s,s+1));return}if(t.length===1){let s=t[0],i=r.indexOf(s);for(;i!==-1;){let a=r.subarray(0,i);(!e||a.length!==0)&&o.push(a),r=r.subarray(i+1),i=r.indexOf(s)}(!e||r.length!==0)&&o.push(r);return}let n=0;for(let s=0;s<r.length+1;s++)if(s===r.length||t.indexOf(r[s])!==-1){let i=r.subarray(n,s);(!e||i.length!==0)&&o.push(i),n=s+1}}function ky(r,t,e){let o=r.length,n=[],s=0,i=0,a=new Array(o);for(let m=0;m<o;++m){let f=n.length;o_(r[m],t,e,n);let d=n.length-f;a[m]=d,s+=d,i=Math.max(i,d)}let l=C.getArrayFromDType("int32",s*2),c=new Array(s),u=[o,i],p=0;for(let m=0;m<o;++m)for(let f=0;f<a[m];++f)l[p*2]=m,l[p*2+1]=f,c[p]=n[p],++p;return[l,c,u]}function Ry(r,t){let e=C.getArrayFromDType("int32",r.length);for(let o=0;o<r.length;++o)e[o]=C.fingerPrint64(r[o]).modulo(t).getLowBitsUnsigned();return e}var Mf=ct(((r,t)=>r-t)),n_=ts(((r,t,e,o)=>({real:r-e,imag:t-o}))),bbt=pt("Sub",Mf,n_);function Ay(r,t){let e=new Array(r.rank);for(let n=0;n<e.length;n++)e[n]=r.shape[n]*t[n];let o=j(e,r.dtype);for(let n=0;n<o.values.length;++n){let s=o.indexToLoc(n),i=new Array(r.rank);for(let l=0;l<i.length;l++)i[l]=s[l]%r.shape[l];let a=r.locToIndex(i);o.values[n]=r.values[a]}return o}var za=(r,t)=>{let e=t.value-r.value;return e===0?r.index-t.index:e};function _y(r,t,e=0,o=r.length-1){for(;o>e;){if(o-e>600){let a=o-e+1,l=t-e+1,c=Math.log(a),u=.5*Math.exp(2*c/3),p=.5*Math.sqrt(c*u*(a-u)/a)*Math.sign(l-a/2),m=Math.max(e,Math.floor(t-l*u/a+p)),f=Math.min(o,Math.floor(t+(a-l)*u/a+p));_y(r,t,m,f)}let n=r[t],s=e,i=o;for(C.swap(r,e,t),za(r[o],n)>0&&C.swap(r,e,o);s<i;){for(C.swap(r,s,i),s++,i--;za(r[s],n)<0;)s=s+1;for(;za(r[i],n)>0;)i=i-1}za(r[e],n)===0?C.swap(r,e,i):(i=i+1,C.swap(r,i,o)),i<=t&&(e=i+1),t<=i&&(o=i-1)}}function Dy(r,t,e,o,n){let s=t[t.length-1],[i,a]=[r.length/s,s],l=C.getTypedArrayFromDType(e,i*o),c=C.getTypedArrayFromDType("int32",i*o);for(let p=0;p<i;p++){let m=p*a,f=r.subarray(m,m+a),d=new Array(f.length);f.forEach(($,S)=>d[S]={value:$,index:S}),o<d.length&&(_y(d,o),d=d.slice(0,o)),n&&d.sort(za);let x=p*o,g=l.subarray(x,x+o),b=c.subarray(x,x+o);for(let $=0;$<o;$++)g[$]=d[$].value,b[$]=d[$].index}let u=t.slice();return u[u.length-1]=o,[j(u,e,l),j(u,"int32",c)]}function Fy(r,t,e,o){let n=C.parseAxisParam(t,e)[0],s=[1,e[0],1];for(let d=0;d<n;d++)s[0]*=e[d];s[1]=e[n];for(let d=n+1;d<e.length;d++)s[2]*=e[d];let i=new Map,a=new Int32Array(e[n]),l=new ce(s,o,r),c=[],u=s[0]===1&&s[2]===1;for(let d=0;d<e[n];d++){let x;if(u)x=r[d].toString();else{let b=[];for(let $=0;$<s[0];$++)for(let S=0;S<s[2];S++)b.push(l.get($,d,S));x=b.join(",")}let g=i.get(x);if(g!=null)a[d]=g;else{let b=i.size;i.set(x,b),a[d]=b,c.push(d)}}let p=s.slice();p[1]=i.size;let m=new ce(p,o);c.forEach((d,x)=>{for(let g=0;g<s[0];g++)for(let b=0;b<s[2];b++)m.set(l.get(g,d,b),g,x,b)});let f=e.slice();return f[n]=p[1],{outputValues:m.values,outputShape:f,indices:a}}var{addImpl:Py,bincountImpl:Hc,bincountReduceImpl:Oy,bitwiseAndImpl:My,castImpl:Ly,ceilImpl:By,concatImpl:Gy,equalImpl:Uy,expImpl:Vy,expm1Impl:Wy,floorImpl:zy,gatherNdImpl:Ky,gatherV2Impl:Hy,greaterImpl:qy,greaterEqualImpl:Xy,lessImpl:jy,lessEqualImpl:Yy,linSpaceImpl:Zy,logImpl:Qy,maxImpl:Jy,maximumImpl:tw,minimumImpl:ew,multiplyImpl:rw,negImpl:ow,notEqualImpl:nw,prodImpl:sw,raggedGatherImpl:iw,raggedRangeImpl:aw,raggedTensorToTensorImpl:lw,rangeImpl:cw,rsqrtImpl:uw,scatterImpl:pw,sigmoidImpl:mw,simpleAbsImpl:qc,sliceImpl:fw,sparseFillEmptyRowsImpl:dw,sparseReshapeImpl:hw,sparseSegmentReductionImpl:Xc,sqrtImpl:gw,staticRegexReplaceImpl:xw,stridedSliceImpl:bw,stringNGramsImpl:yw,stringSplitImpl:ww,stringToHashBucketFastImpl:Cw,subImpl:vw,tileImpl:$w,topKImpl:Sw,transposeImpl:Qo,uniqueImpl:Tw}=Lf;function Bf(r,t){return["x","y","z","w","u","v"].slice(0,t).map(e=>`${r}.${e}`)}function yt(r,t){return t===1?[r]:Bf(r,t)}function Ew(r,t){if(r===1)return"rc";let e="";for(let o=0;o<r;o++)e+=t[o],o<r-1&&(e+=",");return e}var jc=class{constructor(t){if(this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0,this.outputShape=t,this.rank=t.length,this.enableShapeUniforms=it(this.outputShape.length),this.rank===0)this.userCode=`
        void main() {
          setOutput(vec4(getA(), 0., 0., 0.));
        }
      `;else{let e=yt("rc",this.rank),o=K(this.rank),n=this.getOutOfBoundsCondition(e),s=this.getSetup(e),i=this.getOutput(e);this.userCode=`
        void main() {
          ${o} rc = getOutputCoords();

          if(${n}) {
            setOutput(vec4(0));
          } else {
            ${s}

            setOutput(vec4(${i}));
          }
        }
      `}}getSourceCoordsArr(t){let e=[];for(let o=0;o<=1;o++)for(let n=0;n<=1;n++){let s=`${o===0?"r":"rp1"}, ${n===0?"c":"cp1"}`;for(let i=2;i<this.rank;i++)s=`${t[t.length-1-i]},`+s;e.push(s)}return e}getOutOfBoundsCondition(t){if(this.rank===1)return`rc > ${this.enableShapeUniforms?"outShape":this.outputShape[0]}`;let e="";for(let o=this.rank-2;o<this.rank;o++)e+=`${t[o]} >= ${this.enableShapeUniforms?`outShape[${o}]`:this.outputShape[o]}`,o<this.rank-1&&(e+="||");return e}getSetup(t){if(this.rank===1)return"";let e=t.slice(-2),o=this.enableShapeUniforms?`outShape[${this.rank} - 1]`:this.outputShape[this.rank-1],n=this.enableShapeUniforms?`outShape[${this.rank} - 2]`:this.outputShape[this.rank-2];return`
      int r = ${e[0]};
      int c = ${e[1]};
      int rp1 = r + 1;
      int cp1 = c + 1;

      bool cEdge = cp1 >= ${o};
      bool rEdge = rp1 >= ${n};
    `}getOutput(t){let e=this.getSourceCoordsArr(t);return this.rank===1?`getA(rc), (rc + 1 >= ${this.enableShapeUniforms?"outShape":this.outputShape[0]} ? 0. : getA(rc + 1)), 0, 0`:`getA(${e[0]}),
            cEdge ? 0. : getA(${e[1]}),
            rEdge ? 0. : getA(${e[2]}),
            rEdge || cEdge ? 0. : getA(${e[3]})`}};var es=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"inputShape",type:"ivec3"}],this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length);let o="";for(let n=0;n<4;n++){let s="thisRC = rc;";n%2===1&&(s+="thisRC.z += 1;"),n>1&&(s+="thisRC.y += 1;"),o+=`
        ${s}
        ${n>0?"if(thisRC.y < rows && thisRC.z < cols){":""}
          int flatIndex = getFlatIndex(thisRC);

          ivec3 inputRC = inputCoordsFromReshapedOutCoords(flatIndex);
          vec2 inputRCInnerDims = vec2(float(inputRC.y),float(inputRC.z));

          result[${n}] =
            getChannel(getA(inputRC.x, inputRC.y, inputRC.z), inputRCInnerDims);
        ${n>0?"}":""}
      `}this.userCode=`
      ${s_(e,this.enableShapeUniforms)}
      ${this.enableShapeUniforms?Hn():Kn(t)}

      void main() {
        ivec3 rc = getOutputCoords();

        vec4 result = vec4(0.);

        ivec3 thisRC;
        int rows = ${this.enableShapeUniforms?"outShape[1]":t[1]};
        int cols = ${this.enableShapeUniforms?"outShape[2]":t[2]};

        ${o}

        setOutput(result);
      }
    `}};function s_(r,t){return`
    ivec3 inputCoordsFromReshapedOutCoords(int index) {
      ${t?k0(["r","c","d"],"inputShape"):Pe(["r","c","d"],r)}
      return ivec3(r, c, d);
    }
  `}var Yc=class{constructor(t){this.gpgpu=t,this.numUsedTextures=0,this.numFreeTextures=0,this._numBytesAllocated=0,this._numBytesFree=0,this.freeTextures={},this.usedTextures={},this.logEnabled=!1}acquireTexture(t,e,o){let n=Nw(e,o),s=kw(t,n,o);s in this.freeTextures||(this.freeTextures[s]=[]),s in this.usedTextures||(this.usedTextures[s]=[]);let i=Iw(t,n,this.gpgpu.gl,this.gpgpu.textureConfig,o);if(this.freeTextures[s].length>0){this.numFreeTextures--,this.numUsedTextures++,this._numBytesFree-=i,this.log();let l=this.freeTextures[s].pop();return this.usedTextures[s].push(l),l}let a;return n===Ot.PACKED_2X2_FLOAT32?a=this.gpgpu.createPackedMatrixTexture(t[0],t[1]):n===Ot.PACKED_2X2_FLOAT16?a=this.gpgpu.createFloat16PackedMatrixTexture(t[0],t[1]):n===Ot.UNPACKED_FLOAT32?a=this.gpgpu.createFloat32MatrixTexture(t[0],t[1]):n===Ot.UNPACKED_FLOAT16?a=this.gpgpu.createFloat16MatrixTexture(t[0],t[1]):n===Ot.PACKED_4X1_UNSIGNED_BYTE&&(a=this.gpgpu.createUnsignedBytesMatrixTexture(t[0],t[1])),this.usedTextures[s].push(a),this.numUsedTextures++,this._numBytesAllocated+=i,this.log(),a}releaseTexture(t,e,o,n){if(this.freeTextures==null)return;let s=Nw(o,n),i=kw(e,s,n);i in this.freeTextures||(this.freeTextures[i]=[]);let a=Iw(e,s,this.gpgpu.gl,this.gpgpu.textureConfig,n),l=I().getNumber("WEBGL_DELETE_TEXTURE_THRESHOLD");l!==-1&&this._numBytesAllocated>l?(this.gpgpu.deleteMatrixTexture(t.texture),this._numBytesAllocated-=a):(this.freeTextures[i].push(t),this.numFreeTextures++,this._numBytesFree+=a),this.numUsedTextures--;let c=this.usedTextures[i],u=c&&c.indexOf(t);if(u==null||u<0)throw new Error("Cannot release a texture that was never provided by this texture manager");c[u]=c[c.length-1],c.pop(),this.log()}log(){if(!this.logEnabled)return;let t=this.numFreeTextures+this.numUsedTextures;console.log("Free/Used",`${this.numFreeTextures} / ${this.numUsedTextures}`,`(${t})`);let e=this._numBytesFree/this._numBytesAllocated;console.log(`Bytes allocated: ${this._numBytesAllocated}`),console.log(`Bytes unused: ${this._numBytesFree} (${Math.round(100*e)}%)`)}get numBytesAllocated(){return this._numBytesAllocated}get numBytesFree(){return this._numBytesFree}getNumUsedTextures(){return this.numUsedTextures}getNumFreeTextures(){return this.numFreeTextures}dispose(){if(this.freeTextures!=null){for(let t in this.freeTextures)this.freeTextures[t].forEach(e=>{this.gpgpu.deleteMatrixTexture(e.texture)});for(let t in this.usedTextures)this.usedTextures[t].forEach(e=>{this.gpgpu.deleteMatrixTexture(e.texture)});this.freeTextures=null,this.usedTextures=null,this.numUsedTextures=0,this.numFreeTextures=0,this._numBytesAllocated=0,this._numBytesFree=0}}};function i_(r,t){let e=r;if(t===e.R32F)return 4;if(t===e.R16F)return 2;if(t===e.RGBA32F)return 16;if(t===r.RGBA)return 16;if(t===e.RGBA16F)return 8;if(t===e.RGBA8)return 4;throw new Error(`Unknown internal format ${t}`)}function Iw(r,t,e,o,n){let s=a_(t,o),i;if(n){let[l,c]=rr(r[0],r[1]);i=l*c}else{let[l,c]=Xo(r[0],r[1]);i=l*c}let a=i_(e,s);return i*a}function a_(r,t){switch(r){case Ot.PACKED_2X2_FLOAT32:return mf(t);case Ot.PACKED_2X2_FLOAT16:return ff(t);case Ot.UNPACKED_FLOAT32:return cf(t);case Ot.UNPACKED_FLOAT16:return uf(t);case Ot.PACKED_4X1_UNSIGNED_BYTE:return pf(t);default:throw new Error(`Unknown physical texture type ${r}`)}}function l_(r){return I().getBool("WEBGL_RENDER_FLOAT32_ENABLED")?r?Ot.PACKED_2X2_FLOAT32:Ot.UNPACKED_FLOAT32:r?Ot.PACKED_2X2_FLOAT16:Ot.UNPACKED_FLOAT16}function Nw(r,t){if(r===zt.UPLOAD)return Ot.PACKED_2X2_FLOAT32;if(r===zt.RENDER||r==null)return l_(t);if(r===zt.DOWNLOAD||r===zt.PIXELS)return Ot.PACKED_4X1_UNSIGNED_BYTE;throw new Error(`Unknown logical texture type ${r}`)}function kw(r,t,e){return`${r[0]}_${r[1]}_${t}_${e}`}var Mt=class{constructor(t,e){this.variableNames=["A"],this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length),this.userCode=`
      float unaryOperation(float x) {
        ${e}
      }

      void main() {
        float x = getAAtOutCoords();
        float y = unaryOperation(x);

        setOutput(y);
      }
    `}},Et="if (isnan(x)) return x;",Rw="return x;",Gf="return abs(x);";var Aw="return (x >= 0.0) ? x : (exp(x) - 1.0);",_w=Et+`
  return (x < 0.0) ? 0.0 : x;
`,Dw=Et+`
  return (x < 0.0) ? 0.0 : min(6.0, x);
`,nr="return x;",Fw="return 1.0 / (1.0 + exp(-1.0 * x));";var Ow="return x;",Mw=`
  vec4 result;

  result.r = (x.r >= 0.0) ? x.r : (exp(x.r) - 1.0);
  result.g = (x.g >= 0.0) ? x.g : (exp(x.g) - 1.0);
  result.b = (x.b >= 0.0) ? x.b : (exp(x.b) - 1.0);
  result.a = (x.a >= 0.0) ? x.a : (exp(x.a) - 1.0);

  return result;
`,Lw=`
  vec4 result = x * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,Bw=`
  vec4 result = min(x, vec4(6.)) * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,Gw="return 1.0 / (1.0 + exp(-1.0 * x));",oe=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length),this.userCode=`
      vec4 unaryOperation(vec4 x) {
        ${e}
      }

      void main() {
        vec4 x = getAAtOutCoords();
        vec4 y = unaryOperation(x);

        setOutput(y);
      }
    `}};var Zc=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!1,this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length);let e=t.length,o=yt("rc",e),n=K(e),s=Ew(e,o),i=o.slice(-2),a=e<=1?"rc":`vec2(${i.join(",")})`;this.userCode=`
      void main() {
        ${n} rc = getOutputCoords();
        vec4 packedInput = getA(${s});

        setOutput(getChannel(packedInput, ${a}));
      }
    `}};var u_=Fe.whereImpl,p_=1e-7,m_=1e-4,Qc={};function f_(r){return r in Qc||(Qc[r]={}),Qc[r]}var d_=I().getNumber("CPU_HANDOFF_SIZE_THRESHOLD"),h_=600;function g_(){return I().global.screen==null?1024:I().global.screen.height*I().global.screen.width*window.devicePixelRatio*h_/1024/1024}var Ka=class r extends vr{nextDataId(){return r.nextDataId++}constructor(t){if(super(),this.pendingRead=new WeakMap,this.pendingDisposal=new WeakSet,this.dataRefCount=new WeakMap,this.numBytesInGPU=0,this.uploadWaitMs=0,this.downloadWaitMs=0,this.lastGlFlushTime=0,this.warnedAboutMemory=!1,this.pendingDeletes=0,this.disposed=!1,!I().getBool("HAS_WEBGL"))throw new Error("WebGL is not supported on this device");let e;if(t!=null){if(t instanceof Qn)e=t;else{let o=ue(I().getNumber("WEBGL_VERSION"),t);e=new Qn(o)}this.binaryCache={},this.gpgpuCreatedLocally=!1}else{let o=ue(I().getNumber("WEBGL_VERSION"));e=new Qn(o),this.binaryCache=f_(I().getNumber("WEBGL_VERSION")),this.gpgpuCreatedLocally=!0}this.gpgpu=e,this.canvas=this.gpgpu.gl.canvas,this.textureManager=new Yc(this.gpgpu),this.numMBBeforeWarning=g_(),this.texData=new sn(this,We())}numDataIds(){return this.texData.numDataIds()-this.pendingDeletes}writeTexture(t,e,o,n,s,i){let a=this.makeTensorInfo(e,o),l=this.texData.get(a.dataId);l.isPacked=!1,l.texture={texture:t,texShape:[n,s]},l.texShape=[n,s];let c=Ba(e),u=new Ga(c,!1,i),p=this.runWebGLProgram(u,[a],o,[[n,s]]);return p.shape=e,l.texture=null,this.disposeIntermediateTensorInfo(a),p.dataId}write(t,e,o){if((I().getBool("WEBGL_CHECK_NUMERICAL_PROBLEMS")||I().getBool("DEBUG"))&&this.checkNumericalProblems(t),o==="complex64"&&t!=null)throw new Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");let n={id:this.nextDataId()};return this.texData.set(n,{shape:e,dtype:o,values:t,usage:zt.UPLOAD,refCount:1}),n}refCount(t){return this.texData.has(t)?this.texData.get(t).refCount:0}incRef(t){let e=this.texData.get(t);e.refCount++}decRef(t){if(this.texData.has(t)){let e=this.texData.get(t);e.refCount--}}move(t,e,o,n,s){if(I().getBool("DEBUG")&&this.checkNumericalProblems(e),n==="complex64")throw new Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");this.texData.set(t,{shape:o,dtype:n,values:e,usage:zt.UPLOAD,refCount:s})}disposeIntermediateTensorInfo(t){this.disposeData(t.dataId)}readSync(t){let e=this.texData.get(t),{values:o,dtype:n,complexTensorInfos:s,slice:i,shape:a,isPacked:l}=e;if(i!=null){let m;l?m=new oe(a,nr):m=new Mt(a,nr);let f=this.runWebGLProgram(m,[{dataId:t,shape:a,dtype:n}],n),d=this.readSync(f.dataId);return this.disposeIntermediateTensorInfo(f),d}if(o!=null)return this.convertAndCacheOnCPU(t);if(n==="string")return o;let c=this.activeTimers!=null,u;c&&(u=C.now());let p;if(n==="complex64"){let m=this.readSync(s.real.dataId),f=this.readSync(s.imag.dataId);p=T.mergeRealAndImagArrays(m,f)}else p=this.getValuesFromTexture(t);return c&&(this.downloadWaitMs+=C.now()-u),this.convertAndCacheOnCPU(t,p)}async read(t){if(this.pendingRead.has(t)){let d=this.pendingRead.get(t);return new Promise(x=>d.push(x))}let e=this.texData.get(t),{values:o,shape:n,slice:s,dtype:i,complexTensorInfos:a,isPacked:l}=e;if(s!=null){let d;l?d=new oe(n,nr):d=new Mt(n,nr);let x=this.runWebGLProgram(d,[{dataId:t,shape:n,dtype:i}],i),g=this.read(x.dataId);return this.disposeIntermediateTensorInfo(x),g}if(o!=null)return this.convertAndCacheOnCPU(t);if(I().getBool("DEBUG")&&!I().getBool("WEBGL_DOWNLOAD_FLOAT_ENABLED")&&I().getNumber("WEBGL_VERSION")===2)throw new Error("tensor.data() with WEBGL_DOWNLOAD_FLOAT_ENABLED=false and WEBGL_VERSION=2 not yet supported.");let c=null,u;if(i!=="complex64"&&I().get("WEBGL_BUFFER_SUPPORTED")){u=this.decode(t);let d=this.texData.get(u.dataId);c=this.gpgpu.createBufferFromTexture(d.texture.texture,...Pa(n))}this.pendingRead.set(t,[]),i!=="complex64"&&await this.gpgpu.createAndWaitForFence();let p;if(i==="complex64"){let d=await Promise.all([this.read(a.real.dataId),this.read(a.imag.dataId)]),x=d[0],g=d[1];p=T.mergeRealAndImagArrays(x,g)}else if(c==null)p=this.getValuesFromTexture(t);else{let d=C.sizeFromShape(n);p=this.gpgpu.downloadFloat32MatrixFromBuffer(c,d)}if(u!=null&&this.disposeIntermediateTensorInfo(u),c!=null){let d=this.gpgpu.gl;L(d,()=>d.deleteBuffer(c))}let m=this.convertAndCacheOnCPU(t,p),f=this.pendingRead.get(t);return this.pendingRead.delete(t),f.forEach(d=>d(m)),this.pendingDisposal.has(t)&&(this.pendingDisposal.delete(t),this.disposeData(t)&&We().removeDataId(t,this),this.pendingDeletes--),m}readToGPU(t,e={}){let o=this.texData.get(t),{values:n,shape:s,slice:i,dtype:a,isPacked:l,texture:c}=o;if(a==="complex64")throw new Error("Does not support reading texture for complex64 dtype.");if(i!=null){let f;l?f=new oe(s,nr):f=new Mt(s,nr);let d=this.runWebGLProgram(f,[{dataId:t,shape:s,dtype:a}],a),x=this.readToGPU(d,e);return this.disposeIntermediateTensorInfo(d),x}if(c==null)throw n!=null?new Error("Data is not on GPU but on CPU."):new Error("There is no data on GPU or CPU.");let u=this.decode(t,e.customTexShape),p=We().makeTensorFromTensorInfo(u),m=this.texData.get(u.dataId);return Object.assign({tensorRef:p},m.texture)}bufferSync(t){let e=this.readSync(t.dataId);if(t.dtype==="string")try{let o=e.map(n=>C.decodeString(n));return j(t.shape,t.dtype,o)}catch{throw new Error("Failed to decode encoded string bytes into utf-8")}return j(t.shape,t.dtype,e)}checkNumericalProblems(t){if(t!=null)for(let e=0;e<t.length;e++){let o=t[e];if(!c0(o))throw I().getBool("WEBGL_RENDER_FLOAT32_CAPABLE")?Error(`The value ${o} cannot be represented with your current settings. Consider enabling float32 rendering: 'tf.env().set('WEBGL_RENDER_FLOAT32_ENABLED', true);'`):Error(`The value ${o} cannot be represented on this device.`)}}getValuesFromTexture(t){let{shape:e,dtype:o,isPacked:n}=this.texData.get(t),s=C.sizeFromShape(e);if(I().getBool("WEBGL_DOWNLOAD_FLOAT_ENABLED")){let m=this.decode(t),f=this.texData.get(m.dataId),d=this.gpgpu.downloadMatrixFromPackedTexture(f.texture.texture,...Pa(e)).subarray(0,s);return this.disposeIntermediateTensorInfo(m),d}let i=I().getBool("WEBGL_PACK")&&n===!0,a=i?Ba(e):e,l=i?new Uc(a):new Gc(a),c=this.runWebGLProgram(l,[{shape:a,dtype:o,dataId:t}],"float32"),u=this.texData.get(c.dataId),p=this.gpgpu.downloadByteEncodedFloatMatrixFromOutputTexture(u.texture.texture,u.texShape[0],u.texShape[1]).subarray(0,s);return this.disposeIntermediateTensorInfo(c),p}timerAvailable(){return I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0}time(t){let e=this.activeTimers,o=[],n=!1;this.programTimersStack==null?(this.programTimersStack=o,n=!0):this.activeTimers.push(o),this.activeTimers=o,t();let s=C.flatten(this.activeTimers.map(l=>l.query)).filter(l=>l!=null),i=C.flatten(this.activeTimers.map(l=>l.name)).filter(l=>l!=null);this.activeTimers=e,n&&(this.programTimersStack=null);let a={uploadWaitMs:this.uploadWaitMs,downloadWaitMs:this.downloadWaitMs,kernelMs:null,wallMs:null};return(async()=>{if(I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0){let l=await Promise.all(s);a.kernelMs=C.sum(l),a.getExtraProfileInfo=()=>l.map((c,u)=>({name:i[u],ms:c})).map(c=>`${c.name}: ${c.ms}`).join(", ")}else a.kernelMs={error:"WebGL query timers are not supported in this environment."};return this.uploadWaitMs=0,this.downloadWaitMs=0,a})()}memory(){return{unreliable:!1,numBytesInGPU:this.numBytesInGPU,numBytesInGPUAllocated:this.textureManager.numBytesAllocated,numBytesInGPUFree:this.textureManager.numBytesFree}}startTimer(){return I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0?this.gpgpu.beginQuery():{startMs:C.now(),endMs:null}}endTimer(t){return I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0?(this.gpgpu.endQuery(),t):(t.endMs=C.now(),t)}async getQueryTime(t){if(I().getNumber("WEBGL_DISJOINT_QUERY_TIMER_EXTENSION_RELIABLE")>0)return this.gpgpu.waitForQueryAndGetTime(t);let e=t;return e.endMs-e.startMs}disposeData(t,e=!1){if(this.pendingDisposal.has(t))return!1;if(!this.texData.has(t))return!0;if(e?this.texData.get(t).refCount=0:this.texData.get(t).refCount--,!e&&this.texData.get(t).refCount>0)return!1;if(this.pendingRead.has(t))return this.pendingDisposal.add(t),this.pendingDeletes++,!1;this.releaseGPUData(t);let{complexTensorInfos:o}=this.texData.get(t);return o!=null&&(this.disposeData(o.real.dataId,e),this.disposeData(o.imag.dataId,e)),this.texData.delete(t),!0}releaseGPUData(t){let{texture:e,dtype:o,texShape:n,usage:s,isPacked:i,slice:a}=this.texData.get(t),l=a&&a.origDataId||t,c=this.dataRefCount.get(l);c>1?this.dataRefCount.set(l,c-1):(this.dataRefCount.delete(l),e!=null&&(this.numBytesInGPU-=this.computeBytes(n,o),this.textureManager.releaseTexture(e,n,s,i)));let u=this.texData.get(t);u.texture=null,u.texShape=null,u.isPacked=!1,u.slice=null}getTexture(t){return this.uploadToGPU(t),this.texData.get(t).texture.texture}getDataInfo(t){return this.texData.get(t)}shouldExecuteOnCPU(t,e=d_){return I().getBool("WEBGL_CPU_FORWARD")&&t.every(o=>this.texData.get(o.dataId).texture==null&&C.sizeFromShape(o.shape)<e)}getGPGPUContext(){return this.gpgpu}where(t){T.warn("tf.where() in webgl locks the UI thread. Call tf.whereAsync() instead");let e=t.dataSync();return u_(t.shape,e)}packedUnaryOp(t,e,o){let n=new oe(t.shape,e),s=this.compileAndRun(n,[t],o);return We().makeTensorFromTensorInfo(s)}abs(t){if(this.shouldExecuteOnCPU([t])&&t.dtype!=="complex64"){let n=qc(this.texData.get(t.dataId).values);return this.makeOutput(t.shape,t.dtype,n)}if(I().getBool("WEBGL_PACK_UNARY_OPERATIONS"))return this.packedUnaryOp(t,Gf,t.dtype);let e=new Mt(t.shape,Gf),o=this.compileAndRun(e,[t]);return We().makeTensorFromTensorInfo(o)}makeTensorInfo(t,e,o){let n;if(e==="string"&&o!=null&&o.length>0&&C.isString(o[0])){let s=o.map(i=>C.encodeString(i));n=this.write(s,t,e)}else n=this.write(o,t,e);return this.texData.get(n).usage=null,{dataId:n,shape:t,dtype:e}}makeOutput(t,e,o){return We().makeTensorFromTensorInfo(this.makeTensorInfo(t,e,o),this)}unpackTensor(t){let e=new Zc(t.shape);return this.runWebGLProgram(e,[t],t.dtype)}packTensor(t){let e=new jc(t.shape);return this.runWebGLProgram(e,[t],t.dtype,null,!0)}packedReshape(t,e){let o=[jr(t.shape),...Yr(t.shape)],n={dtype:t.dtype,shape:o,dataId:t.dataId},s=[jr(e),...Yr(e)],i=new es(s,o),a=!0,l=[o],c=this.runWebGLProgram(i,[n],t.dtype,l,a);return{dataId:c.dataId,shape:e,dtype:c.dtype}}decode(t,e){let o=this.texData.get(t),{isPacked:n,shape:s,dtype:i}=o;if(e!=null){let m=C.sizeFromShape(s),f=e[0]*e[1]*4;C.assert(m<=f,()=>"customTexShape is too small. Row * Column * 4 should be equal or larger than the size of the tensor data.")}let a=Ba(s),l;n?l=new Bc(a):l=new Lc(a);let c=!0,u=[e??Pa(a)],p=this.runWebGLProgram(l,[{shape:a,dtype:i,dataId:t}],i,u,c,e);return{dtype:i,shape:s,dataId:p.dataId}}runWebGLProgram(t,e,o,n,s=!1,i){let a=this.makeTensorInfo(t.outputShape,o),l=this.texData.get(a.dataId);if(t.packedOutput&&(l.isPacked=!0),t.outPackingScheme===Xr.DENSE){let b=i??Pa(t.outputShape);l.texShape=b.map($=>$*2)}if(t.outTexUsage!=null&&(l.usage=t.outTexUsage),C.sizeFromShape(a.shape)===0)return l.values=C.getTypedArrayFromDType(a.dtype,0),a;let c=[],u=e.map(b=>{if(b.dtype==="complex64")throw new Error("GPGPUProgram does not support complex64 input. For complex64 dtypes, please separate the program into real and imaginary parts.");let $=this.texData.get(b.dataId);if($.texture==null){if(!t.packedInputs&&C.sizeFromShape(b.shape)<=I().getNumber("WEBGL_SIZE_UPLOAD_UNIFORM"))return{shape:b.shape,texData:null,isUniform:!0,uniformValues:$.values};t.packedInputs&&($.isPacked=!0,$.shape=b.shape)}if(this.uploadToGPU(b.dataId),!!$.isPacked!=!!t.packedInputs)b=$.isPacked?this.unpackTensor(b):this.packTensor(b),c.push(b),$=this.texData.get(b.dataId);else if($.isPacked&&!jo($.shape,b.shape)){let S=b,E=b.shape;b.shape=$.shape,b=this.packedReshape(b,E),c.push(b),$=this.texData.get(b.dataId),S.shape=E}return{shape:b.shape,texData:$,isUniform:!1}});this.uploadToGPU(a.dataId);let p={shape:a.shape,texData:l,isUniform:!1},m=M0(t,u,p),f=this.getAndSaveBinary(m,()=>P0(this.gpgpu,t,u,p)),d=this.activeTimers!=null,x;d&&(x=this.startTimer()),I().get("ENGINE_COMPILE_ONLY")||O0(this.gpgpu,f,u,p,n),c.forEach(b=>this.disposeIntermediateTensorInfo(b)),d&&(x=this.endTimer(x),this.activeTimers.push({name:t.constructor.name,query:this.getQueryTime(x)}));let g=I().getNumber("WEBGL_FLUSH_THRESHOLD");if(g>0){let b=C.now();b-this.lastGlFlushTime>g&&(this.gpgpu.gl.flush(),this.lastGlFlushTime=b)}if(!I().getBool("WEBGL_LAZILY_UNPACK")&&l.isPacked&&s===!1){let b=this.unpackTensor(a);return this.disposeIntermediateTensorInfo(a),b}return a}compileAndRun(t,e,o,n,s=!1){return o=o||e[0].dtype,this.runWebGLProgram(t,e,o,n,s)}getAndSaveBinary(t,e){return t in this.binaryCache||(this.binaryCache[t]=e()),this.binaryCache[t]}getTextureManager(){return this.textureManager}dispose(){this.disposed||(I().getBool("IS_TEST")||Object.keys(this.binaryCache).forEach(e=>{this.gpgpu.deleteProgram(this.binaryCache[e].webGLProgram),delete this.binaryCache[e]}),this.textureManager.dispose(),this.canvas!=null&&typeof HTMLCanvasElement<"u"&&this.canvas instanceof HTMLCanvasElement?this.canvas.remove():this.canvas=null,this.gpgpuCreatedLocally&&(this.gpgpu.program=null,this.gpgpu.dispose()),this.disposed=!0)}floatPrecision(){return this.floatPrecisionValue==null&&(this.floatPrecisionValue=at(()=>{if(!I().get("WEBGL_RENDER_FLOAT32_ENABLED")){let t=I().getBool("DEBUG");I().set("DEBUG",!1);let e=this.abs(H(1e-8)).dataSync()[0];if(I().set("DEBUG",t),e>0)return 32}return 16})),this.floatPrecisionValue}epsilon(){return this.floatPrecision()===32?p_:m_}uploadToGPU(t){let e=this.texData.get(t),{shape:o,dtype:n,values:s,texture:i,usage:a,isPacked:l}=e;if(i!=null)return;let c=this.activeTimers!=null,u;c&&(u=C.now());let p=e.texShape;if(p==null&&(p=v0(o,l),e.texShape=p),s!=null){let m=Ba(o),f,d=p[1],x=p[0],g=s instanceof Uint8Array||s instanceof Uint8ClampedArray;(l||!g)&&([d,x]=rr(p[0],p[1])),l?f=new Vc(m,g):f=new Ga(m,g);let b=g?[x,d]:p,$=this.makeTensorInfo(b,n),S=this.texData.get($.dataId);g?S.usage=zt.PIXELS:S.usage=zt.UPLOAD,S.texShape=b,this.gpgpu.uploadDenseMatrixToTexture(this.getTexture($.dataId),d,x,s);let E=[[x,d]],R=this.runWebGLProgram(f,[$],n,E,!0),A=this.texData.get(R.dataId);e.texShape=A.texShape,e.isPacked=A.isPacked,e.usage=A.usage,I().get("ENGINE_COMPILE_ONLY")?this.disposeData(R.dataId):(e.texture=A.texture,e.values=null,this.texData.delete(R.dataId)),this.disposeIntermediateTensorInfo($),c&&(this.uploadWaitMs+=C.now()-u)}else{let m=this.acquireTexture(p,a,n,l);e.texture=m}}convertAndCacheOnCPU(t,e){let o=this.texData.get(t),{dtype:n}=o;return e!=null&&(o.values=x_(e,n)),o.values}acquireTexture(t,e,o,n){if(this.numBytesInGPU+=this.computeBytes(t,o),!this.warnedAboutMemory&&this.numBytesInGPU>this.numMBBeforeWarning*1024*1024){let s=(this.numBytesInGPU/1024/1024).toFixed(2);this.warnedAboutMemory=!0,console.warn(`High memory usage in GPU: ${s} MB, most likely due to a memory leak`)}return this.textureManager.acquireTexture(t,e,n)}computeBytes(t,e){return t[0]*t[1]*C.bytesPerElement(e)}checkCompileCompletion(){for(let[,t]of Object.entries(this.binaryCache))this.checkCompletion_(t)}async checkCompileCompletionAsync(){let t=[];if(this.gpgpu.parallelCompilationExtension){for(let[,e]of Object.entries(this.binaryCache))t.push(this.checkCompletionAsync_(e));return Promise.all(t)}else{for(let[,e]of Object.entries(this.binaryCache)){let o=new Promise(n=>{try{this.checkCompletion_(e),n(!0)}catch(s){throw s}});t.push(o)}return Promise.all(t)}}async checkCompletionAsync_(t){return this.gpgpu.gl.getProgramParameter(t.webGLProgram,this.gpgpu.parallelCompilationExtension.COMPLETION_STATUS_KHR)?this.checkCompletion_(t):(await Nc(),this.checkCompletionAsync_(t))}checkCompletion_(t){if(this.gpgpu.gl.getProgramParameter(t.webGLProgram,this.gpgpu.gl.LINK_STATUS)===!1)throw console.log(this.gpgpu.gl.getProgramInfoLog(t.webGLProgram)),this.gpgpu.gl.getShaderParameter(t.fragmentShader,this.gpgpu.gl.COMPILE_STATUS)===!1?(of(t.source,this.gpgpu.gl.getShaderInfoLog(t.fragmentShader)),new Error("Failed to compile fragment shader.")):new Error("Failed to link vertex and fragment shaders.");return!0}getUniformLocations(){for(let t of Object.values(this.binaryCache)){this.gpgpu.buildVao(t.webGLProgram);let{variablesLocations:e,customUniformLocations:o,infLoc:n,nanLoc:s,outShapeLocation:i,outShapeStridesLocation:a,outTexShapeLocation:l}=lf(this.gpgpu,t.program,t.webGLProgram);t.variablesLocations=e,t.customUniformLocations=o,t.infLoc=n,t.nanLoc=s,t.outShapeLocation=i,t.outShapeStridesLocation=a,t.outTexShapeLocation=l}}createTensorFromGPUData(t,e,o){t.channels=t.channels||"RGBA";let{texture:n,height:s,width:i,channels:a}=t,l=We().backend;if(!l.gpgpu.gl.isTexture(n))throw new Error("The texture is invalid. Also, please make sure the texture and the TFJS WebGL backend are using the same canvas. If you want to use your own custom canvas, you have to create and use the custom TFJS WebGL backend created from the canvas through 'new tf.MathBackendWebGL(customCanvas)'.");let c=l.writeTexture(n,e,o,s,i,a);return We().makeTensorFromDataId(c,e,o,l)}};Ka.nextDataId=0;function x_(r,t){if(t==="float32"||t==="complex64")return r;if(t==="int32"||t==="bool"){let e=t==="int32"?new Int32Array(r.length):new Uint8Array(r.length);for(let o=0;o<e.length;++o)e[o]=Math.round(r[o]);return e}else throw new Error(`Unknown dtype ${t}`)}ir.isBrowser()&&lm("webgl",()=>new Ka,2);var rs=`
  if (isnan(a)) return a;
  if (isnan(b)) return b;
`;var ne=class{constructor(t,e,o){this.variableNames=["A","B"],this.outputShape=T.assertAndGetBroadcastShape(e,o),this.enableShapeUniforms=it(this.outputShape.length),this.userCode=`
      float binaryOperation(float a, float b) {
        ${t}
      }

      void main() {
        float a = getAAtOutCoords();
        float b = getBAtOutCoords();
        setOutput(binaryOperation(a, b));
      }
    `}};var me=`
  result.r = isNaN.r ? NAN : result.r;
  result.g = isNaN.g ? NAN : result.g;
  result.b = isNaN.b ? NAN : result.b;
  result.a = isNaN.a ? NAN : result.a;
`;var pe=class{constructor(t,e,o,n=!1){this.variableNames=["A","B"],this.supportsBroadcasting=!0,this.packedInputs=!0,this.packedOutput=!0,this.outputShape=T.assertAndGetBroadcastShape(e,o);let s=this.outputShape.length;this.enableShapeUniforms=it(s);let i="";if(n)if(s===0||C.sizeFromShape(this.outputShape)===1)i=`
          result.y = 0.;
          result.z = 0.;
          result.w = 0.;
        `;else if(i=`
          ${K(s)} coords = getOutputCoords();
        `,s===1)this.enableShapeUniforms?i+=`
            result.y = (coords + 1) >= outShape ? 0. : result.y;
            result.z = 0.;
            result.w = 0.;
          `:i+=`
            result.y = (coords + 1) >= ${this.outputShape[0]} ? 0. : result.y;
            result.z = 0.;
            result.w = 0.;
          `;else{let l=yt("coords",s);this.enableShapeUniforms?i+=`
            bool nextRowOutOfBounds =
              (${l[s-2]} + 1) >= outShape[${s} - 2];
            bool nextColOutOfBounds =
              (${l[s-1]} + 1) >= outShape[${s} - 1];
            result.y = nextColOutOfBounds ? 0. : result.y;
            result.z = nextRowOutOfBounds ? 0. : result.z;
            result.w = nextColOutOfBounds || nextRowOutOfBounds ? 0. : result.w;
          `:i+=`
            bool nextRowOutOfBounds =
              (${l[s-2]} + 1) >= ${this.outputShape[s-2]};
            bool nextColOutOfBounds =
              (${l[s-1]} + 1) >= ${this.outputShape[s-1]};
            result.y = nextColOutOfBounds ? 0. : result.y;
            result.z = nextRowOutOfBounds ? 0. : result.z;
            result.w = nextColOutOfBounds || nextRowOutOfBounds ? 0. : result.w;
          `}this.userCode=`
      vec4 binaryOperation(vec4 a, vec4 b) {
        ${t}
      }

      void main() {
        vec4 a = getAAtOutCoords();
        vec4 b = getBAtOutCoords();

        vec4 result = binaryOperation(a, b);
        ${i}

        setOutput(result);
      }
    `}};function wt(r){let{inputs:t,backend:e}=r,{x:o}=t;return e.incRef(o.dataId),{dataId:o.dataId,shape:o.shape,dtype:o.dtype}}var Uw={kernelName:Ir,backendName:"webgl",kernelFunc:wt};function se(r){let{inputs:t,backend:e}=r,{real:o,imag:n}=t,s=e.makeTensorInfo(o.shape,"complex64"),i=e.texData.get(s.dataId),a=wt({inputs:{x:o},backend:e}),l=wt({inputs:{x:n},backend:e});return i.complexTensorInfos={real:a,imag:l},s}var Vw={kernelName:fn,backendName:"webgl",kernelFunc:se};var Uf="return (a < 0.) ? b * a : a;",Vf=`
  vec4 aLessThanZero = vec4(lessThan(a, vec4(0.)));
  return (aLessThanZero * (b * a)) + ((vec4(1.0) - aLessThanZero) * a);
`;function b_(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{alpha:s}=o,i=e.makeTensorInfo([],"float32",C.createScalarValue(s,"float32")),a=I().getBool("WEBGL_PACK_BINARY_OPERATIONS")?new pe(Vf,n.shape,i.shape):new ne(Uf,n.shape,i.shape),l=e.runWebGLProgram(a,[n,i],"float32");return e.disposeIntermediateTensorInfo(i),l}var Ww={kernelName:ii,backendName:"webgl",kernelFunc:b_};var Wf="return (a < 0.) ? b * a : a;",zf=`
  vec4 aLessThanZero = vec4(lessThan(a, vec4(0.)));
  return (aLessThanZero * (b * a)) + ((vec4(1.0) - aLessThanZero) * a);
`;function y_(r){let{inputs:t,backend:e}=r,{x:o,alpha:n}=t,s=I().getBool("WEBGL_PACK_BINARY_OPERATIONS")?new pe(zf,o.shape,n.shape):new ne(Wf,o.shape,n.shape);return e.runWebGLProgram(s,[o,n],"float32")}var zw={kernelName:Ei,backendName:"webgl",kernelFunc:y_};var Ie="if (isnan(x)) return x;";function G({opSnippet:r,packedOpSnippet:t,cpuKernelImpl:e,dtype:o}){return({inputs:n,backend:s})=>{let{x:i}=n,a=s,l=o||i.dtype;if(a.shouldExecuteOnCPU([i])&&e!=null){let p=a.texData.get(i.dataId),m=e(p.values,l);return a.makeTensorInfo(i.shape,l,m)}let c=I().getBool("WEBGL_PACK_UNARY_OPERATIONS")&&t!=null,u;return c?u=new oe(i.shape,t):u=new Mt(i.shape,r),a.runWebGLProgram(u,[i],l)}}function nt({opSnippet:r,packedOpSnippet:t,checkOutOfBounds:e=!1,supportsComplex:o=!1,cpuKernelImpl:n,dtype:s}){return({inputs:i,backend:a})=>{let{a:l,b:c}=i,u=a;if(o&&l.dtype==="complex64"){let d=u.texData.get(l.dataId),x=u.texData.get(c.dataId),[g,b]=[[d.complexTensorInfos.real,x.complexTensorInfos.real],[d.complexTensorInfos.imag,x.complexTensorInfos.imag]].map(S=>{let[E,N]=S,R={dataId:E.dataId,dtype:E.dtype,shape:l.shape},A={dataId:N.dataId,dtype:N.dtype,shape:c.shape},_=new ne(r,l.shape,c.shape);return u.runWebGLProgram(_,[R,A],Bt(E.dtype,N.dtype))}),$=se({inputs:{real:g,imag:b},backend:u});return u.disposeIntermediateTensorInfo(g),u.disposeIntermediateTensorInfo(b),$}let p=s||Bt(l.dtype,c.dtype);if((l.dtype==="string"||c.dtype==="string"||u.shouldExecuteOnCPU([l,c]))&&n!=null){let d=u.texData.get(l.dataId).values,x=u.texData.get(c.dataId).values,g=l.dtype==="string"?T.fromUint8ToStringArray(d):d,b=l.dtype==="string"?T.fromUint8ToStringArray(x):x,[$,S]=n(l.shape,c.shape,g,b,p),E=u.makeTensorInfo(S,p),N=u.texData.get(E.dataId);return N.values=$,E}let m=I().getBool("WEBGL_PACK_BINARY_OPERATIONS")&&t!=null,f;return m?f=new pe(t,l.shape,c.shape,e):f=new ne(r,l.shape,c.shape),u.runWebGLProgram(f,[l,c],p)}}function br(r,t=!1){if(r==="linear")return t?Ow:Rw;if(r==="relu")return t?Lw:_w;if(r==="elu")return t?Mw:Aw;if(r==="relu6")return t?Bw:Dw;if(r==="prelu")return t?zf:Wf;if(r==="leakyrelu")return t?Vf:Uf;if(r==="sigmoid")return t?Gw:Fw;throw new Error(`Activation ${r} has not been implemented for the WebGL backend.`)}var os=class{constructor(t,e,o,n=!1,s=!1,i=!1,a=null,l=!1,c=!1){this.variableNames=["matrixA","matrixB"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=o,this.enableShapeUniforms=it(this.outputShape.length);let u=n?t[1]:t[2],p=Math.ceil(u/2),m=n?"i * 2, rc.y":"rc.y, i * 2",f=s?"rc.z, i * 2":"i * 2, rc.z",d=n?["a.xxyy","a.zzww"]:["a.xxzz","a.yyww"],x=s?["b.xzxz","b.ywyw"]:["b.xyxy","b.zwzw"],g="",b="";a&&(l?g=`vec4 activation(vec4 a) {
          vec4 b = getPreluActivationWeightsAtOutCoords();
          ${a}
        }`:c?g=`vec4 activation(vec4 a) {
          vec4 b = getLeakyreluAlphaAtOutCoords();
          ${a}
        }`:g=`vec4 activation(vec4 x) {
          ${a}
        }`,b="result = activation(result);");let $=i?"result += getBiasAtOutCoords();":"";i&&this.variableNames.push("bias"),l&&this.variableNames.push("preluActivationWeights"),c&&this.variableNames.push("leakyreluAlpha");let S="rc.x",E="rc.x";t[0]<e[0]?S=`imod(rc.x, ${t[0]})`:e[0]<t[0]&&(E=`imod(rc.x, ${e[0]})`),this.userCode=`
      ${g}
      // Don't use uniform for sharedDimensionPacked for performance.
      const float sharedDimension = ${p}.0;

      vec4 dot2x2ARowBCol(ivec3 rc) {
        vec4 result = vec4(0);
        int batchA = ${S};
        int batchB = ${E};
        for (int i = 0; i < ${p}; i++) {
          vec4 a = getMatrixA(batchA, ${m});
          vec4 b = getMatrixB(batchB, ${f});

          // These swizzled products need to be separately added.
          // See: https://github.com/tensorflow/tfjs/issues/1735
          result += (${d[0]} * ${x[0]});
          result += (${d[1]} * ${x[1]});
        }
        return result;
      }

      void main() {
        ivec3 rc = getOutputCoords();
        vec4 result = dot2x2ARowBCol(rc);

        ${$}

        ${b}

        setOutput(result);
      }
    `}};var Kf={REAL:"return areal * breal - aimag * bimag;",IMAG:"return areal * bimag + aimag * breal;"},Ha=class{constructor(t,e,o){this.variableNames=["AReal","AImag","BReal","BImag"],this.outputShape=T.assertAndGetBroadcastShape(e,o),this.userCode=`
      float binaryOpComplex(
          float areal, float aimag, float breal, float bimag) {
        ${t}
      }

      void main() {
        float areal = getARealAtOutCoords();
        float aimag = getAImagAtOutCoords();
        float breal = getBRealAtOutCoords();
        float bimag = getBImagAtOutCoords();
        setOutput(binaryOpComplex(areal, aimag, breal, bimag));
      }
    `}};var Kw="return a * b;";function qa(r){let{inputs:t,backend:e}=r,{a:o,b:n}=t,s=T.upcastType(o.dtype,n.dtype);if(o.dtype==="complex64"){let a=e.texData.get(o.dataId),l=e.texData.get(n.dataId),c=new Ha(Kf.REAL,o.shape,n.shape),u=new Ha(Kf.IMAG,o.shape,n.shape),p=[{dataId:a.complexTensorInfos.real.dataId,dtype:a.complexTensorInfos.real.dtype,shape:o.shape},{dataId:a.complexTensorInfos.imag.dataId,dtype:a.complexTensorInfos.imag.dtype,shape:o.shape},{dataId:l.complexTensorInfos.real.dataId,dtype:l.complexTensorInfos.real.dtype,shape:n.shape},{dataId:l.complexTensorInfos.imag.dataId,dtype:l.complexTensorInfos.imag.dtype,shape:n.shape}],m=e.runWebGLProgram(c,p,"float32"),f=e.runWebGLProgram(u,p,"float32"),d=se({inputs:{real:m,imag:f},backend:e});return e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),d}if(e.shouldExecuteOnCPU([o,n])){let a=e.texData.get(o.dataId),l=e.texData.get(n.dataId),[c,u]=rw(o.shape,n.shape,a.values,l.values,s),p=e.makeTensorInfo(u,s),m=e.texData.get(p.dataId);return m.values=c,p}let i;return I().getBool("WEBGL_PACK_BINARY_OPERATIONS")?i=new pe(Kw,o.shape,n.shape):i=new ne(Kw,o.shape,n.shape),e.runWebGLProgram(i,[o,n],s)}var Hw={kernelName:go,backendName:"webgl",kernelFunc:qa};function qw(r,t,e){let o=[jr(r.shape),...Yr(r.shape)],n={dtype:r.dtype,shape:o,dataId:r.dataId},s=[jr(t),...Yr(t)],i=new es(s,o),a=!0,l=[o],c=e.runWebGLProgram(i,[n],r.dtype,l,a);return{dataId:c.dataId,shape:t,dtype:c.dtype}}function D(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{shape:s}=o,i=e,a=C.sizeFromShape(n.shape),l=C.inferFromImplicitShape(s,a),c=C.sizeFromShape(l);C.assert(a===c,()=>`The new shape (${l}) has ${c} elements and the old shape (${n.shape}) has ${a} elements. The new shape and old shape must have the same number of elements.`);let u=i.texData.get(n.dataId);return u.isPacked&&!jo(n.shape,l)&&!(u.texture!==null&&jo(u.shape,l))?qw(n,l,i):(i.incRef(n.dataId),{dataId:n.dataId,shape:l,dtype:n.dtype})}var Xw={kernelName:Di,backendName:"webgl",kernelFunc:D};var Xa=class{constructor(t,e){this.variableNames=["x"];let{windowSize:o,batchSize:n,inSize:s,outSize:i}=t;this.outputShape=[n,i];let a=Math.floor(o/4)*4,l=o%4,c="sumValue += dot(values, ones);";if(e!=null){let p=1/e;c=`sumValue += dot(values * ${C.isInt(p)?p.toPrecision(2):p}, ones);`}let u="";s%o>0&&(u=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return 0.0;
        }
      `),this.userCode=`
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float getValue(int batch, int inIdx) {
        ${u}
        return getX(batch, inIdx);
      }

      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = outIdx * ${o};

        float sumValue = 0.0;

        for (int i = 0; i < ${a}; i += 4) {
          int inIdx = inOffset + i;
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            getValue(batch, inIdx + 3)
          );

          ${c}
        }

        int inIdx = inOffset + ${a};
        if (${l===1}) {
          vec4 values = vec4(getValue(batch, inIdx), 0.0, 0.0, 0.0);

          ${c}
        } else if (${l===2}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1), 0.0, 0.0);

          ${c}
        } else if (${l===3}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2), 0.0);

          ${c}
        }
        setOutput(sumValue);
      }
    `}};var Jc=class{constructor(t,e){this.variableNames=["x"];let{windowSize:o,batchSize:n,inSize:s,outSize:i}=t;this.outputShape=[n,i];let a="0.0",l="";e==="prod"?a="1.0":e==="min"?(a="1.0 / 1e-20",l="min"):e==="max"&&(a="-1.0 / 1e-20",l="max");let c=`${e}(${e}(${e}(minMaxValue[0], minMaxValue[1]), minMaxValue[2]), minMaxValue[3])`;e==="sum"?c="sumValue":e==="prod"?c="prodValue":e==="all"?c="allValue":e==="any"&&(c="anyValue");let u=Math.floor(o/4)*4,p=o%4,m=`
      if (${e==="sum"}) {
        sumValue += dot(values, ones);
      } else if (${e==="prod"}) {
        vec2 tmp = vec2(values[0], values[1]) * vec2(values[2], values[3]);
        prodValue *= tmp[0] * tmp[1];
      } else {
        minMaxValue = ${l}(values, minMaxValue);
        if (${e==="min"} || ${e==="max"}) {
          minMaxValue = ${l}(values, minMaxValue);
          bvec4 isNaN = isnan(values);
          if (isNaN.r || isNaN.g || isNaN.b || isNaN.a) {
            minMaxValue = vec4(NAN);
          }
        }
      }
    `,f="vec4";e==="all"?(a="1.0",m=`
        bool reducedAllValue = all(values);
        float floatedReducedAllValue = float(reducedAllValue);
        allValue = float(allValue >= 1.0 && floatedReducedAllValue >= 1.0);
      `,f="bvec4"):e==="any"&&(a="0.0",m=`
        bool reducedAnyValue = any(values);
        float floatedReducedAnyValue = float(reducedAnyValue);
        anyValue = float(anyValue >= 1.0 || floatedReducedAnyValue >= 1.0);
      `,f="bvec4");let d="";s%o>0&&(d=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return initializationValue;
        }
      `),this.userCode=`
      const float initializationValue = ${a};
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float getValue(int batch, int inIdx) {
        ${d}
        return getX(batch, inIdx);
      }

      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = outIdx * ${o};

        vec4 minMaxValue = vec4(${a});
        float prodValue = 1.0;
        float sumValue = 0.0;
        float allValue = 1.0;
        float anyValue = 0.0;

        for (int i = 0; i < ${u}; i += 4) {
          int inIdx = inOffset + i;
          ${f} values = ${f}(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            getValue(batch, inIdx + 3)
          );

          ${m}
        }

        int inIdx = inOffset + ${u};
        if (${p===1}) {
          ${f} values = ${f}(
            getValue(batch, inIdx),
            initializationValue,
            initializationValue,
            initializationValue
          );

          ${m}
        } else if (${p===2}) {
          ${f} values = ${f}(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            initializationValue,
            initializationValue
          );

          ${m}
        } else if (${p===3}) {
          ${f} values = ${f}(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            initializationValue
          );

          ${m}
        }
        setOutput(${c});
      }
    `}};function C_(r){let t=[];for(;t.length===0||t[t.length-1].outSize!==1;){let e=t.length?t[t.length-1].outSize:r[1],o=T.computeOptimalWindowSize(e);t.push({inSize:e,windowSize:o,outSize:Math.ceil(e/o)})}return t}function fe(r,t,e,o){let n=C_(r.shape),s=r;for(let i=0;i<n.length;i++){let{inSize:a,windowSize:l,outSize:c}=n[i],u,p;e==="mean"?u=i===0?new Xa({windowSize:l,inSize:a,batchSize:r.shape[0],outSize:c},a):new Xa({windowSize:l,inSize:a,batchSize:r.shape[0],outSize:c}):u=new Jc({windowSize:l,inSize:a,batchSize:r.shape[0],outSize:c},e),p=s,s=o.runWebGLProgram(u,[s],t),p.dataId!==r.dataId&&o.disposeIntermediateTensorInfo(p)}return s}var tu=class{constructor(t,e){this.variableNames=["A"];let o=new Array(t.length);for(let i=0;i<o.length;i++)o[i]=t[e[i]];this.outputShape=o,this.rank=o.length;let n=K(this.rank),s=v_(e);this.userCode=`
    void main() {
      ${n} resRC = getOutputCoords();
      setOutput(getA(${s}));
    }
    `}};function v_(r){let t=r.length;if(t>6)throw Error(`Transpose for rank ${t} is not yet supported`);let e=["resRC.x","resRC.y","resRC.z","resRC.w","resRC.u","resRC.v"],o=new Array(t);for(let n=0;n<r.length;n++)o[r[n]]=e[n];return o.join()}var eu=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0;let o=new Array(t.length);for(let u=0;u<o.length;u++)o[u]=t[e[u]];if(this.outputShape=o,this.rank=o.length,this.rank>6)throw Error(`Packed transpose for rank ${this.rank} is not yet supported.`);let n=K(this.rank),s=Bf("rc",this.rank),i=new Array(this.rank);for(let u=0;u<e.length;u++)i[e[u]]=s[u];let a=`vec2(${i.slice(-2).join()})`,l=`++${s[this.rank-1]} < ${o[this.rank-1]}`,c=`getChannel(getA(${i.join()}), ${a})`;this.userCode=`
    void main() {
      ${n} rc = getOutputCoords();
      vec4 result = vec4(0.);
      result[0] = ${c};
      if(${l}) {
        result[1] = ${c};
      }
      --${s[this.rank-1]};
      if(++${s[this.rank-2]} < ${o[this.rank-2]}) {
        result[2] = ${c};
        if(${l}) {
          result[3] = ${c};
        }
      }
      setOutput(result);
    }
    `}};function Zr(r,t,e){let o=I().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new eu(r.shape,t):new tu(r.shape,t);return e.runWebGLProgram(o,[r],r.dtype)}function jw(r,t,e,o){let n=t,s=r.shape.length,i=C.parseAxisParam(n,r.shape),a=i,l=T.getAxesPermutation(a,s),c=l!=null,u=r;c&&(u=Zr(r,l,o),a=T.getInnerMostAxes(a.length,s)),T.assertAxesAreInnerMostDims("sum",a,s);let[p,m]=T.computeOutAndReduceShapes(u.shape,a),f=p;e&&(f=T.expandShapeToKeepDim(p,i));let d=C.sizeFromShape(m),g=C.sizeFromShape(r.shape)/d,b=D({inputs:{x:u},attrs:{shape:[g,d]},backend:o}),$=Rr(r.dtype),S=fe(b,$,"sum",o),E=D({inputs:{x:S},attrs:{shape:f},backend:o});return o.disposeIntermediateTensorInfo(b),o.disposeIntermediateTensorInfo(S),c&&o.disposeIntermediateTensorInfo(u),E}function Jo(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:i}=o;return jw(n,s,i,e)}var Yw={kernelName:"Sum",backendName:"webgl",kernelFunc:Jo};function mt(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{perm:s}=o,i=e,a=n.shape.length,l=new Array(a);for(let u=0;u<l.length;u++)l[u]=n.shape[s[u]];let c;if(i.shouldExecuteOnCPU([n])){let p=i.texData.get(n.dataId).values,m=Qo(p,n.shape,n.dtype,s,l);c=i.makeTensorInfo(l,n.dtype);let f=i.texData.get(c.dataId);f.values=m}else c=Zr(n,s,i);return c}var Zw={kernelName:So,backendName:"webgl",kernelFunc:mt};var Hf=1e3;function tn({a:r,b:t,transposeA:e,transposeB:o,backend:n,bias:s=null,preluActivationWeights:i=null,leakyreluAlpha:a=0,activation:l=null}){let c=r.shape.length,u=t.shape.length,p=e?r.shape[c-2]:r.shape[c-1],m=o?t.shape[u-1]:t.shape[u-2],f=e?r.shape[c-1]:r.shape[c-2],d=o?t.shape[u-2]:t.shape[u-1],x=r.shape.slice(0,-2),g=t.shape.slice(0,-2),b=C.sizeFromShape(x),$=C.sizeFromShape(g),E=ur.assertAndGetBroadcastShape(r.shape.slice(0,-2),t.shape.slice(0,-2)).concat([f,d]);C.assert(p===m,()=>`Error in matMul: inner shapes (${p}) and (${m}) of Tensors with shapes ${r.shape} and ${t.shape} and transposeA=${e} and transposeB=${o} must match.`);let N=e?[b,p,f]:[b,f,p],R=o?[$,d,m]:[$,m,d],A=D({inputs:{x:r},backend:n,attrs:{shape:N}}),_=D({inputs:{x:t},backend:n,attrs:{shape:R}}),P=[A,_],O=Math.max(b,$),B=e?A.shape[1]:A.shape[2],W=s!=null,J=i!=null,et=l==="leakyrelu",st=l!=null?br(l,!0):null,At=W||J||et||st!=null,It;if((f===1||d===1)&&B>Hf&&At===!1){let Qt=A,Cr=_;e&&(Qt=mt({inputs:{x:A},backend:n,attrs:{perm:[0,2,1]}}),P.push(Qt)),o&&(Cr=mt({inputs:{x:_},backend:n,attrs:{perm:[0,2,1]}}),P.push(Cr));let nn=d!==1,Qa=d===1,wp=Qt;nn&&(wp=D({inputs:{x:Qt},backend:n,attrs:{shape:[O,B,1]}}),P.push(wp));let x$=d===1?2:1,Cp=Cr;Qa&&(Cp=D({inputs:{x:Cr},backend:n,attrs:{shape:[O,1,B]}}),P.push(Cp));let ad=qa({inputs:{a:wp,b:Cp},backend:n});It=Jo({inputs:{x:ad},backend:n,attrs:{axis:x$,keepDims:!0}}),P.push(ad)}else{let Qt=Bt(r.dtype,t.dtype),Cr=new os(N,R,[O,f,d],e,o,W,st,J,et),nn=[A,_];if(s!=null&&nn.push(s),J&&nn.push(i),et){let Qa=n.makeTensorInfo([],"float32",C.createScalarValue(a,"float32"));nn.push(Qa),P.push(Qa)}It=n.runWebGLProgram(Cr,nn,Qt)}let $t=D({inputs:{x:It},backend:n,attrs:{shape:E}});P.push(It);for(let Qt of P)n.disposeIntermediateTensorInfo(Qt);return $t}function $_(r){let{inputs:t,backend:e,attrs:o}=r,{a:n,b:s,bias:i,preluActivationWeights:a}=t,{transposeA:l,transposeB:c,activation:u,leakyreluAlpha:p}=o;return tn({a:n,b:s,transposeA:l,transposeB:c,backend:e,bias:i,preluActivationWeights:a,leakyreluAlpha:p,activation:u})}var Qw={kernelName:Cn,backendName:"webgl",kernelFunc:$_};var Jw="return abs(x);";function S_(r){let{inputs:t,backend:e}=r,{x:o}=t;if(e.shouldExecuteOnCPU([o])&&o.dtype!=="complex64"){let s=e.texData.get(o.dataId),i=qc(s.values);return e.makeTensorInfo(o.shape,o.dtype,i)}let n;return I().getBool("WEBGL_PACK_UNARY_OPERATIONS")?n=new oe(o.shape,Jw):n=new Mt(o.shape,Jw),e.runWebGLProgram(n,[o],o.dtype)}var tC={kernelName:"Abs",backendName:"webgl",kernelFunc:S_};var T_=Et+`
  if (abs(x) > 1.) {
    return NAN;
  }
  return acos(x);
`,E_=G({opSnippet:T_}),eC={kernelName:ms,backendName:"webgl",kernelFunc:E_};var I_=Et+`
  if (x < 1.0) return NAN;
return log(x + sqrt(x * x - 1.0));`,N_=G({opSnippet:I_}),rC={kernelName:fs,backendName:"webgl",kernelFunc:N_};var oC="return a + b;",k_=nt({opSnippet:oC,packedOpSnippet:oC,supportsComplex:!0,cpuKernelImpl:Py}),nC={kernelName:"Add",backendName:"webgl",kernelFunc:k_};var ru=class{constructor(t,e){this.outputShape=[],this.outputShape=t,this.variableNames=e.map((s,i)=>`T${i}`);let o=[];this.variableNames.forEach(s=>{o.push(`float v${s} = get${s}AtOutCoords();`)});let n=this.variableNames.map(s=>`v${s}`).join(" + ");this.userCode=`
      void main() {
        ${o.join(`
        `)}

        float result = ${n};
        setOutput(result);
      }
    `}};var ou=class{constructor(t,e){this.outputShape=[],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=t,this.variableNames=e.map((s,i)=>`T${i}`);let o=[];this.variableNames.forEach(s=>{o.push(`vec4 v${s} = get${s}AtOutCoords();`)});let n=this.variableNames.map(s=>`v${s}`).join(" + ");this.userCode=`
      void main() {
        ${o.join(`
        `)}

        vec4 result = ${n};
        setOutput(result);
      }
    `}};function nu(r){let{inputs:t,backend:e}=r,o=t;if(o.length===1)return wt({inputs:{x:o[0]},backend:e});if(o.length>I().getNumber("WEBGL_MAX_TEXTURES_IN_SHADER")){let l=Math.floor(o.length/2),c=nu({inputs:o.slice(0,l),backend:e}),u=nu({inputs:o.slice(l),backend:e});return nu({inputs:[c,u],backend:e})}let n=o.map(l=>l.dtype).reduce((l,c)=>Bt(l,c)),s=o.map(l=>l.shape),a=I().getBool("WEBGL_PACK")?new ou(o[0].shape,s):new ru(o[0].shape,s);return e.runWebGLProgram(a,o,n)}var sC={kernelName:ds,backendName:"webgl",kernelFunc:nu};function R_(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:i}=o,a=n.shape.length,l=C.parseAxisParam(s,n.shape),c=l,u=T.getAxesPermutation(c,a),p=n;u!=null&&(p=mt({inputs:{x:n},backend:e,attrs:{perm:u}}),c=T.getInnerMostAxes(c.length,a)),T.assertAxesAreInnerMostDims("all",c,a);let[m,f]=T.computeOutAndReduceShapes(p.shape,c),d=C.sizeFromShape(f),x=D({inputs:{x:p},backend:e,attrs:{shape:[-1,d]}}),g=fe(x,x.dtype,"all",e),b;if(i){let $=T.expandShapeToKeepDim(m,l);b=D({inputs:{x:g},backend:e,attrs:{shape:$}})}else b=D({inputs:{x:g},backend:e,attrs:{shape:m}});return e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),u!=null&&e.disposeIntermediateTensorInfo(p),b}var iC={kernelName:"All",backendName:"webgl",kernelFunc:R_};function A_(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:i}=o,a=n.shape.length,l=C.parseAxisParam(s,n.shape),c=l,u=T.getAxesPermutation(c,a),p=n;u!=null&&(p=mt({inputs:{x:n},backend:e,attrs:{perm:u}}),c=T.getInnerMostAxes(c.length,a)),T.assertAxesAreInnerMostDims("any",c,a);let[m,f]=T.computeOutAndReduceShapes(p.shape,c),d=C.sizeFromShape(f),x=D({inputs:{x:p},backend:e,attrs:{shape:[-1,d]}}),g=fe(x,x.dtype,"any",e),b;if(i){let $=T.expandShapeToKeepDim(m,l);b=D({inputs:{x:g},backend:e,attrs:{shape:$}})}else b=D({inputs:{x:g},backend:e,attrs:{shape:m}});return e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),u!=null&&e.disposeIntermediateTensorInfo(p),b}var aC={kernelName:"Any",backendName:"webgl",kernelFunc:A_};var su=class{constructor(t,e,o){this.variableNames=["A"];let{windowSize:n,batchSize:s,outSize:i}=t;o||this.variableNames.push("bestIndicesA"),this.outputShape=[s,i];let a=e==="max"?">":"<",l=o?"inOffset + i;":"round(getBestIndicesA(batch, inOffset + i));";this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = outIdx * ${n};

        int bestIndex = inOffset;
        float bestValue = getA(batch, bestIndex);

        for (int i = 0; i < ${n}; i++) {
          int inIdx = ${l};
          float candidate = getA(batch, inIdx);
          if (candidate ${a} bestValue) {
            bestValue = candidate;
            bestIndex = inIdx;
          }
        }
        setOutput(float(bestIndex));
      }
    `}};var iu=class{constructor(t,e,o,n){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,C.assert(t.length>2,()=>`Packed arg${o.charAt(0).toUpperCase()+o.slice(1)} supports only inputs with rank above 2.`);let s=t[t.length-1],i=Math.ceil(s/e);this.outputShape=t.slice(0,-1),i>1&&this.outputShape.push(i),n||this.variableNames.push("bestIndicesA");let a=this.outputShape,l=a.length,c=K(l),u=yt("coords",l),p,m;if(i===1){m=l+1;let _=K(m);p=`
        ${_} sourceLocR = ${_}(${u.join()}, 0);
        ++${u[l-1]};
        ${_} sourceLocG = ${_}(${u.join()}, 0);
        ++${u[l-2]};
        ${_} sourceLocA = ${_}(${u.join()}, 0);
        --${u[l-1]};
        ${_} sourceLocB = ${_}(${u.join()}, 0);
        --${u[l-2]};`}else m=l,p=`
        ${c} sourceLocR = coords;
        ++${u[l-1]};
        ${c} sourceLocG = coords;
        ++${u[l-2]};
        ${c} sourceLocA = coords;
        --${u[l-1]};
        ${c} sourceLocB = coords;
        --${u[l-2]};`;let f=["x","y","z","w","u","v"].slice(0,m),d="."+f[m-1],x=f.map(_=>"int "+_),g=yt("sourceLocR",m-1).concat("inIdx.r"),b=yt("sourceLocG",m-1).concat("inIdx.g"),$=yt("sourceLocB",m-1).concat("inIdx.b"),S=yt("sourceLocA",m-1).concat("inIdx.a"),E=o==="max"?"greaterThan":"lessThan",N=n?"":`
          inIdx = round(vec4(getBestIndicesAChannel(${g.join()}),
                             getBestIndicesAChannel(${b.join()}),
                             getBestIndicesAChannel(${$.join()}),
                             getBestIndicesAChannel(${S.join()})));`,R=`vec4(
            getAChannel(${g.join()}),
            hasNextCol ? getAChannel(${b.join()}) : 0.,
            hasNextRow ? getAChannel(${$.join()}) : 0.,
            hasNextRow && hasNextCol ? getAChannel(${S.join()}) : 0.)`,A=n?"":`
      float getBestIndicesAChannel(${x.join()}) {
        return getChannel(getBestIndicesA(${f.join()}),
                                          vec2(${f.slice(-2).join()}));
      }`;this.userCode=`
      float getAChannel(${x.join()}) {
        return getChannel(getA(${f.join()}),
                               vec2(${f.slice(-2).join()}));
      }
      ${A}
      void main() {
        ${c} coords = getOutputCoords();
        bool hasNextCol = ${u[l-1]} < ${a[l-1]-1};
        bool hasNextRow = ${u[l-2]} < ${a[l-2]-1};
        ${p}
        ivec4 srcIdx = ivec4(sourceLocR${d}, sourceLocG${d},
          sourceLocB${d}, sourceLocA${d}) * ${e};
        ivec4 inIdx = srcIdx;
        vec4 bestIndex = vec4(inIdx);
        vec4 bestValue = ${R};

        for (int i = 0; i < ${e}; i++) {
          inIdx = srcIdx;
          ${N}
          vec4 candidate = ${R};
          bvec4 nan = isnan(candidate);
          bvec4 replace = bvec4(
            vec4(${E}(candidate, bestValue)) * (vec4(1.0) - vec4(nan)));

          bestValue = vec4(replace.x  ? candidate.x : bestValue.x,
                           replace.y  ? candidate.y : bestValue.y,
                           replace.z  ? candidate.z : bestValue.z,
                           replace.w  ? candidate.w : bestValue.w);
          bestIndex = mix(bestIndex, vec4(inIdx), vec4(replace));
          srcIdx++;
        }
        setOutput(bestIndex);
      }
    `}};function lC(r,t,e,o=null){let n=t.shape[0],s=t.shape[1];o!=null&&(n=o.shape[0],s=o.shape[1]);let i=T.computeOptimalWindowSize(s),a={windowSize:i,inSize:s,batchSize:n,outSize:Math.ceil(s/i)},l=new su(a,e,o==null),c=[t];o!=null&&c.push(o);let u=r.runWebGLProgram(l,c,"int32");if(u.shape[1]===1)return u;let p=lC(r,t,e,u);return r.disposeIntermediateTensorInfo(u),p}function cC(r,t,e,o=null){let n=o!=null?o.shape:t.shape,s=n[n.length-1],i=T.computeOptimalWindowSize(s),a=new iu(n,i,e,o==null),l=o==null?[t]:[t,o],c=r.runWebGLProgram(a,l,"int32");if(c.shape.length===t.shape.length){let u=cC(r,t,e,c);return r.disposeIntermediateTensorInfo(c),u}return c}function au(r,t,e,o){let n=[e];if(T.assertAxesAreInnerMostDims("arg"+o.charAt(0).toUpperCase()+o.slice(1),n,t.shape.length),!I().getBool("WEBGL_PACK_REDUCE")||t.shape.length<=2){let s=[],i=r.texData.get(t.dataId),a=i!==null&&i.isPacked,l=t;a&&(l=r.unpackTensor(t),s.push(l));let[c,u]=T.computeOutAndReduceShapes(l.shape,n),p=C.sizeFromShape(u),m=D({inputs:{x:l},backend:r,attrs:{shape:[-1,p]}});s.push(m);let f=lC(r,m,o);s.push(f);let d=D({inputs:{x:f},backend:r,attrs:{shape:c}});return s.forEach(x=>r.disposeIntermediateTensorInfo(x)),d}return cC(r,t,o)}function __(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s}=o,i=C.parseAxisParam(s,n.shape),a=T.getAxesPermutation(i,n.shape.length),l=n,c=[];a!=null&&(l=mt({inputs:{x:n},backend:e,attrs:{perm:a}}),c.push(l),i=T.getInnerMostAxes(i.length,l.shape.length)),T.assertAxesAreInnerMostDims("argMax",[i[0]],l.shape.length);let u=au(e,l,i[0],"max");return c.forEach(p=>e.disposeIntermediateTensorInfo(p)),u}var uC={kernelName:hs,backendName:"webgl",kernelFunc:__};function D_(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s}=o,i=C.parseAxisParam(s,n.shape),a=T.getAxesPermutation(i,n.shape.length),l=n,c=[];a!=null&&(l=mt({inputs:{x:n},backend:e,attrs:{perm:a}}),c.push(l),i=T.getInnerMostAxes(i.length,l.shape.length)),T.assertAxesAreInnerMostDims("argMin",[i[0]],l.shape.length);let u=au(e,l,i[0],"min");return c.forEach(p=>e.disposeIntermediateTensorInfo(p)),u}var pC={kernelName:gs,backendName:"webgl",kernelFunc:D_};var F_=Et+`
  if (abs(x) > 1.) {
    return NAN;
  }
  return asin(x);
`,P_=G({opSnippet:F_}),mC={kernelName:xs,backendName:"webgl",kernelFunc:P_};var O_=Et+"return log(x + sqrt(x * x + 1.0));",M_=G({opSnippet:O_}),fC={kernelName:bs,backendName:"webgl",kernelFunc:M_};var L_=Et+`
  return atan(x);
`,B_=G({opSnippet:L_}),dC={kernelName:ys,backendName:"webgl",kernelFunc:B_};var G_=rs+`
  return atan(a, b);
`,U_=`
  vec4 result = atan(a, b);
  bvec4 isNaNA = isnan(a);
  bvec4 isNaNB = isnan(b);
  bvec4 isNaN = bvec4(isNaNA.x || isNaNB.x, isNaNA.y || isNaNB.y, isNaNA.z || isNaNB.z, isNaNA.w || isNaNB.w);
  `+me+`
  return result;
`,V_=nt({opSnippet:G_,packedOpSnippet:U_}),hC={kernelName:Cs,backendName:"webgl",kernelFunc:V_};var W_=Et+`
  if ((x < -1.0) || (x > 1.0)) return NAN;
return (log(1.0 + x) - log(1.0 - x)) / 2.0;`,z_=G({opSnippet:W_}),gC={kernelName:ws,backendName:"webgl",kernelFunc:z_};var Oe=class{constructor(t,e,o,n=!1,s=!1){if(this.variableNames=["x"],e==="avg"&&o)throw new Error("Cannot compute positions for average pool.");let i=t.filterWidth,a=t.strideHeight,l=t.strideWidth,c=t.dilationHeight,u=t.dilationWidth,p=t.effectiveFilterHeight,m=t.effectiveFilterWidth,f=t.padInfo.top,d=t.padInfo.left;this.outputShape=t.outShape;let x=e==="avg",g=`((batch  * ${t.inHeight} + xR) * ${t.inWidth} + xC) * ${t.inChannels} + d`,b=`(xR * ${t.inWidth} + xC) * ${t.inChannels} + d`,$="0.0";if(x||($="-1.0 / 1e-20"),o){this.userCode=`
        const ivec2 strides = ivec2(${a}, ${l});
        const ivec2 pads = ivec2(${f}, ${d});

        void main() {
          ivec4 coords = getOutputCoords();
          int batch = coords[0];
          int d = coords[3];

          ivec2 xRCCorner = coords.yz * strides - pads;
          int xRCorner = xRCCorner.x;
          int xCCorner = xRCCorner.y;

          // max/min x(?, ?, d) to get y(yR, yC, d).
          // ? = to be determined
          float minMaxValue = 0.0;
          float minMaxValueFound = 0.0;
          int minMaxPosition = 0;
          float avgValue = 0.0;

          for (int wR = 0; wR < ${p};
              wR += ${c}) {
            int xR = xRCorner + wR;

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int wC = 0; wC < ${m};
                wC += ${u}) {
              int xC = xCCorner + wC;

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              float value = getX(batch, xR, xC, d);

              // If a min / max value has already been found, use it. If not,
              // use the current value.
              float currMinMaxValue = mix(
                  value, minMaxValue, minMaxValueFound);
              if (value >= currMinMaxValue) {
                minMaxValue = value;
                minMaxValueFound = 1.0;
                minMaxPosition = ${n?s?g:b:`wR * ${m} + wC`};
              }
            }
          }
          setOutput(float(minMaxPosition));
        }
      `;return}let S="max",E=`${e}(${e}(${e}(minMaxValue[0], minMaxValue[1]), minMaxValue[2]), minMaxValue[3])`;e==="avg"&&(E="avgValue / max(count, 1.0)");let N=Math.floor(i/4)*4,R=i%4,A=`
      if (${x}) {
        avgValue += dot(values, ones);
      } else {
        minMaxValue = ${S}(values, minMaxValue);
      }
    `;this.userCode=`
      const ivec2 strides = ivec2(${a}, ${l});
      const ivec2 pads = ivec2(${f}, ${d});
      const float initializationValue = ${$};
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float count = 0.0;

      float getValue(int batch, int xR, int xC, int d) {
        if (xC < 0 || xC >= ${t.inWidth}) {
          return initializationValue;
        }
        count += 1.0;
        return getX(batch, xR, xC, d);
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d = coords[3];

        ivec2 xRCCorner = coords.yz * strides - pads;
        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        // max/min x(?, ?, d) to get y(yR, yC, d).
        // ? = to be determined
        vec4 minMaxValue = vec4(${$});
        float avgValue = 0.0;
        count = 0.0;

        for (int wR = 0; wR < ${p};
            wR += ${c}) {
          int xR = xRCorner + wR;

          if (xR < 0 || xR >= ${t.inHeight}) {
            continue;
          }

          for (int wC = 0; wC < ${N}; wC += 4) {
            int xC = xCCorner + wC * ${u};

            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              getValue(batch, xR, xC + ${u}, d),
              getValue(batch, xR, xC + 2 * ${u}, d),
              getValue(batch, xR, xC + 3 * ${u}, d)
            );

            ${A}
          }

          int xC = xCCorner + ${N};
          if (${R===1}) {
            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              initializationValue,
              initializationValue,
              initializationValue
            );

            ${A}
          } else if (${R===2}) {
            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              getValue(batch, xR, xC + ${u}, d),
              initializationValue,
              initializationValue
            );

            ${A}
          } else if (${R===3}) {
            vec4 values = vec4(
              getValue(batch, xR, xC, d),
              getValue(batch, xR, xC + ${u}, d),
              getValue(batch, xR, xC + 2 * ${u}, d),
              initializationValue
            );

            ${A}
          }
        }
        setOutput(${E});
      }
    `}},Qr=class{constructor(t,e,o,n=!1,s=!1){if(this.variableNames=["x"],e==="avg"&&o)throw new Error("Cannot compute positions for average pool.");let i=t.filterWidth,a=t.strideDepth,l=t.strideHeight,c=t.strideWidth,u=t.dilationDepth,p=t.dilationHeight,m=t.dilationWidth,f=t.effectiveFilterDepth,d=t.effectiveFilterHeight,x=t.effectiveFilterWidth,g=t.padInfo.front,b=t.padInfo.top,$=t.padInfo.left;this.outputShape=t.outShape;let S=e==="avg",E="0.0";if(S||(E="-1.0 / 1e-20"),o){this.userCode=`
        const ivec3 strides =
            ivec3(${a}, ${l}, ${c});
        const ivec3 pads = ivec3(${g}, ${b}, ${$});

        void main() {
          ivec5 coords = getOutputCoords();
          int batch = coords.x;
          int ch = coords.u;

          ivec3 xCorner = ivec3(coords.y, coords.z, coords.w) * strides - pads;
          int xDCorner = xCorner.x;
          int xRCorner = xCorner.y;
          int xCCorner = xCorner.z;

          // max/min x(?, ?, ?, ch) to get y(yD, yR, yC, ch).
          // ? = to be determined
          float minMaxValue = 0.0;
          float minMaxValueFound = 0.0;
          int minMaxPosition = 0;

          for (int wD = 0; wD < ${f};
              wD += ${u}) {
            int xD = xDCorner + wD;

            if (xD < 0 || xD >= ${t.inDepth}) {
              continue;
            }

            for (int wR = 0; wR < ${d};
                wR += ${p}) {
              int xR = xRCorner + wR;

              if (xR < 0 || xR >= ${t.inHeight}) {
                continue;
              }

              for (int wC = 0; wC < ${x};
                  wC += ${m}) {
                int xC = xCCorner + wC;

                if (xC < 0 || xC >= ${t.inWidth}) {
                  continue;
                }

                float value = getX(batch, xD, xR, xC, ch);

                // If a min / max value has already been found, use it. If not,
                // use the current value.
                float currMinMaxValue = mix(
                    value, minMaxValue, minMaxValueFound);
                if (value >= currMinMaxValue) {
                  minMaxValue = value;
                  minMaxValueFound = 1.0;
                  minMaxPosition = ${n?s?`(((batch * ${t.inDepth} + xD) * ${t.inHeight} + xR) * ${t.inWidth} + xC) * ${t.inChannels} + ch`:`((xD * ${t.inHeight} + xR) * ${t.inWidth} + xC) * ${t.inChannels} + ch`:`wD * ${d} * ${x} +
                      wR * ${x} + wC`};
                }
              }
            }
          }
          setOutput(float(minMaxPosition));
        }
      `;return}let N="max",R=`${e}(${e}(${e}(minMaxValue[0], minMaxValue[1]), minMaxValue[2]), minMaxValue[3])`;e==="avg"&&(R="avgValue / max(count, 1.0)");let A=Math.floor(i/4)*4,_=i%4,P=`
      if (${S}) {
        avgValue += dot(values, ones);
      } else {
        minMaxValue = ${N}(values, minMaxValue);
      }
    `;this.userCode=`
      const ivec3 strides =
        ivec3(${a}, ${l}, ${c});
      const ivec3 pads = ivec3(${g}, ${b}, ${$});
      const float initializationValue = ${E};
      const vec4 ones = vec4(1.0, 1.0, 1.0, 1.0);

      float count = 0.0;

      float getValue(int batch, int xD, int xR, int xC, int ch) {
        if (xC < 0 || xC >= ${t.inWidth}) {
          return initializationValue;
        }
        count += 1.0;
        return getX(batch, xD, xR, xC, ch);
      }

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int ch = coords.u;

        ivec3 xCorner = ivec3(coords.y, coords.z, coords.w) * strides - pads;
        int xDCorner = xCorner.x;
        int xRCorner = xCorner.y;
        int xCCorner = xCorner.z;

        // max/min x(?, ?, ?, d) to get y(yD, yR, yC, ch).
        // ? = to be determined
        vec4 minMaxValue = vec4(${E});
        float avgValue = 0.0;
        count = 0.0;

        for (int wD = 0; wD < ${f};
            wD += ${u}) {
          int xD = xDCorner + wD;

          if (xD < 0 || xD >= ${t.inDepth}) {
            continue;
          }

          for (int wR = 0; wR < ${d};
            wR += ${p}) {
            int xR = xRCorner + wR;

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int wC = 0; wC < ${A}; wC += 4) {
              int xC = xCCorner + wC * ${m};

              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                getValue(batch, xD, xR, xC + ${m}, ch),
                getValue(batch, xD, xR, xC + 2 * ${m}, ch),
                getValue(batch, xD, xR, xC + 3 * ${m}, ch)
              );

              ${P}
            }

            int xC = xCCorner + ${A};
            if (${_===1}) {
              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                initializationValue,
                initializationValue,
                initializationValue
              );

              ${P}
            } else if (${_===2}) {
              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                getValue(batch, xD, xR, xC + ${m}, ch),
                initializationValue,
                initializationValue
              );

              ${P}
            } else if (${_===3}) {
              vec4 values = vec4(
                getValue(batch, xD, xR, xC, ch),
                getValue(batch, xD, xR, xC + ${m}, ch),
                getValue(batch, xD, xR, xC + 2 * ${m}, ch),
                initializationValue
              );

              ${P}
            }
          }
        }
        setOutput(${R});
      }
    `}};function K_(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;or(n,"avgPool");let{filterSize:s,strides:i,pad:a,dimRoundingMode:l}=o,c=1;C.assert(T.eitherStridesOrDilationsAreOne(i,c),()=>`Error in avgPool: Either strides or dilations must be 1. Got strides ${i} and dilations '${c}'`);let u=T.computePool2DInfo(n.shape,s,i,c,a,l);if(u.filterWidth===1&&u.filterHeight===1&&C.arraysEqual(u.inShape,u.outShape))return wt({inputs:{x:n},backend:e});let p=new Oe(u,"avg",!1);return e.runWebGLProgram(p,[n],"float32")}var xC={kernelName:vs,backendName:"webgl",kernelFunc:K_};function H_(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{filterSize:s,strides:i,pad:a,dimRoundingMode:l,dataFormat:c}=o,u=[1,1,1],p=T.computePool3DInfo(n.shape,s,i,u,a,l,c),m=new Qr(p,"avg",!1);return e.runWebGLProgram(m,[n],"float32")}var bC={kernelName:$s,backendName:"webgl",kernelFunc:H_};var lu=class{constructor(t){this.variableNames=["dy"],this.outputShape=t.inShape;let e=t.filterHeight,o=t.filterWidth,n=t.strideHeight,s=t.strideWidth,i=t.dilationHeight,a=t.dilationWidth,l=t.effectiveFilterHeight,c=t.effectiveFilterWidth,u=l-1-t.padInfo.top,p=c-1-t.padInfo.left,m=1/(e*o);this.userCode=`
      const ivec2 pads = ivec2(${u}, ${p});
      const float avgMultiplier = float(${m});

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];

        ivec2 dyRCCorner = coords.yz - pads;
        int dyRCorner = dyRCCorner.x;
        int dyCCorner = dyRCCorner.y;

        // Convolve dy(?, ?, d) with pos mask(:, :, d) to get dx(xR, xC, d).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${l};
            wR += ${i}) {
          float dyR = float(dyRCorner + wR) / ${n}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          for (int wC = 0; wC < ${c};
            wC+= ${a}) {
            float dyC = float(dyCCorner + wC) / ${s}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            float dyValue = getDy(b, idyR, idyC, d);

            dotProd += dyValue * avgMultiplier;
          }
        }
        setOutput(dotProd);
      }
    `}},cu=class{constructor(t){this.variableNames=["dy"],this.outputShape=t.inShape;let e=t.filterDepth,o=t.filterHeight,n=t.filterWidth,s=t.strideDepth,i=t.strideHeight,a=t.strideWidth,l=t.dilationDepth,c=t.dilationHeight,u=t.dilationWidth,p=t.effectiveFilterDepth,m=t.effectiveFilterHeight,f=t.effectiveFilterWidth,d=p-1-t.padInfo.front,x=m-1-t.padInfo.top,g=f-1-t.padInfo.left,b=1/(e*o*n);this.userCode=`
      const ivec3 pads = ivec3(${d}, ${x}, ${g});
      const float avgMultiplier = float(${b});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int ch = coords.u;

        ivec3 dyCorner = ivec3(coords.y, coords.z, coords.w) - pads;
        int dyDCorner = dyCorner.x;
        int dyRCorner = dyCorner.y;
        int dyCCorner = dyCorner.z;

        // Convolve dy(?, ?, ?, d) with pos mask(:, :, :, ch) to get
        // dx(xD, xR, xC, ch).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;

        for (int wD = 0; wD < ${p};
            wD += ${l}) {
          float dyD = float(dyDCorner + wD) / ${s}.0;

          if (dyD < 0.0 || dyD >= ${t.outDepth}.0 || fract(dyD) > 0.0) {
            continue;
          }
          int idyD = int(dyD);

          for (int wR = 0; wR < ${m};
              wR += ${c}) {
            float dyR = float(dyRCorner + wR) / ${i}.0;

            if (dyR < 0.0 || dyR >= ${t.outHeight}.0 ||
                fract(dyR) > 0.0) {
              continue;
            }
            int idyR = int(dyR);

            for (int wC = 0; wC < ${f};
                wC += ${u}) {
              float dyC = float(dyCCorner + wC) / ${a}.0;

              if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                  fract(dyC) > 0.0) {
                continue;
              }
              int idyC = int(dyC);

              float dyValue = getDy(batch, idyD, idyR, idyC, ch);

              dotProd += dyValue * avgMultiplier;
            }
          }
        }
        setOutput(dotProd);
      }
    `}};function q_(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,i=s,{filterSize:a,strides:l,pad:c,dimRoundingMode:u}=o,p=[1,1,1],m=T.computePool3DInfo(i.shape,a,l,p,c,u),f=new cu(m);return e.runWebGLProgram(f,[n],i.dtype)}var yC={kernelName:_p,backendName:"webgl",kernelFunc:q_};function X_(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,i=s;or([n,s],"avgPoolGrad");let{filterSize:a,strides:l,pad:c}=o,u=T.computePool2DInfo(i.shape,a,l,1,c),p=new lu(u);return e.runWebGLProgram(p,[n],i.dtype)}var wC={kernelName:Ap,backendName:"webgl",kernelFunc:X_};function j_(r){let{inputs:t,backend:e,attrs:o}=r,{a:n,b:s}=t,{transposeA:i,transposeB:a}=o;return tn({a:n,b:s,transposeA:i,transposeB:a,backend:e})}var CC={kernelName:Ss,backendName:"webgl",kernelFunc:j_};var uu=class{constructor(t,e,o,n,s,i){this.outputShape=[],this.variableNames=["x","mean","variance"],T.assertAndGetBroadcastShape(t,e),T.assertAndGetBroadcastShape(t,o);let a="0.0";n!=null&&(T.assertAndGetBroadcastShape(t,n),this.variableNames.push("offset"),a="getOffsetAtOutCoords()");let l="1.0";s!=null&&(T.assertAndGetBroadcastShape(t,s),this.variableNames.push("scale"),l="getScaleAtOutCoords()"),this.outputShape=t,this.userCode=`
      void main() {
        float x = getXAtOutCoords();
        float mean = getMeanAtOutCoords();
        float variance = getVarianceAtOutCoords();
        float offset = ${a};
        float scale = ${l};
        float inv = scale * inversesqrt(variance + float(${i}));
        setOutput(dot(vec3(x, -mean, offset), vec3(inv, inv, 1)));
      }
    `}};var pu=class{constructor(t,e,o,n,s,i){this.packedInputs=!0,this.packedOutput=!0,this.variableNames=["x","mean","variance"],T.assertAndGetBroadcastShape(t,e),T.assertAndGetBroadcastShape(t,o);let a="vec4(0.0)";n!=null&&(T.assertAndGetBroadcastShape(t,n),this.variableNames.push("offset"),a="getOffsetAtOutCoords()");let l="vec4(1.0)";s!=null&&(T.assertAndGetBroadcastShape(t,s),this.variableNames.push("scale"),l="getScaleAtOutCoords()"),this.outputShape=t,this.userCode=`
      void main() {
        vec4 offset = ${a};
        vec4 scale = ${l};

        vec4 x = getXAtOutCoords();
        vec4 mean = getMeanAtOutCoords();
        vec4 variance = getVarianceAtOutCoords();

        vec4 inv = scale * inversesqrt(variance + vec4(${i}));

        setOutput((x - mean) * inv + offset);
      }
    `}};var Y_=({inputs:r,backend:t,attrs:e})=>{let{x:o,mean:n,variance:s,offset:i,scale:a}=r;C.assert(n.shape.length===s.shape.length,()=>"Batch normalization gradient requires mean and variance to have equal ranks."),C.assert(i==null||n.shape.length===i.shape.length,()=>"Batch normalization gradient requires mean and offset to have equal ranks."),C.assert(a==null||n.shape.length===a.shape.length,()=>"Batch normalization gradient requires mean and scale to have equal ranks.");let{varianceEpsilon:l}=e;l==null&&(l=.001);let c=[o,n,s],u=null;i!=null&&(u=i.shape,c.push(i));let p=null;a!=null&&(p=a.shape,c.push(a));let m=I().getBool("WEBGL_PACK_NORMALIZATION")?new pu(o.shape,n.shape,s.shape,u,p,l):new uu(o.shape,n.shape,s.shape,u,p,l);return t.runWebGLProgram(m,c,c[0].dtype)},vC={kernelName:Qs,backendName:"webgl",kernelFunc:Y_};var mu=class{constructor(t){this.variableNames=["source"],this.outputShape=t,this.rank=t.length;let e=K(this.rank);this.customUniforms=[{name:"start",arrayIndex:this.rank,type:"int"}];let o=Z_(this.rank),n,s=t.map((i,a)=>`sourceLoc.${qf[a]} = start[${a}] + coords.${qf[a]};`);n=`
        ${e} sourceLoc;
        ${e} coords = getOutputCoords();
        ${s.join(`
`)}
      `,this.userCode=`
      void main() {
        ${n}
        setOutput(getSource(${o}));
      }
    `}},qf=["x","y","z","w","u","v"];function Z_(r){if(r===1)return"sourceLoc";if(r<=6)return qf.slice(0,r).map(t=>"sourceLoc."+t).join(",");throw Error(`Slicing for rank ${r} is not yet supported`)}var fu=class{constructor(t){this.variableNames=["source"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=t,this.rank=t.length,this.customUniforms=[{name:"start",arrayIndex:this.rank,type:"int"}];let e=K(this.rank),o=yt("coords",this.rank),n=yt("sourceLoc",this.rank),s=this.rank===1?"sourceLoc":`vec2(${n.slice(-2).join()})`,i=`getChannel(getSource(${n.join()}), ${s})`,a=`
      result.x = ${i};
      if (++${o[this.rank-1]} < ${t[this.rank-1]}) {
        ++${n[this.rank-1]};
        result.y = ${i};
        --${n[this.rank-1]};
      }
    `,l=this.rank===1?"":`
      --${o[this.rank-1]};
      if (++${o[this.rank-2]} < ${t[this.rank-2]}) {
        ++${n[this.rank-2]};
        result.z = ${i};
        if (++${o[this.rank-1]} < ${t[this.rank-1]}) {
          ++${n[this.rank-1]};
          result.w = ${i};
        }
      }
    `,c=this.rank<=4?`sourceLoc = coords +
            ${e}(${t.map((u,p)=>`start[${p}]`).join()});`:t.map((u,p)=>`${n[p]} = ${o[p]} + start[${p}];`).join(`
`);this.userCode=`
      void main() {
        ${e} coords = getOutputCoords();
        ${e} sourceLoc;
        ${c}
        vec4 result = vec4(0.);
        ${a}
        ${l}
        setOutput(result);
      }
    `}};function Q_(r,t,e,o){let n=o.texData.get(r.dataId),s=o.makeTensorInfo(e,r.dtype),i=o.texData.get(s.dataId);Object.assign(i,n),i.refCount=1,i.shape=e,i.dtype=r.dtype;let a=Zt.computeFlatOffset(t,C.computeStrides(r.shape));n.slice&&(a+=n.slice.flatOffset),i.slice={flatOffset:a,origDataId:n.slice&&n.slice.origDataId||r.dataId};let l=o.dataRefCount.get(i.slice.origDataId)||1;return o.dataRefCount.set(i.slice.origDataId,l+1),s}function Me(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{begin:s,size:i}=o,[a,l]=Zt.parseSliceParams(n,s,i);if(Zt.assertParamsValid(n,a,l),C.sizeFromShape(l)===0)return e.makeTensorInfo(l,n.dtype,[]);if(e.shouldExecuteOnCPU([n])||n.dtype==="string"){let p=e.texData.get(n.dataId),m=fw(p.values,a,l,n.shape,n.dtype);return e.makeTensorInfo(l,n.dtype,m)}let{isPacked:c}=e.texData.get(n.dataId),u=Zt.isSliceContinous(n.shape,a,l);if(c||!u){let p=I().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new fu(l):new mu(l),m=[a];return e.runWebGLProgram(p,[n],n.dtype,m)}return e.uploadToGPU(n.dataId),Q_(n,a,l,e)}var $C={kernelName:bn,backendName:"webgl",kernelFunc:Me};var J_=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockShape:s,crops:i}=o;C.assert(n.shape.length<=4,()=>"batchToSpaceND for rank > 4 with a WebGL backend not implemented yet");let a=s.reduce(($,S)=>$*S),l=T.getReshaped(n.shape,s,a),c=T.getPermuted(l.length,s.length),u=T.getReshapedPermuted(n.shape,s,a),p=T.getSliceBeginCoords(i,s.length),m=T.getSliceSize(u,i,s.length),f=[],d=D({inputs:{x:n},backend:e,attrs:{shape:l}}),x=mt({inputs:{x:d},backend:e,attrs:{perm:c}}),g=D({inputs:{x},backend:e,attrs:{shape:u}}),b=Me({inputs:{x:g},backend:e,attrs:{begin:p,size:m}});return f.push(d),f.push(x),f.push(g),f.forEach($=>e.disposeIntermediateTensorInfo($)),b},SC={kernelName:Ts,backendName:"webgl",kernelFunc:J_};function tD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,weights:s}=t,{size:i}=o,a=e.readSync(n.dataId),l=e.readSync(s.dataId),c=Hc(a,l,s.dtype,s.shape,i);return e.makeTensorInfo([i],s.dtype,c)}var TC={kernelName:Es,backendName:"webgl",kernelFunc:tD};var eD=`
  int r = int(a.r) & int(b.r);
  int g = int(a.g) & int(b.g);
  int rb = int(a.b) & int(b.b);
  int ra = int(a.a) & int(b.a);
  return vec4(r, g, rb, ra);
`,rD=`
  return float(int(a.r) & int(b.r));
`;function oD(r){let{inputs:t,backend:e}=r,{a:o,b:n}=t,s=I().getBool("WEBGL_PACK_BINARY_OPERATIONS"),i=I().getNumber("WEBGL_VERSION");if(e.shouldExecuteOnCPU([o,n])||i===1){let l=e.texData.get(o.dataId).values,c=e.texData.get(n.dataId).values,[u,p]=My(o.shape,n.shape,l,c,o.dtype),m=e.makeTensorInfo(p,o.dtype),f=e.texData.get(m.dataId);return f.values=u,m}let a;return s?a=new pe(eD,o.shape,n.shape,!1):a=new ne(rD,o.shape,n.shape),e.runWebGLProgram(a,[o,n],o.dtype)}var EC={kernelName:oo,backendName:"webgl",kernelFunc:oD};function nD(r){let{inputs:t,backend:e}=r,{s0:o,s1:n}=t,s=e.readSync(o.dataId),i=e.readSync(n.dataId),a=T.assertAndGetBroadcastShape(Array.from(s),Array.from(i));return e.makeTensorInfo([a.length],"int32",Int32Array.from(a))}var IC={kernelName:Is,backendName:"webgl",kernelFunc:nD};var sD="return float(a != b);",Xf=nt({opSnippet:sD,cpuKernelImpl:nw,dtype:"bool"}),NC={kernelName:xo,backendName:"webgl",kernelFunc:Xf};function yr(r){let{inputs:t,backend:e}=r,{input:o}=t,n=e.texData.get(o.dataId);return wt({inputs:{x:n.complexTensorInfos.real},backend:e})}var kC={kernelName:xn,backendName:"webgl",kernelFunc:yr};var iD="return float(int(x));";function RC(r,t){let e=new Mt(r.shape,iD),o=t.runWebGLProgram(e,[r],"int32");return{dataId:o.dataId,shape:o.shape,dtype:o.dtype}}function jf(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{dtype:s}=o;if(s==="complex64"){if(n.dtype==="complex64")return wt({inputs:{x:n},backend:e});let i=Se(n.shape),a=jf({inputs:{x:n},backend:e,attrs:{dtype:"float32"}}),l=se({inputs:{real:a,imag:i},backend:e});return i.dispose(),e.disposeIntermediateTensorInfo(a),l}if(n.dtype==="complex64"){let i=yr({inputs:{input:n},backend:e}),a=jf({inputs:{x:i},backend:e,attrs:{dtype:s}});return e.disposeIntermediateTensorInfo(i),a}if(!C.hasEncodingLoss(n.dtype,s)){let i=wt({inputs:{x:n},backend:e});return{dataId:i.dataId,shape:i.shape,dtype:s}}if(e.shouldExecuteOnCPU([n])){let i=e.texData.get(n.dataId).values,[a,l,c]=Ly(i,n.shape,n.dtype,s);return e.makeTensorInfo(a,l,c)}if(s==="int32")return RC(n,e);if(s==="bool"){let i=e.makeTensorInfo([],"bool",C.getTypedArrayFromDType("bool",1)),l=Xf({inputs:{a:n,b:i},backend:e});return e.disposeIntermediateTensorInfo(i),l}throw new Error(`Error in Cast: failed to cast ${n.dtype} to ${s}`)}var AC={kernelName:Er,backendName:"webgl",kernelFunc:jf};var _C="return ceil(x);",aD=G({opSnippet:_C,packedOpSnippet:_C,cpuKernelImpl:By}),DC={kernelName:no,backendName:"webgl",kernelFunc:aD};var du=class{constructor(t){this.variableNames=["A"],this.customUniforms=[{name:"minVal",type:"float"},{name:"maxVal",type:"float"}],this.outputShape=t,this.userCode=`

      void main() {
        float value = getAAtOutCoords();
        if (isnan(value)) {
          setOutput(value);
          return;
        }

        setOutput(clamp(value, minVal, maxVal));
      }
    `}};var hu=class{constructor(t){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"minVal",type:"float"},{name:"maxVal",type:"float"}],this.outputShape=t,this.userCode=`
      void main() {
        vec4 value = getAAtOutCoords();

        if (any(isnan(value))) {
          setOutput(value);
          return;
        }

        setOutput(clamp(value, vec4(minVal), vec4(maxVal)));
      }
    `}};function lD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{clipValueMin:s,clipValueMax:i}=o,a;I().getBool("WEBGL_PACK_CLIP")?a=new hu(n.shape):a=new du(n.shape);let l=[[s],[i]];return e.runWebGLProgram(a,[n],n.dtype,l)}var FC={kernelName:Ns,backendName:"webgl",kernelFunc:lD};var gu=class{constructor(t){this.variableNames=["real","imag"],this.outputShape=t,this.userCode=`
      void main() {
        float re = abs(getRealAtOutCoords());
        float im = abs(getImagAtOutCoords());
        float mx = max(re, im);

        // sadly the length function in glsl is not underflow-safe
        // (at least not on Intel GPUs). So the safe solution is
        // to ensure underflow-safety in all cases.
        setOutput(
          mx == 0.0 ? 0.0 : mx * length(vec2(1, min(re, im)/mx))
        );
      }
    `}};function PC(r,t){return{dataId:t.dataId,dtype:t.dtype,shape:r.shape}}function cD(r){let{inputs:t,backend:e}=r,{x:o}=t,n=e.texData.get(o.dataId),s=new gu(o.shape),i=[PC(o,n.complexTensorInfos.real),PC(o,n.complexTensorInfos.imag)];return e.runWebGLProgram(s,i,i[0].dtype)}var OC={kernelName:ks,backendName:"webgl",kernelFunc:cD};var xu=class{constructor(t){this.outputShape=[],this.outputShape=T.computeOutShape(t,1),this.variableNames=t.map((i,a)=>`T${a}`);let e=new Array(t.length-1);e[0]=t[0][1];for(let i=1;i<e.length;i++)e[i]=e[i-1]+t[i][1];let o=[`if (yC < ${e[0]}) setOutput(getT0(yR, yC));`];for(let i=1;i<e.length;i++){let a=e[i-1];o.push(`else if (yC < ${e[i]}) setOutput(getT${i}(yR, yC-${a}));`)}let n=e.length,s=e[e.length-1];o.push(`else setOutput(getT${n}(yR, yC-${s}));`),this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int yR = coords.x;
        int yC = coords.y;

        ${o.join(`
        `)}
      }
    `}};var yu=class{constructor(t,e){this.packedInputs=!0,this.packedOutput=!0,this.outputShape=[],this.outputShape=T.computeOutShape(t,e);let o=this.outputShape,n=o.length,s=K(n),i=yt("coords",n),a=["x","y","z","w","u","v"].slice(0,n);this.variableNames=t.map((x,g)=>`T${g}`);let l=new Array(t.length-1);l[0]=t[0][e];for(let x=1;x<l.length;x++)l[x]=l[x-1]+t[x][e];let c=a[e],u=a.slice(-2),p=a.join(),m=`if (${c} < ${l[0]}) {
        return getChannel(
            getT0(${p}), vec2(${u.join()}));
        }`;for(let x=1;x<l.length;x++){let g=l[x-1];m+=`
        if (${c} < ${l[x]}  && ${c} >= ${l[x-1]}) {
          return getChannel(
            getT${x}(${bu(a,c,g)}),
            vec2(${bu(u,c,g)}));
        }`}let f=l.length,d=l[l.length-1];m+=`
        return getChannel(
          getT${f}(${bu(a,c,d)}),
          vec2(${bu(u,c,d)}));`,this.userCode=`
      float getValue(${a.map(x=>"int "+x)}) {
        ${m}
      }

      void main() {
        ${s} coords = getOutputCoords();
        vec4 result = vec4(getValue(${i}), 0., 0., 0.);

        ${i[n-1]} = ${i[n-1]} + 1;
        if (${i[n-1]} < ${o[n-1]}) {
          result.g = getValue(${i});
        }

        ${i[n-2]} = ${i[n-2]} + 1;
        if (${i[n-2]} < ${o[n-2]}) {
          result.a = getValue(${i});
        }

        ${i[n-1]} = ${i[n-1]} - 1;
        if (${i[n-2]} < ${o[n-2]} &&
            ${i[n-1]} < ${o[n-1]}) {
          result.b = getValue(${i});
        }
        setOutput(result);
      }
    `}};function bu(r,t,e){let o=r.indexOf(t);return r.map((s,i)=>i===o?`${s} - ${e}`:s).join()}function en(r){let{inputs:t,backend:e}=r,{input:o}=t,n=e.texData.get(o.dataId);return wt({inputs:{x:n.complexTensorInfos.imag},backend:e})}var MC={kernelName:ri,backendName:"webgl",kernelFunc:en};function ns(r,t,e){let o=r[0].dtype;if(o==="complex64"){let f=r.map($=>yr({inputs:{input:$},backend:e})),d=r.map($=>en({inputs:{input:$},backend:e})),x=ns(f,t,e),g=ns(d,t,e),b=se({inputs:{real:x,imag:g},backend:e});return f.forEach($=>e.disposeIntermediateTensorInfo($)),d.forEach($=>e.disposeIntermediateTensorInfo($)),e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),b}let n=e.shouldExecuteOnCPU(r);if(o==="string"&&(n=!0),n){let f=r.map(E=>{let R=[-1,C.sizeFromShape(E.shape.slice(t))];return D({inputs:{x:E},backend:e,attrs:{shape:R}})}),d=f.map(E=>({vals:e.readSync(E.dataId),shape:E.shape})),x=T.computeOutShape(f.map(E=>E.shape),1),g=f[0].shape[0]===1,b=Gy(d,x,o,g),$=T.computeOutShape(r.map(E=>E.shape),t),S=e.makeTensorInfo($,o,b);return f.forEach(E=>e.disposeIntermediateTensorInfo(E)),S}let s=r.filter(f=>C.sizeFromShape(f.shape)>0),i=I().getBool("WEBGL_PACK_ARRAY_OPERATIONS")&&s[0].shape.length>1;if(s.length===1){let f=i?new Mt(r[0].shape,nr):new oe(r[0].shape,nr);return e.runWebGLProgram(f,r,o)}let a=I().getNumber("WEBGL_MAX_TEXTURES_IN_SHADER");if(s.length>a){let f=[];for(let x=0;x<s.length;x+=a){let g=s.slice(x,x+a);f.push(ns(g,t,e))}let d=ns(f,t,e);for(let x of f)e.disposeIntermediateTensorInfo(x);return d}if(i){let f=new yu(s.map(d=>d.shape),t);return e.runWebGLProgram(f,s,o)}let{tensors2D:l,outShape:c}=uD(s,t,e),u=new xu(l.map(f=>f.shape)),p=e.runWebGLProgram(u,l,o);l.forEach(f=>e.disposeIntermediateTensorInfo(f));let m=D({inputs:{x:p},attrs:{shape:c},backend:e});return e.disposeIntermediateTensorInfo(p),m}function uD(r,t,e){let o=T.computeOutShape(r.map(s=>s.shape),t);return{tensors2D:r.map(s=>D({inputs:{x:s},attrs:{shape:[-1,C.sizeFromShape(s.shape.slice(t))]},backend:e})),outShape:o}}function Yf(r){let{inputs:t,backend:e,attrs:o}=r,{axis:n}=o,s=C.parseAxisParam(n,t[0].shape)[0],i=t.map(c=>c.shape);T.assertParamsConsistent(i,s);let a=T.computeOutShape(t.map(c=>c.shape),s);if(C.sizeFromShape(a)===0)return e.makeTensorInfo(a,t[0].dtype,[]);let l=t.filter(c=>C.sizeFromShape(c.shape)>0);return l.length===1?wt({inputs:{x:l[0]},backend:e}):ns(l,s,e)}var LC={kernelName:Rs,backendName:"webgl",kernelFunc:Yf};var ss=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.outputShape=t.outShape;let i=t.padInfo.top,a=t.padInfo.left,l=t.strideHeight,c=t.strideWidth,u=t.dilationHeight,p=t.dilationWidth,m=t.filterHeight,f=t.filterWidth,d=Math.floor(t.inChannels/4)*4,x=t.inChannels%4,g=t.dataFormat==="channelsLast",b=g?1:2,$=g?2:3,S=g?3:1,E="",N="";o&&(n?E=`float activation(float a) {
          float b = getPreluActivationWeightsAtOutCoords();
          ${o}
        }`:s?E=`float activation(float a) {
          float b = getLeakyreluAlphaAtOutCoords();
          ${o}
        }`:E=`
          float activation(float x) {
            ${o}
          }
        `,N="result = activation(result);");let R=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
      ${E}

      const ivec2 strides = ivec2(${l}, ${c});
      const ivec2 pads = ivec2(${i}, ${a});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d2 = coords[${S}];

        ivec2 xRCCorner =
            ivec2(coords[${b}], coords[${$}]) * strides - pads;
        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        // Convolve x(?, ?, d1) with w(:, :, d1, d2) to get y(yR, yC, d2).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${m}; wR++) {
          int xR = xRCorner + wR * ${u};

          if (xR < 0 || xR >= ${t.inHeight}) {
            continue;
          }

          for (int wC = 0; wC < ${f}; wC++) {
            int xC = xCCorner + wC * ${p};

            if (xC < 0 || xC >= ${t.inWidth}) {
              continue;
            }

            for (int d1 = 0; d1 < ${d}; d1 += 4) {
              vec4 wValues = vec4(
                getW(wR, wC, d1, d2),
                getW(wR, wC, d1 + 1, d2),
                getW(wR, wC, d1 + 2, d2),
                getW(wR, wC, d1 + 3, d2)
              );

              if (${g}) {
                vec4 xValues = vec4(
                  getX(batch, xR, xC, d1),
                  getX(batch, xR, xC, d1 + 1),
                  getX(batch, xR, xC, d1 + 2),
                  getX(batch, xR, xC, d1 + 3)
                );
                dotProd += dot(xValues, wValues);
              } else {
                vec4 xValues = vec4(
                  getX(batch, d1, xR, xC),
                  getX(batch, d1 + 1, xR, xC),
                  getX(batch, d1 + 2, xR, xC),
                  getX(batch, d1 + 3, xR, xC)
                );
                dotProd += dot(xValues, wValues);
              }
            }

            if (${x===1}) {

              if (${g}) {
                dotProd +=
                    getX(batch, xR, xC, ${d}) *
                    getW(wR, wC, ${d}, d2);
              } else {
                dotProd +=
                    getX(batch, ${d}, xR, xC) *
                    getW(wR, wC, ${d}, d2);
              }

            } else if (${x===2}) {
              vec2 wValues = vec2(
                getW(wR, wC, ${d}, d2),
                getW(wR, wC, ${d} + 1, d2)
              );

              if (${g}) {
                vec2 xValues = vec2(
                  getX(batch, xR, xC, ${d}),
                  getX(batch, xR, xC, ${d} + 1)
                );
                dotProd += dot(xValues, wValues);
              } else {
                vec2 xValues = vec2(
                  getX(batch, ${d}, xR, xC),
                  getX(batch, ${d} + 1, xR, xC)
                );
                dotProd += dot(xValues, wValues);
              }

            } else if (${x===3}) {
              vec3 wValues = vec3(
                getW(wR, wC, ${d}, d2),
                getW(wR, wC, ${d} + 1, d2),
                getW(wR, wC, ${d} + 2, d2)
              );

              if (${g}) {
                vec3 xValues = vec3(
                  getX(batch, xR, xC, ${d}),
                  getX(batch, xR, xC, ${d} + 1),
                  getX(batch, xR, xC, ${d} + 2)
                );
                dotProd += dot(xValues, wValues);
              } else {
                vec3 xValues = vec3(
                  getX(batch, ${d}, xR, xC),
                  getX(batch, ${d} + 1, xR, xC),
                  getX(batch, ${d} + 2, xR, xC)
                );
                dotProd += dot(xValues, wValues);
              }

            }
          }
        }

        float result = dotProd;
        ${R}
        ${N}
        setOutput(result);
      }
    `}},wu=class{constructor(t){this.variableNames=["x","W"],this.outputShape=t.outShape;let e=t.padInfo.front,o=t.padInfo.top,n=t.padInfo.left,s=t.strideDepth,i=t.strideHeight,a=t.strideWidth,l=t.dilationDepth,c=t.dilationHeight,u=t.dilationWidth,p=t.filterDepth,m=t.filterHeight,f=t.filterWidth,d=Math.floor(t.inChannels/4)*4,x=t.inChannels%4;this.userCode=`
      const ivec3 strides = ivec3(${s}, ${i}, ${a});
      const ivec3 pads = ivec3(${e}, ${o}, ${n});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int d2 = coords.u;

        ivec3 xFRCCorner = ivec3(coords.y, coords.z, coords.w) * strides - pads;
        int xFCorner = xFRCCorner.x;
        int xRCorner = xFRCCorner.y;
        int xCCorner = xFRCCorner.z;

        // Convolve x(?, ?, ?, d1) with w(:, :, :, d1, d2) to get
        // y(yF, yR, yC, d2). ? = to be determined. : = across all
        // values in that axis.
        float dotProd = 0.0;
        for (int wF = 0; wF < ${p}; wF++) {
          int xF = xFCorner + wF * ${l};

          if (xF < 0 || xF >= ${t.inDepth}) {
            continue;
          }

          for (int wR = 0; wR < ${m}; wR++) {
            int xR = xRCorner + wR * ${c};

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int wC = 0; wC < ${f}; wC++) {
              int xC = xCCorner + wC * ${u};

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              for (int d1 = 0; d1 < ${d}; d1 += 4) {
                vec4 xValues = vec4(
                  getX(batch, xF, xR, xC, d1),
                  getX(batch, xF, xR, xC, d1 + 1),
                  getX(batch, xF, xR, xC, d1 + 2),
                  getX(batch, xF, xR, xC, d1 + 3)
                );
                vec4 wValues = vec4(
                  getW(wF, wR, wC, d1, d2),
                  getW(wF, wR, wC, d1 + 1, d2),
                  getW(wF, wR, wC, d1 + 2, d2),
                  getW(wF, wR, wC, d1 + 3, d2)
                );

                dotProd += dot(xValues, wValues);
              }

              if (${x===1}) {
                dotProd +=
                  getX(batch, xF, xR, xC, ${d}) *
                  getW(wF, wR, wC, ${d}, d2);
              } else if (${x===2}) {
                vec2 xValues = vec2(
                  getX(batch, xF, xR, xC, ${d}),
                  getX(batch, xF, xR, xC, ${d} + 1)
                );
                vec2 wValues = vec2(
                  getW(wF, wR, wC, ${d}, d2),
                  getW(wF, wR, wC, ${d} + 1, d2)
                );
                dotProd += dot(xValues, wValues);
              } else if (${x===3}) {
                vec3 xValues = vec3(
                  getX(batch, xF, xR, xC, ${d}),
                  getX(batch, xF, xR, xC, ${d} + 1),
                  getX(batch, xF, xR, xC, ${d} + 2)
                );
                vec3 wValues = vec3(
                  getW(wF, wR, wC, ${d}, d2),
                  getW(wF, wR, wC, ${d} + 1, d2),
                  getW(wF, wR, wC, ${d} + 2, d2)
                );
                dotProd += dot(xValues, wValues);
              }
            }
          }
        }
        setOutput(dotProd);
      }
    `}};var is=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"pads",type:"ivec2"},{name:"strides",type:"ivec2"},{name:"dilations",type:"ivec2"},{name:"inDims",type:"ivec2"}],this.outputShape=t.outShape,this.enableShapeUniforms=it(this.outputShape.length);let i=t.padInfo.left,a=t.strideWidth,l=t.dilationWidth,c=t.filterHeight,u=t.filterWidth,p=u,m=`
       int xR; int xC; int xCOffset;
       vec4 wTexel; vec4 previous; vec4 final;`;for(let g=0;g<u;g++)m+=`
           vec4 xTexelC${g*2};
           int xTexelC${g*2}Ready;
           vec4 xTexelC${g*2+1};
           int xTexelC${g*2+1}Ready;
           vec4 xC${g};`;m+=`
     for (int r = 0; r < ${c}; r++) {
      for (int d1 = 0; d1 < ${t.inChannels}; d1 += 2) {
       `;for(let g=0;g<u;g++)m+=`
           xTexelC${g*2} = vec4(0.0);
           xTexelC${g*2}Ready = 0;
           xTexelC${g*2+1} = vec4(0.0);
           xTexelC${g*2+1}Ready = 0;
           xC${g} = vec4(0.0);`;m+=`
         xR = xRCorner + r * dilations[0];
         if (xR >=0 && xR < inDims[0]) {
       `;for(let g=0;g<(p+1)/2;g++){let b=g*2;if(m+=`
           xC = xCCorner + ${b*l};
           `,a===1){if(b<u&&(i%2===1?(m+=`
                 xCOffset = xC + 1;
                 if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${b}Ready == 0) {
                   xTexelC${b} = getX(batch, xR, xCOffset, d1);

                   // Need to manually clear unused channels in case
                   // we're reading from recycled texture.
                   if (xCOffset + 1 >= inDims[1]) {
                     xTexelC${b}.zw = vec2(0.0);
                   }
                   xTexelC${b}Ready = 1;
                 }
               `,l===1&&b>0?m+=`
                 xC${b} = vec4(xTexelC${b-2}.zw, xTexelC${b}.xy);
                 `:m+=`
                   xCOffset = xC + 1 - 2;

                   if (xCOffset >= 0 && xCOffset < inDims[1]) {
                     previous = getX(batch, xR, xCOffset, d1);

                     // Need to manually clear unused channels in case
                     // we're reading from recycled texture.
                     if (xCOffset + 1 >= inDims[1]) {
                       previous.zw = vec2(0.0);
                     }

                     xC${b} = vec4(previous.zw, xTexelC${b}.xy);
                   } else {
                     xC${b} = vec4(0.0, 0.0, xTexelC${b}.xy);
                   }
                   `):m+=`
                 if (xC >= 0 && xC < inDims[1] && xTexelC${b}Ready == 0) {
                   xTexelC${b} = getX(batch, xR, xC, d1);
                   if (xC + 1 >= inDims[1]) {
                     xTexelC${b}.zw = vec2(0.0);
                   }
                   xTexelC${b}Ready = 1;
                 }

                 xC${b} = xTexelC${b};
                 `,b+1<u)){let $=i%2===0?C.nearestLargerEven(l):l;l%2===0&&i%2===1||l%2!==0&&i%2!==1?(m+=`
                   xCOffset = xC + imod(pads[1], 2) + ${$};

                   if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${b+1}Ready == 0) {
                     xTexelC${b+1} = getX(batch, xR, xCOffset, d1);

                     // Need to manually clear unused channels in case
                     // we're reading from recycled texture.
                     if (xCOffset + 1 >= inDims[1]) {
                       xTexelC${b+1}.zw = vec2(0.0);
                     }
                     xTexelC${b+1}Ready = 1;
                   }
                   `,l>1?m+=`
                     xCOffset -= 2;
                     if (xCOffset >= 0 && xCOffset < inDims[1]) {
                      previous = getX(batch, xR, xCOffset, d1);
                      xC${b+1} = vec4(previous.zw, xTexelC${b+1}.xy);
                     } else {
                      xC${b+1} = vec4(0.0, 0.0, xTexelC${b+1}.xy);
                     }
                     `:m+=`
                     xC${b+1} = vec4(xTexelC${b}.zw, xTexelC${b+1}.xy);
                     `):$===1?m+=`
                     xC${b+1} = xTexelC${b};
                     `:m+=`
                     xCOffset = xC + ${$};

                     if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${b+1}Ready == 0) {
                       xTexelC${b+1} = getX(batch, xR, xCOffset, d1);
                       if (xCOffset + 1 >= inDims[1]) {
                         xTexelC${b+1}.zw = vec2(0.0);
                       }
                       xTexelC${b+1}Ready = 1;
                     }

                     xC${b+1} = xTexelC${b+1};
                     `}}else b<u&&(i%2===1?(m+=`
                 xCOffset = xC + 1 - strides[1];
                 if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${b}Ready == 0) {
                   xTexelC${b} = getX(batch, xR, xCOffset, d1);
                   // Need to manually clear unused channels in case
                   // we're reading from recycled texture.
                   if (xCOffset + 1 >= inDims[1]) {
                     xTexelC${b}.zw = vec2(0.0);
                   }
                   xTexelC${b}Ready = 1;
                 }

                 if(xC + 1 >= 0 && xC + 1 < inDims[1] && xTexelC${b+1}Ready == 0) {
                   xTexelC${b+1} = getX(batch, xR, xC + 1, d1);
                   // Need to manually clear unused channels in case
                   // we're reading from recycled texture.
                   if (xC + 2 >= inDims[1]) {
                     xTexelC${b+1}.zw = vec2(0.0);
                   }
                   xTexelC${b+1}Ready = 1;
                 }

                 xC${b} = vec4(xTexelC${b}.zw, xTexelC${b+1}.zw);
               `,b+1<u&&(m+=`
                   final = vec4(0.0);
                   xCOffset = xC + 1 + strides[1];
                   if(xCOffset >= 0 && xCOffset < inDims[1]) {
                     final = getX(batch, xR, xCOffset, d1);
                   }
                   xC${b+1} = vec4(xTexelC${b+1}.xy, final.xy);
                 `)):(m+=`
                 if(xC >= 0 && xC < inDims[1] && xTexelC${b}Ready == 0) {
                   xTexelC${b} = getX(batch, xR, xC, d1);
                   if (xC + 1 >= inDims[1]) {
                     xTexelC${b}.zw = vec2(0.0);
                   }
                   xTexelC${b}Ready = 1;
                 }

                 xCOffset = xC + strides[1];
                 if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${b+1}Ready == 0) {
                   xTexelC${b+1} = getX(batch, xR, xCOffset, d1);
                   if (xCOffset + 1 >= inDims[1]) {
                     xTexelC${b+1}.zw = vec2(0.);
                   }
                   xTexelC${b+1}Ready = 1;
                 }

                 xC${b} = vec4(
                   xTexelC${b}.xy, xTexelC${b+1}.xy);
               `,b+1<u&&(m+=`
                   xC${b+1} = vec4(xTexelC${b}.zw, xTexelC${b+1}.zw);
                 `)));b<u&&(m+=`
             wTexel = getW(r, ${b}, d1, d2);
             dotProd += xC${b}.xxzz * vec4(wTexel.xy, wTexel.xy);
             if(d1 + 1 < ${t.inChannels}) {
               dotProd += xC${b}.yyww * vec4(wTexel.zw, wTexel.zw);
             }
           `,b+1<u&&(m+=`
               wTexel = getW(r, ${b+1}, d1, d2);
               dotProd += xC${b+1}.xxzz * vec4(wTexel.xy, wTexel.xy);
               if(d1 + 1 < ${t.inChannels}) {
                 dotProd += xC${b+1}.yyww * vec4(wTexel.zw, wTexel.zw);
               }
             `))}m+=`
     }
   `,m+=`
     }
   `,m+=`
     }
   `;let f="",d="";o&&(n?f=`vec4 activation(vec4 a) {
           vec4 b = getPreluActivationWeightsAtOutCoords();
           ${o}
         }`:s?f=`vec4 activation(vec4 a) {
           vec4 b = getLeakyreluAlphaAtOutCoords();
           ${o}
         }`:f=`vec4 activation(vec4 x) {
           ${o}
         }`,d="result = activation(result);");let x=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
       ${f}

       void main() {
         ivec4 coords = getOutputCoords();
         int batch = coords.x;
         ivec2 xRCCorner = coords.yz * strides - pads;
         int d2 = coords.w;
         int xRCorner = xRCCorner.x;
         int xCCorner = xRCCorner.y;

         //intialize dotProd with a small epsilon seems to reduce GPU accuracy loss.
         vec4 dotProd = vec4(0.000000000000001);

         ${m}

         vec4 result = dotProd - vec4(0.000000000000001);
         ${x}
         ${d}
         setOutput(result);
       }
     `}};var Cu=class{constructor(t,e){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"inputShape",type:"ivec4"},{name:"pad",type:"ivec2"},{name:"stride",type:"ivec2"},{name:"dilation",type:"ivec2"},{name:"inChannels",type:"int"},{name:"itemsPerBlockRow",type:"int"},{name:"outWidth",type:"int"}],this.outputShape=t,this.enableShapeUniforms=it(this.outputShape.length);let{dataFormat:o}=e,n=ht(),s=o==="channelsLast",i=s?1:2,a=s?2:3,l=this.enableShapeUniforms?"if(blockIndex < outShape[2] && pos < outShape[1]) {":`if(blockIndex < ${t[2]} && pos < ${t[1]}) {`,c="";for(let u=0;u<=1;u++)for(let p=0;p<=1;p++)c+=`
          blockIndex = rc.z + ${p};
          pos = rc.y + ${u};

          ${l}
            offsetY = int(blockIndex / outWidth) * stride[0] - pad[0];
            d0 = offsetY + dilation[0] * (pos / itemsPerBlockRow);

            if(d0 < inputShape[${i}] && d0 >= 0) {
              // Use custom imod instead mod. On Intel GPU, mod may generate
              // unexpected value.
              // https://github.com/tensorflow/tfjs/issues/5447
              offsetX = imod(blockIndex, outWidth) * stride[1] - pad[1];
              d1 = offsetX + dilation[1] * (imod(pos, itemsPerBlockRow) /
                  inChannels);

              if(d1 < inputShape[${a}] && d1 >= 0) {

                ch = imod(pos, inChannels);

                if (${s}) {
                  innerDims = vec2(d1, ch);
                  result[${u*2+p}] = getChannel(
                    getA(rc.x, d0, int(innerDims.x),
                    int(innerDims.y)), innerDims);
                } else {
                  innerDims = vec2(d0, d1);
                  result[${u*2+p}] = getChannel(
                    getA(rc.x, ch, int(innerDims.x),
                    int(innerDims.y)), innerDims);
                }
              }
            }
          }
        `;this.userCode=`
      void main() {
        ivec3 rc = getOutputCoords();

        vec4 result = vec4(0);

        int blockIndex, pos, offsetY, d0, offsetX, d1, ch;
        vec2 innerDims;

        ${c}

        ${n.output} = result;
      }
    `}};function vu(r,t){let e=r.length;return e>=3?t?[...r.slice(0,-3),r[e-3]*r[e-2],r[e-1]]:[...r.slice(0,-3),r[e-3],r[e-2]*r[e-1]]:!t&&e===1&&r[0]>1?[r[0],1]:null}function $u({x:r,filter:t,convInfo:e,backend:o,bias:n=null,preluActivationWeights:s=null,leakyreluAlpha:i=0,activation:a=null}){let l=r.shape,c=o.texData.get(r.dataId),u=e.inChannels,p=l[0]*l[1]*l[2],m=e.outChannels,f=e.dataFormat==="channelsLast",d=!1,x=!1,g,b=[];if(s!=null){let E=vu(s.shape,f);E!=null&&(s=D({inputs:{x:s},backend:o,attrs:{shape:E}}),b.push(s))}if(n!=null){let E=vu(n.shape,f);E!=null&&(n=D({inputs:{x:n},backend:o,attrs:{shape:E}}),b.push(n))}if(!((p===1||m===1)&&u>Hf)&&c.isPacked&&f&&c.texture!=null&&l[2]%2!==0&&C.arraysEqual(c.shape.slice(-3),l.slice(-3))){let E=l[0]*l[1]*(l[2]+1),N={dataId:r.dataId,shape:[1,E,e.inChannels],dtype:r.dtype},R=c.shape;c.shape=c.shape.slice(),c.shape[c.shape.length-2]++,C.assert(jo(c.shape,N.shape),()=>`packed reshape ${c.shape} to ${N.shape} isn't free`);let A=D({inputs:{x:t},backend:o,attrs:{shape:[1,e.inChannels,e.outChannels]}});b.push(A);let _=tn({a:N,b:A,backend:o,transposeA:d,transposeB:x,bias:n,activation:a,preluActivationWeights:s,leakyreluAlpha:i}),P=o.texData.get(_.dataId);C.assert(P.isPacked,()=>"batchMatMul result is expected to be packed"),c.shape=R,P.shape=e.outShape,g=wt({inputs:{x:_},backend:o}),g.shape=e.outShape,b.push(_)}else{let E=e.outHeight*e.outWidth,N=D({inputs:{x:r},backend:o,attrs:{shape:f?[e.batchSize,E,e.inChannels]:[e.batchSize,e.inChannels,E]}}),R=D({inputs:{x:t},backend:o,attrs:{shape:[1,e.inChannels,e.outChannels]}}),A=tn({a:f?N:R,b:f?R:N,transposeA:!f,transposeB:x,backend:o,bias:n,activation:a,preluActivationWeights:s,leakyreluAlpha:i});g=D({inputs:{x:A},backend:o,attrs:{shape:e.outShape}}),b.push(N),b.push(R),b.push(A)}for(let E of b)o.disposeIntermediateTensorInfo(E);return g}function Su({x:r,filter:t,convInfo:e,backend:o,bias:n=null,preluActivationWeights:s=null,leakyreluAlpha:i=0,activation:a=null}){let{filterWidth:l,filterHeight:c,inChannels:u,outWidth:p,outHeight:m,dataFormat:f}=e,d=f==="channelsLast",x=l*c*u,g=m*p,b=[e.batchSize,x,g],$=!0,S=!1,E=[];if(s!=null){let $t=vu(s.shape,d);$t!=null&&(s=D({inputs:{x:s},backend:o,attrs:{shape:$t}}),E.push(s))}if(n!=null){let $t=vu(n.shape,d);$t!=null&&(n=D({inputs:{x:n},backend:o,attrs:{shape:$t}}),E.push(n))}let N=D({inputs:{x:t},backend:o,attrs:{shape:[1,x,C.sizeFromShape(t.shape)/x]}});E.push(N);let R=new Cu(b,e),A=[r.shape,[e.padInfo.top,e.padInfo.left],[e.strideHeight,e.strideWidth],[e.dilationHeight,e.dilationWidth],[e.inChannels],[e.filterWidth*e.inChannels],[e.outWidth]],_=o.runWebGLProgram(R,[r],"float32",A),P=D({inputs:{x:_},backend:o,attrs:{shape:b}});E.push(_),E.push(P);let O=n!=null,B=s!=null,W=a==="leakyrelu",J=a?br(a,!0):null,et=new os(d?P.shape:N.shape,d?N.shape:P.shape,d?[e.batchSize,g,e.outChannels]:[e.batchSize,e.outChannels,g],$,S,O,J,B,W),st=d?[P,N]:[N,P];if(n&&st.push(n),B&&st.push(s),W){let $t=o.makeTensorInfo([],"float32",C.createScalarValue(i,"float32"));st.push($t),E.push($t)}let At=o.runWebGLProgram(et,st,"float32"),It=D({inputs:{x:At},backend:o,attrs:{shape:e.outShape}});E.push(At);for(let $t of E)o.disposeIntermediateTensorInfo($t);return It}function pD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:i,pad:a,dataFormat:l,dilations:c,dimRoundingMode:u}=o,p=T.convertConv2DDataFormat(l),m=T.computeConv2DInfo(n.shape,s.shape,i,c,a,u,!1,p),f;if(m.filterHeight===1&&m.filterWidth===1&&m.dilationHeight===1&&m.dilationWidth===1&&m.strideHeight===1&&m.strideWidth===1&&(m.padInfo.type==="SAME"||m.padInfo.type==="VALID"))f=$u({x:n,filter:s,convInfo:m,backend:e});else if(m.strideWidth<=2&&p==="channelsLast"&&I().getBool("WEBGL_EXP_CONV")){let x=new is(m),g=[[m.padInfo.top,m.padInfo.left],[m.strideHeight,m.strideWidth],[m.dilationHeight,m.dilationWidth],[m.inHeight,m.inWidth]];f=e.runWebGLProgram(x,[n,s],"float32",g)}else if(I().getBool("WEBGL_CONV_IM2COL"))f=Su({x:n,filter:s,convInfo:m,backend:e});else{let x=new ss(m);f=e.runWebGLProgram(x,[n,s],"float32")}let d=D({inputs:{x:f},backend:e,attrs:{shape:m.outShape}});return e.disposeIntermediateTensorInfo(f),d}var BC={kernelName:As,backendName:"webgl",kernelFunc:pD};var Tu=class{constructor(t){this.variableNames=["x","dy"],this.outputShape=t.filterShape;let e=t.strideHeight,o=t.strideWidth,n=t.padInfo.top,s=t.padInfo.left,i=t.dataFormat==="channelsLast";this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int wR = coords.x;
        int wC = coords.y;
        int d1 = coords.z;
        int d2 = coords.w;

        // Convolve x(?, ?, d1) with dy(:, :, d2) to get dw(wR, wC, d1, d2).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;

        for (int b = 0; b < ${t.batchSize}; b++) {
          for (int yR = 0; yR < ${t.outHeight}; yR++) {
            int xR = wR + yR * ${e} - ${n};

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int yC = 0; yC < ${t.outWidth}; yC++) {
              int xC = wC + yC * ${o} - ${s};

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              ${i?`float dyValue = getDy(b, yR, yC, d2);
              float xValue = getX(b, xR, xC, d1);
              dotProd += (xValue * dyValue);`:`float dyValue = getDy(b, d2, yR, yC);
              float xValue = getX(b, d1, xR, xC);
              dotProd += (xValue * dyValue);`}
            }
          }
        }
        setOutput(dotProd);
      }
    `}},Eu=class{constructor(t){this.variableNames=["dy","W"],this.outputShape=t.inShape;let e=t.filterHeight,o=t.filterWidth,n=t.strideHeight,s=t.strideWidth,i=t.dataFormat==="channelsLast",a=e-1-t.padInfo.top,l=o-1-t.padInfo.left,c=i?1:2,u=i?2:3,p=i?3:1;this.userCode=`
      const ivec2 pads = ivec2(${a}, ${l});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d1 = coords[${p}];

        ivec2 dyCorner = ivec2(coords[${c}], coords[${u}]) - pads;
        int dyRCorner = dyCorner.x;
        int dyCCorner = dyCorner.y;

        // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${e}; wR++) {
          float dyR = float(dyRCorner + wR) / ${n}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          int wRPerm = ${e} - 1 - wR;

          for (int wC = 0; wC < ${o}; wC++) {
            float dyC = float(dyCCorner + wC) / ${s}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            int wCPerm = ${o} - 1 - wC;

            for (int d2 = 0; d2 < ${t.outChannels}; d2++) {

              if (${i}) {
                float xValue = getDy(batch, idyR, idyC, d2);
                float wValue = getW(wRPerm, wCPerm, d1, d2);
                dotProd += xValue * wValue;
              } else {
                float xValue = getDy(batch, d2, idyR, idyC);
                float wValue = getW(wRPerm, wCPerm, d1, d2);
                dotProd += xValue * wValue;
              }

            }
          }
        }
        setOutput(dotProd);
      }
    `}},Iu=class{constructor(t){this.variableNames=["x","dy"],this.outputShape=t.filterShape;let e=t.strideDepth,o=t.strideHeight,n=t.strideWidth,s=t.padInfo.front,i=t.padInfo.top,a=t.padInfo.left;this.userCode=`
      void main() {
        ivec5 coords = getOutputCoords();
        int wF = coords.x;
        int wR = coords.y;
        int wC = coords.z;
        int d1 = coords.w;
        int d2 = coords.u;

        float dotProd = 0.0;

        for (int b = 0; b < ${t.batchSize}; b++) {
          for (int yF = 0; yF < ${t.outDepth}; yF++) {
            int xF = wF + yF * ${e} - ${s};

            if (xF < 0 || xF >= ${t.inDepth}) {
              continue;
            }

            for (int yR = 0; yR < ${t.outHeight}; yR++) {
              int xR = wR + yR * ${o} - ${i};

              if (xR < 0 || xR >= ${t.inHeight}) {
                continue;
              }

              for (int yC = 0; yC < ${t.outWidth}; yC++) {
                int xC = wC + yC * ${n} - ${a};

                if (xC < 0 || xC >= ${t.inWidth}) {
                  continue;
                }

                float dyValue = getDy(b, yF, yR, yC, d2);
                float xValue = getX(b, xF, xR, xC, d1);
                dotProd += (xValue * dyValue);
              }
            }
          }
        }
        setOutput(dotProd);
      }
    `}},Nu=class{constructor(t){this.variableNames=["dy","W"],this.outputShape=t.inShape;let e=t.filterDepth,o=t.filterHeight,n=t.filterWidth,s=t.strideDepth,i=t.strideHeight,a=t.strideWidth,l=e-1-t.padInfo.front,c=o-1-t.padInfo.top,u=n-1-t.padInfo.left;this.userCode=`
      const ivec3 pads = ivec3(${l}, ${c}, ${u});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int d1 = coords.u;


        ivec3 dyCorner = ivec3(coords.y, coords.z, coords.w) - pads;
        int dyFCorner = dyCorner.x;
        int dyRCorner = dyCorner.y;
        int dyCCorner = dyCorner.z;

        float dotProd = 0.0;
        for (int wF = 0; wF < ${e}; wF++) {
          float dyF = float(dyFCorner + wF) / ${s}.0;

          if (dyF < 0.0 || dyF >= ${t.outDepth}.0 || fract(dyF) > 0.0) {
            continue;
          }
          int idyF = int(dyF);

          int wFPerm = ${e} - 1 - wF;

          for (int wR = 0; wR < ${o}; wR++) {
            float dyR = float(dyRCorner + wR) / ${i}.0;

            if (dyR < 0.0 || dyR >= ${t.outHeight}.0 ||
              fract(dyR) > 0.0) {
              continue;
            }
            int idyR = int(dyR);

            int wRPerm = ${o} - 1 - wR;

            for (int wC = 0; wC < ${n}; wC++) {
              float dyC = float(dyCCorner + wC) / ${a}.0;

              if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                  fract(dyC) > 0.0) {
                continue;
              }
              int idyC = int(dyC);

              int wCPerm = ${n} - 1 - wC;

              for (int d2 = 0; d2 < ${t.outChannels}; d2++) {
                float xValue = getDy(batch, idyF, idyR, idyC, d2);
                float wValue = getW(wFPerm, wRPerm, wCPerm, d1, d2);
                dotProd += xValue * wValue;
              }
            }
          }
        }
        setOutput(dotProd);
      }
    `}};function mD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:i,pad:a,dataFormat:l,dimRoundingMode:c,filterShape:u}=o,p=T.convertConv2DDataFormat(l),m=T.computeConv2DInfo(n.shape,u,i,1,a,c,!1,p),f=new Tu(m);return e.runWebGLProgram(f,[n,s],"float32")}var GC={kernelName:_s,backendName:"webgl",kernelFunc:mD};var ku=class{constructor(t){this.variableNames=["dy","W"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"strides",type:"vec2"}],this.outputShape=t.inShape,this.enableShapeUniforms=it(this.outputShape.length);let e=t.filterHeight,o=t.filterWidth,n=e-1-t.padInfo.top,s=o-1-t.padInfo.left;this.userCode=`
      const ivec2 pads = ivec2(${n}, ${s});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d1 = coords[3];

        ivec2 dyCorner = ivec2(coords[1], coords[2]) - pads;
        int dyRCorner = dyCorner.x;
        int dyCCorner = dyCorner.y;

        vec4 result = vec4(0.);
        for (int wR = 0; wR < ${e}; wR++) {
          float dyR = float(dyRCorner + wR) / strides[0];
          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);
          int wRPerm = ${e} - 1 - wR;

          for (int wC = 0; wC < ${o}; wC++) {
            int wCPerm = ${o} - 1 - wC;

            float dyC = float(dyCCorner + wC) / strides[1];
            bool idyCVal = (dyC >= 0.0) && (dyC < ${t.outWidth}.0)
              && (fract(dyC) == 0.0);
            int idyC = int(dyC);

            float dyC2 = float(dyCCorner + wC + 1) / strides[1];
            bool idyCVal2 = (dyC2 >= 0.0) && (dyC2 < ${t.outWidth}.0)
              && (fract(dyC2) == 0.0);
            int idyC2 = int(dyC2);

            if (idyCVal && idyCVal2) {
              for (int d2 = 0; d2 < ${t.outChannels}; d2 += 2) {
                vec4 wValue = getW(wRPerm, wCPerm, d1, d2);
                vec4 dySample = getDy(batch, idyR, idyC, d2);
                vec4 dySample2 = (idyC / 2 == idyC2 / 2) ?
                  dySample : getDy(batch, idyR, idyC2, d2);

                vec2 dyValue = mod(float(idyC), 2.) == 0. ?
                  dySample.xy : dySample.zw;
                result.xy += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));

                dyValue = mod(float(idyC2), 2.) == 0. ?
                  dySample2.xy : dySample2.zw;
                result.zw += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));
              }
            } else if (idyCVal) {
              for (int d2 = 0; d2 < ${t.outChannels}; d2 += 2) {
                vec4 wValue = getW(wRPerm, wCPerm, d1, d2);
                vec4 dySample = getDy(batch, idyR, idyC, d2);
                vec2 dyValue = mod(float(idyC), 2.) == 0. ?
                  dySample.xy : dySample.zw;
                result.xy += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));
              }
            } else if (idyCVal2) {
              for (int d2 = 0; d2 < ${t.outChannels}; d2 += 2) {
                vec4 wValue = getW(wRPerm, wCPerm, d1, d2);
                vec4 dySample = getDy(batch, idyR, idyC2, d2);
                vec2 dyValue = mod(float(idyC2), 2.) == 0. ?
                  dySample.xy : dySample.zw;
                result.zw += vec2(dot(dyValue, wValue.xy),
                  dot(dyValue, wValue.zw));
              }
            }
          }
        }
        setOutput(result);
      }
    `}};function fD(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{inputShape:i,strides:a,pad:l,dataFormat:c,dimRoundingMode:u}=o,p=T.convertConv2DDataFormat(c),m=T.computeConv2DInfo(i,s.shape,a,1,l,u,!1,p);if(I().getBool("WEBGL_PACK_CONV2DTRANSPOSE")&&p==="channelsLast"){let f=[[m.strideHeight,m.strideWidth]],d=new ku(m);return e.runWebGLProgram(d,[n,s],"float32",f)}else{let f=new Eu(m);return e.runWebGLProgram(f,[n,s],"float32")}}var UC={kernelName:Ds,backendName:"webgl",kernelFunc:fD};function dD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:i,pad:a,dilations:l}=o,c=T.computeConv3DInfo(n.shape,s.shape,i,l,a),u=new wu(c);return e.runWebGLProgram(u,[n,s],"float32")}var VC={kernelName:Fs,backendName:"webgl",kernelFunc:dD};function hD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:i,pad:a,filterShape:l}=o,c=T.computeConv3DInfo(n.shape,l,i,1,a),u=new Iu(c);return e.runWebGLProgram(u,[n,s],"float32")}var WC={kernelName:Dp,backendName:"webgl",kernelFunc:hD};function gD(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{pad:i,strides:a,inputShape:l}=o,c=T.computeConv3DInfo(l,s.shape,a,1,i),u=new Nu(c);return e.runWebGLProgram(u,[n,s],"float32")}var zC={kernelName:Ps,backendName:"webgl",kernelFunc:gD};var xD=Ie+`
  return cos(x);
`,bD=`
  vec4 result = cos(x);
  bvec4 isNaN = isnan(x);
  ${me}
  return result;
`,yD=G({opSnippet:xD,packedOpSnippet:bD}),KC={kernelName:"Cos",backendName:"webgl",kernelFunc:yD};var wD=`
  float e2x = exp(-x);
  return (e2x + 1.0 / e2x) / 2.0;
`,CD=G({opSnippet:wD}),HC={kernelName:Os,backendName:"webgl",kernelFunc:CD};var Ru=class{constructor(t,e,o,n,s){this.variableNames=["Image","Boxes","BoxInd"],this.outputShape=[];let[i,a,l,c]=t,[u]=e,[p,m]=o;this.outputShape=[u,p,m,c];let f=n==="bilinear"?1:0,[d,x]=[`${a-1}.0`,`${l-1}.0`],[g,b,$]=p>1?[`${(a-1)/(p-1)}`,"(y2-y1) * height_ratio",`y1*${d} + float(y)*(height_scale)`]:["0.0","0.0",`0.5 * (y1+y2) * ${d}`],[S,E,N]=m>1?[`${(l-1)/(m-1)}`,"(x2-x1) * width_ratio",`x1*${x} + float(x)*(width_scale)`]:["0.0","0.0",`0.5 * (x1+x2) * ${x}`];this.userCode=`
      const float height_ratio = float(${g});
      const float width_ratio = float(${S});
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int y = coords[1];
        int x = coords[2];
        int d = coords[3];

        // get box vals
        float y1 = getBoxes(b,0);
        float x1 = getBoxes(b,1);
        float y2 = getBoxes(b,2);
        float x2 = getBoxes(b,3);

        // get image in batch index
        int bInd = round(getBoxInd(b));
        if(bInd < 0 || bInd >= ${i}) {
          return;
        }

        float height_scale = ${b};
        float width_scale = ${E};

        float in_y = ${$};
        if( in_y < 0.0 || in_y > ${d} ) {
          setOutput(float(${s}));
          return;
        }
        float in_x = ${N};
        if( in_x < 0.0 || in_x > ${x} ) {
          setOutput(float(${s}));
          return;
        }

        vec2 sourceFracIndexCR = vec2(in_x,in_y);
        if(${f} == 1) {
          // Compute the four integer indices.
          ivec2 sourceFloorCR = ivec2(sourceFracIndexCR);
          ivec2 sourceCeilCR = ivec2(ceil(sourceFracIndexCR));

          float topLeft = getImage(b, sourceFloorCR.y, sourceFloorCR.x, d);
          float bottomLeft = getImage(b, sourceCeilCR.y, sourceFloorCR.x, d);
          float topRight = getImage(b, sourceFloorCR.y, sourceCeilCR.x, d);
          float bottomRight = getImage(b, sourceCeilCR.y, sourceCeilCR.x, d);

          vec2 fracCR = sourceFracIndexCR - vec2(sourceFloorCR);

          float top = topLeft + (topRight - topLeft) * fracCR.x;
          float bottom = bottomLeft + (bottomRight - bottomLeft) * fracCR.x;
          float newValue = top + (bottom - top) * fracCR.y;
          setOutput(newValue);
        } else {
          // Compute the coordinators of nearest neighbor point.
          ivec2 sourceNearestCR = ivec2(floor(
            sourceFracIndexCR + vec2(0.5,0.5)));
          float newValue = getImage(b, sourceNearestCR.y, sourceNearestCR.x, d);
          setOutput(newValue);
        }
      }
    `}};var vD=r=>{let{inputs:t,backend:e,attrs:o}=r,{image:n,boxes:s,boxInd:i}=t,{cropSize:a,method:l,extrapolationValue:c}=o,u=new Ru(n.shape,s.shape,a,l,c);return e.runWebGLProgram(u,[n,s,i],"float32")},qC={kernelName:Bs,backendName:"webgl",kernelFunc:vD};var rn;(function(r){r.Prod="*",r.Sum="+"})(rn||(rn={}));var ja=class{constructor(t,e,o,n){this.op=t,this.outputShape=e,this.variableNames=["x"],this.customUniforms=[{name:"index",type:"float"}];let s=this.outputShape.length,i=this.op===rn.Prod?"1.0":"0.0",a=o?i:`getX(${XC(s,"coords",this.op)})`,l=this.outputShape[this.outputShape.length-1],c="",u="";o?(c=n?`end != ${l-1}`:"end != 0",u=n?"end + 1":"end - 1"):(c=n?`end + pow2 < ${l}`:"end >= pow2",u=n?"end + pow2":"end - pow2"),this.userCode=`
      void main() {
        ${K(s)} coords = getOutputCoords();
        int end = ${jC(s,"coords",this.op)};
        float val = ${a};
        int pow2 = int(pow(2.0, index));
        if (${c}) {
          int idx = ${u};
          ${jC(s,"coords",this.op)} = idx;
          val ${this.op}= getX(${XC(s,"coords",this.op)});
        }
        setOutput(val);
      }
    `}};function XC(r,t,e){if(r===1)return`${t}`;if(r===2)return`${t}.x, ${t}.y`;if(r===3)return`${t}.x, ${t}.y, ${t}.z`;if(r===4)return`${t}.x, ${t}.y, ${t}.z, ${t}.w`;throw new Error(`Cumulative ${e} for rank ${r} is not yet supported`)}function jC(r,t,e){if(r===1)return`${t}`;if(r===2)return`${t}.y`;if(r===3)return`${t}.z`;if(r===4)return`${t}.w`;throw new Error(`Cumulative ${e} for rank ${r} is not yet supported`)}function Au(r,t,e,o,n,s){let i=t.shape.length,a=T.getAxesPermutation([o],i),l=t;a!=null&&(l=mt({inputs:{x:t},backend:e,attrs:{perm:a}}));let c=T.getInnerMostAxes(1,i)[0];if(c!==i-1)throw new Error(`WebGL cumprod shader expects an inner-most axis=${t.shape.length-1} but got axis=${o}`);let u=l.shape[c],p=wt({inputs:{x:l},backend:e});for(let m=0;m<=Math.ceil(Math.log2(u))-1;m++){let f=new ja(r,l.shape,!1,s),d=[[m]],x=p;p=e.runWebGLProgram(f,[p],p.dtype,d),e.disposeIntermediateTensorInfo(x)}if(n){let m=new ja(r,l.shape,n,s),f=p;p=e.runWebGLProgram(m,[p],p.dtype),e.disposeIntermediateTensorInfo(f)}if(a!=null){let m=T.getUndoAxesPermutation(a),f=mt({inputs:{x:p},backend:e,attrs:{perm:m}});return e.disposeIntermediateTensorInfo(p),e.disposeIntermediateTensorInfo(l),f}return p}function $D(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,exclusive:i,reverse:a}=o;return Au(rn.Prod,n,e,s,i,a)}var YC={kernelName:Ms,backendName:"webgl",kernelFunc:$D};function SD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,exclusive:i,reverse:a}=o;return Au(rn.Sum,n,e,s,i,a)}var ZC={kernelName:Ls,backendName:"webgl",kernelFunc:SD};function TD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,weights:s}=t,{size:i,binaryOutput:a}=o;if(n.shape.length===1){let l=e.readSync(n.dataId),c=e.readSync(s.dataId),u=Hc(l,c,s.dtype,s.shape,i);return e.makeTensorInfo([i],s.dtype,u)}else if(n.shape.length===2){let l=e.bufferSync(n),c=e.bufferSync(s),u=Oy(l,c,i,a);return e.makeTensorInfo(u.shape,s.dtype,u.values)}throw new Error(`Error in denseBincount: input must be at most rank 2, but got rank${n.shape.length}.`)}var QC={kernelName:Gs,backendName:"webgl",kernelFunc:TD};var _u=class{constructor(t,e,o){this.variableNames=["x"],this.outputShape=[],this.outputShape=t,this.blockSize=e,this.dataFormat=o,this.userCode=`
    void main() {
      ivec4 coords = getOutputCoords();
      int b = coords[0];
      int h = ${this.getHeightCoordString()};
      int w = ${this.getWidthCoordString()};
      int d = ${this.getDepthCoordString()};

      int in_h = h / ${e};
      int offset_h = imod(h, ${e});
      int in_w = w / ${e};
      int offset_w = imod(w, ${e});
      int offset_d = (offset_h * ${e} + offset_w) *
        ${this.getOutputDepthSize()};
      int in_d = d + offset_d;

      float result = ${this.getInputSamplingString()};
      setOutput(result);
    }
  `}getHeightCoordString(){return this.dataFormat==="NHWC"?"coords[1]":"coords[2]"}getWidthCoordString(){return this.dataFormat==="NHWC"?"coords[2]":"coords[3]"}getDepthCoordString(){return this.dataFormat==="NHWC"?"coords[3]":"coords[1]"}getOutputDepthSize(){return this.dataFormat==="NHWC"?this.outputShape[3]:this.outputShape[1]}getInputSamplingString(){return this.dataFormat==="NHWC"?"getX(b, in_h, in_w, in_d)":"getX(b, in_d, in_h, in_w)"}};function ED(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockSize:s,dataFormat:i}=o,a=n.shape[0],l=i==="NHWC"?n.shape[1]:n.shape[2],c=i==="NHWC"?n.shape[2]:n.shape[3],u=i==="NHWC"?n.shape[3]:n.shape[1],p=l*s,m=c*s,f=u/(s*s),d=i==="NHWC"?[a,p,m,f]:[a,f,p,m],x=new _u(d,s,i);return e.runWebGLProgram(x,[n],n.dtype)}var JC={kernelName:Us,backendName:"webgl",kernelFunc:ED};var as=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.customUniforms=[{name:"pads",type:"ivec2"},{name:"strides",type:"ivec2"},{name:"dilations",type:"ivec2"},{name:"inDims",type:"ivec2"}],this.outputShape=t.outShape,this.enableShapeUniforms=it(this.outputShape.length);let i=t.filterHeight,a=t.filterWidth,l=t.outChannels/t.inChannels,c="",u="";o&&(n?c=`float activation(float a) {
          float b = getPreluActivationWeightsAtOutCoords();
          ${o}
        }`:s?c=`float activation(float a) {
          float b = getLeakyreluAlphaAtOutCoords();
          ${o}
        }`:c=`
          float activation(float x) {
            ${o}
          }
        `,u="result = activation(result);");let p=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
      ${c}

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords.x;
        ivec2 xRCCorner = coords.yz * strides - pads;
        int d2 = coords.w;
        int d1 = d2 / ${l};
        int q = d2 - d1 * ${l};

        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        // Convolve x(?, ?, d1) with w(:, :, d1, q) to get y(yR, yC, d2).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        // TO DO(dsmilkov): Flatten the two for loops and vec4 the operations.
        for (int wR = 0; wR < ${i}; wR++) {
          int xR = xRCorner + wR * dilations[0];

          if (xR < 0 || xR >= inDims[0]) {
            continue;
          }

          for (int wC = 0; wC < ${a}; wC++) {
            int xC = xCCorner + wC * dilations[1];

            if (xC < 0 || xC >= inDims[1]) {
              continue;
            }

            float xVal = getX(batch, xR, xC, d1);
            float wVal = getW(wR, wC, d1, q);
            dotProd += xVal * wVal;
          }
        }

        float result = dotProd;
        ${p}
        ${u}
        setOutput(result);
      }
    `}};var ls=class{constructor(t,e=!1,o=null,n=!1,s=!1){this.variableNames=["x","W"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"pads",type:"ivec2"},{name:"strides",type:"ivec2"},{name:"dilations",type:"ivec2"},{name:"inDims",type:"ivec2"}],this.outputShape=t.outShape,this.enableShapeUniforms=it(this.outputShape.length);let i=t.outChannels/t.inChannels,a=t.padInfo.left,l=t.strideWidth,c=t.dilationWidth,u=t.filterHeight,p=t.filterWidth,m=p,f=`
      int xR; int xC; int xCOffset;
      vec4 wTexel; vec4 previous; vec4 final;`;for(let b=0;b<p;b++)f+=`
          vec4 xTexelC${b*2};
          int xTexelC${b*2}Ready;
          vec4 xTexelC${b*2+1};
          int xTexelC${b*2+1}Ready;
          vec4 xC${b};`;f+=`
    for (int r = 0; r < ${u}; r++) {
      `;for(let b=0;b<p;b++)f+=`
          xTexelC${b*2} = vec4(0.0);
          xTexelC${b*2}Ready = 0;
          xTexelC${b*2+1} = vec4(0.0);
          xTexelC${b*2+1}Ready = 0;
          xC${b} = vec4(0.0);`;f+=`
        xR = xRCorner + r * dilations[0];
        if (xR >=0 && xR < inDims[0]) {
      `;for(let b=0;b<(m+1)/2;b++){let $=b*2;if(f+=`
          xC = xCCorner + ${$*c};
          `,l===1){if($<p&&(a%2===1?(f+=`
                xCOffset = xC + 1;
                if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${$}Ready == 0) {
                  xTexelC${$} = getX(batch, xR, xCOffset, d1);

                  // Need to manually clear unused channels in case
                  // we're reading from recycled texture.
                  if (xCOffset + 1 >= inDims[1]) {
                    xTexelC${$}.zw = vec2(0.0);
                  }
                  xTexelC${$}Ready = 1;
                }
              `,c===1&&$>0?f+=`
                xC${$} = vec4(xTexelC${$-2}.zw, xTexelC${$}.xy);
                `:f+=`
                  xCOffset = xC + 1 - 2;

                  if (xCOffset >= 0 && xCOffset < inDims[1]) {
                    previous = getX(batch, xR, xCOffset, d1);

                    // Need to manually clear unused channels in case
                    // we're reading from recycled texture.
                    if (xCOffset + 1 >= inDims[1]) {
                      previous.zw = vec2(0.0);
                    }

                    xC${$} = vec4(previous.zw, xTexelC${$}.xy);
                  } else {
                    xC${$} = vec4(0.0, 0.0, xTexelC${$}.xy);
                  }
                  `):f+=`
                if (xC >= 0 && xC < inDims[1] && xTexelC${$}Ready == 0) {
                  xTexelC${$} = getX(batch, xR, xC, d1);
                  if (xC + 1 >= inDims[1]) {
                    xTexelC${$}.zw = vec2(0.0);
                  }
                  xTexelC${$}Ready = 1;
                }

                xC${$} = xTexelC${$};
                `,$+1<p)){let S=a%2===0?C.nearestLargerEven(c):c;c%2===0&&a%2===1||c%2!==0&&a%2!==1?(f+=`
                  xCOffset = xC + imod(pads[1], 2) + ${S};

                  if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${$+1}Ready == 0) {
                    xTexelC${$+1} = getX(batch, xR, xCOffset, d1);

                    // Need to manually clear unused channels in case
                    // we're reading from recycled texture.
                    if (xCOffset + 1 >= inDims[1]) {
                      xTexelC${$+1}.zw = vec2(0.0);
                    }
                    xTexelC${$+1}Ready = 1;
                  }
                  `,c>1?f+=`
                    xCOffset -= 2;
                    if (xCOffset >= 0 && xCOffset < inDims[1]) {
                     previous = getX(batch, xR, xCOffset, d1);
                     xC${$+1} = vec4(previous.zw, xTexelC${$+1}.xy);
                    } else {
                     xC${$+1} = vec4(0.0, 0.0, xTexelC${$+1}.xy);
                    }
                    `:f+=`
                    xC${$+1} = vec4(xTexelC${$}.zw, xTexelC${$+1}.xy);
                    `):S===1?f+=`
                    xC${$+1} = xTexelC${$};
                    `:f+=`
                    xCOffset = xC + ${S};

                    if (xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${$+1}Ready == 0) {
                      xTexelC${$+1} = getX(batch, xR, xCOffset, d1);
                      if (xCOffset + 1 >= inDims[1]) {
                        xTexelC${$+1}.zw = vec2(0.0);
                      }
                      xTexelC${$+1}Ready = 1;
                    }

                    xC${$+1} = xTexelC${$+1};
                    `}}else $<p&&(a%2===1?(f+=`
                xCOffset = xC + 1 - strides[1];
                if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${$}Ready == 0) {
                  xTexelC${$} = getX(batch, xR, xCOffset, d1);
                  // Need to manually clear unused channels in case
                  // we're reading from recycled texture.
                  if (xCOffset + 1 >= inDims[1]) {
                    xTexelC${$}.zw = vec2(0.0);
                  }
                  xTexelC${$}Ready = 1;
                }

                if(xC + 1 >= 0 && xC + 1 < inDims[1] && xTexelC${$+1}Ready == 0) {
                  xTexelC${$+1} = getX(batch, xR, xC + 1, d1);
                  // Need to manually clear unused channels in case
                  // we're reading from recycled texture.
                  if (xC + 2 >= inDims[1]) {
                    xTexelC${$+1}.zw = vec2(0.0);
                  }
                  xTexelC${$+1}Ready = 1;
                }

                xC${$} = vec4(xTexelC${$}.zw, xTexelC${$+1}.zw);
              `,$+1<p&&(f+=`
                  final = vec4(0.0);
                  xCOffset = xC + 1 + strides[1];
                  if(xCOffset >= 0 && xCOffset < inDims[1]) {
                    final = getX(batch, xR, xCOffset, d1);
                  }
                  xC${$+1} = vec4(xTexelC${$+1}.xy, final.xy);
                `)):(f+=`
                if(xC >= 0 && xC < inDims[1] && xTexelC${$}Ready == 0) {
                  xTexelC${$} = getX(batch, xR, xC, d1);
                  if (xC + 1 >= inDims[1]) {
                    xTexelC${$}.zw = vec2(0.0);
                  }
                  xTexelC${$}Ready = 1;
                }

                xCOffset = xC + strides[1];
                if(xCOffset >= 0 && xCOffset < inDims[1] && xTexelC${$+1}Ready == 0) {
                  xTexelC${$+1} = getX(batch, xR, xCOffset, d1);
                  if (xCOffset + 1 >= inDims[1]) {
                    xTexelC${$+1}.zw = vec2(0.);
                  }
                  xTexelC${$+1}Ready = 1;
                }

                xC${$} = vec4(
                  xTexelC${$}.xy, xTexelC${$+1}.xy);
              `,$+1<p&&(f+=`
                  xC${$+1} = vec4(xTexelC${$}.zw, xTexelC${$+1}.zw);
                `)));$<p&&(f+=`
            wTexel = getW(r, ${$}, d1, q);
            dotProd += xC${$} * vec4(wTexel.xz, wTexel.xz);
          `,$+1<p&&(f+=`
              wTexel = getW(r, ${$+1}, d1, q);
              dotProd += xC${$+1} * vec4(wTexel.xz, wTexel.xz);
            `))}f+=`
    }
  `,f+=`
      }
    `;let d="",x="";o&&(n?d=`vec4 activation(vec4 a) {
          vec4 b = getPreluActivationWeightsAtOutCoords();
          ${o}
        }`:s?d=`vec4 activation(vec4 a) {
          vec4 b = getLeakyreluAlphaAtOutCoords();
          ${o}
        }`:d=`vec4 activation(vec4 x) {
          ${o}
        }`,x="result = activation(result);");let g=e?"result += getBiasAtOutCoords();":"";e&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),s&&this.variableNames.push("leakyreluAlpha"),this.userCode=`
      ${d}

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords.x;
        ivec2 xRCCorner = coords.yz * strides - pads;
        int d2 = coords.w;
        int d1 = d2 / ${i};
        int q = d2 - d1 * ${i};
        int xRCorner = xRCCorner.x;
        int xCCorner = xRCCorner.y;

        //intialize dotProd with a small epsilon seems to reduce GPU accuracy loss.
        vec4 dotProd = vec4(0.000000000000001);

        ${f}

        vec4 result = dotProd - vec4(0.000000000000001);
        ${g}
        ${x}
        setOutput(result);
      }
    `}};function ID(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:i,pad:a,dilations:l,dimRoundingMode:c}=o,u=l;u==null&&(u=[1,1]),C.assert(T.eitherStridesOrDilationsAreOne(i,u),()=>`Error in depthwiseConv2d: Either strides or dilations must be 1. Got strides ${i} and dilations '${u}'`);let p=T.computeConv2DInfo(n.shape,s.shape,i,u,a,c,!0),m;I().getBool("WEBGL_PACK_DEPTHWISECONV")&&p.strideWidth<=2&&p.outChannels/p.inChannels===1?m=new ls(p):m=new as(p);let f=[[p.padInfo.top,p.padInfo.left],[p.strideHeight,p.strideWidth],[p.dilationHeight,p.dilationWidth],[p.inHeight,p.inWidth]];return e.runWebGLProgram(m,[n,s],"float32",f)}var tv={kernelName:Vs,backendName:"webgl",kernelFunc:ID};var Du=class{constructor(t){this.variableNames=["x","dy"],this.outputShape=t.filterShape;let e=t.strideHeight,o=t.strideWidth,n=t.padInfo.top,s=t.padInfo.left,i=t.outChannels/t.inChannels;this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int wR = coords.x;
        int wC = coords.y;
        int d1 = coords.z;
        int dm = coords.w;
        int d2 = d1 * ${i} + dm;

        float dotProd = 0.0;

        // TO DO: Vec4 over the batch size
        for (int b = 0; b < ${t.batchSize}; b++) {
          for (int yR = 0; yR < ${t.outHeight}; yR++) {
            int xR = wR + yR * ${e} - ${n};

            if (xR < 0 || xR >= ${t.inHeight}) {
              continue;
            }

            for (int yC = 0; yC < ${t.outWidth}; yC++) {
              int xC = wC + yC * ${o} - ${s};

              if (xC < 0 || xC >= ${t.inWidth}) {
                continue;
              }

              float dyValue = getDy(b, yR, yC, d2);
              float xValue = getX(b, xR, xC, d1);
              dotProd += (xValue * dyValue);
            }
          }
        }
        setOutput(dotProd);
      }
    `}},Fu=class{constructor(t){this.variableNames=["dy","W"],this.outputShape=t.inShape;let e=t.filterHeight,o=t.filterWidth,n=t.strideHeight,s=t.strideWidth,i=e-1-t.padInfo.top,a=o-1-t.padInfo.left,l=t.outChannels/t.inChannels;this.userCode=`
      const ivec2 pads = ivec2(${i}, ${a});

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords[0];
        int d1 = coords[3];
        ivec2 dyCorner = coords.yz - pads;
        int dyRCorner = dyCorner.x;
        int dyCCorner = dyCorner.y;

        float dotProd = 0.0;

        for (int wR = 0; wR < ${e}; wR++) {
          float dyR = float(dyRCorner + wR) / ${n}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          int wRPerm = ${e} - 1 - wR;

          for (int wC = 0; wC < ${o}; wC++) {
            float dyC = float(dyCCorner + wC) / ${s}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            int wCPerm = ${o} - 1 - wC;

            // TO DO: Vec4 over the channelMul
            for (int dm = 0; dm < ${l}; dm++) {
              int d2 = d1 * ${l} + dm;
              float xValue = getDy(batch, idyR, idyC, d2);
              float wValue = getW(wRPerm, wCPerm, d1, dm);
              dotProd += xValue * wValue;
            }
          }
        }
        setOutput(dotProd);
      }
    `}};function ND(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,dy:s}=t,{strides:i,dilations:a,pad:l,dimRoundingMode:c,filterShape:u}=o,p=T.computeConv2DInfo(n.shape,u,i,a,l,c,!0),m=new Du(p);return e.runWebGLProgram(m,[n,s],"float32")}var ev={kernelName:Ws,backendName:"webgl",kernelFunc:ND};function kD(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,filter:s}=t,{strides:i,dilations:a,pad:l,dimRoundingMode:c,inputShape:u}=o,p=T.computeConv2DInfo(u,s.shape,i,a,l,c,!0),m=new Fu(p);return e.runWebGLProgram(m,[n,s],"float32")}var rv={kernelName:zs,backendName:"webgl",kernelFunc:kD};var Pu=class{constructor(t){this.variableNames=["X"],this.outputShape=[t,t],this.userCode=`
      void main() {
          ivec2 coords = getOutputCoords();
          float val = coords[0] == coords[1] ? getX(coords[0]) : 0.0;
          setOutput(val);
      }
    `}};function RD(r){let{inputs:t,backend:e}=r,{x:o}=t,n=[...o.shape,...o.shape],s=C.sizeFromShape(o.shape),i=D({inputs:{x:o},backend:e,attrs:{shape:[s]}}),a=new Pu(s),l=e.runWebGLProgram(a,[i],i.dtype),c=D({inputs:{x:l},backend:e,attrs:{shape:n}});return e.disposeIntermediateTensorInfo(i),e.disposeIntermediateTensorInfo(l),c}var ov={kernelName:Ks,backendName:"webgl",kernelFunc:RD};var Ou=class{constructor(t){this.variableNames=["x","W"],this.outputShape=t.outShape;let{inHeight:e,inWidth:o,padInfo:n,strideHeight:s,strideWidth:i,filterHeight:a,filterWidth:l,dilationHeight:c,dilationWidth:u}=t,{top:p,left:m}=n;this.userCode=`
      const ivec2 strides = ivec2(${s}, ${i});
      const ivec2 pads = ivec2(${p}, ${m});
      const float neg_infinity = -3.4e38;

      void main() {
        ivec4 coords = getOutputCoords();
        int batch = coords.x;
        int d1 = coords.w;
        ivec2 outTopLeftCorner =
            coords.yz * strides - pads;
        int hBeg = outTopLeftCorner.x;
        int wBeg = outTopLeftCorner.y;

        float curVal = neg_infinity;
        for (int h = 0; h < ${a}; h++) {
          int hIn = hBeg + h * ${c};

          if (hIn >= 0 && hIn < ${e}) {
            for (int w = 0; w < ${l}; w++) {
              int wIn = wBeg + w * ${u};

              if (wIn >= 0 && wIn < ${o}) {
                float xVal = getX(batch, hIn, wIn, d1);
                float wVal = getW(h, w, d1);

                float val = xVal + wVal;
                if (val > curVal) {
                  curVal = val;
                }
              }
            }
          }
        }

        float result = curVal;
        setOutput(result);
      }
    `}};function AD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s}=t,{strides:i,pad:a,dilations:l}=o,c=T.computeDilation2DInfo(n.shape,s.shape,i,a,"NHWC",l),u,p=new Ou(c);u=e.runWebGLProgram(p,[n,s],"float32");let m=D({inputs:{x:u},backend:e,attrs:{shape:c.outShape}});return e.disposeIntermediateTensorInfo(u),m}var nv={kernelName:Hs,backendName:"webgl",kernelFunc:AD};function _D(r){let{inputs:t,backend:e,attrs:o}=r,{equation:n}=o,s=t,{allDims:i,summedDims:a,idDims:l}=T.decodeEinsumEquation(n,s.length);T.checkEinsumDimSizes(i.length,l,s);let{path:c,steps:u}=T.getEinsumComputePath(a,l),p=u.length,m=null,f=i.length,d=[];for(let x=0;x<p;++x){for(let g of u[x]){let{permutationIndices:b,expandDims:$}=T.getEinsumPermutation(f,l[g]),S;T.isIdentityPermutation(b)?S=s[g]:(S=mt({inputs:{x:s[g]},backend:e,attrs:{perm:b}}),d.push(S));let E=S.shape.slice();for(let N=0;N<$.length;++N)E.splice($[N],0,1);C.arraysEqual(S.shape,E)||(S=D({inputs:{x:S},backend:e,attrs:{shape:E}}),d.push(S)),m===null?m=S:(m=qa({inputs:{a:S,b:m},backend:e}),d.push(m))}x<p-1&&(c[x]>=0&&(m=Jo({inputs:{x:m},backend:e,attrs:{axis:c[x]-(i.length-f),keepDims:!1}}),d.push(m)),f--)}for(let x of d)x!==m&&e.disposeIntermediateTensorInfo(x);return m}var sv={kernelName:Xs,backendName:"webgl",kernelFunc:_D};var DD="return (x >= 0.0) ? x : (exp(x) - 1.0);",FD=`
  vec4 result;

  result.r = (x.r >= 0.0) ? x.r : (exp(x.r) - 1.0);
  result.g = (x.g >= 0.0) ? x.g : (exp(x.g) - 1.0);
  result.b = (x.b >= 0.0) ? x.b : (exp(x.b) - 1.0);
  result.a = (x.a >= 0.0) ? x.a : (exp(x.a) - 1.0);

  return result;
`,PD=G({opSnippet:DD,packedOpSnippet:FD}),iv={kernelName:"Elu",backendName:"webgl",kernelFunc:PD};var OD="return (b >= 0.0) ? a : a * (b + 1.0);",MD=`
  vec4 bGTEZero = vec4(greaterThanEqual(b, vec4(0.)));
  return (bGTEZero * a) + ((vec4(1.0) - bGTEZero) * (a * (b + vec4(1.0))));
`,LD=r=>{let{inputs:t,backend:e}=r,{dy:o,y:n}=t,s=I().getBool("WEBGL_PACK_BINARY_OPERATIONS")?new pe(MD,o.shape,n.shape):new ne(OD,o.shape,n.shape);return e.runWebGLProgram(s,[o,n],o.dtype)},av={kernelName:Fp,backendName:"webgl",kernelFunc:LD};var BD=`
  return vec4(equal(a, b));
`,GD="return float(a == b);",UD=nt({opSnippet:GD,packedOpSnippet:BD,dtype:"bool",cpuKernelImpl:Uy}),lv={kernelName:so,backendName:"webgl",kernelFunc:UD};var VD=`
  // Error function is calculated approximately with elementary function.
  // See "Handbook of Mathematical Functions with Formulas,
  // Graphs, and Mathematical Tables", Abramowitz and Stegun.
  float p = ${T.ERF_P};
  float a1 = ${T.ERF_A1};
  float a2 = ${T.ERF_A2};
  float a3 = ${T.ERF_A3};
  float a4 = ${T.ERF_A4};
  float a5 = ${T.ERF_A5};

  float sign = sign(x);
  x = abs(x);
  float t = 1.0 / (1.0 + p * x);
  return sign * (1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*exp(-x*x));
`,WD=G({opSnippet:VD}),cv={kernelName:"Erf",backendName:"webgl",kernelFunc:WD};var zD=Ie+`
  return exp(x);
`,KD=`
  vec4 result = exp(x);
  bvec4 isNaN = isnan(x);
  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,Zf=G({opSnippet:zD,packedOpSnippet:KD,cpuKernelImpl:Vy,dtype:"float32"}),uv={kernelName:"Exp",backendName:"webgl",kernelFunc:Zf};function Mu(r){let{inputs:t,attrs:e,backend:o}=r,{dim:n}=e,{input:s}=t,i=s.shape.length,a=s.shape.slice(),l=n;return n<0&&(C.assert(-(i+1)<=n,()=>`Axis must be in the interval [${-(i+1)}, ${i}]`),l=i+n+1),a.splice(l,0,1),D({inputs:{x:s},backend:o,attrs:{shape:a}})}var pv={kernelName:js,backendName:"webgl",kernelFunc:Mu};var mv="return exp(x) - 1.0;",HD=G({opSnippet:mv,packedOpSnippet:mv,cpuKernelImpl:Wy}),fv={kernelName:io,backendName:"webgl",kernelFunc:HD};var Ya=class{constructor(t,e,o){this.variableNames=["real","imag"];let n=e[1];this.outputShape=e;let s=o?`2.0 * ${Math.PI}`:`-2.0 * ${Math.PI}`,i=o?`${n}.0`:"1.0",a;if(t==="real")a="return real * expR - imag * expI;";else if(t==="imag")a="return real * expI + imag * expR;";else throw new Error(`FFT component must be either "real" or "imag", got ${t}.`);this.userCode=`
      const float exponentMultiplier = ${s};

      float unaryOpComplex(float real, float expR, float imag, float expI) {
        ${a}
      }

      float mulMatDFT(int batch, int index) {
        float indexRatio = float(index) / float(${n});
        float exponentMultiplierTimesIndexRatio =
            exponentMultiplier * indexRatio;

        float result = 0.0;

        for (int i = 0; i < ${n}; i++) {
          // x = (-2|2 * PI / N) * index * i;
          float x = exponentMultiplierTimesIndexRatio * float(i);
          float expR = cos(x);
          float expI = sin(x);
          float real = getReal(batch, i);
          float imag = getImag(batch, i);

          result +=
              unaryOpComplex(real, expR, imag, expI) / ${i};
        }

        return result;
      }

      void main() {
        ivec2 coords = getOutputCoords();
        setOutput(mulMatDFT(coords[0], coords[1]));
      }
    `}};function Lu(r,t,e){let o=e.texData.get(r.dataId),n=C.sizeFromShape(r.shape),s=r.shape[r.shape.length-1],i=n/s,a=D({inputs:{x:r},backend:e,attrs:{shape:[i,s]}}),l=a.shape,c=new Ya("real",l,t),u=new Ya("imag",l,t),p=[{dataId:o.complexTensorInfos.real.dataId,dtype:o.complexTensorInfos.real.dtype,shape:l},{dataId:o.complexTensorInfos.imag.dataId,dtype:o.complexTensorInfos.imag.dtype,shape:l}],m=e.runWebGLProgram(c,p,"float32"),f=e.runWebGLProgram(u,p,"float32"),d=se({inputs:{real:m,imag:f},backend:e});e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f);let x=D({inputs:{x:d},backend:e,attrs:{shape:r.shape}});return e.disposeIntermediateTensorInfo(a),e.disposeIntermediateTensorInfo(d),x}function qD(r){let{inputs:t,backend:e}=r,{input:o}=t;return Lu(o,!1,e)}var dv={kernelName:"FFT",backendName:"webgl",kernelFunc:qD};var Bu=class{constructor(t,e){this.outputShape=[],this.customUniforms=[{name:"value",type:"float"}],this.variableNames=["x"],this.outputShape=t,this.userCode=`
      void main() {
        // Input can be obtained from uniform value.
        setOutput(value);
      }
    `}};function wr(r){let{backend:t,attrs:e}=r,{shape:o,value:n}=e,{dtype:s}=e;if(s=s||C.inferDtype(n),s==="string"){let i=C.getArrayFromDType(s,C.sizeFromShape(o));return i.fill(n),t.makeTensorInfo(o,s,i)}else{let i=new Bu(o,n),a=[[n]];return t.runWebGLProgram(i,[],s,a)}}var hv={kernelName:Ys,backendName:"webgl",kernelFunc:wr};var Gu=class{constructor(t){this.variableNames=["Image"],this.outputShape=[];let e=t[2];this.outputShape=t,this.userCode=`
        void main() {
          ivec4 coords = getOutputCoords();
          int x = coords[2];

          int coordX = ${e} - x - 1;
          float outputValue;
          if(coordX >= 0 && coordX < ${e}) {
            outputValue = getImage(coords[0], coords[1], coordX, coords[3]);
          } else {
            outputValue = getImage(coords[0], coords[1], coords[2], coords[3]);
          }
          setOutput(outputValue);
        }
    `}};var gv={kernelName:Zs,backendName:"webgl",kernelFunc:({inputs:r,backend:t})=>{let{image:e}=r,o=t,n=new Gu(e.shape);return o.runWebGLProgram(n,[e],e.dtype)}};var xv="return floor(x);",XD=G({opSnippet:xv,packedOpSnippet:xv,cpuKernelImpl:zy}),bv={kernelName:ao,backendName:"webgl",kernelFunc:XD};var jD=`
  float s = sign(a) * sign(b);
  int ia = round(a);
  int ib = round(b);
  if (ib != 0) {
    // Windows (D3D) wants guaranteed non-zero int division at compile-time.
    return float(idiv(ia, ib, s));
  } else {
    return NAN;
  }
`,YD=`
  ivec4 ia = round(a);
  ivec4 ib = round(b);
  bvec4 cond = notEqual(ib, ivec4(0));
  ivec4 result = ivec4(0);
  vec4 s = sign(a) * sign(b);

  // Windows (D3D) wants guaranteed non-zero int division at compile-time.
  if (cond[0]) {
    result[0] = idiv(ia[0], ib[0], s[0]);
  }
  if (cond[1]) {
    result[1] = idiv(ia[1], ib[1], s[1]);
  }
  if (cond[2]) {
    result[2] = idiv(ia[2], ib[2], s[2]);
  }
  if (cond[3]) {
    result[3] = idiv(ia[3], ib[3], s[3]);
  }
  return vec4(result);
`,ZD=nt({opSnippet:jD,packedOpSnippet:YD,dtype:"int32"}),yv={kernelName:lo,backendName:"webgl",kernelFunc:ZD};var Uu=class{constructor(t){this.variableNames=["A"];let e=ht(),[o,n]=t;this.outputShape=t,this.userCode=`
      void main() {
        ivec3 coords = getOutputCoords();
        int texR = coords[0];
        int texC = coords[1];
        int depth = coords[2];
        vec2 uv = (vec2(texC, texR) + halfCR) / vec2(${n}.0, ${o}.0);

        vec4 values = ${e.texture2D}(A, uv);
        float value;
        if (depth == 0) {
          value = values.r;
        } else if (depth == 1) {
          value = values.g;
        } else if (depth == 2) {
          value = values.b;
        } else if (depth == 3) {
          value = values.a;
        }

        setOutput(floor(value * 255.0 + 0.5));
      }
    `}};var Vu=class{constructor(t){this.variableNames=["A"],this.packedInputs=!1,this.packedOutput=!0;let e=ht(),[o,n]=t;this.outputShape=t,this.userCode=`
      void main() {
        ivec3 coords = getOutputCoords();
        int texR = coords[0];
        int texC = coords[1];
        int depth = coords[2];

        vec4 result = vec4(0.);

        for(int row=0; row<=1; row++) {
          for(int col=0; col<=1; col++) {
            texC = coords[1] + row;
            depth = coords[2] + col;

            vec2 uv = (vec2(texC, texR) + halfCR) /
                       vec2(${n}.0, ${o}.0);
            vec4 values = ${e.texture2D}(A, uv);
            float value;
            if (depth == 0) {
              value = values.r;
            } else if (depth == 1) {
              value = values.g;
            } else if (depth == 2) {
              value = values.b;
            } else if (depth == 3) {
              value = values.a;
            }

            result[row * 2 + col] = floor(value * 255.0 + 0.5);
          }
        }

        ${e.output} = result;
      }
    `}};var wv={kernelName:wn,backendName:"webgl",kernelFunc:QD},cs,Qf=I().getBool("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU");function QD(r){let{inputs:t,backend:e,attrs:o}=r,{pixels:n}=t,{numChannels:s}=o,i=typeof HTMLVideoElement<"u"&&n instanceof HTMLVideoElement,a=typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement,[l,c]=i?[n.videoWidth,n.videoHeight]:[n.width,n.height],u=[c,l],p=[c,l,s];if(a||i){let x=I().getBool("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU");(cs==null||x!==Qf)&&(Qf=x,cs=document.createElement("canvas").getContext("2d",{willReadFrequently:Qf})),cs.canvas.width=l,cs.canvas.height=c,cs.drawImage(n,0,0,l,c),n=cs.canvas}let m=e.makeTensorInfo(u,"int32");e.texData.get(m.dataId).usage=zt.PIXELS,e.gpgpu.uploadPixelDataToTexture(e.getTexture(m.dataId),n);let f=I().getBool("WEBGL_PACK")?new Vu(p):new Uu(p),d=e.runWebGLProgram(f,[m],"int32");return e.disposeData(m.dataId),d}function JD(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s,bias:i,preluActivationWeights:a}=t,{strides:l,pad:c,dataFormat:u,dilations:p,dimRoundingMode:m,activation:f,leakyreluAlpha:d}=o,x=T.convertConv2DDataFormat(u),g=T.computeConv2DInfo(n.shape,s.shape,l,p,c,m,!1,x),b,$=[],S=i!=null,E=a!=null,N=f==="leakyrelu",R=()=>{let _=[n,s],P=(O,B)=>{if(B==="NCHW"&&O.shape.length===1&&O.shape[0]!==1){let W=D({inputs:{x:O},backend:e,attrs:{shape:[O.shape[0],1,1]}});return $.push(W),W}return O};if(S&&_.push(P(i,u)),E&&_.push(P(a,u)),N){let O=e.makeTensorInfo([],"float32",C.createScalarValue(d,"float32"));_.push(O),$.push(O)}return _};if(g.filterHeight===1&&g.filterWidth===1&&g.dilationHeight===1&&g.dilationWidth===1&&g.strideHeight===1&&g.strideWidth===1&&(g.padInfo.type==="SAME"||g.padInfo.type==="VALID"))b=$u({x:n,filter:s,convInfo:g,backend:e,bias:i,activation:f,preluActivationWeights:a,leakyreluAlpha:d});else if(g.strideWidth<=2&&x==="channelsLast"&&I().getBool("WEBGL_EXP_CONV")){let _=f?br(f,!0):null,P=new is(g,S,_,E,N),O=[[g.padInfo.top,g.padInfo.left],[g.strideHeight,g.strideWidth],[g.dilationHeight,g.dilationWidth],[g.inHeight,g.inWidth]],B=R();b=e.runWebGLProgram(P,B,"float32",O)}else if(I().getBool("WEBGL_CONV_IM2COL"))b=Su({x:n,filter:s,convInfo:g,backend:e,bias:i,activation:f,preluActivationWeights:a,leakyreluAlpha:d});else{let _=f?br(f,!1):null,P=new ss(g,S,_,E,N),O=R();b=e.runWebGLProgram(P,O,"float32")}let A=D({inputs:{x:b},backend:e,attrs:{shape:g.outShape}});return $.push(b),$.forEach(_=>e.disposeIntermediateTensorInfo(_)),A}var Cv={kernelName:vn,backendName:"webgl",kernelFunc:JD};function tF(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,filter:s,bias:i,preluActivationWeights:a}=t,{strides:l,pad:c,dilations:u,dimRoundingMode:p,activation:m,leakyreluAlpha:f}=o,d=[],x=u;x==null&&(x=[1,1]),C.assert(T.eitherStridesOrDilationsAreOne(l,x),()=>`Error in depthwiseConv2d: Either strides or dilations must be 1. Got strides ${l} and dilations '${x}'`);let g=T.computeConv2DInfo(n.shape,s.shape,l,x,c,p,!0),b=I().getBool("WEBGL_PACK_DEPTHWISECONV")&&g.strideWidth<=2&&g.outChannels/g.inChannels===1,$=m?br(m,b):null,S=[n,s],E=i!=null,N=a!=null,R=m==="leakyrelu";if(E&&S.push(i),N&&S.push(a),R){let O=e.makeTensorInfo([],"float32",C.createScalarValue(f,"float32"));S.push(O),d.push(O)}let A;b?A=new ls(g,E,$,N,R):A=new as(g,E,$,N,R);let _=[[g.padInfo.top,g.padInfo.left],[g.strideHeight,g.strideWidth],[g.dilationHeight,g.dilationWidth],[g.inHeight,g.inWidth]],P=e.runWebGLProgram(A,S,"float32",_);return d.forEach(O=>e.disposeIntermediateTensorInfo(O)),P}var vv={kernelName:$n,backendName:"webgl",kernelFunc:tF};var Wu=class{constructor(t,e,o,n){this.sliceDim=t,this.strides=e,this.paramsShape=n,this.variableNames=["x","indices"],this.outputShape=o;let s=K(o.length),i=`
    int index;`;for(let a=0;a<this.sliceDim;a++)i+=`
          index = round(getIndices(coords[0], ${a}));
          out_of_bounds = out_of_bounds || index < 0;
          out_of_bounds = out_of_bounds || index >= ${this.paramsShape[a]};
          flattenIndex += index * ${this.strides[a]};`;this.userCode=`
         void main() {
          ${s} coords = getOutputCoords();
          int flattenIndex = 0;
          bool out_of_bounds = false;

          ${i}

          setOutput(out_of_bounds ? 0.0 : getX(flattenIndex, coords[1]));
        }
      `}};function eF(r){let{inputs:t,backend:e}=r,{params:o,indices:n}=t,s=n.shape,i=s[s.length-1],a=C.sizeFromShape(o.shape),[l,c,u,p]=T.prepareAndValidate(o,n),m=D({inputs:{x:n},backend:e,attrs:{shape:[c,i]}}),f=D({inputs:{x:o},backend:e,attrs:{shape:[C.sizeFromShape(o.shape)/u,u]}});if(e.shouldExecuteOnCPU([o,n])||o.dtype==="string"){let b=e.readSync(n.dataId),$=e.bufferSync(o),S=Ky(b,$,o.dtype,c,i,u,p,o.shape,a);return e.makeTensorInfo(l,o.dtype,S.values)}let d=new Wu(i,p,[c,u],o.shape),x=e.runWebGLProgram(d,[f,m],f.dtype),g=D({inputs:{x},backend:e,attrs:{shape:l}});return e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(x),g}var $v={kernelName:ti,backendName:"webgl",kernelFunc:eF};var zu=class{constructor(t,e){this.variableNames=["A","indices"],this.outputShape=e,this.rank=e.length;let o=K(this.rank),n=rF(t,2);this.userCode=`
      void main() {
        ${o} resRC = getOutputCoords();
        int index = int(getIndices(resRC.x, resRC.z));
        float inBounds = (index >= 0) && (index < ${t[2]}) ? 1.0 : 0.0;
        setOutput(inBounds * getA(${n}));
      }
    `}};function rF(r,t){let e=["resRC.x","resRC.y","resRC.z","resRC.w"],o=[];for(let n=0;n<r.length;n++)n===2?o.push("index"):o.push(`${e[n]}`);return o.join()}function Jf(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,indices:s}=t,{axis:i,batchDims:a}=o,l=C.parseAxisParam(i,n.shape)[0];if(I().get("DEBUG")){let $=e.readSync(s.dataId),S=n.shape[l];for(let E=0;E<$.length;++E){let N=$[E];C.assert(N<=S-1&&N>=0,()=>`GatherV2: the index value ${N} is not in [0, ${S-1}]`)}}let c=T.segment_util.collectGatherOpShapeInfo(n,s,l,a),u=C.sizeFromShape(s.shape),p=[],m=D({inputs:{x:n},backend:e,attrs:{shape:[c.batchSize,c.outerSize,c.dimSize,c.sliceSize]}}),f=D({inputs:{x:s},backend:e,attrs:{shape:[c.batchSize,u/c.batchSize]}});p.push(m),p.push(f);let d=[c.batchSize,c.outerSize,u/c.batchSize,c.sliceSize];if(e.shouldExecuteOnCPU([n,s])||n.dtype==="string"){let $=e.bufferSync(f),S=e.bufferSync(m),E=Hy(S,$,d);return p.forEach(N=>e.disposeIntermediateTensorInfo(N)),e.makeTensorInfo(c.outputShape,E.dtype,E.values)}let x=new zu(m.shape,d),g=e.runWebGLProgram(x,[m,f],m.dtype);p.push(g);let b=D({inputs:{x:g},backend:e,attrs:{shape:c.outputShape}});return p.forEach($=>e.disposeIntermediateTensorInfo($)),b}var Sv={kernelName:Js,backendName:"webgl",kernelFunc:Jf};var oF="return float(a > b);",nF=`
  return vec4(greaterThan(a, b));
`,sF=nt({opSnippet:oF,packedOpSnippet:nF,cpuKernelImpl:qy,dtype:"bool"}),Tv={kernelName:co,backendName:"webgl",kernelFunc:sF};var iF="return float(a >= b);",aF=`
  return vec4(greaterThanEqual(a, b));
`,lF=nt({opSnippet:iF,packedOpSnippet:aF,dtype:"bool",cpuKernelImpl:Xy}),Ev={kernelName:uo,backendName:"webgl",kernelFunc:lF};function cF(r){let{inputs:t,backend:e}=r,{input:o}=t;return Lu(o,!0,e)}var Iv={kernelName:ei,backendName:"webgl",kernelFunc:cF};var uF="return float(!isnan(x) && !isinf(x));",pF=G({opSnippet:uF,dtype:"bool"}),Nv={kernelName:oi,backendName:"webgl",kernelFunc:pF};var mF="return float(isinf(x));",fF=G({opSnippet:mF,dtype:"bool"}),kv={kernelName:ni,backendName:"webgl",kernelFunc:fF};var dF="return float(isnan(x));",hF=G({opSnippet:dF,dtype:"bool"}),Rv={kernelName:si,backendName:"webgl",kernelFunc:hF};var gF="return float(a < b);",xF=`
  return vec4(lessThan(a, b));
`,bF=nt({opSnippet:gF,packedOpSnippet:xF,cpuKernelImpl:jy,dtype:"bool"}),Av={kernelName:po,backendName:"webgl",kernelFunc:bF};var yF="return float(a <= b);",wF=`
  return vec4(lessThanEqual(a, b));
`,CF=nt({opSnippet:yF,packedOpSnippet:wF,cpuKernelImpl:Yy,dtype:"bool"}),_v={kernelName:mo,backendName:"webgl",kernelFunc:CF};function vF(r){let{backend:t,attrs:e}=r,{start:o,stop:n,num:s}=e,i=Zy(o,n,s);return t.makeTensorInfo([i.length],"float32",i)}var Dv={kernelName:ai,backendName:"webgl",kernelFunc:vF};var $F=Ie+`
  return x < 0.0 ? 0./0. : log(x);
`,SF=`
  vec4 result = log(x);
  bvec4 isNaN = isnan(x);
  result.r = isNaN.r ? x.r : (x.r < 0.0 ? 0./0. : result.r);
  result.g = isNaN.g ? x.g : (x.g < 0.0 ? 0./0. : result.g);
  result.b = isNaN.b ? x.b : (x.b < 0.0 ? 0./0. : result.b);
  result.a = isNaN.a ? x.a : (x.a < 0.0 ? 0./0. : result.a);
  return result;
`,TF=G({opSnippet:$F,packedOpSnippet:SF,cpuKernelImpl:Qy}),Fv={kernelName:"Log",backendName:"webgl",kernelFunc:TF};var EF=Ie+`
  return log(1.0 + x);
`,IF=G({opSnippet:EF}),Pv={kernelName:li,backendName:"webgl",kernelFunc:IF};var NF="return float(a >= 1.0 && b >= 1.0);",kF=`
  return vec4(
    vec4(greaterThanEqual(a, vec4(1.0))) *
    vec4(greaterThanEqual(b, vec4(1.0))));
`,RF=nt({opSnippet:NF,packedOpSnippet:kF,dtype:"bool"}),Ov={kernelName:ci,backendName:"webgl",kernelFunc:RF};var AF="return float(!(x >= 1.0));",_F=G({opSnippet:AF}),Mv={kernelName:ui,backendName:"webgl",kernelFunc:_F};var DF="return float(a >= 1.0 || b >= 1.0);",FF=`
  return min(
    vec4(greaterThanEqual(a, vec4(1.0))) +
    vec4(greaterThanEqual(b, vec4(1.0))),
    vec4(1.0));
`,PF=nt({opSnippet:DF,packedOpSnippet:FF,dtype:"bool"}),Lv={kernelName:pi,backendName:"webgl",kernelFunc:PF};var Ku=class{constructor(t,e,o,n,s){this.variableNames=["x"],this.outputShape=[];let i=e,a=t[3]-1;this.outputShape=t;let l,c=`float(${o}) + float(${n}) * sum`;s===.5?l=`inversesqrt(${c})`:s===1?l=`1.0/(${c})`:l=`exp(log(${c}) * float(-${s}));`,this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int r = coords[1];
        int c = coords[2];
        int d = coords[3];
        float x = getX(b, r, c, d);
        float sum = 0.0;
        for (int j = -${i}; j <= ${i}; j++) {
          int idx = d + j;
          if (idx >= 0 && idx <=  ${a}) {
            float z = getX(b, r, c, idx);
            sum += z * z;
          }
        }
        float val = x * ${l};
        setOutput(val);
      }
    `}};var Hu=class{constructor(t,e,o,n,s){this.variableNames=["x"],this.outputShape=[],this.packedInputs=!0,this.packedOutput=!0;let i=e,a=t[3]-1;this.outputShape=t;let l,c=`float(${o}) + float(${n}) * sum`;s===.5?l=`inversesqrt(${c})`:s===1?l=`1.0/(${c})`:l=`exp(log(${c}) * float(-${s}));`,this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords.x;
        int r = coords.y;
        int c = coords.z;
        int d = coords.w;

        bool hasNextCol = d < ${this.outputShape[3]};
        bool hasNextRow = c < ${this.outputShape[2]};

        vec4 sum = vec4(0.);
        vec4 xFragAtOutputCoords = getX(b, r, c, d);

        vec4 xAtOutputCoords = vec4(
          getChannel(xFragAtOutputCoords, vec2(c, d)),
          hasNextCol ?
            getChannel(xFragAtOutputCoords, vec2(c, d + 1)) : 0.0,
          hasNextRow ?
            getChannel(xFragAtOutputCoords , vec2(c + 1, d)) : 0.0,
          (hasNextRow && hasNextCol) ?
            getChannel(xFragAtOutputCoords, vec2(c + 1, d + 1)) : 0.0
        );

        int firstChannel = d - ${i};
        vec2 cache = vec2(0.);
        if(firstChannel >= 0){
          vec4 firstChannelFrag = getX(b, r, c, firstChannel);
          cache.x = getChannel(firstChannelFrag, vec2(c, firstChannel));
            if(hasNextRow){
              cache.y = getChannel(firstChannelFrag, vec2(c + 1, firstChannel));
            }
        }

        ivec2 depth = ivec2(d, d + 1);
        for (int j = - ${i}; j <= ${i}; j++) {
          ivec2 idx = depth + j;
          bvec2 aboveLowerBound = greaterThanEqual(idx, ivec2(0));
          bvec2 belowUpperBound = lessThanEqual(idx, ivec2(${a}));

          bool depthInRange = aboveLowerBound.x && belowUpperBound.x;
          bool depthPlusOneInRange = aboveLowerBound.y && belowUpperBound.y;

          if(depthInRange || depthPlusOneInRange){
            vec4 z = vec4(0.);
            vec4 xFragAtCurrentDepth;
            z.xz = cache.xy;
            if(depthPlusOneInRange && hasNextCol){
              xFragAtCurrentDepth = idx.y != d ?
                getX(b, r, c, idx.y) : xFragAtOutputCoords;
              z.y = getChannel(xFragAtCurrentDepth, vec2(c, idx.y));
              if(hasNextRow){
                z.w = getChannel(xFragAtCurrentDepth, vec2(c + 1, idx.y));
              }
            }
            cache.xy = z.yw;
            sum += z * z;
          }
        }
        vec4 result = xAtOutputCoords * ${l};
        setOutput(result);
      }
    `}};var OF=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{depthRadius:s,bias:i,alpha:a,beta:l}=o,c=I().getBool("WEBGL_PACK_NORMALIZATION")?new Hu(n.shape,s,i,a,l):new Ku(n.shape,s,i,a,l);return e.runWebGLProgram(c,[n],n.dtype)},Bv={kernelName:"LRN",backendName:"webgl",kernelFunc:OF};var qu=class{constructor(t,e,o,n,s){this.variableNames=["inputImage","outputImage","dy"],this.outputShape=[],this.outputShape=t,this.depth=t[3],this.depthRadius=e,this.bias=o,this.alpha=n,this.beta=s,this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int r = coords[1];
        int c = coords[2];

        float result = 0.0;
        for (int d = 0; d < ${this.depth}; ++d) {
          int depthBegin = int(max(0.0, float(d - ${e})));
          int depthEnd = int(min(float(${this.depth}),
              float(d + ${e} + 1)));

          const int MIN_DEPTH_BEGIN = 0;
          const int MAX_DEPTH_END = ${this.depth};

          float norm = 0.0;
          for (int k = MIN_DEPTH_BEGIN; k < MAX_DEPTH_END; ++k) {
            if (k < depthBegin){
              continue;
            }
            else if (k >= depthBegin && k < depthEnd) {
              norm += getInputImage(b, r, c, k) * getInputImage(b, r, c, k);
            }
            else {
              break;
            }
          }

          norm = float(${n}) * norm + float(${o});

          for(int k = MIN_DEPTH_BEGIN; k < MAX_DEPTH_END; ++k){
            if (k < depthBegin){
              continue;
            }
            else if (k >= depthBegin && k < depthEnd){
              float dyi = -2.0 * float(${n})
                * float(${s})
                * getInputImage(b, r, c, k) * getOutputImage(b, r, c, d)
                / norm;
              if (k == d) {
                dyi += pow(norm, -1.0 * ${s});
              }
              if (k == coords[3]) {
                dyi *= getDy(b, r, c, d);
                result += dyi;
              }
            }
            else {
              break;
            }
          }
      }
      setOutput(result);
      }
    `}};var MF=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n,y:s,dy:i}=t,{depthRadius:a,bias:l,alpha:c,beta:u}=o,p=new qu(n.shape,a,l,c,u);return e.runWebGLProgram(p,[n,s,i],n.dtype)},Gv={kernelName:Pp,backendName:"webgl",kernelFunc:MF};function Uv(r,t,e,o){let n=C.sizeFromShape(t),i=C.sizeFromShape(r.shape)/n,a=D({inputs:{x:r},attrs:{shape:[i,n]},backend:o}),l=fe(a,r.dtype,"max",o),c=D({inputs:{x:l},attrs:{shape:e},backend:o});return o.disposeIntermediateTensorInfo(a),o.disposeIntermediateTensorInfo(l),c}function td(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{reductionIndices:s,keepDims:i}=o,a=n.shape.length,l=C.parseAxisParam(s,n.shape),c=l,u=T.getAxesPermutation(c,a),p=u!=null,m=e.shouldExecuteOnCPU([n]),f=n;if(p){if(m){let S=e.texData.get(f.dataId).values,E=new Array(a);for(let A=0;A<E.length;A++)E[A]=n.shape[u[A]];let N=Qo(S,n.shape,n.dtype,u,E);f=e.makeTensorInfo(E,n.dtype);let R=e.texData.get(f.dataId);R.values=N}else f=Zr(n,u,e);c=T.getInnerMostAxes(c.length,a)}T.assertAxesAreInnerMostDims("max",c,a);let[d,x]=T.computeOutAndReduceShapes(f.shape,c),g=d;i&&(g=T.expandShapeToKeepDim(d,l));let b;if(m){let S=e.texData.get(f.dataId).values,E=Jy(S,C.sizeFromShape(x),g,n.dtype);b=e.makeTensorInfo(g,n.dtype);let N=e.texData.get(b.dataId);N.values=E}else b=Uv(f,x,g,e);return p&&e.disposeIntermediateTensorInfo(f),b}var Vv={kernelName:"Max",backendName:"webgl",kernelFunc:td};var LF=rs+`
  return max(a, b);
`,BF=`
  vec4 result = vec4(max(a, b));
  bvec4 isNaNA = isnan(a);
  bvec4 isNaNB = isnan(b);
  bvec4 isNaN = bvec4(isNaNA.x || isNaNB.x, isNaNA.y || isNaNB.y, isNaNA.z || isNaNB.z, isNaNA.w || isNaNB.w);
  `+me+`
  return result;
`,GF=nt({opSnippet:LF,packedOpSnippet:BF,cpuKernelImpl:tw}),Wv={kernelName:fo,backendName:"webgl",kernelFunc:GF};function UF(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;or(n,"maxPool");let{filterSize:s,strides:i,pad:a,dimRoundingMode:l}=o,c=1;C.assert(T.eitherStridesOrDilationsAreOne(i,c),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${i} and dilations '${c}'`);let u=T.computePool2DInfo(n.shape,s,i,c,a,l);if(u.filterWidth===1&&u.filterHeight===1&&C.arraysEqual(u.inShape,u.outShape))return wt({inputs:{x:n},backend:e});let p=new Oe(u,"max",!1);return e.runWebGLProgram(p,[n],n.dtype)}var zv={kernelName:mi,backendName:"webgl",kernelFunc:UF};function VF(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{filterSize:s,strides:i,pad:a,dataFormat:l,dimRoundingMode:c}=o,u=[1,1,1],p=T.computePool3DInfo(n.shape,s,i,u,a,c,l),m=new Qr(p,"max",!1);return e.runWebGLProgram(m,[n],n.dtype)}var Kv={kernelName:fi,backendName:"webgl",kernelFunc:VF};var Xu=class{constructor(t){this.variableNames=["dy","maxPos"],this.outputShape=t.inShape;let e=t.strideHeight,o=t.strideWidth,n=t.dilationHeight,s=t.effectiveFilterHeight,i=t.effectiveFilterWidth,a=s-1-t.padInfo.top,l=i-1-t.padInfo.left,c=s*i-1;this.userCode=`
      const ivec2 pads = ivec2(${a}, ${l});

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];

        ivec2 dyRCCorner = coords.yz - pads;
        int dyRCorner = dyRCCorner.x;
        int dyCCorner = dyRCCorner.y;

        // Convolve dy(?, ?, d) with pos mask(:, :, d) to get dx(xR, xC, d).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;
        for (int wR = 0; wR < ${s};
          wR += ${n}) {
          float dyR = float(dyRCorner + wR) / ${e}.0;

          if (dyR < 0.0 || dyR >= ${t.outHeight}.0 || fract(dyR) > 0.0) {
            continue;
          }
          int idyR = int(dyR);

          for (int wC = 0; wC < ${i}; wC++) {
            float dyC = float(dyCCorner + wC) / ${o}.0;

            if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                fract(dyC) > 0.0) {
              continue;
            }
            int idyC = int(dyC);

            float dyValue = getDy(b, idyR, idyC, d);
            int maxPosValue = ${c} - int(getMaxPos(b, idyR, idyC, d));

            // Get the current value, check it against the value from the
            // position matrix.
            int curPosValue = wR * ${i} + wC;
            float mask = float(maxPosValue == curPosValue ? 1.0 : 0.0);

            dotProd += dyValue * mask;
          }
        }
        setOutput(dotProd);
      }
    `}},ju=class{constructor(t){this.variableNames=["dy","maxPos"],this.outputShape=t.inShape;let e=t.strideDepth,o=t.strideHeight,n=t.strideWidth,s=t.dilationDepth,i=t.dilationHeight,a=t.dilationWidth,l=t.effectiveFilterDepth,c=t.effectiveFilterHeight,u=t.effectiveFilterWidth,p=l-1-t.padInfo.front,m=c-1-t.padInfo.top,f=u-1-t.padInfo.left,d=l*c*u-1;this.userCode=`
      const ivec3 pads = ivec3(${p}, ${m}, ${f});

      void main() {
        ivec5 coords = getOutputCoords();
        int batch = coords.x;
        int ch = coords.u;

        ivec3 dyCorner = ivec3(coords.y, coords.z, coords.w) - pads;
        int dyDCorner = dyCorner.x;
        int dyRCorner = dyCorner.y;
        int dyCCorner = dyCorner.z;

        // Convolve dy(?, ?, ?, ch) with pos mask(:, :, :, d) to get
        // dx(xD, xR, xC, ch).
        // ? = to be determined. : = across all values in that axis.
        float dotProd = 0.0;

        for (int wD = 0; wD < ${l};
           wD += ${s}) {
          float dyD = float(dyDCorner + wD) / ${e}.0;

          if (dyD < 0.0 || dyD >= ${t.outDepth}.0 || fract(dyD) > 0.0) {
            continue;
          }
          int idyD = int(dyD);

          for (int wR = 0; wR < ${c};
              wR += ${i}) {
            float dyR = float(dyRCorner + wR) / ${o}.0;

            if (dyR < 0.0 || dyR >= ${t.outHeight}.0 ||
                fract(dyR) > 0.0) {
              continue;
            }
            int idyR = int(dyR);

            for (int wC = 0; wC < ${u};
                wC += ${a}) {
              float dyC = float(dyCCorner + wC) / ${n}.0;

              if (dyC < 0.0 || dyC >= ${t.outWidth}.0 ||
                  fract(dyC) > 0.0) {
                continue;
              }
              int idyC = int(dyC);

              float dyValue = getDy(batch, idyD, idyR, idyC, ch);
              int maxPosValue = ${d} -
                  int(getMaxPos(batch, idyD, idyR, idyC, ch));

              // Get the current value, check it against the value from the
              // position matrix.
              int curPosValue =
                  wD * ${c} * ${u} +
                  wR * ${u} + wC;
              float mask = float(maxPosValue == curPosValue ? 1.0 : 0.0);

              dotProd += dyValue * mask;
            }
          }
        }
        setOutput(dotProd);
      }
    `}};function WF(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s}=t,i=s,{filterSize:a,strides:l,pad:c,dimRoundingMode:u}=o,p=[1,1,1],m=T.computePool3DInfo(i.shape,a,l,p,c,u),f=new Qr(m,"max",!0),d=e.runWebGLProgram(f,[i],i.dtype),x=new ju(m),g=e.runWebGLProgram(x,[n,d],i.dtype);return e.disposeIntermediateTensorInfo(d),g}var Hv={kernelName:Mp,backendName:"webgl",kernelFunc:WF};function zF(r){let{inputs:t,backend:e,attrs:o}=r,{dy:n,input:s,output:i}=t,a=s;or([s,i],"maxPoolGrad");let{filterSize:l,strides:c,pad:u,dimRoundingMode:p}=o,m=T.computePool2DInfo(a.shape,l,c,1,u,p),f=!0,d=new Oe(m,"max",f),x=e.runWebGLProgram(d,[a],a.dtype),g=new Xu(m),b=e.runWebGLProgram(g,[n,x],a.dtype);return e.disposeIntermediateTensorInfo(x),b}var qv={kernelName:Op,backendName:"webgl",kernelFunc:zF};function Xv(r,t,e,o){let n=new Oe(e,"max",!1),s=o.runWebGLProgram(n,[r],"float32");n=new Oe(e,"max",!0,!0,t);let i=o.runWebGLProgram(n,[r],"float32");return[s,i]}var jv={kernelName:di,backendName:"webgl",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{x:o}=r,{filterSize:n,strides:s,pad:i,includeBatchInIndex:a}=t,l=e;C.assert(o.shape.length===4,()=>`Error in maxPool: input must be rank 4 but got rank ${o.shape.length}.`);let c=[1,1];C.assert(T.eitherStridesOrDilationsAreOne(s,c),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${s} and dilations '${c}'`);let u=T.computePool2DInfo(o.shape,n,s,c,i),[p,m]=Xv(o,a,u,l);return[p,m]}};function Yv(r,t,e,o){let n=C.sizeFromShape(t),i=C.sizeFromShape(r.shape)/n,a=D({inputs:{x:r},attrs:{shape:[i,n]},backend:o}),l=fe(a,"float32","mean",o),c=D({inputs:{x:l},attrs:{shape:e},backend:o});return o.disposeIntermediateTensorInfo(a),o.disposeIntermediateTensorInfo(l),c}var Zv={kernelName:hi,backendName:"webgl",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{x:o}=r,{keepDims:n,axis:s}=t,i=e,a=o.shape.length,l=C.parseAxisParam(s,o.shape),c=l,u=T.getAxesPermutation(c,a),p=u!=null,m=i.shouldExecuteOnCPU([o]),f=[],d=o;if(p){if(m){let E=i.texData.get(d.dataId).values,N=new Array(a);for(let _=0;_<N.length;_++)N[_]=o.shape[u[_]];let R=Qo(E,o.shape,o.dtype,u,N);d=i.makeTensorInfo(N,o.dtype);let A=i.texData.get(d.dataId);A.values=R}else d=Zr(o,u,i);f.push(d),c=T.getInnerMostAxes(c.length,a)}T.assertAxesAreInnerMostDims("sum",c,a);let[x,g]=T.computeOutAndReduceShapes(d.shape,c),b=x;n&&(b=T.expandShapeToKeepDim(x,l));let $=Yv(d,g,b,i);for(let S of f)i.disposeIntermediateTensorInfo(S);return $}};function KF(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:i}=o,a=n.shape.length,l=C.parseAxisParam(s,n.shape),c=l,u=T.getAxesPermutation(c,a),p=n;u!=null&&(p=mt({inputs:{x:n},backend:e,attrs:{perm:u}}),c=T.getInnerMostAxes(c.length,n.shape.length)),T.assertAxesAreInnerMostDims("min",c,a);let[m,f]=T.computeOutAndReduceShapes(p.shape,c),d=C.sizeFromShape(f),x=D({inputs:{x:p},backend:e,attrs:{shape:[-1,d]}}),g=fe(x,x.dtype,"min",e),b;if(i){let $=T.expandShapeToKeepDim(m,l);b=D({inputs:{x:g},backend:e,attrs:{shape:$}})}else b=D({inputs:{x:g},backend:e,attrs:{shape:m}});return e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(g),u!=null&&e.disposeIntermediateTensorInfo(p),b}var Qv={kernelName:"Min",backendName:"webgl",kernelFunc:KF};var HF=rs+`
  return min(a, b);
`,qF=`
  vec4 result = vec4(min(a, b));
  bvec4 isNaNA = isnan(a);
  bvec4 isNaNB = isnan(b);
  bvec4 isNaN = bvec4(isNaNA.x || isNaNB.x, isNaNA.y || isNaNB.y, isNaNA.z || isNaNB.z, isNaNA.w || isNaNB.w);
  `+me+`
  return result;
`,XF=nt({opSnippet:HF,packedOpSnippet:qF,cpuKernelImpl:ew}),Jv={kernelName:ho,backendName:"webgl",kernelFunc:XF};var Yu=class{constructor(t,e,o){this.variableNames=["x"],this.outputShape=e.map((u,p)=>u[0]+t[p]+u[1]);let n=t.length,s=K(n),i=e.map(u=>u[0]).join(","),a=e.map((u,p)=>u[0]+t[p]).join(","),l=["coords[0]","coords[1]","coords[2]","coords[3]"].slice(0,n),c=o==="reflect"?0:1;if(n===1){this.userCode=`
        int start = ${i};
        int end = ${a};

        void main() {
          int outC = getOutputCoords();
          if (outC < start) {
            outC = start * 2 - outC - ${c};
          } else if(outC >= end) {
            outC = (end - 1) * 2 - outC + ${c};
          }
          setOutput(getX(outC - start));
        }
      `;return}this.userCode=`
      ${s} start = ${s}(${i});
      ${s} end = ${s}(${a});

      void main() {
        ${s} outC = getOutputCoords();
        for (int i = 0; i < ${n}; i++) {
          if (outC[i] < start[i]) {
            outC[i] = start[i] * 2 - outC[i] - ${c};
          } else if(outC[i] >= end[i]) {
            outC[i] = (end[i] - 1) * 2 - outC[i] + ${c};
          }
        }
        ${s} coords = outC - start;
        setOutput(getX(${l}));
      }
    `}};var Zu=class{constructor(t,e,o){this.variableNames=["x"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=e.map((d,x)=>d[0]+t[x]+d[1]);let n=t.length,s=K(n),i=e.map(d=>d[0]).join(","),a=e.map((d,x)=>d[0]+t[x]).join(","),l=yt("rc",n),c=yt("source",n),u=`${l[n-1]} < ${this.outputShape[n-1]}`,p=n===1?"source":`vec2(${c.slice(-2).join()})`,m=o==="reflect"?0:1,f="";if(n===1){let d=`
        ${s} source = rc;
        if (source < start) {
          source = start * 2 - source - ${m};
        } else if (source >= end) {
          source = (end - 1) * 2 - source + ${m};
        }
        source -= start;
      `;f=`
        ${s} rc = outputLoc;
        ${d}
        result[0] = getChannel(getX(${c.join()}), ${p});
        ${l[n-1]} += 1;
        if(${u}) {
          ${d}
          result[1] = getChannel(getX(${c.join()}), ${p});
        }
      `}else{let d=`
        ${s} source = rc;
        ${s} lt = ${s}(lessThan(source, start));
        ${s} gte = ${s}(greaterThanEqual(source, end));
        ${s} orig = 1 - (lt + gte);
        source = orig * source +
                lt * (start * 2 - source - ${m}) +
                gte * ((end - 1) * 2 - source + ${m});
        source -= start;
      `;f=`
        ${s} rc = outputLoc;
        ${d}
        result[0] = getChannel(getX(${c.join()}), ${p});
        ${l[n-1]} += 1;
        if(${u}) {
          ${d}
          result[1] = getChannel(getX(${c.join()}), ${p});
        }
        rc = outputLoc;
        ${l[n-2]} += 1;
        if(${l[n-2]} < ${this.outputShape[n-2]}) {
          ${d}
          result[2] = getChannel(getX(${c.join()}), ${p});
          ${l[n-1]} += 1;
          if(${u}) {
            ${d}
            result[3] = getChannel(getX(${c.join()}), ${p});
          }
        }
      `}this.userCode=`
      const ${s} start = ${s}(${i});
      const ${s} end = ${s}(${a});

      void main() {
        ${s} outputLoc = getOutputCoords();
        vec4 result = vec4(0.);
        ${f}
        setOutput(result);
      }
    `}};var jF=({inputs:r,backend:t,attrs:e})=>{let{x:o}=r,{paddings:n,mode:s}=e,i=I().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new Zu(o.shape,n,s):new Yu(o.shape,n,s);return t.runWebGLProgram(i,[o],o.dtype)},t1={kernelName:gi,backendName:"webgl",kernelFunc:jF};var YF=`if (b == 0.0) return NAN;
  return mod(a, b);`,ZF=`
  vec4 result = mod(a, b);
  bvec4 isNaN = equal(b, vec4(0.0));
  `+me+`
  return result;
`,QF=nt({opSnippet:YF,packedOpSnippet:ZF}),e1={kernelName:"Mod",backendName:"webgl",kernelFunc:QF};var Qu=class{constructor(t,e,o){this.variableNames=["probs"],this.customUniforms=[{name:"seed",type:"float"}],this.outputShape=[t,o],this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];

        float r = random(seed);
        float cdf = 0.0;

        for (int i = 0; i < ${e-1}; i++) {
          cdf += getProbs(batch, i);

          if (r < cdf) {
            setOutput(float(i));
            return;
          }
        }

        // If no other event happened, last event happened.
        setOutput(float(${e-1}));
      }
    `}};var JF=`
if (a == b) {
  return 1.0;
};
return a / b;`,tP=`
  // vec4 one = vec4(equal(a, b));
  // return one + (vec4(1.0) - one) * a / b;
  vec4 result = a / b;
  if(a.x == b.x) {
    result.x = 1.;
  }
  if(a.y == b.y) {
    result.y = 1.;
  }
  if(a.z == b.z) {
    result.z = 1.;
  }
  if(a.w == b.w) {
    result.w = 1.;
  }

  return result;
`,ed=nt({opSnippet:JF,packedOpSnippet:tP,checkOutOfBounds:!0}),r1={kernelName:qs,backendName:"webgl",kernelFunc:ed};var o1="return a - b;",rd=nt({opSnippet:o1,packedOpSnippet:o1,supportsComplex:!0,cpuKernelImpl:vw}),n1={kernelName:"Sub",backendName:"webgl",kernelFunc:rd};function od(r){let{inputs:t,backend:e,attrs:o}=r,{logits:n}=t,{dim:s}=o,i=C.parseAxisParam([s],n.shape),a=td({inputs:{x:n},backend:e,attrs:{reductionIndices:i,keepDims:!1}}),l=T.expandShapeToKeepDim(a.shape,i),c=D({inputs:{x:a},backend:e,attrs:{shape:l}}),u=rd({inputs:{a:n,b:c},backend:e}),p=Zf({inputs:{x:u},backend:e}),m=Jo({inputs:{x:p},backend:e,attrs:{axis:i,keepDims:!1}}),f=D({inputs:{x:m},backend:e,attrs:{shape:l}}),d=ed({inputs:{a:p,b:f},backend:e});return e.disposeIntermediateTensorInfo(a),e.disposeIntermediateTensorInfo(c),e.disposeIntermediateTensorInfo(u),e.disposeIntermediateTensorInfo(p),e.disposeIntermediateTensorInfo(m),e.disposeIntermediateTensorInfo(f),d}var s1={kernelName:ji,backendName:"webgl",kernelFunc:od};function eP(r){let{inputs:t,backend:e,attrs:o}=r,{logits:n}=t,{numSamples:s,seed:i,normalized:a}=o,l=a?n:od({inputs:{logits:n},backend:e,attrs:{dim:n.shape.length-1}}),c=l.shape[0],u=l.shape[1],p=new Qu(c,u,s),m=[[i]],f=e.runWebGLProgram(p,[l],"int32",m);return a||e.disposeIntermediateTensorInfo(l),f}var i1={kernelName:xi,backendName:"webgl",kernelFunc:eP};var rP=Et+`
  return -x;
`,oP=`
  vec4 result = -x;
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`;function nP(r){let{inputs:t,backend:e}=r,{x:o}=t;if(e.shouldExecuteOnCPU([o])){let s=e.texData.get(o.dataId),[i,a]=ow(s.values,o.shape,o.dtype);return e.makeTensorInfo(a,o.dtype,i)}let n;return I().getBool("WEBGL_PACK_UNARY_OPERATIONS")?n=new oe(o.shape,oP):n=new Mt(o.shape,rP),e.runWebGLProgram(n,[o],o.dtype)}var a1={kernelName:"Neg",backendName:"webgl",kernelFunc:nP};var sP=Fe.nonMaxSuppressionV3Impl;function iP(r){T.warn("tf.nonMaxSuppression() in webgl locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:i,iouThreshold:a,scoreThreshold:l}=o,c=e.readSync(n.dataId),u=e.readSync(s.dataId),{selectedIndices:p}=sP(c,u,i,a,l);return e.makeTensorInfo([p.length],"int32",new Int32Array(p))}var l1={kernelName:yi,backendName:"webgl",kernelFunc:iP};var aP=Fe.nonMaxSuppressionV4Impl;function lP(r){T.warn("tf.nonMaxSuppression() in webgl locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:i,iouThreshold:a,scoreThreshold:l,padToMaxOutputSize:c}=o,u=e.readSync(n.dataId),p=e.readSync(s.dataId),{selectedIndices:m,validOutputs:f}=aP(u,p,i,a,l,c);return[e.makeTensorInfo([m.length],"int32",new Int32Array(m)),e.makeTensorInfo([],"int32",new Int32Array([f]))]}var c1={kernelName:wi,backendName:"webgl",kernelFunc:lP};var cP=Fe.nonMaxSuppressionV5Impl;function uP(r){T.warn("tf.nonMaxSuppression() in webgl locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:e,attrs:o}=r,{boxes:n,scores:s}=t,{maxOutputSize:i,iouThreshold:a,scoreThreshold:l,softNmsSigma:c}=o,u=e.readSync(n.dataId),p=e.readSync(s.dataId),m=i,f=a,d=l,x=c,{selectedIndices:g,selectedScores:b}=cP(u,p,m,f,d,x);return[e.makeTensorInfo([g.length],"int32",new Int32Array(g)),e.makeTensorInfo([b.length],"float32",new Float32Array(b))]}var u1={kernelName:Ci,backendName:"webgl",kernelFunc:uP};var Ju=class{constructor(t,e,o,n){this.variableNames=["indices"],this.outputShape=[t,e],this.userCode=`
      void main() {
        ivec2 coords = getOutputCoords();
        int index = round(getIndices(coords.x));
        setOutput(mix(float(${n}), float(${o}),
                      float(index == coords.y)));
      }
    `}};var pP=r=>{let{inputs:t,backend:e,attrs:o}=r,{indices:n}=t,{dtype:s,depth:i,onValue:a,offValue:l}=o,c=C.sizeFromShape(n.shape),u=new Ju(c,i,a,l),p=D({inputs:{x:n},backend:e,attrs:{shape:[c]}}),m=e.runWebGLProgram(u,[p],s);e.disposeIntermediateTensorInfo(p);let f=[...n.shape,i],d=D({inputs:{x:m},backend:e,attrs:{shape:f}});return e.disposeIntermediateTensorInfo(m),d},p1={kernelName:$i,backendName:"webgl",kernelFunc:pP};function Za(r){let{inputs:t,backend:e}=r,{x:o}=t;if(o.dtype==="complex64"){let n=yr({inputs:{input:o},backend:e}),s=Za({inputs:{x:n},backend:e}),i=en({inputs:{input:o},backend:e}),a=Za({inputs:{x:i},backend:e}),l=se({inputs:{real:s,imag:a},backend:e});return e.disposeIntermediateTensorInfo(n),e.disposeIntermediateTensorInfo(s),e.disposeIntermediateTensorInfo(i),e.disposeIntermediateTensorInfo(a),l}else return wr({attrs:{shape:o.shape,dtype:o.dtype,value:o.dtype==="string"?"":0},backend:e})}var m1={kernelName:pa,backendName:"webgl",kernelFunc:Za};function f1(r){let{inputs:t,backend:e}=r,{x:o}=t;if(o.dtype==="string")throw new Error("onesLike is not supported under string dtype");if(o.dtype==="complex64"){let n=yr({inputs:{input:o},backend:e}),s=f1({inputs:{x:n},backend:e}),i=en({inputs:{input:o},backend:e}),a=Za({inputs:{x:i},backend:e}),l=se({inputs:{real:s,imag:a},backend:e});return e.disposeIntermediateTensorInfo(n),e.disposeIntermediateTensorInfo(s),e.disposeIntermediateTensorInfo(i),e.disposeIntermediateTensorInfo(a),l}else return wr({attrs:{shape:o.shape,dtype:o.dtype,value:1},backend:e})}var d1={kernelName:vi,backendName:"webgl",kernelFunc:f1};function mP(r){let{inputs:t,backend:e,attrs:o}=r,{axis:n}=o;if(t.length===1)return Mu({inputs:{input:t[0]},backend:e,attrs:{dim:n}});let s=t[0].shape,i=t[0].dtype;t.forEach(u=>{C.assertShapesMatch(s,u.shape,"All tensors passed to stack must have matching shapes"),C.assert(i===u.dtype,()=>"All tensors passed to stack must have matching dtypes")});let a=[],l=t.map(u=>{let p=Mu({inputs:{input:u},backend:e,attrs:{dim:n}});return a.push(p),p}),c=Yf({inputs:l,backend:e,attrs:{axis:n}});return a.forEach(u=>e.disposeIntermediateTensorInfo(u)),c}var h1={kernelName:Si,backendName:"webgl",kernelFunc:mP};var tp=class{constructor(t,e,o){this.variableNames=["x"],this.customUniforms=[{name:"value",type:"float"}],this.outputShape=e.map((c,u)=>c[0]+t[u]+c[1]);let n=t.length,s=K(n),i=e.map(c=>c[0]).join(","),a=e.map((c,u)=>c[0]+t[u]).join(","),l=["coords[0]","coords[1]","coords[2]","coords[3]"].slice(0,n);if(n===1){this.userCode=`
        int start = ${i};
        int end = ${a};

        void main() {
          int outC = getOutputCoords();
          if (outC < start || outC >= end) {
            setOutput(value);
          } else {
            setOutput(getX(outC - start));
          }
        }
      `;return}this.userCode=`
      ${s} start = ${s}(${i});
      ${s} end = ${s}(${a});

      void main() {
        ${s} outC = getOutputCoords();
        if (any(lessThan(outC, start)) || any(greaterThanEqual(outC, end))) {
          setOutput(value);
        } else {
          ${s} coords = outC - start;
          setOutput(getX(${l}));
        }
      }
    `}};var ep=class{constructor(t,e,o){this.variableNames=["x"],this.packedInputs=!0,this.packedOutput=!0,this.customUniforms=[{name:"value",type:"float"}],this.outputShape=e.map((x,g)=>x[0]+t[g]+x[1]);let n=t.length,s=K(n),i=e.map(x=>x[0]).join(","),a=e.map((x,g)=>x[0]+t[g]).join(","),l=yt("rc",n),c=yt("source",n),u=`${l[n-1]} < ${this.outputShape[n-1]}`,p=n===1?"source":`vec2(${c.slice(-2).join()})`,m=[`${s} rc = outputLoc;`,`${l[n-1]} += 1;
       if(${u}) {
      `,n===1?"":`}
       rc = outputLoc;
       ${l[n-2]} += 1;
       if(${l[n-2]} < ${this.outputShape[n-2]}) {`,n===1?"":`  ${l[n-1]} += 1;
         if(${u}) {`],f=n===1?"rc < start || rc >= end":"any(lessThan(rc, start)) || any(greaterThanEqual(rc, end))",d="";for(let x=0,g=n===1?2:4;x<g;x++)d+=`
        ${m[x]}
        if (${f}) {
          result[${x}] = float(value);
        } else {
          ${s} source = rc - start;
          result[${x}] = getChannel(getX(${c.join()}), ${p});
        }
      `;d+=n===1?"} ":"}}",this.userCode=`
      const ${s} start = ${s}(${i});
      const ${s} end = ${s}(${a});

      void main() {
        ${s} outputLoc = getOutputCoords();
        vec4 result = vec4(0.);
        ${d}
        setOutput(result);
      }
    `}};var nd=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{paddings:s,constantValue:i}=o;if(C.sizeFromShape(n.shape)===0){let c=s.map((u,p)=>u[0]+n.shape[p]+u[1]);return wr({backend:e,attrs:{shape:c,value:i,dtype:n.dtype}})}let a=I().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new ep(n.shape,s,i):new tp(n.shape,s,i),l=[[i]];return e.runWebGLProgram(a,[n],n.dtype,l)},g1={kernelName:Ti,backendName:"webgl",kernelFunc:nd};var fP=`
  if(a < 0.0 && floor(b) < b){
    return NAN;
  }
  if (b == 0.0) {
    return 1.0;
  }
  return (round(mod(b, 2.0)) != 1) ?
      pow(abs(a), b) : sign(a) * pow(abs(a), b);
`,dP=`
  // isModRound1 has 1 for components with round(mod(b, 2.0)) == 1, 0 otherwise.
  vec4 isModRound1 = vec4(equal(round(mod(b, 2.0)), ivec4(1)));
  vec4 multiplier = sign(a) * isModRound1 + (vec4(1.0) - isModRound1);
  vec4 result = multiplier * pow(abs(a), b);

  // Ensure that a^0 = 1, including 0^0 = 1 as this correspond to TF and JS
  bvec4 isExpZero = equal(b, vec4(0.0));
  result.r = isExpZero.r ? 1.0 : result.r;
  result.g = isExpZero.g ? 1.0 : result.g;
  result.b = isExpZero.b ? 1.0 : result.b;
  result.a = isExpZero.a ? 1.0 : result.a;

  bvec4 isNaN1 = lessThan(a, vec4(0.0));
  bvec4 isNaN2 = lessThan(floor(b), b);
  bvec4 isNaN = bvec4(isNaN1.x && isNaN2.x, isNaN1.y && isNaN2.y, isNaN1.z && isNaN2.z, isNaN1.w && isNaN2.w);
  `+me+`
  return result;
`,hP=nt({opSnippet:fP,packedOpSnippet:dP}),x1={kernelName:"Pow",backendName:"webgl",kernelFunc:hP};function gP(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{axis:s,keepDims:i}=o,a=n.shape.length,l=[],c=C.parseAxisParam(s,n.shape),u=c,p=T.getAxesPermutation(u,a),m=n;p!=null&&(m=mt({inputs:{x:n},backend:e,attrs:{perm:p}}),u=T.getInnerMostAxes(u.length,a),l.push(m)),T.assertAxesAreInnerMostDims("prod",u,a);let f;if(e.shouldExecuteOnCPU([m])){let d=e.texData.get(m.dataId).values,{outVals:x,outShape:g,outDtype:b}=sw(m.shape,m.dtype,d,u);f=e.makeTensorInfo(g,b,x)}else{let[d,x]=T.computeOutAndReduceShapes(m.shape,u),g=C.sizeFromShape(x),b=D({inputs:{x:m},backend:e,attrs:{shape:[-1,g]}}),$=Rr(n.dtype),S=fe(b,$,"prod",e);f=D({inputs:{x:S},backend:e,attrs:{shape:d}}),l.push(b),l.push(S)}if(i){l.push(f);let d=T.expandShapeToKeepDim(f.shape,c);f=D({inputs:{x:f},backend:e,attrs:{shape:d}})}return l.forEach(d=>e.disposeIntermediateTensorInfo(d)),f}var b1={kernelName:gn,backendName:"webgl",kernelFunc:gP};function xP(r){let{inputs:t,backend:e,attrs:o}=r,{paramsNestedSplits:n,paramsDenseValues:s,indices:i}=t,{outputRaggedRank:a}=o,l=n.map(b=>e.readSync(b.dataId)),c=n.map(b=>b.shape),u=e.readSync(s.dataId),p=e.readSync(i.dataId),[m,f,d]=iw(l,c,u,s.shape,s.dtype,p,i.shape,a),x=m.map(b=>e.makeTensorInfo([b.length],"int32",b)),g=e.makeTensorInfo(d,s.dtype,f);return x.concat([g])}var y1={kernelName:Ii,backendName:"webgl",kernelFunc:xP};function bP(r){let{inputs:t,backend:e}=r,{starts:o,limits:n,deltas:s}=t,i=e.readSync(o.dataId),a=e.readSync(n.dataId),l=e.readSync(s.dataId),[c,u]=aw(i,o.shape,o.dtype,a,n.shape,l,s.shape),p=e.makeTensorInfo([c.length],"int32",c),m=e.makeTensorInfo([u.length],o.dtype,u);return[p,m]}var w1={kernelName:Ni,backendName:"webgl",kernelFunc:bP};function yP(r){let{inputs:t,backend:e,attrs:o}=r,{shape:n,values:s,defaultValue:i,rowPartitionTensors:a}=t,{rowPartitionTypes:l}=o,c=e.readSync(n.dataId),u=e.readSync(s.dataId),p=e.readSync(i.dataId),m=a.map(g=>e.readSync(g.dataId)),f=a.map(g=>g.shape),[d,x]=lw(c,n.shape,u,s.shape,s.dtype,p,i.shape,m,f,l);return e.makeTensorInfo(d,s.dtype,x)}var C1={kernelName:ki,backendName:"webgl",kernelFunc:yP};var sd=r=>{let{backend:t,attrs:e}=r,{start:o,stop:n,step:s,dtype:i}=e,a=cw(o,n,s,i);return t.makeTensorInfo([a.length],i,a)},v1={kernelName:Ri,backendName:"webgl",kernelFunc:sd};var wP="return 1.0 / x;",CP=G({opSnippet:wP}),$1={kernelName:Ai,backendName:"webgl",kernelFunc:CP};var vP=Et+`
  return (x < 0.0) ? 0.0 : x;
`,$P=`
  vec4 result = x * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,SP=G({opSnippet:vP,packedOpSnippet:$P}),S1={kernelName:_i,backendName:"webgl",kernelFunc:SP};var TP=Et+`
  return (x < 0.0) ? 0.0 : min(6.0, x);
`,EP=`
  vec4 result = min(x, vec4(6.)) * vec4(greaterThanEqual(x, vec4(0.0)));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,IP=G({opSnippet:TP,packedOpSnippet:EP}),T1={kernelName:Oi,backendName:"webgl",kernelFunc:IP};var rp=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.outputShape=[];let[i,a,l,c]=t;this.outputShape=[i,e,o,c];let u=[n&&e>1?a-1:a,n&&o>1?l-1:l],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m;s?m="(vec2(yRC) + vec2(0.5)) * effectiveInputOverOutputRatioRC - vec2(0.5)":m="vec2(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec2 effectiveInputOverOutputRatioRC = vec2(
          ${u[0]/p[0]},
          ${u[1]/p[1]});
      const vec2 inputShapeRC = vec2(${a}.0, ${l}.0);

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        ivec2 yRC = coords.yz;

        // Fractional source index.
        vec2 sourceFracIndexRC = ${m};

        // Compute the four integer indices.
        ivec2 sourceFloorRC = ivec2(max(sourceFracIndexRC, vec2(0.0)));
        ivec2 sourceCeilRC = ivec2(
          min(inputShapeRC - 1.0, ceil(sourceFracIndexRC)));

        float topLeft = getA(b, sourceFloorRC.x, sourceFloorRC.y, d);
        float bottomLeft = getA(b, sourceCeilRC.x, sourceFloorRC.y, d);
        float topRight = getA(b, sourceFloorRC.x, sourceCeilRC.y, d);
        float bottomRight = getA(b, sourceCeilRC.x, sourceCeilRC.y, d);

        vec2 fracRC = sourceFracIndexRC - vec2(sourceFloorRC);

        float top = topLeft + (topRight - topLeft) * fracRC.y;
        float bottom = bottomLeft + (bottomRight - bottomLeft) * fracRC.y;
        float newValue = top + (bottom - top) * fracRC.x;

        setOutput(newValue);
      }
    `}};var op=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=[];let[i,a,l,c]=t;this.outputShape=[i,e,o,c];let u=[n&&e>1?a-1:a,n&&o>1?l-1:l],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m;s?m="(vec3(yRC) + vec3(0.5)) * effectiveInputOverOutputRatioRC - vec3(0.5)":m="vec3(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec3 effectiveInputOverOutputRatioRC = vec3(
          ${u[0]/p[0]},
          ${u[1]/p[1]},
          ${u[1]/p[1]});
      const vec3 inputShapeRC = vec3(${a}.0, ${l}.0,
                                     ${l}.0);

      float getAValue(int b, int r, int c, int d) {
        return getChannel(getA(b, r, c, d), vec2(c, d));
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        // Calculate values for next column in yRC.z.
        ivec3 yRC = coords.yzz + ivec3(0, 0, 1);

        // Fractional source index.
        vec3 sourceFracIndexRC = ${m};

        // Compute the four integer indices.
        ivec3 sourceFloorRC = ivec3(max(sourceFracIndexRC, vec3(0.0)));
        ivec3 sourceCeilRC = ivec3(
          min(inputShapeRC - 1.0, ceil(sourceFracIndexRC)));

        // Should we calculate next column and row elements in 2x2 packed cell.
        bool hasNextCol = d < ${c-1};
        bool hasNextRow = coords.z < ${o-1};

        // In parallel, construct four corners for all four components in
        // packed 2x2 cell.
        vec4 topLeft = vec4(
          getAValue(b, sourceFloorRC.x, sourceFloorRC.y, d),
          hasNextCol ? getAValue(b, sourceFloorRC.x, sourceFloorRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceFloorRC.x, sourceFloorRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceFloorRC.x, sourceFloorRC.z, d + 1) : 0.0);

        vec4 bottomLeft = vec4(
          getAValue(b, sourceCeilRC.x, sourceFloorRC.y, d),
          hasNextCol ? getAValue(b, sourceCeilRC.x, sourceFloorRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceCeilRC.x, sourceFloorRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceCeilRC.x, sourceFloorRC.z, d + 1) : 0.0);

        vec4 topRight = vec4(
          getAValue(b, sourceFloorRC.x, sourceCeilRC.y, d),
          hasNextCol ? getAValue(b, sourceFloorRC.x, sourceCeilRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceFloorRC.x, sourceCeilRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceFloorRC.x, sourceCeilRC.z, d + 1) : 0.0);

        vec4 bottomRight = vec4(
          getAValue(b, sourceCeilRC.x, sourceCeilRC.y, d),
          hasNextCol ? getAValue(b, sourceCeilRC.x, sourceCeilRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceCeilRC.x, sourceCeilRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceCeilRC.x, sourceCeilRC.z, d + 1) : 0.0);

        vec3 fracRC = sourceFracIndexRC - vec3(sourceFloorRC);

        vec4 top = mix(topLeft, topRight, fracRC.yyzz);
        vec4 bottom = mix(bottomLeft, bottomRight, fracRC.yyzz);
        vec4 newValue = mix(top, bottom, fracRC.x);

        setOutput(newValue);
      }
    `}};function NP(r){let{inputs:t,backend:e,attrs:o}=r,{images:n}=t,{alignCorners:s,halfPixelCenters:i,size:a}=o,[l,c]=a,u=I().getBool("WEBGL_PACK_IMAGE_OPERATIONS")?new op(n.shape,l,c,s,i):new rp(n.shape,l,c,s,i);return e.runWebGLProgram(u,[n],"float32")}var E1={kernelName:Pi,backendName:"webgl",kernelFunc:NP};var np=class{constructor(t,e,o){this.variableNames=["dy"],this.outputShape=[],this.outputShape=e;let[,n,s]=e,[,i,a]=t,l=[o&&i>1?n-1:n,o&&a>1?s-1:s],c=[o&&i>1?i-1:i,o&&a>1?a-1:a],u=l[0]/c[0],p=l[1]/c[1],m=1/u,f=1/p,d=Math.ceil(m)*2+2,x=Math.ceil(f)*2+2;this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        int r = coords[1];
        int c = coords[2];

        float accumulator = 0.0;

        const float heightScale = float(${u});
        const float widthScale = float(${p});

        const float invHeightScale = float(${m});
        const float invWidthScale = float(${f});

        const int winHeight = int(${d});
        const int winWidth = int(${x});

        // Compute bounds for where in dy we will look
        float startRLerp = floor(float(r) * invHeightScale);
        int startDyR = int(startRLerp - float(winHeight / 2));

        float startCLerp = floor(float(c) * invWidthScale);
        int startDyC = int(startCLerp - float(winWidth / 2));

        // Loop over dy
        for (int dyROffset = 0; dyROffset < winHeight; dyROffset++) {
          int dyR = dyROffset + startDyR;

          // Guard against the window exceeding the bounds of dy
          if (dyR < 0 || dyR >= ${i}) {
            continue;
          }

          for (int dyCOffset = 0; dyCOffset < winWidth; dyCOffset++) {
            int dyC = dyCOffset + startDyC;

            // Guard against the window exceeding the bounds of dy
            if (dyC < 0 || dyC >= ${a}) {
              continue;
            }

            float dxR = float(dyR) * heightScale;
            int topDxRIndex = int(floor(dxR));
            int bottomDxRIndex = int(min(ceil(dxR), ${n-1}.0));
            float dxRLerp = dxR - float(topDxRIndex);
            float inverseDxRLerp = 1.0 - dxRLerp;

            float dxC = float(dyC) * widthScale;
            int leftDxCIndex = int(floor(dxC));
            int rightDxCIndex = int(min(ceil(dxC), ${s-1}.0));
            float dxCLerp = dxC - float(leftDxCIndex);
            float inverseDxCLerp = 1.0 - dxCLerp;

            if (r == topDxRIndex && c == leftDxCIndex) {
              // topLeft
              accumulator +=
                getDy(b, dyR, dyC, d) * inverseDxRLerp * inverseDxCLerp;
            }

            if (r == topDxRIndex && c == rightDxCIndex) {
              // topRight
              accumulator += getDy(b, dyR, dyC, d) * inverseDxRLerp * dxCLerp;
            }

            if (r == bottomDxRIndex && c == leftDxCIndex) {
              // bottomLeft
              accumulator += getDy(b, dyR, dyC, d) * dxRLerp * inverseDxCLerp;
            }

            if (r == bottomDxRIndex && c == rightDxCIndex) {
              // bottomRight
              accumulator += getDy(b, dyR, dyC, d) * dxRLerp * dxCLerp;
            }
          }
        }
        // End loop over dy

        setOutput(accumulator);
      }
    `}};function kP(r){let{inputs:t,backend:e,attrs:o}=r,{images:n,dy:s}=t,{alignCorners:i}=o,a=new np(s.shape,n.shape,i);return e.runWebGLProgram(a,[s],s.dtype)}var I1={kernelName:Bp,backendName:"webgl",kernelFunc:kP};var sp=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.outputShape=[];let[i,a,l,c]=t;this.outputShape=[i,e,o,c];let u=[n&&e>1?a-1:a,n&&o>1?l-1:l],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m=n?"0.5":"0.0",f;s?f="max((vec2(yRC) + vec2(0.5)) * effectiveInputOverOutputRatioRC, vec2(0.0))":f="vec2(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec2 effectiveInputOverOutputRatioRC = vec2(
          ${u[0]/p[0]},
          ${u[1]/p[1]});
      const vec2 inputShapeRC = vec2(${a}.0, ${l}.0);

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        ivec2 yRC = coords.yz;

        // Fractional source index.
        vec2 sourceFracIndexRC = ${f};

        // Compute the coordinators of nearest neighbor point.
        ivec2 sourceNearestRC = ivec2(
          min(inputShapeRC - 1.0, floor(sourceFracIndexRC + ${m})));
        float newValue = getA(b, sourceNearestRC.x, sourceNearestRC.y, d);

        setOutput(newValue);
      }
    `}};var ip=class{constructor(t,e,o,n,s){this.variableNames=["A"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=[];let[i,a,l,c]=t;this.outputShape=[i,e,o,c];let u=[n&&e>1?a-1:a,n&&o>1?l-1:l],p=[n&&e>1?e-1:e,n&&o>1?o-1:o],m=n?"0.5":"0.0",f;s?f="max((vec3(yRC) + vec3(0.5)) * effectiveInputOverOutputRatioRC, vec3(0.0))":f="vec3(yRC) * effectiveInputOverOutputRatioRC",this.userCode=`
      const vec3 effectiveInputOverOutputRatioRC = vec3(
          ${u[0]/p[0]},
          ${u[1]/p[1]},
          ${u[1]/p[1]});
      const vec3 inputShapeRC = vec3(${a}.0, ${l}.0,
                                     ${l}.0);

      float getAValue(int b, int r, int c, int d) {
        return getChannel(getA(b, r, c, d), vec2(c, d));
      }

      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        // Calculate values for next column in yRC.z.
        ivec3 yRC = coords.yzz + ivec3(0, 0, 1);

        // Fractional source index.
        vec3 sourceFracIndexRC = ${f};

        // Compute the coordinators of nearest neighbor point.
        ivec3 sourceNearestRC = ivec3(
          min(inputShapeRC - 1.0, floor(sourceFracIndexRC + ${m})));

        // Should we calculate next column and row elements in 2x2 packed cell.
        bool hasNextCol = d < ${c-1};
        bool hasNextRow = coords.z < ${o-1};

        vec4 newValue = vec4(
          getAValue(b, sourceNearestRC.x, sourceNearestRC.y, d),
          hasNextCol ? getAValue(b, sourceNearestRC.x, sourceNearestRC.y, d + 1)
                     : 0.0,
          hasNextRow ? getAValue(b, sourceNearestRC.x, sourceNearestRC.z, d)
                     : 0.0,
          (hasNextRow && hasNextCol) ?
            getAValue(b, sourceNearestRC.x, sourceNearestRC.z, d + 1) : 0.0);

        setOutput(newValue);
      }
    `}};function RP(r){let{inputs:t,backend:e,attrs:o}=r,{images:n}=t,{alignCorners:s,halfPixelCenters:i,size:a}=o,[l,c]=a,u=I().getBool("WEBGL_PACK_IMAGE_OPERATIONS")?new ip(n.shape,l,c,s,i):new sp(n.shape,l,c,s,i);return e.runWebGLProgram(u,[n],n.dtype)}var N1={kernelName:Fi,backendName:"webgl",kernelFunc:RP};var ap=class{constructor(t,e,o){this.variableNames=["dy"],this.outputShape=[],this.outputShape=e;let[,n,s]=e,[,i,a]=t,l=[o&&i>1?n-1:n,o&&a>1?s-1:s],c=[o&&i>1?i-1:i,o&&a>1?a-1:a],u=l[0]/c[0],p=l[1]/c[1],m=1/u,f=1/p,d=Math.ceil(m)*2+2,x=Math.ceil(f)*2+2;this.userCode=`
      void main() {
        ivec4 coords = getOutputCoords();
        int b = coords[0];
        int d = coords[3];
        int r = coords[1];
        int c = coords[2];

        float accumulator = 0.0;

        const float heightScale = float(${u});
        const float widthScale = float(${p});

        const float invHeightScale = float(${m});
        const float invWidthScale = float(${f});

        const int winHeight = int(${d});
        const int winWidth = int(${x});

        // Compute bounds for where in dy we will look
        float startRLerp = floor(float(r) * invHeightScale);
        int startDyR = int(floor(startRLerp - float(winHeight / 2)));

        float startCLerp = floor(float(c) * invWidthScale);
        int startDyC = int(floor(startCLerp - float(winWidth / 2)));

        // Loop over dy
        for (int dyROffset = 0; dyROffset < winHeight; dyROffset++) {
          int dyR = dyROffset + startDyR;

          // Guard against the window exceeding the bounds of dy
          if (dyR < 0 || dyR >= ${i}) {
            continue;
          }

          for (int dyCOffset = 0; dyCOffset < winWidth; dyCOffset++) {
            int dyC = dyCOffset + startDyC;

            // Guard against the window exceeding the bounds of dy
            if (dyC < 0 || dyC >= ${a}) {
              continue;
            }

            float sourceFracRow =
              float(${l[0]}) *
                (float(dyR) / float(${c[0]}));

            float sourceFracCol =
                float(${l[1]}) *
                  (float(dyC) / float(${c[1]}));

            int sourceNearestRow = int(min(
                float(int(${n}) - 1),
                ${o} ? float(round(sourceFracRow)) :
                                  float(floor(sourceFracRow))));

            int sourceNearestCol = int(min(
                float(int(${s}) - 1),
                ${o} ? float(round(sourceFracCol)) :
                                  float(floor(sourceFracCol))));

            if (r == sourceNearestRow && c == sourceNearestCol) {
              accumulator += getDy(b, dyR, dyC, d);
            }
          }
        }
        // End loop over dy

        setOutput(accumulator);
      }
    `}};function AP(r){let{inputs:t,backend:e,attrs:o}=r,{images:n,dy:s}=t,{alignCorners:i}=o,a=new ap(s.shape,n.shape,i);return e.runWebGLProgram(a,[s],s.dtype)}var k1={kernelName:Lp,backendName:"webgl",kernelFunc:AP};var lp=class{constructor(t,e){this.variableNames=["x"];let o=t.length;if(o>4)throw new Error(`WebGL backend: Reverse of rank-${o} tensor is not yet supported`);if(this.outputShape=t,o===1){this.userCode=`
        void main() {
          int coord = getOutputCoords();
          setOutput(getX(${t[0]} - coord - 1));
        }
      `;return}let n=a=>e.indexOf(a)!==-1&&t[a]!==1?`${t[a]} - coords[${a}] - 1`:`coords[${a}]`,s=t.map((a,l)=>n(l)).join(","),i=K(o);this.userCode=`
      void main() {
        ${i} coords = getOutputCoords();
        setOutput(getX(${s}));
      }
    `}};var cp=class{constructor(t,e){this.variableNames=["x"],this.packedInputs=!0,this.packedOutput=!0;let o=t.length;if(o>4)throw new Error(`WebGL backend: Reverse of rank-${o} tensor is not yet supported`);this.outputShape=t;let n=yt("rc",o),s=`${n[o-1]} + 1 < ${this.outputShape[o-1]}`,i=`${n[o-2]} + 1 < ${this.outputShape[o-2]}`,a=K(o);o===1?this.userCode=`
        void main(){
          int rc = getOutputCoords();
          vec4 result = vec4(0.);
          result.r = getChannel(getX(${t[0]} - rc - 1),
            ${t[0]} - rc - 1);
          if(${s}){
              result.g = getChannel(getX(${t[0]} - (rc  + 1) - 1),
                ${t[0]} - (rc  + 1) - 1);
          }
          setOutput(result);
        }
      `:this.userCode=`
        void main() {
          ${a} rc = getOutputCoords();
          vec4 result = vec4(0.);
          result.r = ${l(n.slice())};
          if(${s}){
            result.g = ${c(n.slice())};
          }
          if(${i}) {
            result.b = ${u(n.slice())};
            if(${s}) {
              result.a = ${p(n.slice())};
            }
          }
          setOutput(result);
        }
    `;function l(d){return m(d)}function c(d){return d[o-1]="("+d[o-1]+" + 1)",m(d)}function u(d){return d[o-2]="("+d[o-2]+" + 1)",m(d)}function p(d){return d[o-1]="("+d[o-1]+" + 1)",d[o-2]="("+d[o-2]+" + 1)",m(d)}function m(d){let x=t.map(($,S)=>f(S,d)),g=x.join(","),b=x.slice(-2).join(",");return`getChannel(getX(${g}), vec2(${b}))`}function f(d,x){return e.indexOf(d)!==-1&&t[d]!==1?`${t[d]} - ${x[d]} - 1`:`${x[d]}`}}};function _P(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{dims:s}=o,i=n.shape.length,a=C.parseAxisParam(s,n.shape);if(i===0)return wt({inputs:{x:n},backend:e});let l=I().getBool("WEBGL_PACK_ARRAY_OPERATIONS")?new cp(n.shape,a):new lp(n.shape,a);return e.runWebGLProgram(l,[n],n.dtype)}var R1={kernelName:Mi,backendName:"webgl",kernelFunc:_P};var up=class{constructor(t,e){this.variableNames=["Image"],this.outputShape=[],this.customUniforms=[{name:"params",type:"vec4"}];let o=t[1],n=t[2];this.outputShape=t;let s="";typeof e=="number"?s=`float outputValue = ${e.toFixed(2)};`:s=`
        vec3 fill = vec3(${e.join(",")});
        float outputValue = fill[coords[3]];`,this.userCode=`
        void main() {
          ivec4 coords = getOutputCoords();
          int x = coords[2];
          int y = coords[1];
          float coordXFloat = (float(x) - params[0]) * params[3] -
            (float(y) - params[1]) * params[2];
          float coordYFloat = (float(x) - params[0]) * params[2] +
            (float(y) - params[1]) * params[3];
          int coordX = int(round(coordXFloat + params[0]));
          int coordY = int(round(coordYFloat + params[1]));
          ${s}
          if(coordX >= 0 && coordX < ${n} && coordY >= 0 && coordY < ${o}) {
            outputValue = getImage(coords[0], coordY, coordX, coords[3]);
          }
          setOutput(outputValue);
        }
    `}};var A1={kernelName:fa,backendName:"webgl",kernelFunc:({inputs:r,attrs:t,backend:e})=>{let{image:o}=r,{radians:n,fillValue:s,center:i}=t,a=e,l=new up(o.shape,s),[c,u]=T.getImageCenter(i,o.shape[1],o.shape[2]),p=[[c,u,Math.sin(n),Math.cos(n)]];return a.runWebGLProgram(l,[o],o.dtype,p)}};var DP=`
  // OpenGL ES does not support round function.
  // The algorithm is based on banker's rounding.
  float base = floor(x);
  if ((x - base) < 0.5) {
    return floor(x);
  } else if ((x - base) > 0.5) {
    return ceil(x);
  } else {
    if (mod(base, 2.0) == 0.0) {
      return base;
    } else {
      return base + 1.0;
    }
  }
`,FP=G({opSnippet:DP}),_1={kernelName:Li,backendName:"webgl",kernelFunc:FP};var PP="return inversesqrt(x);",OP=G({opSnippet:PP,cpuKernelImpl:uw}),D1={kernelName:bo,backendName:"webgl",kernelFunc:OP};var Jr=class{constructor(t,e,o,n,s,i,a=!0,l=!1){this.variableNames=["updates","indices","defaultValue"],this.outputShape=i;let c=K(s.length),u=K(i.length),p="";o===1?p="i":o===2&&(p="i, j");let m=`getIndices(${p})`,f="";n===1?f="i":n===2&&(f="i, coords[1]");let d=`getUpdates(${f})`,x="";l&&(x="coords[0], coords[1]");let g=`getDefaultValue(${x})`,b=e>1?"strides[j]":"strides";this.userCode=`
        ${c} strides = ${c}(${s});

        void main() {
          ${u} coords = getOutputCoords();
          float sum = 0.0;
          bool found = false;
          for (int i = 0; i < ${t}; i++) {
            int flattenedIndex = 0;
            for (int j = 0; j < ${e}; j++) {
              int index = round(${m});
              flattenedIndex += index * ${b};
            }
            if (flattenedIndex == coords[0]) {
              sum += ${d};
              found = true;
            }
          }
          setOutput(mix(${g}, sum, float(found)));
        }
      `}};var pp=class{constructor(t,e,o,n,s,i,a=!0,l=!1){this.variableNames=["updates","indices","defaultValue"],this.packedInputs=!0,this.packedOutput=!0,this.outputShape=i;let c=K(s.length),u=K(i.length),p="";o===1?p="i":o===2&&(p="i, j");let m=`getIndices(${p})`,f="";n===1?f="i":n===2&&(f="i, coords[1]");let d=`getUpdates(${f})`,x="";l&&(x="coords[0], coords[1]");let g=`getDefaultValue(${x})`,b=e>1?"strides[j]":"strides",$=e>1?"strides[j + 1]":"strides";this.userCode=`
        ${c} strides = ${c}(${s});

        void main() {
          ${u} coords = getOutputCoords();
          vec4 sum = vec4(0.);
          vec4 found = vec4(0.);
          for (int i = 0; i < ${t}; i+=2) {
            ivec2 flattenedIndex = ivec2(0);
            for (int j = 0; j < ${e}; j+=2) {
              ivec4 index = round(${m});
              flattenedIndex += index.xz * ${b};
              if (j + 1 < ${e}) {
                flattenedIndex += index.yw * ${$};
              }
            }
            if (flattenedIndex[0] == coords[0] || flattenedIndex[1] == coords[0] ||
                flattenedIndex[0] == coords[0] + 1 || flattenedIndex[1] == coords[0] + 1) {
              vec4 updVals = ${d};
              if (flattenedIndex[0] == coords[0]) {
                sum.xy += updVals.xy;
                found.xy = vec2(1.);
              } else if (flattenedIndex[0] == coords[0] + 1) {
                sum.zw += updVals.xy;
                found.zw = vec2(1.);
              }
              if (flattenedIndex[1] == coords[0]) {
                sum.xy += updVals.zw;
                found.xy = vec2(1.);
              } else if (flattenedIndex[1] == coords[0] + 1) {
                sum.zw += updVals.zw;
                found.zw = vec2(1.);
              }
            }
          }
          setOutput(mix(${g}, sum, found));
        }
      `}};function MP(r){let{inputs:t,backend:e,attrs:o}=r,{indices:n,updates:s}=t,{shape:i}=o,{sliceRank:a,numUpdates:l,sliceSize:c,strides:u,outputSize:p}=T.calculateShapes(s,n,i),m=[p/c,c];if(p===0)return e.makeTensorInfo(i,n.dtype);let f=D({inputs:{x:n},backend:e,attrs:{shape:[l,a]}}),d=D({inputs:{x:s},backend:e,attrs:{shape:[l,c]}}),x=e.makeTensorInfo([],"float32",new Float32Array([0])),g;I().getBool("WEBGL_PACK")?g=new pp(l,a,f.shape.length,d.shape.length,u,m):g=new Jr(l,a,f.shape.length,d.shape.length,u,m);let b=e.runWebGLProgram(g,[d,f,x],d.dtype),$=D({inputs:{x:b},backend:e,attrs:{shape:i}});return e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),e.disposeIntermediateTensorInfo(b),e.disposeIntermediateTensorInfo(x),$}var F1={kernelName:Bi,backendName:"webgl",kernelFunc:MP};var mp=class{constructor(t,e,o,n){this.variableNames=["sortedSequence","values"],this.customUniforms=[{name:"numInputs",type:"int"}],this.outputShape=[t,o];let s="while (left < right) {",i=`for (int i = 0; i < ${Math.ceil(Math.log2(e+1))}; ++i) { if (left >= right) break;`,a=I().getNumber("WEBGL_VERSION")===2?s:i,l=n==="left"?"<":"<=";this.userCode=`
       int findBound(int batch, float value) {
         int left = 0;
         int right = numInputs;
         int mid;
         ${a}
           mid = (left + right) / 2;
           if (getSortedSequence(batch, mid) ${l} value) {
             left = mid + 1;
           } else {
             right = mid;
           }
         }
         return right;
       }

       void main() {
         ivec2 coords = getOutputCoords();
         int batch = coords[0];
         int valueIndex = coords[1];

         float value = getValues(batch, valueIndex);

         setOutput(float(findBound(batch, value)));
       }
     `}};function LP(r){let{inputs:t,backend:e,attrs:o}=r,{sortedSequence:n,values:s}=t,{side:i}=o,a=new mp(n.shape[0],n.shape[1],s.shape[1],i),l=[[n.shape[1]]];return e.runWebGLProgram(a,[n,s],"int32",l)}var P1={kernelName:Ui,backendName:"webgl",kernelFunc:LP};var fp=class{constructor(t,e,o){this.variableNames=["c","a","b"],this.outputShape=e;let n,s;if(o>4)throw Error(`Where for rank ${o} is not yet supported`);if(o===1)s="resRC",n="resRC";else{let a=["resRC.x","resRC.y","resRC.z","resRC.w"],l=[],c=[];for(let u=0;u<e.length;u++)c.push(`${a[u]}`),u<t&&l.push(`${a[u]}`);n=l.join(),s=c.join()}let i=K(o);this.userCode=`
      void main() {
        ${i} resRC = getOutputCoords();
        float cVal = getC(${n});
        if (cVal >= 1.0) {
          setOutput(getA(${s}));
        } else {
          setOutput(getB(${s}));
        }
      }
    `}};function BP(r){let{inputs:t,backend:e}=r,{condition:o,t:n,e:s}=t,i=new fp(o.shape.length,n.shape,n.shape.length);return e.runWebGLProgram(i,[o,n,s],Bt(n.dtype,s.dtype))}var O1={kernelName:Vi,backendName:"webgl",kernelFunc:BP};var GP=`
  // Stable and Attracting Fixed Point (0, 1) for Normalized Weights.
  // see: https://arxiv.org/abs/1706.02515
  float scaleAlpha = ${T.SELU_SCALEALPHA};
  float scale = ${T.SELU_SCALE};
  return (x >= 0.0) ? scale * x : scaleAlpha * (exp(x) - 1.0);
`,UP=G({opSnippet:GP}),M1={kernelName:Wi,backendName:"webgl",kernelFunc:UP};var VP=Ie+`
  return 1.0 / (1.0 + exp(-1.0 * x));
`,WP=`
  vec4 result = 1.0 / (1.0 + exp(-1.0 * x));
  bvec4 isNaN = isnan(x);

  result.r = isNaN.r ? x.r : result.r;
  result.g = isNaN.g ? x.g : result.g;
  result.b = isNaN.b ? x.b : result.b;
  result.a = isNaN.a ? x.a : result.a;

  return result;
`,zP=G({opSnippet:VP,packedOpSnippet:WP,cpuKernelImpl:mw}),L1={kernelName:yo,backendName:"webgl",kernelFunc:zP};var KP=`
  if (isnan(x)) { return 0.0; }
  return sign(x);
`,HP=G({opSnippet:KP}),B1={kernelName:Ki,backendName:"webgl",kernelFunc:HP};var qP=Ie+`
  return sin(x);
`,XP=`
  vec4 result = sin(x);
  bvec4 isNaN = isnan(x);
  ${me}
  return result;
`,jP=G({opSnippet:qP,packedOpSnippet:XP}),G1={kernelName:"Sin",backendName:"webgl",kernelFunc:jP};var YP=`
  float e2x = exp(x);
  return (e2x - 1.0 / e2x) / 2.0;
`,ZP=G({opSnippet:YP}),U1={kernelName:zi,backendName:"webgl",kernelFunc:ZP};var QP=`
  float epsilon = 1.1920928955078125e-7;
  float threshold = log(epsilon) + 2.0;

  bool too_large = x > -threshold;
  bool too_small = x < threshold;

  float result;
  float exp_x = exp(x);

  if (too_large){
    result = x;
  }
  else if (too_small){
    result = exp_x;
  }
  else{
    result = log(exp_x + 1.0);
  }
  return result;
`,JP=G({opSnippet:QP}),V1={kernelName:Hi,backendName:"webgl",kernelFunc:JP};var tO=r=>{let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{blockShape:s,paddings:i}=o;C.assert(n.shape.length<=4,()=>"spaceToBatchND for rank > 4 with a WebGL backend not implemented yet");let a=s.reduce((b,$)=>b*$),l=[[0,0]];l.push(...i);for(let b=1+s.length;b<n.shape.length;++b)l.push([0,0]);let c=[],u=nd({inputs:{x:n},backend:e,attrs:{paddings:l,constantValue:0}}),p=T.getReshaped(u.shape,s,a,!1),m=T.getPermuted(p.length,s.length,!1),f=T.getReshapedPermuted(u.shape,s,a,!1),d=D({inputs:{x:u},backend:e,attrs:{shape:p}}),x=mt({inputs:{x:d},backend:e,attrs:{perm:m}}),g=D({inputs:{x},backend:e,attrs:{shape:f}});return c.push(u),c.push(d),c.push(x),c.forEach(b=>e.disposeIntermediateTensorInfo(b)),g},W1={kernelName:qi,backendName:"webgl",kernelFunc:tO};function eO(r){let{inputs:t,backend:e}=r,{indices:o,values:n,denseShape:s,defaultValue:i}=t;if(s.shape.length!==1)throw new Error(`Dense shape must be a vector, saw:
         ${s.shape}`);if(o.shape.length!==2)throw new Error(`Indices must be a matrix, saw:
         ${o.shape}`);if(n.shape.length!==1)throw new Error(`Values must be a vector, saw:
         ${n.shape}`);if(i.shape.length!==0)throw new Error(`Default value must be a scalar, saw:
        ${i.shape}`);let a=e.readSync(o.dataId),l=e.readSync(n.dataId),c=e.readSync(s.dataId),u=e.readSync(i.dataId)[0],[p,m,f,d,x]=dw(a,o.shape,o.dtype,l,n.dtype,c,u);return[e.makeTensorInfo(m,o.dtype,p),e.makeTensorInfo([m[0]],n.dtype,f),e.makeTensorInfo([d.length],"bool",new Uint8Array(d.map(g=>Number(g)))),e.makeTensorInfo([x.length],o.dtype,new Int32Array(x))]}var z1={kernelName:Yi,backendName:"webgl",kernelFunc:eO};function rO(r){let{inputs:t,backend:e}=r,{inputIndices:o,inputShape:n,newShape:s}=t;if(o.shape.length!==2)throw new Error(`Input indices should be a matrix but received shape ${o.shape}`);if(n.shape.length!==1)throw new Error(`Input shape should be a vector but received shape ${n.shape}`);if(s.shape.length!==1)throw new Error(`Target shape should be a vector but received shape ${s.shape}`);let i=Array.from(e.readSync(n.dataId)),a=e.readSync(o.dataId),l=Array.from(e.readSync(s.dataId)),[c,u,p]=hw(a,o.shape,o.dtype,i,l);return[e.makeTensorInfo(u,o.dtype,c),e.makeTensorInfo([p.length],s.dtype,new Int32Array(p))]}var K1={kernelName:Zi,backendName:"webgl",kernelFunc:rO};function oO(r){let{inputs:t,backend:e}=r,{data:o,indices:n,segmentIds:s}=t;if(o.shape.length<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.shape.length!==1)throw new Error(`Indices should be a vector but received shape
              ${n.shape}`);if(s.shape.length!==1)throw new Error(`Segment ids should be a vector but received shape
              ${s.shape}`);let i=e.readSync(o.dataId),a=e.readSync(n.dataId),l=e.readSync(s.dataId),[c,u]=Xc(i,o.shape,o.dtype,a,l,!0);return e.makeTensorInfo(u,o.dtype,c)}var H1={kernelName:Qi,backendName:"webgl",kernelFunc:oO};function nO(r){let{inputs:t,backend:e}=r,{data:o,indices:n,segmentIds:s}=t;if(o.shape.length<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(n.shape.length!==1)throw new Error(`Indices should be a vector but received shape
             ${n.shape}`);if(s.shape.length!==1)throw new Error(`Segment ids should be a vector but received shape
             ${s.shape}`);let i=e.readSync(o.dataId),a=e.readSync(n.dataId),l=e.readSync(s.dataId),[c,u]=Xc(i,o.shape,o.dtype,a,l);return e.makeTensorInfo(u,o.dtype,c)}var q1={kernelName:Ji,backendName:"webgl",kernelFunc:nO};function sO(r){let{inputs:t,backend:e,attrs:o}=r,{sparseIndices:n,sparseValues:s,defaultValue:i}=t,{outputShape:a}=o,{sliceRank:l,numUpdates:c,sliceSize:u,strides:p,outputSize:m}=T.calculateShapes(s,n,a),f=!1;if(s.dtype==="string"){let b=e.bufferSync(n),$=e.bufferSync(s),S=C.decodeString(e.readSync(i.dataId)[0]),E=pw(b,$,a,m,u,c,l,p,S,f);return e.makeTensorInfo(a,E.dtype,E.values)}let d=new Jr(c,l,n.shape.length,s.shape.length,p,[m,1],f),x=e.runWebGLProgram(d,[s,n,i],s.dtype),g=D({inputs:{x},backend:e,attrs:{shape:a}});return e.disposeIntermediateTensorInfo(x),g}var X1={kernelName:ta,backendName:"webgl",kernelFunc:sO};function iO(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{numOrSizeSplits:s,axis:i}=o,a=C.parseAxisParam(i,n.shape)[0],l=T.prepareSplitSize(n,s,a),c=n.shape.length,u=new Array(c).fill(0),p=n.shape.slice();return l.map(m=>{let f=[...p];f[a]=m;let d=Me({inputs:{x:n},backend:e,attrs:{begin:u,size:f}});return u[a]+=m,d})}var j1={kernelName:Xi,backendName:"webgl",kernelFunc:iO};var Y1="return sqrt(x);",aO=G({opSnippet:Y1,packedOpSnippet:Y1,cpuKernelImpl:gw}),Z1={kernelName:wo,backendName:"webgl",kernelFunc:aO};var lO="return x * x;",cO=G({opSnippet:lO}),Q1={kernelName:Gp,backendName:"webgl",kernelFunc:cO};var J1="return (a - b) * (a - b);",uO=nt({opSnippet:J1,packedOpSnippet:J1}),t$={kernelName:Co,backendName:"webgl",kernelFunc:uO};function pO(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t;if(n.dtype!=="string")throw new Error("Input must be of datatype string");let s=e.readSync(n.dataId),i=T.fromUint8ToStringArray(s),a=xw(i,"string",o);return e.makeTensorInfo(n.shape,"string",a)}var e$={kernelName:vo,backendName:"webgl",kernelFunc:pO};function mO({inputs:r,attrs:t,backend:e}){let{x:o}=r,n=Et+`
    return x > 0.0 ? 1.0 : float(${t.alpha});
  `,s=new Mt(o.shape,n);return e.runWebGLProgram(s,[o],o.dtype)}var r$={kernelName:ma,backendName:"webgl",kernelFunc:mO};var dp=class{constructor(t,e,o){this.variableNames=["x"],this.outputShape=o;let n=o.length,s=K(o.length),i=K(o.length),a="";if(n===1)a="coords * strides + begin";else{let l=0;a=o.map((c,u)=>(l++,o.length===1?`coords * strides[${u}] + begin[${u}]`:`coords[${l-1}] * strides[${u}] + begin[${u}]`)).join(",")}this.userCode=`
      ${s} begin = ${s}(${t});
      ${s} strides = ${s}(${e});

      void main() {
        ${i} coords = getOutputCoords();
        setOutput(getX(${a}));
      }
    `}};function fO(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{begin:s,end:i,strides:a,beginMask:l,endMask:c,ellipsisMask:u,newAxisMask:p,shrinkAxisMask:m}=o,{finalShapeSparse:f,finalShape:d,isIdentity:x,sliceDim0:g,isSimpleSlice:b,begin:$,end:S,strides:E}=Zt.sliceInfo(n.shape,s,i,a,l,c,u,p,m),N;if(x)N=D({inputs:{x:n},backend:e,attrs:{shape:d}});else if(g||b){C.assert(n.shape.length>=1,()=>`Input must have rank at least 1, got: ${n.shape.length}`);let A=Zt.computeOutShape($,S,E),_=Me({inputs:{x:n},backend:e,attrs:{begin:$,size:A}});N=D({inputs:{x:_},backend:e,attrs:{shape:d}}),e.disposeIntermediateTensorInfo(_)}else if(e.shouldExecuteOnCPU([n])){let _=e.readSync(n.dataId),P=j(n.shape,n.dtype,_),O=bw(f,P,E,$);N=e.makeTensorInfo(d,n.dtype,O.values)}else{let _=new dp($,E,f);N=e.runWebGLProgram(_,[n],n.dtype)}let R=D({inputs:{x:N},backend:e,attrs:{shape:d}});return e.disposeIntermediateTensorInfo(N),R}var o$={kernelName:ea,backendName:"webgl",kernelFunc:fO};function dO(r){let{inputs:t,backend:e,attrs:o}=r,{separator:n,nGramWidths:s,leftPad:i,rightPad:a,padWidth:l,preserveShortSequences:c}=o,{data:u,dataSplits:p}=t,m=e.readSync(u.dataId),f=e.readSync(p.dataId),[d,x]=yw(m,f,n,s,i,a,l,c);return[e.makeTensorInfo([d.length],"string",d),e.makeTensorInfo(p.shape,"int32",x)]}var n$={kernelName:ra,backendName:"webgl",kernelFunc:dO};function hO(r){let{inputs:t,backend:e,attrs:o}=r,{skipEmpty:n}=o,{input:s,delimiter:i}=t;if(s.dtype!=="string")throw new Error("Input must be of datatype string");if(s.shape.length!==1)throw new Error(`Input must be a vector, got shape: ${s.shape}`);if(i.shape.length!==0)throw new Error(`Delimiter must be a scalar, got shape: ${i.shape}`);let a=e.readSync(s.dataId),l=e.readSync(i.dataId)[0],[c,u,p]=ww(a,l,n),m=u.length;return[e.makeTensorInfo([m,2],"int32",c),e.makeTensorInfo([m],"string",u),e.makeTensorInfo([2],"int32",new Int32Array(p))]}var s$={kernelName:oa,backendName:"webgl",kernelFunc:hO};function gO(r){let{inputs:t,backend:e,attrs:o}=r,{numBuckets:n}=o,{input:s}=t;if(s.dtype!=="string")throw new Error("Input must be of datatype string");if(n<=0)throw new Error("Number of buckets must be at least 1");let i=e.readSync(s.dataId),a=Cw(i,n);return e.makeTensorInfo(s.shape,"int32",a)}var i$={kernelName:na,backendName:"webgl",kernelFunc:gO};var xO="return tan(x);",bO=G({opSnippet:xO}),a$={kernelName:"Tan",backendName:"webgl",kernelFunc:bO};var yO=`
  float e2x = exp(-2.0 * abs(x));
  return sign(x) * (1.0 - e2x) / (1.0 + e2x);
`,wO=G({opSnippet:yO}),l$={kernelName:sa,backendName:"webgl",kernelFunc:wO};function CO(r){let{inputs:t,backend:e,attrs:o}=r,{tensor:n,indices:s,updates:i}=t,{}=o,{sliceRank:a,numUpdates:l,sliceSize:c,strides:u,outputSize:p}=T.calculateShapes(i,s,n.shape),m=[p/c,c];if(p===0)return e.makeTensorInfo(n.shape,s.dtype);let f=D({inputs:{x:s},backend:e,attrs:{shape:[l,a]}}),d=D({inputs:{x:i},backend:e,attrs:{shape:[l,c]}}),x=D({inputs:{x:n},backend:e,attrs:{shape:m}}),g=new Jr(l,a,f.shape.length,d.shape.length,u,m,!1,!0),b=e.runWebGLProgram(g,[d,f,x],x.dtype),$=D({inputs:{x:b},backend:e,attrs:{shape:n.shape}});return e.disposeIntermediateTensorInfo(f),e.disposeIntermediateTensorInfo(d),e.disposeIntermediateTensorInfo(x),e.disposeIntermediateTensorInfo(b),$}var c$={kernelName:Gi,backendName:"webgl",kernelFunc:CO};var hp=class{constructor(t,e){this.variableNames=["A"];let o=new Array(t.length);for(let i=0;i<o.length;i++)o[i]=t[i]*e[i];this.outputShape=o,this.rank=o.length;let n=K(this.rank),s=vO(t);this.userCode=`
      void main() {
        ${n} resRC = getOutputCoords();
        setOutput(getA(${s}));
      }
    `}};function vO(r){let t=r.length;if(t>5)throw Error(`Tile for rank ${t} is not yet supported`);if(t===1)return`imod(resRC, ${r[0]})`;let e=["resRC.x","resRC.y","resRC.z","resRC.w","resRC.u"],o=[];for(let n=0;n<r.length;n++)o.push(`imod(${e[n]}, ${r[n]})`);return o.join()}function id(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{reps:s}=o;if(n.dtype==="string"||n.shape.length>5){let l=e.readSync(n.dataId),c=n.dtype==="string"?l.map(m=>C.decodeString(m)):l,u=j(n.shape,n.dtype,c),p=$w(u,s);return e.makeTensorInfo(p.shape,p.dtype,p.values)}let i=new hp(n.shape,s);return e.runWebGLProgram(i,[n],n.dtype)}var u$={kernelName:$o,backendName:"webgl",kernelFunc:id};var gp=class{constructor(t){this.variableNames=["x","indices"],this.customUniforms=[{name:"n",type:"int"},{name:"firstPass",type:"int"},{name:"negativeInf",type:"float"},{name:"dir",type:"int"},{name:"inc",type:"int"}],this.outputShape=t,this.userCode=`
       void main() {
         ivec2 coords = getOutputCoords();
         int batch = coords[0];
         int elemIdx = coords[1];

         // We compare elements pair-wise within a group of size 2 * inc.
         // The comparing rule for each group alternates between ascending
         // and descending. Within each group, we compare each pair at
         // positions i and i+inc. To decide whether an element at position i
         // is x0 or x1, we mod it by 2 * inc, if the result is smaller than
         // inc, it is in the first half of the group, we denote it as x0,
         // otherwise we denote it as x1.
         // For example, as shown in the Bitonic top K paper referenced above,
         // Figure5(a) shows that element[1] is in the
         // second half of the group when group size is 2, but it is in the
         // first half of the group when group size is 4.

         bool isFirstInPair = imod(elemIdx, 2 * inc) < inc;
         int i = isFirstInPair ? elemIdx : elemIdx - inc;

         int i0 = firstPass == 1 ? i : int(getIndices(batch, i));
         int i1 = firstPass == 1 ? i + inc : int(getIndices(batch, i + inc));
         float x0 = i0 < n ? getX(batch, i0) : negativeInf;
         float x1 = i1 < n ? getX(batch, i1) : negativeInf;

         // Denotes which direction indices are in (ascending or descending).
         bool reverse = imod(elemIdx, 2 * dir) >= dir;
         bool isGreater = x0 > x1 || (x0 == x1 && i1 > i0);
         if (reverse == isGreater) { // Elements in opposite order of direction
           int iTemp = i0;
           i0 = i1;
           i1 = iTemp;
         }
         if (isFirstInPair) {
            setOutput(float(i0));
         } else {
            setOutput(float(i1));
         }
       }
     `}},xp=class{constructor(t){this.variableNames=["x","indices"],this.customUniforms=[{name:"n",type:"int"},{name:"firstPass",type:"int"},{name:"k",type:"int"}],this.outputShape=t,this.userCode=`
    void main() {
         // Takes max of indices (0, k), (1, k + 1), (2, k + 2) ...
         ivec2 coords = getOutputCoords();
         int batch = coords[0];
         int elemIdx = coords[1];

         // The output size is half of the previous size.
         // If the previous sequence is | | | | _ _ _ _  | | | |  _ _ _ _ (k=4),
         // we only need to output the indices at positions |, the indices at
         // positions _ can be thrown away, see Figure5(b) After Phase 2
         // (Merge phase) in the Bitonic Top K paper referenced above.
         // For example, the paper shows we only need to output the orange bars.
         // The output sequence should look like this | | | | | | | |.
         // Because the sequence is halved, to map the output index back
         // to the previous sequence to find the corresponding value,
         // we need to double the index. When we double the index,
         // we basically interpolate a position, so 2i looks like
         // | _ | _ | _ | _ | _ | _ | _. We move the | to the first k position
         // of each 2k positions by - elemIdx % k. E.g. for output at
         // index 4,5,6,7, we want to get the corresponding element at
         // original index 8,9,10,11, for output at index 8,9,10,11,
         // we want to get the corresponding element at original index
         // 16,17,18,19, so on and so forth.

         int i = elemIdx < k ? elemIdx : (elemIdx * 2 - imod(elemIdx, k));
         int i0 = firstPass == 1 ? i : int(getIndices(batch, i));
         int i1 = firstPass == 1 ? i + k : int(getIndices(batch, i + k));

         float x0 = getX(batch, i0);
         float x1 = i1 < n ? getX(batch, i1) : x0;

         setOutput(x0 >= x1 ? float(i0) : float(i1));
       }
     `}};function on(r,t){t!==null&&r.disposeIntermediateTensorInfo(t)}function p$(r){let t=1;for(;t<r;)t*=2;return t}function $O(r){let{inputs:t,backend:e,attrs:o}=r,{x:n}=t,{k:s,sorted:i}=o,a=I().getNumber("TOPK_LAST_DIM_CPU_HANDOFF_SIZE_THRESHOLD"),l=I().getNumber("TOPK_K_CPU_HANDOFF_THRESHOLD"),c=n.shape,u=c[c.length-1];if(e.shouldExecuteOnCPU([n])||u<a||s>l){let O=e.readSync(n.dataId),[B,W]=Sw(O,c,n.dtype,s,i);return[e.makeTensorInfo(B.shape,B.dtype,B.values),e.makeTensorInfo(W.shape,W.dtype,W.values)]}if(s===0)return c[c.length-1]=0,[e.makeTensorInfo(c,n.dtype,[]),e.makeTensorInfo(c,"int32",[])];if(u===1)return[n,wr({attrs:{shape:c,dtype:"int32",value:0},backend:e})];let p=e.texData.get(n.dataId),m=p!==null&&p.isPacked,f=m?e.unpackTensor(n):n,x=C.sizeFromShape(c)/u,g=D({inputs:{x:f},attrs:{shape:[x,u]},backend:e});m&&on(e,f);let b=p$(s),$=p$(u),S=null,E=()=>S===null?[g,g]:[g,S],N=(O,B,W)=>{let J=E(),et=new gp(W),At=[[u],[S===null?1:0],[Number.NEGATIVE_INFINITY],[O],[B]],It=S;S=e.runWebGLProgram(et,J,"int32",At),on(e,It)};for(let O=1;O<b;O*=2){let B=O*2;for(let W=O;W>=1;W/=2)N(B,W,[x,$])}for(let O=$;O>b;O/=2){let B=E(),W=new xp([x,O/2]),et=[[u],[S===null?1:0],[b]],st=S;S=e.runWebGLProgram(W,B,"int32",et),on(e,st);let At=b/2,It=At*2;for(let $t=At;$t>=1;$t/=2)N(It,$t,S.shape)}let R=S;S=Me({inputs:{x:S},backend:e,attrs:{begin:0,size:[x,s]}}),on(e,R);let A=Jf({inputs:{x:g,indices:S},backend:e,attrs:{axis:1,batchDims:1}});on(e,g);let _=c.slice(0,-1);_.push(s),R=S,S=D({inputs:{x:S},attrs:{shape:_},backend:e}),on(e,R);let P=A;return A=D({inputs:{x:A},attrs:{shape:_},backend:e}),on(e,P),[A,S]}var m$={kernelName:ia,backendName:"webgl",kernelFunc:$O};var bp=class{constructor(t,e,o,n,s,i){this.variableNames=["Image","Transforms"],this.outputShape=i;let a=o==="nearest"?1:2,l;switch(n){case"constant":l=1;break;case"reflect":l=2;break;case"wrap":l=3;break;case"nearest":l=4;break;default:l=1;break}this.userCode=`
            float mapCoord(float outCoord, float len) {
              float inCoord = outCoord;
              if(${l} == 2) {
                if (inCoord < 0.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz2 = 2.0 * len;
                    if (inCoord < sz2) {
                      inCoord = sz2 * float(int(float(-inCoord / sz2))) +
                      inCoord;
                    }
                    inCoord = inCoord < -len ? inCoord + sz2 : -inCoord - 1.0;
                  }
                } else if (inCoord > len - 1.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz2 = 2.0 * len;
                    inCoord -= sz2 * float(int(float(inCoord / sz2)));
                    if (inCoord >= len) {
                      inCoord = sz2 - inCoord - 1.0;
                    }
                  }
                }
                return clamp(inCoord, 0.0, len - 1.0);
              } else if (${l} == 3) {
                if (inCoord < 0.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz = len - 1.0;
                    inCoord += len * (float(int(float(-inCoord / sz))) + 1.0);
                  }
                } else if (inCoord > len - 1.0) {
                  if (len <= 1.0) {
                    inCoord = 0.0;
                  } else {
                    float sz = len - 1.0;
                    inCoord -= len * float(int(float(inCoord / sz)));
                  }
                }
                return clamp(inCoord, 0.0, len - 1.0);
              } else if (${l} == 4) {
                return clamp(outCoord, 0.0, len - 1.0);
              } else {
                return outCoord;
              }
            }

            float readWithFillValue(int batch, int coordY, int coordX,
              int channel) {
              float outputValue;
              if (0 <= coordY && coordY < ${t} && 0 <= coordX && coordX < ${e}) {
                  outputValue = getImage(batch, coordY, coordX, channel);
              } else {
                outputValue = float(${s});
              }
              return outputValue;
            }

            void main() {
              ivec4 coords = getOutputCoords();
              float outputValue;
              int batch = coords[0];
              int x = coords[2];
              int y = coords[1];
              int channel = coords[3];
              float xf = float(x);
              float yf = float(y);
              float a1 = getTransforms(batch, 0);
              float a2 = getTransforms(batch, 1);
              float a3 = getTransforms(batch, 2);
              float b1 = getTransforms(batch, 3);
              float b2 = getTransforms(batch, 4);
              float b3 = getTransforms(batch, 5);
              float c1 = getTransforms(batch, 6);
              float c2 = getTransforms(batch, 7);
              float projection = c1 * xf + c2 * yf + 1.0;
              if (projection == 0.0) {
                outputValue = float(${s});
              } else {
                float inX = (a1 * xf + a2 * yf + a3) / projection;
                float inY = (b1 * xf + b2 * yf + b3) / projection;
                float mapX = mapCoord(inX, float(${e}));
                float mapY = mapCoord(inY, float(${t}));

                if (${a} == 1) {
                  int coordY = int(round(mapY));
                  int coordX = int(round(mapX));
                  outputValue = readWithFillValue(batch, coordY, coordX,
                    channel);
                } else {
                  float yFloor = floor(mapY);
                  float xFloor = floor(mapX);
                  float yCeil = yFloor + 1.0;
                  float xCeil = xFloor + 1.0;
                  float valueYFloor = (xCeil - mapX) *
                  readWithFillValue(batch, int(yFloor), int(xFloor), channel) +
                  (mapX - xFloor) *
                  readWithFillValue(batch, int(yFloor), int(xCeil), channel);
                  float valueYCeil = (xCeil - mapX) *
                  readWithFillValue(batch, int(yCeil), int(xFloor), channel) +
                  (mapX - xFloor) *
                  readWithFillValue(batch, int(yCeil), int(xCeil), channel);
                  outputValue = (yCeil - mapY) * valueYFloor +
                  (mapY - yFloor) * valueYCeil;
                }
              }
              setOutput(outputValue);
            }
        `}};function SO(r){let{inputs:t,backend:e,attrs:o}=r,{image:n,transforms:s}=t,{interpolation:i,fillMode:a,fillValue:l,outputShape:c}=o,[u,p,m,f]=n.shape,[d,x]=c??[p,m],g=[u,d,x,f],b=new bp(p,m,i,a,l,g);return e.runWebGLProgram(b,[n,s],"float32")}var f$={kernelName:aa,backendName:"webgl",kernelFunc:SO};function TO(r){let{inputs:t,attrs:e,backend:o}=r,{axis:n}=e,{x:s}=t;or(s,"unique"),console.warn("WARNING: ","UI might be locked temporarily as data is being downloaded");let i=o.readSync(s.dataId),{outputValues:a,outputShape:l,indices:c}=Tw(i,n,s.shape,s.dtype);return[o.makeTensorInfo(l,s.dtype,a),o.makeTensorInfo([c.length],"int32",c)]}var d$={kernelName:la,backendName:"webgl",kernelFunc:TO};function EO(r){let{inputs:t,backend:e,attrs:o}=r,{value:n}=t,{axis:s}=o;s<0&&(s+=n.shape.length);let i=n,a=i.shape.length,l=n.shape[s],c=new Array(a-1),u=0;for(let x=0;x<a;x++)x!==s&&(c[u++]=i.shape[x]);let p=[],m=new Array(a).fill(0),f=i.shape.slice();f[s]=1;let d=new Array(l);for(let x=0;x<d.length;x++){m[s]=x;let g=Me({inputs:{x:i},backend:e,attrs:{begin:m,size:f}}),b=D({inputs:{x:g},backend:e,attrs:{shape:c}});d[x]=b,p.push(g)}return p.forEach(x=>e.disposeIntermediateTensorInfo(x)),d}var h$={kernelName:ca,backendName:"webgl",kernelFunc:EO};var yp=class{constructor(t,e){this.variableNames=["x","segmentIds"];let o=t.windowSize,n=t.batchSize,s=t.inSize,i=t.numSegments,a=i*Math.ceil(s/o);this.outputShape=[n,a];let l="0.0",c="sumValue",u=Math.floor(o/4)*4,p=o%4,m=`
        sumValue += dot(values, segFilter);
    `,f="";s%o>0&&(f=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return initializationValue;
        }
      `);let d="";s%o>0&&(d=`
        if (inIdx < 0 || inIdx >= ${s}) {
          return -1.0;
        }
      `),this.userCode=`
      const float initializationValue = ${l};

      float getValue(int batch, int inIdx) {
        ${f}
        return getX(batch, inIdx);
      }

      float getSegmentIdAtIndex(int inIdx) {
        ${d}
        return getSegmentIds(inIdx);
      }

      void main() {
        ivec2 coords = getOutputCoords();
        int batch = coords[0];
        int outIdx = coords[1];
        int inOffset = int(floor(float(outIdx) / float(
          ${i})) * float(${o}));
        int currentSeg = int(mod(float(outIdx), float(${i})));

        float sumValue = 0.0;

        for (int i = 0; i < ${u}; i += 4) {
          int inIdx = inOffset + i;
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            getValue(batch, inIdx + 3)
          );

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 1)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 2)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 3)) == currentSeg ? 1 : 0
          );

          ${m}
        }

        int inIdx = inOffset + ${u};
        if (${p===1}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            initializationValue,
            initializationValue,
            initializationValue
          );

          int inIdxSeg = int(getSegmentIdAtIndex(inIdx));

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            0,
            0,
            0
          );

          ${m}
        } else if (${p===2}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            initializationValue,
            initializationValue
          );

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 1)) == currentSeg ? 1 : 0,
              0,
              0
          );

          ${m}
        } else if (${p===3}) {
          vec4 values = vec4(
            getValue(batch, inIdx),
            getValue(batch, inIdx + 1),
            getValue(batch, inIdx + 2),
            initializationValue
          );

          vec4 segFilter = vec4(
            int(getSegmentIdAtIndex(inIdx)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 1)) == currentSeg ? 1 : 0,
            int(getSegmentIdAtIndex(inIdx + 2)) == currentSeg ? 1 : 0,
            0
          );

          ${m}
        }
        setOutput(${c});
      }
    `}};function IO(r){let{inputs:t,backend:e,attrs:o}=r,{x:n,segmentIds:s}=t,{numSegments:i}=o,a=n.shape.length,l=[],c=0,u=T.getAxesPermutation([c],a),p=n;u!=null&&(p=mt({inputs:{x:n},backend:e,attrs:{perm:u}}),l.push(p),c=T.getInnerMostAxes(1,a)[0]);let m=T.segment_util.computeOutShape(p.shape,c,i),f=C.sizeFromShape([p.shape[c]]),d=D({inputs:{x:p},backend:e,attrs:{shape:[-1,f]}});l.push(d);let x=Rr(n.dtype),g=(E,N,R,A,_)=>{let P=E.shape[0],O=E.shape[1],B=T.segment_util.segOpComputeOptimalWindowSize(O,_),W={windowSize:B,inSize:O,batchSize:P,numSegments:_},J=new yp(W,N),et=e.compileAndRun(J,[E,R],A);if(l.push(et),et.shape[1]===_)return et;let st=sd({backend:e,attrs:{start:0,stop:_,step:1,dtype:"float32"}}),At=id({inputs:{x:st},backend:e,attrs:{reps:[O/B]}});return l.push(st),l.push(At),g(et,N,At,A,_)},b=g(d,"unsortedSegmentSum",s,x,i),$=D({inputs:{x:b},backend:e,attrs:{shape:m}}),S=$;if(u!=null){l.push($);let E=T.getUndoAxesPermutation(u);S=mt({inputs:{x:S},backend:e,attrs:{perm:E}})}return l.forEach(E=>e.disposeIntermediateTensorInfo(E)),S}var g$={kernelName:ua,backendName:"webgl",kernelFunc:IO};var NO=[Qw,tC,eC,rC,nC,sC,iC,aC,uC,pC,mC,fC,dC,hC,gC,xC,bC,yC,wC,CC,vC,SC,TC,EC,IC,AC,DC,FC,Vw,OC,LC,BC,GC,UC,VC,WC,zC,KC,HC,qC,YC,ZC,QC,JC,tv,ev,rv,ov,nv,sv,iv,av,lv,cv,uv,pv,fv,dv,hv,gv,bv,yv,wv,Cv,vv,$v,Sv,Tv,Ev,Uw,Iv,MC,Nv,kv,Rv,Ww,Av,_v,Dv,Fv,Pv,Ov,Mv,Lv,Bv,Gv,Vv,Wv,zv,Kv,Hv,qv,jv,Zv,Qv,Jv,t1,e1,i1,Hw,a1,l1,c1,u1,NC,p1,d1,h1,g1,x1,zw,b1,y1,w1,C1,v1,kC,r1,$1,S1,T1,Xw,E1,I1,N1,k1,R1,A1,_1,D1,F1,P1,O1,M1,L1,B1,G1,U1,$C,s1,V1,W1,z1,K1,H1,q1,X1,j1,Z1,Q1,t$,e$,r$,o$,n$,s$,i$,n1,Yw,a$,l$,c$,u$,m$,f$,Zw,d$,h$,g$,m1];for(let r of NO)bl(r);window.__SCOUT_TF__=Rc;})();
/*! Bundled license information:

@tensorflow/tfjs-core/dist/backends/backend.js:
@tensorflow/tfjs-core/dist/util_base.js:
@tensorflow/tfjs-core/dist/global_util.js:
@tensorflow/tfjs-core/dist/ops/complex.js:
@tensorflow/tfjs-core/dist/ops/clone.js:
@tensorflow/tfjs-core/dist/ops/add.js:
@tensorflow/tfjs-core/dist/ops/floorDiv.js:
@tensorflow/tfjs-core/dist/ops/div.js:
@tensorflow/tfjs-core/dist/ops/mul.js:
@tensorflow/tfjs-core/dist/ops/add_n.js:
@tensorflow/tfjs-core/dist/ops/all.js:
@tensorflow/tfjs-core/dist/ops/any.js:
@tensorflow/tfjs-core/dist/ops/atan2.js:
@tensorflow/tfjs-core/dist/ops/conv_util.js:
@tensorflow/tfjs-core/dist/ops/reshape.js:
@tensorflow/tfjs-core/dist/ops/avg_pool.js:
@tensorflow/tfjs-core/dist/ops/avg_pool_3d.js:
@tensorflow/tfjs-core/dist/ops/concat.js:
@tensorflow/tfjs-core/dist/ops/mat_mul.js:
@tensorflow/tfjs-core/dist/ops/basic_lstm_cell.js:
@tensorflow/tfjs-core/dist/ops/batch_to_space_nd.js:
@tensorflow/tfjs-core/dist/ops/batchnorm.js:
@tensorflow/tfjs-core/dist/ops/bincount.js:
@tensorflow/tfjs-core/dist/ops/broadcast_to.js:
@tensorflow/tfjs-core/dist/ops/fill.js:
@tensorflow/tfjs-core/dist/ops/conv2d.js:
@tensorflow/tfjs-core/dist/ops/conv2d_backprop_input.js:
@tensorflow/tfjs-core/dist/ops/conv3d.js:
@tensorflow/tfjs-core/dist/ops/conv3d_backprop_input.js:
@tensorflow/tfjs-core/dist/ops/dense_bincount.js:
@tensorflow/tfjs-core/dist/ops/depth_to_space.js:
@tensorflow/tfjs-core/dist/ops/depthwise_conv2d.js:
@tensorflow/tfjs-core/dist/ops/diag.js:
@tensorflow/tfjs-core/dist/ops/dilation2d.js:
@tensorflow/tfjs-core/dist/ops/equal.js:
@tensorflow/tfjs-core/dist/ops/where.js:
@tensorflow/tfjs-core/dist/ops/div_no_nan.js:
@tensorflow/tfjs-core/dist/ops/dot.js:
@tensorflow/tfjs-core/dist/ops/elu.js:
@tensorflow/tfjs-core/dist/ops/max.js:
@tensorflow/tfjs-core/dist/ops/pow.js:
@tensorflow/tfjs-core/dist/ops/expand_dims.js:
@tensorflow/tfjs-core/dist/ops/tile.js:
@tensorflow/tfjs-core/dist/ops/eye.js:
@tensorflow/tfjs-core/dist/ops/greater.js:
@tensorflow/tfjs-core/dist/ops/greater_equal.js:
@tensorflow/tfjs-core/dist/ops/imag.js:
@tensorflow/tfjs-core/dist/ops/leaky_relu.js:
@tensorflow/tfjs-core/dist/ops/less.js:
@tensorflow/tfjs-core/dist/ops/less_equal.js:
@tensorflow/tfjs-core/dist/ops/local_response_normalization.js:
@tensorflow/tfjs-core/dist/ops/sub.js:
@tensorflow/tfjs-core/dist/ops/log_sum_exp.js:
@tensorflow/tfjs-core/dist/ops/logical_and.js:
@tensorflow/tfjs-core/dist/ops/logical_not.js:
@tensorflow/tfjs-core/dist/ops/logical_or.js:
@tensorflow/tfjs-core/dist/ops/logical_xor.js:
@tensorflow/tfjs-core/dist/ops/max_pool.js:
@tensorflow/tfjs-core/dist/ops/max_pool_3d.js:
@tensorflow/tfjs-core/dist/ops/maximum.js:
@tensorflow/tfjs-core/dist/ops/minimum.js:
@tensorflow/tfjs-core/dist/ops/mirror_pad.js:
@tensorflow/tfjs-core/dist/ops/mod.js:
@tensorflow/tfjs-core/dist/ops/moments.js:
@tensorflow/tfjs-core/dist/ops/multinomial.js:
@tensorflow/tfjs-core/dist/ops/not_equal.js:
@tensorflow/tfjs-core/dist/ops/one_hot.js:
@tensorflow/tfjs-core/dist/ops/pad.js:
@tensorflow/tfjs-core/dist/ops/space_to_batch_nd.js:
@tensorflow/tfjs-core/dist/ops/prelu.js:
@tensorflow/tfjs-core/dist/ops/prod.js:
@tensorflow/tfjs-core/dist/ops/rand.js:
@tensorflow/tfjs-core/dist/ops/random_gamma.js:
@tensorflow/tfjs-core/dist/ops/random_normal.js:
@tensorflow/tfjs-core/dist/ops/random_uniform.js:
@tensorflow/tfjs-core/dist/ops/real.js:
@tensorflow/tfjs-core/dist/ops/relu.js:
@tensorflow/tfjs-core/dist/ops/relu6.js:
@tensorflow/tfjs-core/dist/ops/reverse_1d.js:
@tensorflow/tfjs-core/dist/ops/reverse_2d.js:
@tensorflow/tfjs-core/dist/ops/reverse_3d.js:
@tensorflow/tfjs-core/dist/ops/reverse_4d.js:
@tensorflow/tfjs-core/dist/ops/selu.js:
@tensorflow/tfjs-core/dist/ops/spectral/fft.js:
@tensorflow/tfjs-core/dist/ops/spectral/ifft.js:
@tensorflow/tfjs-core/dist/ops/split.js:
@tensorflow/tfjs-core/dist/ops/squared_difference.js:
@tensorflow/tfjs-core/dist/ops/squeeze.js:
@tensorflow/tfjs-core/dist/ops/stack.js:
@tensorflow/tfjs-core/dist/ops/truncated_normal.js:
@tensorflow/tfjs-core/dist/ops/unique.js:
@tensorflow/tfjs-core/dist/ops/unsorted_segment_sum.js:
@tensorflow/tfjs-core/dist/ops/unstack.js:
@tensorflow/tfjs-core/dist/ops/where_async.js:
@tensorflow/tfjs-core/dist/ops/conv2d_backprop_filter.js:
@tensorflow/tfjs-core/dist/ops/depthwise_conv2d_native_backprop_filter.js:
@tensorflow/tfjs-core/dist/ops/depthwise_conv2d_native_backprop_input.js:
@tensorflow/tfjs-core/dist/ops/image/crop_and_resize.js:
@tensorflow/tfjs-core/dist/ops/image/flip_left_right.js:
@tensorflow/tfjs-core/dist/ops/image/rotate_with_offset.js:
@tensorflow/tfjs-core/dist/ops/nonmax_util.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression.js:
@tensorflow/tfjs-core/dist/backends/non_max_suppression_impl.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_async.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_with_score.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_with_score_async.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_padded.js:
@tensorflow/tfjs-core/dist/ops/image/non_max_suppression_padded_async.js:
@tensorflow/tfjs-core/dist/ops/image/resize_bilinear.js:
@tensorflow/tfjs-core/dist/ops/image/resize_nearest_neighbor.js:
@tensorflow/tfjs-core/dist/ops/linalg/band_part.js:
@tensorflow/tfjs-core/dist/ops/linalg/gram_schmidt.js:
@tensorflow/tfjs-core/dist/ops/linalg/qr.js:
@tensorflow/tfjs-core/dist/ops/loss_ops_utils.js:
@tensorflow/tfjs-core/dist/ops/losses/absolute_difference.js:
@tensorflow/tfjs-core/dist/ops/losses/huber_loss.js:
@tensorflow/tfjs-core/dist/ops/losses/log_loss.js:
@tensorflow/tfjs-core/dist/ops/losses/mean_squared_error.js:
@tensorflow/tfjs-core/dist/ops/losses/sigmoid_cross_entropy.js:
@tensorflow/tfjs-core/dist/ops/losses/softmax_cross_entropy.js:
@tensorflow/tfjs-core/dist/ops/ops.js:
@tensorflow/tfjs-core/dist/ops/rotate_util.js:
@tensorflow/tfjs-core/dist/backends/kernel_impls.js:
@tensorflow/tfjs-backend-cpu/dist/utils/binary_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Complex.js:
@tensorflow/tfjs-backend-cpu/dist/utils/zeros_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Identity.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Real.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Cast.js:
@tensorflow/tfjs-backend-cpu/dist/utils/binary_utils.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Add.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Bincount_impl.js:
@tensorflow/tfjs-backend-cpu/dist/utils/unary_impl.js:
@tensorflow/tfjs-backend-cpu/dist/utils/unary_utils.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Concat_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Equal.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/FloorDiv.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GatherV2_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Greater.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GreaterEqual.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Less.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LessEqual.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/LinSpace_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Max_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Maximum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Minimum.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Multiply.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Neg.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/NotEqual.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Transpose_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Prod.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Range_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Scatter_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Slice.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SquaredDifference.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StridedSlice_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sub.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/TopK_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Unique_impl.js:
@tensorflow/tfjs-backend-cpu/dist/shared.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/shared.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Identity.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Complex.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LeakyRelu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Prelu.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/kernel_funcs_utils.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Multiply.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/reshape.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Reshape.js:
@tensorflow/tfjs-backend-webgl/dist/mean_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/reduce.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Transpose_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sum_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Transpose.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchMatMul_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Abs.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Acos.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Acosh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Add.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AddN.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/All.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Any.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/arg_min_max.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ArgMax.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ArgMin.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Asin.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Asinh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Atan.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Atan2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Atanh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPool.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPool3D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPool3DGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/AvgPoolGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchMatMul.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchNorm.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Slice.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BatchToSpaceND.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Bincount.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NotEqual.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Real.js:
@tensorflow/tfjs-backend-webgl/dist/kernel_utils/int.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cast.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Ceil.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ClipByValue.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ComplexAbs.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Imag.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Concat_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Concat.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2D_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2DBackpropFilter.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv2DBackpropInput.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv3D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv3DBackpropFilterV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Conv3DBackpropInputV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cos.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cosh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/CropAndResize.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DenseBincount.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthToSpace.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthwiseConv2dNative.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthwiseConv2dNativeBackpropFilter.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/DepthwiseConv2dNativeBackpropInput.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Diag.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Dilation2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Elu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/EluGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Equal.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Erf.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Exp.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Expm1.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FFT_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FFT.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Fill.js:
@tensorflow/tfjs-backend-webgl/dist/flip_left_right_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FlipLeftRight.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Floor.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FloorDiv.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FusedConv2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FusedDepthwiseConv2D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/GatherNd.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/GatherV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Greater.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/GreaterEqual.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IFFT.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IsFinite.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IsInf.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/IsNaN.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Less.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LessEqual.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LinSpace.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Log.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Log1p.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LogicalAnd.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LogicalNot.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LogicalOr.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LRN.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/LRNGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Max_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Max.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Maximum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPool.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPool3D.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPool3DGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPoolGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPoolWithArgmax_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MaxPoolWithArgmax.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Mean_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Mean.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Min.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Minimum.js:
@tensorflow/tfjs-backend-webgl/dist/mirror_pad_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/mirror_pad_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/MirrorPad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Mod.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RealDiv.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sub.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Softmax.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Multinomial.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Neg.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NonMaxSuppressionV3.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NonMaxSuppressionV4.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/NonMaxSuppressionV5.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/OneHot.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ZerosLike.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/OnesLike.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Pack.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/PadV2.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Pow.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Prod.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Range.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Reciprocal.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Relu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Relu6.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeBilinear.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeBilinearGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeNearestNeighbor.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ResizeNearestNeighborGrad.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Reverse.js:
@tensorflow/tfjs-backend-webgl/dist/rotate_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RotateWithOffset.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Round.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Rsqrt.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ScatterNd.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Select.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Selu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sigmoid.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sign.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sin.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sinh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Softplus.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SpaceToBatchND.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseToDense.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SplitV.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Sqrt.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SquaredDifference.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Step.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StridedSlice.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Tan.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Tanh.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Tile.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/TopK.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Unpack.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/UnsortedSegmentSum.js:
@tensorflow/tfjs-backend-webgl/dist/register_all_kernels.js:
@tensorflow/tfjs-backend-webgl/dist/index.js:
  (**
   * @license
   * Copyright 2020 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/environment.js:
@tensorflow/tfjs-core/dist/util.js:
@tensorflow/tfjs-core/dist/tape.js:
@tensorflow/tfjs-core/dist/tensor.js:
@tensorflow/tfjs-core/dist/types.js:
@tensorflow/tfjs-core/dist/device_util.js:
@tensorflow/tfjs-core/dist/ops/broadcast_util.js:
@tensorflow/tfjs-core/dist/ops/axis_util.js:
@tensorflow/tfjs-core/dist/test_util.js:
@tensorflow/tfjs-core/dist/browser_util.js:
@tensorflow/tfjs-core/dist/ops/concat_util.js:
@tensorflow/tfjs-core/dist/ops/reduce_util.js:
@tensorflow/tfjs-core/dist/index.js:
@tensorflow/tfjs-backend-webgl/dist/tex_util.js:
@tensorflow/tfjs-backend-webgl/dist/webgl_util.js:
@tensorflow/tfjs-backend-webgl/dist/shader_compiler.js:
@tensorflow/tfjs-backend-webgl/dist/gpgpu_math.js:
@tensorflow/tfjs-backend-webgl/dist/gpgpu_util.js:
@tensorflow/tfjs-backend-webgl/dist/gpgpu_context.js:
@tensorflow/tfjs-backend-webgl/dist/texture_manager.js:
@tensorflow/tfjs-backend-webgl/dist/unaryop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/backend_webgl.js:
@tensorflow/tfjs-backend-webgl/dist/binaryop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reduce_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/transpose_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/argminmax_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/pool_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/avg_pool_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/batchnorm_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/slice_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/clip_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/concat_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/crop_and_resize_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_gpu_depthwise.js:
@tensorflow/tfjs-backend-webgl/dist/dilation_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/gather_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/lrn_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/max_pool_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/multinomial_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/onehot_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/pad_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_bilinear_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reverse_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/select_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/strided_slice_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/tile_gpu.js:
  (**
   * @license
   * Copyright 2017 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/log.js:
@tensorflow/tfjs-core/dist/profiler.js:
@tensorflow/tfjs-core/dist/tensor_format.js:
@tensorflow/tfjs-core/dist/tensor_util.js:
@tensorflow/tfjs-core/dist/engine.js:
@tensorflow/tfjs-core/dist/tensor_util_env.js:
@tensorflow/tfjs-core/dist/ops/operation.js:
@tensorflow/tfjs-core/dist/ops/tensor_ops_util.js:
@tensorflow/tfjs-core/dist/ops/tensor.js:
@tensorflow/tfjs-core/dist/io/types.js:
@tensorflow/tfjs-core/dist/globals.js:
@tensorflow/tfjs-core/dist/io/io_utils.js:
@tensorflow/tfjs-core/dist/io/router_registry.js:
@tensorflow/tfjs-core/dist/io/indexed_db.js:
@tensorflow/tfjs-core/dist/io/local_storage.js:
@tensorflow/tfjs-core/dist/io/model_management.js:
@tensorflow/tfjs-core/dist/ops/abs.js:
@tensorflow/tfjs-core/dist/ops/acos.js:
@tensorflow/tfjs-core/dist/ops/acosh.js:
@tensorflow/tfjs-core/dist/ops/asin.js:
@tensorflow/tfjs-core/dist/ops/asinh.js:
@tensorflow/tfjs-core/dist/ops/atan.js:
@tensorflow/tfjs-core/dist/ops/atanh.js:
@tensorflow/tfjs-core/dist/ops/sigmoid.js:
@tensorflow/tfjs-core/dist/ops/slice.js:
@tensorflow/tfjs-core/dist/ops/tanh.js:
@tensorflow/tfjs-core/dist/ops/ceil.js:
@tensorflow/tfjs-core/dist/ops/clip_by_value.js:
@tensorflow/tfjs-core/dist/ops/cos.js:
@tensorflow/tfjs-core/dist/ops/cosh.js:
@tensorflow/tfjs-core/dist/ops/cumsum.js:
@tensorflow/tfjs-core/dist/ops/zeros_like.js:
@tensorflow/tfjs-core/dist/ops/erf.js:
@tensorflow/tfjs-core/dist/ops/scalar.js:
@tensorflow/tfjs-core/dist/ops/sqrt.js:
@tensorflow/tfjs-core/dist/ops/sum.js:
@tensorflow/tfjs-core/dist/ops/norm.js:
@tensorflow/tfjs-core/dist/ops/exp.js:
@tensorflow/tfjs-core/dist/ops/expm1.js:
@tensorflow/tfjs-core/dist/ops/floor.js:
@tensorflow/tfjs-core/dist/ops/gather.js:
@tensorflow/tfjs-core/dist/ops/is_finite.js:
@tensorflow/tfjs-core/dist/ops/is_inf.js:
@tensorflow/tfjs-core/dist/ops/is_nan.js:
@tensorflow/tfjs-core/dist/ops/linspace.js:
@tensorflow/tfjs-core/dist/ops/log.js:
@tensorflow/tfjs-core/dist/ops/log1p.js:
@tensorflow/tfjs-core/dist/gradients.js:
@tensorflow/tfjs-core/dist/ops/neg.js:
@tensorflow/tfjs-core/dist/ops/softplus.js:
@tensorflow/tfjs-core/dist/ops/log_sigmoid.js:
@tensorflow/tfjs-core/dist/ops/max_pool_with_argmax.js:
@tensorflow/tfjs-core/dist/ops/zeros.js:
@tensorflow/tfjs-core/dist/ops/ones.js:
@tensorflow/tfjs-core/dist/ops/ones_like.js:
@tensorflow/tfjs-core/dist/ops/pool.js:
@tensorflow/tfjs-core/dist/ops/rand_util.js:
@tensorflow/tfjs-core/dist/ops/range.js:
@tensorflow/tfjs-core/dist/ops/reciprocal.js:
@tensorflow/tfjs-core/dist/ops/reverse.js:
@tensorflow/tfjs-core/dist/ops/round.js:
@tensorflow/tfjs-core/dist/ops/rsqrt.js:
@tensorflow/tfjs-core/dist/ops/sign.js:
@tensorflow/tfjs-core/dist/ops/sin.js:
@tensorflow/tfjs-core/dist/ops/sinh.js:
@tensorflow/tfjs-core/dist/ops/slice1d.js:
@tensorflow/tfjs-core/dist/ops/slice2d.js:
@tensorflow/tfjs-core/dist/ops/slice3d.js:
@tensorflow/tfjs-core/dist/ops/slice4d.js:
@tensorflow/tfjs-core/dist/ops/softmax.js:
@tensorflow/tfjs-core/dist/ops/spectral/irfft.js:
@tensorflow/tfjs-core/dist/ops/spectral/rfft.js:
@tensorflow/tfjs-core/dist/ops/step.js:
@tensorflow/tfjs-core/dist/ops/strided_slice.js:
@tensorflow/tfjs-core/dist/ops/tan.js:
@tensorflow/tfjs-core/dist/ops/tensor1d.js:
@tensorflow/tfjs-core/dist/ops/tensor2d.js:
@tensorflow/tfjs-core/dist/ops/tensor3d.js:
@tensorflow/tfjs-core/dist/ops/tensor4d.js:
@tensorflow/tfjs-core/dist/ops/tensor5d.js:
@tensorflow/tfjs-core/dist/ops/tensor6d.js:
@tensorflow/tfjs-core/dist/ops/topk.js:
@tensorflow/tfjs-core/dist/ops/variable.js:
@tensorflow/tfjs-core/dist/backends/where_impl.js:
@tensorflow/tfjs-core/dist/ops/boolean_mask.js:
@tensorflow/tfjs-core/dist/ops/transpose.js:
@tensorflow/tfjs-core/dist/ops/moving_average.js:
@tensorflow/tfjs-core/dist/ops/scatter_nd.js:
@tensorflow/tfjs-core/dist/ops/sparse_to_dense.js:
@tensorflow/tfjs-core/dist/ops/gather_nd.js:
@tensorflow/tfjs-core/dist/ops/dropout.js:
@tensorflow/tfjs-core/dist/serialization.js:
@tensorflow/tfjs-core/dist/optimizers/optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adadelta_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adagrad_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adam_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/adamax_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/sgd_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/momentum_optimizer.js:
@tensorflow/tfjs-core/dist/optimizers/rmsprop_optimizer.js:
@tensorflow/tfjs-core/dist/io/browser_files.js:
@tensorflow/tfjs-core/dist/io/weights_loader.js:
@tensorflow/tfjs-core/dist/io/http.js:
@tensorflow/tfjs-core/dist/io/passthrough.js:
@tensorflow/tfjs-core/dist/io/io.js:
@tensorflow/tfjs-core/dist/ops/confusion_matrix.js:
@tensorflow/tfjs-core/dist/math.js:
@tensorflow/tfjs-core/dist/optimizers/optimizer_constructors.js:
@tensorflow/tfjs-core/dist/train.js:
@tensorflow/tfjs-core/dist/ops/array_ops_util.js:
@tensorflow/tfjs-core/dist/ops/selu_util.js:
@tensorflow/tfjs-core/dist/ops/erf_util.js:
@tensorflow/tfjs-core/dist/backends/complex_util.js:
@tensorflow/tfjs-core/dist/ops/segment_util.js:
@tensorflow/tfjs-core/dist/backends/backend_util.js:
@tensorflow/tfjs-backend-webgl/dist/canvas_util.js:
@tensorflow/tfjs-backend-webgl/dist/glsl_version.js:
@tensorflow/tfjs-backend-webgl/dist/shader_compiler_util.js:
@tensorflow/tfjs-backend-webgl/dist/encode_float_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/encode_float_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/encode_matrix_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/encode_matrix_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/packing_util.js:
@tensorflow/tfjs-backend-webgl/dist/pack_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reshape_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/unaryop_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/unpack_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/binaryop_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/mulmat_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/binaryop_complex_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/batchnorm_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/clip_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/complex_abs_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/depth_to_space_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/conv_packed_gpu_depthwise.js:
@tensorflow/tfjs-backend-webgl/dist/conv_backprop_gpu_depthwise.js:
@tensorflow/tfjs-backend-webgl/dist/fft_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FromPixels_utils/from_pixels_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FromPixels_utils/from_pixels_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/lrn_grad_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_bilinear_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_nearest_neighbor_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_nearest_neighbor_backprop_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/scatter_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/segment_gpu.js:
  (**
   * @license
   * Copyright 2018 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/kernel_registry.js:
@tensorflow/tfjs-core/dist/flags.js:
@tensorflow/tfjs-core/dist/platforms/platform_browser.js:
@tensorflow/tfjs-core/dist/platforms/platform_node.js:
@tensorflow/tfjs-core/dist/ops/square.js:
@tensorflow/tfjs-core/dist/ops/dropout_util.js:
@tensorflow/tfjs-core/dist/ops/signal_ops_util.js:
@tensorflow/tfjs-core/dist/ops/in_top_k.js:
@tensorflow/tfjs-core/dist/ops/fused_util.js:
@tensorflow/tfjs-core/dist/ops/fused/conv2d.js:
@tensorflow/tfjs-core/dist/ops/fused/depthwise_conv2d.js:
@tensorflow/tfjs-core/dist/ops/fused/mat_mul.js:
@tensorflow/tfjs-core/dist/ops/fused_ops.js:
@tensorflow/tfjs-core/dist/ops/signal/hamming_window.js:
@tensorflow/tfjs-core/dist/ops/signal/hann_window.js:
@tensorflow/tfjs-core/dist/ops/signal/frame.js:
@tensorflow/tfjs-core/dist/ops/signal/stft.js:
@tensorflow/tfjs-core/dist/backends/non_max_suppression_util.js:
@tensorflow/tfjs-core/dist/io/progress.js:
@tensorflow/tfjs-core/dist/ops/browser.js:
@tensorflow/tfjs-backend-webgl/dist/flags_webgl.js:
@tensorflow/tfjs-backend-webgl/dist/decode_matrix_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/decode_matrix_packed_gpu.js:
@tensorflow/tfjs-backend-cpu/dist/cpu_util.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Tile_impl.js:
@tensorflow/tfjs-backend-webgl/dist/transpose_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/addn_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/addn_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/argminmax_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/slice_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/concat_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/im2col_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/diag_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/fill_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/FromPixels.js:
@tensorflow/tfjs-backend-webgl/dist/lrn_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/pad_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_bilinear_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/resize_nearest_neighbor_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/reverse_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Square.js:
  (**
   * @license
   * Copyright 2019 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/platforms/is_typed_array_browser.js:
@tensorflow/tfjs-core/dist/ops/bitwise_and.js:
@tensorflow/tfjs-core/dist/ops/ensure_shape.js:
@tensorflow/tfjs-core/dist/ops/random_uniform_int.js:
@tensorflow/tfjs-core/dist/ops/image/rgb_to_grayscale.js:
@tensorflow/tfjs-core/dist/ops/string/static_regex_replace.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/BitwiseAnd.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StaticRegexReplace.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BitwiseAnd.js:
@tensorflow/tfjs-backend-webgl/dist/conv_backprop_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/scatter_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StaticRegexReplace.js:
  (**
   * @license
   * Copyright 2023 Google LLC.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/hash_util.js:
@tensorflow/tfjs-core/dist/ops/broadcast_args.js:
@tensorflow/tfjs-core/dist/ops/einsum.js:
@tensorflow/tfjs-core/dist/ops/meshgrid.js:
@tensorflow/tfjs-core/dist/ops/image/grayscale_to_rgb.js:
@tensorflow/tfjs-core/dist/ops/image/transform.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_fill_empty_rows.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_reshape.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_segment_mean.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_segment_sum.js:
@tensorflow/tfjs-core/dist/ops/string/string_n_grams.js:
@tensorflow/tfjs-core/dist/ops/string/string_split.js:
@tensorflow/tfjs-core/dist/ops/string/string_to_hash_bucket_fast.js:
@tensorflow/tfjs-core/dist/ops/slice_util.js:
@tensorflow/tfjs-core/dist/backends/einsum_util.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_fill_empty_rows_util.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_reshape_util.js:
@tensorflow/tfjs-core/dist/ops/sparse/sparse_segment_reduction_util.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/GatherNd_Impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseFillEmptyRows_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseReshape_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/SparseSegmentReduction_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringNGrams_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringSplit_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/StringToHashBucketFast_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/BroadcastArgs.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Einsum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseFillEmptyRows.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseReshape.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseSegmentMean.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SparseSegmentSum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StringNGrams.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StringSplit.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/StringToHashBucketFast.js:
@tensorflow/tfjs-backend-webgl/dist/transform_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Transform.js:
  (**
   * @license
   * Copyright 2021 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/buffer.js:
@tensorflow/tfjs-core/dist/ops/cast.js:
@tensorflow/tfjs-core/dist/ops/print.js:
@tensorflow/tfjs-core/dist/base_side_effects.js:
@tensorflow/tfjs-core/dist/ops/arg_max.js:
@tensorflow/tfjs-core/dist/ops/arg_min.js:
@tensorflow/tfjs-core/dist/ops/min.js:
@tensorflow/tfjs-core/dist/ops/log_softmax.js:
@tensorflow/tfjs-core/dist/ops/mean.js:
@tensorflow/tfjs-core/dist/ops/setdiff1d_async.js:
@tensorflow/tfjs-core/dist/base.js:
@tensorflow/tfjs-backend-webgl/dist/base.js:
  (**
   * @license
   * Copyright 2020 Google Inc. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/cumprod.js:
  (**
   * @license
   * Copyright 2022 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the 'License');
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an 'AS IS' BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/euclidean_norm.js:
@tensorflow/tfjs-core/dist/ops/search_sorted.js:
@tensorflow/tfjs-core/dist/ops/lower_bound.js:
@tensorflow/tfjs-core/dist/ops/ragged_gather.js:
@tensorflow/tfjs-core/dist/ops/ragged_tensor_to_tensor.js:
@tensorflow/tfjs-core/dist/ops/random_standard_normal.js:
@tensorflow/tfjs-core/dist/ops/tensor_scatter_update.js:
@tensorflow/tfjs-core/dist/ops/upper_bound.js:
@tensorflow/tfjs-core/dist/ops/ragged_to_dense_util.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedGather_impl.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedTensorToTensor_impl.js:
@tensorflow/tfjs-backend-webgl/dist/conv_packed_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cum_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cumprod.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Cumsum.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RaggedGather.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RaggedTensorToTensor.js:
@tensorflow/tfjs-backend-webgl/dist/search_sorted_gpu.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/SearchSorted.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/TensorScatterUpdate.js:
  (**
   * @license
   * Copyright 2022 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/ragged_range.js:
@tensorflow/tfjs-core/dist/optimizers/register_optimizers.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/RaggedRange_impl.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/RaggedRange.js:
  (**
   * @license
   * Copyright 2022 Google LLC.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/ops/image/threshold.js:
  (**
   * @license
   * Copyright 2021 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * https://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

@tensorflow/tfjs-core/dist/version.js:
  (** @license See the LICENSE file. *)

@tensorflow/tfjs-backend-cpu/dist/kernels/Abs.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Ceil.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Exp.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Expm1.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Floor.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Log.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Rsqrt.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sigmoid.js:
@tensorflow/tfjs-backend-cpu/dist/kernels/Sqrt.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/_FusedMatMul.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/ExpandDims.js:
@tensorflow/tfjs-backend-webgl/dist/kernels/Unique.js:
  (**
   * @license
   * Copyright 2020 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the License);
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an AS IS BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)
*/
