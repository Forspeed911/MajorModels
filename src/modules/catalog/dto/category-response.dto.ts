import type { Category } from '.prisma/client';

export class CategoryResponseDto {
  id!: string;
  name!: string;

  static fromModel(model: Category): CategoryResponseDto {
    return {
      id: model.id,
      name: model.name,
    };
  }
}
