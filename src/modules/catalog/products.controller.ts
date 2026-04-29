import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductIdParamDto } from './dto/product-id-param.dto';
import {
  ProductListResponseDto,
  ProductResponseDto,
} from './dto/product-response.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  listProducts(@Query() query: ListProductsQueryDto): Promise<ProductListResponseDto> {
    return this.catalogService.getProducts(query);
  }

  @Get(':id')
  getProduct(@Param() params: ProductIdParamDto): Promise<ProductResponseDto> {
    return this.catalogService.getProductById(params.id);
  }
}
