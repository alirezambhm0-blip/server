'use strict';

/* ═══════════════════════════════════════════════════════════════
   ماژول فروش حضوری ویزیتور — بنکو مارکت
   نکته مهم: main هنگام فراخوانی در DOM نیست!
   باید از main.querySelector استفاده شود نه document.getElementById
   ═══════════════════════════════════════════════════════════════ */

var VS = { customer: null, cart: [], products: [], categories: [], viewMode: 'grid', mainEl: null };

/* ─── توابع کمکی ─── */
function vsFa(n) { return String(n).replace(/\d/g, function(d) { return '۰۱۲۳۴۵۶۷۸۹'[Number(d)]; }); }
function vsFmt(n) { return (Number(n) || 0).toLocaleString('fa-IR'); }
function vsEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function vsFind(pid) { for (var i = 0; i < VS.cart.length; i++) { if (VS.cart[i].productId === pid) return VS.cart[i]; } return null; }
function vsQ(id) { return VS.mainEl ? VS.mainEl.querySelector('#' + id) : document.getElementById(id); }

/* ═══════════════════════════════════════════
   ورودی اصلی
   ═══════════════════════════════════════════ */

window.renderVisitorSales = function(main) {
  if (!main) return;
  VS.mainEl = main;
  try {
    main.innerHTML =
      '<div id="vs-tabs" style="display:flex;gap:8px;margin-bottom:20px;background:#fff;padding:8px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.06);">' +
        '<button style="flex:1;padding:10px;border:0;background:#2563eb;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;" id="vs-t1">🛒 کاتالوگ و سفارش</button>' +
        '<button style="flex:1;padding:10px;border:0;background:#f1f5f9;color:#64748b;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;" id="vs-t2">📊 داشبورد فروش</button>' +
        '<button style="flex:1;padding:10px;border:0;background:#f1f5f9;color:#64748b;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;" id="vs-t3">📋 تاریخچه سفارش‌ها</button>' +
      '</div>' +
      '<div id="vs-content"></div>';

    var t1 = vsQ('vs-t1'), t2 = vsQ('vs-t2'), t3 = vsQ('vs-t3'), content = vsQ('vs-content');

    function go(btn, fn) {
      [t1, t2, t3].forEach(function(b) { if (b) { b.style.background = '#f1f5f9'; b.style.color = '#64748b'; } });
      if (btn) { btn.style.background = '#2563eb'; btn.style.color = '#fff'; }
      if (content) { try { fn(content); } catch(e) { content.innerHTML = '<div style="color:#ef4444;padding:40px;text-align:center;">خطا: ' + vsEsc(String(e)) + '</div>'; } }
    }

    if (t1) t1.onclick = function() { go(t1, showCatalog); };
    if (t2) t2.onclick = function() { go(t2, showDashboard); };
    if (t3) t3.onclick = function() { go(t3, showHistory); };

    go(t1, showCatalog);
  } catch (e) {
    main.innerHTML = '<div style="color:#ef4444;padding:40px;text-align:center;">خطا: ' + vsEsc(String(e)) + '</div>';
  }
};

/* ═══════════════════════════════════════════
   تب ۱: کاتالوگ و سفارش
   ═══════════════════════════════════════════ */

function showCatalog(c) {
  c.innerHTML =
    '<div style="display:flex;gap:16px;min-height:60vh;">' +
      '<div style="flex:1;min-width:0;" id="vs-cat-area">' +
        '<div id="vs-cust-bar"></div>' +
        '<div id="vs-tb"></div>' +
        '<div id="vs-prod" style="text-align:center;padding:40px;color:#94A3B8;"><span class="spinner"></span> در حال بارگذاری...</div>' +
      '</div>' +
      '<div style="width:340px;min-width:300px;background:#fff;border-radius:16px;border:1px solid #e2e8f0;display:flex;flex-direction:column;position:sticky;top:80px;max-height:calc(100vh - 100px);overflow:hidden;" id="vs-sidebar"></div>' +
    '</div>' +
    '<div id="vs-float-bar" style="display:none;position:fixed;bottom:0;left:0;right:0;height:56px;background:#0f172a;color:#fff;align-items:center;padding:0 16px;z-index:90;border-radius:12px 12px 0 0;box-shadow:0 -4px 12px rgba(0,0,0,.15);font-size:14px;font-family:inherit;"></div>';

  renderCustBar(vsQ('vs-cust-bar'));
  renderToolbar(vsQ('vs-tb'));
  renderSidebar();
  renderFloatBar();
  loadProducts();
}

/* ─── بارگذاری محصولات ─── */
function loadProducts() {
  var el = vsQ('vs-prod');
  if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><span class="spinner"></span> در حال بارگذاری محصولات...</div>';

  api('/admin/products?all=1&pageSize=500').then(function(res) {
    VS.products = (res.items || res || []).filter(function(p) { return p.isActive !== false; });
    var cats = {};
    for (var i = 0; i < VS.products.length; i++) {
      var cn = (VS.products[i].category && VS.products[i].category.name) ? VS.products[i].category.name : 'سایر';
      if (!cats[cn]) cats[cn] = 0;
      cats[cn]++;
    }
    VS.categories = [];
    for (var k in cats) { if (cats.hasOwnProperty(k)) VS.categories.push({ name: k, count: cats[k] }); }
    renderCatBtns();
    vsRenderProducts(VS.products);
  }).catch(function(err) {
    var el = vsQ('vs-prod');
    if (el) el.innerHTML = '<div style="color:#ef4444;text-align:center;padding:40px;">خطا در بارگذاری محصولات:<br>' + vsEsc(String(err)) + '<br><br><button onclick="loadProducts()" style="margin-top:12px;padding:8px 20px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;background:#fff;font-family:inherit;">تلاش مجدد</button></div>';
  });
}
window.loadProducts = loadProducts;

