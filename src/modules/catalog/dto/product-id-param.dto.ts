import { IsUUID } from 'class-validator';

export class ProductIdParamDto {
  @IsUUID(4)
  id!: string;
}
