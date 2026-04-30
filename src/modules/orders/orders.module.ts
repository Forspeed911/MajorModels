import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { OrdersTelegramService } from './services/orders-telegram.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService, OrdersTelegramService],
})
export class OrdersModule {}