function renderCatBtns() {
  var el = vsQ('vs-cats');
  if (!el) return;
  var h = '<button style="padding:6px 14px;border:1px solid #2563eb;background:#2563eb;color:#fff;border-radius:20px;cursor:pointer;font-size:12px;white-space:nowrap;font-family:inherit;" data-cat="all" class="vs-cb">همه</button>';
  for (var i = 0; i < VS.categories.length; i++) {
    h += '<button style="padding:6px 14px;border:1px solid #e2e8f0;background:#fff;color:#64748b;border-radius:20px;cursor:pointer;font-size:12px;white-space:nowrap;font-family:inherit;" data-cat="' + vsEsc(VS.categories[i].name) + '" class="vs-cb">' + vsEsc(VS.categories[i].name) + ' (' + VS.categories[i].count + ')</button>';
  }
  el.innerHTML = h;
  var btns = el.querySelectorAll('.vs-cb');
  for (var i = 0; i < btns.length; i++) {
    btns[i].onclick = function() {
      for (var j = 0; j < btns.length; j++) { btns[j].style.background = '#fff'; btns[j].style.color = '#64748b'; btns[j].style.borderColor = '#e2e8f0'; }
      this.style.background = '#2563eb'; this.style.color = '#fff'; this.style.borderColor = '#2563eb';
      doFilter(this.getAttribute('data-cat') === 'all' ? null : this.getAttribute('data-cat'));
    };
  }
}

function doFilter(cat) {
  var si = vsQ('vs-search');
  var q = si ? si.value.trim().toLowerCase() : '';
  var list = [];
  for (var i = 0; i < VS.products.length; i++) {
    var p = VS.products[i];
    var ms = !q || p.name.toLowerCase().indexOf(q) >= 0 || (p.brand && p.brand.toLowerCase().indexOf(q) >= 0);
    var cn = (p.category && p.category.name) ? p.category.name : 'سایر';
    if (ms && (!cat || cn === cat)) list.push(p);
  }
  vsRenderProducts(list);
}

/* ─── نوار ابزار ─── */
function renderToolbar(el) {
  if (!el) return;
  var bg = VS.viewMode === 'grid';
  el.innerHTML =
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">' +
      '<input id="vs-search" placeholder="جست‌وجوی نام محصول..." style="flex:1;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;">' +
      '<button style="padding:8px 12px;border:1px solid ' + (bg ? '#2563eb' : '#e2e8f0') + ';background:' + (bg ? '#2563eb' : '#fff') + ';color:' + (bg ? '#fff' : '#64748b') + ';border-radius:8px;cursor:pointer;font-family:inherit;" id="vs-bg">🔲</button>' +
      '<button style="padding:8px 12px;border:1px solid ' + (!bg ? '#2563eb' : '#e2e8f0') + ';background:' + (!bg ? '#2563eb' : '#fff') + ';color:' + (!bg ? '#fff' : '#64748b') + ';border-radius:8px;cursor:pointer;font-family:inherit;" id="vs-bl">📋</button>' +
    '</div>' +
    '<div id="vs-cats" style="display:flex;gap:8px;overflow-x:auto;padding:8px 0;margin-bottom:12px;"></div>';

  var si = vsQ('vs-search'), bgBtn = vsQ('vs-bg'), blBtn = vsQ('vs-bl');
  if (si) { var t; si.oninput = function() { clearTimeout(t); t = setTimeout(function() { doFilter(null); }, 200); }; }
  if (bgBtn) bgBtn.onclick = function() { VS.viewMode = 'grid'; renderToolbar(vsQ('vs-tb')); doFilter(null); };
  if (blBtn) blBtn.onclick = function() { VS.viewMode = 'list'; renderToolbar(vsQ('vs-tb')); doFilter(null); };
}

/* ─── نمایش محصولات ─── */
function vsRenderProducts(list) {
  var el = vsQ('vs-prod');
  if (!el) return;
  if (!list || list.length === 0) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;">محصولی یافت نشد</div>'; return; }
  var h = '';
  if (VS.viewMode === 'grid') {
    h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">';
    for (var i = 0; i < list.length; i++) h += gridCard(list[i]);
    h += '</div>';
  } else {
    h = '<div>';
    for (var i = 0; i < list.length; i++) h += listRow(list[i]);
    h += '</div>';
  }
  el.innerHTML = h;
}

