import { Injectable } from '@nestjs/common';
import { DeliveryMethod, OrderStatus } from '.prisma/client';
import type { Product } from '.prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { orderDetailsInclude, type OrderDetailsModel } from '../dto/order-response.dto';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface CreateOrderInput {
  telegramUserId: string;
  telegramUsername?: string;
  telegramFullName?: string;
  comment?: string;
  subtotal: string;
  discountTotal: string;
  total: string;
  promoCode?: string;
  promoDiscountPercent?: number;
  deliveryMethod: DeliveryMethod;
  pickupPointAddress: string;
  customerPhone: string;
  customerFullName: string;
  items: CreateOrderItemInput[];
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProductsByIds(ids: string[]): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  createOrder(input: CreateOrderInput): Promise<OrderDetailsModel> {
    return this.prisma.orderRequest.create({
      data: {
        telegramUserId: input.telegramUserId,
        telegramUsername: input.telegramUsername,
        telegramFullName: input.telegramFullName,
        comment: input.comment,
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        total: input.total,
        promoCode: input.promoCode,
        promoDiscountPercent: input.promoDiscountPercent,
        deliveryMethod: input.deliveryMethod,
        pickupPointAddress: input.pickupPointAddress,
        customerPhone: input.customerPhone,
        customerFullName: input.customerFullName,
        items: {
          create: input.items,
        },
      },
      include: orderDetailsInclude,
    });
  }

  findOrderById(id: string): Promise<OrderDetailsModel | null> {
    return this.prisma.orderRequest.findUnique({
      where: { id },
      include: orderDetailsInclude,
    });
  }

  markOrderAsNotified(id: string): Promise<OrderDetailsModel> {
    return this.prisma.orderRequest.update({
      where: { id },
      data: {
        status: OrderStatus.NOTIFIED,
        notifiedAt: new Date(),
        notificationError: null,
      },
      include: orderDetailsInclude,
    });
  }

  markOrderNotificationFailed(id: string, errorMessage: string): Promise<OrderDetailsModel> {
    return this.prisma.orderRequest.update({
      where: { id },
      data: {
        notificationError: errorMessage,
      },
      include: orderDetailsInclude,
    });
  }
}
