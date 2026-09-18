'use strict';
var TOKEN_KEY='admin_token_v3';
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

function el(tag,attrs,children){
  var e=document.createElement(tag);
  if(attrs){for(var k in attrs){if(!Object.prototype.hasOwnProperty.call(attrs,k))continue;var v=attrs[k];
    if(k==='class')e.className=v;
    else if(k==='html')e.innerHTML=v;
    else if(k.substr(0,2)==='on'&&typeof v==='function')e.addEventListener(k.slice(2).toLowerCase(),v);
    else if(v===false||v==null){}
    else if(k==='style') e.style.cssText=v;
    else e.setAttribute(k,v);
  }}
  if(children!==undefined){
    if(!Array.isArray(children))children=[children];
    children.forEach(function(c){
      if(c==null||c===false)return;
      if(typeof c==='string'||typeof c==='number')e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
  }
  return e;
}

/* P1-4 — حذف توکن قابل‌خواندن در JavaScript از پنل ادمین.
 *
 * پیش از این، سه تابع getAuthToken() / getCookie() / setAuthToken() وجود داشتند.
 * نکتهٔ مهم این بود که getCookie() کوکی را با document.cookie می‌خواند، ولی کوکی
 * `admin_token_v3` دارای پرچم HttpOnly است — بنابراین document.cookie *هرگز* آن را
 * نمی‌بیند. یعنی آن مسیر عملاً غیرقابل استفاده بود و تنها چیزی که کار می‌کرد
 * fallback به localStorage بود.
 *
 * اکنون احراز هویت ادمین صرفاً بر کوکی HttpOnly استوار است که مرورگر خودش آن را
 * به درخواست‌ها اضافه می‌کند؛ هیچ توکنی در JS نگهداری یا خوانده نمی‌شود.
 * این توابع حذف شدند تا مسیر ناامن دوباره بازسازی نشود.
 */

// Clear authentication
// یک Promise برمی‌گرداند: فراخوان *باید* پیش از reload منتظر بماند، وگرنه مرورگر
// درخواست در حال پرواز را هنگام پیمایش abort می‌کند و کوکی HttpOnly هرگز پاک
// نمی‌شود — در نتیجه کاربر بعد از «خروج» دوباره لاگین می‌ماند.
function clearAuthToken() {
  // پاک‌سازی توکن باقی‌مانده از نسخه‌های قبلی (migration).
  // این تنها اشارهٔ باقی‌مانده به localStorage است و صرفاً removeItem است —
  // هیچ توکنی خوانده یا نوشته نمی‌شود. برای کاربرانی که پیش از این تغییر لاگین
  // کرده‌اند یک JWT زنده در localStorage مانده که باید حذف شود.
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* noop */ }
  // کوکی HttpOnly فقط توسط بک‌اند قابل پاک کردن است
  try {
    return fetch('/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(function () { /* خطای شبکه نباید جلوی خروج را بگیرد */ });
  } catch (e) {
    return Promise.resolve();
  }
}

function toast(msg,kind){var t=el('div',{class:'toast '+(kind||'')},msg);document.body.appendChild(t);setTimeout(function(){t.parentNode&&t.parentNode.removeChild(t)},2600)}
function fmtMoney(n){return(Number(n)||0).toLocaleString('fa-IR')+' تومان'}
function formatPrice(n){ return (Number(n)||0).toLocaleString('fa-IR'); }
function fmtDate(s){try{return new Date(s).toLocaleString('fa-IR', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}catch(e){return s||'—'}}
function badge(s){return '<span class="badge '+esc(s)+'">'+esc(s)+'</span>'}

function api(path,opts){
  opts=opts||{};
  var headers={};
  if(!(opts.body instanceof FormData)) headers['Content-Type']='application/json';
  // P1-4: هیچ هدر Authorization ساخته نمی‌شود و هیچ توکنی از JS خوانده نمی‌شود.
  // احراز هویت ادمین از طریق کوکی HttpOnly `admin_token_v3` انجام می‌شود که
  // مرورگر آن را با credentials:'include' به‌طور خودکار ضمیمه می‌کند.
  // این تنها نقطهٔ ساخت درخواست است (۶۴ فراخوانی در کل پنل)، پس تغییر متمرکز است.
  var fo={method:opts.method||'GET',headers:headers,cache:'no-cache',credentials:'include'};
  if(opts.body!==undefined)fo.body=opts.body;
  return fetch(path,fo).then(function(res){
    if(res.status===401){
      // opts.noReload فقط برای کاوش نشست در bootstrap استفاده می‌شود؛
      // بدون آن، نخستین 401 (کاربر لاگین‌نکرده) باعث reload بی‌پایان می‌شد.
      if(!opts.noReload){Promise.resolve(clearAuthToken()).then(function(){location.reload();});}
      throw new Error('Unauthenticated')
    }
    return res.headers.get('content-type')?.indexOf('json')>=0 ? res.json() : res.text();
  }).then(function(data){
    if(data.error || (data.message && data.statusCode >= 400)) throw new Error(Array.isArray(data.message)?data.message[0]:data.message);
    return data;
  });
}

function uploadFile(path,file){var fd=new FormData();fd.append('file',file);return api(path,{method:'POST',body:fd})}
function secureBlob(path){
  // P1-4: پیش‌تر توکن از localStorage خوانده و به‌صورت Bearer فرستاده می‌شد.
  // اکنون با credentials:'include' کوکی HttpOnly به‌طور خودکار ارسال می‌شود.
  return fetch(path,{credentials:'include',cache:'no-cache'}).then(function(r){return r.ok?r.blob():null}).then(function(b){return b?URL.createObjectURL(b):null});
}