function gridCard(p) {
  var ic = vsFind(p.id), s = p.stock || 0, d = p.isDiscounted && p.oldPrice && p.oldPrice > p.price;
  var pct = d ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  var b = d ? '<div style="position:absolute;top:0;right:0;background:#ef4444;color:#fff;padding:4px 10px;font-size:12px;font-weight:700;border-radius:0 16px 0 10px;">' + vsFa(pct) + '٪ تخفیف</div>' : (p.isNew ? '<div style="position:absolute;top:0;right:0;background:#2563eb;color:#fff;padding:4px 10px;font-size:12px;font-weight:700;border-radius:0 16px 0 10px;">جدید</div>' : (p.isFeatured ? '<div style="position:absolute;top:0;right:0;background:#10b981;color:#fff;padding:4px 10px;font-size:12px;font-weight:700;border-radius:0 16px 0 10px;">پیشنهادی</div>' : ''));
  var img = p.imageUrl ? '<img src="' + vsEsc(p.imageUrl) + '" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display=\'none\'">' : '<div style="font-size:48px;display:flex;align-items:center;justify-content:center;height:100%;">📦</div>';
  var sw = s === 0 ? '<div style="color:#94A3B8;font-size:11px;margin-top:4px;">ناموجود</div>' : (s <= 5 ? '<div style="color:#F59E0B;font-size:11px;margin-top:4px;">⚠️ فقط ' + vsFa(s) + ' عدد</div>' : '');
  var act = '';
  if (s === 0) act = '<button style="width:100%;padding:10px;border:0;background:#cbd5e1;color:#94A3B8;border-radius:10px;font-weight:700;font-family:inherit;" disabled>ناموجود</button>';
  else if (ic) act = '<div style="display:flex;background:#eff6ff;border-radius:10px;overflow:hidden;"><button style="width:36px;height:36px;border:0;background:transparent;font-size:18px;font-weight:700;cursor:pointer;color:#2563eb;font-family:inherit;" onclick="vsQtyDown(\'' + p.id + '\')">−</button><span style="min-width:36px;text-align:center;font-weight:700;font-size:15px;line-height:36px;">' + vsFa(ic.quantity) + '</span><button style="width:36px;height:36px;border:0;background:transparent;font-size:18px;font-weight:700;cursor:pointer;color:#2563eb;font-family:inherit;" onclick="vsQtyUp(\'' + p.id + '\')">+</button></div>';
  else act = '<button style="width:100%;padding:10px;border:0;background:#2563eb;color:#fff;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;" onclick="vsAdd(\'' + p.id + '\')">افزودن</button>';
  var pr = d ? '<div style="text-decoration:line-through;color:#94A3B8;font-size:12px;">' + vsFmt(p.oldPrice) + '</div><div style="font-size:18px;font-weight:bold;color:#0F172A;">' + vsFmt(p.price) + ' <span style="font-size:12px;font-weight:normal;">تومان</span></div>' : '<div style="font-size:18px;font-weight:bold;color:#0F172A;">' + vsFmt(p.price) + ' <span style="font-size:12px;font-weight:normal;">تومان</span></div>';
  return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;' + (s === 0 ? 'opacity:.5;' : '') + '"><div style="position:relative;width:100%;aspect-ratio:1;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;">' + img + b + '</div><div style="padding:14px;"><div style="font-weight:bold;font-size:14px;color:#0F172A;margin-bottom:4px;text-align:right;min-height:36px;">' + vsEsc(p.name) + '</div><div style="font-size:11px;color:#64748B;text-align:right;">' + vsEsc(p.unit || '') + '</div><div style="margin-top:8px;text-align:right;">' + pr + '</div>' + sw + '<div style="margin-top:10px;">' + act + '</div></div></div>';
}

function listRow(p) {
  var ic = vsFind(p.id), s = p.stock || 0, d = p.isDiscounted && p.oldPrice && p.oldPrice > p.price;
  var img = p.imageUrl ? '<img src="' + vsEsc(p.imageUrl) + '" style="width:56px;height:56px;object-fit:contain;border-radius:8px;background:#f8fafc;">' : '<div style="width:56px;height:56px;border-radius:8px;background:#f8fafc;display:flex;align-items:center;justify-content:center;">📦</div>';
  var pr = d ? '<div style="text-align:left;"><div style="text-decoration:line-through;color:#94A3B8;font-size:11px;">' + vsFmt(p.oldPrice) + '</div><div style="font-weight:bold;font-size:15px;">' + vsFmt(p.price) + ' تومان</div></div>' : '<div style="text-align:left;font-weight:bold;font-size:15px;">' + vsFmt(p.price) + ' تومان</div>';
  var act = '';
  if (s === 0) act = '<span style="color:#94A3B8;font-size:12px;">ناموجود</span>';
  else if (ic) act = '<div style="display:flex;background:#eff6ff;border-radius:8px;overflow:hidden;"><button style="width:32px;height:32px;border:0;background:transparent;font-size:16px;font-weight:700;cursor:pointer;color:#2563eb;font-family:inherit;" onclick="vsQtyDown(\'' + p.id + '\')">−</button><span style="min-width:32px;text-align:center;font-weight:700;font-size:14px;line-height:32px;">' + vsFa(ic.quantity) + '</span><button style="width:32px;height:32px;border:0;background:transparent;font-size:16px;font-weight:700;cursor:pointer;color:#2563eb;font-family:inherit;" onclick="vsQtyUp(\'' + p.id + '\')">+</button></div>';
  else act = '<button style="padding:6px 12px;border:0;background:#2563eb;color:#fff;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;font-family:inherit;" onclick="vsAdd(\'' + p.id + '\')">افزودن</button>';
  return '<div style="display:flex;align-items:center;padding:12px 16px;background:#fff;border-bottom:1px solid #f1f5f9;gap:12px;' + (s === 0 ? 'opacity:.5;' : '') + '">' + img + '<div style="flex:1;padding-right:12px;text-align:right;"><div style="font-weight:600;font-size:14px;">' + vsEsc(p.name) + '</div><div style="font-size:11px;color:#64748B;">' + vsEsc(p.unit || '') + (d ? ' | <span style="color:#EF4444;">تخفیف‌دار</span>' : '') + (s > 0 && s <= 5 ? ' | <span style="color:#F59E0B;">فقط ' + vsFa(s) + ' عدد</span>' : '') + '</div></div>' + pr + '<div style="width:130px;text-align:center;">' + act + '</div></div>';
}

