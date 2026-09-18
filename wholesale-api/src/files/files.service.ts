import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

export type KycDocType = 'nationalCardImage' | 'businessLicenseImage' | 'selfieWithIdCardImage' | 'storefrontImage';

export type UploadKind = 'kyc' | 'product' | 'category' | 'banner';

// ═══════════════════════════════════════════════════════════════════════
// Express v5 types دیگر namespace Multer را export نمی‌کنند.
// به‌جای Express.Multer.File از این interface استفاده می‌کنیم.
// ═══════════════════════════════════════════════════════════════════════
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/jpg', 'image/webp']);
const MAX_SIZE_KYC = 5 * 1024 * 1024;
const MAX_SIZE_PRODUCT = 5 * 1024 * 1024;
const MAX_IMAGE_DIM = 600;
const JPEG_QUALITY = 80;

const ROOTS: Record<UploadKind, string> = {
  kyc: path.resolve(process.cwd(), 'uploads', 'kyc'),
  product: path.resolve(process.cwd(), 'uploads', 'products'),
  category: path.resolve(process.cwd(), 'uploads', 'categories'),
  banner: path.resolve(process.cwd(), 'uploads', 'banners'),
};

const URL_PREFIX: Record<UploadKind, string> = {
  kyc: '/files/kyc/',
  product: '/files/public/product/',
  category: '/files/public/category/',
  banner: '/files/public/banner/',
};

// ─── helpers ──────────────────────────────────────────────────────────

function getExt(mime: string): string {
  const m: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return m[mime] || 'jpg';
}

async function tryResizeToJpeg(buf: Buffer, outPath: string): Promise<boolean> {
  try {
    // بارگذاری تنبل عمدی است: اگر sharp نصب نباشد، gracefully به حالت اصلی برمی‌گردیم
    const { default: sharp } = await import('sharp');
    await sharp(buf)
      .resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, progressive: true })
      .toFile(outPath);
    return true;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn('[FilesService] sharp not installed — images saved at original size.');
    } else {
      console.warn('[FilesService] sharp resize failed, saving original:', err.message || e);
    }
    return false;
  }
}

// ─── service ──────────────────────────────────────────────────────────

@Injectable()
export class FilesService {
  constructor() {
    for (const dir of Object.values(ROOTS)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // ── KYC ──

  saveKycImage(file: UploadedFile, docType: KycDocType): Promise<string> {
    this._check(file, 'kyc');
    const ext = getExt(file.mimetype);
    const prefix =
      String(docType)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 24) || 'doc';
    const fname = `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
    fs.writeFileSync(path.join(ROOTS.kyc, fname), file.buffer);
    return Promise.resolve(fname);
  }

  // ── product / category ──

  async saveProductImage(file: UploadedFile): Promise<string> {
    return this._saveResized(file, 'product');
  }

  async saveCategoryImage(file: UploadedFile): Promise<string> {
    return this._saveResized(file, 'category');
  }

  async saveBannerImage(file: UploadedFile): Promise<string> {
    return this._saveResized(file, 'banner');
  }

  private async _saveResized(file: UploadedFile, kind: 'product' | 'category' | 'banner'): Promise<string> {
    this._check(file, kind);
    const tag = kind;
    const base = `${tag}_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const jpgPath = path.join(ROOTS[kind], `${base}.jpg`);

    const ok = await tryResizeToJpeg(file.buffer, jpgPath);
    if (ok) return `${base}.jpg`;

    // fallback: خام
    const ext = getExt(file.mimetype);
    const fname = `${base}.${ext}`;
    fs.writeFileSync(path.join(ROOTS[kind], fname), file.buffer);
    return fname;
  }

  private _check(file: UploadedFile, kind: UploadKind): void {
    if (!file) throw new BadRequestException('فایلی آپلود نشده است');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`نوع فایل نامعتبر (${file.mimetype}). فقط JPEG/PNG/WebP مجاز است.`);
    }
    const max = kind === 'kyc' ? MAX_SIZE_KYC : MAX_SIZE_PRODUCT;
    if (file.size > max) {
      throw new BadRequestException(`حجم فایل باید کمتر از ${Math.round(max / 1024 / 1024)} مگابایت باشد`);
    }
  }

  // ── file serving ──

  getKycFilePath(filename: string): string {
    const safe = path.basename(filename);
    const full = path.join(ROOTS.kyc, safe);
    if (!full.startsWith(ROOTS.kyc)) throw new BadRequestException('آدرس فایل نامعتبر');
    if (!fs.existsSync(full)) throw new BadRequestException('فایل یافت نشد');
    return full;
  }

  getPublicFilePath(kind: UploadKind, filename: string): string {
    const root = ROOTS[kind];
    if (!root) throw new BadRequestException('نوع فایل نامعتبر');
    const safe = path.basename(filename);
    const full = path.join(root, safe);
    if (!full.startsWith(root)) throw new BadRequestException('آدرس فایل نامعتبر');
    if (!fs.existsSync(full)) throw new BadRequestException('فایل یافت نشد');
    return full;
  }

  getPublicUrl(kind: UploadKind, filename: string): string {
    return URL_PREFIX[kind] + filename;
  }
}
