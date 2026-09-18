'use strict';

/* =================== State & Initialization =================== */
// P1-4: پیش‌تر `token` از localStorage خوانده می‌شد. اکنون هیچ توکنی در JS نگهداری
// نمی‌شود؛ وضعیت ورود با کاوش نشست از سرور تعیین می‌شود (bootstrapSession انتهای فایل).
var state = { view: 'dashboard', authed: false };

function render() {
  var root = $('#root');
  root.innerHTML = '';
  if (!state.authed) {
    root.appendChild(renderLogin());
    return;
  }
  root.appendChild(renderLayout());
}

/* =================== Login =================== */
function renderLogin() {
  var wrap = el('div', { class: 'login-wrap' });
  wrap.innerHTML = '<h2>ورود مدیریت بنکو</h2><div id="err" class="error" style="display:none"></div><input id="phone" placeholder="شماره موبایل ادمین"><button id="send" class="primary" style="width:100%; margin-top:10px;">ارسال کد تایید</button>';
  var btn = $('#send', wrap), inp = $('#phone', wrap), err = $('#err', wrap);
  btn.onclick = function() {
    api('/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone: inp.value }) }).then(function(r) {
      var code = prompt('کد تایید تستی: ' + (r.testCode || ''));
      if(!code) return;
      return api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: inp.value, code: code }) });
    }).then(function(v) {
      if(!v) return;
      if (v.user.role !== 'ADMIN') throw new Error('شما دسترسی مدیریت ندارید');
      // P1-4: توکن در JS ذخیره نمی‌شود. بک‌اند کوکی HttpOnly `admin_token_v3` را در
      // پاسخ همین درخواست ست کرده و مرورگر نگهداری می‌کند.
      // توجه: accessToken عمداً از پاسخ حذف نشده، چون اپلیکیشن موبایل همان
      // endpoint را مصرف می‌کند (wholesale-mobile/src/api/authApi.ts:35).
      state.authed = true;
      render();
    }).catch(function(e) { err.textContent = e.message; err.style.display = 'block'; });
  };
  return wrap;
}

/* =================== Layout =================== */
function navItem(viewKey, label) {
  return el('button', {
    class: state.view === viewKey ? 'active' : '',
    onclick: function() { state.view = viewKey; render(); }
  }, label);
}

function renderLayout() {
  var header = el('header', null, [
    el('h1', null, 'پنل مدیریت بنکو'),
    el('nav', null, [
      navItem('dashboard', 'داشبورد'),
      navItem('customers', 'مشتریان'),
      navItem('orders', 'سفارش‌ها'),
      navItem('visitor-sales', 'فروش حضوری 🛍'),
      navItem('products', 'محصولات'),
      navItem('categories', 'دسته‌ها'),
      navItem('banners', 'بنرها'),
      navItem('tickets', 'تیکت‌ها'),
      navItem('notifications', 'اعلان‌ها'),
      navItem('security', 'امنیت'),
      navItem('settings', 'تنظیمات'),
      el('button', { class: 'logout', onclick: function() {
        // P1-4: باید منتظر پاک شدن کوکی در سرور بمانیم؛ reload فوری درخواست را
        // abort می‌کرد و کوکی HttpOnly زنده می‌ماند.
        Promise.resolve(clearAuthToken()).then(function() { location.reload(); });
      } }, 'خروج')
    ])
  ]);
  var main = el('main', { class: 'tab-pane' });
  var wrap = el('div', null, [header, main]);

  if (state.view === 'dashboard') renderDashboard(main);
  else if (state.view === 'visitor-sales') renderVisitorSales(main);
  else if (state.view === 'customers') renderCustomers(main);
  else if (state.view === 'orders') renderOrders(main);
  else if (state.view === 'products') renderProducts(main);
  else if (state.view === 'categories') renderCategories(main);
  else if (state.view === 'banners') renderBanners(main);
  else if (state.view === 'tickets') renderTickets(main);
  else if (state.view === 'notifications') renderNotifications(main);
  else if (state.view === 'security') renderSecurity(main);
  else if (state.view === 'settings') renderSettings(main);

  return wrap;
}

function openModal(title, build) {
  var back = el('div', { class: 'modal-backdrop', onclick: function(ev) { if (ev.target === back) close(); } });
  var body = el('div');
  var box = el('div', { class: 'modal' }, [
    el('button', { class: 'modal-close', onclick: close }, '×'),
    el('h2', { style: 'text-align:right; margin-bottom:20px;' }, title),
    body
  ]);
  back.appendChild(box);
  document.body.appendChild(back);
  function close() { if (back.parentNode) back.parentNode.removeChild(back); }
  build(body, close);
}

/* =================== View Renderers =================== */

// function renderDashboard(main) {
//   main.innerHTML = '<div class="empty">در حال تحلیل داده‌های مالی...</div>';
//   api('/admin/dashboard').then(function(s) {
//     main.innerHTML = '';
//     var c = s.counts;
    
//     // ۱. ردیف کارت‌های آماری جدید و زیبا
//     var cards = el('div', { class: 'cards' });
//     cards.appendChild(el('div', { class: 'card revenue' }, [el('div', { class: 'label' }, '💰 فروش کل (وصول شده)'), el('div', { class: 'value' }, fmtMoney(s.revenue))]));
//     cards.appendChild(el('div', { class: 'card profit' }, [el('div', { class: 'label' }, '📈 سود خالص پیش‌بینی شده'), el('div', { class: 'value' }, fmtMoney(s.profit))]));
//     cards.appendChild(el('div', { class: 'card pending' }, [el('div', { class: 'label' }, '⌛ سفارشات در جریان'), el('div', { class: 'value' }, c.pendingOrders + ' عدد')]));
//     cards.appendChild(el('div', { class: 'card' }, [el('div', { class: 'label' }, '👤 کل مشتریان'), el('div', { class: 'value' }, c.customers + ' نفر')]));
//     main.appendChild(cards);

//     // ۲. بخش‌های پایینی (محصولات رو به اتمام + تحلیل خرید)
//     var sections = el('div', { class: 'dashboard-sections' });
    
//     // الف) محصولات رو به اتمام
//     var lowStockSection = el('div', { class: 'dash-section' }, [el('h3', null, '⚠️ هشدار اتمام موجودی')]);
//     api('/admin/products?all=1&pageSize=500').then(res => {
//       var low = (res.items || []).filter(p => p.stock < 10);
//       if(low.length) {
//         var html = '<table><thead><tr><th>محصول</th><th>موجودی</th></tr></thead><tbody>';
//         low.slice(0, 8).forEach(p => { html += '<tr><td>' + esc(p.name) + '</td><td style="color:#ef4444; font-weight:bold;">' + p.stock + '</td></tr>'; });
//         lowStockSection.innerHTML += html + '</tbody></table>';
//       } else { lowStockSection.innerHTML += '<p class="muted">موجودی انبار در وضعیت سبز قرار دارد.</p>'; }
//     });

//     // ب) تحلیل سریع هزینه‌ها
//     var costSection = el('div', { class: 'dash-section' }, [
//       el('h3', null, '📊 خلاصه وضعیت مالی'),
//       el('div', { style: 'margin-bottom:15px;' }, [el('label', null, 'کل مخارج خرید کالا:'), el('div', { style: 'font-size:18px; color:#64748b;' }, fmtMoney(s.cost))]),
//       el('div', null, [el('label', null, 'نسبت سود به فروش:'), el('div', { style: 'font-size:18px; color:#059669;' }, Math.round((s.profit / s.revenue) * 100 || 0) + ' درصد')])
//     ]);

//     sections.appendChild(lowStockSection);
//     sections.appendChild(costSection);
//     main.appendChild(sections);
//   });
// }