/* ─── نوار مشتری ─── */
function renderCustBar(el) {
  if (!el) return;
  if (VS.customer) {
    el.innerHTML = '<div style="background:#d1fae5;border:1px solid #10b981;border-radius:14px;padding:14px 16px;margin-bottom:16px;"><div style="display:flex;align-items:center;gap:12px;"><span style="font-size:24px;">🏪</span><div style="flex:1;"><div style="font-weight:bold;font-size:15px;">' + vsEsc(VS.customer.storeName) + '</div><div style="font-size:12px;color:#64748B;">' + vsEsc(VS.customer.ownerName) + ' | ' + vsEsc(VS.customer.phone) + '</div><div style="font-size:11px;color:#94A3B8;">' + vsEsc(VS.customer.address) + '</div></div><button style="padding:6px 12px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit;" id="vs-chcust">تغییر مشتری</button></div></div>';
    var btn = vsQ('vs-chcust');
    if (btn) btn.onclick = function() {
      if (VS.cart.length > 0 && !confirm('با تغییر مشتری، سبد خرید خالی می‌شود. ادامه؟')) return;
      VS.customer = null; VS.cart = [];
      renderCustBar(vsQ('vs-cust-bar')); renderSidebar(); renderFloatBar();
    };
  } else {
    el.innerHTML = '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:14px;padding:16px;margin-bottom:16px;"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;"><span style="font-size:24px;">🏪</span><div style="font-weight:bold;font-size:15px;">انتخاب مشتری برای ثبت سفارش</div></div><div style="position:relative;"><input id="vs-cust-search" placeholder="جست‌وجو در مشتریان: نام، شماره تماس، نام فروشگاه... (در میان مشتریان موجود)" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;box-sizing:border-box;"><div id="vs-cust-results" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.12);z-index:50;max-height:300px;overflow-y:auto;display:none;"></div></div><button style="margin-top:10px;padding:8px 16px;border:0;background:#2563eb;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;" id="vs-newcust">+ ثبت مشتری جدید</button></div>';
    var si = vsQ('vs-cust-search'), nb = vsQ('vs-newcust');
    if (si) {
      var timer;
      si.oninput = function() {
        var q = this.value.trim();
        clearTimeout(timer);
        var rd = vsQ('vs-cust-results');
        if (q.length < 2) { if (rd) rd.style.display = 'none'; return; }
        timer = setTimeout(function() {
          api('/admin/customers/search?q=' + encodeURIComponent(q) + '&limit=6').then(function(res) {
            var list = res.customers || [];
            var rd = vsQ('vs-cust-results');
            if (!rd) return;
            if (list.length === 0) { rd.innerHTML = '<div style="padding:16px;text-align:center;color:#94A3B8;">مشتری یافت نشد</div>'; rd.style.display = 'block'; return; }
            var h = '';
            for (var i = 0; i < list.length; i++) {
              var cc = list[i];
              h += '<div style="padding:12px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;" data-id="' + cc.id + '"><div style="font-weight:bold;">' + vsEsc(cc.storeName) + '</div><div style="font-size:11px;color:#64748B;">' + vsEsc(cc.ownerName) + ' | ' + vsEsc(cc.phone) + '</div><div style="font-size:10px;color:#94A3B8;">' + vsEsc(cc.address) + '</div></div>';
            }
            rd.innerHTML = h; rd.style.display = 'block';
            var items = rd.querySelectorAll('[data-id]');
            for (var j = 0; j < items.length; j++) {
              items[j].onclick = function() { vsPickCust(this.getAttribute('data-id')); };
              items[j].onmouseover = function() { this.style.background = '#f8fafc'; };
              items[j].onmouseout = function() { this.style.background = '#fff'; };
            }
          }).catch(function() {});
        }, 300);
      };
    }
    if (nb) nb.onclick = function() { vsNewCust(); };
  }
}

