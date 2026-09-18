'use strict';

/* =================== مدیریت حرفه‌ای محصولات (Products Module) =================== */

var UNITS = ['CARTON', 'KG', 'PACK', 'PIECE', 'GRAM', 'LITER', 'BOX'];
var UNIT_LABELS = {
  CARTON: 'کارتن',
  KG: 'کیلوگرم',
  PACK: 'بسته',
  PIECE: 'عدد',
  GRAM: 'گرم',
  LITER: 'لیتر',
  BOX: 'جعبه'
};

// ─── رندر صفحه لیست محصولات ───────────────────────────────────────
window.renderProducts = function(main) {
  main.innerHTML =
    '<div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
      '<div style="display:flex; gap:10px; flex:1; flex-wrap:wrap;">' +
        '<select id="p-filter-cat" style="max-width:200px;"><option value="">همه دسته‌بندی‌ها</option></select>' +
        '<input id="p-search-input" placeholder="جستجوی نام محصول..." style="max-width:300px;">' +
        '<button class="primary" id="p-btn-search">🔎 جستجو</button>' +
      '</div>' +
      '<button class="primary" style="background:#059669;" onclick="window.openProductForm()">+ افزودن محصول جدید</button>' +
    '</div>' +
    '<div id="products-table-container"></div>';

  var tblContainer = $('#products-table-container', main);
  var catFilter = $('#p-filter-cat', main);
  var searchInp = $('#p-search-input', main);

  // بارگذاری دسته‌بندی‌ها برای دراپ‌دان فیلتر
  api('/admin/categories?all=1').then(function(res) {
    var list = res.items || [];
    list.forEach(function(c) {
      catFilter.appendChild(el('option', { value: c.id }, c.name));
    });
  });

  function load() {
    tblContainer.innerHTML = '<div class="empty"><span class="spinner"></span> در حال بارگذاری لیست محصولات...</div>';
    var q = new URLSearchParams({ all: '1', pageSize: 100 });
    if (catFilter.value) q.set('categoryId', catFilter.value);
    if (searchInp.value.trim()) q.set('search', searchInp.value.trim());

    api('/admin/products?' + q.toString()).then(function(res) {
      var items = res.items || [];
      if (!items.length) {
        tblContainer.innerHTML = '<div class="empty">محصولی یافت نشد.</div>';
        return;
      }

      var html = '<table><thead><tr>' +
        '<th>#</th>' +
        '<th>تصویر</th>' +
        '<th>نام محصول</th>' +
        '<th>برند / کد</th>' +
        '<th>قیمت</th>' +
        '<th>موجودی</th>' +
        '<th>بسته‌بندی</th>' +
        '<th>وضعیت</th>' +
        '<th>ویژگی‌ها</th>' +
        '<th>عملیات</th>' +
      '</tr></thead><tbody>';

      items.forEach(function(p, i) {
        var imgTag = p.imageUrl
          ? '<img src="' + esc(p.imageUrl) + '" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">'
          : '<div style="width:40px;height:40px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">📦</div>';

        var statusBadge = p.isActive
          ? '<span class="badge APPROVED">فعال</span>'
          : '<span class="badge REJECTED">غیرفعال</span>';

        var features = '';
        if (p.isNew) features += '<span style="background:#DBEAFE;color:#2563EB;padding:2px 6px;border-radius:4px;font-size:10px;margin:2px;">جدید</span>';
        if (p.isFeatured) features += '<span style="background:#D1FAE5;color:#059669;padding:2px 6px;border-radius:4px;font-size:10px;margin:2px;">پیشنهادی</span>';
        if (p.isDiscounted) features += '<span style="background:#FEE2E2;color:#EF4444;padding:2px 6px;border-radius:4px;font-size:10px;margin:2px;">تخفیف</span>';

        // برند و کد محصول
        var brandCode = '';
        if (p.brand) brandCode += '<div style="font-size:11px;color:#64748B;">برند: ' + esc(p.brand) + '</div>';
        if (p.productCode) brandCode += '<div style="font-size:11px;color:#94A3B8;">کد: ' + esc(p.productCode) + '</div>';
        if (!brandCode) brandCode = '<span style="color:#CBD5E1;">—</span>';

        // ساخت لیبل بسته‌بندی
        p.itemsPerPackageLabel = null;
        if (p.itemsPerPackage) {
          p.itemsPerPackageLabel = p.itemsPerPackage + ' عدد' + (p.packageType ? ' در ' + p.packageType : '');
        }

        // قیمت (با قیمت قبلی اگر تخفیف دارد)
        var priceHtml = '<strong>' + fmtMoney(p.price) + '</strong>';
        if (p.isDiscounted && p.oldPrice && p.oldPrice > p.price) {
          priceHtml = '<div style="text-decoration:line-through;color:#94A3B8;font-size:11px;">' + fmtMoney(p.oldPrice) + '</div>' + priceHtml;
        }

        // گالری تصاویر
        var galleryCount = (p.galleryImages && p.galleryImages.length) || 0;
        var galleryBadge = galleryCount > 0
          ? ' <span style="background:#EFF6FF;color:#2563EB;padding:1px 5px;border-radius:8px;font-size:9px;" title="تعداد تصاویر گالری">+' + galleryCount + '</span>'
          : '';

        html += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + imgTag + galleryBadge + '</td>' +
          '<td><strong>' + esc(p.name) + '</strong></td>' +
          '<td>' + brandCode + '</td>' +
          '<td>' + priceHtml + '</td>' +
          '<td style="text-align:center;">' +
            (p.stock === 0
              ? '<span style="color:#EF4444;font-weight:bold;">۰</span>'
              : p.stock <= 5
                ? '<span style="color:#F59E0B;font-weight:bold;">' + p.stock + '</span>'
                : '<span>' + p.stock + '</span>') +
          '</td>' +
          '<td style="text-align:center;">' +
            (p.itemsPerPackageLabel
              ? '<span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">' + esc(p.itemsPerPackageLabel) + '</span>'
              : '<span style="color:#CBD5E1;">—</span>') +
          '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + (features || '<span style="color:#CBD5E1;">—</span>') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="ghost" onclick="window.editP(\'' + p.id + '\')">ویرایش</button> ' +
            '<button class="danger" onclick="window.delP(\'' + p.id + '\')">حذف</button>' +
          '</td>' +
        '</tr>';
      });
      tblContainer.innerHTML = html + '</tbody></table>';
      window._cachedProducts = items;
    });
  }

  window.editP = function(id) {
    window.openProductForm(window._cachedProducts.find(function(x) { return x.id === id; }), load);
  };

  window.delP = function(id) {
    if (confirm('آیا از حذف این محصول اطمینان دارید؟')) {
      api('/admin/products/' + id + '/hard', { method: 'DELETE' }).then(function() {
        toast('محصول حذف شد', 'ok');
        load();
      });
    }
  };

  $('#p-btn-search', main).onclick = load;
  catFilter.onchange = load;
  load();
};