/* =================== داشبورد پیشرفته مالی و عملیاتی =================== */
function renderDashboard(main) {
  main.innerHTML = '<div class="empty"><span class="spinner"></span> در حال تحلیل دقیق داده‌های مالی و موجودی...</div>';
  
  api('/admin/dashboard').then(function(s) {
    main.innerHTML = '';
    var c = s.counts;
    
    // ۱. ردیف کارت‌های آماری جدید و زیبا
    var cards = el('div', { class: 'cards' });
    
    // کارت فروش کل
    cards.appendChild(el('div', { class: 'card revenue' }, [
      el('div', { class: 'label' }, '💰 فروش کل (وصول شده)'), 
      el('div', { class: 'value' }, fmtMoney(s.revenue)),
      el('div', { class: 'muted', style: 'font-size:10px; margin-top:5px;' }, (s.counts.paidOrdersCount || 0) + ' سفارش نهایی')
    ]));
    
    // کارت سود خالص
    cards.appendChild(el('div', { class: 'card profit' }, [
      el('div', { class: 'label' }, '📈 سود خالص پیش‌بینی شده'), 
      el('div', { class: 'value' }, fmtMoney(s.profit))
    ]));
    
    // کارت سفارشات در جریان (مقدار اولیه از آمار پیش‌فرض؛ سپس با لیست سفارشات همگام می‌شود تا با هشدار هم‌تعریف باشد)
    var pendingCardVal = el('div', { class: 'value' }, (c.pendingOrders || 0) + ' عدد');
    cards.appendChild(el('div', { class: 'card pending' }, [
      el('div', { class: 'label' }, '⌛ سفارشات در جریان'), 
      pendingCardVal
    ]));
    
    // کارت تعداد مشتریان
    cards.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'label' }, '👤 کل مشتریان فعال'), 
      el('div', { class: 'value' }, c.customers + ' نفر')
    ]));
    
    main.appendChild(cards);

    // ۱.۵) هشدار سفارشات در جریان (تمام وضعیت‌ها بجز DELIVERED و CANCELLED)
    var progressSection = el('div', { class: 'dash-section dash-inprogress' }, [
      el('h3', null, '⚠️ هشدار سفارشات در جریان')
    ]);
    var ORDER_LABEL = { PENDING: 'در انتظار', CONFIRMED: 'تایید شده', PROCESSING: 'در حال پردازش', SHIPPED: 'ارسال شده' };
    api('/admin/orders?pageSize=500').then(function(res) {
      var all = (res && res.items) || (Array.isArray(res) ? res : []);
      var active = all.filter(function(o) {
        return ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].indexOf(o.status) >= 0;
      });
      active.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      // همگام‌سازی کارت «سفارشات در جریان» با همان تعریفِ هشدار (PENDING/CONFIRMED/PROCESSING/SHIPPED)
      if (pendingCardVal) pendingCardVal.textContent = active.length.toLocaleString('fa-IR') + ' عدد';

      if (!active.length) {
        progressSection.innerHTML += '<p class="muted" style="padding:22px; text-align:center;">✅ هیچ سفارشی در جریان نیست؛ همه‌ی فرآیندها نهایی شده‌اند.</p>';
        return;
      }

      var total = active.reduce(function(sum, o) { return sum + (Number(o.totalAmount) || 0); }, 0);
      var by = {};
      active.forEach(function(o) { by[o.status] = (by[o.status] || 0) + 1; });
      var stOrder = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'];
      var chips = stOrder.map(function(st) {
        return by[st] ? '<span class="badge ' + st + '">' + ORDER_LABEL[st] + ' · ' + by[st].toLocaleString('fa-IR') + '</span>' : '';
      }).join('');

      var rows = active.slice(0, 30).map(function(o) {
        var cust;
        if (o.customerId && o.customer) {
          cust = esc(o.customer.storeName || '—') + ' <span class="o-muted">· ' + esc(((o.customer.firstName || '') + ' ' + (o.customer.lastName || '')).trim() || '') + '</span>';
        } else {
          cust = esc(o.guestName || 'مشتری متفرقه') + ' <span class="o-muted">· ' + esc(o.guestPhone || '—') + '</span>';
        }
        return '<tr>' +
          '<td><span class="badge ' + o.status + '">' + (ORDER_LABEL[o.status] || esc(o.status)) + '</span></td>' +
          '<td class="o-num">' + esc(o.orderNumber || '—') + '</td>' +
          '<td>' + cust + '</td>' +
          '<td class="o-muted">' + fmtDate(o.createdAt) + '</td>' +
          '<td class="o-amt">' + fmtMoney(o.totalAmount) + '</td>' +
        '</tr>';
      }).join('');

      var more = active.length > 30
        ? '<div class="o-more">و ' + (active.length - 30).toLocaleString('fa-IR') + ' سفارش دیگر در جریان است...</div>'
        : '';

      progressSection.innerHTML +=
        '<div class="dash-progress-strip">' +
          '<div class="dp-stat"><span class="dp-num">' + active.length.toLocaleString('fa-IR') + '</span><span class="dp-lbl">سفارش در جریان</span></div>' +
          '<div class="dp-divider"></div>' +
          '<div class="dp-stat"><span class="dp-num">' + fmtMoney(total) + '</span><span class="dp-lbl">جمع کل سفارشات در جریان</span></div>' +
          '<div class="dp-chips">' + chips + '</div>' +
          '<button class="ghost" onclick="state.view=&#39;orders&#39;; render();">مشاهده همه سفارش‌ها ⬅</button>' +
        '</div>' +
        '<div class="dash-order-body"><table class="dash-order-table"><thead><tr>' +
          '<th style="width:14%">وضعیت</th><th style="width:16%">شماره سفارش</th><th style="width:30%">مشتری / فروشگاه</th><th style="width:22%">تاریخ</th><th style="width:18%">مبلغ</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' + more + '</div>';
    }).catch(function() {
      if (pendingCardVal) pendingCardVal.textContent = (c.pendingOrders || 0) + ' عدد';
      progressSection.innerHTML += '<p class="muted" style="padding:18px; text-align:center;">خطا در دریافت سفارشات در جریان.</p>';
    });
    main.appendChild(progressSection);

    // ۲. بخش‌های پایینی (محصولات رو به اتمام + تحلیل خرید)
    var sections = el('div', { class: 'dashboard-sections' });
    
    // الف) کانتینر محصولات رو به اتمام
    var lowStockSection = el('div', { class: 'dash-section' }, [
      el('h3', null, '⚠️ هشدار اتمام موجودی')
    ]);
    
    // بارگذاری لیست محصولات و فیلتر کردن موارد بحرانی
    api('/admin/products?all=1&pageSize=500').then(function(res) {
      var low = (res.items || []).filter(function(p) { return p.stock < 10; });
      if(low.length) {
        var html = '<table class="dash-lowstock-table"><thead><tr><th>نام محصول</th><th>موجودی</th><th>وضعیت</th></tr></thead><tbody>';
        low.slice(0, 8).forEach(function(p) {
          var critical = p.stock <= 2;
          html += '<tr>' +
            '<td>' + esc(p.name) + '</td>' +
            '<td class="ls-count' + (critical ? ' critical' : '') + '">' + p.stock + '</td>' +
            '<td><span class="badge ' + (critical ? 'critical' : 'lowstock') + '">' + (critical ? 'بحرانی' : 'نیاز به تامین') + '</span></td>' +
          '</tr>';
        });
        lowStockSection.innerHTML += html + '</tbody></table>';
      } else {
        lowStockSection.innerHTML += '<p class="muted" style="padding:20px; text-align:center;">✅ موجودی انبار در وضعیت سبز قرار دارد.</p>';
      }
    });

    // ب) بخش خلاصه وضعیت مالی و هزینه‌ها
    var costSection = el('div', { class: 'dash-section' }, [
      el('h3', null, '📊 خلاصه وضعیت مالی'),
      el('div', { class: 'dash-fin-box dash-fin-cost' }, [
        el('label', { class: 'dash-fin-label' }, 'کل مخارج خرید کالا (بهای تمام شده):'), 
        el('div', { class: 'dash-fin-val' }, fmtMoney(s.cost))
      ]),
      el('div', { class: 'dash-fin-box dash-fin-profit' }, [
        el('label', { class: 'dash-fin-label' }, 'نسبت سود به کل فروش:'), 
        el('div', { class: 'dash-fin-val' }, Math.round((s.profit / s.revenue) * 100 || 0) + ' درصد')
      ]),
      el('p', { class: 'muted', style: 'margin-top:15px; font-size:11px;' }, '💡 این آمار فقط بر اساس سفارشات "تسویه شده" محاسبه شده است.')
    ]);

    sections.appendChild(lowStockSection);
    sections.appendChild(costSection);
    main.appendChild(sections);
    
    }).catch(function(e) {
    main.innerHTML = '<div class="error">خطا در بارگذاری داشبورد: ' + esc(e.message) + '</div>';
  });
}






/* ======================== مدیریت پیشرفته مشتریان ========================== */

