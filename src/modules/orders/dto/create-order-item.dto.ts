import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID(4)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}
