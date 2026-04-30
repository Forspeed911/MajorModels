import { OrderStatus } from '.prisma/client';

export interface TelegramBackendCategoryDto {
  id: string;
  name: string;
}

export interface TelegramBackendProductDto {
  id: string;
  categoryId: string;
  article: string;
  name: string;
  price: string;
  imageUrl: string | null;
}

export interface TelegramBackendProductListResponseDto {
  items: TelegramBackendProductDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface TelegramBackendOrderItemDto {
  id: string;
  productId: string;
  article: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface TelegramBackendOrderResponseDto {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  telegramFullName: string | null;
  comment: string | null;
  status: OrderStatus;
  total: string;
  notificationError: string | null;
  notifiedAt: string | null;
  createdAt: string;
  items: TelegramBackendOrderItemDto[];
}

export interface TelegramBackendCreateOrderItemDto {
  productId: string;
  quantity: number;
}

export interface TelegramBackendCreateOrderDto {
  telegramUserId: string;
  telegramUsername?: string;
  telegramFullName?: string;
  comment?: string;
  items: TelegramBackendCreateOrderItemDto[];
}