function renderCustomers(main) {
  main.innerHTML = 
    '<div class="toolbar" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">' +
      '<h2>👥 مدیریت و احراز هویت مشتریان</h2>' +
      '<div style="display:flex; gap:15px;">' +
        // --- بخش اضافه شده: دکمه افزودن مشتری ---
        '<button class="primary" id="add-c-btn" style="background:#059669; margin-left:10px;">+ افزودن مشتری جدید</button>' +
        // ---------------------------------------
        '<select id="cfilter" style="padding:8px; border-radius:6px; border:1px solid #ddd;">' +
          '<option value="">تمامی وضعیت‌ها</option>' +
          '<option value="PENDING">⌛ در انتظار تایید</option>' +
          '<option value="APPROVED">✅ تایید شده</option>' +
          '<option value="REJECTED">❌ رد شده</option>' +
          '<option value="BLOCKED">🚫 مسدود شده</option>' +
        '</select>' +
        '<input id="csearch" placeholder="جستجوی نام، فروشگاه یا شماره..." style="width:350px;">' +
        '<button class="primary" id="cbtn">🔍 جستجو</button>' +
      '</div>' +
    '</div>' +
    '<div id="ctable"></div>' +
    '<div id="cpagination" style="margin-top:15px; text-align:center;"></div>';

  var tbl = $('#ctable', main), inp = $('#csearch', main), flt = $('#cfilter', main);
  var curPage = 1;

  function load(page) {
    curPage = page || 1;
    tbl.innerHTML = '<div class="empty"><span class="spinner"></span> در حال فراخوانی لیست مشتریان...</div>';
    var url = '/admin/customers?page=' + curPage + '&search=' + inp.value + '&status=' + flt.value;
    
    api(url).then(function(res) {
      var items = res.items || [];
      if(!items.length) {
        tbl.innerHTML = '<div class="empty">هیچ مشتری‌ای با این مشخصات یافت نشد.</div>';
        return;
      }

      var html = '<table><thead><tr>' +
        '<th>#</th><th>نام فروشگاه</th><th>نام و نام خانوادگی</th><th>شماره همراه</th><th>تاریخ ثبت‌نام</th><th>وضعیت</th><th>عملیات</th>' +
        '</tr></thead><tbody>';

      items.forEach(function(c, idx) {
        var fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'تکمیل نشده';
        html += '<tr>' +
          '<td>' + ((curPage-1)*20 + idx + 1) + '</td>' +
          '<td><strong>' + esc(c.storeName || '—') + '</strong></td>' +
          '<td>' + esc(fullName) + '</td>' +
          '<td><code style="font-size:12px;">' + esc(c.user?.phone || '—') + '</code></td>' +
          '<td><small>' + fmtDate(c.createdAt) + '</small></td>' +
          '<td>' + badge(c.status) + '</td>' +
          '<td>' +
            '<button class="primary" onclick="window.vCust(\'' + c.id + '\')">🔎 بررسی مدارک</button> ' +
            // --- دکمه ویرایش اضافه شده ---
            '<button class="ghost" onclick="window.eCust(\'' + c.id + '\')" title="ویرایش اطلاعات">✏️ ویرایش</button> ' +
            // ---------------------------
            '<button class="danger" onclick="window.dCust(\'' + c.id + '\')" title="حذف کامل از دیتابیس">🗑️</button>' +
          '</td>' +
        '</tr>';
      });
      tbl.innerHTML = html + '</tbody></table>';
      
      window.vCust = id => openCustomerDetail(id, load);
      // --- اتصال تابع ویرایش ---
      window.eCust = id => openEditCustomerForm(id, load);
      // -------------------------
      window.dCust = id => { if(confirm('⚠️ هشدار: با این کار تمامی سوابق، سفارشات و حساب کاربری این مشتری برای همیشه پاک خواهد شد. مایلید ادامه دهید؟')) api('/admin/customers/'+id+'/hard',{method:'DELETE'}).then(() => load(curPage)); };
    });
  }

  $('#cbtn', main).onclick = () => load(1);
  flt.onchange = () => load(1);
  inp.onkeypress = (e) => { if(e.key === 'Enter') load(1); };
  $('#add-c-btn', main).onclick = () => openAddCustomerForm(load);

  load(1);
}
/* ======================== تابع جدید: ویرایش اطلاعات مشتری ========================== */

function openEditCustomerForm(id, onSaved) {
  openModal('✏️ ویرایش اطلاعات مشتری', function(body, close) {
    body.innerHTML = '<div class="empty"><span class="spinner"></span> در حال دریافت اطلاعات...</div>';
    
    api('/admin/customers/' + id).then(function(c) {
      body.innerHTML = 
        '<div class="grid2" style="direction:rtl; text-align:right;">' +
          '<div class="field"><label>نام</label><input id="ef-fn" value="' + esc(c.firstName || '') + '"></div>' +
          '<div class="field"><label>نام خانوادگی</label><input id="ef-ln" value="' + esc(c.lastName || '') + '"></div>' +
          '<div class="field"><label>نام فروشگاه</label><input id="ef-sn" value="' + esc(c.storeName || '') + '"></div>' +
          '<div class="field"><label>تلفن ثابت</label><input id="ef-ll" value="' + esc(c.landline || '') + '"></div>' +
          '<div class="field"><label>نوع صنف</label><input id="ef-bt" value="' + esc(c.businessType || '') + '"></div>' +
          '<div class="field"><label>شهر</label><input id="ef-ct" value="' + esc(c.city || '') + '"></div>' +
          '<div class="field"><label>کد ملی</label><input id="ef-nc" value="' + esc(c.nationalCode || '') + '"></div>' +
          '<div class="field"><label>کد پستی</label><input id="ef-pc" value="' + esc(c.postalCode || '') + '"></div>' +
          '<div class="field" style="grid-column: span 2;"><label>آدرس دقیق</label><textarea id="ef-ad" style="min-height:50px;">' + esc(c.address || '') + '</textarea></div>' +
        '</div>' +
        '<button class="primary" style="width:100%; margin-top:20px; background:#2563eb;" id="ef-save">💾 ذخیره تغییرات</button>';

      $('#ef-save', body).onclick = function() {
        var data = {
          firstName: $('#ef-fn', body).value, lastName: $('#ef-ln', body).value,
          storeName: $('#ef-sn', body).value, landline: $('#ef-ll', body).value,
          businessType: $('#ef-bt', body).value, city: $('#ef-ct', body).value,
          nationalCode: $('#ef-nc', body).value, postalCode: $('#ef-pc', body).value,
          address: $('#ef-ad', body).value
        };

        this.disabled = true;
        api('/admin/customers/' + id, { method: 'PUT', body: JSON.stringify(data) }).then(() => {
          toast('اطلاعات مشتری به‌روزرسانی شد', 'ok');
          close();
          onSaved();
        }).catch(e => {
          alert(esc(e.message));
          this.disabled = false;
        });
      };
    });
  });
}
// تابع openAddCustomerForm شما بدون تغییر...

function openAddCustomerForm(onSaved) {
  openModal('➕ افزودن مشتری جدید (ثبت دستی)', function(body, close) {
    body.innerHTML = 
      '<div class="grid2" style="direction:rtl; text-align:right;">' +
        '<div class="field"><label>نام *</label><input id="af-fn"></div>' +
        '<div class="field"><label>نام خانوادگی *</label><input id="af-ln"></div>' +
        '<div class="field"><label>نام فروشگاه *</label><input id="af-sn"></div>' +
        '<div class="field"><label>شماره همراه (برای لاگین) *</label><input id="af-ph" placeholder="0912XXXXXXX"></div>' +
        '<div class="field"><label>نوع صنف *</label><input id="af-bt"></div>' +
        '<div class="field"><label>شهر *</label><input id="af-ct"></div>' +
        '<div class="field"><label>کد ملی (اختیاری)</label><input id="af-nc"></div>' +
        '<div class="field"><label>تلفن ثابت (اختیاری)</label><input id="af-ll"></div>' +
        '<div class="field"><label>کد پستی (اختیاری)</label><input id="af-pc"></div>' +
        '<div class="field" style="grid-column: span 2;"><label>آدرس دقیق *</label><textarea id="af-ad" style="min-height:50px;"></textarea></div>' +
        '<div class="field" style="grid-column: span 2;"><label>یادداشت مدیریت (اختیاری)</label><textarea id="af-nt" style="min-height:50px;"></textarea></div>' +
      '</div>' +
      '<button class="primary" style="width:100%; margin-top:20px; height:45px; background:#059669;" id="af-save">✅ ثبت و تایید نهایی مشتری</button>';

    $('#af-save', body).onclick = function() {
      var data = {
        firstName: $('#af-fn', body).value, lastName: $('#af-ln', body).value,
        storeName: $('#af-sn', body).value, phone: $('#af-ph', body).value,
        businessType: $('#af-bt', body).value, city: $('#af-ct', body).value,
        nationalCode: $('#af-nc', body).value, landline: $('#af-ll', body).value,
        postalCode: $('#af-pc', body).value, address: $('#af-ad', body).value,
        notes: $('#af-nt', body).value
      };
      if(!data.firstName || !data.lastName || !data.storeName || !data.phone || !data.city || !data.address) {
        return alert('لطفاً تمامی فیلدهای ستاره‌دار را تکمیل کنید.');
      }
      this.disabled = true;
      api('/admin/customers', { method: 'POST', body: JSON.stringify(data) }).then(() => {
        toast('مشتری با موفقیت ثبت شد', 'ok'); close(); onSaved();
      }).catch(e => { alert(esc(e.message)); this.disabled = false; });
    };
  });
}
// تابع openCustomerDetail شما بدون تغییر...

