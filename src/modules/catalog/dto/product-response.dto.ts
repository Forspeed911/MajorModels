import type { Product } from '.prisma/client';

export class ProductResponseDto {
  id!: string;
  categoryId!: string;
  article!: string;
  name!: string;
  price!: string;
  imageUrl!: string | null;

  static fromModel(model: Product): ProductResponseDto {
    return {
      id: model.id,
      categoryId: model.categoryId,
      article: model.article,
      name: model.name,
      price: model.price.toString(),
      imageUrl: model.imageUrl,
    };
  }
}

export class ProductListResponseDto {
  items!: ProductResponseDto[];
  total!: number;
  limit!: number;
  offset!: number;
}
