// src/components/onboarding/ImageUploadField.tsx
// فیلد آپلود تصویر KYC. به‌جای ذخیره data-uri/base64 در state،
// مستقیماً فایل را به POST /files/kyc آپلود می‌کند و filename نهایی را
// به پدر می‌دهد. این filename در payload onboarding ارسال می‌شود.
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  Image,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { notify } from '@/utils/notify';
import * as ImagePicker from 'expo-image-picker';
import { uploadKycFile, KycDocType } from '@/api/kycApi';
import { buildUrl } from '@/api/httpClient';

type Props = {
  label: string;
  /** filename خروجی از سرور (مثلاً nationalCardImage_1720000000000_abc12345.jpg) */
  value?: string | null;
  /** onChange با filename جدید صدا زده می‌شود؛ null یعنی حذف */
  onChange: (filename: string | null) => void;
  docType: KycDocType;
  required?: boolean;
  helper?: string;
};

/**
 * وضعیت داخلی:
 *  - idle: هیچ عکسی انتخاب نشده
 *  - picking: در حال انتخاب از گالری (فقط native)
 *  - uploading: در حال آپلود به سرور
 *  - uploaded: آپلود موفق (value = filename)
 *  - error: خطا
 */
type LocalState = 'idle' | 'picking' | 'uploading' | 'uploaded' | 'error';