function openCustomerDetail(id, onChanged) {
  openModal('📄 شناسنامه کامل و مدارک مشتری', function(body, close) {
    body.innerHTML = '<div class="empty"><span class="spinner"></span> در حال استخراج جزئیات...</div>';
    api('/admin/customers/' + id).then(function(c) {
      var fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
      var u = c.user || {};
      body.innerHTML = 
        '<div class="cust-detail-expanded" style="direction:rtl; text-align:right;">' +
          '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:10px; border:1px solid #e2e8f0;">' +
            '<div><h4>👤 اطلاعات شخصی</h4>' +
              '<p><label>نام و نام خانوادگی:</label> ' + esc(fullName) + '</p>' +
              '<p><label>کد ملی:</label> ' + esc(c.nationalCode || '—') + '</p>' +
              '<p><label>شماره همراه:</label> ' + esc(u.phone || '—') + '</p>' +
              '<p><label>تلفن ثابت:</label> ' + esc(c.landline || '—') + '</p></div>' +
            '<div><h4>🏬 اطلاعات کسب‌وکار</h4>' +
              '<p><label>نام فروشگاه:</label> <strong>' + esc(c.storeName || '—') + '</strong></p>' +
              '<p><label>نوع صنف/فعالیت:</label> ' + esc(c.businessType || '—') + '</p>' +
              '<p><label>وضعیت حساب:</label> ' + badge(c.status) + '</p>' +
              '<p><label>تاریخ عضویت:</label> ' + fmtDate(c.createdAt) + '</p></div>' +
          '</div>' +
          '<div style="margin-bottom:20px; background:#fff; padding:15px; border:1px solid #e2e8f0; border-radius:10px;">' +
            '<h4>📍 اطلاعات جغرافیایی و آدرس</h4>' +
            '<p><label>استان و شهر:</label> ' + esc(c.province || '—') + '، ' + esc(c.city || '—') + '</p>' +
            '<p><label>آدرس دقیق:</label> ' + esc(c.address || '—') + '</p>' +
            '<p><label>کد پستی:</label> ' + esc(c.postalCode || '—') + '</p>' +
            (c.latitude ? '<p><label>موقعیت روی نقشه:</label> <a href="https://www.google.com/maps?q=' + c.latitude + ',' + c.longitude + '" target="_blank" style="color:#2563eb; font-weight:bold;">📍 مشاهده در نقشه گوگل</a></p>' : '') +
          '</div>' +
          '<h4>🖼️ مدارک و تصاویر ارسالی</h4>' +
          '<div id="kyc-imgs" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:15px; margin-bottom:25px;"></div>' +
          '<div class="admin-notes" style="margin-top:15px;"><label>📝 یادداشت مدیریت / دلیل رد:</label>' +
            '<textarea id="c-notes" style="width:100%; min-height:60px; margin-top:5px; border-radius:6px; padding:10px;">' + esc(c.notes || '') + '</textarea></div>' +
          '<div class="toolbar" style="margin-top:20px; border-top:1px solid #eee; padding-top:20px; display:flex; gap:10px; justify-content:center;">' +
            '<button class="success" id="btn-approve" style="padding:10px 30px;">✅ تایید حساب</button>' +
            '<button class="danger" id="btn-reject" style="padding:10px 30px;">❌ رد مدارک</button>' +
            '<button class="ghost" id="btn-block" style="border-color:#64748b; color:#64748b;">' + (c.status === 'BLOCKED' ? '🔓 رفع مسدودیت' : '🚫 مسدود سازی حساب') + '</button></div>' +
        '</div>';

      var imgBox = $('#kyc-imgs', body);
      var kycLabels = { nationalCardImage: 'کارت ملی', businessLicenseImage: 'پروانه کسب', storefrontImage: 'نمای فروشگاه', selfieWithIdCardImage: 'سلفی با کارت ملی' };
      Object.keys(kycLabels).forEach(function(f) {
        if(c[f]) {
          var container = el('div', { style: 'border:1px solid #ddd; padding:8px; border-radius:10px; text-align:center; background:#fff;' });
          var ph = el('div', { id: 'ph-'+f, style: 'height:120px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; border-radius:6px; overflow:hidden;' }, 'در حال بارگذاری...');
          container.appendChild(ph);
          container.appendChild(el('div', { style: 'font-size:11px; margin-top:8px; font-weight:bold; color:#475569;' }, kycLabels[f]));
          imgBox.appendChild(container);
          secureBlob('/files/kyc/' + c[f]).then(url => { 
            if(url) $('#ph-'+f, container).innerHTML = '<img src="'+url+'" style="width:100%; height:100%; object-fit:cover; cursor:zoom-in;" onclick="window.open(\''+url+'\')">';
            else $('#ph-'+f, container).innerHTML = '<span style="color:#ef4444; font-size:10px;">خطا در لود</span>';
          });
        } else {
          imgBox.appendChild(el('div', { style: 'border:1px dashed #ccc; padding:20px; border-radius:10px; text-align:center; color:#94a3b8; font-size:11px;' }, kycLabels[f] + ' ارساال نشده'));
        }
      });

      $('#btn-approve', body).onclick = () => api('/admin/customers/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:'APPROVED', notes: $('#c-notes', body).value})}).then(()=>{ toast('مشتری تایید شد','ok'); close(); onChanged(); });
      $('#btn-reject', body).onclick = () => {
        var reason = $('#c-notes', body).value.trim();
        if(!reason) return alert('لطفاً دلیل رد مدارک را در بخش یادداشت بنویسید.');
        api('/admin/customers/'+id+'/status',{method:'PATCH',body:JSON.stringify({status:'REJECTED', notes: reason})}).then(()=>{ toast('مدارک رد شدند','ok'); close(); onChanged(); });
      };
      $('#btn-block', body).onclick = () => {
        var newStatus = c.status === 'BLOCKED' ? 'APPROVED' : 'BLOCKED';
        if(confirm('آیا مایل به تغییر وضعیت مسدودیت کاربر هستید؟'))
          api('/admin/customers/'+id+'/status',{method:'PATCH',body:JSON.stringify({status: newStatus})}).then(()=>{ toast('وضعیت تغییر یافت','ok'); close(); onChanged(); });
      };
    });
  });
}






/* =================== ۴. بخش دسته‌بندی‌ها (تکمیل شده) =================== */
function renderCategories(main) {
  main.innerHTML = 
    '<div class="toolbar" style="justify-content:space-between;"> ' +
      '<h2>مدیریت دسته‌بندی‌ها</h2>' +
      '<button class="primary" id="add-category-btn" style="background:#059669;">+ افزودن دسته‌بندی جدید</button>' +
    '</div>' +
    '<div id="ctable"></div>';

  function load() {
    $('#ctable', main).innerHTML = '<div class="empty"><span class="spinner"></span> در حال بارگذاری...</div>';
    api('/admin/categories?all=1').then(function(res) {
      var list = res.items || [];
      if (!list.length) {
        $('#ctable', main).innerHTML = '<div class="empty">دسته‌بندی‌ای ثبت نشده است.</div>';
        return;
      }

      var html = '<table><thead><tr><th>#</th><th>تصویر</th><th>نام دسته‌بندی</th><th>نام مستعار (slug)</th><th>ترتیب</th><th>وضعیت</th><th>تعداد کالا</th><th>عملیات</th></tr></thead><tbody>';
      list.forEach(function(c, i) {
        var img = c.imageUrl ? '<img src="' + esc(c.imageUrl) + '" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">' : '<div style="width:40px; height:40px; background:#f1f5f9; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:10px;">—</div>';
        var statusBadge = c.isActive ? '<span class="badge APPROVED">فعال</span>' : '<span class="badge REJECTED">غیرفعال</span>';
        
        html += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + img + '</td>' +
          '<td><strong>' + esc(c.name) + '</strong></td>' +
          '<td><small class="muted">' + esc(c.slug) + '</small></td>' +
          '<td>' + esc(c.sortOrder || 0) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + esc(c._count?.products || 0) + ' کالا</td>' +
          '<td>' +
            '<button class="ghost" onclick="window.editC(\'' + c.id + '\')">ویرایش</button> ' +
            '<button class="danger" onclick="window.delC(\'' + c.id + '\')">حذف</button>' +
          '</td>' +
        '</tr>';
      });
      $('#ctable', main).innerHTML = html + '</tbody></table>';
      window._curCats = list;
    });
  }

  window.editC = id => openCategoryForm(window._curCats.find(x => x.id === id), load);
  window.delC = id => {
    if (confirm('آیا از حذف این دسته‌بندی اطمینان دارید؟\nنکته: در صورت داشتن محصول، حذف نخواهد شد.')) {
      api('/admin/categories/' + id + '/hard', { method: 'DELETE' }).then(load).catch(e => toast(esc(e.message), 'err'));
    }
  };

  $('#add-category-btn', main).onclick = () => openCategoryForm(null, load);
  load();
}
function openCategoryForm(existing, onSaved) {
  openModal(existing ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید', function(body, close) {
    body.innerHTML = 
      '<div class="grid2" style="direction:rtl; text-align:right;">' +
        '<div class="field"><label>نام دسته‌بندی *</label><input id="cf-n" value="' + esc(existing?.name || '') + '" placeholder="مثلاً: لبنیات"></div>' +
        '<div class="field"><label>slug (نام لاتین در آدرس)</label><input id="cf-sl" value="' + esc(existing?.slug || '') + '" placeholder="مثلاً: dairy"></div>' +
        '<div class="field"><label>ترتیب نمایش (عدد)</label><input id="cf-so" type="number" value="' + (existing?.sortOrder || 0) + '"></div>' +
        '<div class="field"><label>تصویر شاخص</label><input id="cf-f" type="file"></div>' +
      '</div>' +
      '<div style="background:#f1f5f9; padding:12px; border-radius:8px; margin:15px 0; direction:rtl; text-align:right;">' +
        '<label><input type="checkbox" id="cf-a" ' + (existing && existing.isActive === false ? '' : 'checked') + '> دسته‌بندی فعال و در اپلیکیشن نمایش داده شود</label>' +
      '</div>' +
      '<div id="cf-up-status" class="muted" style="margin-bottom:15px; text-align:right;"></div>' +
      '<button class="primary" style="width:100%; height:45px;" id="cf-save">ذخیره دسته‌بندی</button>';

    var img = existing?.imageUrl || '';
    $('#cf-f', body).onchange = ev => {
      if(!ev.target.files[0]) return;
      $('#cf-up-status', body).innerHTML = '<span class="spinner"></span> در حال آپلود تصویر...';
      uploadFile('/files/category', ev.target.files[0]).then(r => {
        img = r.url;
        $('#cf-up-status', body).textContent = '✅ تصویر آپلود شد';
        $('#cf-up-status', body).style.color = '#059669';
      });
    };

    $('#cf-save', body).onclick = function() {
      var payload = {
        name: $('#cf-n', body).value.trim(),
        slug: $('#cf-sl', body).value.trim() || undefined,
        sortOrder: Number($('#cf-so', body).value),
        isActive: $('#cf-a', body).checked,
        imageUrl: img
      };

      if (!payload.name) { toast('نام دسته‌بندی الزامی است', 'err'); return; }

      $('#cf-save', body).disabled = true;
      var method = existing ? 'PUT' : 'POST';
      var url = '/admin/categories' + (existing ? '/' + existing.id : '');

      api(url, { method: method, body: JSON.stringify(payload) }).then(() => {
        toast('دسته‌بندی با موفقیت ذخیره شد', 'ok');
        close();
        onSaved();
      }).catch(e => {
        toast(esc(e.message), 'err');
        $('#cf-save', body).disabled = false;
      });
    };
  });
}