// ─── فرم افزودن/ویرایش محصول ───────────────────────────────────────
window.openProductForm = function(existing, onSaved) {
  openModal(existing ? '✏️ ویرایش محصول' : '➕ محصول جدید', function(body, close) {
    api('/admin/categories?all=1').then(function(res) {
      var catOpts = (res.items || []).map(function(c) {
        return '<option value="' + c.id + '" ' + (existing && existing.categoryId === c.id ? 'selected' : '') + '>' + c.name + '</option>';
      }).join('');

      // ساخت آرایه تصاویر گالری از داده موجود
      var galleryImages = (existing && existing.galleryImages) ? existing.galleryImages.slice() : [];

      body.innerHTML =
        // ── بخش ۱: اطلاعات پایه ──
        '<h3 style="direction:rtl;text-align:right;margin:0 0 12px;font-size:15px;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">📋 اطلاعات پایه محصول</h3>' +
        '<div class="grid2" style="direction:rtl; text-align:right;">' +
          '<div class="field"><label>نام محصول *</label><input id="pf-n" value="' + esc(existing ? existing.name : '') + '" placeholder="مثال: نوشابه خانواده کوکاکولا"></div>' +
          '<div class="field"><label>دسته‌بندی *</label><select id="pf-c">' + catOpts + '</select></div>' +
          '<div class="field"><label>برند</label><input id="pf-brand" value="' + esc(existing ? (existing.brand || '') : '') + '" placeholder="مثال: کوکاکولا"></div>' +
          '<div class="field"><label>کد محصول (SKU)</label><input id="pf-code" value="' + esc(existing ? (existing.productCode || '') : '') + '" placeholder="مثال: CC-1500-6"></div>' +
        '</div>' +

        // ── بخش ۲: قیمت و موجودی ──
        '<h3 style="direction:rtl;text-align:right;margin:16px 0 12px;font-size:15px;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">💰 قیمت و موجودی</h3>' +
        '<div class="grid2" style="direction:rtl; text-align:right;">' +
          '<div class="field"><label>قیمت فروش (تومان) *</label><input id="pf-p" type="number" value="' + (existing ? existing.price : '') + '" placeholder="مثال: 360000"></div>' +
          '<div class="field"><label>قیمت قبلی (تومان)</label><input id="pf-o" type="number" value="' + (existing && existing.oldPrice ? existing.oldPrice : '') + '" placeholder="فقط اگر تخفیف دارد"></div>' +
          '<div class="field"><label>قیمت تمام‌شده (تومان)</label><input id="pf-cost" type="number" value="' + (existing && existing.costPrice ? existing.costPrice : '') + '" placeholder="برای محاسبه سود (فقط ادمین)"></div>' +
          '<div class="field"><label>موجودی *</label><input id="pf-s" type="number" value="' + (existing ? existing.stock : 0) + '" min="0"></div>' +
        '</div>' +

        // ── بخش ۳: واحد فروش ──
        '<h3 style="direction:rtl;text-align:right;margin:16px 0 12px;font-size:15px;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">📦 واحد فروش</h3>' +
        '<div class="grid2" style="direction:rtl; text-align:right;">' +
          '<div class="field"><label>واحد فروش</label><select id="pf-u">' +
            UNITS.map(function(u) {
              return '<option value="' + u + '" ' + (existing && existing.unit === u ? 'selected' : '') + '>' + UNIT_LABELS[u] + ' (' + u + ')</option>';
            }).join('') +
          '</select></div>' +
          '<div class="field"><label>حداقل سفارش</label><input id="pf-min" type="number" value="' + (existing ? (existing.minOrderQty || 1) : 1) + '" min="1"></div>' +
        '</div>' +
        '<div class="field" style="direction:rtl;text-align:right;margin-top:8px;">' +
          '<label>توضیحات واحد فروش</label>' +
          '<textarea id="pf-ud" rows="2" placeholder="مثال: هر کارتن شامل ۶ عدد بطری ۱.۵ لیتری">' + esc(existing ? (existing.unitDetails || '') : '') + '</textarea>' +
        '</div>' +

        // ── بخش بسته‌بندی ──
        '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin:12px 0;">' +
          '<h3 style="direction:rtl;text-align:right;margin:0 0 12px;font-size:14px;color:#0F172A;">📦 بسته‌بندی محصول</h3>' +
          '<div class="grid2" style="direction:rtl;text-align:right;">' +
            '<div class="field"><label>نوع بسته‌بندی</label>' +
              '<select id="pf-pkg-type">' +
                '<option value="">-- انتخاب کنید --</option>' +
                '<option value="بسته"' + (existing && existing.packageType === 'بسته' ? ' selected' : '') + '>بسته</option>' +
                '<option value="کارتن"' + (existing && existing.packageType === 'کارتن' ? ' selected' : '') + '>کارتن</option>' +
                '<option value="شیرینک"' + (existing && existing.packageType === 'شیرینک' ? ' selected' : '') + '>شیرینک</option>' +
                '<option value="جعبه"' + (existing && existing.packageType === 'جعبه' ? ' selected' : '') + '>جعبه</option>' +
                '<option value="پک"' + (existing && existing.packageType === 'پک' ? ' selected' : '') + '>پک</option>' +
                '<option value="دسته"' + (existing && existing.packageType === 'دسته' ? ' selected' : '') + '>دسته</option>' +
                '<option value="ست"' + (existing && existing.packageType === 'ست' ? ' selected' : '') + '>ست</option>' +
                '<option value="custom"' + (existing && existing.packageType && !["بسته","کارتن","شیرینک","جعبه","پک","دسته","ست"].includes(existing.packageType) ? ' selected' : '') + '>سایر (وارد کردن دستی)</option>' +
              '</select></div>' +
            '<div class="field"><label>تعداد اقلام در بسته</label>' +
              '<input id="pf-ipp" type="number" min="1" max="9999" placeholder="مثلاً ۱۲" value="' + (existing && existing.itemsPerPackage ? existing.itemsPerPackage : '') + '"></div>' +
          '</div>' +
          '<div class="field" id="custom-pkg-group" style="direction:rtl;text-align:right;display:' + (existing && existing.packageType && !["بسته","کارتن","شیرینک","جعبه","پک","دسته","ست",""].includes(existing.packageType) ? 'block' : 'none') + ';">' +
            '<label>نوع بسته‌بندی سفارشی</label>' +
            '<input id="pf-pkg-custom" placeholder="مثلاً: قوطی، سطل" maxlength="50" value="' + esc(existing && existing.packageType && !["بسته","کارتن","شیرینک","جعبه","پک","دسته","ست"].includes(existing.packageType) ? existing.packageType : '') + '">' +
          '</div>' +
          '<div style="background:#DBEAFE;border:1px solid #93C5FD;border-radius:8px;padding:10px 14px;font-size:12px;color:#1D4ED8;">' +
            'ℹ️ این تعداد به صورت برچسب سبز روی کارت محصول در اپلیکیشن نمایش داده می‌شود.</div>' +
        '</div>' +

        // ── بخش ۴: توضیحات محصول ──
        '<h3 style="direction:rtl;text-align:right;margin:16px 0 12px;font-size:15px;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">📝 توضیحات محصول</h3>' +
        '<div class="field" style="direction:rtl;text-align:right;">' +
          '<textarea id="pf-desc" rows="4" placeholder="توضیحات کامل محصول (نمایش داده شده در صفحه جزئیات محصول در اپ موبایل)">' + esc(existing ? (existing.description || '') : '') + '</textarea>' +
        '</div>' +

        // ── بخش ۵: تصاویر ──
        '<h3 style="direction:rtl;text-align:right;margin:16px 0 12px;font-size:15px;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">🖼️ تصاویر محصول</h3>' +

        // تصویر اصلی
        '<div class="field" style="direction:rtl;text-align:right;">' +
          '<label>تصویر اصلی *</label>' +
          '<div style="display:flex;gap:12px;align-items:flex-start;margin-top:8px;">' +
            '<div id="pf-main-preview" style="width:80px;height:80px;border-radius:8px;border:2px dashed #E2E8F0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#F8FAFC;">' +
              (existing && existing.imageUrl
                ? '<img src="' + esc(existing.imageUrl) + '" style="width:100%;height:100%;object-fit:cover;">'
                : '<span style="color:#CBD5E1;font-size:24px;">📷</span>') +
            '</div>' +
            '<div>' +
              '<input id="pf-f" type="file" accept="image/*" style="margin-top:8px;">' +
              '<div style="font-size:11px;color:#94A3B8;margin-top:4px;">فرمت‌های مجاز: JPG, PNG, WebP — حداکثر ۵ مگابایت</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // تصاویر گالری
        '<div class="field" style="direction:rtl;text-align:right;margin-top:12px;">' +
          '<label>تصاویر گالری <span style="color:#94A3B8;font-weight:normal;">(حداکثر ۵ تصویر اضافی)</span></label>' +
          '<div id="pf-gallery-list" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;min-height:40px;">' +
            renderGalleryThumbs(galleryImages) +
          '</div>' +
          '<div style="margin-top:8px;">' +
            '<input id="pf-gallery-input" type="file" accept="image/*" ' + (galleryImages.length >= 5 ? 'disabled' : '') + '>' +
            '<div style="font-size:11px;color:#94A3B8;margin-top:4px;" id="pf-gallery-count">' +
              galleryImages.length + ' از ۵ تصویر آپلود شده' +
            '</div>' +
          '</div>' +
        '</div>' +

        // ── بخش ۶: وضعیت و ویژگی‌ها ──
        '<h3 style="direction:rtl;text-align:right;margin:16px 0 12px;font-size:15px;color:#0F172A;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">⚙️ وضعیت و ویژگی‌ها</h3>' +
        '<div style="background:#f8fafc; padding:15px; border-radius:10px; direction:rtl; text-align:right;">' +
          '<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer;">' +
            '<input type="checkbox" id="pf-active" ' + (!existing || existing.isActive !== false ? 'checked' : '') + '>' +
            '<span>🟢 محصول فعال و در دسترس کاربران باشد</span>' +
          '</label>' +
          '<div style="display:flex;gap:20px;flex-wrap:wrap;">' +
            '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
              '<input type="checkbox" id="pf-new" ' + (existing && existing.isNew ? 'checked' : '') + '>' +
              '<span>✨ جدید</span>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
              '<input type="checkbox" id="pf-feat" ' + (existing && existing.isFeatured ? 'checked' : '') + '>' +
              '<span>⭐ پیشنهادی</span>' +
            '</label>' +
            '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
              '<input type="checkbox" id="pf-disc" ' + (existing && existing.isDiscounted ? 'checked' : '') + '>' +
              '<span>🏷️ تخفیف‌دار</span>' +
            '</label>' +
          '</div>' +
        '</div>' +

        // ── دکمه ذخیره ──
        '<button class="primary" style="width:100%;height:48px;margin-top:20px;font-size:15px;" id="pf-save">💾 ذخیره نهایی محصول</button>';

      // ── متغیرهای تصویر ──
      var mainImgUrl = existing ? (existing.imageUrl || '') : '';

      // ── آپلود تصویر اصلی ──
      var mainFileInput = $('#pf-f', body);
      var mainPreview = $('#pf-main-preview', body);
      if (mainFileInput) {
        mainFileInput.onchange = function(ev) {
          var file = ev.target.files[0];
          if (!file) return;
          // پیش‌نمایش فوری
          var reader = new FileReader();
          reader.onload = function(e) {
            mainPreview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;">';
          };
          reader.readAsDataURL(file);
          // آپلود به سرور
          uploadFile('/admin/upload/product', file).then(function(r) {
            mainImgUrl = r.url;
            toast('تصویر اصلی آپلود شد', 'ok');
          }).catch(function() {
            toast('خطا در آپلود تصویر', 'err');
          });
        };
      }

      // ── آپلود تصاویر گالری ──
      var galleryInput = $('#pf-gallery-input', body);
      var galleryList = $('#pf-gallery-list', body);
      var galleryCountEl = $('#pf-gallery-count', body);

      function refreshGalleryUI() {
        galleryList.innerHTML = renderGalleryThumbs(galleryImages);
        galleryCountEl.textContent = galleryImages.length + ' از ۵ تصویر آپلود شده';
        if (galleryInput) galleryInput.disabled = galleryImages.length >= 5;

        // اتصال دکمه‌های حذف
        var removeBtns = galleryList.querySelectorAll('[data-remove-idx]');
        for (var i = 0; i < removeBtns.length; i++) {
          removeBtns[i].onclick = (function(idx) {
            return function() {
              galleryImages.splice(idx, 1);
              refreshGalleryUI();
            };
          })(parseInt(removeBtns[i].getAttribute('data-remove-idx'), 10));
        }
      }

      if (galleryInput) {
        galleryInput.onchange = function(ev) {
          var files = Array.prototype.slice.call(ev.target.files || []);
          var remaining = 5 - galleryImages.length;
          if (remaining <= 0) { toast('حداکثر ۵ تصویر گالری مجاز است', 'err'); return; }
          var toUpload = files.slice(0, remaining);
          var uploaded = 0;
          toUpload.forEach(function(file) {
            uploadFile('/admin/upload/product', file).then(function(r) {
              galleryImages.push(r.url);
              uploaded++;
              refreshGalleryUI();
              if (uploaded === toUpload.length) {
                toast(toUpload.length + ' تصویر آپلود شد', 'ok');
              }
            }).catch(function() {
              uploaded++;
              toast('خطا در آپلود یکی از تصاویر', 'err');
            });
          });
          ev.target.value = '';
        };
      }

      // اتصال اولیه دکمه‌های حذف گالری
      refreshGalleryUI();

      // ── بسته‌بندی: toggle فیلد سفارشی ──
      var pkgTypeSelect = $('#pf-pkg-type', body);
      var customPkgGroup = $('#custom-pkg-group', body);
      if (pkgTypeSelect && customPkgGroup) {
        pkgTypeSelect.onchange = function() {
          customPkgGroup.style.display = this.value === 'custom' ? 'block' : 'none';
        };
      }

      // ── ذخیره ──
      var saveBtn = $('#pf-save', body);
      if (saveBtn) {
        saveBtn.onclick = function() {
          var nameVal = $('#pf-n', body).value.trim();
          var priceVal = Number($('#pf-p', body).value);

          if (!nameVal) { toast('نام محصول الزامی است', 'err'); return; }
          if (!priceVal || priceVal <= 0) { toast('قیمت فروش الزامی است', 'err'); return; }

          var payload = {
            name: nameVal,
            categoryId: $('#pf-c', body).value,
            brand: $('#pf-brand', body).value.trim() || null,
            productCode: $('#pf-code', body).value.trim() || null,
            itemsPerPackage: $('#pf-ipp', body).value ? Number($('#pf-ipp', body).value) : null,
            packageType: (function() {
              var v = $('#pf-pkg-type', body).value;
              if (v === 'custom') return $('#pf-pkg-custom', body).value.trim() || null;
              return v || null;
            })(),
            price: priceVal,
            oldPrice: Number($('#pf-o', body).value) || null,
            costPrice: Number($('#pf-cost', body).value) || null,
            stock: Number($('#pf-s', body).value) || 0,
            unit: $('#pf-u', body).value,
            minOrderQty: Number($('#pf-min', body).value) || 1,
            unitDetails: $('#pf-ud', body).value.trim() || null,
            description: $('#pf-desc', body).value.trim() || null,
            imageUrl: mainImgUrl,
            galleryImages: galleryImages,
            isActive: $('#pf-active', body).checked,
            isNew: $('#pf-new', body).checked,
            isFeatured: $('#pf-feat', body).checked,
            isDiscounted: $('#pf-disc', body).checked,
            sortOrder: existing ? (existing.sortOrder || 0) : 0
          };

          saveBtn.disabled = true;
          saveBtn.textContent = '⏳ در حال ذخیره...';

          api('/admin/products' + (existing ? '/' + existing.id : ''), {
            method: existing ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
          }).then(function() {
            close();
            toast(existing ? 'محصول ویرایش شد' : 'محصول جدید ایجاد شد', 'ok');
            if (onSaved) onSaved();
            else window.renderProducts($('#root main'));
          }).catch(function(err) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 ذخیره نهایی محصول';
            toast('خطا: ' + (err.message || 'ذخیره ناموفق'), 'err');
          });
        };
      }
    });
  });
};

// ─── Helper: رندر تصاویر بندانگشتی گالری ──────────────────────────
function renderGalleryThumbs(images) {
  if (!images || images.length === 0) {
    return '<div style="color:#CBD5E1;font-size:12px;padding:8px;">تصویری اضافه نشده</div>';
  }
  return images.map(function(url, idx) {
    return '<div style="position:relative;width:64px;height:64px;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0;">' +
      '<img src="' + esc(url) + '" style="width:100%;height:100%;object-fit:cover;">' +
      '<button data-remove-idx="' + idx + '" style="position:absolute;top:2px;right:2px;width:18px;height:18px;' +
        'border-radius:50%;background:#EF4444;color:#FFF;border:none;font-size:10px;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;line-height:1;" title="حذف">×</button>' +
    '</div>';
  }).join('');
}
