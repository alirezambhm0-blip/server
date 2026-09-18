import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { FilesService } from './files.service';
import type { KycDocType } from './files.service';
import type { UploadedFile as TUploadedFile } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════
// import type  برای KycDocType الزامی است چون در پارامتر decorated
// استفاده شده و tsconfig هم isolatedModules=true هم
// emitDecoratorMetadata=true دارد.
// برای استفاده در آرایه VALID_DOC_TYPES هم نیاز به type داریم —
// پس با import type ایمپورت می‌کنیم و تایپ آرایه را string[] می‌گذاریم.
// ═══════════════════════════════════════════════════════════════════════
const VALID_DOC_TYPES: string[] = [
  'nationalCardImage',
  'businessLicenseImage',
  'selfieWithIdCardImage',
  'storefrontImage',
];

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('kyc')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async uploadKyc(@UploadedFile() file: TUploadedFile, @Query('docType') docType?: KycDocType) {
    if (!docType || !VALID_DOC_TYPES.includes(docType)) {
      throw new BadRequestException(`نوع مدرک نامعتبر است. یکی از این‌ها باشد: ${VALID_DOC_TYPES.join(', ')}`);
    }
    if (!file) throw new BadRequestException('فایل انتخاب نشده است');
    const filename = await this.files.saveKycImage(file, docType);
    return { filename, url: this.files.getPublicUrl('kyc', filename) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('kyc/:filename')
  serveKyc(@Param('filename') filename: string, @Res() res: Response) {
    const full = this.files.getKycFilePath(filename);
    res.sendFile(full);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('product')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async uploadProduct(@UploadedFile() file: TUploadedFile) {
    if (!file) throw new BadRequestException('فایل انتخاب نشده است');
    const filename = await this.files.saveProductImage(file);
    return { filename, url: this.files.getPublicUrl('product', filename) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('category')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async uploadCategory(@UploadedFile() file: TUploadedFile) {
    if (!file) throw new BadRequestException('فایل انتخاب نشده است');
    const filename = await this.files.saveCategoryImage(file);
    return { filename, url: this.files.getPublicUrl('category', filename) };
  }

  @Get('public/:kind/:filename')
  servePublic(@Param('kind') kind: string, @Param('filename') filename: string, @Res() res: Response) {
    if (kind !== 'product' && kind !== 'category' && kind !== 'banner') {
      throw new BadRequestException('نوع فایل نامعتبر');
    }
    const full = this.files.getPublicFilePath(kind, filename);
    res.sendFile(full);
  }
}