/* =================== ۱. تمرکز روی بخش بنرها =================== */
function renderBanners(main) {
  main.innerHTML = '<div class="toolbar"><button class="primary" id="addBBtn">+ افزودن بنر جدید</button></div><div id="btable"></div>';
  
  var tbl = $('#btable', main);
  var addBtn = $('#addBBtn', main);

  // تابع بارگذاری لیست
  function load() {
    tbl.innerHTML = '<div class="empty"><span class="spinner"></span> در حال بارگذاری بنرها...</div>';
    
    api('/admin/banners').then(function(res) {
      // نکته حیاتی: استخراج items از پاسخ سرور
      var list = (res && res.items) || (Array.isArray(res) ? res : []);
      
      if (!list.length) {
        tbl.innerHTML = '<div class="empty">هنوز هیچ بنری ثبت نشده است.</div>';
        return;
      }

      var html = '<table><thead><tr><th>#</th><th>تصویر</th><th>عنوان</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>';
      list.forEach(function(b, i) {
        var statusBadge = b.isActive ? '<span class="badge APPROVED">فعال</span>' : '<span class="badge REJECTED">غیرفعال</span>';
        html += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><img src="' + esc(b.imageUrl) + '" style="width:120px; height:50px; object-fit:cover; border-radius:6px; border:1px solid #eee;"></td>' +
          '<td>' + esc(b.title) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' +
            '<button class="danger" onclick="window.delBanner(\'' + b.id + '\')">حذف</button>' +
          '</td>' +
        '</tr>';
      });
      html += '</tbody></table>';
      tbl.innerHTML = html;
    }).catch(function(e) {
      tbl.innerHTML = '<div class="error">خطا در دریافت بنرها: ' + esc(e.message) + '</div>';
    });
  }

  // تعریف تابع حذف در محیط window برای دسترسی از onclick
  window.delBanner = function(id) {
    if (confirm('آیا از حذف این بنر اطمینان دارید؟')) {
      api('/admin/banners/' + id, { method: 'DELETE' }).then(function() {
        toast('بنر حذف شد', 'ok');
        load();
      }).catch(function(e) {
        toast(esc(e.message), 'err');
      });
    }
  };

  // دکمه افزودن
  addBtn.onclick = function() {
    openModal('افزودن بنر جدید', function(body, close) {
      body.innerHTML = 
        '<div class="field"><label>عنوان بنر *</label><input id="bf-title" placeholder="مثلاً: جشنواره تابستانه"></div>' +
        '<div class="field"><label>لینک مقصد (اختیاری)</label><input id="bf-link" placeholder="https://..."></div>' +
        '<div class="field"><label>انتخاب فایل تصویر *</label><input id="bf-file" type="file" accept="image/*"></div>' +
        '<div id="up-status" class="muted" style="margin-bottom:15px;">فایلی انتخاب نشده است</div>' +
        '<button class="primary" id="bf-save" style="width:100%">انتشار بنر</button>';

      var fTitle = $('#bf-title', body), fLink = $('#bf-link', body), fFile = $('#bf-file', body), fSave = $('#bf-save', body);
      var uploadedUrl = '';

      fFile.onchange = function() {
        if (!fFile.files[0]) return;
        $('#up-status', body).innerHTML = '<span class="spinner"></span> در حال آپلود...';
        
        uploadFile('/admin/upload/banner', fFile.files[0]).then(function(r) {
          uploadedUrl = r.url;
          $('#up-status', body).textContent = '✅ تصویر با موفقیت آپلود شد';
          $('#up-status', body).style.color = '#059669';
        }).catch(function(e) {
          $('#up-status', body).textContent = '❌ خطا: ' + e.message;
          $('#up-status', body).style.color = '#dc2626';
        });
      };

      fSave.onclick = function() {
        var payload = { title: fTitle.value.trim(), linkUrl: fLink.value.trim(), imageUrl: uploadedUrl, isActive: true };
        if (!payload.title || !payload.imageUrl) {
          toast('لطفاً عنوان و تصویر را وارد کنید', 'err');
          return;
        }
        fSave.disabled = true;
        api('/admin/banners', { method: 'POST', body: JSON.stringify(payload) }).then(function() {
          toast('بنر با موفقیت ساخته شد', 'ok');
          close();
          load();
        }).catch(function(e) {
          toast(esc(e.message), 'err');
          fSave.disabled = false;
        });
      };
    });
  };

  load(); // بارگذاری اولیه
}




/* =================== ۲. تمرکز روی بخش تیکت‌ها =================== */
function renderTickets(main) {
  main.innerHTML = '<div class="row"><h2>تیکت‌های پشتیبانی</h2></div><div id="ttable"></div>';
  
  var tbl = $('#ttable', main);

  function load() {
    tbl.innerHTML = '<div class="empty"><span class="spinner"></span> در حال بارگذاری تیکت‌ها...</div>';
    
    api('/admin/tickets?pageSize=50').then(function(res) {
      // استخراج لیست تیکت‌ها از فیلد items
      var list = (res && res.items) || (Array.isArray(res) ? res : []);
      
      if (!list.length) {
        tbl.innerHTML = '<div class="empty">هنوز هیچ تیکتی ثبت نشده است.</div>';
        return;
      }

      var html = '<table><thead><tr><th>#</th><th>مشتری</th><th>موضوع</th><th>وضعیت</th><th>آخرین بروزرسانی</th><th>عملیات</th></tr></thead><tbody>';
      list.forEach(function(t, i) {
        var customerName = (t.customer && t.customer.storeName) ? t.customer.storeName : 'نامشخص';
        var phone = (t.customer && t.customer.user) ? t.customer.user.phone : '—';
        
        html += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong>' + esc(customerName) + '</strong><br><small class="muted">' + esc(phone) + '</small></td>' +
          '<td>' + esc(t.subject) + '</td>' +
          '<td>' + badge(t.status) + '</td>' +
          '<td>' + esc(fmtDate(t.updatedAt)) + '</td>' +
          '<td>' +
            '<button class="primary" onclick="window.openTicket(\'' + t.id + '\')">مشاهده و پاسخ</button>' +
          '</td>' +
        '</tr>';
      });
      html += '</tbody></table>';
      tbl.innerHTML = html;
    }).catch(function(e) {
      tbl.innerHTML = '<div class="error">خطا در دریافت تیکت‌ها: ' + esc(e.message) + '</div>';
    });
  }

  // تابع باز کردن جزئیات و پاسخ به تیکت
  window.openTicket = function(id) {
    openModal('پاسخ به تیکت', function(body, close) {
      body.innerHTML = 
        '<div class="field"><label>متن پاسخ شما به مشتری *</label>' +
        '<textarea id="tr-message" placeholder="پاسخ خود را اینجا بنویسید..." style="min-height:150px;"></textarea></div>' +
        '<div id="tr-err" class="error" style="display:none"></div>' +
        '<button class="primary" id="tr-send" style="width:100%">ارسال پاسخ برای مشتری</button>';

      var fMessage = $('#tr-message', body), fSave = $('#tr-send', body), fErr = $('#tr-err', body);

      fSave.onclick = function() {
        var msg = fMessage.value.trim();
        if (!msg) {
          toast('لطفاً متن پاسخ را وارد کنید', 'err');
          return;
        }

        fSave.disabled = true;
        fSave.textContent = 'در حال ارسال...';
        fErr.style.display = 'none';

        api('/admin/tickets/' + id + '/reply', { 
          method: 'POST', 
          body: JSON.stringify({ message: msg }) 
        }).then(function() {
          toast('پاسخ با موفقیت ارسال شد', 'ok');
          close();
          load();
        }).catch(function(e) {
          fErr.textContent = e.message;
          fErr.style.display = 'block';
          fSave.disabled = false;
          fSave.textContent = 'ارسال پاسخ برای مشتری';
        });
      };
    });
  };

  load(); // بارگذاری اولیه لیست
}




