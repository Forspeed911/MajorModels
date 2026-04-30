import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Product } from '.prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersRepository } from './repositories/orders.repository';
import { OrdersTelegramService } from './services/orders-telegram.service';
import { centsToDecimalString, decimalStringToCents } from './utils/money';

interface AggregatedOrderItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly ordersTelegramService: OrdersTelegramService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<OrderResponseDto> {
    const aggregatedItems = this.aggregateItems(dto);
    const productIds = aggregatedItems.map((item) => item.productId);

    const products = await this.ordersRepository.findProductsByIds(productIds);
    const productsById = new Map(products.map((product) => [product.id, product]));

    const missingProductIds = productIds.filter((id) => !productsById.has(id));
    if (missingProductIds.length > 0) {
      throw new BadRequestException(
        `Products not found: ${missingProductIds.join(', ')}`,
      );
    }

    let totalCents = 0n;
    const createItems = aggregatedItems.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product not found: ${item.productId}`);
      }

      const unitPriceCents = decimalStringToCents(product.price.toString());
      const subtotalCents = unitPriceCents * BigInt(item.quantity);
      totalCents += subtotalCents;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: centsToDecimalString(unitPriceCents),
        subtotal: centsToDecimalString(subtotalCents),
      };
    });

    const created = await this.ordersRepository.createOrder({
      telegramUserId: dto.telegramUserId,
      telegramUsername: dto.telegramUsername?.trim() || undefined,
      telegramFullName: dto.telegramFullName?.trim() || undefined,
      comment: dto.comment?.trim() || undefined,
      total: centsToDecimalString(totalCents),
      items: createItems,
    });

    const sendResult = await this.ordersTelegramService.sendOrderCreated(created);

    if (sendResult.ok) {
      const updated = await this.ordersRepository.markOrderAsNotified(created.id);
      return OrderResponseDto.fromModel(updated);
    }

    this.logger.error(
      `Order ${created.id} created but Telegram notification failed: ${sendResult.error ?? 'unknown error'}`,
    );

    const updated = await this.ordersRepository.markOrderNotificationFailed(
      created.id,
      sendResult.error ?? 'unknown telegram error',
    );

    return OrderResponseDto.fromModel(updated);
  }

  async getOrderById(id: string): Promise<OrderResponseDto> {
    const order = await this.ordersRepository.findOrderById(id);
    if (!order) {
      throw new NotFoundException(`Order with id '${id}' not found`);
    }

    return OrderResponseDto.fromModel(order);
  }

  private aggregateItems(dto: CreateOrderDto): AggregatedOrderItem[] {
    const map = new Map<string, number>();

    for (const item of dto.items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException(`Invalid quantity for product ${item.productId}`);
      }

      const current = map.get(item.productId) ?? 0;
      map.set(item.productId, current + quantity);
    }

    const aggregated = Array.from(map.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    if (aggregated.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    return this.sortByProductOrder(aggregated, dto.items.map((i) => i.productId));
  }

  private sortByProductOrder(
    aggregated: AggregatedOrderItem[],
    rawOrder: string[],
  ): AggregatedOrderItem[] {
    const rank = new Map<string, number>();
    rawOrder.forEach((productId, index) => {
      if (!rank.has(productId)) {
        rank.set(productId, index);
      }
    });

    return [...aggregated].sort((a, b) => {
      const aRank = rank.get(a.productId) ?? 0;
      const bRank = rank.get(b.productId) ?? 0;
      return aRank - bRank;
    });
  }
}