export default function ImageUploadField({
  label,
  value,
  onChange,
  docType,
  required,
  helper,
  error,
}: Props & { error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [localState, setLocalState] = useState<LocalState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // اگر از بیرون value پاک شد (مثلاً حذف توسط والد)، preview را هم پاک کن
  useEffect(() => {
    if (!value) {
      setPreviewUri(null);
      setLocalState('idle');
    } else if (value && !previewUri && localState === 'idle') {
      // ممکن است در ری‌لود صفحه value از قبل filename باشد
      setLocalState('uploaded');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ------ وب ------
  const pickWeb = () => {
    inputRef.current?.click();
  };

  const onWebFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // ریست برای امکان انتخاب مجدد

    if (!file.type.startsWith('image/')) {
      notify('خطا', 'لطفاً فقط فایل تصویری انتخاب کنید');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('حجم زیاد', 'حجم تصویر باید کمتر از ۵ مگابایت باشد');
      return;
    }

    // preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUri(localUrl);
    setErrorMsg(null);
    setLocalState('uploading');

    try {
      const res = await uploadKycFile(file, docType);
      onChange(res.filename);
      setLocalState('uploaded');
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'آپلود ناموفق بود';
      setErrorMsg(typeof msg === 'string' ? msg : 'آپلود ناموفق بود');
      setLocalState('error');
      setPreviewUri(null);
      notify('خطا در آپلود', typeof msg === 'string' ? msg : 'آپلود ناموفق بود');
    }
  };

  // ------ Native (Expo) ------
  const pickNative = async () => {
    // درخواست دسترسی
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      // روی پلتفرم‌های جدید این اجازه معمولاً در انتخاب محدود شده است
      if (perm.canAskAgain) {
        const again = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!again.granted) {
          notify('دسترسی لازم', 'برای انتخاب عکس، دسترسی گالری را در تنظیمات فعال کنید');
          return;
        }
      } else {
        notify('دسترسی لازم', 'برای انتخاب عکس، دسترسی گالری را در تنظیمات فعال کنید');
        return;
      }
    }

    setLocalState('picking');
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        base64: false,
        exif: false,
      });
    } catch (e: any) {
      setLocalState('idle');
      notify('خطا', e?.message || 'باز کردن گالری ناموفق بود');
      return;
    }

    if (result.canceled) {
      setLocalState('idle');
      return;
    }

    const picked = result.assets?.[0];
    if (!picked?.uri) {
      setLocalState('idle');
      return;
    }

    // بررسی حجم (تقریبی از fileSize اگر موجود باشد)
    if (picked.fileSize && picked.fileSize > 6 * 1024 * 1024) {
      notify('حجم زیاد', 'حجم تصویر باید کمتر از ۵ مگابایت باشد');
      setLocalState('idle');
      return;
    }

    setPreviewUri(picked.uri);
    setErrorMsg(null);
    setLocalState('uploading');

    try {
      // روی native، fetch با URI محلی کار می‌کند اما FormData append برای RN
      // نیاز به آبجکت { uri, name, type } دارد.
      const filenameFromUri = picked.uri.split('/').pop() || `${docType}.jpg`;
      const ext = (filenameFromUri.split('.').pop() || 'jpg').toLowerCase();
      const mime =
        ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      // fetch را مستقیم روی uri می‌زنیم (بلوب نمی‌سازیم چون در RN محلی uri دارد)
      const token = await (await import('@/storage/authStorage')).authStorage.getAccessToken();
      // P2-6 — قبلاً اینجا یک IP توسعه hardcode بود:
      //   process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000'
      // یعنی یک منبع حقیقت موازی، مستقل از httpClient.ts. حالا از همان
      // buildUrl موجود استفاده می‌شود (env → web localhost → Expo autodetect → fallback).
      const url = buildUrl(`/files/kyc?docType=${encodeURIComponent(docType)}`);

      const formData = new FormData();
      formData.append('file', {
        uri: picked.uri,
        name: filenameFromUri,
        type: mime,
      } as any);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // اندروید گاهی نیاز به unset content-type دارد؛ دستی set نمی‌کنیم.
        },
        body: formData as any,
      });

      if (res.status === 401) {
        throw new Error('لطفاً دوباره وارد شوید');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      if (!data?.filename) {
        throw new Error('پاسخ سرور نامعتبر');
      }
      onChange(data.filename);
      setLocalState('uploaded');
    } catch (err: any) {
      const msg = err?.message || 'آپلود ناموفق بود';
      setErrorMsg(msg);
      setLocalState('error');
      setPreviewUri(null);
      notify('خطا در آپلود', msg);
    }
  };

  const pick = Platform.OS === 'web' ? pickWeb : pickNative;

  const busy = localState === 'picking' || localState === 'uploading';
  const showPreview = !!previewUri || (localState === 'uploaded' && !previewUri);

  const remove = () => {
    if (previewUri && previewUri.startsWith('blob:')) {
      URL.revokeObjectURL(previewUri);
    }
    setPreviewUri(null);
    setErrorMsg(null);
    setLocalState('idle');
    onChange(null);
  };

  // preview روی وب با blob URL و روی native با file URI کار می‌کند.
  // در حالت uploaded بدون preview (مثلاً در رندر بعدی) عکس را نداریم —
  // برای onboarding مشکلی نیست چون تا قبل از submit فرم، preview محلی است.
  const renderInner = () => {
    if (busy) {
      return (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={[styles.placeholderSub, { marginTop: 6 }]}>
            {localState === 'picking' ? 'در حال باز کردن گالری…' : 'در حال آپلود…'}
          </Text>
        </View>
      );
    }
    if (previewUri) {
      return <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />;
    }
    if (localState === 'error') {
      return (
        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: '#EF4444' }]}>⚠ خطا در آپلود</Text>
          <Text style={styles.placeholderSub}>برای تلاش مجدد ضربه بزنید</Text>
        </View>
      );
    }
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>انتخاب تصویر</Text>
        <Text style={styles.placeholderSub}>برای آپلود ضربه بزنید (حداکثر ۵ مگابایت)</Text>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <Pressable
        style={[styles.box, localState === 'error' ? styles.boxError : null]}
        onPress={busy ? undefined : pick}
        disabled={busy}
      >
        {renderInner()}
      </Pressable>

      {(previewUri || value) && !busy ? (
        <Pressable onPress={remove} hitSlop={8}>
          <Text style={styles.remove}>حذف تصویر</Text>
        </Pressable>
      ) : null}

      {errorMsg && localState === 'error' ? (
        <Text style={styles.errorText}>{errorMsg}</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {Platform.OS === 'web' ? (
        <input
          ref={inputRef as any}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={onWebFile as any}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 4, textAlign: 'right' },
  required: { color: '#EF4444' },
  helper: { fontSize: 12, color: '#6B7280', marginBottom: 8, textAlign: 'right' },
  box: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  placeholder: { alignItems: 'center' },
  placeholderText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  placeholderSub: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  preview: { width: '100%', height: '100%' },
  remove: { color: '#EF4444', fontSize: 13, marginTop: 8, textAlign: 'center' },
  errorText: { color: '#B91C1C', fontSize: 12, marginTop: 6, textAlign: 'center' },
});