window.vsPickCust = function(id) {
  api('/admin/customers/' + id).then(function(c) {
    VS.customer = {
      id: c.id, storeName: c.storeName || '—',
      ownerName: [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
      phone: (c.user && c.user.phone) ? c.user.phone : '—',
      address: [c.province, c.city, c.address].filter(Boolean).join('، ') || '—',
    };
    VS.cart = [];
    renderCustBar(vsQ('vs-cust-bar')); renderSidebar(); renderFloatBar();
      }).catch(function(e) { toast('خطا: ' + vsEsc(String(e)), 'err'); });
};

window.vsNewCust = function() {
  openModal('ثبت مشتری جدید (حضوری)', function(body, close) {
    body.innerHTML = '<div style="direction:rtl;text-align:right;"><div class="field"><label>نام فروشگاه: *</label><input id="vn-store"></div><div class="field"><label>نام صاحب فروشگاه: *</label><input id="vn-name"></div><div class="field"><label>شماره تماس: *</label><input id="vn-phone" type="tel" maxlength="11"></div><div class="field"><label>نوع کسب‌وکار:</label><select id="vn-type"><option>سوپرمارکت</option><option>بقالی</option><option>هایپرمارکت</option><option>عمده‌فروشی</option><option>سایر</option></select></div><div class="field"><label>آدرس: *</label><textarea id="vn-addr" rows="2"></textarea></div><div style="margin:12px 0;padding:10px;background:#D1FAE5;border-radius:8px;font-size:12px;">☑ مشتری احراز هویت حضوری شده (تایید خودکار توسط ویزیتور)</div><button class="primary" style="width:100%;height:45px;" id="vn-submit">ثبت و انتخاب مشتری</button></div>';
    var btn = body.querySelector('#vn-submit');
    if (btn) btn.onclick = function() {
      var s = body.querySelector('#vn-store'), n = body.querySelector('#vn-name'), p = body.querySelector('#vn-phone'), a = body.querySelector('#vn-addr'), t = body.querySelector('#vn-type');
      if (!s || !n || !p || !a) return;
      if (!s.value.trim() || !n.value.trim() || !p.value.trim() || !a.value.trim()) { toast('فیلدهای ستاره‌دار الزامی است', 'err'); return; }
      if (!/^09\d{9}$/.test(p.value.trim())) { toast('شماره موبایل نامعتبر', 'err'); return; }
      api('/admin/customers', { method: 'POST', body: JSON.stringify({ storeName: s.value.trim(), firstName: n.value.trim().split(' ')[0] || n.value.trim(), lastName: n.value.trim().split(' ').slice(1).join(' ') || '—', phone: p.value.trim(), businessType: t ? t.value : 'سایر', city: a.value.trim().split('،')[0] || '', address: a.value.trim() }) }).then(function(c) { toast('مشتری ثبت شد', 'ok'); close(); vsPickCust(c.id); }).catch(function(e) { toast('خطا: ' + vsEsc(String(e)), 'err'); });
    };
  });
};

/* ─── سبد خرید ─── */
function doRefresh() { doFilter(null); renderSidebar(); renderFloatBar(); }

window.vsAdd = function(pid) {
  var p = null; for (var i = 0; i < VS.products.length; i++) { if (VS.products[i].id === pid) { p = VS.products[i]; break; } }
  if (!p || p.stock <= 0) return;
  VS.cart.push({ productId: p.id, name: p.name, price: p.isDiscounted ? p.price : (p.oldPrice || p.price), quantity: 1, stock: p.stock });
  doRefresh();
};
window.vsQtyUp = function(pid) { var it = vsFind(pid); if (!it || it.quantity >= it.stock) return; it.quantity++; doRefresh(); };
window.vsQtyDown = function(pid) {
  var it = vsFind(pid); if (!it) return; it.quantity--;
  if (it.quantity <= 0) { var n = []; for (var i = 0; i < VS.cart.length; i++) { if (VS.cart[i].productId !== pid) n.push(VS.cart[i]); } VS.cart = n; }
  doRefresh();
};
window.vsRem = function(pid) { var n = []; for (var i = 0; i < VS.cart.length; i++) { if (VS.cart[i].productId !== pid) n.push(VS.cart[i]); } VS.cart = n; doRefresh(); };
window.vsClear = function() { if (!confirm('سبد خرید خالی شود؟')) return; VS.cart = []; doRefresh(); };

/* ─── سایدبار سبد ─── */
function renderSidebar() {
  var el = vsQ('vs-sidebar');
  if (!el) return;
  if (!VS.customer) { el.innerHTML = '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;"><div style="font-size:40px;margin-bottom:12px;">🏪</div><div style="color:#64748B;">ابتدا مشتری را انتخاب کنید</div></div>'; return; }
  if (VS.cart.length === 0) {
    el.innerHTML = '<div style="padding:16px;border-bottom:1px solid #e2e8f0;"><div style="font-weight:bold;font-size:16px;">سبد خرید</div><div style="font-size:12px;color:#2563EB;">' + vsEsc(VS.customer.storeName) + '</div></div><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;"><div style="font-size:40px;margin-bottom:12px;">🛒</div><div style="color:#64748B;">هنوز محصولی اضافه نشده</div></div>';
    return;
  }
  var sub = 0, qty = 0;
  for (var i = 0; i < VS.cart.length; i++) { sub += VS.cart[i].price * VS.cart[i].quantity; qty += VS.cart[i].quantity; }
  var ih = '';
  for (var i = 0; i < VS.cart.length; i++) {
    var it = VS.cart[i];
    ih += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f1f5f9;gap:8px;"><div style="flex:1;text-align:right;"><div style="font-weight:600;font-size:13px;">' + vsEsc(it.name) + '</div><div style="font-size:11px;color:#64748B;">' + vsFa(it.quantity) + ' × ' + vsFmt(it.price) + ' = ' + vsFmt(it.price * it.quantity) + ' تومان</div></div><div style="display:flex;align-items:center;gap:6px;"><div style="display:flex;background:#eff6ff;border-radius:8px;overflow:hidden;"><button style="width:28px;height:28px;border:0;background:transparent;font-size:14px;font-weight:700;cursor:pointer;color:#2563eb;font-family:inherit;" onclick="vsQtyDown(\'' + it.productId + '\')">−</button><span style="min-width:28px;text-align:center;font-weight:700;font-size:13px;line-height:28px;">' + vsFa(it.quantity) + '</span><button style="width:28px;height:28px;border:0;background:transparent;font-size:14px;font-weight:700;cursor:pointer;color:#2563eb;font-family:inherit;" onclick="vsQtyUp(\'' + it.productId + '\')">+</button></div><button style="background:none;border:0;cursor:pointer;font-size:16px;opacity:.5;font-family:inherit;" onclick="vsRem(\'' + it.productId + '\')">🗑</button></div></div>';
  }
  el.innerHTML =
    '<div style="padding:16px;border-bottom:1px solid #e2e8f0;"><div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:bold;font-size:16px;">سبد خرید</div><div style="font-size:12px;color:#2563EB;">' + vsEsc(VS.customer.storeName) + '</div></div><button style="padding:4px 8px;border:1px solid #fecaca;background:#fff;color:#ef4444;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit;" onclick="vsClear()">خالی کردن</button></div></div>' +
    '<div style="flex:1;overflow-y:auto;">' + ih + '</div>' +
    '<div style="background:#f8fafc;padding:14px 16px;border-top:1px solid #e2e8f0;"><div style="display:flex;justify-content:space-between;font-size:13px;color:#64748B;margin-bottom:6px;"><span>اقلام:</span><span>' + vsFa(VS.cart.length) + ' قلم</span></div><div style="display:flex;justify-content:space-between;font-size:13px;color:#64748B;margin-bottom:6px;"><span>تعداد:</span><span>' + vsFa(qty) + ' عدد</span></div><div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#2563eb;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:4px;"><span>جمع کل:</span><span>' + vsFmt(sub) + ' تومان</span></div></div>' +
    '<div style="padding:12px 16px;"><div class="field"><label>یادداشت ویزیتور:</label><textarea id="vs-vnote" rows="2" placeholder="یادداشت داخلی..."></textarea></div><div class="field"><label>یادداشت مشتری:</label><textarea id="vs-cnote" rows="2" placeholder="درخواست خاص مشتری..."></textarea></div></div>' +
    '<div style="padding:0 16px 16px;"><button style="width:100%;padding:14px;border:0;background:#10b981;color:#fff;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;" onclick="vsSubmit()">ثبت سفارش</button></div>';
}

/* ─── نوار شناور موبایل ─── */
function renderFloatBar() {
  var el = vsQ('vs-float-bar');
  if (!el) return;
  if (VS.cart.length === 0 || !VS.customer) { el.style.display = 'none'; return; }
  var qty = 0, total = 0;
  for (var i = 0; i < VS.cart.length; i++) { qty += VS.cart[i].quantity; total += VS.cart[i].price * VS.cart[i].quantity; }
  el.style.display = 'flex';
  el.innerHTML = '<div style="flex:1;display:flex;align-items:center;gap:8px;"><span>🛒</span><span>' + vsFa(qty) + ' قلم | ' + vsFmt(total) + ' تومان</span></div><button style="padding:8px 16px;border:0;background:#2563eb;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;" onclick="vsShowCart()">مشاهده سبد</button>';
}

window.vsShowCart = function() {
  openModal('سبد خرید', function(body) {
    var sb = vsQ('vs-sidebar');
    body.innerHTML = sb ? sb.innerHTML : '<div style="text-align:center;padding:40px;color:#94A3B8;">سبد خالی است</div>';
  });
};

/* ─── ثبت سفارش ─── */
window.vsSubmit = function() {
  if (!VS.customer) { toast('ابتدا مشتری را انتخاب کنید', 'err'); return; }
  if (VS.cart.length === 0) { toast('سبد خالی است', 'err'); return; }
  var sub = 0, qty = 0;
  for (var i = 0; i < VS.cart.length; i++) { sub += VS.cart[i].price * VS.cart[i].quantity; qty += VS.cart[i].quantity; }

  openModal('تایید ثبت سفارش', function(body, close) {
    body.innerHTML = '<div style="direction:rtl;text-align:right;padding:10px;"><div style="text-align:center;margin-bottom:20px;"><div style="font-size:48px;">📋</div><div style="font-size:18px;font-weight:bold;margin-top:8px;">تایید ثبت سفارش</div></div><div style="background:#F8FAFC;border-radius:12px;padding:16px;margin-bottom:16px;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#64748B;">مشتری:</span><span style="font-weight:bold;">' + vsEsc(VS.customer.storeName) + '</span></div><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#64748B;">تعداد اقلام:</span><span style="font-weight:bold;">' + vsFa(qty) + ' عدد</span></div><div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">مبلغ نهایی:</span><span style="font-weight:bold;color:#2563EB;font-size:18px;">' + vsFmt(sub) + ' تومان</span></div></div><div style="display:flex;gap:10px;"><button class="ghost" style="flex:1;height:44px;" id="vs-xbtn">انصراف</button><button class="primary" style="flex:2;height:44px;background:#10B981;" id="vs-okbtn">✅ تایید و ثبت</button></div></div>';
    var xb = body.querySelector('#vs-xbtn'), ob = body.querySelector('#vs-okbtn');
    if (xb) xb.onclick = function() { close(); };
    if (ob) ob.onclick = function() {
      ob.disabled = true; ob.innerHTML = '<span class="spinner"></span> در حال ثبت...';
      var vn = vsQ('vs-vnote'), cn = vsQ('vs-cnote');
      var items = []; for (var i = 0; i < VS.cart.length; i++) items.push({ productId: VS.cart[i].productId, quantity: VS.cart[i].quantity });
      api('/visitor/orders', { method: 'POST', body: JSON.stringify({ customerId: VS.customer.id, items: items, visitorNote: vn ? vn.value : undefined, customerNote: cn ? cn.value : undefined }) }).then(function(order) { close(); showSuccess(order); }).catch(function(e) { toast('خطا: ' + vsEsc(String(e)), 'err'); ob.disabled = false; ob.innerHTML = '✅ تایید و ثبت'; });
    };
  });
};

function showSuccess(order) {
  openModal('✅ سفارش ثبت شد', function(body) {
    body.innerHTML = '<div style="direction:rtl;text-align:center;padding:20px;"><div style="font-size:64px;margin-bottom:16px;">✅</div><div style="font-size:20px;font-weight:bold;margin-bottom:8px;">سفارش با موفقیت ثبت شد</div><div style="background:#F8FAFC;border-radius:12px;padding:16px;margin:20px 0;text-align:right;"><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#64748B;">شماره سفارش:</span><span style="font-weight:bold;color:#2563EB;">#' + vsEsc(order.orderNumber) + '</span></div><div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:#64748B;">مشتری:</span><span style="font-weight:bold;">' + vsEsc(VS.customer ? VS.customer.storeName : '—') + '</span></div><div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">مبلغ:</span><span style="font-weight:bold;">' + vsFmt(order.totalAmount) + ' تومان</span></div></div><div style="display:flex;flex-direction:column;gap:10px;"><button class="primary" style="height:48px;" onclick="window.vsOpenInvoice(' + order.id + ')">🖨 چاپ فاکتور A5</button><button class="ghost" style="height:44px;" onclick="vsNewOrd()">🛒 ثبت سفارش جدید</button></div></div>';
  });
}

window.vsNewOrd = function() {
  VS.cart = []; VS.customer = null;
  var modals = document.querySelectorAll('.modal');
  for (var i = 0; i < modals.length; i++) { var btn = modals[i].querySelector('.close'); if (btn) btn.click(); }
  var content = vsQ('vs-content');
  if (content) showCatalog(content);
};

/* ─── باز کردن فاکتور A5 (با توکن) ───
   مسیر /admin/orders/:id/invoice-print JWT + نقش ADMIN دارد؛
   window.open مستقیم هدر Authorization را ارسال نمی‌کند و خطای 401 می‌گیرد.
   لذا HTML را از طریق api() (که توکن را می‌فرستد) می‌گیریم و در تب جدید نمایش می‌دهیم. */
window.vsOpenInvoice = function(orderId) {
  if (!orderId) { toast('شناسه سفارش نامعتبر است', 'err'); return; }
  var w = window.open('', '_blank');
  if (!w) { toast('لطفاً مسیردهنده‌ی pop-up را فعال کنید (اجازه‌ی پنجره‌های بازشو را بدهید)', 'warn'); return; }
  w.document.write('<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#64748b;">در حال آماده‌سازی فاکتور...</div>');

  api('/admin/orders/' + orderId + '/invoice-print').then(function(html) {
    var h = String(html || '');
    if (h.indexOf('<!DOCTYPE') < 0) {
      throw new Error('سرور HTML فاکتور را برنگرداند — پاسخ: ' + (h ? h.slice(0, 160) : '(خالی)'));
    }
    w.document.open();
    w.document.write(h);
    w.document.close();

    // بررسی اینکه واقعاً فاکتور رندر شده یا نه (تشخیص خطای بی‌صدا)
    setTimeout(function() {
      try {
        if (!w || w.closed) return;
        var pages = w.document.querySelectorAll('.invoice-a5-page').length;
        if (!pages) {
          w.document.body.innerHTML =
            '<div style="font-family:sans-serif;direction:rtl;padding:48px 30px;text-align:center;color:#0f172a;">' +
            '<div style="font-size:44px;margin-bottom:14px;">⚠️</div>' +
            '<div style="font-size:20px;font-weight:bold;margin-bottom:12px;">فاکتور رندر نشد</div>' +
            '<div style="color:#64748b;font-size:13px;line-height:2.1;">' +
            'سرور در حال ارسال نسخه‌ای از قالب است که با داده‌ی این سفارش به خطا می‌خورد. ' +
            'این دستورها را روی سرور اجرا و دوباره تلاش کنید:' +
            '<br><code style="direction:ltr;display:inline-block;background:#f1f5f9;padding:4px 10px;border-radius:6px;margin-top:8px;">rm -rf dist &amp;&amp; npm run build &amp;&amp; npm run start:prod</code>' +
            '<br><span style="font-size:12px;color:#94a3b8;">سپس کش مرورگر را با Ctrl+Shift+R پاک کنید.</span>' +
            '</div></div>';
        }
      } catch (e) {}
    }, 350);
  }).catch(function(e) {
    if (w && !w.closed) { try { w.close(); } catch (_) {} }
    toast('خطا در نمایش فاکتور: ' + vsEsc(String(e.message || e)), 'err');
  });
};

/* ═══════════════════════════════════════════
   تب ۲: داشبورد فروش
   ═══════════════════════════════════════════ */

function showDashboard(c) {
  if (!c) return;
  c.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><span class="spinner"></span> در حال بارگذاری...</div>';
  api('/admin/visitor-sales/dashboard').then(function(data) {
    if (!c) return;
    c.innerHTML =
      '<h3 style="margin:0 0 20px;">داشبورد فروش حضوری</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:30px;">' +
        dashCard('📅 امروز', data.today) + dashCard('📆 این هفته', data.thisWeek) + dashCard('🗓 این ماه', data.thisMonth) +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;">' +
        '<div style="font-weight:bold;font-size:15px;margin-bottom:12px;">سفارش‌های اخیر</div>' +
        (data.recentOrders.length === 0 ? '<div style="text-align:center;padding:20px;color:#94A3B8;">سفارشی ثبت نشده</div>' : (function() {
          var h = '';
          for (var i = 0; i < data.recentOrders.length; i++) {
            var o = data.recentOrders[i];
            h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div><span style="font-weight:bold;color:#2563EB;">#' + vsEsc(o.orderNumber) + '</span> | ' + vsEsc(o.customerName) + '</div><div style="font-weight:bold;">' + vsFmt(o.totalAmount) + ' تومان</div></div><div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:#64748B;"><span>' + vsEsc(o.placedAtRelative) + '</span><span class="badge ' + vsEsc(o.status) + '">' + vsEsc(o.statusLabelFa) + '</span></div></div>';
          }
          return h;
        })()) +
      '</div>';
  }).catch(function(e) { if (c) c.innerHTML = '<div style="color:#ef4444;text-align:center;padding:40px;">خطا: ' + vsEsc(String(e)) + '</div>'; });
}

function dashCard(title, s) {
  var amount = s.totalAmount >= 1000000 ? (s.totalAmount / 1000000).toFixed(1).replace('.0', '') + ' م.ت' : vsFmt(s.totalAmount) + ' تومان';
  return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;"><div style="font-size:12px;color:#64748B;font-weight:bold;margin-bottom:8px;">' + title + '</div><div style="font-size:28px;font-weight:bold;color:#0F172A;margin-bottom:12px;">' + vsFa(s.ordersCount) + ' سفارش</div><div style="font-size:13px;color:#64748B;line-height:2;">💰 ' + amount + '<br>👥 ' + vsFa(s.customersServed) + ' مشتری<br>📦 ' + vsFa(s.itemsSold) + ' قلم</div></div>';
}

/* ═══════════════════════════════════════════
   تب ۳: تاریخچه سفارش‌ها
   ═══════════════════════════════════════════ */

function showHistory(c, page) {
  if (!c) return;
  page = page || 1;
  c.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;"><span class="spinner"></span> در حال بارگذاری...</div>';
  api('/admin/visitor-sales/orders?page=' + page + '&pageSize=20').then(function(res) {
    if (!c) return;
    var list = res.data || [], meta = res.meta || {};
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="margin:0;">تاریخچه سفارش‌های حضوری</h3><div style="font-size:12px;color:#64748B;">' + vsFa(meta.total || 0) + ' سفارش</div></div>';
    if (list.length === 0) { h += '<div style="text-align:center;padding:40px;color:#94A3B8;">سفارش حضوری ثبت نشده</div>'; }
    else {
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:8px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div><span style="font-weight:bold;color:#2563EB;">#' + vsEsc(o.orderNumber) + '</span> <span style="background:#7C3AED;color:#FFF;font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;">حضوری</span> ' + vsEsc(o.customerName) + '</div><div style="font-weight:bold;">' + vsFmt(o.totalAmount) + ' تومان</div></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;"><div style="font-size:12px;color:#64748B;">' + vsEsc(o.placedAtShamsi) + ' | ' + vsFa(o.itemsCount) + ' قلم' + (o.placedByName ? ' | ثبت‌کننده: ' + vsEsc(o.placedByName) : '') + '</div><div style="display:flex;gap:6px;align-items:center;"><span class="badge ' + vsEsc(o.status) + '">' + vsEsc(o.statusLabelFa) + '</span><button class="ghost" style="font-size:11px;padding:4px 10px;" onclick="window.vsOpenInvoice(' + o.id + ')">🖨 فاکتور</button></div></div></div>';
      }
    }
    if (meta.lastPage > 1) {
      h += '<div style="text-align:center;margin-top:16px;">';
      if (page > 1) h += '<button class="ghost" onclick="vsGoPage(' + (page - 1) + ')">صفحه قبل</button> ';
      h += '<span style="margin:0 12px;color:#64748B;">صفحه ' + vsFa(page) + ' از ' + vsFa(meta.lastPage) + '</span>';
      if (page < meta.lastPage) h += '<button class="ghost" onclick="vsGoPage(' + (page + 1) + ')">صفحه بعد</button>';
      h += '</div>';
    }
    c.innerHTML = h;
  }).catch(function(e) { if (c) c.innerHTML = '<div style="color:#ef4444;text-align:center;padding:40px;">خطا: ' + vsEsc(String(e)) + '</div>'; });
}

window.vsGoPage = function(page) {
  var content = vsQ('vs-content');
  if (content) showHistory(content, page);
};
