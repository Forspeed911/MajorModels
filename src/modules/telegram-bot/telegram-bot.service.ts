import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryMethod } from '.prisma/client';
import { Context, Telegraf } from 'telegraf';
import {
  TelegramBackendCategoryDto,
  TelegramBackendCreateOrderDto,
} from './dto/telegram-backend.dto';
import { TelegramBackendRepository } from './repositories/telegram-backend.repository';
import { centsToDecimalString, decimalStringToCents } from './utils/money';

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

interface CartItem {
  productId: string;
  article: string;
  productName: string;
  unitPrice: string;
  quantity: number;
}

interface UserCart {
  items: Map<string, CartItem>;
  promoCode?: string;
  promoDiscountPercent?: number;
  deliveryMethod?: DeliveryMethod;
  pickupPointAddress?: string;
  customerPhone?: string;
  customerFullName?: string;
  pendingInput?: CheckoutInputStep;
}

type CheckoutInputStep = 'promo' | 'pickupPointAddress' | 'customerPhone' | 'customerFullName';

interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}

const CALLBACK_HOME = 'menu:home';
const CALLBACK_CATEGORIES = 'menu:categories';
const CALLBACK_CART = 'menu:cart';
const CALLBACK_CHECKOUT = 'menu:checkout';
const CALLBACK_CLEAR_CART = 'cart:clear';
const CALLBACK_PROMO = 'cart:promo';
const DELIVERY_CALLBACK_PREFIX = 'delivery:';
const CATEGORY_PAGE_PATTERN = /^cat:([0-9a-f-]{36}):(\d+)$/i;
const ADD_PRODUCT_PATTERN = /^add:([0-9a-f-]{36})$/i;
const DELIVERY_PATTERN = /^delivery:(SDEC|OZON)$/;

