import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderIdParamDto } from './dto/order-id-param.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.ordersService.createOrder(dto);
  }

  @Get(':id')
  getOrderById(@Param() params: OrderIdParamDto): Promise<OrderResponseDto> {
    return this.ordersService.getOrderById(params.id);
  }
}
