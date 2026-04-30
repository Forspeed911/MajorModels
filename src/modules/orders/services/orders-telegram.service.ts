import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderDetailsModel } from '../dto/order-response.dto';

export interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

@Injectable()
export class OrdersTelegramService {
  private readonly logger = new Logger(OrdersTelegramService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOrderCreated(order: OrderDetailsModel): Promise<TelegramSendResult> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID');

    if (
      !token ||
      !chatId ||
      token.trim().length === 0 ||
      chatId.trim().length === 0 ||
      token === 'replace_me' ||
      chatId === 'replace_me'
    ) {
      const error = 'Telegram configuration is missing (TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID).';
      this.logger.error(error);
      return { ok: false, error };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const text = this.buildOrderMessage(order);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const error = `Telegram API HTTP ${response.status}: ${body}`;
        this.logger.error(error);
        return { ok: false, error };
      }

      const payload = (await response.json()) as { ok?: boolean; description?: string };
      if (!payload.ok) {
        const error = payload.description ?? 'Telegram API returned ok=false';
        this.logger.error(error);
        return { ok: false, error };
      }

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Telegram send failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  private buildOrderMessage(order: OrderDetailsModel): string {
    const itemsText = order.items
      .map((item, index) => {
        return [
          `${index + 1}. ${item.product.article} | ${item.product.name}`,
          `   qty: ${item.quantity}`,
          `   unit: ${item.unitPrice.toString()}`,
          `   subtotal: ${item.subtotal.toString()}`,
        ].join('\n');
      })
      .join('\n');

    const userNameLine = order.telegramFullName
      ? `Full name: ${order.telegramFullName}`
      : 'Full name: -';

    const userHandleLine = order.telegramUsername
      ? `Username: @${order.telegramUsername}`
      : 'Username: -';

    const commentLine = order.comment ? `Comment: ${order.comment}` : 'Comment: -';
    const promoLine = order.promoCode
      ? `Promo: ${order.promoCode} (${order.promoDiscountPercent ?? 0}%)`
      : 'Promo: -';

    return [
      `New order: ${order.id}`,
      `Created at: ${order.createdAt.toISOString()}`,
      '',
      `Telegram user id: ${order.telegramUserId}`,
      userNameLine,
      userHandleLine,
      '',
      'Customer:',
      `Full name: ${order.customerFullName ?? '-'}`,
      `Phone: ${order.customerPhone ?? '-'}`,
      `Delivery: ${order.deliveryMethod ?? '-'}`,
      `Pickup point: ${order.pickupPointAddress ?? '-'}`,
      '',
      'Items:',
      itemsText,
      '',
      `Subtotal: ${order.subtotal.toString()}`,
      promoLine,
      `Discount: ${order.discountTotal.toString()}`,
      `Total: ${order.total.toString()}`,
      commentLine,
    ].join('\n');
  }
}
