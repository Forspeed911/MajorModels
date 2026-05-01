import { Injectable } from '@nestjs/common';
import { Prisma } from '.prisma/client';
import type { Category } from '.prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  productDetailsInclude,
  type ProductDetailsModel,
} from '../dto/product-response.dto';

export interface FindProductsParams {
  categoryId?: string;
  search?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findProducts(
    params: FindProductsParams,
  ): Promise<{ items: ProductDetailsModel[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.search
        ? {
            OR: [
              {
                name: {
                  contains: params.search,
                  mode: 'insensitive',
                },
              },
              {
                article: {
                  contains: params.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productDetailsInclude,
        orderBy: [{ name: 'asc' }, { article: 'asc' }],
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  findProductById(id: string): Promise<ProductDetailsModel | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: productDetailsInclude,
    });
  }
}
