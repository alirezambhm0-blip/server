'use strict';

/* =================== ماژول جامع مدیریت سفارشات بنکو =================== */

window.renderOrders = function(main) {  
  // ۱. ساخت ساختار اولیه و فیلترهای جدید
  main.innerHTML =   
    '<div class="toolbar" style="justify-content: space-between; margin-bottom:15px;">' +  
      '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +  
        '<button class="ghost active" data-filter="all">📦 همه</button>' +  
        '<button class="ghost" data-filter="permanent">👥 مشتریان دائمی</button>' +  
        '<button class="ghost" data-filter="pending">⌛ در حال انتظار</button>' +  
        '<button class="ghost" data-filter="confirmed">✅ تایید شده</button>' +  
      '</div>' +  
      '<div style="display:flex; gap:5px;">' +  
        '<button class="ghost" onclick="window.exportOrdersCSV()">📥 اکسل</button>' +  
        '<button class="primary" style="background:#059669;" onclick="window.openCreateOrderForm()">+ ثبت سفارش</button>' +  
      '</div>' +  
    '</div>' +  
    '<div class="row">' +  
      '<input id="o-search-input" placeholder="جستجوی شماره سفارش..." style="flex:1;">' +  
      '<button class="primary" id="o-btn-search">🔎 جستجو</button>' +  
    '</div>' +  
    '<div id="orders-table-container" style="margin-top:15px;"></div>';  

  var tblContainer = $('#orders-table-container', main);  
  var searchInp = $('#o-search-input', main);  
  var filterButtons = $$('button[data-filter]', main);  
  var activeFilter = 'all';  

  // مدیریت کلیک روی فیلترها
  filterButtons.forEach(function(btn) {
    btn.onclick = function() {
      filterButtons.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      load();
    };
  });

  function load() {  
    tblContainer.innerHTML = '<div class="empty"><span class="spinner"></span> در حال بارگذاری لیست...</div>';  
      
    api('/admin/orders?pageSize=100').then(function(res) {  
      var list = res.items || (Array.isArray(res) ? res : []);  
      // var list = res.items || [];
      var query = searchInp.value.trim().toLowerCase();  

      // ۲. منطق فیلترینگ اصلاح شده طبق درخواست شما
      var filtered = list.filter(function(o) {  
        var matchesSearch = !query || (o.orderNumber && o.orderNumber.toLowerCase().includes(query));  
        
        var matchesFilter = true;
        if (activeFilter === 'permanent') {
          // مشتری دائمی: دارای ID مشتری و فاقد شماره موبایل مهمان
          matchesFilter = (!!o.customerId && !o.guestPhone);
        } else if (activeFilter === 'pending') {
          // در حال انتظار: هر وضعیتی به جز CONFIRMED
          matchesFilter = (o.status !== 'CONFIRMED');
        } else if (activeFilter === 'confirmed') {
          // تایید شده: فقط وضعیت CONFIRMED
          matchesFilter = (o.status === 'CONFIRMED');
        }

        return matchesSearch && matchesFilter;  
      });  

      if (!filtered.length) {  
        tblContainer.innerHTML = '<div class="empty">موردی یافت نشد.</div>';  
        return;  
      }


      // ۳. ساخت جدول
      var html = '<table><thead><tr><th>#</th><th>شماره سفارش</th><th>مشتری / فروشگاه</th><th>مبلغ کل</th><th>وضعیت سفارش</th><th>مالی</th><th>عملیات</th></tr></thead><tbody>';
      



      filtered.forEach(function(o, i) {
        var customerInfo = o.customerId ? 
          (esc(o.customer?.storeName || '—') + '<br><small class="muted">' + esc(o.customer?.firstName || '') + ' ' + esc(o.customer?.lastName || '') + '</small>') :
          ('👤 ' + esc(o.guestName || 'مشتری متفرقه') + '<br><small class="muted">' + esc(o.guestPhone || '—') + '</small>');
        
        var payBadge = o.paymentStatus === 'PAID' ? '<span style="color:#059669; font-weight:bold;">تسویه ✅</span>' : '<span style="color:#ef4444; font-weight:bold;">بدهکار ❌</span>';
        var isConfirmed = (o.status === 'CONFIRMED');
        var isDelivered = (o.status === 'DELIVERED');
        var showUndo = isDelivered;
        var sourceBadge = (o.orderSource === 'VISITOR_IN_PERSON' || o.placedByUserId)
          ? ' <span style="background:#7C3AED; color:#FFF; font-size:10px; padding:2px 8px; border-radius:6px; font-weight:700;">حضوری</span>'
          : '';

        html += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong style="color:#1e40af">' + esc(o.orderNumber) + '</strong>' + sourceBadge + '<br><small class="muted">' + fmtDate(o.createdAt) + '</small></td>' +
          '<td>' + customerInfo + '</td>' +
          '<td>' + fmtMoney(o.totalAmount) + '</td>' +
          '<td>' + badge(o.status) + '</td>' +
          '<td>' + payBadge + '</td>' +
          '<td>' +
            '<div class="toolbar" style="gap:4px;">' +
              (showUndo 
                ? '<button class="danger" style="background:#f59e0b; font-size:10px;" onclick="window.undoConfirm(\''+o.id+'\')">↩️ اصلاح خطا</button>' 
                : '<select style="width:120px; font-size:10px;" onchange="window.updO(\''+o.id+'\', this.value)">' +
                    '<option value="">تغییر وضعیت</option>' +
                    '<option value="CONFIRMED">✅ تایید اولیه ادمین</option>' +
                    '<option value="PROCESSING">⚙️ در حال پردازش</option>' +
                    '<option value="SHIPPED">🚚 ارسال شده</option>' +
                    '<option value="DELIVERED">📦 تحویل داده شده (تایید نهایی)</option>' +
                    '<option value="CANCELLED">🚫 لغو سفارش</option>' +
                  '</select>') +
              '<button class="primary" onclick="window.vPay(\'' + o.id + '\')" title="فیش">💰</button> ' +
              '<button class="ghost" onclick="window.generateInvoice(\'' + o.id + '\')" title="فاکتور">🖨️</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      });
      tblContainer.innerHTML = html + '</tbody></table>';
      window._cachedOrders = list;
    });
  }

  // مدیریت فیلترها
  filterButtons.forEach(btn => {
    btn.onclick = function() {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      load();
    };
  });

  $('#o-btn-search', main).onclick = load;
  load();
};

/* =================== توابع عمومی (Global) =================== */

window.updO = function(id, s) {
  if(!s) return;
  api('/admin/orders/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status: s }) }).then(function(){
    toast('وضعیت به‌روز شد', 'ok');
    window.renderOrders($('#root main'));
  });
};

window.undoConfirm = function(id) {
  if(!confirm('آیا از بازگرداندن این سفارش به حالت "بدهکار" اطمینان دارید؟ (مبالغ از آمار داشبورد کسر خواهد شد)')) return;
  
  api('/admin/orders/' + id + '/status', { 
    method: 'PATCH', 
    body: JSON.stringify({ status: 'PENDING', paymentStatus: 'UNPAID' }) 
  }).then(function() {
    toast('تایید لغو شد و آمار به‌روزرسانی گردید', 'ok');
    
    // ۱. رفرش لیست سفارشات
    window.renderOrders($('#root main'));
    
    // ۲. بسیار مهم: اگر تب داشبورد باز است یا می‌خواهید آمار بلافاصله عوض شود
    // معمولاً ادمین بعد از این کار به داشبورد برمی‌گردد و آمار جدید را می‌بیند.
      }).catch(function(e) {
        toast('خطا: ' + esc(e.message), 'err');
      });
};

window.vPay = function(id) {
  var o = window._cachedOrders.find(x => x.id === id);
  openModal('تایید پرداخت', function(body, close) {
    body.innerHTML = '<div style="text-align:right; direction:rtl;"><h3>سفارش: ' + esc(o.orderNumber) + '</h3>' +
      '<div style="text-align:center; padding:10px; background:#f9fafb; border:1px solid #eee; border-radius:10px;">' +
      (o.paymentReceipt ? '<img src="' + esc(o.paymentReceipt) + '" style="max-width:100%; max-height:400px;">' : '<p>فیش آپلود نشده است.</p>') +
      '</div><button class="primary" style="width:100%; margin-top:20px" id="approve-pay-btn">✅ تایید نهایی تسویه</button></div>';
    $('#approve-pay-btn', body).onclick = () => api('/admin/orders/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ paymentStatus: 'PAID' }) }).then(() => { toast('تایید شد', 'ok'); close(); window.renderOrders($('#root main')); });
  });
};

window.generateInvoice = function(orderId) {
  openModal('پیش‌نمایش فاکتور فروش', function(body, close) {
    body.innerHTML = '<div class="empty">در حال آماده‌سازی فاکتور...</div>';

    var o = (window._cachedOrders || []).find(function(x) { return x.id === orderId; });
    if (!o) return body.innerHTML = '<div class="error">سفارش یافت نشد. لیست را رفرش کنید.</div>';

    api('/admin/settings').then(buildInvoice).catch(function() { buildInvoice({}); });

    function buildInvoice(settings) {
      settings = settings || {};
      var storeName    = settings.STORE_NAME   || 'بنکو پخش';
      var visitorPhone = settings.VISITOR_PHONE || '';
      var driverPhone  = settings.DRIVER_PHONE  || '';
      var storePhone   = settings.STORE_PHONE   || '';
      var storeAddress = settings.STORE_ADDRESS || '';
      var supportPhone = settings.SUPPORT_PHONE || '';

      function D(s) { return esc(s == null ? '' : s); }
      function F(n) { return formatPrice(n); }
      function faNum(x) { return Number(x || 0).toLocaleString('fa-IR'); }
      function fld(label, val, wide, pull) {
        if (!val) return '';
        return '<div class="inv-fld' + (wide ? ' inv-fld-wide' : '') + (pull ? ' inv-fld-pull' : '') + '"><span class="k">' + label + ':</span><span class="v">' + D(val) + '</span></div>';
      }

      var customer = o.customer || {};
      var isGuest   = !o.customerId;
      var fullName     = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || o.guestName || '';
      var buyerStore   = customer.storeName || '';
      var custPhone    = (customer.user && customer.user.phone) || o.guestPhone || '';
      var nationalCode = customer.nationalCode || '';
      var custAddr     = o.alternativeAddress || [customer.province, customer.city, customer.address].filter(Boolean).join('، ');

      var items = (o.items && o.items.length) ? o.items : [];

      var subtotal = (o.subtotalAmount != null) ? o.subtotalAmount : o.totalAmount;
      var shipping = (o.shippingAmount != null) ? o.shippingAmount : 0;
      var total    = o.totalAmount;
      var discount = (subtotal + shipping) - total;
      if (discount < 0) discount = 0;

      var note = o.note || o.notes || o.adminNote || o.description || '';
      note = String(note).trim();
      if (note === 'ثبت ادمین') note = '';
      var dateStr = fmtDate(o.createdAt);

      // ---------- بلوک‌های بازاستفاده ----------
      function headerHtml(pageNo, totalPages) {
        return '<div class="inv-header">' +
          '<div class="inv-brand-row">' + D(storeName) + '</div>' +
          '<div class="inv-header-lower">' +
            '<div class="inv-meta">' +
              '<div class="inv-title">فاکتور فروش</div>' +
              '<div class="inv-meta-row"><b>شماره:</b> ' + D(o.orderNumber) + '</div>' +
              '<div class="inv-meta-row"><b>تاریخ:</b> ' + D(dateStr) + '</div>' +
            '</div>' +
            '<div class="inv-contacts">' +
              (isGuest ? '' :
                '<div class="inv-contact-row"><b>شماره تماس ویزیتور:</b> ' + D(visitorPhone || '—') + '</div>' +
                '<div class="inv-contact-row"><b>شماره تماس راننده:</b> ' + D(driverPhone || '—') + '</div>' +
                '<div class="inv-contact-row"><b>صفحه:</b> ' + faNum(pageNo) + ' از ' + faNum(totalPages) + '</div>'
              ) +
            '</div>' +
          '</div>' +
        '</div>';
      }
      function buyerHtml() {
        return '<div class="inv-panel"><div class="inv-panel-title">اطلاعات خریدار</div>' +
          '<div class="inv-cust-grid">' +
            fld('نام و نام خانوادگی', fullName) +
            fld('نام فروشگاه', buyerStore, false, true) +
            fld('شماره تماس', custPhone) +
            fld('کد ملی', nationalCode, false, true) +
            fld('آدرس', custAddr, true) +
          '</div></div>';
      }
      function theadHtml() {
        return '<thead><tr>' +
          '<th style="width:5%">ردیف</th>' +
          '<th style="width:30%">شرح کالا</th>' +
          '<th style="width:20%">تعداد در بسته</th>' +
          '<th style="width:10%">تعداد سفارش</th>' +
          '<th style="width:17%">قیمت واحد</th>' +
          '<th style="width:18%">جمع کل</th>' +
        '</tr></thead>';
      }
      function rowHtml(it, idx) {
        return '<tr>' +
          '<td class="c">' + (idx + 1) + '</td>' +
          '<td class="name"><div class="inv-name">' + D(it.productName) + '</div></td>' +
          '<td class="c"><div class="inv-pack">' + D(it.itemsPerPackageLabel || '—') + '</div></td>' +
          '<td class="c">' + D(it.quantity) + '</td>' +
          '<td class="num">' + F(it.productPrice) + '</td>' +
          '<td class="num">' + F(it.lineTotal) + '</td>' +
        '</tr>';
      }
      function summaryHtml() {
        return '<div class="inv-summary">' +
          '<div class="inv-sum-row"><span class="k">جمع کالاها</span><span class="v">' + F(subtotal) + ' تومان</span></div>' +
          (shipping > 0 ? '<div class="inv-sum-row"><span class="k">هزینه ارسال</span><span class="v">' + F(shipping) + ' تومان</span></div>' : '') +
          (discount > 0 ? '<div class="inv-sum-row"><span class="k">تخفیف</span><span class="v">' + F(discount) + ' تومان</span></div>' : '') +
          '<div class="inv-sum-row inv-sum-total"><span class="k">جمع نهایی</span><span class="v">' + F(total) + ' تومان</span></div>' +
        '</div>';
      }
      function notesHtml() {
        return '<div class="inv-notes"><div class="inv-notes-label">توضیحات:</div><div class="inv-notes-text">' + (note ? D(note) : '—') + '</div></div>';
      }
      // امضاها (فقط فاکتورهای دارای پروفایل؛ فاکتور مهمان امضا ندارد) — خیلی ساده، بدون کادر و بدون تاریخ
      function signatureHtml() {
        if (isGuest) return '';
        return '<div class="inv-sigs">' +
          '<div class="inv-sig"><div class="inv-sig-label">مهر و امضای فروشنده</div><div class="inv-sig-line"></div></div>' +
          '<div class="inv-sig"><div class="inv-sig-label">امضای خریدار</div><div class="inv-sig-line"></div></div>' +
        '</div>';
      }
      function footerHtml() {
        return '<div class="inv-footer"><div class="inv-store-info">' +
          '<div class="inv-store-info-title">اطلاعات فروشگاه</div>' +
          '<div class="inv-store-intro">' +
            '<p>این فاکتور بصورت الکترونیکی چاپ شده.</p>' +
            '<p>لطفاً هنگام تحویل سفارش، نسبت به بررسی تعداد و اقلام تحویلی دقت لازم را مبذول فرمایید.</p>' +
          '</div>' +
          '<div class="inv-store-grid">' +
            (supportPhone ? '<div class="inv-fld"><span class="k">شماره پشتیبانی:</span><span class="v">' + D(supportPhone) + '</span></div>' : '') +
            (storePhone ? '<div class="inv-fld"><span class="k">تلفن فروشگاه:</span><span class="v">' + D(storePhone) + '</span></div>' : '') +
            (storeAddress ? '<div class="inv-fld inv-fld-wide"><span class="k">آدرس ' + D(storeName) + ':</span><span class="v">' + D(storeAddress) + '</span></div>' : '') +
          '</div>' +
        '</div>' + (isGuest ? '' : signatureHtml()) + '</div>';
      }
      function emptyRowHtml() {
        return '<tr><td colspan="6" style="text-align:center;color:#64748b;border:none;">محصولی برای این سفارش ثبت نشده است.</td></tr>';
      }
      function tableHtml(start, end) {
        var body = '';
        if (!items.length) body = emptyRowHtml();
        else for (var i = start; i < end; i++) body += rowHtml(items[i], i);
        return '<table class="inv-table">' + theadHtml() + '<tbody>' + body + '</tbody></table>';
      }

      // ---------- اندازه‌گیری برای صفحه‌بندی ----------
      var pxPerMm = 96 / 25.4;
      var contentHpx = (210 - 16) * pxPerMm;   // ارتفاع داخلی مفید برگه (8mm بالا + 8mm پایین)

      function mg(el, prop) { return el ? parseFloat(getComputedStyle(el)[prop] || '0') : 0; }

      var m = document.createElement('div');
      m.className = 'invoice-a5-measure';
      m.innerHTML = headerHtml(1, 1) +
        (isGuest ? '<div class="inv-table-title">جزئیات خرید</div>' : buyerHtml()) +
        tableHtml(0, items.length) + summaryHtml() + notesHtml() + footerHtml();
      document.body.appendChild(m);

      var hEl      = m.querySelector('.inv-header');
      var titleEl  = m.querySelector('.inv-table-title');
      var buyerEl  = m.querySelector('.inv-panel');
      var tblEl    = m.querySelector('.inv-table');
      var theadEl  = m.querySelector('.inv-table thead');
      var sumEl    = m.querySelector('.inv-summary');
      var noteEl   = m.querySelector('.inv-notes');
      var footEl   = m.querySelector('.inv-footer');

      var headerH  = hEl ? hEl.offsetHeight : 0;
      var mbHeader = mg(hEl, 'marginBottom');
      var buyerH   = isGuest ? 0 : (buyerEl ? buyerEl.offsetHeight : 0);
      var mbBuyer  = isGuest ? 0 : mg(buyerEl, 'marginBottom');
      var titleH   = isGuest ? (titleEl ? titleEl.offsetHeight : 0) : 0;
      var mbTitle  = isGuest ? mg(titleEl, 'marginBottom') : 0;
      var theadH   = theadEl ? theadEl.offsetHeight : 0;
      var mbTable  = mg(tblEl, 'marginBottom');
      var summaryH = sumEl ? sumEl.offsetHeight : 0;
      var mtSummary= mg(sumEl, 'marginTop');
      var notesH   = noteEl ? noteEl.offsetHeight : 0;
      var mtNotes  = mg(noteEl, 'marginTop');
      var footerH  = footEl ? footEl.offsetHeight : 0;
      var rowHs = [];
      var rowsEls = m.querySelectorAll('.inv-table tbody tr');
      for (var r = 0; r < rowsEls.length; r++) rowHs.push(rowsEls[r].offsetHeight);
      document.body.removeChild(m);

      function pageUsed(start, end, isFirst, withTail) {
        var used = headerH + mbHeader;
        if (isFirst) used += isGuest ? (titleH + mbTitle) : (buyerH + mbBuyer);
        used += theadH + mbTable;
        for (var i = start; i < end; i++) used += rowHs[i];
        if (withTail) used += summaryH + mtSummary + notesH + mtNotes + footerH;
        return used;
      }

      // ---------- تقسیم ردیف‌ها بین صفحات ----------
      var n = items.length;
      var pages = [];
      if (n === 0) {
        pages.push({ start: 0, end: 0, isFirst: true, isLast: true });
      } else {
        var tailFixed = summaryH + mtSummary + notesH + mtNotes + footerH;
        if (pageUsed(0, n, true, true) <= contentHpx) {
          // همه‌چیز در یک برگه جا می‌شود
          pages.push({ start: 0, end: n, isFirst: true, isLast: true });
        } else {
          // چند صفحه‌ای: صفحه‌ی آخر جمع/یادداشت/امضا/پاورقی را دارد و باید در جا شود
          var lastBase = headerH + mbHeader + theadH + mbTable + tailFixed;
          var lastRows = 0, used = lastBase;
          for (var i = n - 1; i >= 0; i--) {
            if (used + rowHs[i] <= contentHpx) { used += rowHs[i]; lastRows++; }
            else break;
          }
          if (lastRows >= n) lastRows = n - 1;   // لااقل یک ردیف برای صفحه‌ی اول بماند
          if (lastRows < 0) lastRows = 0;
          var frontEnd = n - lastRows;
          var idx = 0, pno = 1;
          while (idx < frontEnd) {
            var isFirst = (pno === 1);
            var start = idx;
            while (idx < frontEnd && pageUsed(start, idx + 1, isFirst, false) <= contentHpx) idx++;
            if (idx === start) idx = start + 1;   // حداقل یک ردیف در هر صفحه
            pages.push({ start: start, end: idx, isFirst: isFirst, isLast: false });
            pno++;
          }
          pages.push({ start: frontEnd, end: n, isFirst: false, isLast: true });
        }
      }

      // ---------- ساخت صفحات ----------
      var pageHtmls = [];
      for (var p2 = 0; p2 < pages.length; p2++) {
        var pg = pages[p2];
        var inner = headerHtml(p2 + 1, pages.length);
        if (pg.isFirst) inner += isGuest ? '<div class="inv-table-title">جزئیات خرید</div>' : buyerHtml();
        inner += tableHtml(pg.start, pg.end);
        if (pg.isLast) inner += summaryHtml() + notesHtml() + footerHtml();
        pageHtmls.push('<div class="invoice-a5-page' + (pg.isLast ? ' last' : '') + '" dir="rtl">' + inner + '</div>');
      }

      window.__closeInvoiceModal = close;
      body.innerHTML =
        '<div class="invoice-wrap">' +
          '<div class="invoice-toolbar no-print">' +
            '<button class="primary" style="height:40px;padding:0 22px;" onclick="window.print()">🖨️ چاپ فاکتور (A5)</button>' +
            '<button class="ghost" style="height:40px;" onclick="window.__closeInvoiceModal()">✕ بستن</button>' +
          '</div>' +
          pageHtmls.join('') +
        '</div>';
    }
  });
};

window.openCreateOrderForm = function(onSaved) {
  openModal('ثبت سفارش جدید', function(body, close) {
    body.innerHTML = '<div class="empty">در حال لود...</div>';
    Promise.all([api('/admin/customers?status=APPROVED'), api('/admin/products?all=1&pageSize=500')]).then(function(res) {
      var customers = res[0].items || [];
      var products = (res[1].items || []).filter(p => p.stock > 0);
      
      var cOpts = customers.map(c => '<option value="'+c.id+'">'+esc(c.storeName)+'</option>').join('');
      var pOpts = products.map(p => '<option value="'+p.id+'">'+esc(p.name)+' ('+p.stock+')</option>').join('');

      body.innerHTML = '<div style="direction:rtl; text-align:right;">' +
        '<div class="field"><label>نوع مشتری:</label><select id="ot-sel"><option value="existing">مشتری دائمی</option><option value="new">ثبت مشتری جدید</option><option value="guest">مشتری متفرقه</option></select></div>' +
        '<div id="sec-existing" class="section"><label>انتخاب مشتری:</label><select id="o-cust">' + cOpts + '</select></div>' +
        '<div id="sec-new" class="section" style="display:none;"><label>نام:</label><input id="o-n-name"><label>نام خانوادگی:</label><input id="o-n-lastName"><label>شماره همراه (برای لاگین):</label><input id="o-n-phone"><label>فروشگاه:</label><input id="o-n-store"></div>' +
        '<div id="sec-guest" class="section" style="display:none;"><label>نام مهمان:</label><input id="o-g-name"><label>تلفن مهمان:</label><input id="o-g-phone"></div>' +
        '<div class="section"><h4>کالا</h4><select id="o-p">' + pOpts + '</select><input id="o-q" type="number" value="1"><button class="primary" id="o-add">➕ افزودن</button></div>' +
        '<div id="o-list"></div><button class="primary" id="o-submit" style="width:100%; margin-top:20px;">🚀 ثبت نهایی</button></div>';

      var selected = [];
      $('#ot-sel', body).onchange = function() { 
        $('#sec-existing',body).style.display = this.value==='existing'?'block':'none';
        $('#sec-new',body).style.display = this.value==='new'?'block':'none';
        $('#sec-guest',body).style.display = this.value==='guest'?'block':'none';
      };

      $('#o-add', body).onclick = () => {
        var pId = $('#o-p',body).value, p = products.find(x=>x.id===pId);
        selected.push({productId:pId, name:p.name, quantity:Number($('#o-q',body).value)});
        $('#o-list',body).innerHTML = '<table>' + selected.map(it=>'<tr><td>'+esc(it.name)+'</td><td>'+it.quantity+'</td></tr>').join('') + '</table>';
      };

      $('#o-submit', body).onclick = () => {
        var payload = { items: selected, note: 'ثبت ادمین' };
        var t = $('#ot-sel',body).value;
        if(t==='existing') payload.customerId = $('#o-cust',body).value;
        else if(t==='guest') { payload.guestName=$('#o-g-name',body).value; payload.guestPhone=$('#o-g-phone',body).value; }
        else if(t==='new') payload.newCustomer = { firstName:$('#o-n-name',body).value, phone:$('#o-n-phone',body).value, storeName:$('#o-n-store',body).value, lastName:'—' };
        
        api('/orders/admin/create', { method:'POST', body:JSON.stringify(payload) }).then(() => { toast('ثبت شد','ok'); close(); window.renderOrders($('#root main')); });
      };
    });
  });
};

window.exportOrdersCSV = function() {
  api('/admin/orders?pageSize=500').then(res => {
    var csv = "\uFEFF#;شماره;مبلغ\n" + (res.items||[]).map((o,i)=>(i+1)+";"+o.orderNumber+";"+o.totalAmount).join("\n");
    var link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    link.setAttribute("download", "report.csv"); link.click();
  });
};