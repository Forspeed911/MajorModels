import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryMethod } from '.prisma/client';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsString()
  @MaxLength(64)
  telegramUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  telegramFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  promoCode?: string;

  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsString()
  @MaxLength(500)
  pickupPointAddress!: string;

  @IsString()
  @MaxLength(32)
  @Matches(/^[0-9+()\-\s]+$/)
  customerPhone!: string;

  @IsString()
  @MaxLength(120)
  customerFullName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