/* =================== مدیریت حرفه‌ای اعلان‌ها (Notifications) =================== */
function renderNotifications(main) {
  main.innerHTML = 
    '<div class="toolbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">' +
      '<div>' +
        '<h2>📢 مدیریت اطلاع‌رسانی و اعلان‌ها</h2>' +
        '<p class="muted" style="font-size:12px;">ارسال پیام‌های سیستمی و نوتیفیکیشن به اپلیکیشن کاربران</p>' +
      '</div>' +
      '<button class="primary" id="btn-new-notif" style="background:#2563eb; height:45px; padding:0 25px;">+ ایجاد اعلان جدید</button>' +
    '</div>' +
    '<div id="ntable"></div>';

  function load() {
    var container = $('#ntable', main);
    container.innerHTML = '<div class="empty"><span class="spinner"></span> در حال بازیابی تاریخچه اعلان‌ها...</div>';
    
    api('/admin/notifications?pageSize=50').then(function(res) {
      var list = res.items || [];
      if (!list.length) {
        container.innerHTML = '<div class="empty" style="background:#f8fafc; border:2px dashed #cbd5e1; border-radius:15px; padding:40px;">' +
          '🌤️ هنوز هیچ اعلانی ارسال نشده است.</div>';
        return;
      }

      var html = '<div style="display:grid; gap:15px;">';
      list.forEach(function(n) {
        var targetLabel = '';
        if(n.targetType === 'ALL') targetLabel = '<span class="badge APPROVED">همه کاربران</span>';
        else if(n.targetType === 'STATUS_BASED') targetLabel = '<span class="badge PENDING">وضعیت: ' + n.targetStatus + '</span>';
        else targetLabel = '<span class="badge REJECTED">کاربران خاص</span>';

        html += 
          '<div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-right:4px solid #2563eb;">' +
            '<div>' +
              '<div style="font-weight:bold; font-size:16px; margin-bottom:5px;">' + esc(n.title) + '</div>' +
              '<div class="muted" style="font-size:13px;">' + esc(n.body) + '</div>' +
              '<div style="margin-top:10px; display:flex; gap:10px; align-items:center;">' +
                targetLabel +
                '<small class="muted">🗓️ ' + fmtDate(n.createdAt) + '</small>' +
              '</div>' +
            '</div>' +
            '<div style="text-align:left;">' +
              '<button class="link" style="color:#64748b;" onclick="alert(\'این قابلیت در نسخه‌های آینده فعال می‌شود\')">📊 آمار بازدید</button>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    });
  }

  $('#btn-new-notif', main).onclick = () => openNotificationForm(load);
  load();
}
function openNotificationForm(onSent) {
  openModal('🚀 ایجاد و ارسال اعلان جدید', function(body, close) {
    body.innerHTML = 
      '<div style="direction:rtl; text-align:right;">' +
        '<div class="field">' +
          '<label>عنوان اعلان *</label>' +
          '<input id="nf-title" placeholder="مثلاً: تخفیف ویژه آخر هفته" style="width:100%;">' +
        '</div>' +
        '<div class="field" style="margin-top:15px;">' +
          '<label>متن پیام *</label>' +
          '<textarea id="nf-body" placeholder="متن اعلان خود را اینجا بنویسید..." style="width:100%; min-height:80px;"></textarea>' +
        '</div>' +
        
        '<div style="background:#f1f5f9; padding:15px; border-radius:10px; margin-top:20px;">' +
          '<h4>🎯 هدف‌گیری گیرندگان</h4>' +
          '<div class="field" style="margin-top:10px;">' +
            '<select id="nf-target-type" style="width:100%; padding:10px; border-radius:6px;">' +
              '<option value="ALL">📢 ارسال به همه کاربران</option>' +
              '<option value="STATUS_BASED">👥 بر اساس وضعیت حساب</option>' +
              '<option value="SPECIFIC_USERS">🆔 کاربران خاص (شماره موبایل)</option>' +
            '</select>' +
          '</div>' +

          '<div id="target-status-wrap" style="display:none; margin-top:10px;">' +
            '<label>فقط برای وضعیت:</label>' +
            '<select id="nf-target-status" style="width:100%; padding:8px;">' +
              '<option value="PENDING">در انتظار تایید</option>' +
              '<option value="APPROVED">تایید شده</option>' +
              '<option value="REJECTED">رد شده</option>' +
              '<option value="BLOCKED">مسدود شده</option>' +
            '</select>' +
          '</div>' +

          '<div id="target-users-wrap" style="display:none; margin-top:10px;">' +
            '<label>شماره موبایل‌ها (با کاما جدا کنید):</label>' +
            '<input id="nf-target-users" placeholder="09121111111, 09122222222">' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:20px; display:flex; align-items:center; gap:10px; background:#fff7ed; padding:10px; border-radius:8px;">' +
          '<input type="checkbox" id="nf-push" checked style="width:20px; height:20px;">' +
          '<label for="nf-push" style="margin:0; cursor:pointer;">🔔 ارسال به صورت Push Notification (در صورت آنلاین بودن کاربر)</label>' +
        '</div>' +

        '<div style="margin-top:25px; display:flex; gap:10px;">' +
          '<button class="primary" id="nf-send" style="flex:2; height:50px; font-size:16px; background:#2563eb;">🚀 انتشار و ارسال اعلان</button>' +
          '<button class="ghost" onclick="window.closeModal()" style="flex:1;">انصراف</button>' +
        '</div>' +
      '</div>';

    var typeSelect = $('#nf-target-type', body);
    typeSelect.onchange = function() {
      $('#target-status-wrap', body).style.display = (this.value === 'STATUS_BASED' ? 'block' : 'none');
      $('#target-users-wrap', body).style.display = (this.value === 'SPECIFIC_USERS' ? 'block' : 'none');
    };

    $('#nf-send', body).onclick = function() {
      var btn = this;
      var payload = {
        title: $('#nf-title', body).value.trim(),
        body: $('#nf-body', body).value.trim(),
        targetType: $('#nf-target-type', body).value,
        sendPush: $('#nf-push', body).checked
      };

      if (!payload.title || !payload.body) return alert('لطفاً عنوان و متن را وارد کنید');

      if (payload.targetType === 'STATUS_BASED') payload.targetStatus = $('#nf-target-status', body).value;
      if (payload.targetType === 'SPECIFIC_USERS') {
        var phones = $('#nf-target-users', body).value.split(',').map(p => p.trim()).filter(Boolean);
        if(!phones.length) return alert('لطفاً حداقل یک شماره موبایل وارد کنید');
        payload.targetUsers = phones;
      }

      btn.disabled = true;
      btn.textContent = 'در حال ارسال...';

      api('/admin/notifications', { method: 'POST', body: JSON.stringify(payload) }).then(() => {
        toast('اعلان با موفقیت در صف ارسال قرار گرفت', 'ok');
        close();
        onSent();
      }).catch(e => {
        alert(e.message);
        btn.disabled = false;
        btn.textContent = '🚀 انتشار و ارسال اعلان';
      });
    };
  });
}




/* =================== ۵. بخش پیشرفته امنیت و رصد فعالیت =================== */
function renderSecurity(main) {
  main.innerHTML = 
    '<div class="toolbar" id="sec-tabs">' +
      '<button class="ghost active" data-sec="stats">📊 آمار امنیتی</button>' +
      '<button class="ghost" data-sec="logs">🔑 لاگ‌های ورود</button>' +
      '<button class="ghost" data-sec="errors">🚫 گزارش خطاها</button>' +
      '<button class="ghost" data-sec="activity">👥 فعالیت کاربران</button>' +
    '</div>' +
    '<div id="sec-content" class="section" style="margin-top:15px;"></div>';

  var content = $('#sec-content', main);
  var buttons = $$('button[data-sec]', main);

  buttons.forEach(function(btn) {
    btn.onclick = function() {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      var view = btn.getAttribute('data-sec');
      if(view === 'stats') loadSecStats();
      else if(view === 'logs') loadOtpLogs();
      else if(view === 'errors') loadErrorLogs();
      else if(view === 'activity') loadUserActivity();
    };
  });



  // ۱. آمار امنیتی (کاربران پرخطر و فعالیت‌های مشکوک)
  function loadSecStats() {
    content.innerHTML = '<div class="empty"><span class="spinner"></span> در حال تحلیل داده‌ها...</div>';
    api('/admin/security/stats').then(function(data) {
      content.innerHTML = ''; // پاک کردن پیام قبلی
      var grid = el('div', { class: 'grid2' });
      
      // اضافه کردن کارت‌ها به صورت صحیح
      grid.appendChild(stat('تلاش‌های مشکوک (۲۴ ساعت)', data.suspiciousAttempts + ' مورد'));
      grid.appendChild(stat('کاربران فعال (کل)', data.hyperActiveUsers + ' نفر'));
      grid.appendChild(stat('نرخ موفقیت ورود', data.otpSuccessRate + '%'));
      grid.appendChild(stat('وضعیت سلامت سرور', 'عالی 🟢'));
      
      content.appendChild(grid);
    }).catch(function(e) {
      content.innerHTML = '<div class="error">خطا در تحلیل: ' + esc(e.message) + '</div>';
    });
  }

  // ۲. گزارش خطاهای اپلیکیشن
  function loadSecStats() {
    content.innerHTML = '<div class="empty"><span class="spinner"></span> در حال تحلیل رفتارهای مشکوک...</div>';
    
    api('/admin/security/stats').then(function(data) {
      content.innerHTML = ''; // پاکسازی
      
      // ردیف اول: کارت‌های آماری
      var grid = el('div', { class: 'grid2' });
      grid.appendChild(stat('تلاش‌های مشکوک (۲۴ساعت)', data.suspiciousAttempts + ' مورد'));
      grid.appendChild(stat('ضریب موفقیت OTP', data.otpSuccessRate + '%'));
      content.appendChild(grid);

      // ردیف دوم: لیست کاربران پرخطر (اگر وجود داشته باشند)
      var riskSection = el('div', { 
        class: 'section', 
        style: 'margin-top: 25px; border-top: 3px solid #ef4444; background: #fff;' 
      });

      if (data.highRiskUsers && data.highRiskUsers.length > 0) {
        var html = '<h3 style="color:#b91c1c; margin-bottom:15px;">🚩 کاربران پرخطر (بیش از ۵ تلاش ناموفق)</h3>' +
          '<table><thead><tr><th>شماره موبایل</th><th>تعداد تلاش خطا</th><th>وضعیت سیستم</th><th>عملیات</th></tr></thead><tbody>';
        
        data.highRiskUsers.forEach(function(u) {
          html += '<tr>' +
            '<td style="font-weight:bold;">' + esc(u.phone) + '</td>' +
            '<td style="color:#ef4444; font-weight:bold;">' + u.failedCount + ' بار</td>' +
            '<td><span class="badge REJECTED">تحت نظر</span></td>' +
            '<td><button class="danger" onclick="alert(\'این شماره به زودی مسدود خواهد شد\')">مسدود سازی</button></td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        riskSection.innerHTML = html;
      } else {
        riskSection.innerHTML = '<h3 style="color:#059669;">✅ امنیت برقرار است</h3><p class="muted">در ۲۴ ساعت گذشته فعالیت مشکوک بحرانی شناسایی نشد.</p>';
      }
      
      content.appendChild(riskSection);
    }).catch(function(e) {
      content.innerHTML = '<div class="error">خطا در دریافت آمار: ' + esc(e.message) + '</div>';
    });
  }

  /* =================== ۵.۳ گزارش جامع خطاهای سیستم =================== */
  function loadErrorLogs() {
    content.innerHTML = '<div class="empty"><span class="spinner"></span> در حال استخراج گزارش خطاها...</div>';
    
    api('/admin/security/errors?page=1').then(function(res) {
      var list = (res && res.items) || [];
      
      if (!list.length) {
        content.innerHTML = '<div class="empty">✅ بسیار عالی! هیچ خطایی در سیستم ثبت نشده است.</div>';
        return;
      }

      var html = '<h3 style="color:#e11d48; margin-bottom:15px;">🚫 لیست خطاهای گزارش شده از اپلیکیشن</h3>' +
        '<table><thead><tr><th>کاربر</th><th>شرح خطا</th><th>دستگاه</th><th>زمان</th><th>عملیات</th></tr></thead><tbody>';
      
      list.forEach(function(e) {
        html += '<tr>' +
          '<td><small class="muted">' + esc(e.userId || 'مهمان') + '</small></td>' +
          '<td style="max-width:300px; color:#b91c1c; font-size:11px; font-weight:bold;">' + esc(e.message) + '</td>' +
          '<td><small>' + esc(e.deviceInfo || '—') + '</small></td>' +
          '<td>' + fmtDate(e.createdAt) + '</td>' +
          '<td><button class="link" onclick="window.viewErrorDetails(\'' + e.id + '\')">🔎 مشاهده کد خطا</button></td>' +
        '</tr>';
      });

      html += '</tbody></table>';
      content.innerHTML = html;
      window._curErrors = list; // ذخیره برای مشاهده جزئیات
    }).catch(function(e) {
      content.innerHTML = '<div class="error">خطا در لود گزارش‌ها: ' + esc(e.message) + '</div>';
    });
  }

  // تابع نمایش جزئیات فنی خطا (Stack Trace)
  window.viewErrorDetails = function(id) {
    var err = window._curErrors.find(x => x.id === id);
    if (!err) return;

    openModal('جزئیات فنی خطا', function(body, close) {
      body.innerHTML = '<div style="direction:ltr; text-align:left; background:#1e293b; color:#fbbf24; padding:15px; border-radius:10px; overflow:auto; max-height:500px;">' +
        '<pre style="margin:0; font-family:monospace; font-size:12px;">' + esc(err.stack || 'No stack trace available') + '</pre>' +
        '</div>' +
        '<div style="margin-top:15px; text-align:right; direction:rtl;">' +
        '<p><strong>پیام:</strong> ' + esc(err.message) + '</p>' +
        '<p><strong>دستگاه:</strong> ' + esc(err.deviceInfo) + '</p>' +
        '</div>';
    });
  };





  /* =================== ۵.۴ رصد زنده فعالیت کاربران =================== */
  function loadUserActivity() {
    content.innerHTML = '<div class="empty"><span class="spinner"></span> در حال رصد حضور کاربران...</div>';
    
    api('/admin/security/active-users').then(function(list) {
      if (!list || list.length === 0) {
        content.innerHTML = '<div class="empty">هنوز فعالیتی از کاربران ثبت نشده است.</div>';
        return;
      }

      var html = '<h3 style="margin-bottom:15px;">👥 وضعیت حضور کاربران در اپلیکیشن</h3>' +
        '<table><thead><tr><th>نام فروشگاه / شماره</th><th>آخرین بازدید</th><th>وضعیت حساب</th><th>عملیات</th></tr></thead><tbody>';
      
      list.forEach(function(u) {
        var displayIdentity = (u.customer && u.customer.storeName) ? u.customer.storeName : u.phone;
        var custId = u.customer ? u.customer.id : null;

        // محاسبه دقیق زمان سپری شده از آخرین بازدید
        var lastSeenDate = new Date(u.lastSeenAt);
        var diffMinutes = Math.floor((new Date() - lastSeenDate) / 60000);
        
        var onlineStatus = '';
        if (diffMinutes < 5) {
          // اگر کمتر از ۵ دقیقه پیش بوده، آنلاین نمایش داده شود
          onlineStatus = '<span style="color:#059669; font-weight:bold; background:#d1fae5; padding:2px 8px; border-radius:10px;">● آنلاین (هم‌اکنون)</span>';
        } else {
          var timeText = diffMinutes < 60 ? 
            diffMinutes + ' دقیقه پیش' : 
            Math.floor(diffMinutes / 60) + ' ساعت پیش';
          onlineStatus = '<span class="muted">⌛ ' + timeText + '</span>';
        }

        // دکمه رصد کامل (اتصال به شناسنامه مشتری)
        var actionBtn = custId
          ? '<button class="link" onclick="window.vCust(\'' + custId + '\')" style="font-weight:bold;">🔎 رصد کامل سوابق</button>'
          : '<span class="muted">پروفایل تکمیل نشده</span>';

        html += '<tr>' +
          '<td><strong>' + esc(displayIdentity) + '</strong><br><small class="muted">' + esc(u.phone) + '</small></td>' +
          '<td>' + onlineStatus + '</td>' +
          '<td>' + badge(u.customer?.status || '—') + '</td>' +
          '<td>' + actionBtn + '</td>' +
        '</tr>';
      });

      html += '</tbody></table>';
      content.innerHTML = html;
    }).catch(function(e) {
      content.innerHTML = '<div class="error">خطا در رصد فعالیت: ' + esc(e.message) + '</div>';
    });
  }



  /* =================== ۵.۲ لاگ‌های امنیتی ورود (OTP) =================== */
  function loadOtpLogs() {
    content.innerHTML = '<div class="empty"><span class="spinner"></span> در حال دریافت تاریخچه ورودها...</div>';
    
    // دریافت ۵۰ مورد آخر لاگ‌ها
    api('/admin/otp-attempts?pageSize=50').then(function(res) {
      var list = (res && res.items) || (Array.isArray(res) ? res : []);
      
      if (!list.length) {
        content.innerHTML = '<div class="empty">هیچ تلاش ورودی ثبت نشده است.</div>';
        return;
      }

      var html = '<h3 style="margin-bottom:15px;">🔑 تاریخچه رمزهای یکبار مصرف ارسالی</h3>' +
        '<table><thead><tr><th>شماره موبایل</th><th>عملیات</th><th>کد تستی</th><th>نتیجه</th><th>آدرس IP</th><th>تاریخ و ساعت</th></tr></thead><tbody>';
      
      list.forEach(function(l) {
        var actionText = l.action === 'RESEND' ? 'درخواست مجدد' : 'تایید کد (Verify)';
        var resultBadge = l.success ? 
          '<span class="badge APPROVED">موفق</span>' : 
          '<span class="badge REJECTED">ناموفق</span>';
        
        // تشخیص حدودی مرورگر از روی userAgent
        var browserInfo = l.userAgent ? (l.userAgent.indexOf('Mobile') > -1 ? '📱 موبایل' : '💻 دسکتاپ') : 'نامشخص';

        html += '<tr>' +
          '<td style="font-weight:bold; color:#1e40af;">' + esc(l.phone) + '</td>' +
          '<td>' + actionText + '</td>' +
          '<td><code style="background:#f1f5f9; padding:2px 5px; border-radius:4px;">' + esc(l.code || '—') + '</code></td>' +
          '<td>' + resultBadge + '</td>' +
          '<td><small class="muted">' + esc(l.ip || '—') + '</small><br><small>' + browserInfo + '</small></td>' +
          '<td>' + fmtDate(l.createdAt) + '</td>' +
        '</tr>';
      });

      html += '</tbody></table>';
      content.innerHTML = html;
    }).catch(function(e) {
      content.innerHTML = '<div class="error">خطا در دریافت لاگ‌ها: ' + esc(e.message) + '</div>';
    });
  }

  loadSecStats(); // نمایش پیش‌فرض
}




/* =================== ۶. مدیریت تنظیمات بیزینس =================== */
function renderSettings(main) {
  main.innerHTML = '<div class="empty"><span class="spinner"></span> در حال دریافت تنظیمات...</div>';
  
  api('/admin/settings').then(function(s) {
    main.innerHTML = 
      '<div class="cust-detail" style="max-width:600px; margin: 0 auto; direction:rtl; text-align:right;">' +
        '<h2 style="margin-bottom:25px; border-bottom:2px solid #eee; padding-bottom:10px;">⚙️ تنظیمات سیستمی بنکو</h2>' +
        
        '<div class="section" style="background:#f8fafc;">' +
          '<h3>💰 محدودیت‌های مالی سفارش</h3>' +
          '<div class="field">' +
            '<label>حداقل مبلغ ثبت سفارش (تومان)</label>' +
            '<input id="st-min-order" type="number" value="' + (s.MIN_ORDER_AMOUNT || '0') + '">' +
            '<small class="muted">کاربر تا به این مبلغ نرسد، دکمه ثبت سفارش برایش غیرفعال است.</small>' +
          '</div>' +
          '<div class="field" style="margin-top:15px;">' +
            '<label>حداقل مبلغ ارسال رایگان (تومان)</label>' +
            '<input id="st-free-ship" type="number" value="' + (s.FREE_SHIPPING_MIN_AMOUNT || '0') + '">' +
            '<small class="muted">مبالغ بالاتر از این عدد، هزینه ارسال صفر دریافت می‌کنند.</small>' +
          '</div>' +
        '</div>' +

        '<div class="section" style="background:#eef2ff; border-color:#c7d2fe;">' +
          '<h3>🧾 اطلاعات فاکتور و فروشگاه</h3>' +
          '<small class="muted" style="display:block; margin-bottom:12px;">این مقادیر به‌صورت پویا در فاکتور فروش نشان داده می‌شوند.</small>' +
          '<div class="field">' +
            '<label>نام فروشگاه</label>' +
            '<input id="st-store-name" type="text" value="' + esc(s.STORE_NAME || '') + '" placeholder="بنکو پخش">' +
          '</div>' +
          '<div class="field" style="margin-top:12px;">' +
            '<label>شماره تماس ویزیتور</label>' +
            '<input id="st-visitor-phone" type="text" value="' + esc(s.VISITOR_PHONE || '') + '" placeholder="۰۹۱۲XXXXXXX">' +
          '</div>' +
          '<div class="field" style="margin-top:12px;">' +
            '<label>شماره تماس راننده</label>' +
            '<input id="st-driver-phone" type="text" value="' + esc(s.DRIVER_PHONE || '') + '" placeholder="۰۹۱۲XXXXXXX">' +
          '</div>' +
          '<div class="field" style="margin-top:12px;">' +
            '<label>شماره تماس فروشگاه</label>' +
            '<input id="st-store-phone" type="text" value="' + esc(s.STORE_PHONE || '') + '" placeholder="۰۲۱-XXXXXXXX">' +
          '</div>' +
          '<div class="field" style="margin-top:12px;">' +
            '<label>شماره تماس پشتیبانی</label>' +
            '<input id="st-phone" type="text" value="' + esc(s.SUPPORT_PHONE || '') + '" placeholder="۰۲۱-XXXXXXXX">' +
          '</div>' +
          '<div class="field" style="margin-top:12px;">' +
            '<label>آدرس فروشگاه</label>' +
            '<textarea id="st-store-address" style="min-height:70px;" placeholder="آدرس کامل بنکو پخش">' + esc(s.STORE_ADDRESS || '') + '</textarea>' +
          '</div>' +
        '</div>' +

        '<div class="toolbar" style="margin-top:30px;">' +
          '<button class="primary" id="btn-save-settings" style="width:100%; height:50px; font-size:16px;">💾 ذخیره تمامی تنظیمات</button>' +
        '</div>' +
      '</div>';

    $('#btn-save-settings', main).onclick = function() {
      var minOrder = $('#st-min-order', main).value;
      var freeShip = $('#st-free-ship', main).value;
      var storeName = $('#st-store-name', main).value;
      var visitorPhone = $('#st-visitor-phone', main).value;
      var driverPhone = $('#st-driver-phone', main).value;
      var storePhone = $('#st-store-phone', main).value;
      var supportPhone = $('#st-phone', main).value;
      var storeAddress = $('#st-store-address', main).value;

      this.disabled = true;
      this.textContent = 'در حال ذخیره...';

      // ارسال تمامی تنظیمات به صورت همزمان
      Promise.all([
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'MIN_ORDER_AMOUNT', value: minOrder }) }),
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'FREE_SHIPPING_MIN_AMOUNT', value: freeShip }) }),
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'STORE_NAME', value: storeName }) }),
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'VISITOR_PHONE', value: visitorPhone }) }),
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'DRIVER_PHONE', value: driverPhone }) }),
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'STORE_PHONE', value: storePhone }) }),
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'SUPPORT_PHONE', value: supportPhone }) }),
        api('/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'STORE_ADDRESS', value: storeAddress }) })
      ]).then(function() {
        toast('تمامی تنظیمات با موفقیت به‌روزرسانی شدند', 'ok');
        renderSettings(main); // بازخوانی مجدد
      }).catch(function(e) {
        toast('خطا در ذخیره‌سازی: ' + esc(e.message), 'err');
      }).finally(() => {
        this.disabled = false;
        this.textContent = '💾 ذخیره تمامی تنظیمات';
      });
    };
  }).catch(function(e) {
    main.innerHTML = '<div class="error">خطا در بارگذاری تنظیمات: ' + esc(e.message) + '</div>';
  });
}
/* =================== Bootstrap (P1-4) ===================
 * پیش‌تر وضعیت ورود با `localStorage.getItem(TOKEN_KEY)` تعیین می‌شد.
 * اکنون نشست از سرور پرسیده می‌شود: GET /auth/me با کوکی HttpOnly احراز هویت
 * می‌شود؛ 200 + نقش ADMIN یعنی لاگین، در غیر این صورت صفحهٔ ورود.
 * `noReload` لازم است وگرنه 401ِ کاربرِ لاگین‌نکرده حلقهٔ reload بی‌پایان می‌ساخت.
 */
(function bootstrapSession() {
  var root = $('#root');
  root.innerHTML = '<div class="empty"><span class="spinner"></span> در حال بررسی نشست...</div>';
  api('/auth/me', { noReload: true }).then(
    function(me) {
      state.authed = !!(me && me.role === 'ADMIN');
      render();
    },
    function() {
      state.authed = false;
      render();
    }
  );
})();


/* تابع کمکی برای ساخت کارت‌های آماری - این را به انتهای app.js اضافه کنید */
function stat(l, v) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'label' }, l),
    el('div', { class: 'value' }, v)
  ]);
}

window.exportOrdersCSV = function() {
  api('/admin/orders?pageSize=500').then(res => {
    var items = res.items || [];
    var csv = "\uFEFF#;شماره سفارش;مبلغ;وضعیت;تاریخ\n";
    items.forEach((o, i) => {
      csv += (i+1) + ";" + o.orderNumber + ";" + o.totalAmount + ";" + o.status + ";" + fmtDate(o.createdAt) + "\n";
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "orders_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
};