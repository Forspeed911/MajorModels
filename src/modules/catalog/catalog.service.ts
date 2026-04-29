import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryResponseDto } from './dto/category-response.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import {
  ProductListResponseDto,
  ProductResponseDto,
} from './dto/product-response.dto';
import { CatalogRepository } from './repositories/catalog.repository';

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async getCategories(): Promise<CategoryResponseDto[]> {
    const categories = await this.catalogRepository.findCategories();

    return categories.map(CategoryResponseDto.fromModel);
  }

  async getProducts(query: ListProductsQueryDto): Promise<ProductListResponseDto> {
    const search = query.search?.trim();
    const result = await this.catalogRepository.findProducts({
      categoryId: query.categoryId,
      search: search ? search : undefined,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items: result.items.map(ProductResponseDto.fromModel),
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getProductById(id: string): Promise<ProductResponseDto> {
    const product = await this.catalogRepository.findProductById(id);
    if (!product) {
      throw new NotFoundException(`Product with id '${id}' not found`);
    }

    return ProductResponseDto.fromModel(product);
  }
}
