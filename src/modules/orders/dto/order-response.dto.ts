import { DeliveryMethod, OrderStatus } from '.prisma/client';
import type { Prisma } from '.prisma/client';

export const orderDetailsInclude = {
  items: {
    include: {
      product: true,
    },
  },
} satisfies Prisma.OrderRequestInclude;

export type OrderDetailsModel = Prisma.OrderRequestGetPayload<{
  include: typeof orderDetailsInclude;
}>;

export class OrderItemResponseDto {
  id!: string;
  productId!: string;
  article!: string;
  productName!: string;
  quantity!: number;
  unitPrice!: string;
  subtotal!: string;
}

export class OrderResponseDto {
  id!: string;
  telegramUserId!: string;
  telegramUsername!: string | null;
  telegramFullName!: string | null;
  comment!: string | null;
  status!: OrderStatus;
  subtotal!: string;
  discountTotal!: string;
  total!: string;
  promoCode!: string | null;
  promoDiscountPercent!: number | null;
  deliveryMethod!: DeliveryMethod | null;
  pickupPointAddress!: string | null;
  customerPhone!: string | null;
  customerFullName!: string | null;
  notificationError!: string | null;
  notifiedAt!: string | null;
  createdAt!: string;
  items!: OrderItemResponseDto[];

  static fromModel(model: OrderDetailsModel): OrderResponseDto {
    return {
      id: model.id,
      telegramUserId: model.telegramUserId,
      telegramUsername: model.telegramUsername,
      telegramFullName: model.telegramFullName,
      comment: model.comment,
      status: model.status,
      subtotal: model.subtotal.toString(),
      discountTotal: model.discountTotal.toString(),
      total: model.total.toString(),
      promoCode: model.promoCode,
      promoDiscountPercent: model.promoDiscountPercent,
      deliveryMethod: model.deliveryMethod,
      pickupPointAddress: model.pickupPointAddress,
      customerPhone: model.customerPhone,
      customerFullName: model.customerFullName,
      notificationError: model.notificationError,
      notifiedAt: model.notifiedAt ? model.notifiedAt.toISOString() : null,
      createdAt: model.createdAt.toISOString(),
      items: model.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        article: item.product.article,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        subtotal: item.subtotal.toString(),
      })),
    };
  }
}
