import type { Prisma } from '.prisma/client';

export const productDetailsInclude = {
  images: {
    orderBy: [{ sortOrder: 'asc' }, { url: 'asc' }],
  },
} satisfies Prisma.ProductInclude;

export type ProductDetailsModel = Prisma.ProductGetPayload<{
  include: typeof productDetailsInclude;
}>;

export class ProductResponseDto {
  id!: string;
  categoryId!: string;
  article!: string;
  name!: string;
  price!: string;
  imageUrl!: string | null;
  images!: string[];

  static fromModel(model: ProductDetailsModel): ProductResponseDto {
    const images = model.images.map((image) => image.url);

    return {
      id: model.id,
      categoryId: model.categoryId,
      article: model.article,
      name: model.name,
      price: model.price.toString(),
      imageUrl: images[0] ?? model.imageUrl,
      images,
    };
  }
}

export class ProductListResponseDto {
  items!: ProductResponseDto[];
  total!: number;
  limit!: number;
  offset!: number;
}