const PRODUCTS_PAGE_LIMIT = 10;
const BUTTON_TEXT_MAX_LENGTH = 60;
const PROMO_DISCOUNTS = new Map<string, number>([
  ['PROMO10', 10],
  ['PROMO15', 15],
  ['PROMO20', 20],
]);

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf<Context> | null = null;
  private readonly carts = new Map<number, UserCart>();

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramBackendRepository: TelegramBackendRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || token.trim().length === 0 || token === 'replace_me') {
      this.logger.warn('Telegram bot polling is disabled: TELEGRAM_BOT_TOKEN is not configured.');
      return;
    }

    const bot = new Telegraf<Context>(token);
    this.bot = bot;
    this.registerHandlers(bot);

    void this.launchBot(bot);
  }

  private async launchBot(bot: Telegraf<Context>): Promise<void> {
    try {
      await bot.launch({
        allowedUpdates: ['message', 'callback_query'],
      });
      this.logger.log('Telegram bot polling is started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to start Telegram bot polling: ${message}`);
      if (this.bot === bot) {
        this.bot = null;
      }
    }
  }

  onModuleDestroy(): void {
    if (!this.bot) {
      return;
    }

    this.bot.stop('Application shutdown');
    this.bot = null;
    this.logger.log('Telegram bot polling is stopped');
  }

  private registerHandlers(bot: Telegraf<Context>): void {
    bot.start((ctx) => this.executeSafely(ctx, () => this.showMainMenu(ctx)));
    bot.command('catalog', (ctx) => this.executeSafely(ctx, () => this.showCategories(ctx)));
    bot.command('cart', (ctx) => this.executeSafely(ctx, () => this.showCart(ctx)));
    bot.on('callback_query', (ctx) => this.executeSafely(ctx, () => this.handleCallback(ctx)));
    bot.on('text', (ctx) => this.executeSafely(ctx, () => this.handleText(ctx)));

    bot.catch((error, ctx) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Unhandled Telegram bot error: ${message}`);
      void this.safeReply(ctx, 'Внутренняя ошибка. Попробуйте ещё раз.');
    });
  }

  private async executeSafely(ctx: Context, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Telegram update handling failed: ${message}`);
      await this.safeAnswerCallback(ctx, 'Ошибка');
      await this.safeReply(ctx, 'Не удалось обработать команду. Попробуйте ещё раз.');
    }
  }

  private async handleCallback(ctx: Context): Promise<void> {
    const data = this.getCallbackData(ctx);
    if (!data) {
      return;
    }

    if (data === CALLBACK_HOME) {
      await this.safeAnswerCallback(ctx);
      await this.showMainMenu(ctx);
      return;
    }

    if (data === CALLBACK_CATEGORIES) {
      await this.safeAnswerCallback(ctx);
      await this.showCategories(ctx);
      return;
    }

    if (data === CALLBACK_CART) {
      await this.safeAnswerCallback(ctx);
      await this.showCart(ctx);
      return;
    }

    if (data === CALLBACK_CHECKOUT) {
      await this.safeAnswerCallback(ctx);
      await this.checkoutCart(ctx);
      return;
    }

    if (data === CALLBACK_CLEAR_CART) {
      await this.safeAnswerCallback(ctx);
      await this.clearCart(ctx);
      return;
    }

    if (data === CALLBACK_PROMO) {
      await this.safeAnswerCallback(ctx);
      await this.promptPromoCode(ctx);
      return;
    }

    const deliveryMatch = data.match(DELIVERY_PATTERN);
    if (deliveryMatch) {
      await this.safeAnswerCallback(ctx);
      await this.selectDeliveryMethod(ctx, deliveryMatch[1] as DeliveryMethod);
      return;
    }

    const categoryMatch = data.match(CATEGORY_PAGE_PATTERN);
    if (categoryMatch) {
      await this.safeAnswerCallback(ctx);
      const categoryId = categoryMatch[1];
      const offset = Number(categoryMatch[2]);
      await this.showCategoryProducts(ctx, categoryId, offset);
      return;
    }

    const addMatch = data.match(ADD_PRODUCT_PATTERN);
    if (addMatch) {
      const productId = addMatch[1];
      await this.addProductToCart(ctx, productId);
      return;
    }

    await this.safeAnswerCallback(ctx);
  }

  private async handleText(ctx: Context): Promise<void> {
    const user = this.getTelegramUser(ctx);
    if (!user) {
      return;
    }

    const cart = this.carts.get(user.id);
    if (!cart?.pendingInput) {
      return;
    }

    const text = this.getMessageText(ctx).trim();
    if (!text) {
      await this.safeReply(ctx, 'Введите значение текстом.');
      return;
    }

    if (cart.pendingInput === 'promo') {
      await this.applyPromoCode(ctx, cart, text);
      return;
    }

    if (cart.pendingInput === 'pickupPointAddress') {
      cart.pickupPointAddress = text;
      cart.pendingInput = 'customerPhone';
      await this.safeReply(ctx, 'Введите телефон для связи.');
      return;
    }

    if (cart.pendingInput === 'customerPhone') {
      if (!/^[0-9+()\-\s]+$/.test(text)) {
        await this.safeReply(ctx, 'Телефон может содержать цифры, пробелы, +, -, ( и ).');
        return;
      }

      cart.customerPhone = text;
      cart.pendingInput = 'customerFullName';
      await this.safeReply(ctx, 'Введите ФИО получателя.');
      return;
    }

    cart.customerFullName = text;
    cart.pendingInput = undefined;
    await this.checkoutCart(ctx);
  }

  private async showMainMenu(ctx: Context): Promise<void> {
    const text = [
      'MajorModels Bot',
      '',
      'Выберите действие:',
      '- открыть категории',
      '- посмотреть корзину',
      '- отправить заявку',
    ].join('\n');

    await this.upsertMessage(ctx, text, this.mainMenuKeyboard());
  }

  private async showCategories(ctx: Context): Promise<void> {
    const categories = await this.telegramBackendRepository.listCategories();
    const text = this.buildCategoriesText(categories);

    await this.upsertMessage(ctx, text, this.categoriesKeyboard(categories));
  }

  private async showCategoryProducts(
    ctx: Context,
    categoryId: string,
    offset: number,
  ): Promise<void> {
    const productPage = await this.telegramBackendRepository.listProducts({
      categoryId,
      limit: PRODUCTS_PAGE_LIMIT,
      offset,
    });

    const categoryName = await this.resolveCategoryName(categoryId);
    const text = this.buildProductsText(categoryName, productPage.total, productPage.offset);
    const keyboard = this.categoryProductsKeyboard({
      categoryId,
      offset: productPage.offset,
      total: productPage.total,
      limit: productPage.limit,
      products: productPage.items,
    });

    await this.upsertMessage(ctx, text, keyboard);
  }

  private async showCart(ctx: Context): Promise<void> {
    const user = this.getTelegramUser(ctx);
    if (!user) {
      await this.upsertMessage(ctx, 'Не удалось определить Telegram пользователя.');
      return;
    }

    const cart = this.carts.get(user.id);
    if (!cart || cart.items.size === 0) {
      await this.upsertMessage(
        ctx,
        'Корзина пуста. Откройте категории и добавьте товары.',
        this.emptyCartKeyboard(),
      );
      return;
    }

    await this.upsertMessage(ctx, this.buildCartText(cart), this.cartKeyboard());
  }

  private async promptPromoCode(ctx: Context): Promise<void> {
    const user = this.getTelegramUser(ctx);
    if (!user) {
      await this.upsertMessage(ctx, 'Не удалось определить Telegram пользователя.');
      return;
    }

    const cart = this.carts.get(user.id);
    if (!cart || cart.items.size === 0) {
      await this.upsertMessage(ctx, 'Корзина пуста.', this.emptyCartKeyboard());
      return;
    }

    cart.pendingInput = 'promo';
    await this.upsertMessage(
      ctx,
      'Введите промокод: PROMO10, PROMO15 или PROMO20.',
    );
  }

  private async applyPromoCode(
    ctx: Context,
    cart: UserCart,
    promoCodeInput: string,
  ): Promise<void> {
    const promoCode = promoCodeInput.trim().toUpperCase();
    const discountPercent = PROMO_DISCOUNTS.get(promoCode);

    if (discountPercent === undefined) {
      await this.safeReply(ctx, 'Промокод не найден. Введите PROMO10, PROMO15 или PROMO20.');
      return;
    }

    cart.promoCode = promoCode;
    cart.promoDiscountPercent = discountPercent;
    cart.pendingInput = undefined;

    await this.safeReply(ctx, `Промокод ${promoCode} применен: скидка ${discountPercent}%.`);
    await this.showCart(ctx);
  }

  private async addProductToCart(ctx: Context, productId: string): Promise<void> {
    const user = this.getTelegramUser(ctx);
    if (!user) {
      await this.safeAnswerCallback(ctx, 'Не удалось определить пользователя');
      return;
    }

    const product = await this.telegramBackendRepository.getProductById(productId);
    const cart = this.getOrCreateCart(user.id);
    const existing = cart.items.get(productId);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.items.set(productId, {
        productId: product.id,
        article: product.article,
        productName: product.name,
        unitPrice: product.price,
        quantity: 1,
      });
    }

    const totalItems = this.countItems(cart);
    await this.safeAnswerCallback(ctx, `Добавлено. В корзине: ${totalItems}`);
  }

  private async clearCart(ctx: Context): Promise<void> {
    const user = this.getTelegramUser(ctx);
    if (!user) {
      await this.upsertMessage(ctx, 'Не удалось определить Telegram пользователя.');
      return;
    }

    this.carts.delete(user.id);
    await this.upsertMessage(ctx, 'Корзина очищена.', this.emptyCartKeyboard());
  }

  private async checkoutCart(ctx: Context): Promise<void> {
    const user = this.getTelegramUser(ctx);
    if (!user) {
      await this.upsertMessage(ctx, 'Не удалось определить Telegram пользователя.');
      return;
    }

    const cart = this.carts.get(user.id);
    if (!cart || cart.items.size === 0) {
      await this.upsertMessage(
        ctx,
        'Корзина пуста. Добавьте товары перед отправкой заявки.',
        this.emptyCartKeyboard(),
      );
      return;
    }

    if (!cart.deliveryMethod) {
      await this.upsertMessage(
        ctx,
        'Выберите способ получения заказа.',
        this.deliveryMethodKeyboard(),
      );
      return;
    }

    if (!cart.pickupPointAddress) {
      cart.pendingInput = 'pickupPointAddress';
      await this.upsertMessage(ctx, 'Введите адрес ПВЗ.');
      return;
    }

    if (!cart.customerPhone) {
      cart.pendingInput = 'customerPhone';
      await this.upsertMessage(ctx, 'Введите телефон для связи.');
      return;
    }

    if (!cart.customerFullName) {
      cart.pendingInput = 'customerFullName';
      await this.upsertMessage(ctx, 'Введите ФИО получателя.');
      return;
    }

    const payload = this.buildCreateOrderPayload(user, cart);
    const createdOrder = await this.telegramBackendRepository.createOrder(payload);

    this.carts.delete(user.id);

    const confirmation = [
      'Заявка отправлена.',
      `Номер: ${createdOrder.id}`,
      `Способ получения: ${createdOrder.deliveryMethod}`,
      `Сумма: ${createdOrder.total}`,
      `Статус уведомления: ${createdOrder.status}`,
    ].join('\n');

    await this.upsertMessage(ctx, confirmation, this.mainMenuKeyboard());
  }

  private async selectDeliveryMethod(
    ctx: Context,
    deliveryMethod: DeliveryMethod,
  ): Promise<void> {
    const user = this.getTelegramUser(ctx);
    if (!user) {
      await this.upsertMessage(ctx, 'Не удалось определить Telegram пользователя.');
      return;
    }

    const cart = this.carts.get(user.id);
    if (!cart || cart.items.size === 0) {
      await this.upsertMessage(ctx, 'Корзина пуста.', this.emptyCartKeyboard());
      return;
    }

    cart.deliveryMethod = deliveryMethod;
    cart.pickupPointAddress = undefined;
    cart.customerPhone = undefined;
    cart.customerFullName = undefined;
    cart.pendingInput = 'pickupPointAddress';

    await this.upsertMessage(ctx, `Выбран способ получения: ${deliveryMethod}.\nВведите адрес ПВЗ.`);
  }

  private buildCreateOrderPayload(
    user: TelegramUser,
    cart: UserCart,
  ): TelegramBackendCreateOrderDto {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

    return {
      telegramUserId: String(user.id),
      telegramUsername: user.username,
      telegramFullName: fullName.length > 0 ? fullName : undefined,
      promoCode: cart.promoCode,
      deliveryMethod: cart.deliveryMethod!,
      pickupPointAddress: cart.pickupPointAddress!,
      customerPhone: cart.customerPhone!,
      customerFullName: cart.customerFullName!,
      items: Array.from(cart.items.values()).map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };
  }

  private mainMenuKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: 'Категории', callback_data: CALLBACK_CATEGORIES }],
        [{ text: 'Корзина', callback_data: CALLBACK_CART }],
        [{ text: 'Оформить заявку', callback_data: CALLBACK_CHECKOUT }],
      ],
    };
  }

  private categoriesKeyboard(categories: TelegramBackendCategoryDto[]): InlineKeyboardMarkup {
    const categoryButtons = categories.map((category) => [
      {
        text: this.truncateButtonText(category.name),
        callback_data: `cat:${category.id}:0`,
      },
    ]);

    return {
      inline_keyboard: [
        ...categoryButtons,
        [{ text: 'Корзина', callback_data: CALLBACK_CART }],
        [{ text: 'В меню', callback_data: CALLBACK_HOME }],
      ],
    };
  }

  private categoryProductsKeyboard(params: {
    categoryId: string;
    offset: number;
    limit: number;
    total: number;
    products: Array<{
      id: string;
      article: string;
      name: string;
      price: string;
    }>;
  }): InlineKeyboardMarkup {
    const productRows = params.products.map((product) => [
      {
        text: this.truncateButtonText(
          `+ ${product.article} | ${product.name} (${product.price})`,
        ),
        callback_data: `add:${product.id}`,
      },
    ]);

    const navigationRow: InlineKeyboardButton[] = [];
    if (params.offset > 0) {
      const prevOffset = Math.max(0, params.offset - params.limit);
      navigationRow.push({
        text: '< Назад',
        callback_data: `cat:${params.categoryId}:${prevOffset}`,
      });
    }

    if (params.offset + params.limit < params.total) {
      const nextOffset = params.offset + params.limit;
      navigationRow.push({
        text: 'Вперед >',
        callback_data: `cat:${params.categoryId}:${nextOffset}`,
      });
    }

    const keyboardRows: InlineKeyboardButton[][] = [
      ...productRows,
      ...(navigationRow.length > 0 ? [navigationRow] : []),
      [{ text: 'Категории', callback_data: CALLBACK_CATEGORIES }],
      [{ text: 'Корзина', callback_data: CALLBACK_CART }],
      [{ text: 'В меню', callback_data: CALLBACK_HOME }],
    ];

    return { inline_keyboard: keyboardRows };
  }

  private cartKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: 'Промокод', callback_data: CALLBACK_PROMO }],
        [{ text: 'Оформить заявку', callback_data: CALLBACK_CHECKOUT }],
        [{ text: 'Очистить корзину', callback_data: CALLBACK_CLEAR_CART }],
        [{ text: 'Категории', callback_data: CALLBACK_CATEGORIES }],
        [{ text: 'В меню', callback_data: CALLBACK_HOME }],
      ],
    };
  }

  private deliveryMethodKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: 'SDEC', callback_data: `${DELIVERY_CALLBACK_PREFIX}SDEC` }],
        [{ text: 'OZON', callback_data: `${DELIVERY_CALLBACK_PREFIX}OZON` }],
        [{ text: 'Корзина', callback_data: CALLBACK_CART }],
      ],
    };
  }

  private emptyCartKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: 'Открыть категории', callback_data: CALLBACK_CATEGORIES }],
        [{ text: 'В меню', callback_data: CALLBACK_HOME }],
      ],
    };
  }

  private getOrCreateCart(userId: number): UserCart {
    let cart = this.carts.get(userId);
    if (!cart) {
      cart = { items: new Map<string, CartItem>() };
      this.carts.set(userId, cart);
    }

    return cart;
  }

  private getTelegramUser(ctx: Context): TelegramUser | null {
    const from = ctx.from;
    if (!from) {
      return null;
    }

    return {
      id: from.id,
      username: from.username,
      first_name: from.first_name,
      last_name: from.last_name,
    };
  }

  private countItems(cart: UserCart): number {
    let total = 0;
    for (const item of cart.items.values()) {
      total += item.quantity;
    }
    return total;
  }

  private buildCartText(cart: UserCart): string {
    let totalCents = 0n;
    const lines: string[] = ['Корзина:', ''];

    Array.from(cart.items.values()).forEach((item, index) => {
      const unitCents = decimalStringToCents(item.unitPrice);
      const subtotalCents = unitCents * BigInt(item.quantity);
      totalCents += subtotalCents;

      lines.push(
        `${index + 1}. ${item.article} | ${item.productName}`,
        `   Кол-во: ${item.quantity}`,
        `   Цена: ${item.unitPrice}`,
        `   Сумма: ${centsToDecimalString(subtotalCents)}`,
      );
    });

    const discountCents = this.calculateDiscountCents(
      totalCents,
      cart.promoDiscountPercent,
    );
    const payableCents = totalCents - discountCents;

    lines.push('', `Подытог: ${centsToDecimalString(totalCents)}`);

    if (cart.promoCode && cart.promoDiscountPercent) {
      lines.push(
        `Промокод: ${cart.promoCode} (-${cart.promoDiscountPercent}%)`,
        `Скидка: ${centsToDecimalString(discountCents)}`,
      );
    }

    if (cart.deliveryMethod) {
      lines.push(`Способ получения: ${cart.deliveryMethod}`);
    }

    lines.push(`Итого к оплате: ${centsToDecimalString(payableCents)}`);
    return lines.join('\n');
  }

  private calculateDiscountCents(
    subtotalCents: bigint,
    discountPercent: number | undefined,
  ): bigint {
    if (!discountPercent) {
      return 0n;
    }

    return (subtotalCents * BigInt(discountPercent)) / 100n;
  }

  private buildCategoriesText(categories: TelegramBackendCategoryDto[]): string {
    if (categories.length === 0) {
      return 'Категорий пока нет.';
    }

    const lines = [
      'Категории:',
      ...categories.map((category, index) => `${index + 1}. ${category.name}`),
    ];

    return lines.join('\n');
  }

  private buildProductsText(categoryName: string, total: number, offset: number): string {
    return [
      `Категория: ${categoryName}`,
      `Товаров всего: ${total}`,
      `Смещение: ${offset}`,
      '',
      'Нажмите на кнопку товара, чтобы добавить его в корзину.',
    ].join('\n');
  }

  private async resolveCategoryName(categoryId: string): Promise<string> {
    const categories = await this.telegramBackendRepository.listCategories();
    return categories.find((category) => category.id === categoryId)?.name ?? categoryId;
  }

  private async upsertMessage(
    ctx: Context,
    text: string,
    keyboard?: InlineKeyboardMarkup,
  ): Promise<void> {
    const options = keyboard ? { reply_markup: keyboard } : undefined;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, options);
        return;
      } catch {
        // Fallback to reply, e.g. when Telegram rejects edit due to unchanged content.
      }
    }

    await ctx.reply(text, options);
  }

  private getCallbackData(ctx: Context): string | null {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      return null;
    }

    return callbackQuery.data ?? null;
  }

  private getMessageText(ctx: Context): string {
    const message = ctx.message;
    if (!message || !('text' in message)) {
      return '';
    }

    return message.text;
  }

  private async safeAnswerCallback(ctx: Context, text?: string): Promise<void> {
    if (!ctx.callbackQuery) {
      return;
    }

    try {
      await ctx.answerCbQuery(text);
    } catch {
      // Ignore answerCbQuery failures to avoid breaking user flow.
    }
  }

  private async safeReply(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.reply(text);
    } catch {
      // Ignore reply errors in fallback path.
    }
  }

  private truncateButtonText(value: string): string {
    if (value.length <= BUTTON_TEXT_MAX_LENGTH) {
      return value;
    }

    return `${value.slice(0, BUTTON_TEXT_MAX_LENGTH - 3)}...`;
  }
}
