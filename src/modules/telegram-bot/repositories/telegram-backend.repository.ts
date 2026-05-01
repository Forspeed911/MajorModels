import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TelegramBackendCategoryDto,
  TelegramBackendCreateOrderDto,
  TelegramBackendOrderResponseDto,
  TelegramBackendProductDto,
  TelegramBackendProductListResponseDto,
} from '../dto/telegram-backend.dto';

@Injectable()
export class TelegramBackendRepository {
  constructor(private readonly configService: ConfigService) {}

  listCategories(): Promise<TelegramBackendCategoryDto[]> {
    return this.requestJson('/categories');
  }

  listProducts(params: {
    categoryId: string;
    limit: number;
    offset: number;
  }): Promise<TelegramBackendProductListResponseDto> {
    const searchParams = new URLSearchParams({
      categoryId: params.categoryId,
      limit: String(params.limit),
      offset: String(params.offset),
    });

    return this.requestJson(`/products?${searchParams.toString()}`);
  }

  getProductById(productId: string): Promise<TelegramBackendProductDto> {
    return this.requestJson(`/products/${productId}`);
  }

  async getProductImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(this.resolveUrl(imageUrl));
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Backend media HTTP ${response.status}: ${message}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  createOrder(payload: TelegramBackendCreateOrderDto): Promise<TelegramBackendOrderResponseDto> {
    return this.requestJson('/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.resolveUrl(path), init);
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Backend API HTTP ${response.status}: ${message}`);
    }

    return (await response.json()) as T;
  }

  private resolveUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }

    const normalizedPath = pathOrUrl.startsWith('/api/v1/')
      ? pathOrUrl.slice('/api/v1'.length)
      : pathOrUrl;

    return `${this.resolveBaseUrl()}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
  }

  private resolveBaseUrl(): string {
    const explicitBaseUrl =
      this.configService.get<string>('TELEGRAM_BACKEND_BASE_URL') ??
      this.configService.get<string>('BACKEND_API_BASE_URL');

    if (explicitBaseUrl && explicitBaseUrl.trim().length > 0) {
      return explicitBaseUrl.replace(/\/$/, '');
    }

    const port = Number(this.configService.get<string>('PORT') ?? '3000');
    return `http://127.0.0.1:${port}/api/v1`;
  }
}
