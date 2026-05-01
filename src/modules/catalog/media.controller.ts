import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

const DEFAULT_MEDIA_ROOT = '/app/media';
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const CONTENT_TYPES = new Map<string, string>([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

@Controller('media')
export class MediaController {
  constructor(private readonly configService: ConfigService) {}

  @Get('products/:article/:filename')
  getProductImage(
    @Param('article') article: string,
    @Param('filename') filename: string,
    @Res() response: NodeJS.WritableStream & {
      setHeader(name: string, value: string): void;
    },
  ): void {
    const safeArticle = this.requireSafePathSegment(article, 'article');
    const safeFilename = this.requireSafePathSegment(filename, 'filename');
    const extension = extname(safeFilename).toLowerCase();

    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Unsupported image extension');
    }

    const mediaRoot = this.resolveMediaRoot();
    const filePath = resolve(mediaRoot, 'products', safeArticle, safeFilename);
    const productsRoot = resolve(mediaRoot, 'products');

    if (!filePath.startsWith(`${productsRoot}/`)) {
      throw new BadRequestException('Invalid media path');
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new NotFoundException('Image not found');
    }

    response.setHeader('content-type', CONTENT_TYPES.get(extension) ?? 'application/octet-stream');
    response.setHeader('cache-control', 'public, max-age=86400');
    createReadStream(filePath).pipe(response);
  }

  private resolveMediaRoot(): string {
    return resolve(
      this.configService.get<string>('MEDIA_ROOT')?.trim() || DEFAULT_MEDIA_ROOT,
    );
  }

  private requireSafePathSegment(value: string, fieldName: string): string {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded || decoded !== basename(decoded) || decoded.includes('..')) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return decoded;
  }
}
