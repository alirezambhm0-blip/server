// src/api/kycApi.ts
// API برای آپلود فایل‌های KYC به endpoint /files/kyc.
// فایل در سرور به‌صورت filename برگردانده می‌شود؛ ما آن filename را
// در payload onboarding ارسال می‌کنیم (نه data URI/base64).
import { httpClient } from './httpClient';

export type KycDocType =
  | 'nationalCardImage'
  | 'businessLicenseImage'
  | 'selfieWithIdCardImage'
  | 'storefrontImage';

export interface KycUploadResponse {
  filename: string;
  url: string; // /files/kyc/<filename> — برای ادمین
}

/**
 * آپلود یک فایل KYC به سرور.
 * @param fileBlob  Blob/File تصویر (روی وب File، روی native از image-picker خروجی گرفته می‌شود)
 * @param docType   نوع مدرک (nationalCardImage, ...)
 * @returns         { filename, url }
 */
export async function uploadKycFile(
  fileBlob: Blob,
  docType: KycDocType,
): Promise<KycUploadResponse> {
  const form = new FormData();
  // field name باید 'file' باشد که با FileInterceptor('file') بخواند.
  form.append('file', fileBlob as any);
  const res = await httpClient.uploadFile<KycUploadResponse>(
    `/files/kyc?docType=${encodeURIComponent(docType)}`,
    form,
  );
  return res.data;
}
