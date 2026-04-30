import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    CatalogModule,
    OrdersModule,
    TelegramBotModule,
  ],
})
export class AppModule {}
