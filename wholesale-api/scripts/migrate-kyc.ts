/**
 * scripts/migrate-kyc.ts
 *
 * اسکریپت مهاجرت (یک‌بارمصرف) برای تبدیل مدارک KYC ذخیره‌شده به‌صورت
 * data URI / base64 در دیتابیس به فایل واقعی در پوشه uploads/kyc.
 *
 * نحوه‌ی اجرا (از داخل پوشه wholesale-api):
 *   npx ts-node scripts/migrate-kyc.ts
 *   یا
 *   npm run migrate:kyc
 *
 * پرچم‌ها:
 *   --dry-run   فقط گزارش می‌گیرد و هیچ چیزی را ذخیره/آپدیت نمی‌کند
 *
 * نکات:
 *  - فیلدهای هدف: nationalCardImage, businessLicenseImage, selfieWithIdCardImage, storefrontImage
 *  - اگر فیلد با 'data:image/' شروع شود، base64 درنظر گرفته می‌شود.
 *  - بعد از استخراج، فایل با نام استاندارد <docType>_<ts>_<rand>.<ext> ذخیره و ستون آپدیت می‌شود.
 *  - در صورت خطا (base64 نامعتبر، نوشتن فایل، ...) اسکریپت آن رکورد را گزارش می‌دهد و ادامه می‌دهد.
 *  - اسکریپت ایدمپوتنت نیست؛ اگر چند بار اجرا شود رکوردهای migrate شده را (که دیگر data URI نیستند) نادیده می‌گیرد.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');

const KYC_FIELDS = [
  'nationalCardImage',
  'businessLicenseImage',
  'selfieWithIdCardImage',
  'storefrontImage',
] as const;
type KycField = typeof KYC_FIELDS[number];

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'kyc');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

function isDataUri(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('data:image/');
}

function extractBase64(dataUri: string): { mime: string; data: Buffer } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUri);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const b64 = m[2].replace(/\s+/g, '');
  try {
    return { mime, data: Buffer.from(b64, 'base64') };
  } catch {
    return null;
  }
}

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  return 'bin';
}

function saveBuffer(buf: Buffer, docType: KycField, ext: string): string {
  const fname = `${docType}_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_ROOT, fname), buf);
  return fname;
}

async function main() {
  const prisma = new PrismaClient();
  const stats = {
    customers: 0,
    fieldsTotal: 0,
    fieldsMigrated: 0,
    fieldsSkippedAlreadyFile: 0,
    fieldsEmpty: 0,
    errors: 0,
  };

  console.log(`KYC migration ${DRY_RUN ? '(DRY RUN)':''} — scanning customers...`);
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      nationalCardImage: true,
      businessLicenseImage: true,
      selfieWithIdCardImage: true,
      storefrontImage: true,
    },
  });
  stats.customers = customers.length;
  console.log(`Found ${customers.length} customers.`);

  for (const c of customers) {
    const updates: Partial<Record<KycField, string>> = {};

    for (const field of KYC_FIELDS) {
      stats.fieldsTotal++;
      const v = (c as any)[field] as unknown;
      if (!v || typeof v !== 'string') { stats.fieldsEmpty++; continue; }
      if (!isDataUri(v)) { stats.fieldsSkippedAlreadyFile++; continue; }

      stats.fieldsMigrated++;
      const parsed = extractBase64(v);
      if (!parsed) {
        console.error(`[ERROR] customer=${c.id} field=${field} invalid data URI`);
        stats.errors++;
        continue;
      }
      const ext = extForMime(parsed.mime);
      try {
        if (DRY_RUN) {
          console.log(`[dry-run] customer=${c.id} field=${field} would save ${parsed.data.length} bytes (.${ext})`);
        } else {
          const fname = saveBuffer(parsed.data, field, ext);
          console.log(`[ok] customer=${c.id} field=${field} -> ${fname} (${parsed.data.length} bytes)`);
          (updates as any)[field] = fname;
        }
      } catch (e: any) {
        console.error(`[ERROR] customer=${c.id} field=${field} write failed: ${e.message}`);
        stats.errors++;
      }
    }

    if (!DRY_RUN && Object.keys(updates).length > 0) {
      try {
        await prisma.customer.update({ where: { id: c.id }, data: updates as any });
      } catch (e: any) {
        console.error(`[ERROR] customer=${c.id} db update failed: ${e.message}`);
        stats.errors++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(stats, null, 2));
  if (DRY_RUN) {
    console.log('Dry run finished. No changes applied.');
  } else {
    console.log('Migration complete.');
  }
  await prisma.$disconnect();
  if (stats.errors > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
